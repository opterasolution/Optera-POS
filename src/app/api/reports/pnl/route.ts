import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Sale } from "@/models/Sale";
import { SaleReturn } from "@/models/SaleReturn";
import { Expense, ExpenseCategory } from "@/models/Expense";
import { Product } from "@/models/Product";
import { requireRole } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER"]);
    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "this_month";
    const customStart = searchParams.get("startDate");
    const customEnd = searchParams.get("endDate");

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      // Determine date boundary in Asia/Colombo (UTC+05:30)
      const now = new Date();
      const slOffsetMs = 5.5 * 60 * 60 * 1000;
      const slNow = new Date(now.getTime() + slOffsetMs);

      const startOfToday = new Date(
        Date.UTC(slNow.getUTCFullYear(), slNow.getUTCMonth(), slNow.getUTCDate()) - slOffsetMs
      );
      const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);

      let startDate = startOfToday;
      let endDate = endOfToday;

      if (range === "today") {
        startDate = startOfToday;
        endDate = endOfToday;
      } else if (range === "yesterday") {
        startDate = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
        endDate = new Date(startOfToday.getTime() - 1);
      } else if (range === "this_week") {
        startDate = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);
        endDate = endOfToday;
      } else if (range === "this_month") {
        startDate = new Date(Date.UTC(slNow.getUTCFullYear(), slNow.getUTCMonth(), 1) - slOffsetMs);
        endDate = endOfToday;
      } else if (range === "last_month") {
        startDate = new Date(Date.UTC(slNow.getUTCFullYear(), slNow.getUTCMonth() - 1, 1) - slOffsetMs);
        const lastDayOfPrevMonth = new Date(Date.UTC(slNow.getUTCFullYear(), slNow.getUTCMonth(), 0, 23, 59, 59, 999) - slOffsetMs);
        endDate = lastDayOfPrevMonth;
      } else if (range === "this_year") {
        startDate = new Date(Date.UTC(slNow.getUTCFullYear(), 0, 1) - slOffsetMs);
        endDate = endOfToday;
      } else if (range === "custom" && customStart && customEnd) {
        startDate = new Date(customStart);
        endDate = new Date(customEnd);
      }

      // 1. Fetch Completed Sales
      const sales = await Sale.find({
        businessId,
        status: "COMPLETED",
        createdAt: { $gte: startDate, $lte: endDate },
      }).lean();

      // 2. Fetch Customer Returns
      const returns = await SaleReturn.find({
        businessId,
        createdAt: { $gte: startDate, $lte: endDate },
      }).lean();

      // 3. Fetch Operational Expenses
      const expenses = await Expense.find({
        businessId,
        date: { $gte: startDate, $lte: endDate },
      }).lean();

      // Build product cost lookup for returns
      const returnedProductIds = Array.from(
        new Set(returns.flatMap((r) => r.items.map((i) => i.productId.toString())))
      );
      const productCostMap = new Map<string, number>();
      if (returnedProductIds.length > 0) {
        const prods = await Product.find(
          { _id: { $in: returnedProductIds }, businessId },
          "costPrice sellingPrice"
        ).lean();
        prods.forEach((p) => {
          productCostMap.set(p._id.toString(), p.costPrice || 0);
        });
      }

      // Calculations
      let grossSalesRevenue = 0;
      let totalDiscountsGiven = 0;
      let totalTaxesCollected = 0;
      let baseCOGS = 0;

      // Map day-wise trend
      const trendMap: Record<string, { revenue: number; cogs: number; expenses: number; returns: number }> = {};

      const getSLDateString = (d: Date) => {
        const slDate = new Date(d.getTime() + slOffsetMs);
        return slDate.toISOString().slice(0, 10);
      };

      sales.forEach((s) => {
        grossSalesRevenue += (s.subtotal || 0);
        totalDiscountsGiven += (s.discountTotal || 0);
        totalTaxesCollected += (s.taxTotal || 0);

        let saleCost = 0;
        s.items.forEach((item) => {
          const itemCost = (item.costPrice || 0) * (item.quantity || 1);
          baseCOGS += itemCost;
          saleCost += itemCost;
        });

        const dayKey = getSLDateString(new Date(s.createdAt));
        if (!trendMap[dayKey]) {
          trendMap[dayKey] = { revenue: 0, cogs: 0, expenses: 0, returns: 0 };
        }
        trendMap[dayKey].revenue += s.netTotal || 0;
        trendMap[dayKey].cogs += saleCost;
      });

      // Customer Returns Calculations
      let totalCustomerRefunds = 0;
      let restockedCOGSReduction = 0;
      let damagedStockLoss = 0;

      returns.forEach((r) => {
        totalCustomerRefunds += r.netRefundTotal || 0;

        r.items.forEach((item) => {
          const unitCost = productCostMap.get(item.productId.toString()) || item.unitPrice * 0.7; // fallback 70% if cost missing
          const itemCost = unitCost * item.quantity;
          if (item.condition === "RESTOCKABLE") {
            restockedCOGSReduction += itemCost;
          } else {
            // Damaged/expired cannot be resold
            damagedStockLoss += itemCost;
          }
        });

        const dayKey = getSLDateString(new Date(r.createdAt));
        if (!trendMap[dayKey]) {
          trendMap[dayKey] = { revenue: 0, cogs: 0, expenses: 0, returns: 0 };
        }
        trendMap[dayKey].returns += r.netRefundTotal || 0;
      });

      // Operational Expenses Calculations
      let totalOperatingExpenses = 0;
      const expensesByCategory: Record<string, number> = {
        MEALS_AND_TEA: 0,
        STAFF_MEALS: 0,
        PACKAGING: 0,
        TRANSPORT: 0,
        UTILITIES: 0,
        MAINTENANCE: 0,
        RENT: 0,
        MUNICIPAL_TAX: 0,
        SALARY_ADVANCE: 0,
        OTHER: 0,
      };

      const expensesBySource: Record<string, number> = {
        REGISTER_DRAWER: 0,
        STORE_PETTY_CASH: 0,
        BANK_ACCOUNT: 0,
      };

      expenses.forEach((e) => {
        totalOperatingExpenses += e.amount || 0;
        const cat = e.category || "OTHER";
        expensesByCategory[cat] = (expensesByCategory[cat] || 0) + (e.amount || 0);

        const source = e.paidFrom || "STORE_PETTY_CASH";
        expensesBySource[source] = (expensesBySource[source] || 0) + (e.amount || 0);

        const dayKey = getSLDateString(new Date(e.date));
        if (!trendMap[dayKey]) {
          trendMap[dayKey] = { revenue: 0, cogs: 0, expenses: 0, returns: 0 };
        }
        trendMap[dayKey].expenses += e.amount || 0;
      });

      // Consolidated Accounting Figures
      const netSalesRevenue = Math.max(0, grossSalesRevenue - totalDiscountsGiven - totalCustomerRefunds);
      const adjustedCOGS = Math.max(0, baseCOGS - restockedCOGSReduction + damagedStockLoss);
      const grossProfit = netSalesRevenue - adjustedCOGS;
      const grossMarginPercent = netSalesRevenue > 0 ? (grossProfit / netSalesRevenue) * 100 : 0;

      const netOperatingProfit = grossProfit - totalOperatingExpenses;
      const netMarginPercent = netSalesRevenue > 0 ? (netOperatingProfit / netSalesRevenue) * 100 : 0;

      // Sort Daily Trend
      const trend = Object.entries(trendMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, values]) => {
          const netRev = Math.max(0, values.revenue - values.returns);
          const gp = netRev - values.cogs;
          const np = gp - values.expenses;
          return {
            date,
            dayLabel: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            revenue: Math.round(netRev),
            cogs: Math.round(values.cogs),
            grossProfit: Math.round(gp),
            expenses: Math.round(values.expenses),
            netProfit: Math.round(np),
          };
        });

      return NextResponse.json({
        success: true,
        range,
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        pnl: {
          // Revenue
          grossSalesRevenue: Math.round(grossSalesRevenue * 100) / 100,
          totalDiscountsGiven: Math.round(totalDiscountsGiven * 100) / 100,
          totalCustomerRefunds: Math.round(totalCustomerRefunds * 100) / 100,
          netSalesRevenue: Math.round(netSalesRevenue * 100) / 100,
          totalTransactions: sales.length,
          totalReturnsCount: returns.length,

          // COGS
          baseCOGS: Math.round(baseCOGS * 100) / 100,
          restockedCOGSReduction: Math.round(restockedCOGSReduction * 100) / 100,
          damagedStockLoss: Math.round(damagedStockLoss * 100) / 100,
          netCOGS: Math.round(adjustedCOGS * 100) / 100,

          // Gross Profit
          grossProfit: Math.round(grossProfit * 100) / 100,
          grossMarginPercent: Math.round(grossMarginPercent * 10) / 10,

          // Operating Expenses
          totalOperatingExpenses: Math.round(totalOperatingExpenses * 100) / 100,
          expensesCount: expenses.length,
          expensesByCategory,
          expensesBySource,

          // Net Operating Profit
          netOperatingProfit: Math.round(netOperatingProfit * 100) / 100,
          netMarginPercent: Math.round(netMarginPercent * 10) / 10,

          // Taxes (if any)
          totalTaxesCollected: Math.round(totalTaxesCollected * 100) / 100,
        },
        trend,
      });
    }

    // Demo Data (Realistic Sri Lankan Retail Monthly Figures)
    const demoGrossSales = range === "today" ? 38500 : range === "this_week" ? 245000 : 960000;
    const demoDiscounts = range === "today" ? 850 : range === "this_week" ? 5400 : 21500;
    const demoReturns = range === "today" ? 650 : range === "this_week" ? 4200 : 16800;
    const demoNetSales = demoGrossSales - demoDiscounts - demoReturns;
    const demoCOGS = Math.round(demoNetSales * 0.72);
    const demoGrossProfit = demoNetSales - demoCOGS;
    const demoExpenses = range === "today" ? 2850 : range === "this_week" ? 18500 : 72400;
    const demoNetProfit = demoGrossProfit - demoExpenses;

    return NextResponse.json({
      success: true,
      range,
      period: {
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
      },
      pnl: {
        grossSalesRevenue: demoGrossSales,
        totalDiscountsGiven: demoDiscounts,
        totalCustomerRefunds: demoReturns,
        netSalesRevenue: demoNetSales,
        totalTransactions: range === "today" ? 34 : range === "this_week" ? 220 : 890,
        totalReturnsCount: range === "today" ? 1 : range === "this_week" ? 4 : 14,
        baseCOGS: demoCOGS + 1200,
        restockedCOGSReduction: 1200,
        damagedStockLoss: 0,
        netCOGS: demoCOGS,
        grossProfit: demoGrossProfit,
        grossMarginPercent: Math.round((demoGrossProfit / demoNetSales) * 1000) / 10,
        totalOperatingExpenses: demoExpenses,
        expensesCount: range === "today" ? 3 : range === "this_week" ? 14 : 52,
        expensesByCategory: {
          STAFF_MEALS: Math.round(demoExpenses * 0.28),
          PACKAGING: Math.round(demoExpenses * 0.16),
          TRANSPORT: Math.round(demoExpenses * 0.12),
          UTILITIES: Math.round(demoExpenses * 0.22),
          MAINTENANCE: Math.round(demoExpenses * 0.08),
          RENT: 0,
          MUNICIPAL_TAX: 0,
          SALARY_ADVANCE: Math.round(demoExpenses * 0.1),
          OTHER: Math.round(demoExpenses * 0.04),
        },
        expensesBySource: {
          REGISTER_DRAWER: Math.round(demoExpenses * 0.45),
          STORE_PETTY_CASH: Math.round(demoExpenses * 0.4),
          BANK_ACCOUNT: Math.round(demoExpenses * 0.15),
        },
        netOperatingProfit: demoNetProfit,
        netMarginPercent: Math.round((demoNetProfit / demoNetSales) * 1000) / 10,
        totalTaxesCollected: 0,
      },
      trend: [
        { date: "2026-09-24", dayLabel: "Thu 24", revenue: 32000, cogs: 23040, grossProfit: 8960, expenses: 2400, netProfit: 6560 },
        { date: "2026-09-25", dayLabel: "Fri 25", revenue: 38500, cogs: 27720, grossProfit: 10780, expenses: 3100, netProfit: 7680 },
        { date: "2026-09-26", dayLabel: "Sat 26", revenue: 52000, cogs: 37440, grossProfit: 14560, expenses: 3800, netProfit: 10760 },
        { date: "2026-09-27", dayLabel: "Sun 27", revenue: 49000, cogs: 35280, grossProfit: 13720, expenses: 2900, netProfit: 10820 },
        { date: "2026-09-28", dayLabel: "Mon 28", revenue: 28000, cogs: 20160, grossProfit: 7840, expenses: 2100, netProfit: 5740 },
        { date: "2026-09-29", dayLabel: "Tue 29", revenue: 31500, cogs: 22680, grossProfit: 8820, expenses: 2250, netProfit: 6570 },
        { date: "2026-09-30", dayLabel: "Wed 30", revenue: 38500, cogs: 27720, grossProfit: 10780, expenses: 2850, netProfit: 7930 },
      ],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate P&L report";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
