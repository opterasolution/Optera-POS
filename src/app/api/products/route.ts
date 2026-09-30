import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Product } from "@/models/Product";
import { InventoryMovement } from "@/models/InventoryMovement";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth, requireRole } from "@/lib/tenant";
import { productSchema } from "@/lib/validations/product";

// Default grocery catalog items for demonstration
const defaultDemoProducts = [
  {
    _id: "prod_1",
    name: "Munchee Super Cream Cracker 490g",
    barcode: "4792038010015",
    sku: "BIS-001",
    costPrice: 260,
    sellingPrice: 320,
    stockQuantity: 24,
    lowStockThreshold: 10,
    unit: "packet",
    categoryId: "cat_1",
    isActive: true,
  },
  {
    _id: "prod_2",
    name: "Kotmale Fresh Milk 1L",
    barcode: "4791024003012",
    sku: "MILK-001",
    costPrice: 490,
    sellingPrice: 580,
    stockQuantity: 18,
    lowStockThreshold: 8,
    unit: "bottle",
    categoryId: "cat_2",
    isActive: true,
  },
  {
    _id: "prod_3",
    name: "Watawala Ceylon Tea 200g",
    barcode: "4791012004501",
    sku: "TEA-001",
    costPrice: 340,
    sellingPrice: 420,
    stockQuantity: 30,
    lowStockThreshold: 5,
    unit: "packet",
    categoryId: "cat_3",
    isActive: true,
  },
  {
    _id: "prod_4",
    name: "Keeri Samba Rice 5kg",
    barcode: "4793001002004",
    sku: "RICE-005",
    costPrice: 1250,
    sellingPrice: 1450,
    stockQuantity: 15,
    lowStockThreshold: 4,
    unit: "bag",
    categoryId: "cat_4",
    isActive: true,
  },
  {
    _id: "prod_5",
    name: "Sunlight Soap 110g",
    barcode: "4791001000101",
    sku: "SOAP-001",
    costPrice: 120,
    sellingPrice: 150,
    stockQuantity: 45,
    lowStockThreshold: 12,
    unit: "bar",
    categoryId: "cat_6",
    isActive: true,
  },
  {
    _id: "prod_6",
    name: "Prima Special Flour 1kg",
    barcode: "4791035001102",
    sku: "FLOUR-001",
    costPrice: 210,
    sellingPrice: 260,
    stockQuantity: 22,
    lowStockThreshold: 6,
    unit: "packet",
    categoryId: "cat_4",
    isActive: true,
  },
];

export async function GET(req: Request) {
  try {
    const context = await requireAuth();
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim();
    const category = searchParams.get("category");
    const barcode = searchParams.get("barcode")?.trim();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const filter: Record<string, unknown> = {
        businessId: context.businessId,
        isActive: true,
      };

      if (category && category !== "all") {
        filter.categoryId = category;
      }

      if (barcode) {
        filter.barcode = barcode;
      } else if (query) {
        filter.$or = [
          { name: { $regex: query, $options: "i" } },
          { barcode: { $regex: query, $options: "i" } },
          { sku: { $regex: query, $options: "i" } },
        ];
      }

      let products = await Product.find(filter)
        .populate("categoryId", "name color")
        .sort({ name: 1 });

      // If database has 0 products, auto-seed realistic Sri Lankan items for immediate productivity!
      if (products.length === 0 && !query && !category && !barcode) {
        const toInsert = defaultDemoProducts.map((p) => ({
          businessId: context.businessId,
          name: p.name,
          barcode: p.barcode,
          sku: p.sku,
          costPrice: p.costPrice,
          sellingPrice: p.sellingPrice,
          stockQuantity: p.stockQuantity,
          lowStockThreshold: p.lowStockThreshold,
          unit: p.unit,
          isActive: true,
        }));
        await Product.insertMany(toInsert);
        products = await Product.find({ businessId: context.businessId, isActive: true }).sort({ name: 1 });
      }

      return NextResponse.json({ success: true, products });
    }

    // Demo filter
    let demoFiltered = [...defaultDemoProducts];
    if (category && category !== "all") {
      demoFiltered = demoFiltered.filter((p) => p.categoryId === category);
    }
    if (barcode) {
      demoFiltered = demoFiltered.filter((p) => p.barcode === barcode);
    } else if (query) {
      const qLower = query.toLowerCase();
      demoFiltered = demoFiltered.filter(
        (p) =>
          p.name.toLowerCase().includes(qLower) ||
          p.barcode.includes(qLower) ||
          p.sku.toLowerCase().includes(qLower)
      );
    }

    return NextResponse.json({ success: true, products: demoFiltered });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch products";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER"]);
    const body = await req.json();

    const parsed = productSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const {
      name,
      categoryId,
      sku,
      barcode,
      costPrice,
      sellingPrice,
      wholesalePrice,
      wholesaleMinQty,
      stockQuantity,
      lowStockThreshold,
      unit,
    } = parsed.data;

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      // Test Case 1: Check duplicate barcode per business
      if (barcode && barcode.trim() !== "") {
        const existingBarcode = await Product.findOne({
          businessId: context.businessId,
          barcode: barcode.trim(),
          isActive: true,
        });

        if (existingBarcode) {
          return NextResponse.json(
            {
              success: false,
              error: `Barcode "${barcode}" is already assigned to "${existingBarcode.name}".`,
            },
            { status: 409 }
          );
        }
      }

      // Test Case 2: Check duplicate SKU per business
      if (sku && sku.trim() !== "") {
        const existingSku = await Product.findOne({
          businessId: context.businessId,
          sku: sku.trim(),
          isActive: true,
        });

        if (existingSku) {
          return NextResponse.json(
            {
              success: false,
              error: `SKU "${sku}" is already assigned to "${existingSku.name}".`,
            },
            { status: 409 }
          );
        }
      }

      // Create Product
      const product = await Product.create({
        businessId: context.businessId,
        categoryId: categoryId || undefined,
        name,
        sku: sku || undefined,
        barcode: barcode || undefined,
        costPrice,
        sellingPrice,
        wholesalePrice: wholesalePrice !== undefined ? wholesalePrice : undefined,
        wholesaleMinQty: wholesaleMinQty || 1,
        stockQuantity,
        lowStockThreshold,
        unit,
        isActive: true,
      });

      // Record initial stock movement log
      if (stockQuantity > 0) {
        await InventoryMovement.create({
          businessId: context.businessId,
          productId: product._id,
          type: "RESTOCK",
          quantityChange: stockQuantity,
          previousStock: 0,
          newStock: stockQuantity,
          reason: "Initial catalog stock entry",
          createdBy: context.userId,
        });
      }

      // Audit Log
      await AuditLog.create({
        businessId: context.businessId,
        userId: context.userId,
        userName: context.username,
        action: "PRODUCT_CREATED",
        entityType: "Product",
        entityId: product._id.toString(),
        details: { name, sellingPrice, stockQuantity, barcode },
      });

      return NextResponse.json({ success: true, product }, { status: 201 });
    }

    // Demo Mode fallback
    const newDemoProduct = {
      _id: `prod_${Date.now()}`,
      name,
      categoryId,
      sku: sku || `SKU-${Date.now().toString().slice(-4)}`,
      barcode: barcode || `${Date.now()}`,
      costPrice,
      sellingPrice,
      stockQuantity,
      lowStockThreshold,
      unit,
      isActive: true,
    };

    return NextResponse.json({ success: true, product: newDemoProduct }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create product";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
