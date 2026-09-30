import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { CreditNote } from "@/models/CreditNote";
import { requireAuth, verifyActiveSubscription } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const context = await requireAuth();
    await verifyActiveSubscription(context.businessId);

    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code")?.trim().toUpperCase();
    const q = searchParams.get("q")?.trim() || "";
    const status = searchParams.get("status")?.trim();
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const skip = (page - 1) * limit;

    await connectToDatabase();
    const businessId = context.businessId;

    // Check for expired active credit notes and update them
    await CreditNote.updateMany(
      {
        businessId,
        status: "ACTIVE",
        expiryDate: { $lt: new Date() },
      },
      {
        $set: { status: "EXPIRED" },
      }
    );

    // Direct lookup by code (used by POS cashier during checkout)
    if (code) {
      const creditNote = await CreditNote.findOne({
        businessId,
        creditNoteNumber: code,
      }).lean();

      if (!creditNote) {
        return NextResponse.json({
          success: false,
          valid: false,
          error: "Credit note voucher not found.",
        });
      }

      if (creditNote.status === "EXPIRED" || new Date(creditNote.expiryDate) < new Date()) {
        return NextResponse.json({
          success: false,
          valid: false,
          error: `Credit note ${creditNote.creditNoteNumber} expired on ${new Date(creditNote.expiryDate).toLocaleDateString()}.`,
          creditNote,
        });
      }

      if (creditNote.status === "CANCELLED") {
        return NextResponse.json({
          success: false,
          valid: false,
          error: `Credit note ${creditNote.creditNoteNumber} has been cancelled.`,
          creditNote,
        });
      }

      if (creditNote.status === "FULLY_REDEEMED" || creditNote.remainingBalance <= 0) {
        return NextResponse.json({
          success: false,
          valid: false,
          error: `Credit note ${creditNote.creditNoteNumber} is already fully redeemed.`,
          creditNote,
        });
      }

      return NextResponse.json({
        success: true,
        valid: true,
        creditNote,
        remainingBalance: creditNote.remainingBalance,
      });
    }

    const query: any = { businessId };

    if (q) {
      query.$or = [
        { creditNoteNumber: { $regex: q, $options: "i" } },
        { customerName: { $regex: q, $options: "i" } },
        { customerPhone: { $regex: q, $options: "i" } },
        { returnNumber: { $regex: q, $options: "i" } },
      ];
    }

    if (status && ["ACTIVE", "FULLY_REDEEMED", "EXPIRED", "CANCELLED"].includes(status)) {
      query.status = status;
    }

    const [creditNotes, total] = await Promise.all([
      CreditNote.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      CreditNote.countDocuments(query),
    ]);

    // Aggregate statistics
    const allNotes = await CreditNote.find({ businessId }).lean();
    let activeCount = 0;
    let activeBalanceTotal = 0;
    let redeemedTotal = 0;
    let expiredCount = 0;

    for (const cn of allNotes) {
      if (cn.status === "ACTIVE") {
        activeCount++;
        activeBalanceTotal += cn.remainingBalance || 0;
      } else if (cn.status === "EXPIRED") {
        expiredCount++;
      }

      if (cn.redemptions && Array.isArray(cn.redemptions)) {
        for (const red of cn.redemptions) {
          redeemedTotal += red.amount || 0;
        }
      }
    }

    return NextResponse.json({
      success: true,
      creditNotes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        totalIssuedCount: allNotes.length,
        activeCount,
        activeBalanceTotal: Math.round(activeBalanceTotal * 100) / 100,
        redeemedTotal: Math.round(redeemedTotal * 100) / 100,
        expiredCount,
      },
    });
  } catch (error: any) {
    console.error("GET /api/credit-notes error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch credit notes" },
      { status: error.status || 500 }
    );
  }
}
