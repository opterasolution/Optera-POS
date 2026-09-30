import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Branch } from "@/models/Branch";
import { BranchStock } from "@/models/BranchStock";
import { StockTransfer } from "@/models/StockTransfer";
import { Product } from "@/models/Product";
import { Business } from "@/models/Business";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth, requireRole } from "@/lib/tenant";

export async function GET() {
  try {
    const context = await requireAuth();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      let branches: any[] = await Branch.find({ businessId })
        .sort({ isMainWarehouse: -1, code: 1 })
        .lean();

      // If store has 0 branches, auto-seed default Main Store / Warehouse (HQ-01)
      if (branches.length === 0) {
        const business = await Business.findById(businessId).lean();
        const defaultBranch = await Branch.create({
          businessId,
          code: "HQ-01",
          name: business?.name ? `${business.name} (Main)` : "Main Store / Warehouse",
          type: "WAREHOUSE",
          address: business?.address || "Main Facility",
          phone: business?.phone || "",
          isMainWarehouse: true,
          isActive: true,
        });

        // Initialize BranchStock for all existing active products with current stockQuantity
        const allProducts = await Product.find({ businessId }).lean();
        if (allProducts.length > 0) {
          const initialStocks = allProducts.map((p) => ({
            businessId,
            branchId: defaultBranch._id,
            productId: p._id,
            quantity: p.stockQuantity || 0,
            reorderLevel: p.lowStockThreshold || 5,
            reorderQuantity: 20,
          }));
          await BranchStock.insertMany(initialStocks, { ordered: false }).catch(() => {});
        }

        branches = [defaultBranch.toObject()];
      }

      // Compute live SKU counts and active transfers for each branch
      const branchIds = branches.map((b) => b._id);

      const [stockCounts, activeInbound, activeOutbound] = await Promise.all([
        BranchStock.aggregate([
          { $match: { businessId, branchId: { $in: branchIds }, quantity: { $gt: 0 } } },
          { $group: { _id: "$branchId", count: { $sum: 1 }, totalQty: { $sum: "$quantity" } } },
        ]),
        StockTransfer.aggregate([
          { $match: { businessId, destinationBranchId: { $in: branchIds }, status: "IN_TRANSIT" } },
          { $group: { _id: "$destinationBranchId", count: { $sum: 1 } } },
        ]),
        StockTransfer.aggregate([
          { $match: { businessId, sourceBranchId: { $in: branchIds }, status: "IN_TRANSIT" } },
          { $group: { _id: "$sourceBranchId", count: { $sum: 1 } } },
        ]),
      ]);

      const stockCountMap = new Map(stockCounts.map((s) => [s._id.toString(), s]));
      const inboundMap = new Map(activeInbound.map((i) => [i._id.toString(), i.count]));
      const outboundMap = new Map(activeOutbound.map((o) => [o._id.toString(), o.count]));

      const enrichedBranches = branches.map((branch) => {
        const idStr = branch._id.toString();
        const stockData = stockCountMap.get(idStr);
        return {
          ...branch,
          stockedItemsCount: stockData?.count || 0,
          totalInventoryUnits: stockData?.totalQty || 0,
          activeInboundTransfers: inboundMap.get(idStr) || 0,
          activeOutboundTransfers: outboundMap.get(idStr) || 0,
        };
      });

      return NextResponse.json({
        success: true,
        branches: enrichedBranches,
        totalBranches: enrichedBranches.length,
        activeBranches: enrichedBranches.filter((b) => b.isActive).length,
      });
    }

    // Demo Mode fallback
    return NextResponse.json({
      success: true,
      branches: [
        {
          _id: "demo_branch_01",
          code: "HQ-01",
          name: "Colombo Central Warehouse",
          type: "WAREHOUSE",
          address: "Main Warehouse, Pettah, Colombo 11",
          phone: "0112345678",
          managerName: "Sampath Perera",
          isMainWarehouse: true,
          isActive: true,
          stockedItemsCount: 145,
          totalInventoryUnits: 3850,
          activeInboundTransfers: 0,
          activeOutboundTransfers: 1,
        },
        {
          _id: "demo_branch_02",
          code: "BR-KND",
          name: "Kandy City Outlet",
          type: "RETAIL_STORE",
          address: "Dalada Veediya, Kandy",
          phone: "0812233445",
          managerName: "Nimal Dissanayake",
          isMainWarehouse: false,
          isActive: true,
          stockedItemsCount: 92,
          totalInventoryUnits: 1240,
          activeInboundTransfers: 1,
          activeOutboundTransfers: 0,
        },
      ],
      totalBranches: 2,
      activeBranches: 2,
    });
  } catch (error: any) {
    console.error("Error fetching branches:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch branches" },
      { status: error.status || 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPER_ADMIN"]);
    const body = await req.json();

    const {
      name,
      code,
      type = "RETAIL_STORE",
      address,
      phone,
      email,
      managerName,
      isMainWarehouse = false,
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: "Branch name is required." }, { status: 400 });
    }
    if (!code?.trim()) {
      return NextResponse.json({ success: false, error: "Branch code is required (e.g. BR-KND)." }, { status: 400 });
    }

    const normalizedCode = code.trim().toUpperCase();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      // Check for code uniqueness in business
      const existing = await Branch.findOne({ businessId, code: normalizedCode });
      if (existing) {
        return NextResponse.json(
          { success: false, error: `A branch with code "${normalizedCode}" already exists in your store network.` },
          { status: 400 }
        );
      }

      // If marked as main warehouse, unset on other branches
      if (isMainWarehouse) {
        await Branch.updateMany({ businessId, isMainWarehouse: true }, { $set: { isMainWarehouse: false } });
      }

      const branch = await Branch.create({
        businessId,
        name: name.trim(),
        code: normalizedCode,
        type,
        address: address?.trim() || undefined,
        phone: phone?.trim() || undefined,
        email: email?.trim()?.toLowerCase() || undefined,
        managerName: managerName?.trim() || undefined,
        isMainWarehouse: Boolean(isMainWarehouse),
        isActive: true,
      });

      // Seed BranchStock records for existing products so they can be immediately tracked/transferred
      const products = await Product.find({ businessId, isActive: true }).select("_id lowStockThreshold").lean();
      if (products.length > 0) {
        const stocksToSeed = products.map((p) => ({
          businessId,
          branchId: branch._id,
          productId: p._id,
          quantity: 0,
          reorderLevel: p.lowStockThreshold || 5,
          reorderQuantity: 20,
        }));
        await BranchStock.insertMany(stocksToSeed, { ordered: false }).catch(() => {});
      }

      // Audit log
      await AuditLog.create({
        businessId,
        action: "BRANCH_CREATED",
        entity: "BRANCH",
        entityId: branch._id.toString(),
        userId: context.userId,
        details: {
          code: branch.code,
          name: branch.name,
          type: branch.type,
          isMainWarehouse: branch.isMainWarehouse,
        },
      });

      return NextResponse.json({
        success: true,
        branch,
        message: `Branch "${branch.name}" (${branch.code}) created successfully.`,
      });
    }

    // Demo Mode fallback
    return NextResponse.json({
      success: true,
      branch: {
        _id: `branch_${Date.now()}`,
        name: name.trim(),
        code: normalizedCode,
        type,
        address,
        phone,
        email,
        managerName,
        isMainWarehouse,
        isActive: true,
      },
      message: `Demo: Branch "${name}" created.`,
    });
  } catch (error: any) {
    console.error("Error creating branch:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create branch" },
      { status: error.status || 500 }
    );
  }
}
