import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { GiftVoucher } from "@/models/GiftVoucher";
import { Customer } from "@/models/Customer";
import { Business } from "@/models/Business";
import { requireAuth, verifyActiveSubscription } from "@/lib/tenant";
import { dispatchSms } from "@/lib/sms";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const context = await requireAuth();
    await verifyActiveSubscription(context.businessId);

    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code")?.trim().toUpperCase();
    const q = searchParams.get("q")?.trim() || "";
    const status = searchParams.get("status")?.trim();
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const skip = (page - 1) * limit;

    await connectToDatabase();
    const businessId = context.businessId;

    // Check for expired active vouchers and update them
    await GiftVoucher.updateMany(
      {
        businessId,
        status: "ACTIVE",
        expiryDate: { $lt: new Date() },
      },
      {
        $set: { status: "EXPIRED" },
      }
    );

    // Direct lookup by code (used by POS cashier during checkout)
    if (code) {
      const voucher = await GiftVoucher.findOne({
        businessId,
        code,
      }).lean();

      if (!voucher) {
        return NextResponse.json({
          success: false,
          valid: false,
          error: `Gift Voucher "${code}" not found.`,
        });
      }

      if (voucher.status === "EXPIRED" || (voucher.expiryDate && new Date(voucher.expiryDate) < new Date())) {
        return NextResponse.json({
          success: false,
          valid: false,
          error: `Gift Voucher "${voucher.code}" expired on ${new Date(voucher.expiryDate!).toLocaleDateString("en-LK")}.`,
          voucher,
        });
      }

      if (voucher.status === "CANCELLED") {
        return NextResponse.json({
          success: false,
          valid: false,
          error: `Gift Voucher "${voucher.code}" has been cancelled.`,
          voucher,
        });
      }

      if (voucher.status === "REDEEMED" || voucher.currentBalance <= 0) {
        return NextResponse.json({
          success: false,
          valid: false,
          error: `Gift Voucher "${voucher.code}" has no remaining balance.`,
          voucher,
        });
      }

      return NextResponse.json({
        success: true,
        valid: true,
        voucher,
      });
    }

    // Filtered list
    const query: any = { businessId };

    if (status && status !== "ALL") {
      query.status = status;
    }

    if (q) {
      query.$or = [
        { code: { $regex: q, $options: "i" } },
        { recipientName: { $regex: q, $options: "i" } },
        { recipientPhone: { $regex: q, $options: "i" } },
        { customerName: { $regex: q, $options: "i" } },
        { customerPhone: { $regex: q, $options: "i" } },
      ];
    }

    const [vouchers, total] = await Promise.all([
      GiftVoucher.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      GiftVoucher.countDocuments(query),
    ]);

    // Aggregate statistics across all business vouchers
    const allVouchers = await GiftVoucher.find({ businessId }).lean();
    let activeCount = 0;
    let activeBalanceTotal = 0;
    let redeemedTotal = 0;
    let expiredCount = 0;

    for (const v of allVouchers) {
      if (v.status === "ACTIVE") {
        activeCount++;
        activeBalanceTotal += v.currentBalance || 0;
      } else if (v.status === "EXPIRED") {
        expiredCount++;
      }

      if (v.redemptionHistory && Array.isArray(v.redemptionHistory)) {
        for (const red of v.redemptionHistory) {
          redeemedTotal += red.amount || 0;
        }
      }
    }

    return NextResponse.json({
      success: true,
      vouchers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        totalIssuedCount: allVouchers.length,
        activeCount,
        activeBalanceTotal: Math.round(activeBalanceTotal * 100) / 100,
        redeemedTotal: Math.round(redeemedTotal * 100) / 100,
        expiredCount,
      },
    });
  } catch (error: any) {
    console.error("GET /api/gift-vouchers error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch gift vouchers" },
      { status: error.status || 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireAuth();
    await verifyActiveSubscription(context.businessId);

    const body = await req.json();
    const {
      initialAmount,
      recipientName,
      recipientPhone,
      customerId,
      customerName,
      customerPhone,
      expiryDate,
      notes,
    } = body;

    const amount = Number(initialAmount);
    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid gift voucher amount greater than 0." },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const businessId = context.businessId;

    // Generate unique sequential voucher code: GV-YYYYMMDD-XXXX
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
    const count = await GiftVoucher.countDocuments({ businessId });
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const code = `GV-${dateStr}-${String(count + 1).padStart(2, "0")}${randomSuffix.toString().slice(-2)}`;

    // Expiry date defaults to 1 year if not specified
    let finalExpiry = expiryDate ? new Date(expiryDate) : new Date();
    if (!expiryDate) {
      finalExpiry.setFullYear(finalExpiry.getFullYear() + 1);
    }

    // Resolve customer if customerId passed
    let resolvedCustomerName = customerName;
    let resolvedCustomerPhone = customerPhone;
    if (customerId) {
      const cust = await Customer.findOne({ _id: customerId, businessId });
      if (cust) {
        resolvedCustomerName = cust.name;
        resolvedCustomerPhone = cust.phone;
      }
    }

    const voucher = await GiftVoucher.create({
      businessId,
      code,
      initialAmount: Math.round(amount * 100) / 100,
      currentBalance: Math.round(amount * 100) / 100,
      status: "ACTIVE",
      customerId: customerId || undefined,
      customerName: resolvedCustomerName || undefined,
      customerPhone: resolvedCustomerPhone || undefined,
      recipientName: recipientName?.trim() || undefined,
      recipientPhone: recipientPhone?.trim() || undefined,
      notes: notes?.trim() || undefined,
      expiryDate: finalExpiry,
      issuedBy: context.userId,
      issuedByName: context.username || "Manager",
      redemptionHistory: [],
    });

    // Trigger SMS delivery of digital gift voucher code
    const targetPhone = voucher.recipientPhone || voucher.customerPhone;
    if (targetPhone) {
      try {
        const businessDoc = await Business.findById(businessId).lean();
        await dispatchSms({
          businessId,
          recipientPhone: targetPhone,
          recipientName: voucher.recipientName || voucher.customerName || "Valued Customer",
          customerId: voucher.customerId,
          eventType: "GIFT_VOUCHER",
          templateKey: "giftVoucher",
          variables: {
            recipientName: voucher.recipientName || voucher.customerName || "Valued Customer",
            customerName: voucher.recipientName || voucher.customerName || "Valued Customer",
            code: voucher.code,
            amount: voucher.initialAmount.toLocaleString(),
            expiryDate: voucher.expiryDate ? new Date(voucher.expiryDate).toLocaleDateString() : "No expiry",
            dueDate: voucher.expiryDate ? new Date(voucher.expiryDate).toLocaleDateString() : "No expiry",
            storeName: (businessDoc as any)?.name || "Our Store",
            voucherUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://pos.srilanka.lk"}/portal`,
          },
          metadata: { voucherCode: voucher.code, voucherId: voucher._id.toString() },
        });
      } catch (smsErr) {
        console.error("Gift voucher SMS trigger failed:", smsErr);
      }
    }

    return NextResponse.json({
      success: true,
      voucher,
      message: `Gift voucher ${voucher.code} created successfully with balance Rs. ${voucher.initialAmount.toLocaleString()}.`,
    });
  } catch (error: any) {
    console.error("POST /api/gift-vouchers error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create gift voucher" },
      { status: error.status || 500 }
    );
  }
}
