import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { GiftVoucher } from "@/models/GiftVoucher";
import { Business } from "@/models/Business";

/**
 * Public Gift Voucher Balance Lookup API
 * Allows voucher holders to verify remaining balance and validity without authentication.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code")?.trim().toUpperCase();

    if (!code) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid gift voucher code" },
        { status: 400 }
      );
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const voucher = await GiftVoucher.findOne({ code }).lean();

      if (!voucher) {
        return NextResponse.json(
          {
            success: false,
            error: `Gift Voucher with code "${code}" was not found. Please check the code and try again.`,
          },
          { status: 404 }
        );
      }

      // Check if voucher has expired dynamically
      let currentStatus = voucher.status;
      if (
        currentStatus === "ACTIVE" &&
        voucher.expiryDate &&
        new Date(voucher.expiryDate) < new Date()
      ) {
        currentStatus = "EXPIRED";
      }

      // Fetch store branding
      const business = await Business.findById(voucher.businessId)
        .select("name phone email address logo currency")
        .lean();

      // Return sanitized public voucher details
      const sanitizedVoucher = {
        code: voucher.code,
        initialAmount: voucher.initialAmount,
        currentBalance: voucher.currentBalance,
        status: currentStatus,
        expiryDate: voucher.expiryDate,
        recipientName: voucher.recipientName,
        createdAt: voucher.createdAt,
        redemptions: (voucher.redemptionHistory || []).map((r: any) => ({
          amount: r.amount,
          balanceAfter: r.balanceAfter,
          redeemedAt: r.redeemedAt,
          invoiceNumber: r.invoiceNumber,
        })),
        business: business || {
          name: "Sri Lanka POS Store",
          currency: "LKR",
        },
      };

      return NextResponse.json({ success: true, voucher: sanitizedVoucher });
    }

    // Demo Mode Fallback for testing
    if (code.startsWith("GV-")) {
      return NextResponse.json({
        success: true,
        voucher: {
          code,
          initialAmount: 5000,
          currentBalance: 3200,
          status: "ACTIVE",
          expiryDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
          recipientName: "Valued Recipient",
          createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          redemptions: [
            {
              amount: 1800,
              balanceAfter: 3200,
              redeemedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
              invoiceNumber: "INV-2026-0091",
            },
          ],
          business: {
            name: "Kandy Super Grocers",
            phone: "0771234567",
            currency: "LKR",
          },
        },
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: `Gift Voucher "${code}" was not found in the demo registry.`,
      },
      { status: 404 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to query gift voucher";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
