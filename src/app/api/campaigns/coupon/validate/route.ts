import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { requireRole } from "@/lib/tenant";
import { PromotionalCampaign } from "@/models/PromotionalCampaign";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "CASHIER", "SUPER_ADMIN"]);
    const { searchParams } = new URL(req.url);
    const code = (searchParams.get("code") || "").trim().toUpperCase();
    const subtotal = parseFloat(searchParams.get("subtotal") || "0");

    if (!code) {
      return NextResponse.json(
        { valid: false, error: "Coupon code is required" },
        { status: 400 }
      );
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const campaign = await PromotionalCampaign.findOne({
        businessId: context.businessId,
        status: { $ne: "CANCELLED" },
        "recipients.couponCode": code,
      }).lean();

      if (!campaign) {
        return NextResponse.json({
          valid: false,
          error: "Invalid coupon code. Not found in active promotional campaigns.",
        });
      }

      const recipient = campaign.recipients.find(
        (r) => r.couponCode && r.couponCode.toUpperCase() === code
      );

      if (!recipient) {
        return NextResponse.json({
          valid: false,
          error: "Coupon code not found for this campaign.",
        });
      }

      if (recipient.redeemed) {
        return NextResponse.json({
          valid: false,
          error: `This coupon was already redeemed on invoice ${recipient.invoiceNumber || ""} on ${
            recipient.redeemedAt ? new Date(recipient.redeemedAt).toLocaleDateString() : ""
          }.`,
        });
      }

      const now = new Date();
      if (recipient.couponExpiresAt && new Date(recipient.couponExpiresAt) < now) {
        return NextResponse.json({
          valid: false,
          error: `Coupon expired on ${new Date(recipient.couponExpiresAt).toLocaleDateString()}.`,
        });
      }

      const minSpend = campaign.couponConfig?.minSpend || 0;
      if (subtotal > 0 && subtotal < minSpend) {
        return NextResponse.json({
          valid: false,
          error: `Minimum bill of Rs. ${minSpend.toLocaleString()} required to use this coupon (Current: Rs. ${subtotal.toLocaleString()}).`,
          minSpend,
        });
      }

      const discountType = campaign.couponConfig?.discountType || "PERCENTAGE";
      const discountValue = campaign.couponConfig?.discountValue || 10;
      let calculatedDiscount = 0;

      if (discountType === "PERCENTAGE") {
        calculatedDiscount = subtotal > 0 ? (subtotal * discountValue) / 100 : 0;
      } else {
        calculatedDiscount = subtotal > 0 ? Math.min(subtotal, discountValue) : discountValue;
      }

      return NextResponse.json({
        valid: true,
        campaignId: campaign._id,
        campaignNumber: campaign.campaignNumber,
        campaignName: campaign.name,
        couponCode: recipient.couponCode,
        discountType,
        discountValue,
        minSpend,
        discountAmount: Math.round(calculatedDiscount * 100) / 100,
        recipientName: recipient.customerName,
        recipientPhone: recipient.phone,
        recipientCustomerId: recipient.customerId,
        expiresAt: recipient.couponExpiresAt,
      });
    }

    // Demo fallback for test coupon codes
    if (code.startsWith("VIP") || code.startsWith("SAVE") || code.startsWith("PROMO") || code.startsWith("MISSYOU")) {
      const discountVal = code.includes("20") ? 20 : code.includes("15") ? 15 : 10;
      const minSpend = 2000;
      let discountAmount = 0;
      if (subtotal > 0) {
        if (subtotal < minSpend) {
          return NextResponse.json({
            valid: false,
            error: `Minimum bill of Rs. ${minSpend.toLocaleString()} required for this coupon.`,
            minSpend,
          });
        }
        discountAmount = (subtotal * discountVal) / 100;
      }

      return NextResponse.json({
        valid: true,
        campaignId: "demo-cmp-1",
        campaignNumber: "CMP-20261001-4921",
        campaignName: "VIP Exclusive Discount",
        couponCode: code,
        discountType: "PERCENTAGE",
        discountValue: discountVal,
        minSpend,
        discountAmount: Math.round(discountAmount * 100) / 100,
        recipientName: "Demo Customer",
        recipientPhone: "0771234567",
        expiresAt: new Date(Date.now() + 5 * 86400000).toISOString(),
      });
    }

    return NextResponse.json({
      valid: false,
      error: "Coupon code not recognized or has expired.",
    });
  } catch (error: any) {
    console.error("Error in GET /api/campaigns/coupon/validate:", error);
    return NextResponse.json(
      { valid: false, error: error.message || "Failed to validate coupon" },
      { status: 500 }
    );
  }
}
