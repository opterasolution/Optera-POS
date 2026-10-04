import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Product } from "@/models/Product";
import { Supplier } from "@/models/Supplier";
import { AuditLog } from "@/models/AuditLog";
import { requireRole } from "@/lib/tenant";

export async function PUT(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPER_ADMIN"]);
    const body = await req.json();

    const {
      productId,
      supplierId,
      leadTimeDays,
      safetyStockDays,
      minOrderQuantity,
      orderPackSize,
      maxStockLevel,
      lowStockThreshold,
    } = body;

    if (!productId) {
      return NextResponse.json({ success: false, error: "Product ID is required." }, { status: 400 });
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const product = await Product.findOne({ _id: productId, businessId });
      if (!product) {
        return NextResponse.json({ success: false, error: "Product not found." }, { status: 404 });
      }

      if (supplierId !== undefined) {
        if (supplierId) {
          const supplier = await Supplier.findOne({ _id: supplierId, businessId });
          if (supplier) {
            product.supplierId = supplier._id;
            product.supplierName = supplier.name;
          }
        } else {
          product.supplierId = undefined;
          product.supplierName = undefined;
        }
      }

      if (leadTimeDays !== undefined) product.leadTimeDays = Math.max(0, Number(leadTimeDays));
      if (safetyStockDays !== undefined) product.safetyStockDays = Math.max(0, Number(safetyStockDays));
      if (minOrderQuantity !== undefined) product.minOrderQuantity = Math.max(1, Number(minOrderQuantity));
      if (orderPackSize !== undefined) product.orderPackSize = Math.max(1, Number(orderPackSize));
      if (maxStockLevel !== undefined) {
        product.maxStockLevel = maxStockLevel ? Math.max(0, Number(maxStockLevel)) : undefined;
      }
      if (lowStockThreshold !== undefined) {
        product.lowStockThreshold = Math.max(0, Number(lowStockThreshold));
      }

      await product.save();

      await AuditLog.create({
        businessId,
        userId: context.userId,
        action: "UPDATE_REORDER_CONFIG",
        entity: "Product",
        entityId: product._id,
        details: `Updated reorder parameters for ${product.name}: LeadTime ${product.leadTimeDays}d, PackSize ${product.orderPackSize}`,
      });

      return NextResponse.json({
        success: true,
        message: `Updated reorder settings for ${product.name}`,
        product,
      });
    }

    return NextResponse.json(
      { success: false, error: "Database unavailable." },
      { status: 503 }
    );
  } catch (error: any) {
    console.error("Error in PUT /api/procurement/reorder/product-config:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update reorder settings" },
      { status: 500 }
    );
  }
}
