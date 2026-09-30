import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth } from "@/lib/tenant";

export async function POST(req: Request) {
  try {
    const context = await requireAuth();
    const body = await req.json();
    const { pin, action, reason, details } = body;

    if (!pin || typeof pin !== "string" || pin.trim().length < 4) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid 4-6 digit supervisor PIN." },
        { status: 400 }
      );
    }

    const cleanPin = pin.trim();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      // Find all supervisors, managers, or owners with a pin set
      const eligibleSupervisors = await User.find({
        businessId: context.businessId,
        isActive: true,
        role: { $in: ["OWNER", "MANAGER", "SUPERVISOR"] },
        supervisorPin: { $exists: true, $ne: "" },
      });

      let matchedSupervisor: typeof eligibleSupervisors[0] | null = null;

      for (const sup of eligibleSupervisors) {
        if (sup.supervisorPin) {
          const isMatch = await bcrypt.compare(cleanPin, sup.supervisorPin);
          if (isMatch) {
            matchedSupervisor = sup;
            break;
          }
        }
      }

      if (!matchedSupervisor) {
        // Record failed attempt for security audit
        await AuditLog.create({
          businessId: context.businessId,
          userId: context.userId,
          userName: context.username,
          action: "OVERRIDE_FAILED_INVALID_PIN",
          entityType: "SupervisorOverride",
          details: {
            attemptedAction: action || "UNKNOWN",
            cashierName: context.username,
            reason: reason || "Unspecified",
          },
        });

        return NextResponse.json(
          { success: false, error: "Invalid Supervisor PIN. Override authorization denied." },
          { status: 401 }
        );
      }

      // Record successful supervisor override
      await AuditLog.create({
        businessId: context.businessId,
        userId: context.userId,
        userName: context.username,
        action: "SUPERVISOR_OVERRIDE",
        entityType: "SupervisorOverride",
        details: {
          authorizedAction: action || "RESTRICTED_ACTION",
          supervisorId: matchedSupervisor._id.toString(),
          supervisorName: matchedSupervisor.name,
          supervisorRole: matchedSupervisor.role,
          cashierId: context.userId,
          cashierName: context.username,
          reason: reason || "Authorized by supervisor",
          ...(details || {}),
        },
      });

      return NextResponse.json({
        success: true,
        authorized: true,
        supervisor: {
          id: matchedSupervisor._id,
          name: matchedSupervisor.name,
          role: matchedSupervisor.role,
        },
        message: `Action authorized by ${matchedSupervisor.name} (${matchedSupervisor.role}).`,
      });
    }

    // Demo Mode: PIN 1234 or 9999 works
    if (cleanPin === "1234" || cleanPin === "9999") {
      return NextResponse.json({
        success: true,
        authorized: true,
        supervisor: {
          id: "demo_sup_1",
          name: "Sunil Jayawardena",
          role: "SUPERVISOR",
        },
        message: "Action authorized by Sunil Jayawardena (Demo Supervisor).",
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid PIN. Use demo PIN: 1234" },
      { status: 401 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to verify supervisor override";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
