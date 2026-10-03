import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { requireRole } from "@/lib/tenant";
import { PromotionalCampaign } from "@/models/PromotionalCampaign";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPER_ADMIN"]);
    const { id } = params;

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const campaign = await PromotionalCampaign.findOne({
        _id: id,
        businessId: context.businessId,
      }).lean();

      if (!campaign) {
        return NextResponse.json(
          { success: false, error: "Campaign not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, campaign });
    }

    return NextResponse.json({
      success: true,
      campaign: {
        _id: id,
        businessId: context.businessId,
        campaignNumber: "CMP-20261001-4921",
        name: "Avurudu Early Bird VIP Discount",
        status: "COMPLETED",
        targetSegment: "CHAMPIONS",
        messageTemplate:
          "Dear {name}, enjoy 15% off at {store} with exclusive VIP code {coupon} (min Rs. {minSpend}). Valid till {expiryDate}. Thank you for your loyalty!",
        language: "EN",
        couponConfig: {
          enabled: true,
          codePrefix: "VIP15",
          discountType: "PERCENTAGE",
          discountValue: 15,
          minSpend: 2500,
          validDays: 7,
        },
        stats: {
          totalTargeted: 18,
          smsSent: 18,
          smsFailed: 0,
          smsSimulated: 0,
          smsCost: 7.2,
          couponsIssued: 18,
          couponsRedeemed: 8,
          revenueGenerated: 48600,
          discountGiven: 7290,
          roiPercent: 566,
        },
        recipients: [
          {
            _id: "rec-1",
            customerId: "cust-1",
            customerName: "Kamal Perera",
            phone: "0771234567",
            segment: "CHAMPIONS",
            couponCode: "VIP15-K8X2",
            smsStatus: "SENT",
            redeemed: true,
            invoiceNumber: "INV-20261002-0041",
            saleAmount: 6400,
            discountAmount: 960,
          },
          {
            _id: "rec-2",
            customerId: "cust-2",
            customerName: "Sunil Silva",
            phone: "0718889999",
            segment: "CHAMPIONS",
            couponCode: "VIP15-M3P9",
            smsStatus: "SENT",
            redeemed: true,
            invoiceNumber: "INV-20261002-0087",
            saleAmount: 5200,
            discountAmount: 780,
          },
        ],
        sentAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Error in GET /api/campaigns/[id]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch campaign" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPER_ADMIN"]);
    const { id } = params;
    const body = await req.json();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const campaign = await PromotionalCampaign.findOne({
        _id: id,
        businessId: context.businessId,
      });

      if (!campaign) {
        return NextResponse.json(
          { success: false, error: "Campaign not found" },
          { status: 404 }
        );
      }

      if (campaign.status === "COMPLETED") {
        return NextResponse.json(
          { success: false, error: "Cannot modify completed campaigns" },
          { status: 400 }
        );
      }

      if (body.name) campaign.name = body.name.trim();
      if (body.description !== undefined) campaign.description = body.description;
      if (body.messageTemplate) campaign.messageTemplate = body.messageTemplate.trim();
      if (body.language) campaign.language = body.language;
      if (body.couponConfig) campaign.couponConfig = { ...campaign.couponConfig, ...body.couponConfig };
      if (body.status) campaign.status = body.status;

      await campaign.save();

      return NextResponse.json({ success: true, campaign });
    }

    return NextResponse.json({ success: true, message: "Campaign updated (Demo mode)" });
  } catch (error: any) {
    console.error("Error in PUT /api/campaigns/[id]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update campaign" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPER_ADMIN"]);
    const { id } = params;

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const campaign = await PromotionalCampaign.findOne({
        _id: id,
        businessId: context.businessId,
      });

      if (!campaign) {
        return NextResponse.json(
          { success: false, error: "Campaign not found" },
          { status: 404 }
        );
      }

      if (campaign.status === "COMPLETED") {
        campaign.status = "CANCELLED";
        await campaign.save();
        return NextResponse.json({ success: true, message: "Campaign marked as cancelled" });
      }

      await PromotionalCampaign.deleteOne({ _id: id, businessId: context.businessId });
      return NextResponse.json({ success: true, message: "Campaign deleted" });
    }

    return NextResponse.json({ success: true, message: "Campaign deleted (Demo mode)" });
  } catch (error: any) {
    console.error("Error in DELETE /api/campaigns/[id]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete campaign" },
      { status: 500 }
    );
  }
}
