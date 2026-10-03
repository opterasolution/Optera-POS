import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Customer } from "@/models/Customer";
import { Business } from "@/models/Business";
import { requireRole } from "@/lib/tenant";
import {
  PromotionalCampaign,
  generateCampaignNumber,
  generateCouponCode,
  CampaignSegment,
  ICampaignCustomFilter,
  ICampaignCouponConfig,
  ICampaignRecipient,
} from "@/models/PromotionalCampaign";
import { classifyCustomerRfm, matchesCustomFilter, SEGMENT_METADATA } from "@/lib/rfm";
import { dispatchSms, formatSmsTemplate } from "@/lib/sms";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPER_ADMIN"]);

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const campaigns = await PromotionalCampaign.find({ businessId: context.businessId })
        .sort({ createdAt: -1 })
        .lean();

      let totalSent = 0;
      let totalCost = 0;
      let totalCouponsIssued = 0;
      let totalCouponsRedeemed = 0;
      let totalRevenue = 0;
      let totalDiscountGiven = 0;

      for (const c of campaigns) {
        totalSent += c.stats?.smsSent || 0;
        totalCost += c.stats?.smsCost || 0;
        totalCouponsIssued += c.stats?.couponsIssued || 0;
        totalCouponsRedeemed += c.stats?.couponsRedeemed || 0;
        totalRevenue += c.stats?.revenueGenerated || 0;
        totalDiscountGiven += c.stats?.discountGiven || 0;
      }

      const totalInvestment = totalCost + totalDiscountGiven;
      const overallRoi =
        totalInvestment > 0 ? Math.round(((totalRevenue - totalInvestment) / totalInvestment) * 100) : 0;
      const redemptionRate =
        totalCouponsIssued > 0 ? Math.round((totalCouponsRedeemed / totalCouponsIssued) * 100) : 0;

      return NextResponse.json({
        success: true,
        campaigns,
        summary: {
          totalCampaigns: campaigns.length,
          totalSent,
          totalCost,
          totalCouponsIssued,
          totalCouponsRedeemed,
          redemptionRate,
          totalRevenue,
          totalDiscountGiven,
          overallRoi,
        },
      });
    }

    // Demo fallback
    const demoCampaigns = [
      {
        _id: "demo-cmp-1",
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
        sentAt: new Date(Date.now() - 2 * 86400000).toISOString(),
        completedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
        createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      },
      {
        _id: "demo-cmp-2",
        businessId: context.businessId,
        campaignNumber: "CMP-20260925-1082",
        name: "Win-Back Dormant Shoppers 20%",
        status: "COMPLETED",
        targetSegment: "AT_RISK",
        messageTemplate:
          "Dear {name}, we miss you at {store}! Here is an exclusive Rs. 500 off voucher: {coupon} on orders over Rs. {minSpend}. Valid till {expiryDate}!",
        language: "EN",
        couponConfig: {
          enabled: true,
          codePrefix: "MISSYOU",
          discountType: "FIXED_AMOUNT",
          discountValue: 500,
          minSpend: 2000,
          validDays: 10,
        },
        stats: {
          totalTargeted: 29,
          smsSent: 29,
          smsFailed: 0,
          smsSimulated: 0,
          smsCost: 11.6,
          couponsIssued: 29,
          couponsRedeemed: 6,
          revenueGenerated: 16800,
          discountGiven: 3000,
          roiPercent: 458,
        },
        recipients: [],
        sentAt: new Date(Date.now() - 8 * 86400000).toISOString(),
        completedAt: new Date(Date.now() - 8 * 86400000).toISOString(),
        createdAt: new Date(Date.now() - 8 * 86400000).toISOString(),
      },
    ];

    return NextResponse.json({
      success: true,
      campaigns: demoCampaigns,
      summary: {
        totalCampaigns: 2,
        totalSent: 47,
        totalCost: 18.8,
        totalCouponsIssued: 47,
        totalCouponsRedeemed: 14,
        redemptionRate: 30,
        totalRevenue: 65400,
        totalDiscountGiven: 10290,
        overallRoi: 535,
      },
    });
  } catch (error: any) {
    console.error("Error in GET /api/campaigns:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPER_ADMIN"]);
    const body = await req.json();

    const {
      name,
      description,
      targetSegment = "ALL",
      customFilter,
      messageTemplate,
      language = "EN",
      couponConfig = {
        enabled: true,
        codePrefix: "PROMO",
        discountType: "PERCENTAGE",
        discountValue: 10,
        minSpend: 1000,
        validDays: 7,
      },
      scheduledAt,
      launchNow = false,
    } = body as {
      name: string;
      description?: string;
      targetSegment: CampaignSegment;
      customFilter?: ICampaignCustomFilter;
      messageTemplate: string;
      language?: "EN" | "SI" | "TA" | "MULTI";
      couponConfig?: ICampaignCouponConfig;
      scheduledAt?: string;
      launchNow?: boolean;
    };

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "Campaign name is required" },
        { status: 400 }
      );
    }

    if (!messageTemplate || !messageTemplate.trim()) {
      return NextResponse.json(
        { success: false, error: "SMS message template is required" },
        { status: 400 }
      );
    }

    const campaignNumber = generateCampaignNumber();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const [customers, business] = await Promise.all([
        Customer.find({ businessId: context.businessId }).lean(),
        Business.findById(context.businessId).lean(),
      ]);

      const now = new Date();
      const recipients: ICampaignRecipient[] = [];

      for (const cust of customers) {
        if (!cust.phone || !cust.phone.trim()) continue;

        let isMatch = false;
        if (targetSegment === "ALL") {
          isMatch = true;
        } else if (targetSegment === "CUSTOM") {
          isMatch = matchesCustomFilter(cust, customFilter, now);
        } else {
          const rfm = classifyCustomerRfm(cust, now);
          isMatch = rfm.segment === targetSegment;
        }

        if (isMatch) {
          const rfm = classifyCustomerRfm(cust, now);
          const couponCode = couponConfig.enabled
            ? generateCouponCode(couponConfig.codePrefix || "PROMO")
            : undefined;

          const couponExpiresAt = couponConfig.enabled
            ? new Date(now.getTime() + (couponConfig.validDays || 7) * 86400000)
            : undefined;

          recipients.push({
            customerId: cust._id,
            customerName: cust.name,
            phone: cust.phone,
            segment: rfm.segment,
            couponCode,
            couponExpiresAt,
            smsStatus: "PENDING",
            redeemed: false,
          });
        }
      }

      const campaign = new PromotionalCampaign({
        businessId: context.businessId,
        campaignNumber,
        name: name.trim(),
        description: description?.trim(),
        status: launchNow ? "RUNNING" : scheduledAt ? "SCHEDULED" : "DRAFT",
        targetSegment,
        customFilter,
        messageTemplate: messageTemplate.trim(),
        language,
        couponConfig,
        stats: {
          totalTargeted: recipients.length,
          smsSent: 0,
          smsFailed: 0,
          smsSimulated: 0,
          smsCost: 0,
          couponsIssued: couponConfig.enabled ? recipients.length : 0,
          couponsRedeemed: 0,
          revenueGenerated: 0,
          discountGiven: 0,
          roiPercent: 0,
        },
        recipients,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      });

      // If requested to dispatch immediately, run SMS broadcast loop
      if (launchNow && recipients.length > 0) {
        campaign.sentAt = new Date();
        let sentCount = 0;
        let failedCount = 0;
        let simulatedCount = 0;
        let totalCost = 0;

        const storeName = business?.name || "Our Store";
        const discountLabel =
          couponConfig.discountType === "PERCENTAGE"
            ? `${couponConfig.discountValue}%`
            : `Rs. ${couponConfig.discountValue.toLocaleString()}`;

        for (const recipient of campaign.recipients) {
          const expiryStr = recipient.couponExpiresAt
            ? recipient.couponExpiresAt.toISOString().split("T")[0]
            : "";

          const formattedMsg = formatSmsTemplate(campaign.messageTemplate, {
            name: recipient.customerName,
            customerName: recipient.customerName,
            coupon: recipient.couponCode || "",
            discount: discountLabel,
            minSpend: (couponConfig.minSpend || 0).toLocaleString(),
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
        campaign.stats.smsSent = sentCount;
        campaign.stats.smsSimulated = simulatedCount;
        campaign.stats.smsFailed = failedCount;
        campaign.stats.smsCost = totalCost;
      }

      await campaign.save();

      return NextResponse.json(
        {
          success: true,
          message: launchNow
            ? `Campaign launched! Dispatched to ${campaign.stats.smsSent + campaign.stats.smsSimulated} recipients.`
            : "Campaign created successfully.",
          campaign,
        },
        { status: 201 }
      );
    }

    // Demo fallback
    const demoCreated = {
      _id: "demo-new-" + Date.now(),
      businessId: context.businessId,
      campaignNumber,
      name: name.trim(),
      description: description?.trim(),
      status: launchNow ? "COMPLETED" : "DRAFT",
      targetSegment,
      messageTemplate,
      language,
      couponConfig,
      stats: {
        totalTargeted: 24,
        smsSent: launchNow ? 24 : 0,
        smsFailed: 0,
        smsSimulated: 0,
        smsCost: launchNow ? 9.6 : 0,
        couponsIssued: 24,
        couponsRedeemed: 0,
        revenueGenerated: 0,
        discountGiven: 0,
        roiPercent: 0,
      },
      recipients: [],
      sentAt: launchNow ? new Date().toISOString() : undefined,
      completedAt: launchNow ? new Date().toISOString() : undefined,
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json(
      {
        success: true,
        message: launchNow ? "Campaign launched successfully (Demo mode)." : "Campaign created.",
        campaign: demoCreated,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error in POST /api/campaigns:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create campaign" },
      { status: 500 }
    );
  }
}
