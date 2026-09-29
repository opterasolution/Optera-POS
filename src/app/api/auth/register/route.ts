import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/db";
import { Business } from "@/models/Business";
import { User } from "@/models/User";
import { AuditLog } from "@/models/AuditLog";
import { registerBusinessSchema } from "@/lib/validations/auth";
import { seedBusinessCatalog } from "@/lib/catalog-presets";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const parsed = registerBusinessSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const {
      businessName,
      businessType,
      catalogPreset,
      ownerName,
      phone,
      email,
      address,
      username,
      password,
    } = parsed.data;

    const normalizedUsername = username.toLowerCase().trim();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      // Check for duplicate username
      const existingUser = await User.findOne({ username: normalizedUsername });
      if (existingUser) {
        return NextResponse.json(
          {
            success: false,
            error: `Username "${normalizedUsername}" is already taken. Please choose a different login name.`,
          },
          { status: 409 }
        );
      }

      // 1. Create Business Document with 14-day free trial
      const expiryDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      const business = await Business.create({
        name: businessName,
        businessType: businessType || "Grocery & Retail",
        ownerName,
        phone,
        email: email || undefined,
        address: address || undefined,
        currency: "LKR",
        subscription: {
          plan: "TRIAL",
          status: "ACTIVE",
          startDate: new Date(),
          expiryDate,
          maxProducts: 500,
          maxUsers: 3,
        },
        taxSettings: {
          enabled: false,
          name: "VAT",
          rate: 0,
          type: "INCLUSIVE",
        },
        receiptSettings: {
          headerMessage: `Welcome to ${businessName}!`,
          footerMessage: "Thank you for shopping with us! Please come again.",
          showLogo: false,
          defaultWidth: "58mm",
        },
        onboardingCompleted: false,
        onboardingStep: 1,
        catalogPreset: catalogPreset || "GROCERY",
        isActive: true,
      });

      // 2. Create Owner User
      const hashedPassword = await bcrypt.hash(password, 10);
      const ownerUser = await User.create({
        businessId: business._id,
        name: ownerName,
        username: normalizedUsername,
        password: hashedPassword,
        role: "OWNER",
        phone,
        isActive: true,
      });

      // 3. Seed Industry Catalog Preset
      try {
        await seedBusinessCatalog(business._id, catalogPreset || "GROCERY");
      } catch (seedErr) {
        console.error("Warning: Catalog seeding encountered an error:", seedErr);
      }

      // 4. Record Audit Log Entry
      try {
        await AuditLog.create({
          businessId: business._id,
          userId: ownerUser._id,
          userName: ownerUser.name,
          action: "BUSINESS_SELF_REGISTERED",
          entityType: "Business",
          entityId: business._id,
          details: {
            businessName,
            plan: "TRIAL",
            trialDurationDays: 14,
            preset: catalogPreset,
            phone,
          },
        });
      } catch (auditErr) {
        console.error("Warning: Audit log creation encountered an error:", auditErr);
      }

      return NextResponse.json(
        {
          success: true,
          message: `Welcome to Sri Lanka POS Cloud! "${businessName}" is ready for onboarding.`,
          businessId: business._id.toString(),
          username: ownerUser.username,
        },
        { status: 201 }
      );
    }

    // Demo Mode fallback
    return NextResponse.json(
      {
        success: true,
        message: `Welcome to Sri Lanka POS Cloud! "${businessName}" is ready (Demo Mode).`,
        businessId: `demo_biz_${Date.now()}`,
        username: normalizedUsername,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to register business";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
