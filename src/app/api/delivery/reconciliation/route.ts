import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { DeliveryOrder } from "@/models/DeliveryOrder";
import { requireAuth } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const context = await requireAuth();
    const { searchParams } = new URL(req.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const filter: Record<string, unknown> = {
        businessId: context.businessId,
        status: { $nin: ["CANCELLED", "REJECTED"] },
      };

      if (startDateParam || endDateParam) {
        filter.createdAt = {};
        if (startDateParam) (filter.createdAt as any).$gte = new Date(startDateParam);
        if (endDateParam) (filter.createdAt as any).$lte = new Date(endDateParam);
      }

      const orders = await DeliveryOrder.find(filter);

      const totals = {
        totalOrders: orders.length,
        grossVolume: 0,
        platformCommissionTotal: 0,
        estimatedNetPayoutTotal: 0,
        deliveryFeesTotal: 0,
      };

      const platformBreakdown: Record<
        string,
        { count: number; gross: number; commission: number; netPayout: number }
      > = {
        PICKME_FOOD: { count: 0, gross: 0, commission: 0, netPayout: 0 },
        PICKME_FLASH: { count: 0, gross: 0, commission: 0, netPayout: 0 },
        UBER_EATS: { count: 0, gross: 0, commission: 0, netPayout: 0 },
        DIRECT_STORE: { count: 0, gross: 0, commission: 0, netPayout: 0 },
      };

      for (const ord of orders) {
        const gross = ord.financials.subtotal;
        const comm = ord.financials.platformCommissionAmount;
        const net = ord.financials.estimatedNetPayout;
        const fee = ord.financials.deliveryFee || 0;

        totals.grossVolume += gross;
        totals.platformCommissionTotal += comm;
        totals.estimatedNetPayoutTotal += net;
        totals.deliveryFeesTotal += fee;

        if (platformBreakdown[ord.platform]) {
          platformBreakdown[ord.platform].count += 1;
          platformBreakdown[ord.platform].gross += gross;
          platformBreakdown[ord.platform].commission += comm;
          platformBreakdown[ord.platform].netPayout += net;
        }
      }

      // Round totals to 2 decimal places
      totals.grossVolume = Math.round(totals.grossVolume * 100) / 100;
      totals.platformCommissionTotal = Math.round(totals.platformCommissionTotal * 100) / 100;
      totals.estimatedNetPayoutTotal = Math.round(totals.estimatedNetPayoutTotal * 100) / 100;

      return NextResponse.json({
        success: true,
        totals,
        platformBreakdown,
      });
    }

    return NextResponse.json({
      success: true,
      totals: {
        totalOrders: 3,
        grossVolume: 6170,
        platformCommissionTotal: 1350.8,
        estimatedNetPayoutTotal: 4819.2,
        deliveryFeesTotal: 750,
      },
      platformBreakdown: {
        PICKME_FOOD: { count: 1, gross: 2750, commission: 605, netPayout: 2145 },
        PICKME_FLASH: { count: 1, gross: 1560, commission: 280.8, netPayout: 1279.2 },
        UBER_EATS: { count: 1, gross: 1860, commission: 465, netPayout: 1395 },
        DIRECT_STORE: { count: 0, gross: 0, commission: 0, netPayout: 0 },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load delivery reconciliation";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
