import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Branch } from "@/models/Branch";
import { BranchStock } from "@/models/BranchStock";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth, requireRole } from "@/lib/tenant";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireAuth();
    const { id } = params;

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const branch = await Branch.findOne({ _id: id, businessId: context.businessId }).lean();
      if (!branch) {
        return NextResponse.json({ success: false, error: "Branch not found" }, { status: 404 });
      }

      const totalItems = await BranchStock.countDocuments({
        businessId: context.businessId,
        branchId: id,
        quantity: { $gt: 0 },
      });

      return NextResponse.json({
        success: true,
        branch: { ...branch, stockedItemsCount: totalItems },
      });
    }

    return NextResponse.json({
      success: true,
      branch: {
        _id: id,
        code: "HQ-01",
        name: "Main Store / Warehouse",
        type: "WAREHOUSE",
        isMainWarehouse: true,
        isActive: true,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch branch" },
      { status: error.status || 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPER_ADMIN"]);
    const { id } = params;
    const body = await req.json();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const branch = await Branch.findOne({ _id: id, businessId });
      if (!branch) {
        return NextResponse.json({ success: false, error: "Branch not found" }, { status: 404 });
      }

      // If updating code, ensure uniqueness
      if (body.code && body.code.trim().toUpperCase() !== branch.code) {
        const normalized = body.code.trim().toUpperCase();
        const existing = await Branch.findOne({
          businessId,
          code: normalized,
          _id: { $ne: id },
        });
        if (existing) {
          return NextResponse.json(
            { success: false, error: `Branch code "${normalized}" is already in use.` },
            { status: 400 }
          );
        }
        branch.code = normalized;
      }

      // If setting isMainWarehouse, unset on others
      if (body.isMainWarehouse && !branch.isMainWarehouse) {
        await Branch.updateMany({ businessId, isMainWarehouse: true }, { $set: { isMainWarehouse: false } });
        branch.isMainWarehouse = true;
      } else if (body.isMainWarehouse === false && branch.isMainWarehouse) {
        // Prevent unsetting main warehouse if it's the only one
        const otherMain = await Branch.findOne({ businessId, isMainWarehouse: true, _id: { $ne: id } });
        if (!otherMain) {
          return NextResponse.json(
            { success: false, error: "At least one location must be designated as the Main Store / Warehouse." },
            { status: 400 }
          );
        }
        branch.isMainWarehouse = false;
      }

      if (body.name !== undefined) branch.name = body.name.trim();
      if (body.type !== undefined) branch.type = body.type;
      if (body.address !== undefined) branch.address = body.address.trim() || undefined;
      if (body.phone !== undefined) branch.phone = body.phone.trim() || undefined;
      if (body.email !== undefined) branch.email = body.email.trim().toLowerCase() || undefined;
      if (body.managerName !== undefined) branch.managerName = body.managerName.trim() || undefined;
      if (body.isActive !== undefined) {
        if (!body.isActive && branch.isMainWarehouse) {
          return NextResponse.json(
            { success: false, error: "The Main Store / Warehouse cannot be deactivated." },
            { status: 400 }
          );
        }
        branch.isActive = Boolean(body.isActive);
      }

      await branch.save();

      await AuditLog.create({
        businessId,
        action: "BRANCH_UPDATED",
        entity: "BRANCH",
        entityId: branch._id.toString(),
        userId: context.userId,
        details: { code: branch.code, name: branch.name, updates: body },
      });

      return NextResponse.json({
        success: true,
        branch,
        message: `Branch "${branch.name}" updated successfully.`,
      });
    }

    return NextResponse.json({
      success: true,
      branch: { _id: id, ...body },
      message: "Demo: Branch updated successfully.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update branch" },
      { status: error.status || 500 }
    );
  }
}
