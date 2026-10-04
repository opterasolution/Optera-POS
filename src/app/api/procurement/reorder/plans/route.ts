import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { ReorderPlan } from "@/models/ReorderPlan";
import { requireAuth } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const context = await requireAuth();
    const { searchParams } = new URL(req.url);

    const limit = Math.max(1, Math.min(50, Number(searchParams.get("limit")) || 20));

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const plans = await ReorderPlan.find({ businessId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      return NextResponse.json({
        success: true,
        plans,
      });
    }

    return NextResponse.json({
      success: true,
      plans: [],
    });
  } catch (error: any) {
    console.error("Error in GET /api/procurement/reorder/plans:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch reorder plans" },
      { status: 500 }
    );
  }
}
