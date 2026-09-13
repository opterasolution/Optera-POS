import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Business } from "@/models/Business";
import { Product } from "@/models/Product";
import { Sale } from "@/models/Sale";
import { requireSuperAdmin } from "@/lib/tenant";

export async function GET() {
  try {
    await requireSuperAdmin();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const [
        totalBusinesses,
        activeBusinesses,
        trialBusinesses,
        expiredBusinesses,
        suspendedBusinesses,
        totalProducts,
        salesStats,
        plansCount,
      ] = await Promise.all([
        Business.countDocuments(),
        Business.countDocuments({ "subscription.status": "ACTIVE" }),
        Business.countDocuments({ "subscription.status": "TRIAL" }),
        Business.countDocuments({ "subscription.status": "EXPIRED" }),
        Business.countDocuments({ "subscription.status": "SUSPENDED" }),
        Product.countDocuments({ isActive: true }),
        Sale.aggregate([
          {
            $group: {
              _id: null,
              totalGMV: { $sum: "$netTotal" },
              totalTransactions: { $sum: 1 },
            },
          },
        ]),
        Business.aggregate([
          { $match: { "subscription.status": "ACTIVE" } },
          { $group: { _id: "$subscription.plan", count: { $sum: 1 } } },
        ]),
      ]);

      // Calculate estimated monthly recurring revenue (LKR)
      // Standard SL SaaS pricing: BASIC: Rs. 3,500/mo, PROFESSIONAL: Rs. 7,500/mo, ENTERPRISE: Rs. 15,000/mo
      const pricingTiers: Record<string, number> = {
        TRIAL: 0,
        BASIC: 3500,
        PROFESSIONAL: 7500,
        ENTERPRISE: 15000,
      };

      let estimatedMRR = 0;
      plansCount.forEach((p) => {
        const price = pricingTiers[p._id] || 0;
        estimatedMRR += price * p.count;
      });

      return NextResponse.json({
        success: true,
        stats: {
          totalBusinesses,
          activeSubscriptions: activeBusinesses,
          trialBusinesses,
          expiredOrSuspended: expiredBusinesses + suspendedBusinesses,
          totalProducts,
          totalGMV: salesStats[0]?.totalGMV || 0,
          totalTransactions: salesStats[0]?.totalTransactions || 0,
          estimatedMRR,
        },
      });
    }

    // Demo Mode mock stats
    return NextResponse.json({
      success: true,
      stats: {
        totalBusinesses: 5,
        activeSubscriptions: 2,
        trialBusinesses: 1,
        expiredOrSuspended: 2,
        totalProducts: 629,
        totalGMV: 5720000,
        totalTransactions: 711,
        estimatedMRR: 11000, // (Basic 3500 + Pro 7500)
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load platform stats";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
