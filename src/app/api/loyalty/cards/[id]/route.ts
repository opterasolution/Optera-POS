import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Customer, generateReferralCode, generatePortalToken } from "@/models/Customer";
import { Business, ILoyaltySettings } from "@/models/Business";
import { defaultTiers } from "../../tiers/route";
import { Types } from "mongoose";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const customerIdentifier = params.id?.trim();

    if (!customerIdentifier) {
      return NextResponse.json({ success: false, error: "Customer identifier is required" }, { status: 400 });
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      // Find by _id or portalToken or phone or referralCode
      let query: any;
      if (Types.ObjectId.isValid(customerIdentifier)) {
        query = { _id: new Types.ObjectId(customerIdentifier) };
      } else {
        query = {
          $or: [
            { portalToken: customerIdentifier },
            { referralCode: customerIdentifier.toUpperCase() },
            { phone: customerIdentifier },
          ],
        };
      }

      const customer = await Customer.findOne(query);
      if (!customer) {
        return NextResponse.json({ success: false, error: "Customer VIP membership card not found" }, { status: 404 });
      }

      // Backfill referralCode, portalToken, and card date if missing
      let saveNeeded = false;
      if (!customer.portalToken) {
        customer.portalToken = generatePortalToken();
        saveNeeded = true;
      }
      if (!customer.referralCode) {
        customer.referralCode = generateReferralCode();
        saveNeeded = true;
      }
      if (!customer.vipCardIssuedAt) {
        customer.vipCardIssuedAt = new Date();
        saveNeeded = true;
      }
      if (saveNeeded) {
        await customer.save();
      }

      const business = await Business.findById(customer.businessId).lean();
      const loyaltySettings = (business?.loyaltySettings || {}) as ILoyaltySettings;
      const tiers = loyaltySettings.tiers && loyaltySettings.tiers.length > 0
        ? loyaltySettings.tiers
        : defaultTiers;

      const currentTierStr = customer.loyaltyTier || "REGULAR";
      const currentTierObj = tiers.find((t: any) => t.tier === currentTierStr) || defaultTiers[0];

      // Calculate Next Tier Progression
      const totalSpent = customer.totalSpent || 0;
      let nextTierObj: any = null;
      let amountNeeded = 0;
      let progressPercent = 100;

      if (currentTierStr === "REGULAR") {
        nextTierObj = tiers.find((t: any) => t.tier === "SILVER") || defaultTiers[1];
      } else if (currentTierStr === "SILVER") {
        nextTierObj = tiers.find((t: any) => t.tier === "GOLD") || defaultTiers[2];
      } else if (currentTierStr === "GOLD") {
        nextTierObj = tiers.find((t: any) => t.tier === "PLATINUM") || defaultTiers[3];
      } else {
        nextTierObj = null; // Already max tier
      }

      if (nextTierObj) {
        const threshold = nextTierObj.minSpend;
        amountNeeded = Math.max(0, threshold - totalSpent);
        const prevMin = currentTierObj.minSpend || 0;
        const tierSpan = threshold - prevMin;
        const earnedInTier = Math.max(0, totalSpent - prevMin);
        progressPercent = Math.min(100, Math.max(0, Math.round((earnedInTier / (tierSpan || 1)) * 100)));
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://pos.srilanka.lk";
      const portalUrl = `${baseUrl}/portal/statement/${customer.portalToken}`;
      const inviteText = `Hi! I invite you to shop at ${business?.name || "our favorite store"}. Use my referral code *${customer.referralCode}* on your first order to get 50 bonus loyalty reward points! Check out the store portal here: ${portalUrl}`;
      const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(inviteText)}`;

      // Scannable QR payload: format recognized by counter POS scanner
      const qrPayload = `LOYALTY:${customer.phone}:${customer.referralCode}:${customer._id}`;

      return NextResponse.json({
        success: true,
        card: {
          customer: {
            _id: customer._id,
            name: customer.name,
            phone: customer.phone,
            email: customer.email,
            customerType: customer.customerType || "RETAIL",
            joinedAt: customer.createdAt,
            vipCardIssuedAt: customer.vipCardIssuedAt || customer.createdAt,
            portalToken: customer.portalToken,
            portalUrl,
          },
          loyalty: {
            tier: currentTierStr,
            tierName: currentTierObj.name,
            tierMultiplier: currentTierObj.multiplier || 1.0,
            tierColor: currentTierObj.color || "#64748B",
            perks: currentTierObj.perks || [],
            points: customer.loyaltyPoints || 0,
            monetaryEquivalent: (customer.loyaltyPoints || 0) * (loyaltySettings.redemptionRate || 1),
            lifetimePointsEarned: customer.lifetimePointsEarned || 0,
            lifetimePointsRedeemed: customer.lifetimePointsRedeemed || 0,
            totalSpent,
          },
          progression: {
            currentTier: currentTierStr,
            nextTier: nextTierObj ? nextTierObj.tier : null,
            nextTierName: nextTierObj ? nextTierObj.name : "Elite Achieved",
            nextTierMultiplier: nextTierObj ? nextTierObj.multiplier : currentTierObj.multiplier,
            nextTierSpendThreshold: nextTierObj ? nextTierObj.minSpend : totalSpent,
            amountNeeded,
            progressPercent,
          },
          referral: {
            referralCode: customer.referralCode,
            referralCount: customer.referralCount || 0,
            referralPointsEarned: customer.referralPointsEarned || 0,
            referrerRewardPoints: loyaltySettings.referralSettings?.referrerRewardPoints ?? 100,
            refereeRewardPoints: loyaltySettings.referralSettings?.refereeRewardPoints ?? 50,
            whatsappShareUrl,
            inviteMessage: inviteText,
          },
          qrPayload,
          business: {
            name: business?.name || "Sri Lanka POS Store",
            phone: business?.phone || "",
            address: business?.address || "",
            logo: business?.logo,
            currency: business?.currency || "LKR",
          },
        },
      });
    }

    // Demo Mode Fallback
    return NextResponse.json({
      success: true,
      card: {
        customer: {
          _id: "demo_cust_vip_1",
          name: "Sunil Perera",
          phone: "0771234567",
          email: "sunil.perera@gmail.com",
          customerType: "RETAIL",
          joinedAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
          vipCardIssuedAt: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000).toISOString(),
          portalToken: "demo_portal_token_sunil",
          portalUrl: "https://pos.srilanka.lk/portal/statement/demo_portal_token_sunil",
        },
        loyalty: {
          tier: "GOLD",
          tierName: "Gold VIP",
          tierMultiplier: 1.5,
          tierColor: "#F59E0B",
          perks: ["1.50x Points Multiplier", "Free Delivery on Orders > Rs. 5,000", "Wholesale Pricing Access"],
          points: 1240,
          monetaryEquivalent: 1240,
          lifetimePointsEarned: 2450,
          lifetimePointsRedeemed: 1210,
          totalSpent: 92450,
        },
        progression: {
          currentTier: "GOLD",
          nextTier: "PLATINUM",
          nextTierName: "Platinum Elite",
          nextTierMultiplier: 2.0,
          nextTierSpendThreshold: 150000,
          amountNeeded: 57550,
          progressPercent: 62,
        },
        referral: {
          referralCode: "REF-SUNIL7",
          referralCount: 9,
          referralPointsEarned: 900,
          referrerRewardPoints: 100,
          refereeRewardPoints: 50,
          whatsappShareUrl: "https://wa.me/?text=Join%20me%20at%20Kandy%20Super%20Grocers!%20Use%20my%20code%20REF-SUNIL7",
          inviteMessage: "Join me at Kandy Super Grocers! Use my code REF-SUNIL7 for 50 bonus loyalty points.",
        },
        qrPayload: "LOYALTY:0771234567:REF-SUNIL7:demo_cust_vip_1",
        business: {
          name: "Kandy Super Grocers",
          phone: "0771234567",
          address: "No. 45, Peradeniya Road, Kandy",
          currency: "LKR",
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load digital VIP membership card";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
