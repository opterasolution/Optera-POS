import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Customer } from "@/models/Customer";
import { LoyaltyTransaction } from "@/models/LoyaltyTransaction";
import { requireAuth, verifyActiveSubscription } from "@/lib/tenant";
import { Types } from "mongoose";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const context = await requireAuth();
    await verifyActiveSubscription(context.businessId);

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId")?.trim();
    const type = searchParams.get("type")?.trim();
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "30", 10);
    const skip = (page - 1) * limit;

    await connectToDatabase();
    const businessId = context.businessId;

    const query: any = { businessId };
    if (customerId && Types.ObjectId.isValid(customerId)) {
      query.customerId = new Types.ObjectId(customerId);
    }
    if (type && type !== "ALL") {
      query.type = type;
    }

    const [transactions, total, customer] = await Promise.all([
      LoyaltyTransaction.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      LoyaltyTransaction.countDocuments(query),
      customerId && Types.ObjectId.isValid(customerId)
        ? Customer.findOne({ _id: customerId, businessId }).lean()
        : null,
    ]);

    return NextResponse.json({
      success: true,
      transactions,
      customer,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("GET /api/loyalty/transactions error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch loyalty transactions" },
      { status: error.status || 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireAuth();
    await verifyActiveSubscription(context.businessId);

    const body = await req.json();
    const { customerId, points, notes, description } = body;

    if (!customerId || !Types.ObjectId.isValid(customerId)) {
      return NextResponse.json(
        { success: false, error: "A valid Customer ID is required." },
        { status: 400 }
      );
    }

    const pointsNum = Number(points);
    if (!pointsNum || isNaN(pointsNum)) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid non-zero points adjustment value." },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const businessId = context.businessId;

    const customer = await Customer.findOne({ _id: customerId, businessId });
    if (!customer) {
      return NextResponse.json(
        { success: false, error: "Customer not found." },
        { status: 404 }
      );
    }

    const pointsBefore = customer.loyaltyPoints || 0;
    const pointsAfter = pointsBefore + pointsNum;

    if (pointsAfter < 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot deduct ${Math.abs(pointsNum)} points. Customer only has ${pointsBefore} points.`,
        },
        { status: 400 }
      );
    }

    // Update customer points
    customer.loyaltyPoints = pointsAfter;
    if (pointsNum > 0) {
      customer.lifetimePointsEarned = (customer.lifetimePointsEarned || 0) + pointsNum;
    } else {
      customer.lifetimePointsRedeemed = (customer.lifetimePointsRedeemed || 0) + Math.abs(pointsNum);
    }

    // Check & update tier based on total spent
    const spent = customer.totalSpent || 0;
    if (spent >= 150000) {
      customer.loyaltyTier = "PLATINUM";
    } else if (spent >= 75000) {
      customer.loyaltyTier = "GOLD";
    } else if (spent >= 25000) {
      customer.loyaltyTier = "SILVER";
    } else {
      customer.loyaltyTier = "REGULAR";
    }

    await customer.save();

    // Create audit log ledger entry
    const desc =
      description ||
      notes ||
      (pointsNum > 0
        ? `Manual credit of +${pointsNum} points by ${context.username || "Manager"}`
        : `Manual deduction of ${pointsNum} points by ${context.username || "Manager"}`);

    const transaction = await LoyaltyTransaction.create({
      businessId,
      customerId: customer._id,
      type: "ADJUST",
      points: pointsNum,
      pointsBefore,
      pointsAfter,
      description: desc,
      notes: notes?.trim() || undefined,
      performedBy: context.userId,
      performedByName: context.username || "Manager",
    });

    return NextResponse.json({
      success: true,
      transaction,
      customer,
      message: `Adjusted points by ${pointsNum > 0 ? "+" : ""}${pointsNum}. New balance is ${pointsAfter} pts.`,
    });
  } catch (error: any) {
    console.error("POST /api/loyalty/transactions error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to adjust loyalty points" },
      { status: error.status || 500 }
    );
  }
}
