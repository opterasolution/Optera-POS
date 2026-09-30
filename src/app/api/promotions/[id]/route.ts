import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Promotion } from "@/models/Promotion";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth, requireRole } from "@/lib/tenant";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireAuth();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const promo = await Promotion.findOne({
        _id: params.id,
        businessId: new Types.ObjectId(context.businessId),
      });

      if (!promo) {
        return NextResponse.json({ success: false, error: "Promotion not found" }, { status: 404 });
      }

      return NextResponse.json({ success: true, promotion: promo });
    }

    return NextResponse.json({
      success: true,
      promotion: {
        _id: params.id,
        name: "Weekend Mega Saver 5% Off",
        code: "WEEKEND5",
        type: "BILL_THRESHOLD",
        discountType: "PERCENTAGE",
        discountValue: 5,
        minSpend: 5000,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        isActive: true,
        usageCount: 14,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load promotion";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireRole(["OWNER", "MANAGER"]);
    const body = await req.json();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const existing = await Promotion.findOne({
        _id: params.id,
        businessId: new Types.ObjectId(context.businessId),
      });

      if (!existing) {
        return NextResponse.json({ success: false, error: "Promotion not found" }, { status: 404 });
      }

      // Check code uniqueness if code is updated
      if (body.code && body.code.trim() && body.code.trim().toUpperCase() !== existing.code) {
        const dup = await Promotion.findOne({
          _id: { $ne: params.id },
          businessId: new Types.ObjectId(context.businessId),
          code: body.code.trim().toUpperCase(),
          isActive: true,
          endDate: { $gte: new Date() },
        });

        if (dup) {
          return NextResponse.json(
            { success: false, error: `Promotion with coupon code "${body.code.toUpperCase()}" already exists.` },
            { status: 409 }
          );
        }
      }

      const updateData: Record<string, unknown> = {};
      if (body.name !== undefined) updateData.name = body.name.trim();
      if (body.code !== undefined) updateData.code = body.code ? body.code.trim().toUpperCase() : undefined;
      if (body.description !== undefined) updateData.description = body.description ? body.description.trim() : undefined;
      if (body.type !== undefined) updateData.type = body.type;
      if (body.discountType !== undefined) updateData.discountType = body.discountType;
      if (body.discountValue !== undefined) updateData.discountValue = Number(body.discountValue);
      if (body.minSpend !== undefined) updateData.minSpend = Number(body.minSpend);
      if (body.buyProductId !== undefined) {
        updateData.buyProductId = body.buyProductId ? new Types.ObjectId(body.buyProductId) : undefined;
      }
      if (body.buyQuantity !== undefined) updateData.buyQuantity = Number(body.buyQuantity);
      if (body.getProductId !== undefined) {
        updateData.getProductId = body.getProductId ? new Types.ObjectId(body.getProductId) : undefined;
      }
      if (body.getQuantity !== undefined) updateData.getQuantity = Number(body.getQuantity);
      if (body.startDate !== undefined) updateData.startDate = new Date(body.startDate);
      if (body.endDate !== undefined) updateData.endDate = new Date(body.endDate);
      if (body.isActive !== undefined) updateData.isActive = Boolean(body.isActive);
      if (body.usageLimit !== undefined) updateData.usageLimit = body.usageLimit ? Number(body.usageLimit) : undefined;

      const updated = await Promotion.findOneAndUpdate(
        { _id: params.id, businessId: new Types.ObjectId(context.businessId) },
        { $set: updateData },
        { new: true }
      );

      await AuditLog.create({
        businessId: new Types.ObjectId(context.businessId),
        userId: new Types.ObjectId(context.userId),
        userName: context.username,
        action: "PROMOTION_UPDATED",
        entityType: "Promotion",
        entityId: params.id,
        details: updateData,
      });

      return NextResponse.json({ success: true, promotion: updated });
    }

    return NextResponse.json({
      success: true,
      promotion: { _id: params.id, ...body },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update promotion";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
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

      const deleted = await Promotion.findOneAndDelete({
        _id: params.id,
        businessId: new Types.ObjectId(context.businessId),
      });

      if (!deleted) {
        return NextResponse.json({ success: false, error: "Promotion not found" }, { status: 404 });
      }

      await AuditLog.create({
        businessId: new Types.ObjectId(context.businessId),
        userId: new Types.ObjectId(context.userId),
        userName: context.username,
        action: "PROMOTION_DELETED",
        entityType: "Promotion",
        entityId: params.id,
        details: { name: deleted.name, code: deleted.code },
      });

      return NextResponse.json({ success: true, message: "Promotion deleted successfully" });
    }

    return NextResponse.json({ success: true, message: "Promotion deleted (Demo Mode)" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete promotion";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
