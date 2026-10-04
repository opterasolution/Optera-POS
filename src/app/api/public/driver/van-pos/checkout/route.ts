import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { DeliveryDriver } from "@/models/DeliveryDriver";
import { VanSaleSession } from "@/models/VanSaleSession";
import { Sale, ISaleItem } from "@/models/Sale";
import { Customer } from "@/models/Customer";
import { CreditTransaction } from "@/models/CreditTransaction";
import { Business } from "@/models/Business";

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    const body = await req.json();
    const {
      token,
      items,
      customerId,
      customerName,
      customerPhone,
      paymentMethod = "CASH",
      cashReceived,
      discountTotal = 0,
      notes,
    } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Driver token is required." },
        { status: 401 }
      );
    }

    const driver = await DeliveryDriver.findOne({ driverToken: token, active: true });
    if (!driver) {
      return NextResponse.json(
        { success: false, error: "Invalid or inactive driver token." },
        { status: 401 }
      );
    }

    // Find active van session
    const session = await VanSaleSession.findOne({
      driverId: driver._id,
      status: { $in: ["LOADED", "ON_ROUTE"] },
    });

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: "No active van sales session found for this driver. Contact store manager to load van.",
        },
        { status: 400 }
      );
    }

    // If session is still LOADED, auto-start route on first sale
    if (session.status === "LOADED") {
      session.status = "ON_ROUTE";
      session.startedAt = new Date();
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one product item is required for van checkout." },
        { status: 400 }
      );
    }

    // Validate in-transit inventory and calculate line items
    const saleItems: ISaleItem[] = [];
    let calculatedSubtotal = 0;
    let itemDiscountsSum = 0;

    for (const reqItem of items) {
      const quantity = Number(reqItem.quantity);
      if (!quantity || quantity <= 0) {
        return NextResponse.json(
          { success: false, error: "Item quantity must be greater than 0." },
          { status: 400 }
        );
      }

      const sessionItem = session.items.find(
        (si) => si.productId.toString() === reqItem.productId?.toString()
      );

      if (!sessionItem) {
        return NextResponse.json(
          {
            success: false,
            error: `Product ID ${reqItem.productId} was not loaded in this van session.`,
          },
          { status: 400 }
        );
      }

      if (sessionItem.remainingQty < quantity) {
        return NextResponse.json(
          {
            success: false,
            error: `Insufficient van stock for "${sessionItem.productName}". Available: ${sessionItem.remainingQty} ${sessionItem.unit}, requested: ${quantity}.`,
          },
          { status: 400 }
        );
      }

      const priceTier = reqItem.priceTier === "WHOLESALE" ? "WHOLESALE" : "RETAIL";
      const unitPrice =
        priceTier === "WHOLESALE" && sessionItem.wholesalePrice && sessionItem.wholesalePrice > 0
          ? sessionItem.wholesalePrice
          : sessionItem.unitPrice;

      const lineSubtotal = Number((unitPrice * quantity).toFixed(2));
      const lineDiscount = Number((reqItem.discount || 0).toFixed(2));
      const lineTotal = Math.max(0, Number((lineSubtotal - lineDiscount).toFixed(2)));

      calculatedSubtotal += lineSubtotal;
      itemDiscountsSum += lineDiscount;

      saleItems.push({
        productId: sessionItem.productId,
        name: sessionItem.productName,
        nameSinhala: sessionItem.nameSinhala,
        nameTamil: sessionItem.nameTamil,
        barcode: sessionItem.barcode,
        unitPrice,
        costPrice: sessionItem.costPrice || 0,
        quantity,
        subtotal: lineSubtotal,
        discount: lineDiscount,
        total: lineTotal,
        priceTier,
      });
    }

    const overallDiscount = Number((itemDiscountsSum + (Number(discountTotal) || 0)).toFixed(2));
    const netTotal = Math.max(0, Number((calculatedSubtotal - overallDiscount).toFixed(2)));

    let finalCashReceived = 0;
    let finalChangeGiven = 0;

    if (paymentMethod === "CASH") {
      finalCashReceived =
        cashReceived !== undefined && cashReceived !== null
          ? Number(cashReceived)
          : netTotal;
      if (finalCashReceived < netTotal) {
        return NextResponse.json(
          {
            success: false,
            error: `Cash received (Rs. ${finalCashReceived}) is less than net total (Rs. ${netTotal}).`,
          },
          { status: 400 }
        );
      }
      finalChangeGiven = Math.max(0, Number((finalCashReceived - netTotal).toFixed(2)));
    }

    // Customer and Credit Handling
    let targetCustomer: any = null;
    let creditTx: any = null;

    if (customerId) {
      targetCustomer = await Customer.findOne({
        _id: customerId,
        businessId: driver.businessId,
      });
    } else if (customerPhone) {
      targetCustomer = await Customer.findOne({
        phone: customerPhone.trim(),
        businessId: driver.businessId,
      });
    }

    if (paymentMethod === "CREDIT") {
      if (!targetCustomer) {
        return NextResponse.json(
          {
            success: false,
            error: "A registered customer account is required to perform a credit sale.",
          },
          { status: 400 }
        );
      }

      const currentBalance = Number(targetCustomer.balance || 0);
      const creditLimit = Number(targetCustomer.creditLimit || 0);

      if (creditLimit > 0 && currentBalance + netTotal > creditLimit) {
        return NextResponse.json(
          {
            success: false,
            error: `Credit limit exceeded for "${targetCustomer.name}". Credit Limit: Rs. ${creditLimit.toFixed(
              2
            )}, Current Debt: Rs. ${currentBalance.toFixed(2)}, Sale Total: Rs. ${netTotal.toFixed(2)}.`,
          },
          { status: 400 }
        );
      }
    }

    // Generate unique invoice number
    const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-VAN-${dateStamp}-${randSuffix}`;

    // Handle credit balance update and ledger entry
    if (paymentMethod === "CREDIT" && targetCustomer) {
      const balanceBefore = Number(targetCustomer.balance || 0);
      const balanceAfter = Number((balanceBefore + netTotal).toFixed(2));

      targetCustomer.balance = balanceAfter;
      await targetCustomer.save();

      const txNumber = `CR-${Date.now().toString().slice(-8)}`;
      creditTx = await CreditTransaction.create({
        businessId: driver.businessId,
        customerId: targetCustomer._id,
        transactionNumber: txNumber,
        type: "CREDIT_SALE",
        amount: netTotal,
        balanceBefore,
        balanceAfter,
        invoiceNumber,
        performedBy: `${driver.name} (Van Driver)`,
        notes: `Mobile Van Spot Sale Invoice ${invoiceNumber}`,
      });
    }

    // Create official Sale record
    const sale = await Sale.create({
      businessId: driver.businessId,
      invoiceNumber,
      cashierId: driver._id,
      cashierName: `${driver.name} (Van Driver)`,
      customerId: targetCustomer?._id,
      customerName: customerName || targetCustomer?.name || "Spot Customer",
      customerPhone: customerPhone || targetCustomer?.phone || "",
      items: saleItems,
      subtotal: calculatedSubtotal,
      discountTotal: overallDiscount,
      taxTotal: 0,
      netTotal,
      paymentMethod,
      cashReceived: paymentMethod === "CASH" ? finalCashReceived : netTotal,
      changeGiven: paymentMethod === "CASH" ? finalChangeGiven : 0,
      paymentReference: paymentMethod === "QR" ? "LANKAQR-VAN-PAY" : notes || undefined,
      channel: "VAN_SALE",
      vanSaleSessionId: session._id,
      driverId: driver._id,
      vehicleNumber: session.vehicleNumber || driver.vehicleNumber,
      billingType: saleItems.some((i) => i.priceTier === "WHOLESALE") ? "WHOLESALE" : "RETAIL",
      status: "COMPLETED",
      paymentStatus: paymentMethod === "CREDIT" ? "UNPAID" : "PAID",
      amountPaid: paymentMethod === "CREDIT" ? 0 : netTotal,
      balanceDue: paymentMethod === "CREDIT" ? netTotal : 0,
      isCreditSale: paymentMethod === "CREDIT",
      creditTransactionId: creditTx?._id,
    });

    // Decrement In-Transit stock and update session totals
    for (const reqItem of items) {
      const quantity = Number(reqItem.quantity);
      const sessionItem = session.items.find(
        (si) => si.productId.toString() === reqItem.productId?.toString()
      );
      if (sessionItem) {
        sessionItem.soldQty = Number((sessionItem.soldQty + quantity).toFixed(3));
        sessionItem.remainingQty = Math.max(
          0,
          Number((sessionItem.remainingQty - quantity).toFixed(3))
        );
      }
    }

    session.salesSummary.totalSalesCount += 1;
    session.salesSummary.grossSalesTotal = Number(
      (session.salesSummary.grossSalesTotal + calculatedSubtotal).toFixed(2)
    );
    session.salesSummary.discountsTotal = Number(
      (session.salesSummary.discountsTotal + overallDiscount).toFixed(2)
    );
    session.salesSummary.netSalesTotal = Number(
      (session.salesSummary.netSalesTotal + netTotal).toFixed(2)
    );

    if (paymentMethod === "CASH") {
      session.salesSummary.cashCollected = Number(
        (session.salesSummary.cashCollected + netTotal).toFixed(2)
      );
    } else if (paymentMethod === "QR") {
      session.salesSummary.lankaQrCollected = Number(
        (session.salesSummary.lankaQrCollected + netTotal).toFixed(2)
      );
    } else if (paymentMethod === "CREDIT") {
      session.salesSummary.creditCollected = Number(
        (session.salesSummary.creditCollected + netTotal).toFixed(2)
      );
    } else {
      session.salesSummary.otherCollected = Number(
        (session.salesSummary.otherCollected + netTotal).toFixed(2)
      );
    }

    session.transactions.push({
      saleId: sale._id,
      invoiceNumber,
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      itemCount: saleItems.length,
      netTotal,
      paymentMethod,
      createdAt: new Date(),
    });

    await session.save();

    // Fetch business info for LankaQR & WhatsApp text
    const business = await Business.findById(driver.businessId)
      .select("name phone address")
      .lean();

    const businessName = business?.name || "Corner Store POS";

    // LankaQR Payload String
    const lankaQrPayload = `LANKAQR://PAY?m=${encodeURIComponent(
      businessName
    )}&acc=${invoiceNumber}&amt=${netTotal.toFixed(2)}&cur=LKR&ref=${invoiceNumber}`;

    // WhatsApp receipt text generator
    const receiptItemsText = saleItems
      .map(
        (it) =>
          `• ${it.name} x ${it.quantity} = Rs. ${it.total.toLocaleString("en-LK", {
            minimumFractionDigits: 2,
          })}`
      )
      .join("\n");

    const whatsappReceiptText = `*${businessName}* - Van Sales Receipt\n` +
      `🧾 *Invoice #*: ${invoiceNumber}\n` +
      `📅 *Date*: ${new Date().toLocaleString("en-LK")}\n` +
      `👤 *Customer*: ${sale.customerName}\n` +
      `🚐 *Vehicle*: ${session.vehicleNumber} (${driver.name})\n` +
      `--------------------------------\n` +
      `${receiptItemsText}\n` +
      `--------------------------------\n` +
      `💰 *Total*: Rs. ${netTotal.toLocaleString("en-LK", { minimumFractionDigits: 2 })}\n` +
      `💳 *Payment*: ${paymentMethod}${paymentMethod === "CASH" ? ` (Received: Rs. ${finalCashReceived}, Change: Rs. ${finalChangeGiven})` : ""}\n\n` +
      `Thank you for doing business with us!`;

    return NextResponse.json({
      success: true,
      message: "Van sale completed successfully.",
      sale: {
        _id: sale._id,
        invoiceNumber,
        netTotal,
        paymentMethod,
        cashReceived: finalCashReceived,
        changeGiven: finalChangeGiven,
        customerName: sale.customerName,
        customerPhone: sale.customerPhone,
        items: saleItems,
        createdAt: sale.createdAt,
      },
      updatedSession: {
        salesSummary: session.salesSummary,
        items: session.items,
      },
      lankaQrPayload,
      whatsappReceiptText,
    });
  } catch (error: any) {
    console.error("POST /api/public/driver/van-pos/checkout error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process van checkout" },
      { status: 500 }
    );
  }
}
