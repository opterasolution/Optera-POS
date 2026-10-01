import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { SmsLog } from "@/models/SmsLog";
import { requireRole } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPERVISOR", "ACCOUNTANT"]);
    const { searchParams } = new URL(req.url);

    const status = searchParams.get("status");
    const eventType = searchParams.get("eventType");
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const skip = (page - 1) * limit;

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const query: Record<string, unknown> = { businessId: context.businessId };

      if (status && status !== "ALL") {
        query.status = status;
      }
      if (eventType && eventType !== "ALL") {
        query.eventType = eventType;
      }
      if (search && search.trim()) {
        const regex = new RegExp(search.trim(), "i");
        query.$or = [
          { recipientPhone: regex },
          { recipientName: regex },
          { message: regex },
          { senderId: regex },
        ];
      }

      const [logs, totalCount] = await Promise.all([
        SmsLog.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        SmsLog.countDocuments(query),
      ]);

      // Overall delivery stats
      const [totalSent, totalFailed, totalSimulated, costAgg] = await Promise.all([
        SmsLog.countDocuments({ businessId: context.businessId, status: "SENT" }),
        SmsLog.countDocuments({ businessId: context.businessId, status: "FAILED" }),
        SmsLog.countDocuments({ businessId: context.businessId, status: "SIMULATED" }),
        SmsLog.aggregate([
          { $match: { businessId: context.businessId } },
          { $group: { _id: null, totalCost: { $sum: "$cost" } } },
        ]),
      ]);

      const totalAttempts = totalSent + totalFailed + totalSimulated;
      const deliveryRate = totalAttempts > 0 ? Math.round(((totalSent + totalSimulated) / totalAttempts) * 100) : 100;
      const totalCost = costAgg[0]?.totalCost || 0;

      return NextResponse.json({
        success: true,
        logs,
        pagination: {
          total: totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit) || 1,
        },
        stats: {
          totalSent,
          totalFailed,
          totalSimulated,
          deliveryRate,
          totalCost: Math.round(totalCost * 100) / 100,
        },
      });
    }

    // Demo Data
    return NextResponse.json({
      success: true,
      logs: [
        {
          _id: "demo_sms_1",
          recipientPhone: "94771234567",
          recipientName: "Dilshan Perera",
          eventType: "CREDIT_PURCHASE",
          message: "Dear Dilshan Perera, purchase of Rs. 14,500 added to your credit at Super Corner Store. Outstanding balance: Rs. 24,500. Due: 15 Oct 2026. Thank you!",
          provider: "NOTIFY_LK",
          senderId: "CORNERSTORE",
          status: "SENT",
          cost: 0.40,
          createdAt: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          _id: "demo_sms_2",
          recipientPhone: "94719876543",
          recipientName: "Kavinda Silva",
          eventType: "CREDIT_SETTLEMENT",
          message: "Dear Kavinda Silva, payment of Rs. 10,000 received at Super Corner Store. Your remaining balance is Rs. 0. Ref: CASH-0021. Thank you!",
          provider: "NOTIFY_LK",
          senderId: "CORNERSTORE",
          status: "SENT",
          cost: 0.40,
          createdAt: new Date(Date.now() - 7200000).toISOString(),
        },
        {
          _id: "demo_sms_3",
          recipientPhone: "94755554433",
          recipientName: "Chamari Atapattu",
          eventType: "GIFT_VOUCHER",
          message: "Dear Chamari Atapattu, you received a digital gift voucher worth Rs. 5,000 from Super Corner Store! Voucher Code: GV-20261001-0004. Valid until 31 Dec 2026.",
          provider: "NOTIFY_LK",
          senderId: "CORNERSTORE",
          status: "SENT",
          cost: 0.40,
          createdAt: new Date(Date.now() - 14400000).toISOString(),
        },
      ],
      pagination: {
        total: 3,
        page: 1,
        limit: 50,
        totalPages: 1,
      },
      stats: {
        totalSent: 3,
        totalFailed: 0,
        totalSimulated: 0,
        deliveryRate: 100,
        totalCost: 1.20,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch SMS logs";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
