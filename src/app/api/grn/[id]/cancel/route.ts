import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { GoodsReceivedNote } from "@/models/GoodsReceivedNote";
import { AuditLog } from "@/models/AuditLog";
import { requireRole } from "@/lib/tenant";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPER_ADMIN"]);
    const { id } = params;
    const body = await req.json().catch(() => ({}));

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const grn = await GoodsReceivedNote.findOne({ _id: id, businessId });
      if (!grn) {
        return NextResponse.json({ success: false, error: "Goods Received Note not found." }, { status: 404 });
      }

      if (grn.status === "CONFIRMED") {
        return NextResponse.json(
          {
            success: false,
            error: "Cannot cancel a CONFIRMED GRN. Please create a supplier return or credit note instead.",
          },
          { status: 400 }
        );
      }

      grn.status = "CANCELLED";
      grn.cancelledBy = context.username || "Manager";
      grn.cancelledAt = new Date();
      grn.cancellationReason = body.cancellationReason?.trim() || "Cancelled before dock confirmation";
      await grn.save();

      await AuditLog.create({
        businessId,
        action: "GRN_CANCELLED",
        entity: "GOODS_RECEIVED_NOTE",
        entityId: grn._id.toString(),
        userId: context.userId,
        details: {
          grnNumber: grn.grnNumber,
          poNumber: grn.poNumber,
          reason: grn.cancellationReason,
        },
      });

      return NextResponse.json({
        success: true,
        grn,
        message: `GRN ${grn.grnNumber} has been cancelled.`,
      });
    }

    return NextResponse.json({ success: true, message: "Demo: GRN cancelled." });
  } catch (error: any) {
    console.error("Error in POST /api/grn/[id]/cancel:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to cancel GRN" },
      { status: error.status || 500 }
    );
  }
}
