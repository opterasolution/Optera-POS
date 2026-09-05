import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Product } from "@/models/Product";
import { InventoryMovement } from "@/models/InventoryMovement";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth, requireRole } from "@/lib/tenant";
import { stockAdjustmentSchema } from "@/lib/validations/inventory";

export async function GET(req: Request) {
  try {
    const context = await requireAuth();
    const { searchParams } = new URL(req.url);
    const filterStatus = searchParams.get("status") || "all";
    const query = searchParams.get("q")?.trim();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const filter: Record<string, unknown> = {
        businessId: context.businessId,
        isActive: true,
      };

      if (filterStatus === "low") {
        filter.$expr = {
          $and: [
            { $lte: ["$stockQuantity", "$lowStockThreshold"] },
            { $gt: ["$stockQuantity", 0] },
          ],
        };
      } else if (filterStatus === "out") {
        filter.stockQuantity = { $lte: 0 };
      }

      if (query) {
        filter.$or = [
          { name: { $regex: query, $options: "i" } },
          { barcode: { $regex: query, $options: "i" } },
          { sku: { $regex: query, $options: "i" } },
        ];
      }

      const products = await Product.find(filter)
        .populate("categoryId", "name color")
        .sort({ stockQuantity: 1 }); // Lowest stock first for inventory management

      // Summary counts
      const allActive = await Product.find({ businessId: context.businessId, isActive: true });
      let totalUnits = 0;
      let lowCount = 0;
      let outCount = 0;

      allActive.forEach((p) => {
        totalUnits += Math.max(0, p.stockQuantity);
        if (p.stockQuantity <= 0) {
          outCount++;
        } else if (p.stockQuantity <= p.lowStockThreshold) {
          lowCount++;
        }
      });

      return NextResponse.json({
        success: true,
        summary: {
          totalProducts: allActive.length,
          totalUnits,
          lowStockCount: lowCount,
          outOfStockCount: outCount,
        },
        products,
      });
    }

    // Demo Data
    return NextResponse.json({
      success: true,
      summary: {
        totalProducts: 6,
        totalUnits: 154,
        lowStockCount: 2,
        outOfStockCount: 1,
      },
      products: [
        {
          _id: "demo_p1",
          name: "Munchee Super Cream Cracker 490g",
          barcode: "4792038010015",
          sku: "BIS-001",
          costPrice: 260,
          sellingPrice: 320,
          stockQuantity: 2,
          lowStockThreshold: 10,
          unit: "packet",
          isActive: true,
        },
        {
          _id: "demo_p2",
          name: "Kotmale Fresh Milk 1L",
          barcode: "4791024003012",
          sku: "MILK-001",
          costPrice: 490,
          sellingPrice: 580,
          stockQuantity: 0,
          lowStockThreshold: 8,
          unit: "bottle",
          isActive: true,
        },
        {
          _id: "demo_p3",
          name: "Watawala Ceylon Tea 200g",
          barcode: "4791012004501",
          sku: "TEA-001",
          costPrice: 340,
          sellingPrice: 420,
          stockQuantity: 4,
          lowStockThreshold: 5,
          unit: "packet",
          isActive: true,
        },
        {
          _id: "demo_p4",
          name: "Keeri Samba Rice 5kg",
          barcode: "4793001002004",
          sku: "RICE-005",
          costPrice: 1250,
          sellingPrice: 1450,
          stockQuantity: 15,
          lowStockThreshold: 4,
          unit: "bag",
          isActive: true,
        },
      ],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load inventory";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER"]);
    const body = await req.json();

    const parsed = stockAdjustmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { productId, type, quantity, reason, exactCount } = parsed.data;

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const product = await Product.findOne({
        _id: productId,
        businessId: context.businessId,
        isActive: true,
      });

      if (!product) {
        return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
      }

      const previousStock = product.stockQuantity || 0;
      let newStock = previousStock;
      let quantityChange = 0;

      if (type === "RESTOCK" || type === "RETURN") {
        quantityChange = quantity;
        newStock = previousStock + quantity;
      } else if (type === "DAMAGE") {
        quantityChange = -quantity;
        // Do not allow negative stock unless explicitly configured
        newStock = Math.max(0, previousStock - quantity);
      } else if (type === "ADJUSTMENT") {
        if (exactCount !== undefined) {
          quantityChange = exactCount - previousStock;
          newStock = exactCount;
        } else {
          quantityChange = quantity;
          newStock = previousStock + quantity;
        }
      }

      // Safeguard against NaN or undefined
      if (isNaN(newStock) || newStock < 0) {
        return NextResponse.json(
          { success: false, error: "Invalid calculated stock quantity." },
          { status: 400 }
        );
      }

      // Atomically update product stock
      product.stockQuantity = newStock;
      await product.save();

      // Create immutable inventory movement log
      const movement = await InventoryMovement.create({
        businessId: context.businessId,
        productId: product._id,
        type,
        quantityChange,
        previousStock,
        newStock,
        reason: reason || `Manual ${type.toLowerCase()} adjustment`,
        createdBy: context.userId,
      });

      // Audit Log
      await AuditLog.create({
        businessId: context.businessId,
        userId: context.userId,
        userName: context.username,
        action: "STOCK_ADJUSTED",
        entityType: "Product",
        entityId: product._id.toString(),
        details: {
          productName: product.name,
          type,
          quantityChange,
          previousStock,
          newStock,
          reason,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Stock updated for ${product.name}. New stock: ${newStock} ${product.unit}.`,
        product,
        movement,
      });
    }

    // Demo Mode fallback
    return NextResponse.json({
      success: true,
      message: `Stock updated (Demo Mode). Adjustment recorded.`,
      product: {
        _id: productId,
        stockQuantity: 25,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to adjust stock";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
