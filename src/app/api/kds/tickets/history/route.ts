import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/db";
import KitchenTicket from "@/models/KitchenTicket";
import Business from "@/models/Business";

// GET /api/kds/tickets/history - Fetch recently served/cleared tickets for Recall
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const user = session.user as any;
    let businessId = user.businessId;

    if (!businessId) {
      const defaultBiz = await Business.findOne().lean();
      businessId = defaultBiz?._id;
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "15", 10);

    const historyTickets = await KitchenTicket.find({
      businessId,
      status: { $in: ["SERVED", "CANCELLED"] },
    })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({ success: true, history: historyTickets });
  } catch (error: any) {
    console.error("GET /api/kds/tickets/history error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch kitchen history" },
      { status: 500 }
    );
  }
}
