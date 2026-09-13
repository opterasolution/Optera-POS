import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/db";
import { Business } from "@/models/Business";
import { User } from "@/models/User";
import { Product } from "@/models/Product";
import { Sale } from "@/models/Sale";
import { requireSuperAdmin } from "@/lib/tenant";
import { createClientBusinessSchema } from "@/lib/validations/admin";

export async function GET() {
  try {
    await requireSuperAdmin();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const businesses = await Business.find().sort({ createdAt: -1 }).lean();

      // Gather additional metrics for each business
      const enrichedBusinesses = await Promise.all(
        businesses.map(async (biz) => {
          const [owner, userCount, productCount, salesStats] = await Promise.all([
            User.findOne({ businessId: biz._id, role: "OWNER" }).select("name username phone").lean(),
            User.countDocuments({ businessId: biz._id }),
            Product.countDocuments({ businessId: biz._id, isActive: true }),
            Sale.aggregate([
              { $match: { businessId: biz._id } },
              { $group: { _id: null, totalSales: { $sum: "$netTotal" }, count: { $sum: 1 } } },
            ]),
          ]);

          return {
            ...biz,
            owner: owner || {
              name: biz.ownerName,
              username: "owner",
              phone: biz.phone,
            },
            userCount: userCount || 1,
            productCount: productCount || 0,
            totalSalesVolume: salesStats[0]?.totalSales || 0,
            totalTransactions: salesStats[0]?.count || 0,
          };
        })
      );

      return NextResponse.json({
        success: true,
        businesses: enrichedBusinesses,
      });
    }

    // Demo Mode fallback for presentation & testing
    return NextResponse.json({
      success: true,
      businesses: [
        {
          _id: "demo_biz_001",
          name: "Perera Super City",
          businessType: "Supermarket & Grocery",
          ownerName: "Sunil Perera",
          phone: "0771234567",
          email: "sunil@pererasuper.lk",
          address: "142 Galle Road, Colombo 03",
          currency: "LKR",
          subscription: {
            plan: "PROFESSIONAL",
            status: "ACTIVE",
            startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
            expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            maxProducts: 2000,
            maxUsers: 10,
          },
          owner: {
            name: "Sunil Perera",
            username: "perera_admin",
            phone: "0771234567",
          },
          isActive: true,
          userCount: 4,
          productCount: 145,
          totalSalesVolume: 2450000,
          totalTransactions: 312,
          createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          _id: "demo_biz_002",
          name: "Kandy Fresh Veggies & Fruits",
          businessType: "Grocery & Produce",
          ownerName: "Chaminda Bandara",
          phone: "0718889999",
          email: "chaminda@kandyfresh.lk",
          address: "88 Peradeniya Road, Kandy",
          currency: "LKR",
          subscription: {
            plan: "BASIC",
            status: "ACTIVE",
            startDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
            expiryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
            maxProducts: 500,
            maxUsers: 3,
          },
          owner: {
            name: "Chaminda Bandara",
            username: "chaminda_kandy",
            phone: "0718889999",
          },
          isActive: true,
          userCount: 2,
          productCount: 68,
          totalSalesVolume: 420000,
          totalTransactions: 98,
          createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          _id: "demo_biz_003",
          name: "Galle Fort Hardware & Electricals",
          businessType: "Hardware Mart",
          ownerName: "Mahinda Silva",
          phone: "0763334444",
          email: "info@gallehardware.lk",
          address: "45 Main Street, Galle",
          currency: "LKR",
          subscription: {
            plan: "TRIAL",
            status: "TRIAL",
            startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
            expiryDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
            maxProducts: 500,
            maxUsers: 5,
          },
          owner: {
            name: "Mahinda Silva",
            username: "mahinda_galle",
            phone: "0763334444",
          },
          isActive: true,
          userCount: 2,
          productCount: 112,
          totalSalesVolume: 890000,
          totalTransactions: 64,
          createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          _id: "demo_biz_004",
          name: "Jaffna Bookshop & Stationers",
          businessType: "Stationery & Books",
          ownerName: "K. Rajan",
          phone: "0774441122",
          email: "rajan@jaffnabooks.lk",
          address: "12 Hospital Road, Jaffna",
          currency: "LKR",
          subscription: {
            plan: "BASIC",
            status: "EXPIRED",
            startDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
            expiryDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            maxProducts: 500,
            maxUsers: 3,
          },
          owner: {
            name: "K. Rajan",
            username: "rajan_jaffna",
            phone: "0774441122",
          },
          isActive: true,
          userCount: 1,
          productCount: 84,
          totalSalesVolume: 310000,
          totalTransactions: 42,
          createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          _id: "demo_biz_005",
          name: "Negombo Coastal Pharmacy",
          businessType: "Pharmacy & Wellness",
          ownerName: "Dr. Dinesh Fernando",
          phone: "0759998877",
          email: "dinesh@negombopharm.lk",
          address: "201 Lewis Place, Negombo",
          currency: "LKR",
          subscription: {
            plan: "PROFESSIONAL",
            status: "SUSPENDED",
            startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
            expiryDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
            maxProducts: 2000,
            maxUsers: 8,
          },
          owner: {
            name: "Dr. Dinesh Fernando",
            username: "dinesh_pharm",
            phone: "0759998877",
          },
          isActive: false,
          userCount: 3,
          productCount: 220,
          totalSalesVolume: 1650000,
          totalTransactions: 195,
          createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch client businesses";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    await requireSuperAdmin();
    const body = await req.json();

    const parsed = createClientBusinessSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const {
      name,
      businessType,
      ownerName,
      ownerUsername,
      ownerPassword,
      phone,
      email,
      address,
      plan,
      durationDays,
    } = parsed.data;

    const expiryDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    const initialStatus = plan === "TRIAL" ? "TRIAL" : "ACTIVE";

    // Max limits based on plan
    const planLimits = {
      TRIAL: { maxProducts: 500, maxUsers: 3 },
      BASIC: { maxProducts: 1000, maxUsers: 5 },
      PROFESSIONAL: { maxProducts: 5000, maxUsers: 15 },
      ENTERPRISE: { maxProducts: 25000, maxUsers: 50 },
    };

    const limits = planLimits[plan] || planLimits.BASIC;

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      // Ensure owner username isn't taken globally
      const existingUser = await User.findOne({ username: ownerUsername.toLowerCase() });
      if (existingUser) {
        return NextResponse.json(
          { success: false, error: `Username "${ownerUsername}" is already taken by another account.` },
          { status: 409 }
        );
      }

      // 1. Create Business
      const business = await Business.create({
        name,
        businessType: businessType || "Grocery & Retail",
        ownerName,
        phone,
        email: email || undefined,
        address: address || undefined,
        currency: "LKR",
        subscription: {
          plan,
          status: initialStatus,
          startDate: new Date(),
          expiryDate,
          maxProducts: limits.maxProducts,
          maxUsers: limits.maxUsers,
        },
        taxSettings: {
          enabled: false,
          name: "VAT",
          rate: 0,
          type: "INCLUSIVE",
        },
        receiptSettings: {
          headerMessage: `Welcome to ${name}`,
          footerMessage: "Thank you for your patronage! Please visit again.",
          showLogo: false,
          defaultWidth: "58mm",
        },
        isActive: true,
      });

      // 2. Create Owner User
      const hashedPassword = await bcrypt.hash(ownerPassword, 10);
      const ownerUser = await User.create({
        businessId: business._id,
        name: ownerName,
        username: ownerUsername.toLowerCase(),
        password: hashedPassword,
        role: "OWNER",
        phone,
        isActive: true,
      });

      return NextResponse.json(
        {
          success: true,
          message: `Client business "${name}" successfully registered and provisioned!`,
          business: {
            _id: business._id,
            name: business.name,
            businessType: business.businessType,
            plan: business.subscription.plan,
            status: business.subscription.status,
            expiryDate: business.subscription.expiryDate,
            owner: {
              name: ownerUser.name,
              username: ownerUser.username,
              role: ownerUser.role,
            },
          },
        },
        { status: 201 }
      );
    }

    // Demo Mode mock response
    const mockId = `biz_${Date.now()}`;
    return NextResponse.json(
      {
        success: true,
        message: `Client business "${name}" created successfully (Demo Mode)!`,
        business: {
          _id: mockId,
          name,
          businessType: businessType || "Grocery & Retail",
          ownerName,
          phone,
          email,
          address,
          currency: "LKR",
          subscription: {
            plan,
            status: initialStatus,
            startDate: new Date().toISOString(),
            expiryDate: expiryDate.toISOString(),
            maxProducts: limits.maxProducts,
            maxUsers: limits.maxUsers,
          },
          owner: {
            name: ownerName,
            username: ownerUsername.toLowerCase(),
            role: "OWNER",
            phone,
          },
          userCount: 1,
          productCount: 0,
          totalSalesVolume: 0,
          totalTransactions: 0,
          isActive: true,
          createdAt: new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to register client business";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
