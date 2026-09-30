import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { AuditLog } from "@/models/AuditLog";
import { requireRole } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "ACCOUNTANT"]);
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const actionFilter = searchParams.get("action");
    const search = searchParams.get("search");
    const range = searchParams.get("range") || "all";

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const query: Record<string, unknown> = { businessId };

      if (actionFilter && actionFilter !== "ALL") {
        query.action = actionFilter;
      }

      if (search && search.trim()) {
        const regex = new RegExp(search.trim(), "i");
        query.$or = [
          { userName: regex },
          { action: regex },
          { entityType: regex },
          { "details.reason": regex },
          { "details.supervisorName": regex },
        ];
      }

      // Date ranges
      const now = Date.now();
      if (range === "today") {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        query.createdAt = { $gte: startOfDay };
      } else if (range === "yesterday") {
        const startOfYesterday = new Date(now - 24 * 60 * 60 * 1000);
        startOfYesterday.setHours(0, 0, 0, 0);
        const endOfYesterday = new Date(startOfYesterday.getTime() + 24 * 60 * 60 * 1000 - 1);
        query.createdAt = { $gte: startOfYesterday, $lte: endOfYesterday };
      } else if (range === "this_week") {
        const startOfWeek = new Date(now - 7 * 24 * 60 * 60 * 1000);
        query.createdAt = { $gte: startOfWeek };
      } else if (range === "this_month") {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        query.createdAt = { $gte: startOfMonth };
      }

      const total = await AuditLog.countDocuments(query);
      const logs = await AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      // Distinct actions for dropdown filters
      const actionsList = await AuditLog.distinct("action", { businessId });

      return NextResponse.json({
        success: true,
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        actionsList,
      });
    }

    // Demo Data
    const demoLogs = [
      {
        _id: "log_1",
        userName: "cashier",
        action: "SUPERVISOR_OVERRIDE",
        entityType: "SupervisorOverride",
        details: {
          authorizedAction: "VOID_CART",
          supervisorName: "Sunil Jayawardena",
          supervisorRole: "SUPERVISOR",
          cashierName: "cashier",
          reason: "Customer forgot wallet in car, canceled bill",
          cartItemsCount: 4,
          cartTotal: 3450,
        },
        createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      },
      {
        _id: "log_2",
        userName: "cashier",
        action: "SUPERVISOR_OVERRIDE",
        entityType: "SupervisorOverride",
        details: {
          authorizedAction: "HIGH_DISCOUNT",
          supervisorName: "Sunil Jayawardena",
          supervisorRole: "SUPERVISOR",
          cashierName: "cashier",
          reason: "Damaged box on Munchee Super Cream Cracker tin",
          discountAmount: 450,
          discountPercent: 12,
        },
        createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      },
      {
        _id: "log_3",
        userName: "cashier",
        action: "DRAWER_NO_SALE_KICK",
        entityType: "Register",
        details: {
          registerName: "Counter 01",
          reason: "Making change for Rs. 5,000 note",
          supervisorApproved: true,
          supervisorName: "Sunil Jayawardena",
        },
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
      {
        _id: "log_4",
        userName: "admin",
        action: "EMPLOYEE_ADDED",
        entityType: "User",
        details: {
          name: "Sunil Jayawardena",
          username: "supervisor",
          role: "SUPERVISOR",
          hasSupervisorPin: true,
        },
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        _id: "log_5",
        userName: "admin",
        action: "SECURITY_POLICY_UPDATED",
        entityType: "Business",
        details: {
          requireSupervisorForVoid: true,
          requireSupervisorForDiscount: true,
          maxCashierDiscountPercent: 5,
        },
        createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    let filtered = demoLogs;
    if (actionFilter && actionFilter !== "ALL") {
      filtered = filtered.filter((l) => l.action === actionFilter);
    }
    if (search && search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.userName.toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q) ||
          JSON.stringify(l.details).toLowerCase().includes(q)
      );
    }

    return NextResponse.json({
      success: true,
      logs: filtered,
      pagination: {
        page: 1,
        limit: 50,
        total: filtered.length,
        totalPages: 1,
      },
      actionsList: [
        "SUPERVISOR_OVERRIDE",
        "DRAWER_NO_SALE_KICK",
        "EMPLOYEE_ADDED",
        "EMPLOYEE_UPDATED",
        "SECURITY_POLICY_UPDATED",
        "EXPENSE_RECORDED",
      ],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load audit logs";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
