import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Customer } from "@/models/Customer";
import { Business } from "@/models/Business";
import { LoyaltyTransaction } from "@/models/LoyaltyTransaction";
import { requireAuth } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const context = await requireAuth();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const business = await Business.findById(context.businessId).lean();
      const refSettings = business?.loyaltySettings?.referralSettings || {
        enabled: true,
        referrerRewardPoints: 100,
        refereeRewardPoints: 50,
        minFirstOrderSpend: 500,
      };

      // 1. Fetch Top Referrers Leaderboard
      const topReferrers = await Customer.find({
        businessId: context.businessId,
        referralCount: { $gt: 0 },
      })
        .sort({ referralCount: -1, referralPointsEarned: -1 })
        .limit(10)
        .select("name phone referralCode referralCount referralPointsEarned loyaltyTier loyaltyPoints")
        .lean();

      // 2. Fetch Recent Referees (customers who joined via referral)
      const referees = await Customer.find({
        businessId: context.businessId,
        referredBy: { $exists: true, $ne: null },
      })
        .sort({ createdAt: -1 })
        .limit(30)
        .populate("referredBy", "name phone referralCode")
        .select("name phone referralCode referredBy totalSpent visitCount loyaltyPoints referralPointsEarned createdAt")
        .lean();

      // 3. Overall Statistics
      const allReferrers = await Customer.find({
        businessId: context.businessId,
        referralCount: { $gt: 0 },
      })
        .select("referralCount referralPointsEarned")
        .lean();

      const totalReferrers = allReferrers.length;
      const totalReferrals = allReferrers.reduce((sum, c) => sum + (c.referralCount || 0), 0);
      const totalReferralPointsAwarded = allReferrers.reduce(
        (sum, c) => sum + (c.referralPointsEarned || 0),
        0
      );

      // Total referee bonus points distributed
      const refereePointsCount = referees.reduce(
        (sum, r) => sum + (r.referralPointsEarned || 0),
        0
      );

      return NextResponse.json({
        success: true,
        settings: refSettings,
        stats: {
          totalReferrers,
          totalReferrals,
          totalReferralPointsAwarded: totalReferralPointsAwarded + refereePointsCount,
          activeReferrersCount: topReferrers.length,
        },
        topReferrers: topReferrers.map((r: any) => ({
          _id: r._id,
          name: r.name,
          phone: r.phone,
          referralCode: r.referralCode || "N/A",
          referralCount: r.referralCount || 0,
          referralPointsEarned: r.referralPointsEarned || 0,
          loyaltyTier: r.loyaltyTier || "REGULAR",
          loyaltyPoints: r.loyaltyPoints || 0,
        })),
        recentReferees: referees.map((ref: any) => ({
          _id: ref._id,
          name: ref.name,
          phone: ref.phone,
          referralCode: ref.referralCode,
          referrerName: ref.referredBy?.name || "Unknown Referrer",
          referrerPhone: ref.referredBy?.phone || "",
          referrerCode: ref.referredBy?.referralCode || "",
          totalSpent: ref.totalSpent || 0,
          visitCount: ref.visitCount || 0,
          hasCompletedOrder: (ref.visitCount || 0) > 0,
          joinedAt: ref.createdAt,
        })),
      });
    }

    // Demo Mode Fallback
    return NextResponse.json({
      success: true,
      settings: {
        enabled: true,
        referrerRewardPoints: 100,
        refereeRewardPoints: 50,
        minFirstOrderSpend: 500,
      },
      stats: {
        totalReferrers: 12,
        totalReferrals: 34,
        totalReferralPointsAwarded: 5100,
        activeReferrersCount: 5,
      },
      topReferrers: [
        {
          _id: "demo_ref_1",
          name: "Sunil Perera",
          phone: "0771234567",
          referralCode: "REF-SUNIL7",
          referralCount: 9,
          referralPointsEarned: 900,
          loyaltyTier: "GOLD",
          loyaltyPoints: 1240,
        },
        {
          _id: "demo_ref_2",
          name: "Anoma Silva",
          phone: "0719876543",
          referralCode: "REF-ANOMA2",
          referralCount: 6,
          referralPointsEarned: 600,
          loyaltyTier: "SILVER",
          loyaltyPoints: 780,
        },
        {
          _id: "demo_ref_3",
          name: "Kamal Gunaratne",
          phone: "0765551234",
          referralCode: "REF-KAMAL9",
          referralCount: 4,
          referralPointsEarned: 400,
          loyaltyTier: "REGULAR",
          loyaltyPoints: 340,
        },
      ],
      recentReferees: [
        {
          _id: "demo_referee_1",
          name: "Priyantha Kumara",
          phone: "0778889999",
          referralCode: "REF-PRIYA1",
          referrerName: "Sunil Perera",
          referrerPhone: "0771234567",
          referrerCode: "REF-SUNIL7",
          totalSpent: 4250,
          visitCount: 2,
          hasCompletedOrder: true,
          joinedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          _id: "demo_referee_2",
          name: "Chathurika Fernando",
          phone: "0723334444",
          referralCode: "REF-CHATH4",
          referrerName: "Anoma Silva",
          referrerPhone: "0719876543",
          referrerCode: "REF-ANOMA2",
          totalSpent: 1200,
          visitCount: 1,
          hasCompletedOrder: true,
          joinedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load referral statistics";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireAuth();
    const body = await req.json();
    const { refereeCustomerId, referralCode } = body;

    if (!refereeCustomerId || !referralCode) {
      return NextResponse.json(
        { success: false, error: "Referee customer ID and referral code are required." },
        { status: 400 }
      );
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const referee = await Customer.findOne({
        _id: refereeCustomerId,
        businessId: context.businessId,
      });

      if (!referee) {
        return NextResponse.json({ success: false, error: "Customer not found." }, { status: 404 });
      }

      if (referee.referredBy) {
        return NextResponse.json(
          { success: false, error: "This customer has already been linked to a referrer." },
          { status: 400 }
        );
      }

      const referrer = await Customer.findOne({
        businessId: context.businessId,
        referralCode: referralCode.trim().toUpperCase(),
        _id: { $ne: referee._id },
      });

      if (!referrer) {
        return NextResponse.json(
          { success: false, error: `Referral code "${referralCode}" was not found.` },
          { status: 404 }
        );
      }

      referee.referredBy = referrer._id;
      await referee.save();

      return NextResponse.json({
        success: true,
        message: `Successfully linked ${referee.name} to referrer ${referrer.name}. Rewards will be credited upon first purchase.`,
        referrer: { name: referrer.name, code: referrer.referralCode },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Demo Mode: Referral code linked successfully",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to link referral code";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
