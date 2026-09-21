import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { AuditLog } from "@/models/AuditLog";
import { requireSuperAdmin } from "@/lib/tenant";

export async function GET() {
  try {
    await requireSuperAdmin();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const logs = await AuditLog.find()
        .sort({ createdAt: -1 })
        .limit(30)
        .populate("businessId", "name businessType")
        .lean();

      return NextResponse.json({
        success: true,
        activities: logs.map((log: any) => ({
          _id: log._id,
          businessName: log.businessId?.name || "Platform",
          businessType: log.businessId?.businessType,
          userName: log.userName,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          details: log.details,
          createdAt: log.createdAt,
        })),
      });
    }

    // Demo Mode activity stream
    return NextResponse.json({
      success: true,
      activities: [
        {
          _id: "act_1",
          businessName: "Perera Super City",
          userName: "SUPER_ADMIN (superadmin)",
          action: "LICENSE_EXTENDED",
          entityType: "Business",
          details: { plan: "PROFESSIONAL", extendedDays: 30 },
          createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        },
        {
          _id: "act_2",
          businessName: "Galle Fort Hardware",
          userName: "SUPER_ADMIN (superadmin)",
          action: "STORE_ONBOARDED",
          entityType: "Business",
          details: { plan: "TRIAL", ownerUsername: "mahinda_galle" },
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        },
        {
          _id: "act_3",
          businessName: "Kandy Fresh Veggies",
          userName: "Chaminda Bandara",
          action: "EMPLOYEE_ADDED",
          entityType: "User",
          details: { name: "Sunil Kumara", role: "CASHIER" },
          createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        },
        {
          _id: "act_4",
          businessName: "Negombo Coastal Pharmacy",
          userName: "SUPER_ADMIN (superadmin)",
          action: "STORE_SUSPENDED",
          entityType: "Business",
          details: { reason: "Overdue subscription payment" },
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          _id: "act_5",
          businessName: "Jaffna Bookshop & Stationers",
          userName: "K. Rajan",
          action: "RESTOCK",
          entityType: "InventoryMovement",
          details: { product: "Atlas CR Book 120 Pages", quantity: 50 },
          createdAt: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
        },
      ],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load platform activities";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
