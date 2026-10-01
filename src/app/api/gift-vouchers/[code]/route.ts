import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { GiftVoucher } from "@/models/GiftVoucher";
import { requireAuth, verifyActiveSubscription } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const context = await requireAuth();
    await verifyActiveSubscription(context.businessId);

    const { code } = await params;
    if (!code) {
      return NextResponse.json({ success: false, error: "Code is required" }, { status: 400 });
    }

    await connectToDatabase();
    const businessId = context.businessId;

    const voucher = await GiftVoucher.findOne({
      businessId,
      code: code.trim().toUpperCase(),
    }).lean();

    if (!voucher) {
      return NextResponse.json(
        { success: false, error: `Gift voucher "${code}" was not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      voucher,
    });
  } catch (error: any) {
    console.error("GET /api/gift-vouchers/[code] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to retrieve gift voucher" },
      { status: error.status || 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const context = await requireAuth();
    await verifyActiveSubscription(context.businessId);

    const { code } = await params;
    const body = await req.json();
    const { action, notes, expiryDate } = body;

    await connectToDatabase();
    const businessId = context.businessId;

    const voucher = await GiftVoucher.findOne({
      businessId,
      code: code.trim().toUpperCase(),
    });

    if (!voucher) {
      return NextResponse.json(
        { success: false, error: `Gift voucher "${code}" was not found.` },
        { status: 404 }
      );
    }

    if (action === "CANCEL") {
      if (voucher.status === "REDEEMED") {
        return NextResponse.json(
          { success: false, error: "Cannot cancel a fully redeemed gift voucher." },
          { status: 400 }
        );
      }
      voucher.status = "CANCELLED";
      if (notes) voucher.notes = notes;
      await voucher.save();

      return NextResponse.json({
        success: true,
        voucher,
        message: `Gift voucher ${voucher.code} cancelled successfully.`,
      });
    }

    if (expiryDate) {
      voucher.expiryDate = new Date(expiryDate);
    }

    if (notes !== undefined) {
      voucher.notes = notes;
    }

    await voucher.save();

    return NextResponse.json({
      success: true,
      voucher,
      message: `Gift voucher ${voucher.code} updated.`,
    });
  } catch (error: any) {
    console.error("PATCH /api/gift-vouchers/[code] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update gift voucher" },
      { status: error.status || 500 }
    );
  }
}
