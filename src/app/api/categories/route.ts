import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Category } from "@/models/Category";
import { requireAuth, requireRole } from "@/lib/tenant";
import { categorySchema } from "@/lib/validations/product";

const defaultCategories = [
  { _id: "cat_1", name: "Biscuits & Bakery", color: "#f59e0b", description: "Crackers, sweet biscuits, bread" },
  { _id: "cat_2", name: "Dairy & Milk", color: "#06b6d4", description: "Fresh milk, powdered milk, butter, cheese" },
  { _id: "cat_3", name: "Beverages & Tea", color: "#10b981", description: "Ceylon tea, coffee, soft drinks" },
  { _id: "cat_4", name: "Dry Rations & Grains", color: "#8b5cf6", description: "Rice, dhal, sugar, flour" },
  { _id: "cat_5", name: "Snacks & Sweets", color: "#ec4899", description: "Chocolates, chips, traditional sweets" },
  { _id: "cat_6", name: "Household & Soaps", color: "#3b82f6", description: "Detergents, soaps, toothpaste" },
];

export async function GET() {
  try {
    const context = await requireAuth();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      let categories = await Category.find({
        businessId: context.businessId,
        isActive: true,
      }).sort({ name: 1 });

      // If database has 0 categories, auto-seed default Sri Lankan categories for convenience
      if (categories.length === 0) {
        const toInsert = defaultCategories.map((c) => ({
          businessId: context.businessId,
          name: c.name,
          color: c.color,
          description: c.description,
          isActive: true,
        }));
        await Category.insertMany(toInsert);
        categories = await Category.find({ businessId: context.businessId, isActive: true }).sort({ name: 1 });
      }

      return NextResponse.json({ success: true, categories });
    }

    return NextResponse.json({ success: true, categories: defaultCategories });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load categories";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER"]);
    const body = await req.json();

    const parsed = categorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { name, description, color } = parsed.data;

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      // Check for duplicate category name within this business
      const existing = await Category.findOne({
        businessId: context.businessId,
        name: { $regex: new RegExp(`^${name}$`, "i") },
        isActive: true,
      });

      if (existing) {
        return NextResponse.json(
          { success: false, error: `Category "${name}" already exists.` },
          { status: 409 }
        );
      }

      const category = await Category.create({
        businessId: context.businessId,
        name,
        description,
        color,
        isActive: true,
      });

      return NextResponse.json({ success: true, category }, { status: 201 });
    }

    // Demo fallback
    const newDemoCat = {
      _id: `cat_${Date.now()}`,
      name,
      description,
      color,
    };
    return NextResponse.json({ success: true, category: newDemoCat }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create category";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
