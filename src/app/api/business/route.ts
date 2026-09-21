import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Business } from "@/models/Business";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth, requireRole } from "@/lib/tenant";
import { businessSettingsSchema } from "@/lib/validations/business";

import { Product } from "@/models/Product";

// Default fallback settings for Demo / initial shop
const defaultBusinessData = {
  name: "Kandy Super Grocers",
  businessType: "Grocery & Retail",
  ownerName: "Shop Owner",
  phone: "0771234567",
  email: "owner@kandygrocers.lk",
  address: "No. 45, Peradeniya Road, Kandy",
  currency: "LKR",
  subscription: {
    plan: "BASIC" as const,
    status: "ACTIVE" as const,
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    expiryDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
    maxProducts: 1000,
    maxUsers: 5,
  },
  taxSettings: {
    enabled: false,
    name: "VAT",
    rate: 0,
    type: "INCLUSIVE" as const,
  },
  receiptSettings: {
    headerMessage: "Thank you for shopping at Kandy Super Grocers!",
    footerMessage: "Goods returnable within 3 days with receipt. Please come again!",
    showLogo: false,
    defaultWidth: "58mm" as const,
  },
};

export async function GET() {
  try {
    const context = await requireAuth();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const [business, productCount] = await Promise.all([
        Business.findById(context.businessId).lean(),
        Product.countDocuments({ businessId: context.businessId, isActive: true }),
      ]);

      if (business) {
        return NextResponse.json({
          success: true,
          business: {
            ...business,
            productCount: productCount || 0,
          },
        });
      }
    }

    // Return demo store data if DB not yet connected
    return NextResponse.json({
      success: true,
      business: {
        _id: context.businessId,
        ...defaultBusinessData,
        productCount: 145,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch settings";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function PUT(req: Request) {
  try {
    // Only OWNER can modify store settings!
    const context = await requireRole(["OWNER"]);
    const body = await req.json();

    const parsed = businessSettingsSchema.safeParse(body);
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

    const validatedData = parsed.data;

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const updated = await Business.findByIdAndUpdate(
        context.businessId,
        { $set: validatedData },
        { new: true, upsert: true }
      );

      // Record audit log entry
      await AuditLog.create({
        businessId: context.businessId,
        userId: context.userId,
        userName: context.username,
        action: "SETTINGS_UPDATED",
        entityType: "Business",
        entityId: context.businessId,
        details: validatedData,
      });

      return NextResponse.json({
        success: true,
        message: "Business settings saved successfully.",
        business: updated,
      });
    }

    // Demo mode response
    return NextResponse.json({
      success: true,
      message: "Settings saved successfully (Demo Mode).",
      business: {
        _id: context.businessId,
        ...validatedData,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save settings";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
