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
import { requireAuth, verifyActiveSubscription } from "@/lib/tenant";

interface OfflineSaleItemPayload {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
}

interface OfflineSalePayload {
  offlineId: string;
  items: OfflineSaleItemPayload[];
  customerName?: string;
  customerPhone?: string;
  discountTotal?: number;
  paymentMethod: "CASH" | "CARD" | "QR" | "BANK_TRANSFER" | "OTHER";
  cashReceived?: number;
  paymentReference?: string;
  registerId?: string;
  registerName?: string;
  shiftId?: string;
  createdAt?: string;
}

export async function POST(req: Request) {
  try {
    const context = await requireAuth();
    await verifyActiveSubscription(context.businessId);

    const body = await req.json();
    const sales: OfflineSalePayload[] = Array.isArray(body?.sales) ? body.sales : [];

    if (sales.length === 0) {
      return NextResponse.json(
        { success: false, error: "No offline sales provided for synchronization." },
        { status: 400 }
      );
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      // Fetch business tax settings
      const business = await Business.findById(businessId);
      const isTaxEnabled = business?.taxSettings?.enabled || false;
      const taxRate = isTaxEnabled ? business?.taxSettings?.rate || 0 : 0;
      const isTaxExclusive = business?.taxSettings?.type === "EXCLUSIVE";

      const results = [];

      for (const saleItem of sales) {
        const {
          offlineId,
          items,
          customerName,
          customerPhone,
          discountTotal = 0,
          paymentMethod,
          cashReceived,
          paymentReference,
          registerId,
          registerName,
          shiftId,
          createdAt,
        } = saleItem;

        if (!offlineId) continue;

        // 1. Check idempotency: Has this offline sale already been synced?
        const existingSale = await Sale.findOne({ businessId, offlineId });
        if (existingSale) {
          results.push({
            offlineId,
            invoiceNumber: existingSale.invoiceNumber,
            alreadySynced: true,
            success: true,
          });
          continue;
        }

        // 2. Fetch products and calculate verified financial snapshot
        const productIds = items.map((i) => i.productId);
        const dbProducts = await Product.find({
          _id: { $in: productIds },
          businessId,
        });

        const productMap = new Map(dbProducts.map((p) => [p._id.toString(), p]));
        const verifiedItems: ISaleItem[] = [];
        let calculatedSubtotal = 0;

        for (const it of items) {
          const dbProduct = productMap.get(it.productId);
          const unitPrice = dbProduct ? dbProduct.sellingPrice : it.unitPrice;
          const costPrice = dbProduct ? dbProduct.costPrice : 0;
          const lineSubtotal = unitPrice * it.quantity;
          const lineDiscount = it.discount || 0;
          const lineTotal = Math.max(0, lineSubtotal - lineDiscount);

          calculatedSubtotal += lineTotal;

          verifiedItems.push({
            productId: (dbProduct ? dbProduct._id : it.productId) as any,
            name: dbProduct ? dbProduct.name : it.name,
            barcode: dbProduct?.barcode,
            unitPrice,
            costPrice,
            quantity: it.quantity,
            subtotal: lineSubtotal,
            discount: lineDiscount,
            total: lineTotal,
          });

          // Atomically decrement stock
          if (dbProduct) {
            await Product.findByIdAndUpdate(dbProduct._id, {
              $inc: { stockQuantity: -it.quantity },
            });

            // Create inventory movement
            await InventoryMovement.create({
              businessId,
              productId: dbProduct._id,
              type: "OUT",
              quantity: it.quantity,
              reason: "SALE",
              reference: `Offline Sync: ${offlineId}`,
              performedBy: context.username,
            });
          }
        }

        // 3. Calculate tax and net total
        let taxTotal = 0;
        let netTotal = calculatedSubtotal - discountTotal;

        if (isTaxEnabled) {
          if (isTaxExclusive) {
            taxTotal = Math.round(((calculatedSubtotal - discountTotal) * taxRate) / 100 * 100) / 100;
            netTotal += taxTotal;
          } else {
            taxTotal = Math.round(((netTotal * taxRate) / (100 + taxRate)) * 100) / 100;
          }
        }

        // Change calculation
        let calculatedChange: number | undefined = undefined;
        if (paymentMethod === "CASH" && cashReceived !== undefined) {
          calculatedChange = Math.max(0, Math.round((cashReceived - netTotal) * 100) / 100);
        }

        // 4. Generate sequential invoice number
        const year = new Date().getFullYear();
        const totalSalesCount = await Sale.countDocuments({ businessId });
        const invoiceNumber = `INV-${year}-${(totalSalesCount + 1).toString().padStart(5, "0")}`;

        // 5. Update or create customer
        let customerId = undefined;
        if (customerPhone && customerPhone.trim() !== "") {
          let customer = await Customer.findOne({
            businessId,
            phone: customerPhone.trim(),
          });

          if (!customer) {
            customer = await Customer.create({
              businessId,
              name: customerName || "Customer",
              phone: customerPhone.trim(),
              totalSpent: netTotal,
              visitCount: 1,
              lastVisit: new Date(),
            });
          } else {
            customer.totalSpent += netTotal;
            customer.visitCount += 1;
            customer.lastVisit = new Date();
            if (customerName && customerName !== "Walk-in Customer") {
              customer.name = customerName;
            }
            await customer.save();
          }
          customerId = customer._id;
        }

        // Resolve shiftId (use provided or active shift for register)
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

        // 6. Create permanent Sale record
        const sale = await Sale.create({
          businessId,
          offlineId,
          invoiceNumber,
          cashierId: context.userId,
          cashierName: context.username,
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
          changeGiven: calculatedChange,
          paymentReference,
          registerId: registerId && registerId.trim() ? new Types.ObjectId(registerId) : undefined,
          registerName: registerName?.trim() || "Counter 01 (Main)",
          shiftId: resolvedShiftId,
          status: "COMPLETED",
          createdAt: createdAt ? new Date(createdAt) : new Date(),
        });

        // Audit Log
        await AuditLog.create({
          businessId,
          userId: context.userId,
          userName: context.username,
          action: "OFFLINE_SALE_SYNCED",
          entityType: "Sale",
          entityId: sale._id.toString(),
          details: {
            offlineId,
            invoiceNumber,
            netTotal,
            itemCount: verifiedItems.length,
          },
        });

        results.push({
          offlineId,
          invoiceNumber,
          alreadySynced: false,
          success: true,
        });
      }

      return NextResponse.json({
        success: true,
        syncedCount: results.length,
        results,
      });
    }

    // Demo Mode mock response
    const results = sales.map((s, idx) => ({
      offlineId: s.offlineId,
      invoiceNumber: `INV-2026-00${34 + idx}`,
      alreadySynced: false,
      success: true,
    }));

    return NextResponse.json({
      success: true,
      syncedCount: results.length,
      results,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to synchronize offline sales";
    const status = message.includes("Unauthorized") ? 401 : message.includes("Store") ? 403 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
