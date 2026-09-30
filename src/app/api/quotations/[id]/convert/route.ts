import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Quotation } from "@/models/Quotation";
import { Sale } from "@/models/Sale";
import { Product } from "@/models/Product";
import { Customer } from "@/models/Customer";
import { InventoryMovement } from "@/models/InventoryMovement";
import { CreditTransaction } from "@/models/CreditTransaction";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth, verifyActiveSubscription } from "@/lib/tenant";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireAuth();
    await verifyActiveSubscription(context.businessId);

    const body = await req.json().catch(() => ({}));
    const {
      paymentMethod = "BANK_TRANSFER",
      cashReceived,
      dueDate,
      paymentReference,
      notes,
    } = body;

    await connectToDatabase();
    const businessId = context.businessId;

    // 1. Fetch quotation
    const quotation = await Quotation.findOne({
      _id: params.id,
      businessId,
    });

    if (!quotation) {
      return NextResponse.json({ success: false, error: "Quotation not found" }, { status: 404 });
    }

    if (quotation.status === "CONVERTED") {
      return NextResponse.json(
        {
          success: false,
          error: `This quotation was already converted to Tax Invoice "${quotation.convertedInvoiceNumber}".`,
        },
        { status: 400 }
      );
    }

    // 2. Fetch all products and verify stock availability
    const productIds = quotation.items.map((i) => i.productId);
    const dbProducts = await Product.find({
      _id: { $in: productIds },
      businessId,
      isActive: true,
    });

    const productMap = new Map(dbProducts.map((p) => [p._id.toString(), p]));

    for (const item of quotation.items) {
      const dbProduct = productMap.get(item.productId.toString());
      if (!dbProduct) {
        return NextResponse.json(
          { success: false, error: `Product "${item.name}" no longer exists in catalog.` },
          { status: 400 }
        );
      }

      if (dbProduct.stockQuantity < item.quantity) {
        return NextResponse.json(
          {
            success: false,
            error: `Insufficient stock for "${item.name}". Only ${dbProduct.stockQuantity} ${dbProduct.unit || "pcs"} available (Quoted: ${item.quantity}).`,
          },
          { status: 400 }
        );
      }
    }

    // 3. Generate sequential invoice number: INV-YYYYMMDD-XXXX
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const countToday = await Sale.countDocuments({
      businessId,
      createdAt: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
      },
    });
    const invoiceNumber = `INV-${todayStr}-${String(countToday + 1).padStart(4, "0")}`;

    const isCredit = paymentMethod === "CREDIT";
    const paymentStatus = isCredit ? "UNPAID" : "PAID";
    const amountPaid = isCredit ? 0 : quotation.netTotal;
    const balanceDue = isCredit ? quotation.netTotal : 0;

    // 4. Create Sale / IRD Tax Invoice
    const sale = await Sale.create({
      businessId,
      invoiceNumber,
      cashierId: context.userId,
      cashierName: context.username || "Staff",
      customerId: quotation.customerId,
      customerName: quotation.customerName,
      customerPhone: quotation.customerPhone,
      items: quotation.items.map((it) => ({
        productId: it.productId,
        name: it.name,
        barcode: it.barcode,
        unitPrice: it.unitPrice,
        costPrice: it.costPrice,
        quantity: it.quantity,
        subtotal: it.subtotal,
        discount: it.discount,
        total: it.total,
        priceTier: it.priceTier,
      })),
      subtotal: quotation.subtotal,
      discountTotal: quotation.discountTotal,
      taxTotal: quotation.taxTotal,
      netTotal: quotation.netTotal,
      paymentMethod,
      cashReceived: paymentMethod === "CASH" ? cashReceived : undefined,
      changeGiven: paymentMethod === "CASH" && cashReceived ? Math.max(0, cashReceived - quotation.netTotal) : undefined,
      paymentReference: paymentReference || undefined,
      registerName: "B2B Sales Desk",
      isCreditSale: isCredit,
      billingType: "WHOLESALE",
      isTaxInvoice: true,
      taxBreakdown: quotation.taxBreakdown,
      buyerDetails: {
        companyName: quotation.companyName,
        tin: quotation.tin,
        vatNumber: quotation.vatNumber,
        address: quotation.address,
        phone: quotation.customerPhone,
      },
      quotationId: quotation._id,
      quotationNumber: quotation.quotationNumber,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      paymentStatus,
      amountPaid,
      balanceDue,
      status: "COMPLETED",
    });

    // 5. Deduct inventory and record stock movements
    for (const item of quotation.items) {
      const dbProduct = productMap.get(item.productId.toString())!;
      const prevStock = dbProduct.stockQuantity;
      const nextStock = prevStock - item.quantity;

      dbProduct.stockQuantity = nextStock;
      await dbProduct.save();

      await InventoryMovement.create({
        businessId,
        productId: dbProduct._id,
        type: "SALE",
        quantityChange: -item.quantity,
        previousStock: prevStock,
        newStock: nextStock,
        referenceId: sale._id,
        reason: `B2B Tax Invoice ${invoiceNumber} (Converted from ${quotation.quotationNumber})`,
        performedBy: context.username || "Staff",
        createdAt: new Date(),
      });
    }

    // 6. If credit invoice and customer exists, update credit ledger
    if (isCredit && quotation.customerId) {
      const customer = await Customer.findOne({ _id: quotation.customerId, businessId });
      if (customer) {
        customer.currentBalance = (customer.currentBalance || 0) + quotation.netTotal;
        customer.totalSpent = (customer.totalSpent || 0) + quotation.netTotal;
        customer.lastVisit = new Date();
        await customer.save();

        const txnNumber = `CR-TXN-${todayStr}-${String(Date.now()).slice(-4)}`;
        await CreditTransaction.create({
          businessId,
          customerId: customer._id,
          saleId: sale._id,
          type: "INVOICE_PURCHASE",
          transactionNumber: txnNumber,
          amount: quotation.netTotal,
          previousBalance: customer.currentBalance - quotation.netTotal,
          newBalance: customer.currentBalance,
          notes: `B2B Tax Invoice ${invoiceNumber} (Converted from ${quotation.quotationNumber})`,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          recordedBy: context.username || "Staff",
        });
      }
    }

    // 7. Update Quotation status to CONVERTED
    quotation.status = "CONVERTED";
    quotation.convertedSaleId = sale._id;
    quotation.convertedInvoiceNumber = invoiceNumber;
    quotation.convertedAt = new Date();
    if (notes) quotation.notes = (quotation.notes ? quotation.notes + " | " : "") + notes;
    await quotation.save();

    // 8. Record audit log
    await AuditLog.create({
      businessId,
      userId: context.userId,
      userName: context.username,
      action: "QUOTATION_CONVERTED",
      entityType: "Sale",
      entityId: sale._id.toString(),
      details: {
        quotationNumber: quotation.quotationNumber,
        invoiceNumber,
        netTotal: quotation.netTotal,
        paymentMethod,
        isCredit,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Quotation "${quotation.quotationNumber}" converted to Tax Invoice "${invoiceNumber}" successfully!`,
      sale,
      invoiceNumber,
      quotation,
    });
  } catch (error: any) {
    console.error("POST /api/quotations/[id]/convert error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to convert quotation to invoice" },
      { status: error.status || 500 }
    );
  }
}
