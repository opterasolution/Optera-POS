import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Batch } from "@/models/Batch";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth, verifyActiveSubscription } from "@/lib/tenant";
import { calculateBatchStatus } from "@/lib/fefo";

export async function POST(
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
    const { action = "QUARANTINE", quarantineReason } = body;

    await connectToDatabase();
    const batch = await Batch.findOne({
      _id: new Types.ObjectId(params.id),
      businessId: context.businessId,
    });

    if (!batch) {
      return NextResponse.json({ success: false, error: "Batch not found." }, { status: 404 });
    }

    if (action === "QUARANTINE") {
      if (!quarantineReason?.trim()) {
        return NextResponse.json(
          { success: false, error: "A quarantine reason is required (e.g. NMRA recall, damaged seal, quality alert)." },
          { status: 400 }
        );
      }

      batch.status = "QUARANTINED";
      batch.quarantineReason = quarantineReason.trim();
      batch.quarantinedAt = new Date();
      batch.quarantinedBy = context.username || "Manager";
      await batch.save();

      await AuditLog.create({
        businessId: context.businessId,
        userId: context.userId,
        userName: context.username,
        action: "BATCH_QUARANTINED",
        entityType: "Batch",
        entityId: batch._id.toString(),
        details: {
          batchNumber: batch.batchNumber,
          productName: batch.productName,
          quarantineReason: batch.quarantineReason,
          quantityAffected: batch.quantityAvailable,
        },
      });

      return NextResponse.json({
        success: true,
        batch,
        message: `Batch ${batch.batchNumber} has been QUARANTINED. POS dispensing is immediately blocked.`,
      });
    } else if (action === "RELEASE") {
      batch.status = calculateBatchStatus(batch.expiryDate, batch.quantityAvailable, false);
      batch.quarantineReason = undefined;
      batch.quarantinedAt = undefined;
      batch.quarantinedBy = undefined;
      await batch.save();

      await AuditLog.create({
        businessId: context.businessId,
        userId: context.userId,
        userName: context.username,
        action: "BATCH_RELEASED_FROM_QUARANTINE",
        entityType: "Batch",
        entityId: batch._id.toString(),
        details: {
          batchNumber: batch.batchNumber,
          productName: batch.productName,
          newStatus: batch.status,
        },
      });

      return NextResponse.json({
        success: true,
        batch,
        message: `Batch ${batch.batchNumber} has been released back to active inventory (Status: ${batch.status}).`,
      });
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid action. Must be QUARANTINE or RELEASE." },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("POST /api/batches/[id]/quarantine error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to change quarantine status" },
      { status: error.status || 500 }
    );
  }
}
