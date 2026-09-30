import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { AuditLog } from "@/models/AuditLog";
import { requireRole } from "@/lib/tenant";
import { createStaffSchema } from "@/lib/validations/staff";

export async function GET() {
  try {
    const context = await requireRole(["OWNER"]);

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const staffDocs = await User.find({
        businessId: context.businessId,
      })
        .select("-password")
        .sort({ createdAt: -1 })
        .lean();

      const staff = staffDocs.map((u) => ({
        _id: u._id,
        name: u.name,
        username: u.username,
        role: u.role,
        phone: u.phone,
        hasSupervisorPin: !!u.supervisorPin,
        isActive: u.isActive,
        createdAt: u.createdAt,
      }));

      return NextResponse.json({ success: true, staff });
    }

    // Demo Data
    return NextResponse.json({
      success: true,
      staff: [
        {
          _id: "demo_user_1",
          name: "Store Administrator",
          username: "admin",
          role: "OWNER",
          phone: "0771234567",
          hasSupervisorPin: true,
          isActive: true,
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          _id: "demo_user_2",
          name: "Sunil Jayawardena",
          username: "supervisor",
          role: "SUPERVISOR",
          phone: "0778889999",
          hasSupervisorPin: true,
          isActive: true,
          createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          _id: "demo_user_3",
          name: "Nimal Perera",
          username: "cashier",
          role: "CASHIER",
          phone: "0714445555",
          hasSupervisorPin: false,
          isActive: true,
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load staff";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER"]);
    const body = await req.json();

    const parsed = createStaffSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { name, username, password, role, phone, supervisorPin } = parsed.data;

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      // Check duplicate username in this business
      const existing = await User.findOne({
        businessId: context.businessId,
        username: username.toLowerCase(),
      });

      if (existing) {
        return NextResponse.json(
          { success: false, error: `Staff login ID "${username}" is already taken.` },
          { status: 409 }
        );
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      let hashedPin: string | undefined = undefined;
      if (supervisorPin && supervisorPin.trim().length >= 4) {
        hashedPin = await bcrypt.hash(supervisorPin.trim(), 10);
      }

      const user = await User.create({
        businessId: context.businessId,
        name,
        username: username.toLowerCase(),
        password: hashedPassword,
        role,
        phone: phone || undefined,
        supervisorPin: hashedPin,
        isActive: true,
      });

      await AuditLog.create({
        businessId: context.businessId,
        userId: context.userId,
        userName: context.username,
        action: "EMPLOYEE_ADDED",
        entityType: "User",
        entityId: user._id.toString(),
        details: { name, username, role, hasSupervisorPin: !!hashedPin },
      });

      return NextResponse.json({
        success: true,
        message: `Staff member "${name}" (${role}) created successfully.`,
        user: {
          _id: user._id,
          name: user.name,
          username: user.username,
          role: user.role,
          phone: user.phone,
          hasSupervisorPin: !!user.supervisorPin,
          isActive: user.isActive,
        },
      }, { status: 201 });
    }

    // Demo Mode fallback
    return NextResponse.json({
      success: true,
      message: `Staff member "${name}" (${role}) created (Demo Mode).`,
      user: {
        _id: `user_${Date.now()}`,
        name,
        username,
        role,
        phone,
        hasSupervisorPin: !!supervisorPin,
        isActive: true,
        createdAt: new Date().toISOString(),
      },
    }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create staff member";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
