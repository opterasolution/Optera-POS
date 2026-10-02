import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Batch } from "@/models/Batch";
import { Product } from "@/models/Product";
import { InventoryMovement } from "@/models/InventoryMovement";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth, verifyActiveSubscription } from "@/lib/tenant";
import { refreshBatchStatuses, calculateBatchStatus } from "@/lib/fefo";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const context = await requireAuth();
    await verifyActiveSubscription(context.businessId);

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";
    const status = searchParams.get("status")?.trim();
    const productId = searchParams.get("productId")?.trim();
    const expiringDays = searchParams.get("expiringDays")
      ? parseInt(searchParams.get("expiringDays")!, 10)
      : undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const skip = (page - 1) * limit;

    await connectToDatabase();
    const businessId = context.businessId;

    // Refresh batch statuses (expire passed batches)
    await refreshBatchStatuses(businessId);

    const query: any = { businessId };

    if (productId && Types.ObjectId.isValid(productId)) {
      query.productId = new Types.ObjectId(productId);
    }

    if (status && status !== "ALL") {
      query.status = status;
    }

    if (expiringDays !== undefined && !isNaN(expiringDays)) {
      const now = new Date();
      const targetDate = new Date(Date.now() + expiringDays * 24 * 60 * 60 * 1000);
      query.expiryDate = { $gte: now, $lte: targetDate };
      query.status = { $in: ["ACTIVE", "NEAR_EXPIRY"] };
    }

    if (q) {
      query.$or = [
        { batchNumber: { $regex: q, $options: "i" } },
        { productName: { $regex: q, $options: "i" } },
        { productBarcode: { $regex: q, $options: "i" } },
        { poNumber: { $regex: q, $options: "i" } },
      ];
    }

    const [batches, total] = await Promise.all([
      Batch.find(query).sort({ expiryDate: 1 }).skip(skip).limit(limit).lean(),
      Batch.countDocuments(query),
    ]);

    // Financial & Shelf-Life Telemetry
    const allBatches = await Batch.find({ businessId }).lean();
    const now = new Date();
    const thirtyDaysAhead = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    let activeCount = 0;
    let nearExpiryCount = 0;
    let expiredCount = 0;
    let quarantinedCount = 0;
    let totalStockUnits = 0;
    let totalInventoryValue = 0;
    let atRiskValue = 0; // Value of stock expiring in 30 days or expired

    for (const b of allBatches) {
      const avail = b.quantityAvailable || 0;
      const val = avail * (b.costPrice || 0);

      totalStockUnits += avail;
      totalInventoryValue += val;

      if (b.status === "QUARANTINED") {
        quarantinedCount++;
      } else if (b.status === "EXPIRED" || new Date(b.expiryDate) <= now) {
        expiredCount++;
        atRiskValue += val;
      } else if (new Date(b.expiryDate) <= thirtyDaysAhead) {
        nearExpiryCount++;
        activeCount++;
        atRiskValue += val;
      } else if (b.status === "ACTIVE") {
        activeCount++;
      }
    }

    return NextResponse.json({
      success: true,
      batches,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        totalBatches: allBatches.length,
        activeCount,
        nearExpiryCount,
        expiredCount,
        quarantinedCount,
        totalStockUnits,
        totalInventoryValue: Math.round(totalInventoryValue * 100) / 100,
        atRiskValue: Math.round(atRiskValue * 100) / 100,
      },
    });
  } catch (error: any) {
    console.error("GET /api/batches error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch batches" },
      { status: error.status || 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireAuth();
    await verifyActiveSubscription(context.businessId);

    const body = await req.json();
    const {
      productId,
      batchNumber,
      manufacturingDate,
      expiryDate,
      costPrice,
      sellingPrice,
      mrp,
      quantity,
      supplierId,
      supplierName,
      poNumber,
      notes,
    } = body;

    if (!productId || !batchNumber?.trim() || !expiryDate) {
      return NextResponse.json(
        { success: false, error: "Product, Batch Number, and Expiry Date are required." },
        { status: 400 }
      );
    }

    const qty = Number(quantity);
    if (isNaN(qty) || qty <= 0) {
      return NextResponse.json(
        { success: false, error: "Quantity must be greater than zero." },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const businessId = context.businessId;

    const product = await Product.findOne({ _id: productId, businessId });
    if (!product) {
      return NextResponse.json(
        { success: false, error: "Product not found." },
        { status: 404 }
      );
    }

    // Check if batch number already exists for this product
    const existing = await Batch.findOne({
      businessId,
      productId: product._id,
      batchNumber: batchNumber.trim(),
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Batch number "${batchNumber.trim()}" already exists for this product.` },
        { status: 400 }
      );
    }

    const finalCostPrice = costPrice !== undefined && !isNaN(Number(costPrice)) ? Number(costPrice) : product.costPrice;
    const finalSellingPrice = sellingPrice !== undefined && !isNaN(Number(sellingPrice)) ? Number(sellingPrice) : product.sellingPrice;
    const initialStatus = calculateBatchStatus(new Date(expiryDate), qty, false);

    const batch = await Batch.create({
      businessId,
      productId: product._id,
      productName: product.name,
      productBarcode: product.barcode,
      productSku: product.sku,
      batchNumber: batchNumber.trim(),
      manufacturingDate: manufacturingDate ? new Date(manufacturingDate) : undefined,
      expiryDate: new Date(expiryDate),
      costPrice: finalCostPrice,
      sellingPrice: finalSellingPrice,
      mrp: mrp ? Number(mrp) : undefined,
      initialQuantity: qty,
      quantityAvailable: qty,
      quantitySold: 0,
      quantityDamaged: 0,
      status: initialStatus,
      supplierId: supplierId && Types.ObjectId.isValid(supplierId) ? new Types.ObjectId(supplierId) : undefined,
      supplierName: supplierName?.trim() || undefined,
      poNumber: poNumber?.trim() || undefined,
      notes: notes?.trim() || undefined,
    });

    // Mark product as batch-tracked if not already set, and increase stock quantity
    product.isBatchTracked = true;
    product.stockQuantity += qty;
    if (finalCostPrice > 0) {
      product.costPrice = finalCostPrice;
    }
    await product.save();

    // Log Inventory Movement
    await InventoryMovement.create({
      businessId,
      productId: product._id,
      type: "RESTOCK",
      quantityChange: qty,
      previousStock: product.stockQuantity - qty,
      newStock: product.stockQuantity,
      reason: `Batch Inward Intake: ${batch.batchNumber} (Exp: ${new Date(batch.expiryDate).toLocaleDateString("en-LK")})`,
      referenceId: batch.batchNumber,
      createdBy: context.userId,
    });

    // Audit Log
    await AuditLog.create({
      businessId,
      userId: context.userId,
      userName: context.username,
      action: "BATCH_CREATED",
      entityType: "Batch",
      entityId: batch._id.toString(),
      details: {
        batchNumber: batch.batchNumber,
        productName: product.name,
        quantity: qty,
        expiryDate: batch.expiryDate,
      },
    });

    return NextResponse.json({
      success: true,
      batch,
      message: `Batch ${batch.batchNumber} intake successful with ${qty} ${product.unit} (Exp: ${new Date(batch.expiryDate).toLocaleDateString("en-LK")}).`,
    }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/batches error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create batch" },
      { status: error.status || 500 }
    );
  }
}
