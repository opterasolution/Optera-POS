import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Batch } from "@/models/Batch";
import { Product } from "@/models/Product";
import { requireAuth, verifyActiveSubscription } from "@/lib/tenant";
import { getExpiryBadgeInfo } from "@/lib/fefo";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const context = await requireAuth();
    await verifyActiveSubscription(context.businessId);

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId")?.trim();

    if (!productId || !Types.ObjectId.isValid(productId)) {
      return NextResponse.json({ success: false, error: "Valid Product ID is required" }, { status: 400 });
    }

    await connectToDatabase();
    const businessId = context.businessId;

    const product = await Product.findOne({ _id: productId, businessId }).lean();
    if (!product) {
      return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
    }

    const now = new Date();

    // Query all batches for this product
    const allBatches = await Batch.find({
      businessId,
      productId: product._id,
      quantityAvailable: { $gt: 0 },
    })
      .sort({ expiryDate: 1 })
      .lean();

    const formattedBatches = allBatches.map((b) => {
      const badge = getExpiryBadgeInfo(b.expiryDate, b.status);
      const isUnexpired = new Date(b.expiryDate) > now && b.status !== "QUARANTINED" && b.status !== "EXPIRED";
      return {
        _id: b._id,
        batchNumber: b.batchNumber,
        expiryDate: b.expiryDate,
        manufacturingDate: b.manufacturingDate,
        costPrice: b.costPrice,
        sellingPrice: b.sellingPrice,
        mrp: b.mrp,
        quantityAvailable: b.quantityAvailable,
        status: b.status,
        badge,
        isSellable: isUnexpired,
        quarantineReason: b.quarantineReason,
      };
    });

    const sellableBatches = formattedBatches.filter((b) => b.isSellable);
    const totalSellableQty = sellableBatches.reduce((acc, cur) => acc + cur.quantityAvailable, 0);

    return NextResponse.json({
      success: true,
      productId: product._id,
      productName: product.name,
      isBatchTracked: !!product.isBatchTracked,
      batches: formattedBatches,
      sellableBatches,
      totalSellableQty,
      fefoRecommendedBatch: sellableBatches[0] || null,
    });
  } catch (error: any) {
    console.error("GET /api/batches/fefo error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch FEFO batches" },
      { status: error.status || 500 }
    );
  }
}
