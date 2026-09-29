import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Register } from "@/models/Register";
import { Business } from "@/models/Business";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth, requireRole } from "@/lib/tenant";

export async function GET() {
  try {
    const context = await requireAuth();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const business = await Business.findById(businessId).lean();
      const plan = business?.subscription?.plan || "BASIC";
      const defaultMaxRegisters = plan === "ENTERPRISE" ? 15 : plan === "PROFESSIONAL" ? 3 : plan === "TRIAL" ? 2 : 1;
      const maxRegisters = business?.subscription?.maxRegisters || defaultMaxRegisters;

      let registers: any[] = await Register.find({ businessId }).sort({ registerNumber: 1 }).lean();

      // If store has 0 registers, auto-seed default Counter 01
      if (registers.length === 0) {
        const defaultWidth = business?.receiptSettings?.defaultWidth || "58mm";
        const defaultReg = await Register.create({
          businessId,
          registerNumber: "REG-01",
          name: "Counter 01 (Main Register)",
          location: "Main Counter",
          printerWidth: defaultWidth,
          isDefault: true,
          isActive: true,
        });

        registers = [defaultReg.toObject()];
      }

      return NextResponse.json({
        success: true,
        registers,
        maxRegisters,
        totalCount: registers.length,
        activeCount: registers.filter((r: any) => r.isActive).length,
        canAddMore: registers.length < maxRegisters,
      });
    }

    // Demo Mode fallback
    return NextResponse.json({
      success: true,
      registers: [
        {
          _id: "demo_reg_01",
          registerNumber: "REG-01",
          name: "Counter 01 (Main Register)",
          location: "Main Ground Counter",
          printerWidth: "58mm",
          isDefault: true,
          isActive: true,
        },
        {
          _id: "demo_reg_02",
          registerNumber: "REG-02",
          name: "Counter 02 (Express Checkout)",
          location: "Front Entrance",
          printerWidth: "58mm",
          isDefault: false,
          isActive: true,
        },
      ],
      maxRegisters: 3,
      totalCount: 2,
      activeCount: 2,
      canAddMore: true,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load store registers";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER"]);
    const body = await req.json();

    const { registerNumber, name, location, printerWidth, isDefault } = body;

    if (!registerNumber || !name) {
      return NextResponse.json(
        { success: false, error: "Register code and name are required." },
        { status: 400 }
      );
    }

    const cleanNumber = registerNumber.trim().toUpperCase();
    const cleanName = name.trim();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      // 1. Check SaaS Plan Quota Limits
      const business = await Business.findById(businessId).lean();
      const plan = business?.subscription?.plan || "BASIC";
      const defaultMaxRegisters = plan === "ENTERPRISE" ? 15 : plan === "PROFESSIONAL" ? 3 : plan === "TRIAL" ? 2 : 1;
      const maxRegisters = business?.subscription?.maxRegisters || defaultMaxRegisters;

      const currentCount = await Register.countDocuments({ businessId });
      if (currentCount >= maxRegisters) {
        return NextResponse.json(
          {
            success: false,
            error: `Your store has reached the limit of ${maxRegisters} register(s) on the ${plan} plan. Please upgrade your license to add more counters.`,
          },
          { status: 403 }
        );
      }

      // 2. Check for duplicate registerNumber within this business
      const existing = await Register.findOne({ businessId, registerNumber: cleanNumber });
      if (existing) {
        return NextResponse.json(
          {
            success: false,
            error: `Register code "${cleanNumber}" already exists in your store.`,
          },
          { status: 409 }
        );
      }

      // 3. If setting as default, clear other default
      if (isDefault) {
        await Register.updateMany({ businessId }, { $set: { isDefault: false } });
      }

      // 4. Create Register
      const register = await Register.create({
        businessId,
        registerNumber: cleanNumber,
        name: cleanName,
        location: location?.trim() || undefined,
        printerWidth: printerWidth === "80mm" ? "80mm" : "58mm",
        isDefault: Boolean(isDefault),
        isActive: true,
      });

      // 5. Audit Log
      await AuditLog.create({
        businessId,
        userId: context.userId,
        userName: context.username,
        action: "REGISTER_CREATED",
        entityType: "Register",
        entityId: register._id,
        details: { registerNumber: cleanNumber, name: cleanName, location },
      });

      return NextResponse.json(
        {
          success: true,
          message: `Register "${cleanName}" (${cleanNumber}) successfully configured.`,
          register,
        },
        { status: 201 }
      );
    }

    // Demo Mode fallback
    return NextResponse.json({
      success: true,
      message: `Register "${cleanName}" (${cleanNumber}) configured (Demo Mode).`,
      register: {
        _id: `demo_reg_${Date.now()}`,
        registerNumber: cleanNumber,
        name: cleanName,
        location,
        printerWidth: printerWidth || "58mm",
        isDefault: Boolean(isDefault),
        isActive: true,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create register";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
