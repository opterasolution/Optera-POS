import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { requireRole } from "@/lib/tenant";
import { Business } from "@/models/Business";
import { PromotionalCampaign } from "@/models/PromotionalCampaign";
import { dispatchSms, formatSmsTemplate } from "@/lib/sms";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPER_ADMIN"]);
    const { id } = params;

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const [campaign, business] = await Promise.all([
        PromotionalCampaign.findOne({ _id: id, businessId: context.businessId }),
        Business.findById(context.businessId).lean(),
      ]);

      if (!campaign) {
        return NextResponse.json(
          { success: false, error: "Campaign not found" },
          { status: 404 }
        );
      }

      if (campaign.status === "COMPLETED") {
        return NextResponse.json(
          { success: false, error: "Campaign has already been completed" },
          { status: 400 }
        );
      }

      campaign.status = "RUNNING";
      campaign.sentAt = new Date();

      let sentCount = 0;
      let failedCount = 0;
      let simulatedCount = 0;
      let totalCost = 0;

      const storeName = business?.name || "Our Store";
      const discountLabel =
        campaign.couponConfig.discountType === "PERCENTAGE"
          ? `${campaign.couponConfig.discountValue}%`
          : `Rs. ${campaign.couponConfig.discountValue.toLocaleString()}`;

      for (const recipient of campaign.recipients) {
        if (recipient.smsStatus === "SENT" || recipient.smsStatus === "SIMULATED") {
          continue; // Skip already delivered recipients
        }

        const expiryStr = recipient.couponExpiresAt
          ? recipient.couponExpiresAt.toISOString().split("T")[0]
          : "";

        const formattedMsg = formatSmsTemplate(campaign.messageTemplate, {
          name: recipient.customerName,
          customerName: recipient.customerName,
          coupon: recipient.couponCode || "",
          discount: discountLabel,
          minSpend: (campaign.couponConfig.minSpend || 0).toLocaleString(),
          store: storeName,
          storeName: storeName,
          expiryDate: expiryStr,
        });

        try {
          const smsRes = await dispatchSms({
            businessId: context.businessId,
            recipientPhone: recipient.phone,
            recipientName: recipient.customerName,
            customerId: recipient.customerId,
            eventType: "PROMOTIONAL_CAMPAIGN",
            message: formattedMsg,
            metadata: {
              campaignId: campaign._id,
              campaignNumber: campaign.campaignNumber,
              couponCode: recipient.couponCode,
            },
          });

          recipient.sentAt = new Date();

          if (smsRes.status === "SENT") {
            recipient.smsStatus = "SENT";
            sentCount++;
            totalCost += 0.4;
          } else if (smsRes.status === "SIMULATED") {
            recipient.smsStatus = "SIMULATED";
            simulatedCount++;
            totalCost += 0.4;
          } else {
            recipient.smsStatus = "FAILED";
            failedCount++;
          }
        } catch (err: any) {
          recipient.smsStatus = "FAILED";
          failedCount++;
        }
      }

      campaign.status = "COMPLETED";
      campaign.completedAt = new Date();
      campaign.stats.smsSent += sentCount;
      campaign.stats.smsSimulated += simulatedCount;
      campaign.stats.smsFailed += failedCount;
      campaign.stats.smsCost += totalCost;

      await campaign.save();

      return NextResponse.json({
        success: true,
        message: `Campaign launched! Successfully sent to ${sentCount + simulatedCount} customers.`,
        campaign,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Campaign launched successfully (Demo mode).",
    });
  } catch (error: any) {
    console.error("Error in POST /api/campaigns/[id]/launch:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to launch campaign" },
      { status: 500 }
    );
  }
}
