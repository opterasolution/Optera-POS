import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { CommissionRule } from "@/models/CommissionRule";
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

      const rule = await CommissionRule.findOne({
        _id: params.id,
        businessId: context.businessId,
      });

      if (!rule) {
        return NextResponse.json({ success: false, error: "Commission rule not found" }, { status: 404 });
      }

      const {
        name,
        description,
        type,
        defaultRate,
        categoryRates,
        volumeTiers,
        applicableRoles,
        applicableUsers,
        minSaleAmount,
        isActive,
      } = body;

      if (name !== undefined) rule.name = name.trim();
      if (description !== undefined) rule.description = description.trim();
      if (type !== undefined) rule.type = type;
      if (defaultRate !== undefined) rule.defaultRate = Number(defaultRate) || 0;
      if (Array.isArray(categoryRates)) rule.categoryRates = categoryRates;
      if (Array.isArray(volumeTiers)) rule.volumeTiers = volumeTiers;
      if (Array.isArray(applicableRoles)) rule.applicableRoles = applicableRoles;
      if (Array.isArray(applicableUsers)) rule.applicableUsers = applicableUsers;
      if (minSaleAmount !== undefined) rule.minSaleAmount = Number(minSaleAmount) || 0;
      if (typeof isActive === "boolean") rule.isActive = isActive;

      await rule.save();

      return NextResponse.json({
        success: true,
        message: "Commission scheme updated successfully",
        rule,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Commission scheme updated (Demo Mode)",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update commission rule";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const context = await requireRole(["OWNER", "MANAGER"]);

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const deleted = await CommissionRule.findOneAndDelete({
        _id: params.id,
        businessId: context.businessId,
      });

      if (!deleted) {
        return NextResponse.json({ success: false, error: "Commission rule not found" }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        message: "Commission scheme deleted successfully",
      });
    }

    return NextResponse.json({
      success: true,
      message: "Commission scheme deleted (Demo Mode)",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete commission rule";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
