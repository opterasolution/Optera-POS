import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { SalesTarget } from "@/models/SalesTarget";
import { requireRole } from "@/lib/tenant";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const context = await requireRole(["OWNER", "MANAGER"]);
    const body = await req.json();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const target = await SalesTarget.findOne({
        _id: params.id,
        businessId: context.businessId,
      });

      if (!target) {
        return NextResponse.json({ success: false, error: "Sales target not found" }, { status: 404 });
      }

      const { targetAmount, targetUnits, bonusReward, status, notes } = body;

      if (targetAmount !== undefined) target.targetAmount = Number(targetAmount) || 0;
      if (targetUnits !== undefined) target.targetUnits = Number(targetUnits) || 0;
      if (bonusReward !== undefined) target.bonusReward = Number(bonusReward) || 0;
      if (status !== undefined) target.status = status;
      if (notes !== undefined) target.notes = notes.trim();

      await target.save();

      return NextResponse.json({
        success: true,
        message: "Sales target updated successfully",
        target,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Sales target updated (Demo Mode)",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update sales target";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const context = await requireRole(["OWNER", "MANAGER"]);

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const deleted = await SalesTarget.findOneAndDelete({
        _id: params.id,
        businessId: context.businessId,
      });

      if (!deleted) {
        return NextResponse.json({ success: false, error: "Sales target not found" }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        message: "Sales target deleted successfully",
      });
    }

    return NextResponse.json({
      success: true,
      message: "Sales target deleted (Demo Mode)",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete sales target";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
