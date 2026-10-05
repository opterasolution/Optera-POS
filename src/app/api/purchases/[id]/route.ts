import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { PurchaseOrder } from "@/models/PurchaseOrder";
import { Supplier } from "@/models/Supplier";
import { Product } from "@/models/Product";
import { requireAuth } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireAuth();
    await connectToDatabase();

    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Purchase Order ID is required." },
        { status: 400 }
      );
    }

    const businessId = context.businessId;

    // Support lookup by either ObjectId or poNumber
    let query: any = { businessId };
    if (Types.ObjectId.isValid(id)) {
      query.$or = [{ _id: id }, { poNumber: id }];
    } else {
      query.poNumber = id;
    }

    const po = await PurchaseOrder.findOne(query).lean();
    if (!po) {
      return NextResponse.json(
        { success: false, error: "Purchase Order not found." },
        { status: 404 }
      );
    }

    // Fetch supplier details
    const supplier = await Supplier.findOne({
      _id: po.supplierId,
      businessId,
    }).lean();

    // Enrich line items with Product barcodes and current catalog details
    const productIds = po.items.map((i: any) => i.productId);
    const products = await Product.find({
      _id: { $in: productIds },
      businessId,
    })
      .select("name barcode sku unit costPrice sellingPrice stockQuantity nameSinhala nameTamil")
      .lean();

    const productMap = new Map(products.map((p: any) => [p._id.toString(), p]));

    const enrichedItems = po.items.map((item: any) => {
      const prod: any = productMap.get(item.productId.toString());
      return {
        ...item,
        barcode: prod?.barcode || "",
        sku: item.sku || prod?.sku || "",
        currentStock: prod?.stockQuantity || 0,
        currentSellingPrice: prod?.sellingPrice || 0,
        currentCostPrice: prod?.costPrice || item.unitCost,
        nameSinhala: prod?.nameSinhala,
        nameTamil: prod?.nameTamil,
      };
    });

    return NextResponse.json({
      success: true,
      purchaseOrder: {
        ...po,
        items: enrichedItems,
      },
      supplier: supplier || null,
    });
  } catch (error: any) {
    console.error("GET /api/purchases/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load purchase order" },
      { status: 500 }
    );
  }
}
