import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Customer } from "@/models/Customer";
import { Business } from "@/models/Business";
import { requireRole } from "@/lib/tenant";
import { classifyCustomerRfm, SEGMENT_METADATA } from "@/lib/rfm";
import { CampaignSegment } from "@/models/PromotionalCampaign";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPER_ADMIN"]);

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const [customers, business] = await Promise.all([
        Customer.find({ businessId: context.businessId }).lean(),
        Business.findById(context.businessId).lean(),
      ]);

      const now = new Date();
      const segmentMap: Record<
        CampaignSegment,
        {
          customers: any[];
          totalRevenue: number;
          totalRecencyDays: number;
        }
      > = {
        CHAMPIONS: { customers: [], totalRevenue: 0, totalRecencyDays: 0 },
        LOYAL: { customers: [], totalRevenue: 0, totalRecencyDays: 0 },
        POTENTIAL_LOYAL: { customers: [], totalRevenue: 0, totalRecencyDays: 0 },
        NEW_CUSTOMERS: { customers: [], totalRevenue: 0, totalRecencyDays: 0 },
        AT_RISK: { customers: [], totalRevenue: 0, totalRecencyDays: 0 },
        HIBERNATING: { customers: [], totalRevenue: 0, totalRecencyDays: 0 },
        HIGH_SPENDERS: { customers: [], totalRevenue: 0, totalRecencyDays: 0 },
        ALL: { customers: [], totalRevenue: 0, totalRecencyDays: 0 },
        CUSTOM: { customers: [], totalRevenue: 0, totalRecencyDays: 0 },
      };

      let validPhoneCount = 0;

      for (const cust of customers) {
        if (cust.phone && cust.phone.trim()) validPhoneCount++;
        const rfm = classifyCustomerRfm(cust, now);
        const seg = rfm.segment;

        segmentMap[seg].customers.push(cust);
        segmentMap[seg].totalRevenue += cust.totalSpent || 0;
        segmentMap[seg].totalRecencyDays += rfm.recencyDays;

        segmentMap.ALL.customers.push(cust);
        segmentMap.ALL.totalRevenue += cust.totalSpent || 0;
        segmentMap.ALL.totalRecencyDays += rfm.recencyDays;
      }

      const totalCustomers = customers.length;

      const segments = (Object.keys(SEGMENT_METADATA) as CampaignSegment[]).map((key) => {
        const data = segmentMap[key] || { customers: [], totalRevenue: 0, totalRecencyDays: 0 };
        const count = data.customers.length;
        const validPhoneInSeg = data.customers.filter((c: any) => c.phone && c.phone.trim()).length;
        const percent = totalCustomers > 0 ? Math.round((count / totalCustomers) * 100) : 0;
        const avgSpend = count > 0 ? Math.round(data.totalRevenue / count) : 0;
        const avgRecencyDays = count > 0 ? Math.round(data.totalRecencyDays / count) : 0;

        return {
          ...SEGMENT_METADATA[key],
          count,
          validPhoneCount: validPhoneInSeg,
          percentage: percent,
          totalRevenue: data.totalRevenue,
          avgSpend,
          avgRecencyDays,
        };
      });

      return NextResponse.json({
        success: true,
        totalCustomers,
        validPhoneCount,
        storeName: business?.name || "Store",
        segments,
      });
    }

    // Demo / fallback data when DB is offline
    const demoSegments = (Object.keys(SEGMENT_METADATA) as CampaignSegment[]).map((key) => {
      const demoCounts: Record<CampaignSegment, { count: number; spend: number; days: number }> = {
        CHAMPIONS: { count: 18, spend: 42500, days: 8 },
        LOYAL: { count: 42, spend: 28400, days: 19 },
        POTENTIAL_LOYAL: { count: 35, spend: 14200, days: 22 },
        NEW_CUSTOMERS: { count: 24, spend: 5800, days: 11 },
        AT_RISK: { count: 29, spend: 19500, days: 58 },
        HIBERNATING: { count: 31, spend: 11200, days: 120 },
        HIGH_SPENDERS: { count: 12, spend: 89000, days: 14 },
        ALL: { count: 179, spend: 24500, days: 38 },
        CUSTOM: { count: 0, spend: 0, days: 0 },
      };
      const d = demoCounts[key];
      return {
        ...SEGMENT_METADATA[key],
        count: d.count,
        validPhoneCount: Math.round(d.count * 0.95),
        percentage: Math.round((d.count / 179) * 100),
        totalRevenue: d.count * d.spend,
        avgSpend: d.spend,
        avgRecencyDays: d.days,
      };
    });

    return NextResponse.json({
      success: true,
      totalCustomers: 179,
      validPhoneCount: 168,
      storeName: "Demo Colombo Supermart",
      segments: demoSegments,
    });
  } catch (error: any) {
    console.error("Error in GET /api/campaigns/segments:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch customer segments" },
      { status: 500 }
    );
  }
}
