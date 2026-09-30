import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { CreditNote } from "@/models/CreditNote";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth, verifyActiveSubscription } from "@/lib/tenant";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireAuth();
    await verifyActiveSubscription(context.businessId);

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: "Credit note ID required" }, { status: 400 });
    }

    await connectToDatabase();
    const creditNote = await CreditNote.findOne({
      _id: id,
      businessId: context.businessId,
    })
      .populate("returnId")
      .populate("customerId")
      .lean();

    if (!creditNote) {
      return NextResponse.json({ success: false, error: "Credit note not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, creditNote });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch credit note" },
      { status: error.status || 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireAuth();
    await verifyActiveSubscription(context.businessId);

    // Only MANAGER or ADMIN can cancel a credit note
    if (!["ADMIN", "MANAGER"].includes(context.role)) {
      return NextResponse.json(
        { success: false, error: "Manager permission required to modify or cancel credit notes." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const { action, reason } = body;

    await connectToDatabase();
    const creditNote = await CreditNote.findOne({
      _id: id,
      businessId: context.businessId,
    });

    if (!creditNote) {
      return NextResponse.json({ success: false, error: "Credit note not found" }, { status: 404 });
    }

    if (action === "CANCEL") {
      if (creditNote.status === "CANCELLED") {
        return NextResponse.json({ success: false, error: "Credit note is already cancelled" }, { status: 400 });
      }

      if (creditNote.status === "FULLY_REDEEMED") {
        return NextResponse.json(
          { success: false, error: "Cannot cancel an already fully redeemed credit note" },
          { status: 400 }
        );
      }

      creditNote.status = "CANCELLED";
      await creditNote.save();

      await AuditLog.create({
        businessId: context.businessId,
        userId: context.userId,
        userName: context.username,
        action: "CREDIT_NOTE_CANCELLED",
        entityType: "CreditNote",
        entityId: creditNote._id.toString(),
        details: {
          creditNoteNumber: creditNote.creditNoteNumber,
          remainingBalance: creditNote.remainingBalance,
          reason: reason || "Cancelled by manager",
        },
      });

      return NextResponse.json({ success: true, creditNote });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update credit note" },
      { status: error.status || 500 }
    );
  }
}
