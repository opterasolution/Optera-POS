import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Quotation } from "@/models/Quotation";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth, verifyActiveSubscription } from "@/lib/tenant";
import { updateQuotationSchema } from "@/lib/validations/quotation";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireAuth();
    await verifyActiveSubscription(context.businessId);

    await connectToDatabase();
    const quotation = await Quotation.findOne({
      _id: params.id,
      businessId: context.businessId,
    }).populate("items.productId", "name sku barcode stockQuantity unit");

    if (!quotation) {
      return NextResponse.json({ success: false, error: "Quotation not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, quotation });
  } catch (error: any) {
    console.error("GET /api/quotations/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load quotation" },
      { status: error.status || 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireAuth();
    await verifyActiveSubscription(context.businessId);

    const body = await req.json();
    const parsed = updateQuotationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const quotation = await Quotation.findOne({
      _id: params.id,
      businessId: context.businessId,
    });

    if (!quotation) {
      return NextResponse.json({ success: false, error: "Quotation not found" }, { status: 404 });
    }

    if (quotation.status === "CONVERTED") {
      return NextResponse.json(
        { success: false, error: "Cannot modify a quotation that has already been converted to an invoice." },
        { status: 400 }
      );
    }

    const { status, validUntil, notes } = parsed.data;

    if (status) quotation.status = status;
    if (validUntil) quotation.validUntil = new Date(validUntil);
    if (notes !== undefined) quotation.notes = notes;

    await quotation.save();

    await AuditLog.create({
      businessId: context.businessId,
      userId: context.userId,
      userName: context.username,
      action: "QUOTATION_UPDATED",
      entityType: "Quotation",
      entityId: quotation._id.toString(),
      details: {
        quotationNumber: quotation.quotationNumber,
        newStatus: quotation.status,
      },
    });

    return NextResponse.json({ success: true, quotation });
  } catch (error: any) {
    console.error("PATCH /api/quotations/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update quotation" },
      { status: error.status || 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireAuth();
    await verifyActiveSubscription(context.businessId);

    await connectToDatabase();
    const quotation = await Quotation.findOne({
      _id: params.id,
      businessId: context.businessId,
    });

    if (!quotation) {
      return NextResponse.json({ success: false, error: "Quotation not found" }, { status: 404 });
    }

    if (quotation.status === "CONVERTED") {
      return NextResponse.json(
        { success: false, error: "Cannot delete a converted quotation linked to an official tax invoice." },
        { status: 400 }
      );
    }

    await Quotation.deleteOne({ _id: params.id, businessId: context.businessId });

    await AuditLog.create({
      businessId: context.businessId,
      userId: context.userId,
      userName: context.username,
      action: "QUOTATION_DELETED",
      entityType: "Quotation",
      entityId: params.id,
      details: { quotationNumber: quotation.quotationNumber },
    });

    return NextResponse.json({ success: true, message: "Quotation deleted successfully" });
  } catch (error: any) {
    console.error("DELETE /api/quotations/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete quotation" },
      { status: error.status || 500 }
    );
  }
}
