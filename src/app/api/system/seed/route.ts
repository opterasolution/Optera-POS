import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/tenant";
import { SEED_PRESETS, seedStoreData, SeedStorePreset } from "@/lib/diagnostics/seed-data";
import { Product, Category, Supplier, Customer } from "@/models";
import mongoose from "mongoose";

export async function GET(req: NextRequest) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPER_ADMIN"]);
    let counts = {
      products: 0,
      categories: 0,
      suppliers: 0,
      customers: 0,
    };

    if (Boolean(process.env.MONGODB_URI) && mongoose.Types.ObjectId.isValid(context.businessId)) {
      const bId = new mongoose.Types.ObjectId(context.businessId);
      const [p, c, s, cust] = await Promise.all([
        Product.countDocuments({ businessId: bId }),
        Category.countDocuments({ businessId: bId }),
        Supplier.countDocuments({ businessId: bId }),
        Customer.countDocuments({ businessId: bId }),
      ]);
      counts = { products: p, categories: c, suppliers: s, customers: cust };
    }

    return NextResponse.json({
      success: true,
      presets: SEED_PRESETS,
      currentCounts: counts,
    });
  } catch (error: any) {
    console.error("Seed API GET error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to retrieve seed presets" },
      { status: error.status || 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const context = await requireRole(["OWNER", "SUPER_ADMIN"]);
    const body = await req.json().catch(() => ({}));

    const { preset = "SUPERMARKET", clearExisting = false } = body;

    const validPresets: SeedStorePreset[] = ["SUPERMARKET", "PHARMACY", "HARDWARE"];
    if (!validPresets.includes(preset)) {
      return NextResponse.json(
        { success: false, error: `Invalid preset: ${preset}. Must be one of ${validPresets.join(", ")}` },
        { status: 400 }
      );
    }

    const result = await seedStoreData({
      businessId: context.businessId,
      preset,
      clearExisting: Boolean(clearExisting),
      userId: context.userId,
      username: context.username,
    });

    return NextResponse.json({
      success: true,
      result,
      message: result.message,
    });
  } catch (error: any) {
    console.error("Seed API POST error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to seed store data" },
      { status: error.status || 500 }
    );
  }
}
