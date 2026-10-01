import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { CommissionRule } from "@/models/CommissionRule";
import { requireRole } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPERVISOR", "ACCOUNTANT"]);

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const rules = await CommissionRule.find({ businessId: context.businessId })
        .sort({ createdAt: -1 })
        .lean();

      const activeCount = rules.filter((r) => r.isActive).length;
      const averageRate =
        rules.length > 0
          ? Math.round(
              (rules.reduce((acc, r) => acc + (r.defaultRate || 0), 0) / rules.length) * 10
            ) / 10
          : 0;

      return NextResponse.json({
        success: true,
        rules,
        stats: {
          totalRules: rules.length,
          activeRulesCount: activeCount,
          averageRate,
        },
      });
    }

    // Demo Data
    return NextResponse.json({
      success: true,
      rules: [
        {
          _id: "demo_rule_1",
          name: "Standard Floor Sales Rep Commission",
          description: "Flat 2.5% incentive on all completed store retail orders",
          type: "FLAT_PERCENT",
          defaultRate: 2.5,
          categoryRates: [],
          volumeTiers: [],
          applicableRoles: ["SALES_REP", "CASHIER"],
          minSaleAmount: 1000,
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        {
          _id: "demo_rule_2",
          name: "High-Margin Electronics Incentive",
          description: "Tiered rate favoring home appliances and electronics",
          type: "CATEGORY_BASED",
          defaultRate: 1.5,
          categoryRates: [
            { categoryId: "cat_1", categoryName: "Electronics", rate: 4.0 },
            { categoryId: "cat_2", categoryName: "Accessories", rate: 5.0 },
          ],
          volumeTiers: [],
          applicableRoles: ["SALES_REP"],
          minSaleAmount: 0,
          isActive: true,
          createdAt: new Date().toISOString(),
        },
      ],
      stats: {
        totalRules: 2,
        activeRulesCount: 2,
        averageRate: 2.0,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch commission rules";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER"]);
    const body = await req.json();

    const {
      name,
      description,
      type = "FLAT_PERCENT",
      defaultRate = 2.0,
      categoryRates = [],
      volumeTiers = [],
      applicableRoles = ["CASHIER", "SALES_REP"],
      applicableUsers = [],
      minSaleAmount = 0,
      isActive = true,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "Commission rule name is required" },
        { status: 400 }
      );
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const newRule = await CommissionRule.create({
        businessId: context.businessId,
        name: name.trim(),
        description: description?.trim() || "",
        type,
        defaultRate: Number(defaultRate) || 0,
        categoryRates: Array.isArray(categoryRates) ? categoryRates : [],
        volumeTiers: Array.isArray(volumeTiers) ? volumeTiers : [],
        applicableRoles: Array.isArray(applicableRoles) && applicableRoles.length > 0 ? applicableRoles : ["CASHIER", "SALES_REP"],
        applicableUsers: Array.isArray(applicableUsers) ? applicableUsers : [],
        minSaleAmount: Number(minSaleAmount) || 0,
        isActive: Boolean(isActive),
      });

      return NextResponse.json({
        success: true,
        message: "Commission scheme created successfully",
        rule: newRule,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Commission scheme created (Demo Mode)",
      rule: {
        _id: "demo_new_rule",
        name,
        type,
        defaultRate,
        isActive,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create commission rule";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
