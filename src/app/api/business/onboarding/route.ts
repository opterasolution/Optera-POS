import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/db";
import { Business } from "@/models/Business";
import { User } from "@/models/User";
import { Product } from "@/models/Product";
import { Category } from "@/models/Category";
import { AuditLog } from "@/models/AuditLog";
import { requireRole } from "@/lib/tenant";

export async function GET() {
  try {
    const context = await requireRole(["OWNER"]);

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const [business, productCount, categoryCount, userCount] = await Promise.all([
        Business.findById(context.businessId).lean(),
        Product.countDocuments({ businessId: context.businessId, isActive: true }),
        Category.countDocuments({ businessId: context.businessId, isActive: true }),
        User.countDocuments({ businessId: context.businessId }),
      ]);

      if (!business) {
        return NextResponse.json({ success: false, error: "Business not found." }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        business: {
          ...business,
          productCount: productCount || 0,
          categoryCount: categoryCount || 0,
          userCount: userCount || 1,
        },
      });
    }

    // Demo Mode fallback
    return NextResponse.json({
      success: true,
      business: {
        _id: context.businessId,
        name: "Lanka Super Mart",
        businessType: "Grocery & Retail",
        ownerName: context.username || "Store Owner",
        phone: "0771234567",
        address: "Colombo, Sri Lanka",
        currency: "LKR",
        onboardingCompleted: false,
        onboardingStep: 1,
        catalogPreset: "GROCERY",
        taxSettings: { enabled: false, name: "VAT", rate: 0, type: "INCLUSIVE" },
        receiptSettings: {
          headerMessage: "Thank you for shopping with us!",
          footerMessage: "Please come again!",
          showLogo: false,
          defaultWidth: "58mm",
        },
        productCount: 8,
        categoryCount: 6,
        userCount: 1,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load onboarding status";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function PUT(req: Request) {
  try {
    const context = await requireRole(["OWNER"]);
    const body = await req.json();

    const {
      name,
      businessType,
      phone,
      address,
      taxSettings,
      receiptSettings,
      onboardingCompleted,
      onboardingStep,
      firstCashier,
    } = body;

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const updateData: Record<string, any> = {};

      if (name) updateData.name = name.trim();
      if (businessType) updateData.businessType = businessType.trim();
      if (phone) updateData.phone = phone.trim();
      if (address !== undefined) updateData.address = address.trim();
      if (taxSettings) updateData.taxSettings = taxSettings;
      if (receiptSettings) updateData.receiptSettings = receiptSettings;
      if (typeof onboardingCompleted === "boolean") updateData.onboardingCompleted = onboardingCompleted;
      if (typeof onboardingStep === "number") updateData.onboardingStep = onboardingStep;

      const updatedBusiness = await Business.findByIdAndUpdate(
        context.businessId,
        { $set: updateData },
        { new: true }
      );

      // If owner chose to create their first counter cashier account during onboarding
      let createdCashier = null;
      if (
        firstCashier &&
        firstCashier.name?.trim() &&
        firstCashier.username?.trim() &&
        firstCashier.password?.trim()
      ) {
        const cashierUsername = firstCashier.username.toLowerCase().trim();
        const existing = await User.findOne({ username: cashierUsername });
        if (!existing) {
          const hashed = await bcrypt.hash(firstCashier.password, 10);
          createdCashier = await User.create({
            businessId: context.businessId,
            name: firstCashier.name.trim(),
            username: cashierUsername,
            password: hashed,
            role: "CASHIER",
            phone: firstCashier.phone?.trim() || undefined,
            isActive: true,
          });
        }
      }

      // Record Audit Log Entry
      await AuditLog.create({
        businessId: context.businessId,
        userId: context.userId,
        userName: context.username,
        action: onboardingCompleted ? "ONBOARDING_COMPLETED" : "ONBOARDING_UPDATED",
        entityType: "Business",
        entityId: context.businessId,
        details: {
          onboardingCompleted,
          onboardingStep,
          cashierCreated: Boolean(createdCashier),
        },
      });

      return NextResponse.json({
        success: true,
        message: onboardingCompleted
          ? "Store setup completed successfully! Launching your POS..."
          : "Setup progress saved.",
        business: updatedBusiness,
        cashierCreated: Boolean(createdCashier),
      });
    }

    // Demo Mode fallback
    return NextResponse.json({
      success: true,
      message: "Setup completed successfully (Demo Mode)!",
      business: {
        _id: context.businessId,
        name: name || "Lanka Super Mart",
        onboardingCompleted: true,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update onboarding progress";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
