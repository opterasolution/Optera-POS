import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { SaleReturn, ISaleReturnItem } from "@/models/SaleReturn";
import { Sale } from "@/models/Sale";
import { Product } from "@/models/Product";
import { Customer } from "@/models/Customer";
import { CreditNote } from "@/models/CreditNote";
import { Shift } from "@/models/Shift";
import { CreditTransaction } from "@/models/CreditTransaction";
import { InventoryMovement } from "@/models/InventoryMovement";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth, verifyActiveSubscription } from "@/lib/tenant";
import { createReturnSchema } from "@/lib/validations/return";

export async function GET(req: Request) {
  try {
    const context = await requireAuth();
    await verifyActiveSubscription(context.businessId);

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";
    const refundMethod = searchParams.get("refundMethod")?.trim();
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const skip = (page - 1) * limit;

    await connectToDatabase();
    const businessId = context.businessId;

    const query: any = { businessId };

    if (q) {
      query.$or = [
        { returnNumber: { $regex: q, $options: "i" } },
        { originalInvoiceNumber: { $regex: q, $options: "i" } },
        { customerName: { $regex: q, $options: "i" } },
        { customerPhone: { $regex: q, $options: "i" } },
        { creditNoteNumber: { $regex: q, $options: "i" } },
      ];
    }

    if (refundMethod && ["CASH", "CREDIT_NOTE", "CUSTOMER_BALANCE"].includes(refundMethod)) {
      query.refundMethod = refundMethod;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const [returns, total] = await Promise.all([
      SaleReturn.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      SaleReturn.countDocuments(query),
    ]);

    // Calculate aggregate KPI statistics for this business
    const allReturns = await SaleReturn.find({ businessId }).lean();
    let totalRefundAmount = 0;
    let cashRefundsTotal = 0;
    let creditNotesIssuedTotal = 0;
    let customerBalanceTotal = 0;
    let restockedItemsCount = 0;
    let damagedItemsCount = 0;

    for (const ret of allReturns) {
      totalRefundAmount += ret.netRefundTotal || 0;
      if (ret.refundMethod === "CASH") cashRefundsTotal += ret.netRefundTotal || 0;
      if (ret.refundMethod === "CREDIT_NOTE") creditNotesIssuedTotal += ret.netRefundTotal || 0;
      if (ret.refundMethod === "CUSTOMER_BALANCE") customerBalanceTotal += ret.netRefundTotal || 0;

      if (ret.items && Array.isArray(ret.items)) {
        for (const item of ret.items) {
          if (item.condition === "RESTOCKABLE") {
            restockedItemsCount += item.quantity || 0;
          } else {
            damagedItemsCount += item.quantity || 0;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      returns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        totalReturnsCount: allReturns.length,
        totalRefundAmount: Math.round(totalRefundAmount * 100) / 100,
        cashRefundsTotal: Math.round(cashRefundsTotal * 100) / 100,
        creditNotesIssuedTotal: Math.round(creditNotesIssuedTotal * 100) / 100,
        customerBalanceTotal: Math.round(customerBalanceTotal * 100) / 100,
        restockedItemsCount,
        damagedItemsCount,
      },
    });
  } catch (error: any) {
    console.error("GET /api/returns error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch returns" },
      { status: error.status || 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireAuth();
    await verifyActiveSubscription(context.businessId);

    const body = await req.json();
    const parsed = createReturnSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const {
      originalSaleId,
      originalInvoiceNumber,
      customerId,
      customerName,
      customerPhone,
      items,
      refundMethod,
      registerId,
      registerName,
      shiftId,
      notes,
    } = parsed.data;

    await connectToDatabase();
    const businessId = context.businessId;

    // 1. If originalSaleId is provided, verify original sale exists and has unreturned quantity
    let originalSale: any = null;
    if (originalSaleId && Types.ObjectId.isValid(originalSaleId)) {
      originalSale = await Sale.findOne({ _id: originalSaleId, businessId });
      if (!originalSale) {
        return NextResponse.json(
          { success: false, error: "Original sale invoice not found." },
          { status: 404 }
        );
      }
    } else if (originalInvoiceNumber && originalInvoiceNumber.trim()) {
      originalSale = await Sale.findOne({
        invoiceNumber: originalInvoiceNumber.trim().toUpperCase(),
        businessId,
      });
    }

    // 2. Validate return items & prices against database products
    const productIds = items.map((i) => i.productId);
    const dbProducts = await Product.find({
      _id: { $in: productIds },
      businessId,
    });

    if (dbProducts.length !== items.length) {
      return NextResponse.json(
        { success: false, error: "One or more products could not be found." },
        { status: 400 }
      );
    }

    const productMap = new Map(dbProducts.map((p) => [p._id.toString(), p]));

    // Check quantities against original sale if linked
    if (originalSale) {
      for (const item of items) {
        const saleItem = originalSale.items.find(
          (si: any) => si.productId.toString() === item.productId
        );
        if (!saleItem) {
          return NextResponse.json(
            {
              success: false,
              error: `Product "${item.name}" was not part of the original invoice ${originalSale.invoiceNumber}.`,
            },
            { status: 400 }
          );
        }
        const alreadyReturned = saleItem.returnedQuantity || 0;
        const availableToReturn = saleItem.quantity - alreadyReturned;
        if (item.quantity > availableToReturn) {
          return NextResponse.json(
            {
              success: false,
              error: `Cannot return ${item.quantity} units of "${item.name}". Only ${availableToReturn} unit(s) remaining from original purchase.`,
            },
            { status: 400 }
          );
        }
      }
    }

    // 3. Compute item totals and verified items
    const verifiedItems: ISaleReturnItem[] = [];
    let calculatedSubtotal = 0;

    for (const item of items) {
      const dbProduct = productMap.get(item.productId);
      const unitPrice = item.unitPrice ?? dbProduct?.sellingPrice ?? 0;
      const lineTotal = Math.round(unitPrice * item.quantity * 100) / 100;

      calculatedSubtotal += lineTotal;

      verifiedItems.push({
        productId: new Types.ObjectId(item.productId),
        name: item.name || dbProduct?.name || "Product",
        barcode: item.barcode || dbProduct?.barcode,
        unitPrice,
        quantity: item.quantity,
        condition: item.condition,
        reason: item.reason,
        total: lineTotal,
      });
    }

    calculatedSubtotal = Math.round(calculatedSubtotal * 100) / 100;
    const netRefundTotal = calculatedSubtotal;

    // 4. Generate sequential return number: RTN-YYYYMMDD-XXXX
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const totalReturnsCount = await SaleReturn.countDocuments({ businessId });
    const returnNumber = `RTN-${todayStr}-${String(totalReturnsCount + 1).padStart(4, "0")}`;

    // 5. Customer handling & loyalty points clawback
    let resolvedCustomerId: Types.ObjectId | undefined =
      customerId && Types.ObjectId.isValid(customerId)
        ? new Types.ObjectId(customerId)
        : originalSale?.customerId;

    let resolvedCustomerName = customerName || originalSale?.customerName || "Walk-in Customer";
    let resolvedCustomerPhone = customerPhone || originalSale?.customerPhone;
    let customerDoc: any = null;

    if (resolvedCustomerId) {
      customerDoc = await Customer.findOne({ _id: resolvedCustomerId, businessId });
    } else if (resolvedCustomerPhone && resolvedCustomerPhone.trim()) {
      customerDoc = await Customer.findOne({ phone: resolvedCustomerPhone.trim(), businessId });
      if (customerDoc) resolvedCustomerId = customerDoc._id;
    }

    // If refund method is CUSTOMER_BALANCE, verify customer exists
    if (refundMethod === "CUSTOMER_BALANCE") {
      if (!customerDoc) {
        return NextResponse.json(
          {
            success: false,
            error:
              "A registered customer account is required to credit the refund to customer balance.",
          },
          { status: 400 }
        );
      }
      // Credit reduces current balance (or creates store balance if 0)
      const balanceBefore = customerDoc.currentBalance || 0;
      const balanceAfter = Math.round((balanceBefore - netRefundTotal) * 100) / 100;
      customerDoc.currentBalance = balanceAfter;
      await customerDoc.save();

      // Record in CreditTransaction ledger
      const count = await CreditTransaction.countDocuments({ businessId });
      const transactionNumber = `CR-TXN-${todayStr}-${String(count + 1).padStart(4, "0")}`;

      await CreditTransaction.create({
        businessId,
        customerId: customerDoc._id,
        transactionNumber,
        type: "ADJUSTMENT",
        amount: netRefundTotal,
        balanceBefore,
        balanceAfter,
        notes: `Customer Return Refund: ${returnNumber}`,
        performedBy: context.username || "Cashier",
      });
    }

    // Loyalty points clawback calculation
    let pointsDeducted = 0;
    if (customerDoc && originalSale && originalSale.pointsEarned && originalSale.pointsEarned > 0) {
      const originalTotal = originalSale.netTotal || 1;
      const pointsToDeduct = Math.floor(
        (netRefundTotal / originalTotal) * originalSale.pointsEarned
      );
      if (pointsToDeduct > 0) {
        pointsDeducted = Math.min(customerDoc.loyaltyPoints || 0, pointsToDeduct);
        customerDoc.loyaltyPoints = Math.max(0, (customerDoc.loyaltyPoints || 0) - pointsDeducted);
        customerDoc.lifetimePointsEarned = Math.max(
          0,
          (customerDoc.lifetimePointsEarned || 0) - pointsDeducted
        );
        await customerDoc.save();
      }
    }

    // 6. Credit Note creation if refundMethod === "CREDIT_NOTE"
    let creditNoteDoc: any = null;
    let creditNoteNumber: string | undefined = undefined;

    if (refundMethod === "CREDIT_NOTE") {
      const cnCount = await CreditNote.countDocuments({ businessId });
      creditNoteNumber = `CN-${todayStr}-${String(cnCount + 1).padStart(4, "0")}`;

      creditNoteDoc = await CreditNote.create({
        businessId,
        creditNoteNumber,
        returnNumber,
        customerId: resolvedCustomerId,
        customerName: resolvedCustomerName,
        customerPhone: resolvedCustomerPhone,
        initialAmount: netRefundTotal,
        remainingBalance: netRefundTotal,
        status: "ACTIVE",
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days valid
        issuedBy: context.username || "Cashier",
        redemptions: [],
      });
    }

    // 7. Resolve active Shift for cash drawer adjustment if refundMethod === "CASH"
    let resolvedShiftId = shiftId && Types.ObjectId.isValid(shiftId)
      ? new Types.ObjectId(shiftId)
      : undefined;

    if (!resolvedShiftId && registerId && Types.ObjectId.isValid(registerId)) {
      const activeShift = await Shift.findOne({
        businessId,
        registerId: new Types.ObjectId(registerId),
        status: "OPEN",
      });
      if (activeShift) {
        resolvedShiftId = activeShift._id;
      }
    }

    if (refundMethod === "CASH" && resolvedShiftId) {
      // Record a PAY_OUT movement on the active shift drawer
      await Shift.findByIdAndUpdate(resolvedShiftId, {
        $push: {
          cashMovements: {
            type: "PAY_OUT",
            amount: netRefundTotal,
            reason: `Customer Return Refund (${returnNumber})`,
            performedBy: context.username || "Cashier",
            createdAt: new Date(),
          },
        },
      });
    }

    // 8. Create SaleReturn Document
    const saleReturn = await SaleReturn.create({
      businessId,
      returnNumber,
      originalSaleId: originalSale?._id,
      originalInvoiceNumber: originalSale?.invoiceNumber || originalInvoiceNumber,
      customerId: resolvedCustomerId,
      customerName: resolvedCustomerName,
      customerPhone: resolvedCustomerPhone,
      cashierId: context.userId,
      cashierName: context.username || "Cashier",
      registerId: registerId && Types.ObjectId.isValid(registerId) ? new Types.ObjectId(registerId) : undefined,
      registerName: registerName || "Counter 01 (Main)",
      shiftId: resolvedShiftId,
      items: verifiedItems,
      subtotal: calculatedSubtotal,
      taxRefunded: 0,
      netRefundTotal,
      refundMethod,
      creditNoteId: creditNoteDoc?._id,
      creditNoteNumber,
      pointsDeducted,
      notes,
    });

    if (creditNoteDoc) {
      creditNoteDoc.returnId = saleReturn._id;
      await creditNoteDoc.save();
    }

    // 9. Update original Sale document if linked
    if (originalSale) {
      let allReturned = true;
      for (const item of items) {
        const saleItem = originalSale.items.find(
          (si: any) => si.productId.toString() === item.productId
        );
        if (saleItem) {
          saleItem.returnedQuantity = (saleItem.returnedQuantity || 0) + item.quantity;
        }
      }

      for (const si of originalSale.items) {
        if ((si.returnedQuantity || 0) < si.quantity) {
          allReturned = false;
          break;
        }
      }

      originalSale.returnedTotal = (originalSale.returnedTotal || 0) + netRefundTotal;
      originalSale.returnStatus = allReturned ? "FULLY_RETURNED" : "PARTIAL";
      await originalSale.save();
    }

    // 10. Process Inventory Stock Movements
    for (const item of verifiedItems) {
      const dbProduct = productMap.get(item.productId.toString());
      const prevStock = dbProduct ? dbProduct.stockQuantity : 0;

      if (item.condition === "RESTOCKABLE") {
        const newStock = prevStock + item.quantity;
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stockQuantity: item.quantity },
        });

        await InventoryMovement.create({
          businessId,
          productId: item.productId,
          type: "RETURN",
          quantityChange: item.quantity,
          previousStock: prevStock,
          newStock,
          reason: `Customer Return ${returnNumber} (Restocked): ${item.reason}`,
          referenceId: returnNumber,
          createdBy: context.userId,
        });
      } else {
        // DAMAGED or EXPIRED - quarantine without inflating sellable inventory
        await InventoryMovement.create({
          businessId,
          productId: item.productId,
          type: "DAMAGE",
          quantityChange: 0,
          previousStock: prevStock,
          newStock: prevStock,
          reason: `Customer Return ${returnNumber} (Quarantined as ${item.condition}): ${item.reason}`,
          referenceId: returnNumber,
          createdBy: context.userId,
        });
      }
    }

    // 11. Create Audit Log
    await AuditLog.create({
      businessId,
      userId: context.userId,
      userName: context.username,
      action: "RETURN_PROCESSED",
      entityType: "SaleReturn",
      entityId: saleReturn._id.toString(),
      details: {
        returnNumber,
        originalInvoiceNumber: originalSale?.invoiceNumber || originalInvoiceNumber,
        netRefundTotal,
        refundMethod,
        creditNoteNumber,
        itemsCount: items.length,
        pointsDeducted,
      },
    });

    return NextResponse.json(
      {
        success: true,
        saleReturn,
        creditNote: creditNoteDoc,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST /api/returns error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process customer return" },
      { status: error.status || 500 }
    );
  }
}
