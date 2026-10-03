import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Business, ILoyaltyTierRule } from "@/models/Business";
import { Customer } from "@/models/Customer";
import { requireAuth } from "@/lib/tenant";

export const defaultTiers: ILoyaltyTierRule[] = [
  {
    tier: "REGULAR",
    name: "Regular Member",
    nameSi: "සාමාන්‍ය සාමාජික",
    nameTa: "வழக்கமான உறுப்பினர்",
    minSpend: 0,
    multiplier: 1.0,
    perks: ["1.0x Base Loyalty Points", "Instant Checkout Redemption", "Digital E-Receipts"],
    color: "#64748B",
  },
  {
    tier: "SILVER",
    name: "Silver VIP",
    nameSi: "රිදී VIP",
    nameTa: "வெள்ளி விஐபி",
    minSpend: 25000,
    multiplier: 1.25,
    perks: ["1.25x Points Multiplier", "Early Access to Promotions", "Priority Customer Support"],
    color: "#94A3B8",
  },
  {
    tier: "GOLD",
    name: "Gold VIP",
    nameSi: "රන් VIP",
    nameTa: "தங்க விஐபி",
    minSpend: 75000,
    multiplier: 1.5,
    perks: ["1.50x Points Multiplier", "Free Delivery on Orders > Rs. 5,000", "Wholesale Pricing Access"],
    color: "#F59E0B",
  },
  {
    tier: "PLATINUM",
    name: "Platinum Elite",
    nameSi: "ප්ලැටිනම් එලයිට්",
    nameTa: "பிளாட்டினம் எலைட்",
    minSpend: 150000,
    multiplier: 2.0,
    perks: ["2.0x Double Points Always", "Instant Naya Potha Credit Pre-Approval", "Dedicated Account Manager", "Free Festive Gift Packs"],
    color: "#8B5CF6",
  },
];

export async function GET() {
  try {
    const context = await requireAuth();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const business = await Business.findById(context.businessId).lean();
      const loyaltySettings = business?.loyaltySettings || {
        enabled: true,
        pointsPerSpend: 100,
        redemptionRate: 1,
        minPointsToRedeem: 50,
      };

      const tiers = loyaltySettings.tiers && loyaltySettings.tiers.length > 0
        ? loyaltySettings.tiers
        : defaultTiers;

      // Calculate member counts per tier
      const customers = await Customer.find({ businessId: context.businessId })
        .select("loyaltyTier totalSpent loyaltyPoints")
        .lean();

      const tierCounts: Record<string, number> = {
        REGULAR: 0,
        SILVER: 0,
        GOLD: 0,
        PLATINUM: 0,
      };

      let totalPoints = 0;
      let totalVipMembers = 0;

      for (const c of customers) {
        const tier = c.loyaltyTier || "REGULAR";
        tierCounts[tier] = (tierCounts[tier] || 0) + 1;
        if (tier !== "REGULAR") {
          totalVipMembers++;
        }
        totalPoints += c.loyaltyPoints || 0;
      }

      return NextResponse.json({
        success: true,
        settings: {
          enabled: loyaltySettings.enabled !== false,
          pointsPerSpend: loyaltySettings.pointsPerSpend || 100,
          redemptionRate: loyaltySettings.redemptionRate || 1,
          minPointsToRedeem: loyaltySettings.minPointsToRedeem || 50,
          tierMultipliers: loyaltySettings.tierMultipliers || {
            regular: 1.0,
            silver: 1.25,
            gold: 1.5,
            platinum: 2.0,
          },
          birthdayMultiplier: loyaltySettings.birthdayMultiplier || 2.0,
          tiers,
          referralSettings: loyaltySettings.referralSettings || {
            enabled: true,
            referrerRewardPoints: 100,
            refereeRewardPoints: 50,
            minFirstOrderSpend: 500,
          },
          birthdaySettings: loyaltySettings.birthdaySettings || {
            enabled: true,
            multiplier: 2.0,
            rewardPointsBonus: 50,
            smsGreetingEnabled: true,
          },
        },
        stats: {
          totalCustomers: customers.length,
          totalVipMembers,
          totalLoyaltyPoints: totalPoints,
          monetaryValue: totalPoints * (loyaltySettings.redemptionRate || 1),
          tierDistribution: tierCounts,
        },
      });
    }

    // Demo Mode fallback
    return NextResponse.json({
      success: true,
      settings: {
        enabled: true,
        pointsPerSpend: 100,
        redemptionRate: 1,
        minPointsToRedeem: 50,
        tierMultipliers: { regular: 1.0, silver: 1.25, gold: 1.5, platinum: 2.0 },
        birthdayMultiplier: 2.0,
        tiers: defaultTiers,
        referralSettings: {
          enabled: true,
          referrerRewardPoints: 100,
          refereeRewardPoints: 50,
          minFirstOrderSpend: 500,
        },
        birthdaySettings: {
          enabled: true,
          multiplier: 2.0,
          rewardPointsBonus: 50,
          smsGreetingEnabled: true,
        },
      },
      stats: {
        totalCustomers: 142,
        totalVipMembers: 38,
        totalLoyaltyPoints: 18450,
        monetaryValue: 18450,
        tierDistribution: {
          REGULAR: 104,
          SILVER: 24,
          GOLD: 11,
          PLATINUM: 3,
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load loyalty tier configurations";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const context = await requireAuth();
    const body = await req.json();

    const {
      enabled,
      pointsPerSpend,
      redemptionRate,
      minPointsToRedeem,
      tierMultipliers,
      birthdayMultiplier,
      tiers,
      referralSettings,
      birthdaySettings,
    } = body;

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const business = await Business.findById(context.businessId);
      if (!business) {
        return NextResponse.json({ success: false, error: "Business profile not found" }, { status: 404 });
      }

      if (!business.loyaltySettings) {
        business.loyaltySettings = {
          enabled: true,
          pointsPerSpend: 100,
          redemptionRate: 1,
          minPointsToRedeem: 50,
        };
      }

      if (enabled !== undefined) business.loyaltySettings.enabled = Boolean(enabled);
      if (pointsPerSpend !== undefined) business.loyaltySettings.pointsPerSpend = Math.max(1, Number(pointsPerSpend));
      if (redemptionRate !== undefined) business.loyaltySettings.redemptionRate = Math.max(0.01, Number(redemptionRate));
      if (minPointsToRedeem !== undefined) business.loyaltySettings.minPointsToRedeem = Math.max(0, Number(minPointsToRedeem));
      if (tierMultipliers) business.loyaltySettings.tierMultipliers = tierMultipliers;
      if (birthdayMultiplier !== undefined) business.loyaltySettings.birthdayMultiplier = Number(birthdayMultiplier);
      if (Array.isArray(tiers)) business.loyaltySettings.tiers = tiers;
      if (referralSettings) business.loyaltySettings.referralSettings = referralSettings;
      if (birthdaySettings) business.loyaltySettings.birthdaySettings = birthdaySettings;

      business.markModified("loyaltySettings");
      await business.save();

      return NextResponse.json({
        success: true,
        message: "Loyalty tier configuration updated successfully",
        loyaltySettings: business.loyaltySettings,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Demo Mode: Loyalty tier configuration updated",
      loyaltySettings: body,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update loyalty settings";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
