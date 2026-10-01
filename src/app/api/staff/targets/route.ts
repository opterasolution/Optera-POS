import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { SalesTarget } from "@/models/SalesTarget";
import { Sale } from "@/models/Sale";
import { User } from "@/models/User";
import { requireRole } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPERVISOR", "ACCOUNTANT", "CASHIER", "SALES_REP"]);
    const { searchParams } = new URL(req.url);

    const userId = searchParams.get("userId");
    const status = searchParams.get("status");
    const period = searchParams.get("period");

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const query: Record<string, unknown> = { businessId: context.businessId };
      if (userId && Types.ObjectId.isValid(userId)) {
        query.userId = new Types.ObjectId(userId);
      }
      if (status && status !== "ALL") {
        query.status = status;
      }
      if (period && period !== "ALL") {
        query.period = period;
      }

      const targets = await SalesTarget.find(query)
        .sort({ startDate: -1 })
        .lean();

      // Recalculate real-time achievements from actual sales
      const updatedTargets = await Promise.all(
        targets.map(async (t) => {
          const userObjId = t.userId;
          const salesMatch = await Sale.aggregate([
            {
              $match: {
                businessId: context.businessId,
                status: "COMPLETED",
                createdAt: { $gte: new Date(t.startDate), $lte: new Date(t.endDate) },
                $or: [{ salesRepId: userObjId }, { cashierId: userObjId }],
              },
            },
            {
              $group: {
                _id: null,
                totalRevenue: { $sum: "$netTotal" },
                totalCount: { $sum: 1 },
              },
            },
          ]);

          const liveRevenue = salesMatch[0]?.totalRevenue || 0;
          const liveCount = salesMatch[0]?.totalCount || 0;

          let targetStatus = t.status;
          if (t.status === "IN_PROGRESS" && liveRevenue >= t.targetAmount) {
            targetStatus = "ACHIEVED";
            await SalesTarget.updateOne({ _id: t._id }, { $set: { status: "ACHIEVED", achievedAmount: liveRevenue, achievedUnits: liveCount } });
          } else if (t.status === "IN_PROGRESS" && new Date(t.endDate) < new Date() && liveRevenue < t.targetAmount) {
            targetStatus = "MISSED";
            await SalesTarget.updateOne({ _id: t._id }, { $set: { status: "MISSED", achievedAmount: liveRevenue, achievedUnits: liveCount } });
          }

          const progressPercent = t.targetAmount > 0 ? Math.min(100, Math.round((liveRevenue / t.targetAmount) * 100)) : 0;

          return {
            ...t,
            achievedAmount: liveRevenue,
            achievedUnits: liveCount,
            status: targetStatus,
            progressPercent,
          };
        })
      );

      const achievedCount = updatedTargets.filter((t) => t.status === "ACHIEVED" || t.status === "BONUS_PAID").length;
      const totalBonusPipeline = updatedTargets.reduce((sum, t) => sum + (t.bonusReward || 0), 0);

      return NextResponse.json({
        success: true,
        targets: updatedTargets,
        stats: {
          totalTargets: updatedTargets.length,
          achievedCount,
          inProgressCount: updatedTargets.filter((t) => t.status === "IN_PROGRESS").length,
          totalBonusPipeline,
        },
      });
    }

    // Demo Data
    return NextResponse.json({
      success: true,
      targets: [
        {
          _id: "demo_target_1",
          userId: "demo_user_3",
          userName: "Nimal Perera",
          period: "MONTHLY",
          periodLabel: "October 2026",
          startDate: new Date("2026-10-01").toISOString(),
          endDate: new Date("2026-10-31T23:59:59").toISOString(),
          targetAmount: 500000,
          targetUnits: 150,
          achievedAmount: 420000,
          achievedUnits: 128,
          bonusReward: 15000,
          status: "IN_PROGRESS",
          progressPercent: 84,
          notes: "Store October festive season quota",
        },
        {
          _id: "demo_target_2",
          userId: "demo_user_2",
          userName: "Sunil Jayawardena",
          period: "MONTHLY",
          periodLabel: "October 2026",
          startDate: new Date("2026-10-01").toISOString(),
          endDate: new Date("2026-10-31T23:59:59").toISOString(),
          targetAmount: 750000,
          targetUnits: 200,
          achievedAmount: 780000,
          achievedUnits: 215,
          bonusReward: 25000,
          status: "ACHIEVED",
          progressPercent: 100,
          notes: "Supermarket wholesale & institutional supply target",
        },
      ],
      stats: {
        totalTargets: 2,
        achievedCount: 1,
        inProgressCount: 1,
        totalBonusPipeline: 40000,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch sales targets";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER"]);
    const body = await req.json();

    const {
      userId,
      period = "MONTHLY",
      periodLabel,
      startDate,
      endDate,
      targetAmount,
      targetUnits = 0,
      bonusReward = 0,
      notes,
    } = body;

    if (!userId || !startDate || !endDate || !targetAmount) {
      return NextResponse.json(
        { success: false, error: "Staff member, date range, and target amount are required" },
        { status: 400 }
      );
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const user = await User.findOne({
        _id: userId,
        businessId: context.businessId,
      });

      if (!user) {
        return NextResponse.json({ success: false, error: "Staff member not found" }, { status: 404 });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      // Check existing sales in that range to compute initial progress
      const userObjId = new Types.ObjectId(userId);
      const salesMatch = await Sale.aggregate([
        {
          $match: {
            businessId: context.businessId,
            status: "COMPLETED",
            createdAt: { $gte: start, $lte: end },
            $or: [{ salesRepId: userObjId }, { cashierId: userObjId }],
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$netTotal" },
            totalCount: { $sum: 1 },
          },
        },
      ]);

      const liveRevenue = salesMatch[0]?.totalRevenue || 0;
      const liveCount = salesMatch[0]?.totalCount || 0;
      const targetNum = Number(targetAmount) || 0;
      const status = liveRevenue >= targetNum ? "ACHIEVED" : "IN_PROGRESS";

      const target = await SalesTarget.create({
        businessId: context.businessId,
        userId: user._id,
        userName: user.name,
        period,
        periodLabel: periodLabel || `${start.toLocaleString("default", { month: "short" })} ${start.getFullYear()}`,
        startDate: start,
        endDate: end,
        targetAmount: targetNum,
        targetUnits: Number(targetUnits) || 0,
        achievedAmount: liveRevenue,
        achievedUnits: liveCount,
        bonusReward: Number(bonusReward) || 0,
        status,
        notes: notes?.trim() || "",
      });

      return NextResponse.json({
        success: true,
        message: "Sales quota target created successfully",
        target,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Sales target created (Demo Mode)",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create sales target";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
