import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Branch } from "@/models/Branch";
import { BranchStock } from "@/models/BranchStock";
import { Product } from "@/models/Product";
import { InventoryMovement } from "@/models/InventoryMovement";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth, requireRole } from "@/lib/tenant";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireAuth();
    const { id } = params;
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("q")?.trim() || "";
    const lowStockOnly = searchParams.get("lowStock") === "true";

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const branch = await Branch.findOne({ _id: id, businessId }).lean();
      if (!branch) {
        return NextResponse.json({ success: false, error: "Branch not found" }, { status: 404 });
      }

      // Query products
      const productQuery: any = { businessId, isActive: true };
      if (search) {
        productQuery.$or = [
          { name: { $regex: search, $options: "i" } },
          { barcode: { $regex: search, $options: "i" } },
          { sku: { $regex: search, $options: "i" } },
        ];
      }

      const products = await Product.find(productQuery).lean();
      const productIds = products.map((p) => p._id);

      const branchStocks = await BranchStock.find({
        businessId,
        branchId: id,
        productId: { $in: productIds },
      }).lean();

      const stockMap = new Map(branchStocks.map((s) => [s.productId.toString(), s]));

      let items = products.map((product) => {
        const stockRecord = stockMap.get(product._id.toString());
        const quantity = stockRecord?.quantity ?? 0;
        const reorderLevel = stockRecord?.reorderLevel ?? product.lowStockThreshold ?? 5;
        const isLowStock = quantity <= reorderLevel;

        return {
          productId: product._id,
          name: product.name,
          barcode: product.barcode,
          sku: product.sku,
          unit: product.unit || "pcs",
          costPrice: product.costPrice,
          sellingPrice: product.sellingPrice,
          quantity,
          reorderLevel,
          isLowStock,
        };
      });

      if (lowStockOnly) {
        items = items.filter((i) => i.isLowStock);
      }

      return NextResponse.json({
        success: true,
        branchName: branch.name,
        branchCode: branch.code,
        items,
        totalItems: items.length,
      });
    }

    return NextResponse.json({
      success: true,
      branchName: "Demo Branch",
      branchCode: "HQ-01",
      items: [],
      totalItems: 0,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch branch stock" },
      { status: error.status || 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPER_ADMIN"]);
    const { id } = params;
    const body = await req.json();

    const { productId, newQuantity, reason = "Manual Branch Count Adjustment" } = body;

    if (!productId || typeof newQuantity !== "number" || newQuantity < 0) {
      return NextResponse.json(
        { success: false, error: "Valid productId and positive newQuantity are required." },
        { status: 400 }
      );
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const [branch, product] = await Promise.all([
        Branch.findOne({ _id: id, businessId }),
        Product.findOne({ _id: productId, businessId }),
      ]);

      if (!branch) return NextResponse.json({ success: false, error: "Branch not found." }, { status: 404 });
      if (!product) return NextResponse.json({ success: false, error: "Product not found." }, { status: 404 });

      let branchStock = await BranchStock.findOne({ businessId, branchId: id, productId });
      const previousStock = branchStock ? branchStock.quantity : 0;
      const quantityChange = newQuantity - previousStock;

      if (!branchStock) {
        branchStock = new BranchStock({
          businessId,
          branchId: id,
          productId,
          quantity: newQuantity,
          reorderLevel: product.lowStockThreshold || 5,
        });
      } else {
        branchStock.quantity = newQuantity;
      }
      await branchStock.save();

      // Log movement
      await InventoryMovement.create({
        businessId,
        productId,
        branchId: branch._id,
        type: "ADJUSTMENT",
        quantityChange,
        previousStock,
        newStock: newQuantity,
        reason: `${reason} (${branch.code})`,
        createdBy: context.userId,
      });

      await AuditLog.create({
        businessId,
        action: "BRANCH_STOCK_ADJUSTED",
        entity: "BRANCH_STOCK",
        entityId: branchStock._id.toString(),
        userId: context.userId,
        details: {
          branchCode: branch.code,
          productName: product.name,
          previousStock,
          newStock: newQuantity,
          quantityChange,
          reason,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Updated stock of ${product.name} to ${newQuantity} at ${branch.name}.`,
        quantity: newQuantity,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Demo: Stock updated.",
      quantity: newQuantity,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to adjust branch stock" },
      { status: error.status || 500 }
    );
  }
}
