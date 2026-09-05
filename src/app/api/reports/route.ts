import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Sale } from "@/models/Sale";
import { Product } from "@/models/Product";
import { requireRole } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER"]);
    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "today";

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

      if (range === "yesterday") {
        startDate = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
        endDate = new Date(startOfToday.getTime() - 1);
      } else if (range === "this_week") {
        startDate = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);
      } else if (range === "this_month") {
        startDate = new Date(Date.UTC(slNow.getUTCFullYear(), slNow.getUTCMonth(), 1) - slOffsetMs);
      }

      const sales = await Sale.find({
        businessId,
        status: "COMPLETED",
        createdAt: { $gte: startDate, $lte: endDate },
      });

      // 1. Financial Aggregations
      let totalRevenue = 0;
      let totalCostOfGoods = 0;
      let totalDiscount = 0;
      let totalTax = 0;

      // 2. Payment Method Breakdown
      const paymentBreakdown: Record<string, { count: number; total: number }> = {
        CASH: { count: 0, total: 0 },
        CARD: { count: 0, total: 0 },
        QR: { count: 0, total: 0 },
        BANK_TRANSFER: { count: 0, total: 0 },
        OTHER: { count: 0, total: 0 },
      };

      // 3. Product Sales Aggregation
      const productStats: Record<string, { name: string; quantity: number; revenue: number; cost: number }> = {};

      sales.forEach((sale) => {
        totalRevenue += sale.netTotal || 0;
        totalDiscount += sale.discountTotal || 0;
        totalTax += sale.taxTotal || 0;

        const pm = sale.paymentMethod || "CASH";
        if (!paymentBreakdown[pm]) {
          paymentBreakdown[pm] = { count: 0, total: 0 };
        }
        paymentBreakdown[pm].count += 1;
        paymentBreakdown[pm].total += sale.netTotal;

        sale.items.forEach((item) => {
          const itemCost = (item.costPrice || 0) * (item.quantity || 1);
          totalCostOfGoods += itemCost;

          const pKey = item.productId.toString();
          if (!productStats[pKey]) {
            productStats[pKey] = {
              name: item.name,
              quantity: 0,
              revenue: 0,
              cost: 0,
            };
          }
          productStats[pKey].quantity += item.quantity;
          productStats[pKey].revenue += item.total;
          productStats[pKey].cost += itemCost;
        });
      });

      const estimatedGrossProfit = totalRevenue - totalCostOfGoods;
      const averageOrderValue = sales.length > 0 ? totalRevenue / sales.length : 0;

      // Top 8 Products
      const topProducts = Object.values(productStats)
        .map((p) => ({
          name: p.name,
          unitsSold: p.quantity,
          revenue: p.revenue,
          estimatedProfit: p.revenue - p.cost,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 8);

      // Inventory health
      const lowStockCount = await Product.countDocuments({
        businessId,
        isActive: true,
        $expr: { $lte: ["$stockQuantity", "$lowStockThreshold"] },
      });

      return NextResponse.json({
        success: true,
        range,
        summary: {
          totalRevenue,
          totalTransactions: sales.length,
          totalCostOfGoods,
          estimatedGrossProfit,
          averageOrderValue: Math.round(averageOrderValue * 100) / 100,
          totalDiscount,
          totalTax,
          lowStockCount,
        },
        paymentBreakdown,
        topProducts,
      });
    }

    // Demo Data (Realistic Sri Lankan Grocery Store weekly/daily stats)
    return NextResponse.json({
      success: true,
      range,
      summary: {
        totalRevenue: range === "this_month" ? 342500 : range === "this_week" ? 98400 : 24650,
        totalTransactions: range === "this_month" ? 420 : range === "this_week" ? 118 : 28,
        totalCostOfGoods: range === "this_month" ? 267000 : range === "this_week" ? 76500 : 19200,
        estimatedGrossProfit: range === "this_month" ? 75500 : range === "this_week" ? 21900 : 5450,
        averageOrderValue: 880,
        totalDiscount: 650,
        totalTax: 0,
        lowStockCount: 3,
      },
      paymentBreakdown: {
        CASH: { count: 18, total: 15400 },
        CARD: { count: 6, total: 5850 },
        QR: { count: 4, total: 3400 },
        BANK_TRANSFER: { count: 0, total: 0 },
        OTHER: { count: 0, total: 0 },
      },
      topProducts: [
        {
          name: "Keeri Samba Rice 5kg",
          unitsSold: 14,
          revenue: 20300,
          estimatedProfit: 2800,
        },
        {
          name: "Munchee Super Cream Cracker 490g",
          unitsSold: 32,
          revenue: 10240,
          estimatedProfit: 1920,
        },
        {
          name: "Kotmale Fresh Milk 1L",
          unitsSold: 16,
          revenue: 9280,
          estimatedProfit: 1440,
        },
        {
          name: "Watawala Ceylon Tea 200g",
          unitsSold: 18,
          revenue: 7560,
          estimatedProfit: 1440,
        },
        {
          name: "Prima Special Flour 1kg",
          unitsSold: 22,
          revenue: 5720,
          estimatedProfit: 1100,
        },
        {
          name: "Sunlight Soap 110g",
          unitsSold: 30,
          revenue: 4500,
          estimatedProfit: 900,
        },
      ],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load reports";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
