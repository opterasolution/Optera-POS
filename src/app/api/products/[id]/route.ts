import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Product } from "@/models/Product";
import { AuditLog } from "@/models/AuditLog";
import { requireRole } from "@/lib/tenant";
import { productSchema } from "@/lib/validations/product";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "CASHIER"]);

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const product = await Product.findOne({
        _id: params.id,
        businessId: context.businessId,
        isActive: true,
      }).populate("categoryId", "name color");

      if (!product) {
        return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
      }

      return NextResponse.json({ success: true, product });
    }

    return NextResponse.json({
      success: true,
      product: { _id: params.id, name: "Sample Item", sellingPrice: 250, stockQuantity: 20 },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load product";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireRole(["OWNER", "MANAGER"]);
    const body = await req.json();

    const parsed = productSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const updates = parsed.data;

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const existing = await Product.findOne({
        _id: params.id,
        businessId: context.businessId,
      });

      if (!existing) {
        return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
      }

      // Check duplicate barcode if barcode was edited
      if (updates.barcode && updates.barcode !== existing.barcode) {
        const duplicate = await Product.findOne({
          businessId: context.businessId,
          barcode: updates.barcode,
          _id: { $ne: params.id },
          isActive: true,
        });
        if (duplicate) {
          return NextResponse.json(
            { success: false, error: `Barcode "${updates.barcode}" already in use.` },
            { status: 409 }
          );
        }
      }

      // Track price changes in Audit Log
      if (updates.sellingPrice !== undefined && updates.sellingPrice !== existing.sellingPrice) {
        await AuditLog.create({
          businessId: context.businessId,
          userId: context.userId,
          userName: context.username,
          action: "PRICE_CHANGED",
          entityType: "Product",
          entityId: params.id,
          details: {
            productName: existing.name,
            oldPrice: existing.sellingPrice,
            newPrice: updates.sellingPrice,
          },
        });
      }

      const updated = await Product.findByIdAndUpdate(
        params.id,
        { $set: updates },
        { new: true }
      );

      return NextResponse.json({ success: true, product: updated });
    }

    return NextResponse.json({ success: true, product: { _id: params.id, ...updates } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update product";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireRole(["OWNER", "MANAGER"]);

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const product = await Product.findOneAndUpdate(
        { _id: params.id, businessId: context.businessId },
        { $set: { isActive: false } },
        { new: true }
      );

      if (!product) {
        return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
      }

      await AuditLog.create({
        businessId: context.businessId,
        userId: context.userId,
        userName: context.username,
        action: "PRODUCT_DEACTIVATED",
        entityType: "Product",
        entityId: params.id,
        details: { productName: product.name },
      });

      return NextResponse.json({ success: true, message: "Product deactivated." });
    }

    return NextResponse.json({ success: true, message: "Product deactivated (Demo)." });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete product";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
