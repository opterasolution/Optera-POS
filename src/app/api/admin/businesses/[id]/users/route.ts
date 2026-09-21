import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { Business } from "@/models/Business";
import { AuditLog } from "@/models/AuditLog";
import { requireSuperAdmin } from "@/lib/tenant";

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(req: Request, { params }: RouteParams) {
  try {
    await requireSuperAdmin();
    const { id } = params;

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const [business, users] = await Promise.all([
        Business.findById(id).select("name businessType ownerName phone").lean(),
        User.find({ businessId: id }).select("-password").sort({ role: 1, createdAt: -1 }).lean(),
      ]);

      if (!business) {
        return NextResponse.json({ success: false, error: "Business not found." }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        business,
        users,
      });
    }

    // Demo Mode mock data
    return NextResponse.json({
      success: true,
      business: {
        _id: id,
        name: "Client Retail Store",
        businessType: "Grocery & Supermarket",
        ownerName: "Sunil Perera",
        phone: "0771234567",
      },
      users: [
        {
          _id: `user_owner_${id}`,
          name: "Sunil Perera",
          username: "perera_admin",
          role: "OWNER",
          phone: "0771234567",
          isActive: true,
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          _id: `user_cashier1_${id}`,
          name: "Nimal Silva",
          username: "nimal_pos",
          role: "CASHIER",
          phone: "0712223344",
          isActive: true,
          createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          _id: `user_cashier2_${id}`,
          name: "Kasun Bandara",
          username: "kasun_counter",
          role: "CASHIER",
          phone: "0785556677",
          isActive: true,
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load store users";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const adminContext = await requireSuperAdmin();
    const { id } = params;
    const body = await req.json();
    const { action, userId, newPassword } = body;

    if (action === "RESET_PASSWORD") {
      if (!userId || !newPassword || newPassword.length < 4) {
        return NextResponse.json(
          { success: false, error: "Valid userId and new password (min 4 chars) required." },
          { status: 400 }
        );
      }

      if (Boolean(process.env.MONGODB_URI)) {
        await connectToDatabase();
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const updatedUser = await User.findOneAndUpdate(
          { _id: userId, businessId: id },
          { password: hashedPassword },
          { new: true }
        ).select("-password");

        if (!updatedUser) {
          return NextResponse.json({ success: false, error: "User account not found." }, { status: 404 });
        }

        await AuditLog.create({
          businessId: id,
          userId: adminContext.userId,
          userName: `SUPER_ADMIN (${adminContext.username})`,
          action: "PASSWORD_RESET_BY_ADMIN",
          entityType: "User",
          entityId: userId,
          details: { targetUsername: updatedUser.username },
        });

        return NextResponse.json({
          success: true,
          message: `Password for @${updatedUser.username} successfully reset!`,
          user: updatedUser,
        });
      }

      // Demo Mode response
      return NextResponse.json({
        success: true,
        message: "User password reset successfully (Demo Mode).",
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Action failed";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
