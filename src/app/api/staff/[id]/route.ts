import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { AuditLog } from "@/models/AuditLog";
import { requireRole } from "@/lib/tenant";
import { updateStaffSchema } from "@/lib/validations/staff";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const context = await requireRole(["OWNER", "MANAGER"]);

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const user = await User.findOne({
        _id: params.id,
        businessId: context.businessId,
      })
        .select("-password")
        .lean();

      if (!user) {
        return NextResponse.json({ success: false, error: "Staff member not found" }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        user: {
          ...user,
          hasSupervisorPin: !!user.supervisorPin,
          supervisorPin: undefined,
        },
      });
    }

    return NextResponse.json({
      success: true,
      user: {
        _id: params.id,
        name: "Staff Member",
        username: "staff",
        role: "CASHIER",
        hasSupervisorPin: false,
        isActive: true,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch staff member";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const context = await requireRole(["OWNER", "MANAGER"]);
    const body = await req.json();

    const parsed = updateStaffSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { name, password, role, phone, supervisorPin, isActive, commissionRate, monthlyTargetAmount } = parsed.data;

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const user = await User.findOne({
        _id: params.id,
        businessId: context.businessId,
      });

      if (!user) {
        return NextResponse.json({ success: false, error: "Staff member not found" }, { status: 404 });
      }

      // Prevent managers from modifying owners
      if (context.role === "MANAGER" && user.role === "OWNER") {
        return NextResponse.json(
          { success: false, error: "Forbidden: Managers cannot modify Owner profiles." },
          { status: 403 }
        );
      }

      const updateFields: Record<string, unknown> = {};
      if (name) updateFields.name = name;
      if (phone !== undefined) updateFields.phone = phone || undefined;
      if (role) updateFields.role = role;
      if (typeof isActive === "boolean") updateFields.isActive = isActive;
      if (commissionRate !== undefined) updateFields.commissionRate = Number(commissionRate) || 0;
      if (monthlyTargetAmount !== undefined) updateFields.monthlyTargetAmount = Number(monthlyTargetAmount) || 0;

      if (password && password.trim().length >= 4) {
        updateFields.password = await bcrypt.hash(password.trim(), 10);
      }

      if (supervisorPin !== undefined) {
        if (supervisorPin.trim().length >= 4) {
          updateFields.supervisorPin = await bcrypt.hash(supervisorPin.trim(), 10);
        } else if (supervisorPin.trim() === "") {
          updateFields.supervisorPin = undefined;
        }
      }

      const updated = await User.findByIdAndUpdate(params.id, updateFields, { new: true })
        .select("-password")
        .lean();

      await AuditLog.create({
        businessId: context.businessId,
        userId: context.userId,
        userName: context.username,
        action: "EMPLOYEE_UPDATED",
        entityType: "User",
        entityId: params.id,
        details: {
          updatedFields: Object.keys(updateFields).filter((k) => k !== "password" && k !== "supervisorPin"),
          roleChanged: role ? role : undefined,
          pinUpdated: supervisorPin !== undefined,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Staff member updated successfully.",
        user: {
          ...updated,
          hasSupervisorPin: !!updated?.supervisorPin,
          supervisorPin: undefined,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Staff member updated (Demo Mode).",
      user: {
        _id: params.id,
        name: name || "Demo Staff",
        role: role || "CASHIER",
        phone,
        isActive: isActive ?? true,
        hasSupervisorPin: !!supervisorPin,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update staff member";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const context = await requireRole(["OWNER"]);

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      // Prevent self-deletion
      if (context.userId === params.id) {
        return NextResponse.json(
          { success: false, error: "Cannot delete your own account." },
          { status: 400 }
        );
      }

      const user = await User.findOne({
        _id: params.id,
        businessId: context.businessId,
      });

      if (!user) {
        return NextResponse.json({ success: false, error: "Staff member not found" }, { status: 404 });
      }

      await User.findByIdAndDelete(params.id);

      await AuditLog.create({
        businessId: context.businessId,
        userId: context.userId,
        userName: context.username,
        action: "EMPLOYEE_DELETED",
        entityType: "User",
        entityId: params.id,
        details: { name: user.name, username: user.username, role: user.role },
      });

      return NextResponse.json({
        success: true,
        message: `Staff member "${user.name}" removed successfully.`,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Staff member removed (Demo Mode).",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete staff member";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
