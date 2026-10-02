import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Batch } from "@/models/Batch";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth, verifyActiveSubscription } from "@/lib/tenant";
import { calculateBatchStatus } from "@/lib/fefo";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireAuth();
    await verifyActiveSubscription(context.businessId);

    if (!params.id || !Types.ObjectId.isValid(params.id)) {
      return NextResponse.json({ success: false, error: "Invalid Batch ID" }, { status: 400 });
    }

    await connectToDatabase();
    const batch = await Batch.findOne({
      _id: new Types.ObjectId(params.id),
      businessId: context.businessId,
    }).lean();

    if (!batch) {
      return NextResponse.json({ success: false, error: "Batch not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, batch });
  } catch (error: any) {
    console.error("GET /api/batches/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch batch" },
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

    if (!params.id || !Types.ObjectId.isValid(params.id)) {
      return NextResponse.json({ success: false, error: "Invalid Batch ID" }, { status: 400 });
    }

    const body = await req.json();
    const { sellingPrice, mrp, expiryDate, notes } = body;

    await connectToDatabase();
    const batch = await Batch.findOne({
      _id: new Types.ObjectId(params.id),
      businessId: context.businessId,
    });

    if (!batch) {
      return NextResponse.json({ success: false, error: "Batch not found." }, { status: 404 });
    }

    if (sellingPrice !== undefined && !isNaN(Number(sellingPrice))) {
      batch.sellingPrice = Math.max(0, Number(sellingPrice));
    }

    if (mrp !== undefined) {
      batch.mrp = mrp === null || isNaN(Number(mrp)) ? undefined : Number(mrp);
    }

    if (expiryDate) {
      batch.expiryDate = new Date(expiryDate);
      batch.status = calculateBatchStatus(
        batch.expiryDate,
        batch.quantityAvailable,
        batch.status === "QUARANTINED"
      );
    }

    if (notes !== undefined) {
      batch.notes = notes?.trim() || undefined;
    }

    await batch.save();

    await AuditLog.create({
      businessId: context.businessId,
      userId: context.userId,
      userName: context.username,
      action: "BATCH_UPDATED",
      entityType: "Batch",
      entityId: batch._id.toString(),
      details: {
        batchNumber: batch.batchNumber,
        sellingPrice: batch.sellingPrice,
        mrp: batch.mrp,
        expiryDate: batch.expiryDate,
      },
    });

    return NextResponse.json({
      success: true,
      batch,
      message: `Batch ${batch.batchNumber} updated successfully.`,
    });
  } catch (error: any) {
    console.error("PATCH /api/batches/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update batch" },
      { status: error.status || 500 }
    );
  }
}
