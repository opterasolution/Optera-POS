import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Promotion } from "@/models/Promotion";
import { Business } from "@/models/Business";
import { Customer } from "@/models/Customer";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth, requireRole } from "@/lib/tenant";
import { createPromotionSchema } from "@/lib/validations/promotion";

const demoPromotions = [
  {
    _id: "promo_1",
    name: "Weekend Mega Saver 5% Off",
    code: "WEEKEND5",
    description: "5% off on all bills over Rs. 5,000",
    type: "BILL_THRESHOLD",
    discountType: "PERCENTAGE",
    discountValue: 5,
    minSpend: 5000,
    startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    isActive: true,
    usageCount: 14,
    usageLimit: 100,
  },
  {
    _id: "promo_2",
    name: "Sunlight Soap Buy 3 Get 1 Free",
    code: "SUNLIGHT",
    description: "Buy 3 Sunlight 115g soaps and get 1 free",
    type: "BUY_X_GET_Y",
    discountType: "FREE_ITEM",
    discountValue: 100,
    buyQuantity: 3,
    getQuantity: 1,
    startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    isActive: true,
    usageCount: 28,
  },
];

export async function GET(req: Request) {
  try {
    const context = await requireAuth();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim();
    const status = searchParams.get("status") || "all";

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const now = new Date();

      const query: Record<string, unknown> = {
        businessId: new Types.ObjectId(context.businessId),
      };

      if (status === "active") {
        query.isActive = true;
        query.endDate = { $gte: now };
      } else if (status === "inactive") {
        query.$or = [{ isActive: false }, { endDate: { $lt: now } }];
      }

      if (search) {
        query.$and = [
          {
            $or: [
              { name: { $regex: search, $options: "i" } },
              { code: { $regex: search, $options: "i" } },
              { description: { $regex: search, $options: "i" } },
            ],
          },
        ];
      }

      const [promotions, activeCount, totalCount, usageAgg, loyaltyAgg, business] =
        await Promise.all([
          Promotion.find(query).sort({ createdAt: -1 }),
          Promotion.countDocuments({
            businessId: new Types.ObjectId(context.businessId),
            isActive: true,
            endDate: { $gte: now },
          }),
          Promotion.countDocuments({
            businessId: new Types.ObjectId(context.businessId),
          }),
          Promotion.aggregate([
            { $match: { businessId: new Types.ObjectId(context.businessId) } },
            { $group: { _id: null, total: { $sum: "$usageCount" } } },
          ]),
          Customer.aggregate([
            { $match: { businessId: new Types.ObjectId(context.businessId) } },
            { $group: { _id: null, totalPoints: { $sum: "$loyaltyPoints" } } },
          ]),
          Business.findById(context.businessId).select("loyaltySettings"),
        ]);

      const totalRedemptions = usageAgg.length > 0 ? usageAgg[0].total : 0;
      const pointsInCirculation = loyaltyAgg.length > 0 ? loyaltyAgg[0].totalPoints : 0;

      return NextResponse.json({
        success: true,
        promotions,
        stats: {
          activePromotionsCount: activeCount,
          totalPromotionsCount: totalCount,
          totalUsageCount: totalRedemptions,
          pointsInCirculation: pointsInCirculation || 0,
        },
        loyaltySettings: business?.loyaltySettings || {
          enabled: true,
          pointsPerSpend: 100,
          redemptionRate: 1,
          minPointsToRedeem: 50,
        },
      });
    }

    return NextResponse.json({
      success: true,
      promotions: demoPromotions,
      stats: {
        activePromotionsCount: 2,
        totalPromotionsCount: 2,
        totalUsageCount: 42,
        pointsInCirculation: 3250,
      },
      loyaltySettings: {
        enabled: true,
        pointsPerSpend: 100,
        redemptionRate: 1,
        minPointsToRedeem: 50,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load promotions";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER"]);
    const body = await req.json();

    const parsed = createPromotionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const {
      name,
      code,
      description,
      type,
      discountType,
      discountValue,
      minSpend,
      buyProductId,
      buyQuantity,
      getProductId,
      getQuantity,
      applicableCategories,
      applicableProducts,
      startDate,
      endDate,
      isActive,
      usageLimit,
    } = parsed.data;

    if (new Date(endDate) <= new Date(startDate)) {
      return NextResponse.json(
        { success: false, error: "Promotion end date must be after the start date." },
        { status: 400 }
      );
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      // If coupon code is provided, check for duplicates in this business
      if (code && code.trim()) {
        const existing = await Promotion.findOne({
          businessId: new Types.ObjectId(context.businessId),
          code: code.trim().toUpperCase(),
          isActive: true,
          endDate: { $gte: new Date() },
        });

        if (existing) {
          return NextResponse.json(
            { success: false, error: `An active promotion with coupon code "${code.toUpperCase()}" already exists.` },
            { status: 409 }
          );
        }
      }

      const promotion = await Promotion.create({
        businessId: new Types.ObjectId(context.businessId),
        name,
        code: code ? code.trim().toUpperCase() : undefined,
        description: description || undefined,
        type,
        discountType,
        discountValue,
        minSpend: minSpend || 0,
        buyProductId: buyProductId && buyProductId.trim() ? new Types.ObjectId(buyProductId) : undefined,
        buyQuantity: buyQuantity || 1,
        getProductId: getProductId && getProductId.trim() ? new Types.ObjectId(getProductId) : undefined,
        getQuantity: getQuantity || 1,
        applicableCategories: applicableCategories?.map((id) => new Types.ObjectId(id)),
        applicableProducts: applicableProducts?.map((id) => new Types.ObjectId(id)),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: isActive !== undefined ? isActive : true,
        usageLimit: usageLimit || undefined,
        usageCount: 0,
      });

      await AuditLog.create({
        businessId: new Types.ObjectId(context.businessId),
        userId: new Types.ObjectId(context.userId),
        userName: context.username,
        action: "PROMOTION_CREATED",
        entityType: "Promotion",
        entityId: promotion._id.toString(),
        details: { name, type, discountType, discountValue, code },
      });

      return NextResponse.json({ success: true, promotion }, { status: 201 });
    }

    // Demo Mode fallback
    const demoPromo = {
      _id: `promo_${Date.now()}`,
      name,
      code: code ? code.trim().toUpperCase() : undefined,
      description,
      type,
      discountType,
      discountValue,
      minSpend: minSpend || 0,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      isActive: true,
      usageCount: 0,
      usageLimit,
    };

    return NextResponse.json({ success: true, promotion: demoPromo }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create promotion";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
