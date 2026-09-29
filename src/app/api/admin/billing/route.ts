import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Business } from "@/models/Business";
import { SubscriptionInvoice } from "@/models/SubscriptionInvoice";
import { AuditLog } from "@/models/AuditLog";
import { requireSuperAdmin } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    await requireSuperAdmin();

    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get("businessId");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const query: any = {};
      if (businessId) query.businessId = businessId;
      if (status && status !== "ALL") query.status = status;
      if (search) {
        query.$or = [
          { invoiceNumber: { $regex: search, $options: "i" } },
          { businessName: { $regex: search, $options: "i" } },
          { ownerName: { $regex: search, $options: "i" } },
          { paymentReference: { $regex: search, $options: "i" } },
        ];
      }

      const now = new Date();
      const in14Days = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [invoices, totalStats, thisMonthStats, upcomingExpirations, activePayingCount] =
        await Promise.all([
          SubscriptionInvoice.find(query).sort({ createdAt: -1 }).limit(100),
          SubscriptionInvoice.aggregate([
            { $match: { status: "PAID" } },
            { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
          ]),
          SubscriptionInvoice.aggregate([
            {
              $match: {
                status: "PAID",
                paidAt: { $gte: startOfMonth },
              },
            },
            { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
          ]),
          Business.find({
            "subscription.expiryDate": { $gte: now, $lte: in14Days },
            isActive: true,
          })
            .select("name ownerName phone subscription")
            .sort({ "subscription.expiryDate": 1 })
            .limit(10),
          Business.countDocuments({
            "subscription.status": "ACTIVE",
            "subscription.plan": { $ne: "TRIAL" },
          }),
        ]);

      // Method breakdown
      const methodStats = await SubscriptionInvoice.aggregate([
        { $match: { status: "PAID" } },
        { $group: { _id: "$paymentMethod", total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]);

      return NextResponse.json({
        success: true,
        invoices,
        summary: {
          totalCollected: totalStats[0]?.total || 0,
          totalInvoicesCount: totalStats[0]?.count || 0,
          thisMonthCollected: thisMonthStats[0]?.total || 0,
          thisMonthCount: thisMonthStats[0]?.count || 0,
          activePayingShops: activePayingCount,
          upcomingExpirations,
          methodStats,
        },
      });
    }

    // Demo Mode mock response
    const mockInvoices = [
      {
        _id: "demo_inv_001",
        invoiceNumber: "SUB-2026-0001",
        businessId: "demo_biz_001",
        businessName: "Lanka Super Mart (Client Shop)",
        ownerName: "Sunil Perera",
        phone: "0771234567",
        plan: "PROFESSIONAL",
        billingCycle: "ANNUAL",
        durationMonths: 12,
        amount: 75000,
        discountAmount: 15000,
        paymentMethod: "BANK_TRANSFER",
        paymentReference: "COMM-TXN-984210",
        bankName: "Commercial Bank of Ceylon",
        periodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        periodEnd: new Date(Date.now() + 335 * 24 * 60 * 60 * 1000).toISOString(),
        status: "PAID",
        paidAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        notes: "Annual renewal prepay - 2 months discount applied",
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        _id: "demo_inv_002",
        invoiceNumber: "SUB-2026-0002",
        businessId: "demo_biz_002",
        businessName: "Perera & Sons Grocery - Negombo",
        ownerName: "Chaminda Silva",
        phone: "0719876543",
        plan: "BASIC",
        billingCycle: "MONTHLY",
        durationMonths: 1,
        amount: 3500,
        discountAmount: 0,
        paymentMethod: "CASH",
        paymentReference: "REC-CASH-441",
        periodStart: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        periodEnd: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
        status: "PAID",
        paidAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        notes: "Monthly counter subscription collected in cash",
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    return NextResponse.json({
      success: true,
      invoices: mockInvoices,
      summary: {
        totalCollected: 78500,
        totalInvoicesCount: 2,
        thisMonthCollected: 78500,
        thisMonthCount: 2,
        activePayingShops: 2,
        upcomingExpirations: [
          {
            _id: "demo_biz_003",
            name: "Kandy Hillside Organics",
            ownerName: "Upul Jayasuriya",
            phone: "0785551234",
            subscription: {
              plan: "TRIAL",
              status: "TRIAL",
              expiryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
            },
          },
        ],
        methodStats: [
          { _id: "BANK_TRANSFER", total: 75000, count: 1 },
          { _id: "CASH", total: 3500, count: 1 },
        ],
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load billing records";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const superAdmin = await requireSuperAdmin();
    const body = await req.json();

    const {
      businessId,
      plan = "BASIC",
      billingCycle = "MONTHLY",
      durationMonths = 1,
      amount,
      discountAmount = 0,
      taxAmount = 0,
      paymentMethod = "BANK_TRANSFER",
      paymentReference,
      bankName,
      paymentDate,
      notes,
      autoExtendLicense = true,
      customExpiryDate,
    } = body;

    if (!businessId) {
      return NextResponse.json(
        { success: false, error: "Business ID is required." },
        { status: 400 }
      );
    }

    if (amount === undefined || amount === null || isNaN(Number(amount)) || Number(amount) < 0) {
      return NextResponse.json(
        { success: false, error: "A valid payment amount (LKR) is required." },
        { status: 400 }
      );
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const business = await Business.findById(businessId);
      if (!business) {
        return NextResponse.json(
          { success: false, error: "Client business not found." },
          { status: 404 }
        );
      }

      // Generate next sequential invoice number: SUB-YYYY-XXXX
      const currentYear = new Date().getFullYear();
      const countThisYear = await SubscriptionInvoice.countDocuments({
        invoiceNumber: { $regex: `^SUB-${currentYear}-` },
      });
      const invoiceNumber = `SUB-${currentYear}-${String(countThisYear + 1).padStart(4, "0")}`;

      // Calculate service dates
      const payDate = paymentDate ? new Date(paymentDate) : new Date();
      let periodStart = payDate;
      const currentExpiry = business.subscription?.expiryDate ? new Date(business.subscription.expiryDate) : null;

      // If business has an active expiry date in the future, chain onto it
      if (currentExpiry && currentExpiry > payDate && business.subscription?.status === "ACTIVE") {
        periodStart = currentExpiry;
      }

      // Calculate periodEnd based on durationMonths or customExpiryDate
      let periodEnd: Date;
      if (customExpiryDate) {
        periodEnd = new Date(customExpiryDate);
      } else {
        periodEnd = new Date(periodStart);
        periodEnd.setMonth(periodEnd.getMonth() + Number(durationMonths));
      }

      // 1. Create Subscription Invoice record
      const invoice = await SubscriptionInvoice.create({
        invoiceNumber,
        businessId: business._id,
        businessName: business.name,
        ownerName: business.ownerName,
        phone: business.phone,
        email: business.email,
        address: business.address,
        plan,
        billingCycle,
        durationMonths: Number(durationMonths),
        amount: Number(amount),
        discountAmount: Number(discountAmount) || 0,
        taxAmount: Number(taxAmount) || 0,
        paymentMethod,
        paymentReference: paymentReference?.trim() || undefined,
        bankName: bankName?.trim() || undefined,
        periodStart,
        periodEnd,
        status: "PAID",
        issuedAt: new Date(),
        paidAt: payDate,
        notes: notes?.trim() || undefined,
        createdById: superAdmin.userId,
        createdByName: superAdmin.username,
      });

      // 2. Automatically update business license subscription
      if (autoExtendLicense) {
        const quotaLimits: Record<string, { maxProducts: number; maxUsers: number }> = {
          BASIC: { maxProducts: 500, maxUsers: 3 },
          PROFESSIONAL: { maxProducts: 2000, maxUsers: 10 },
          ENTERPRISE: { maxProducts: 10000, maxUsers: 50 },
        };

        const limits = quotaLimits[plan] || { maxProducts: 500, maxUsers: 3 };

        business.subscription.plan = plan;
        business.subscription.status = "ACTIVE";
        business.subscription.expiryDate = periodEnd;
        business.subscription.maxProducts = limits.maxProducts;
        business.subscription.maxUsers = limits.maxUsers;
        business.isActive = true;

        await business.save();
      }

      // 3. Log Audit Trail
      await AuditLog.create({
        businessId: business._id,
        userId: superAdmin.userId,
        userName: superAdmin.username,
        action: "SUBSCRIPTION_PAYMENT_RECORDED",
        entityType: "SubscriptionInvoice",
        entityId: invoice._id.toString(),
        details: {
          invoiceNumber,
          businessName: business.name,
          plan,
          billingCycle,
          amount: Number(amount),
          paymentMethod,
          newExpiryDate: periodEnd.toISOString(),
        },
      });

      return NextResponse.json(
        {
          success: true,
          message: `Subscription payment recorded (${invoiceNumber}) and license extended until ${periodEnd.toLocaleDateString("en-GB")}.`,
          invoice,
          updatedSubscription: business.subscription,
        },
        { status: 201 }
      );
    }

    // Demo Mode fallback
    const currentYear = new Date().getFullYear();
    const demoInvoice = {
      _id: `demo_inv_${Date.now()}`,
      invoiceNumber: `SUB-${currentYear}-${Math.floor(1000 + Math.random() * 9000)}`,
      businessId,
      businessName: "Demo Store",
      ownerName: "Sunil Perera",
      phone: "0771234567",
      plan,
      billingCycle,
      durationMonths: Number(durationMonths),
      amount: Number(amount),
      discountAmount: Number(discountAmount) || 0,
      taxAmount: Number(taxAmount) || 0,
      paymentMethod,
      paymentReference,
      bankName,
      periodStart: new Date().toISOString(),
      periodEnd: new Date(Date.now() + Number(durationMonths) * 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: "PAID",
      paidAt: new Date().toISOString(),
      notes,
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json(
      {
        success: true,
        message: `Subscription payment recorded (${demoInvoice.invoiceNumber}).`,
        invoice: demoInvoice,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to record subscription payment";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
