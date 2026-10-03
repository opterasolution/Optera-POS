import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Customer } from "@/models/Customer";
import { Business } from "@/models/Business";
import { requireRole } from "@/lib/tenant";
import { classifyCustomerRfm, matchesCustomFilter, SEGMENT_METADATA } from "@/lib/rfm";
import { CampaignSegment, ICampaignCustomFilter } from "@/models/PromotionalCampaign";
import { formatSmsTemplate } from "@/lib/sms";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPER_ADMIN"]);
    const body = await req.json();

    const {
      targetSegment = "ALL",
      customFilter,
      messageTemplate,
      couponConfig,
    } = body as {
      targetSegment: CampaignSegment;
      customFilter?: ICampaignCustomFilter;
      messageTemplate?: string;
      couponConfig?: {
        enabled: boolean;
        codePrefix: string;
        discountType: "PERCENTAGE" | "FIXED_AMOUNT";
        discountValue: number;
        minSpend: number;
        validDays: number;
      };
    };

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const [customers, business] = await Promise.all([
        Customer.find({ businessId: context.businessId }).lean(),
        Business.findById(context.businessId).lean(),
      ]);

      const now = new Date();
      const matchedCustomers: any[] = [];

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
          matchedCustomers.push({
            _id: cust._id,
            name: cust.name,
            phone: cust.phone,
            totalSpent: cust.totalSpent || 0,
            visitCount: cust.visitCount || 0,
            loyaltyTier: cust.loyaltyTier || "REGULAR",
            loyaltyPoints: cust.loyaltyPoints || 0,
            recencyDays: rfm.recencyDays,
            segment: rfm.segment,
          });
        }
      }

      // Generate a preview of what the SMS will look like for a sample customer
      const sampleCust = matchedCustomers[0] || {
        name: "Kamal Perera",
        phone: "0771234567",
        loyaltyPoints: 120,
      };

      const discountLabel =
        couponConfig?.discountType === "PERCENTAGE"
          ? `${couponConfig?.discountValue || 10}%`
          : `Rs. ${(couponConfig?.discountValue || 500).toLocaleString()}`;

      const expirySample = new Date(now.getTime() + (couponConfig?.validDays || 7) * 86400000)
        .toISOString()
        .split("T")[0];

      const templateToUse =
        messageTemplate ||
        SEGMENT_METADATA[targetSegment]?.defaultTemplate ||
        SEGMENT_METADATA.ALL.defaultTemplate;

      const sampleMessage = formatSmsTemplate(templateToUse, {
        name: sampleCust.name,
        customerName: sampleCust.name,
        points: sampleCust.loyaltyPoints || 0,
        coupon: `${couponConfig?.codePrefix || "PROMO"}-X8Y2`,
        discount: discountLabel,
        minSpend: (couponConfig?.minSpend || 1000).toLocaleString(),
        store: business?.name || "Our Store",
        storeName: business?.name || "Our Store",
        expiryDate: expirySample,
      });

      // Calculate SMS character length & parts
      const charCount = sampleMessage.length;
      // If contains non-ASCII characters (e.g. Sinhala/Tamil), UCS-2 multipart applies: 70 chars per part
      const isUnicode = /[^\u0000-\u007F]/.test(sampleMessage);
      const singleLimit = isUnicode ? 70 : 160;
      const multiLimit = isUnicode ? 67 : 153;
      const smsParts =
        charCount <= singleLimit ? 1 : Math.ceil(charCount / multiLimit);

      const estimatedCost = matchedCustomers.length * smsParts * 0.4; // 0.40 LKR per SMS part

      return NextResponse.json({
        success: true,
        totalMatched: matchedCustomers.length,
        matchedCustomers: matchedCustomers.slice(0, 20), // Preview first 20
        sampleMessage,
        charCount,
        smsParts,
        isUnicode,
        estimatedCost,
      });
    }

    // Demo fallback
    const sampleMessage = formatSmsTemplate(
      messageTemplate || SEGMENT_METADATA[targetSegment]?.defaultTemplate || "Special offer at {store}!",
      {
        name: "Kamal Perera",
        customerName: "Kamal Perera",
        points: 250,
        coupon: `${couponConfig?.codePrefix || "PROMO"}-A8B9`,
        discount: couponConfig?.discountType === "PERCENTAGE" ? `${couponConfig.discountValue}%` : `Rs. ${couponConfig?.discountValue || 500}`,
        minSpend: (couponConfig?.minSpend || 1500).toLocaleString(),
        store: "Demo Supermart",
        storeName: "Demo Supermart",
        expiryDate: "2026-10-10",
      }
    );

    return NextResponse.json({
      success: true,
      totalMatched: 28,
      matchedCustomers: [
        {
          _id: "demo1",
          name: "Kamal Perera",
          phone: "0771234567",
          totalSpent: 34500,
          visitCount: 6,
          loyaltyTier: "GOLD",
          loyaltyPoints: 340,
          recencyDays: 14,
          segment: targetSegment,
        },
        {
          _id: "demo2",
          name: "Sunil Silva",
          phone: "0718889999",
          totalSpent: 21200,
          visitCount: 4,
          loyaltyTier: "SILVER",
          loyaltyPoints: 210,
          recencyDays: 20,
          segment: targetSegment,
        },
      ],
      sampleMessage,
      charCount: sampleMessage.length,
      smsParts: 1,
      isUnicode: false,
      estimatedCost: 28 * 0.4,
    });
  } catch (error: any) {
    console.error("Error in POST /api/campaigns/segments/preview:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to preview segment" },
      { status: 500 }
    );
  }
}
