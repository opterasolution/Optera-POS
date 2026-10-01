import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { Sale } from "@/models/Sale";
import { SalesTarget } from "@/models/SalesTarget";
import { CommissionPayout } from "@/models/CommissionPayout";
import { requireRole } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPERVISOR", "ACCOUNTANT", "CASHIER", "SALES_REP"]);
    const { searchParams } = new URL(req.url);

    const periodParam = searchParams.get("period") || "this_month";
    const customStart = searchParams.get("startDate");
    const customEnd = searchParams.get("endDate");

    const now = new Date();
    let startDate: Date;
    let endDate: Date;
    let periodLabel = "This Month";

    if (customStart && customEnd) {
      startDate = new Date(customStart);
      endDate = new Date(customEnd);
      periodLabel = "Custom Range";
    } else if (periodParam === "today") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      periodLabel = "Today";
    } else if (periodParam === "this_week") {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
      startDate = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), diff + 6, 23, 59, 59, 999);
      periodLabel = "This Week";
    } else if (periodParam === "last_month") {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      periodLabel = "Last Month";
    } else {
      // Default: this_month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      periodLabel = `${now.toLocaleString("default", { month: "long" })} ${now.getFullYear()}`;
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      // Fetch all store staff users
      const staffUsers = await User.find({
        businessId: context.businessId,
        role: { $ne: "SUPER_ADMIN" },
        isActive: true,
      })
        .select("-password")
        .lean();

      // Aggregate completed sales in this date window
      const salesAgg = await Sale.aggregate([
        {
          $match: {
            businessId: context.businessId,
            status: "COMPLETED",
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $project: {
            netTotal: 1,
            commissionAmount: 1,
            salesRepId: 1,
            cashierId: 1,
            itemCount: { $size: "$items" },
          },
        },
      ]);

      // Aggregate payouts disbursed in this date window
      const payoutsAgg = await CommissionPayout.find({
        businessId: context.businessId,
        status: "PAID",
        paidAt: { $gte: startDate, $lte: endDate },
      }).lean();

      // Fetch active targets for this period
      const targets = await SalesTarget.find({
        businessId: context.businessId,
        startDate: { $lte: endDate },
        endDate: { $gte: startDate },
      }).lean();

      const targetMap = new Map<string, any>();
      for (const t of targets) {
        targetMap.set(t.userId.toString(), t);
      }

      // Group sales by staff member (matched on salesRepId first, then cashierId)
      const performanceMap = new Map<
        string,
        {
          salesVolume: number;
          invoicesCount: number;
          commissionEarned: number;
          itemsCount: number;
        }
      >();

      for (const sale of salesAgg) {
        const staffKey = (sale.salesRepId || sale.cashierId)?.toString();
        if (staffKey) {
          const current = performanceMap.get(staffKey) || {
            salesVolume: 0,
            invoicesCount: 0,
            commissionEarned: 0,
            itemsCount: 0,
          };

          current.salesVolume += sale.netTotal || 0;
          current.invoicesCount += 1;
          current.commissionEarned += sale.commissionAmount || 0;
          current.itemsCount += sale.itemCount || 0;

          performanceMap.set(staffKey, current);
        }
      }

      // Construct leaderboard entries
      let totalTeamRevenue = 0;
      let totalInvoices = 0;
      let totalCommissions = 0;
      let totalBonuses = 0;

      const leaderboard = staffUsers.map((user) => {
        const userIdStr = user._id.toString();
        const perf = performanceMap.get(userIdStr) || {
          salesVolume: 0,
          invoicesCount: 0,
          commissionEarned: 0,
          itemsCount: 0,
        };

        const target = targetMap.get(userIdStr);
        const targetAmount = target?.targetAmount || user.monthlyTargetAmount || 0;
        const targetAchieved = perf.salesVolume;
        const progressPercent = targetAmount > 0 ? Math.min(100, Math.round((targetAchieved / targetAmount) * 100)) : 0;
        const isTargetMet = targetAmount > 0 && targetAchieved >= targetAmount;
        const bonusReward = isTargetMet ? target?.bonusReward || 0 : 0;

        const averageBasket = perf.invoicesCount > 0 ? Math.round(perf.salesVolume / perf.invoicesCount) : 0;

        // Disbursed in this period
        const paidAmount = payoutsAgg
          .filter((p) => p.userId.toString() === userIdStr)
          .reduce((sum, p) => sum + (p.netPayable || 0), 0);

        totalTeamRevenue += perf.salesVolume;
        totalInvoices += perf.invoicesCount;
        totalCommissions += perf.commissionEarned;
        totalBonuses += bonusReward;

        return {
          userId: user._id,
          name: user.name,
          username: user.username,
          role: user.role,
          phone: user.phone,
          commissionRate: user.commissionRate || 0,
          salesVolume: perf.salesVolume,
          invoicesCount: perf.invoicesCount,
          averageBasket,
          itemsCount: perf.itemsCount,
          commissionEarned: Math.round(perf.commissionEarned * 100) / 100,
          bonusReward,
          target: {
            hasTarget: targetAmount > 0,
            targetAmount,
            achievedAmount: targetAchieved,
            progressPercent,
            bonusReward: target?.bonusReward || 0,
            status: target?.status || (isTargetMet ? "ACHIEVED" : "IN_PROGRESS"),
          },
          paidCommission: paidAmount,
          pendingPayout: Math.max(0, perf.commissionEarned + bonusReward - paidAmount),
        };
      });

      // Sort by sales volume descending
      leaderboard.sort((a, b) => b.salesVolume - a.salesVolume);

      // Top performer
      const topSalesChampion = leaderboard.length > 0 && leaderboard[0].salesVolume > 0 ? leaderboard[0] : null;

      const teamTargetsCount = targets.length;
      const targetsAchievedCount = leaderboard.filter((l) => l.target.hasTarget && l.target.achievedAmount >= l.target.targetAmount).length;
      const targetAchievementRate = teamTargetsCount > 0 ? Math.round((targetsAchievedCount / teamTargetsCount) * 100) : 0;

      return NextResponse.json({
        success: true,
        period: {
          label: periodLabel,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        teamTotals: {
          totalTeamRevenue,
          totalInvoices,
          totalCommissions: Math.round(totalCommissions * 100) / 100,
          totalBonuses,
          averageTeamBasketValue: totalInvoices > 0 ? Math.round(totalTeamRevenue / totalInvoices) : 0,
          topSalesChampion: topSalesChampion ? { name: topSalesChampion.name, salesVolume: topSalesChampion.salesVolume } : null,
          targetAchievementRate,
          totalStaffCount: staffUsers.length,
        },
        leaderboard,
      });
    }

    // Demo Data
    return NextResponse.json({
      success: true,
      period: {
        label: periodLabel,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      teamTotals: {
        totalTeamRevenue: 1680000,
        totalInvoices: 450,
        totalCommissions: 42000,
        totalBonuses: 25000,
        averageTeamBasketValue: 3733,
        topSalesChampion: { name: "Sunil Jayawardena", salesVolume: 780000 },
        targetAchievementRate: 50,
        totalStaffCount: 3,
      },
      leaderboard: [
        {
          userId: "demo_user_2",
          name: "Sunil Jayawardena",
          username: "supervisor",
          role: "SUPERVISOR",
          phone: "0778889999",
          commissionRate: 2.5,
          salesVolume: 780000,
          invoicesCount: 165,
          averageBasket: 4727,
          itemsCount: 420,
          commissionEarned: 19500,
          bonusReward: 25000,
          target: {
            hasTarget: true,
            targetAmount: 750000,
            achievedAmount: 780000,
            progressPercent: 100,
            bonusReward: 25000,
            status: "ACHIEVED",
          },
          paidCommission: 0,
          pendingPayout: 44500,
        },
        {
          userId: "demo_user_3",
          name: "Nimal Perera",
          username: "cashier",
          role: "CASHIER",
          phone: "0714445555",
          commissionRate: 2.0,
          salesVolume: 520000,
          invoicesCount: 180,
          averageBasket: 2888,
          itemsCount: 510,
          commissionEarned: 10400,
          bonusReward: 0,
          target: {
            hasTarget: true,
            targetAmount: 600000,
            achievedAmount: 520000,
            progressPercent: 86,
            bonusReward: 15000,
            status: "IN_PROGRESS",
          },
          paidCommission: 0,
          pendingPayout: 10400,
        },
        {
          userId: "demo_user_1",
          name: "Store Administrator",
          username: "admin",
          role: "OWNER",
          phone: "0771234567",
          commissionRate: 0,
          salesVolume: 380000,
          invoicesCount: 105,
          averageBasket: 3619,
          itemsCount: 290,
          commissionEarned: 0,
          bonusReward: 0,
          target: {
            hasTarget: false,
            targetAmount: 0,
            achievedAmount: 380000,
            progressPercent: 0,
            bonusReward: 0,
            status: "IN_PROGRESS",
          },
          paidCommission: 0,
          pendingPayout: 0,
        },
      ],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch staff performance analytics";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
