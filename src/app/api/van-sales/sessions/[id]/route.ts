import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/tenant";
import { connectToDatabase } from "@/lib/db";
import { VanSaleSession } from "@/models/VanSaleSession";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireAuth();
    await connectToDatabase();
    const { id } = await params;

    const session = await VanSaleSession.findOne({
      _id: id,
      businessId: context.businessId,
    }).lean();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Van session not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      session,
    });
  } catch (error: any) {
    console.error("GET /api/van-sales/sessions/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load van session" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireAuth();
    await connectToDatabase();
    const { id } = await params;

    const body = await req.json();
    const { action, routeZone, notes } = body;

    const session = await VanSaleSession.findOne({
      _id: id,
      businessId: context.businessId,
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Van session not found." },
        { status: 404 }
      );
    }

    if (action === "START_ROUTE") {
      session.status = "ON_ROUTE";
      session.startedAt = new Date();
    } else if (action === "COMPLETE_ROUTE") {
      session.status = "COMPLETED";
      session.completedAt = new Date();
    } else if (action === "UPDATE_DETAILS") {
      if (routeZone !== undefined) session.routeZone = routeZone.trim() || undefined;
      if (notes !== undefined) session.notes = notes.trim() || undefined;
    }

    await session.save();

    return NextResponse.json({
      success: true,
      message: `Van session updated successfully.`,
      session,
    });
  } catch (error: any) {
    console.error("PUT /api/van-sales/sessions/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update van session" },
      { status: 500 }
    );
  }
}
