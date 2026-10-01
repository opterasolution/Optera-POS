import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { CommissionPayout } from "@/models/CommissionPayout";
import { Sale } from "@/models/Sale";
import { User } from "@/models/User";
import { SalesTarget } from "@/models/SalesTarget";
import { requireRole } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPERVISOR", "ACCOUNTANT", "CASHIER", "SALES_REP"]);
    const { searchParams } = new URL(req.url);

    const userId = searchParams.get("userId");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const query: Record<string, unknown> = { businessId: context.businessId };

      if (userId && Types.ObjectId.isValid(userId)) {
        query.userId = new Types.ObjectId(userId);
      }
      if (status && status !== "ALL") {
        query.status = status;
      }
      if (search && search.trim()) {
        const regex = new RegExp(search.trim(), "i");
        query.$or = [
          { payoutNumber: regex },
          { userName: regex },
          { paymentReference: regex },
          { period: regex },
        ];
      }

      const payouts = await CommissionPayout.find(query)
        .sort({ createdAt: -1 })
        .lean();

      const totalDisbursed = payouts
        .filter((p) => p.status === "PAID")
        .reduce((sum, p) => sum + (p.netPayable || 0), 0);

      const totalPending = payouts
        .filter((p) => p.status === "PENDING")
        .reduce((sum, p) => sum + (p.netPayable || 0), 0);

      const totalApproved = payouts
        .filter((p) => p.status === "APPROVED")
        .reduce((sum, p) => sum + (p.netPayable || 0), 0);

      return NextResponse.json({
        success: true,
        payouts,
        stats: {
          totalCount: payouts.length,
          totalDisbursed,
          totalPending,
          totalApproved,
        },
      });
    }

    // Demo Data
    return NextResponse.json({
      success: true,
      payouts: [
        {
          _id: "demo_payout_1",
          payoutNumber: "COMM-20261001-0001",
          userId: "demo_user_3",
          userName: "Nimal Perera",
          period: "September 2026",
          startDate: new Date("2026-09-01").toISOString(),
          endDate: new Date("2026-09-30T23:59:59").toISOString(),
          totalSalesCount: 145,
          totalSalesVolume: 480000,
          baseCommission: 12000,
          targetBonus: 10000,
          deductions: 0,
          netPayable: 22000,
          status: "PAID",
          paymentMethod: "BANK_TRANSFER",
          paymentReference: "BOC-TXN-984128",
          paidAt: new Date("2026-10-01T10:00:00").toISOString(),
          approvedBy: "Store Administrator",
          paidBy: "Store Administrator",
          createdAt: new Date("2026-10-01T09:30:00").toISOString(),
        },
      ],
      stats: {
        totalCount: 1,
        totalDisbursed: 22000,
        totalPending: 0,
        totalApproved: 0,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch commission payouts";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "ACCOUNTANT"]);
    const body = await req.json();

    const {
      userId,
      period,
      startDate,
      endDate,
      deductions = 0,
      deductionReason,
      notes,
    } = body;

    if (!userId || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: "Staff member and date range are required" },
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
      const userObjId = new Types.ObjectId(userId);

      // 1. Fetch eligible sales
      const sales = await Sale.find({
        businessId: context.businessId,
        status: "COMPLETED",
        createdAt: { $gte: start, $lte: end },
        $or: [{ salesRepId: userObjId }, { cashierId: userObjId }],
      })
        .sort({ createdAt: 1 })
        .lean();

      if (sales.length === 0) {
        return NextResponse.json(
          { success: false, error: `No completed sales found for ${user.name} in the selected period.` },
          { status: 400 }
        );
      }

      // 2. Compute sales totals and commission
      let totalSalesVolume = 0;
      let calculatedBaseCommission = 0;
      const salesBreakdown = [];

      for (const sale of sales) {
        totalSalesVolume += sale.netTotal;

        // If commissionAmount was stored on the sale, use it. Otherwise, compute fallback based on user.commissionRate or 2%
        let saleComm = sale.commissionAmount || 0;
        if (saleComm <= 0 && user.commissionRate && user.commissionRate > 0) {
          saleComm = Math.round((sale.netTotal * (user.commissionRate / 100)) * 100) / 100;
        }

        calculatedBaseCommission += saleComm;

        salesBreakdown.push({
          saleId: sale._id,
          invoiceNumber: sale.invoiceNumber,
          date: sale.createdAt,
          saleAmount: sale.netTotal,
          commissionAmount: saleComm,
        });
      }

      // 3. Check for any achieved target bonus in this period
      const achievedTarget = await SalesTarget.findOne({
        businessId: context.businessId,
        userId: userObjId,
        status: "ACHIEVED",
        startDate: { $lte: end },
        endDate: { $gte: start },
      });

      const targetBonus = achievedTarget?.bonusReward || 0;
      const deductionNum = Number(deductions) || 0;
      const netPayable = Math.max(
        0,
        Math.round((calculatedBaseCommission + targetBonus - deductionNum) * 100) / 100
      );

      // 4. Generate sequential voucher number: COMM-YYYYMMDD-XXXX
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
      const countToday = await CommissionPayout.countDocuments({
        businessId: context.businessId,
        payoutNumber: new RegExp(`^COMM-${dateStr}`),
      });
      const payoutNumber = `COMM-${dateStr}-${(countToday + 1).toString().padStart(4, "0")}`;

      const periodText =
        period ||
        `${start.toLocaleDateString("en-GB", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" })}`;

      // 5. Create payout voucher
      const payout = await CommissionPayout.create({
        businessId: context.businessId,
        payoutNumber,
        userId: user._id,
        userName: user.name,
        period: periodText,
        startDate: start,
        endDate: end,
        totalSalesCount: sales.length,
        totalSalesVolume,
        baseCommission: Math.round(calculatedBaseCommission * 100) / 100,
        targetBonus,
        deductions: deductionNum,
        deductionReason: deductionReason?.trim() || undefined,
        netPayable,
        status: "PENDING",
        salesBreakdown: salesBreakdown.slice(0, 50), // include up to 50 most recent for slip
        notes: notes?.trim() || "",
      });

      return NextResponse.json({
        success: true,
        message: `Commission payout voucher ${payoutNumber} generated successfully.`,
        payout,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Commission payout generated (Demo Mode)",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate commission payout";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
