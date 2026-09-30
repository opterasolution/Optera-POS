import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Sale, ISaleItem } from "@/models/Sale";
import { Product } from "@/models/Product";
import { Business } from "@/models/Business";
import { Customer } from "@/models/Customer";
import { InventoryMovement } from "@/models/InventoryMovement";
import { AuditLog } from "@/models/AuditLog";
import { Shift } from "@/models/Shift";
import { CreditTransaction } from "@/models/CreditTransaction";
import { requireAuth, verifyActiveSubscription } from "@/lib/tenant";
import { createSaleSchema } from "@/lib/validations/sale";

export async function POST(req: Request) {
  try {
    const context = await requireAuth();
    await verifyActiveSubscription(context.businessId);
    const body = await req.json();

    const parsed = createSaleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const {
      items,
      customerName,
      customerPhone,
      discountTotal,
      paymentMethod,
      cashReceived,
      paymentReference,
      registerId,
      registerName,
      shiftId,
    } = parsed.data;

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      // 1. Fetch store tax & business settings
      const business = await Business.findById(businessId);
      const isTaxEnabled = business?.taxSettings?.enabled || false;
      const taxRate = isTaxEnabled ? business?.taxSettings?.rate || 0 : 0;
      const isTaxExclusive = business?.taxSettings?.type === "EXCLUSIVE";

      // 2. Fetch products from database to prevent client price tampering!
      const productIds = items.map((i) => i.productId);
      const dbProducts = await Product.find({
        _id: { $in: productIds },
        businessId,
        isActive: true,
      });

      if (dbProducts.length !== items.length) {
        return NextResponse.json(
          { success: false, error: "One or more products could not be found or are inactive." },
          { status: 400 }
        );
      }

      // Map products for fast lookup
      const productMap = new Map(dbProducts.map((p) => [p._id.toString(), p]));

      // 3. Verify stock and calculate verified financial snapshot
      const verifiedItems: ISaleItem[] = [];
      let calculatedSubtotal = 0;

      for (const item of items) {
        const dbProduct = productMap.get(item.productId);
        if (!dbProduct) {
          return NextResponse.json(
            { success: false, error: `Product ID ${item.productId} not found.` },
            { status: 400 }
          );
        }

        // Verify stock availability
        if (dbProduct.stockQuantity < item.quantity) {
          return NextResponse.json(
            {
              success: false,
              error: `Insufficient stock for "${dbProduct.name}". Only ${dbProduct.stockQuantity} ${dbProduct.unit} available.`,
            },
            { status: 400 }
          );
        }

        const unitPrice = dbProduct.sellingPrice;
        const costPrice = dbProduct.costPrice;
        const lineSubtotal = unitPrice * item.quantity;
        const lineDiscount = item.discount || 0;
        const lineTotal = Math.max(0, lineSubtotal - lineDiscount);

        calculatedSubtotal += lineTotal;

        verifiedItems.push({
          productId: dbProduct._id,
          name: dbProduct.name,
          barcode: dbProduct.barcode,
          unitPrice,
          costPrice,
          quantity: item.quantity,
          subtotal: lineSubtotal,
          discount: lineDiscount,
          total: lineTotal,
        });
      }

      // 4. Calculate final tax and net totals
      let taxTotal = 0;
      let netTotal = Math.max(0, calculatedSubtotal - discountTotal);

      if (isTaxEnabled && taxRate > 0) {
        if (isTaxExclusive) {
          taxTotal = (netTotal * taxRate) / 100;
          netTotal += taxTotal;
        } else {
          // Tax inclusive: calculate portion of total that is tax
          taxTotal = (netTotal * taxRate) / (100 + taxRate);
        }
      }

      // Round to 2 decimal places
      netTotal = Math.round(netTotal * 100) / 100;
      taxTotal = Math.round(taxTotal * 100) / 100;

      // 5. Verify cash change calculation
      let calculatedChange = 0;
      if (paymentMethod === "CASH") {
        const tendered = cashReceived || 0;
        if (tendered < netTotal) {
          return NextResponse.json(
            {
              success: false,
              error: `Cash received (Rs. ${tendered.toFixed(2)}) is less than total amount (Rs. ${netTotal.toFixed(2)}).`,
            },
            { status: 400 }
          );
        }
        calculatedChange = Math.round((tendered - netTotal) * 100) / 100;
      }

      // 6. Generate sequential invoice number: INV-YYYY-XXXXX
      const year = new Date().getFullYear();
      const totalSalesCount = await Sale.countDocuments({ businessId });
      const invoiceNumber = `INV-${year}-${(totalSalesCount + 1).toString().padStart(5, "0")}`;

      // 7. Handle Customer assignment or creation & Credit verification
      let customerId = undefined;
      let customerDoc: any = null;

      if (customerPhone && customerPhone.trim() !== "") {
        customerDoc = await Customer.findOne({
          businessId,
          phone: customerPhone.trim(),
        });

        if (!customerDoc) {
          customerDoc = await Customer.create({
            businessId,
            name: customerName || "Customer",
            phone: customerPhone.trim(),
            totalSpent: netTotal,
            visitCount: 1,
            lastVisit: new Date(),
          });
        } else {
          customerDoc.totalSpent += netTotal;
          customerDoc.visitCount += 1;
          customerDoc.lastVisit = new Date();
          if (customerName && customerName !== "Walk-in Customer") {
            customerDoc.name = customerName;
          }
          await customerDoc.save();
        }
        customerId = customerDoc._id;
      }

      // If sale is on CREDIT (Naya Potha), enforce credit qualification and ceilings
      if (paymentMethod === "CREDIT") {
        if (!customerDoc) {
          return NextResponse.json(
            {
              success: false,
              error: "A registered customer with a valid Sri Lankan phone number is required for store credit sales (Naya Potha).",
            },
            { status: 400 }
          );
        }

        if (!customerDoc.creditAllowed) {
          return NextResponse.json(
            {
              success: false,
              error: `Store credit is not enabled for ${customerDoc.name}. Please activate credit in the Customer Profile.`,
            },
            { status: 400 }
          );
        }

        const currentDebt = customerDoc.currentBalance || 0;
        const limit = customerDoc.creditLimit || 0;
        if (currentDebt + netTotal > limit) {
          return NextResponse.json(
            {
              success: false,
              error: `Credit limit exceeded for ${customerDoc.name}. Current Balance: Rs. ${currentDebt.toLocaleString()}, Limit: Rs. ${limit.toLocaleString()}. Adding Rs. ${netTotal.toLocaleString()} would exceed the allowed limit.`,
            },
            { status: 400 }
          );
        }

        // Increment customer balance
        customerDoc.currentBalance = currentDebt + netTotal;
        await customerDoc.save();
      }

      // 8. Determine active shift if not explicitly provided
      let resolvedShiftId = shiftId && shiftId.trim() ? new Types.ObjectId(shiftId) : undefined;
      if (!resolvedShiftId && registerId && registerId.trim()) {
        const activeShift = await Shift.findOne({
          businessId,
          registerId: new Types.ObjectId(registerId),
          status: "OPEN",
        });
        if (activeShift) {
          resolvedShiftId = activeShift._id;
        }
      }

      // 9. Create Sale record
      const sale = await Sale.create({
        businessId,
        invoiceNumber,
        cashierId: context.userId,
        cashierName: context.username || "Cashier",
        customerId,
        customerName: customerName || "Walk-in Customer",
        customerPhone: customerPhone || undefined,
        items: verifiedItems,
        subtotal: calculatedSubtotal,
        discountTotal,
        taxTotal,
        netTotal,
        paymentMethod,
        cashReceived: paymentMethod === "CASH" ? cashReceived : undefined,
        changeGiven: paymentMethod === "CASH" ? calculatedChange : undefined,
        paymentReference,
        registerId: registerId && registerId.trim() ? new Types.ObjectId(registerId) : undefined,
        registerName: registerName?.trim() || "Counter 01 (Main)",
        shiftId: resolvedShiftId,
        isCreditSale: paymentMethod === "CREDIT",
        status: "COMPLETED",
      });

      // If credit sale, record in CreditTransaction passbook
      if (paymentMethod === "CREDIT" && customerDoc) {
        const count = await CreditTransaction.countDocuments({ businessId });
        const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const transactionNumber = `CR-TXN-${todayStr}-${String(count + 1).padStart(4, "0")}`;

        const creditTxn = await CreditTransaction.create({
          businessId,
          customerId: customerDoc._id,
          transactionNumber,
          type: "CREDIT_SALE",
          amount: netTotal,
          balanceBefore: customerDoc.currentBalance - netTotal,
          balanceAfter: customerDoc.currentBalance,
          saleId: sale._id,
          invoiceNumber,
          shiftId: resolvedShiftId,
          registerId: registerId && registerId.trim() ? new Types.ObjectId(registerId) : undefined,
          registerName: registerName?.trim() || "Counter 01 (Main)",
          notes: `Credit Sale: ${invoiceNumber}`,
          performedBy: context.username || "Cashier",
        });

        sale.creditTransactionId = creditTxn._id;
        await sale.save();
      }

      // 10. Atomically deduct inventory stock and record movement history
      for (const item of verifiedItems) {
        const dbProduct = productMap.get(item.productId.toString());
        const prevStock = dbProduct ? dbProduct.stockQuantity : 0;
        const newStock = Math.max(0, prevStock - item.quantity);

        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stockQuantity: -item.quantity },
        });

        await InventoryMovement.create({
          businessId,
          productId: item.productId,
          type: "SALE",
          quantityChange: -item.quantity,
          previousStock: prevStock,
          newStock,
          reason: `POS Sale ${invoiceNumber}`,
          referenceId: invoiceNumber,
          createdBy: context.userId,
        });
      }

      // 10. Audit Log
      await AuditLog.create({
        businessId,
        userId: context.userId,
        userName: context.username,
        action: "SALE_COMPLETED",
        entityType: "Sale",
        entityId: sale._id.toString(),
        details: { invoiceNumber, netTotal, paymentMethod, itemsCount: items.length },
      });

      return NextResponse.json({ success: true, sale }, { status: 201 });
    }

    // Demo Mode fallback
    const demoInvoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const subtotalCalc = items.reduce((s, it) => s + (it.quantity * 300), 0);
    const demoSale = {
      _id: `sale_${Date.now()}`,
      invoiceNumber: demoInvoiceNumber,
      cashierName: context.username || "Cashier",
      customerName: customerName || "Walk-in Customer",
      customerPhone,
      items: items.map((it) => ({
        name: "Item",
        unitPrice: 300,
        quantity: it.quantity,
        total: it.quantity * 300,
      })),
      subtotal: subtotalCalc,
      discountTotal,
      taxTotal: 0,
      netTotal: subtotalCalc - discountTotal,
      paymentMethod,
      cashReceived: paymentMethod === "CASH" ? cashReceived : undefined,
      changeGiven: paymentMethod === "CASH" ? Math.max(0, (cashReceived || 0) - (subtotalCalc - discountTotal)) : undefined,
      status: "COMPLETED",
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, sale: demoSale }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to record sale";
    const status = message.includes("Unauthorized") ? 401 : message.includes("Store") || message.includes("Suspended") || message.includes("Expired") ? 403 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function GET(req: Request) {
  try {
    const context = await requireAuth();
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim();
    const paymentMethod = searchParams.get("paymentMethod");
    const dateRange = searchParams.get("dateRange") || "all";
    const registerId = searchParams.get("registerId");
    const shiftId = searchParams.get("shiftId");

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const filter: Record<string, unknown> = {
        businessId: context.businessId,
        status: "COMPLETED",
      };

      if (paymentMethod && paymentMethod !== "all") {
        filter.paymentMethod = paymentMethod;
      }

      if (registerId && registerId !== "all") {
        filter.registerId = registerId;
      }

      if (shiftId && shiftId !== "all") {
        filter.shiftId = shiftId;
      }

      if (query) {
        filter.$or = [
          { invoiceNumber: { $regex: query, $options: "i" } },
          { customerName: { $regex: query, $options: "i" } },
          { customerPhone: { $regex: query, $options: "i" } },
        ];
      }

      // Date range filtering
      if (dateRange !== "all") {
        const now = new Date();
        const slOffsetMs = 5.5 * 60 * 60 * 1000;
        const slNow = new Date(now.getTime() + slOffsetMs);

        const startOfDay = new Date(
          Date.UTC(slNow.getUTCFullYear(), slNow.getUTCMonth(), slNow.getUTCDate()) - slOffsetMs
        );

        if (dateRange === "today") {
          filter.createdAt = { $gte: startOfDay };
        } else if (dateRange === "yesterday") {
          const startOfYesterday = new Date(startOfDay.getTime() - 24 * 60 * 60 * 1000);
          filter.createdAt = { $gte: startOfYesterday, $lt: startOfDay };
        } else if (dateRange === "week") {
          const startOfWeek = new Date(startOfDay.getTime() - 7 * 24 * 60 * 60 * 1000);
          filter.createdAt = { $gte: startOfWeek };
        } else if (dateRange === "month") {
          const startOfMonth = new Date(
            Date.UTC(slNow.getUTCFullYear(), slNow.getUTCMonth(), 1) - slOffsetMs
          );
          filter.createdAt = { $gte: startOfMonth };
        }
      }

      const sales = await Sale.find(filter).sort({ createdAt: -1 }).limit(100);

      // Financial stats for current filtered list
      const totalRevenue = sales.reduce((sum, s) => sum + s.netTotal, 0);
      const totalBills = sales.length;

      return NextResponse.json({
        success: true,
        summary: { totalRevenue, totalBills },
        sales,
      });
    }

    // Demo Data
    return NextResponse.json({
      success: true,
      summary: { totalRevenue: 6560, totalBills: 4 },
      sales: [
        {
          _id: "demo_s1",
          invoiceNumber: "INV-2026-0034",
          cashierName: "Admin",
          customerName: "Kamal Gunaratne",
          paymentMethod: "CASH",
          items: [{ name: "Keeri Samba Rice 5kg", quantity: 1, total: 1450, unitPrice: 1450 }],
          subtotal: 1450,
          discountTotal: 0,
          netTotal: 1450,
          cashReceived: 2000,
          changeGiven: 550,
          createdAt: new Date().toISOString(),
        },
        {
          _id: "demo_s2",
          invoiceNumber: "INV-2026-0033",
          cashierName: "Cashier",
          customerName: "Walk-in Customer",
          paymentMethod: "QR",
          items: [{ name: "Kotmale Fresh Milk 1L", quantity: 1, total: 580, unitPrice: 580 }],
          subtotal: 580,
          discountTotal: 0,
          netTotal: 580,
          createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        },
        {
          _id: "demo_s3",
          invoiceNumber: "INV-2026-0032",
          cashierName: "Admin",
          customerName: "Sunil Silva",
          paymentMethod: "CARD",
          items: [
            { name: "Munchee Super Cream Cracker", quantity: 2, total: 640, unitPrice: 320 },
            { name: "Watawala Ceylon Tea 200g", quantity: 1, total: 420, unitPrice: 420 },
          ],
          subtotal: 1060,
          discountTotal: 0,
          netTotal: 1060,
          createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        },
      ],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load sales";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
