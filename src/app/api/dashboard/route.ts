import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Sale } from "@/models/Sale";
import { Product } from "@/models/Product";
import { Customer } from "@/models/Customer";
import { requireAuth } from "@/lib/tenant";

export async function GET() {
  try {
    const context = await requireAuth();

    // Check if MongoDB is connected
    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      // Calculate start and end of Today in Asia/Colombo (UTC+05:30)
      const now = new Date();
      // Sri Lanka is UTC+5:30
      const slOffsetMs = 5.5 * 60 * 60 * 1000;
      const slNow = new Date(now.getTime() + slOffsetMs);

      // Start of today in SL time converted back to UTC
      const slStartOfDay = new Date(
        Date.UTC(slNow.getUTCFullYear(), slNow.getUTCMonth(), slNow.getUTCDate()) - slOffsetMs
      );
      const slEndOfDay = new Date(slStartOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

      // 1. Today's Sales & Transactions
      const todaySales = await Sale.find({
        businessId,
        status: "COMPLETED",
        createdAt: { $gte: slStartOfDay, $lte: slEndOfDay },
      });

      const todaySalesTotal = todaySales.reduce((sum, s) => sum + (s.netTotal || 0), 0);
      const todayTransactions = todaySales.length;

      // Calculate Cost of Goods Sold (COGS) for profit estimate
      let todayCost = 0;
      todaySales.forEach((sale) => {
        sale.items.forEach((item) => {
          todayCost += (item.costPrice || 0) * (item.quantity || 1);
        });
      });
      const estimatedGrossProfit = todaySalesTotal - todayCost;

      // 2. Product Stats & Low Stock
      const totalProducts = await Product.countDocuments({ businessId, isActive: true });
      const lowStockProducts = await Product.find({
        businessId,
        isActive: true,
        $expr: { $lte: ["$stockQuantity", "$lowStockThreshold"] },
      })
        .select("name stockQuantity lowStockThreshold unit sellingPrice")
        .limit(6);

      // 3. Customer count
      const totalCustomers = await Customer.countDocuments({ businessId });

      // 4. Recent Sales
      const recentSales = await Sale.find({ businessId, status: "COMPLETED" })
        .sort({ createdAt: -1 })
        .limit(6)
        .select("invoiceNumber cashierName customerName paymentMethod netTotal createdAt");

      return NextResponse.json({
        success: true,
        stats: {
          todaySalesTotal,
          todayTransactions,
          estimatedGrossProfit,
          totalProducts,
          lowStockCount: lowStockProducts.length,
          totalCustomers,
        },
        lowStockProducts,
        recentSales,
      });
    }

    // Realistic Demo Data (Sri Lankan Retail store)
    return NextResponse.json({
      success: true,
      stats: {
        todaySalesTotal: 48250,
        todayTransactions: 34,
        estimatedGrossProfit: 9650,
        totalProducts: 142,
        lowStockCount: 3,
        totalCustomers: 58,
      },
      lowStockProducts: [
        {
          _id: "demo_p1",
          name: "Munchee Super Cream Cracker 490g",
          stockQuantity: 2,
          lowStockThreshold: 10,
          unit: "packet",
          sellingPrice: 320,
        },
        {
          _id: "demo_p2",
          name: "Kotmale Fresh Milk 1L",
          stockQuantity: 3,
          lowStockThreshold: 8,
          unit: "bottle",
          sellingPrice: 580,
        },
        {
          _id: "demo_p3",
          name: "Watawala Tea 200g",
          stockQuantity: 1,
          lowStockThreshold: 5,
          unit: "packet",
          sellingPrice: 420,
        },
      ],
      recentSales: [
        {
          _id: "demo_s1",
          invoiceNumber: "INV-2026-0034",
          cashierName: "Admin",
          customerName: "Kamal Gunaratne",
          paymentMethod: "CASH",
          netTotal: 1850,
          createdAt: new Date().toISOString(),
        },
        {
          _id: "demo_s2",
          invoiceNumber: "INV-2026-0033",
          cashierName: "Cashier",
          customerName: "Walk-in Customer",
          paymentMethod: "QR",
          netTotal: 740,
          createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        },
        {
          _id: "demo_s3",
          invoiceNumber: "INV-2026-0032",
          cashierName: "Admin",
          customerName: "Sunil Silva",
          paymentMethod: "CARD",
          netTotal: 3450,
          createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        },
        {
          _id: "demo_s4",
          invoiceNumber: "INV-2026-0031",
          cashierName: "Cashier",
          customerName: "Walk-in Customer",
          paymentMethod: "CASH",
          netTotal: 520,
          createdAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
        },
      ],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load dashboard data";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
