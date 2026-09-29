import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Register } from "@/models/Register";
import { Sale } from "@/models/Sale";
import { AuditLog } from "@/models/AuditLog";
import { requireRole } from "@/lib/tenant";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireRole(["OWNER", "MANAGER"]);
    const body = await req.json();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const updateData: Record<string, any> = {};
      if (body.name !== undefined) updateData.name = body.name.trim();
      if (body.location !== undefined) updateData.location = body.location.trim();
      if (body.printerWidth !== undefined) updateData.printerWidth = body.printerWidth;
      if (body.isActive !== undefined) updateData.isActive = Boolean(body.isActive);

      if (body.isDefault) {
        await Register.updateMany({ businessId }, { $set: { isDefault: false } });
        updateData.isDefault = true;
      }

      const register = await Register.findOneAndUpdate(
        { _id: params.id, businessId },
        { $set: updateData },
        { new: true }
      );

      if (!register) {
        return NextResponse.json({ success: false, error: "Register not found." }, { status: 404 });
      }

      // Audit Log
      await AuditLog.create({
        businessId,
        userId: context.userId,
        userName: context.username,
        action: "REGISTER_UPDATED",
        entityType: "Register",
        entityId: register._id,
        details: updateData,
      });

      return NextResponse.json({
        success: true,
        message: `Register "${register.name}" updated successfully.`,
        register,
      });
    }

    // Demo Mode fallback
    return NextResponse.json({
      success: true,
      message: "Register updated successfully (Demo Mode).",
      register: { _id: params.id, ...body },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update register";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireRole(["OWNER"]);

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const register = await Register.findOne({ _id: params.id, businessId });
      if (!register) {
        return NextResponse.json({ success: false, error: "Register not found." }, { status: 404 });
      }

      // Check if transactions exist on this counter
      const salesCount = await Sale.countDocuments({ businessId, registerId: params.id });

      if (salesCount > 0) {
        // Deactivate to protect fiscal and financial accounting integrity
        register.isActive = false;
        if (register.isDefault) register.isDefault = false;
        await register.save();

        await AuditLog.create({
          businessId,
          userId: context.userId,
          userName: context.username,
          action: "REGISTER_DEACTIVATED",
          entityType: "Register",
          entityId: register._id,
          details: { reason: "Deactivated because historical sales exist", salesCount },
        });

        return NextResponse.json({
          success: true,
          message: `Register has ${salesCount} recorded transaction(s). It has been deactivated to preserve sales history.`,
          action: "DEACTIVATED",
        });
      }

      // Hard delete if 0 sales ever occurred
      await Register.findByIdAndDelete(params.id);

      await AuditLog.create({
        businessId,
        userId: context.userId,
        userName: context.username,
        action: "REGISTER_DELETED",
        entityType: "Register",
        entityId: register._id,
        details: { registerNumber: register.registerNumber, name: register.name },
      });

      return NextResponse.json({
        success: true,
        message: `Register "${register.name}" removed successfully.`,
        action: "DELETED",
      });
    }

    // Demo Mode fallback
    return NextResponse.json({
      success: true,
      message: "Register removed successfully (Demo Mode).",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete register";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
