import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Product } from "@/models/Product";
import { Supplier } from "@/models/Supplier";
import { PurchaseOrder } from "@/models/PurchaseOrder";
import { Sale } from "@/models/Sale";
import { Branch } from "@/models/Branch";
import { BranchStock } from "@/models/BranchStock";
import { requireAuth } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const context = await requireAuth();
    const { searchParams } = new URL(req.url);

    const branchId = searchParams.get("branchId");
    const supplierId = searchParams.get("supplierId");
    const lookbackDays = Math.max(3, Math.min(90, Number(searchParams.get("lookbackDays")) || 14));
    const urgencyFilter = searchParams.get("urgency") || "ALL";
    const search = searchParams.get("q")?.trim() || "";

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      // 1. Fetch active products
      const productQuery: any = { businessId, isActive: true };
      if (supplierId && supplierId !== "ALL") {
        productQuery.supplierId = supplierId;
      }
      if (search) {
        productQuery.$or = [
          { name: { $regex: search, $options: "i" } },
          { sku: { $regex: search, $options: "i" } },
          { barcode: { $regex: search, $options: "i" } },
        ];
      }

      const products = await Product.find(productQuery).lean();

      // 2. Fetch suppliers
      const suppliers = await Supplier.find({ businessId, isActive: true }).lean();
      const supplierMap = new Map(suppliers.map((s) => [s._id.toString(), s]));

      // 3. Fetch branch if specified
      let targetBranch = null;
      if (branchId && branchId !== "ALL") {
        targetBranch = await Branch.findOne({ _id: branchId, businessId }).lean();
      }

      // If branch specified, fetch BranchStock records for live stock per branch
      let branchStockMap = new Map<string, number>();
      if (branchId && branchId !== "ALL") {
        const bStocks = await BranchStock.find({ businessId, branchId }).lean();
        branchStockMap = new Map(bStocks.map((bs) => [bs.productId.toString(), bs.quantity]));
      }

      // 4. Calculate Sales Velocity (ADS) from completed Sales over lookbackDays
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - lookbackDays);

      const salesAggQuery: any = {
        businessId,
        createdAt: { $gte: sinceDate },
        status: { $in: ["COMPLETED", "SETTLED"] },
      };
      if (branchId && branchId !== "ALL") {
        salesAggQuery.branchId = branchId;
      }

      const salesSales = await Sale.find(salesAggQuery, { items: 1 }).lean();
      const salesVolumeMap = new Map<string, number>();

      for (const sale of salesSales) {
        if (Array.isArray(sale.items)) {
          for (const item of sale.items) {
            const pid = item.productId?.toString();
            if (pid) {
              const currentVol = salesVolumeMap.get(pid) || 0;
              salesVolumeMap.set(pid, currentVol + (item.quantity || 1));
            }
          }
        }
      }

      // 5. Calculate open inbound PO quantities
      const openPoQuery: any = {
        businessId,
        status: { $in: ["DRAFT", "SENT", "PARTIALLY_RECEIVED"] },
      };
      if (branchId && branchId !== "ALL") {
        openPoQuery.branchId = branchId;
      }

      const openPOs = await PurchaseOrder.find(openPoQuery, { items: 1 }).lean();
      const inboundPoMap = new Map<string, number>();

      for (const po of openPOs) {
        if (Array.isArray(po.items)) {
          for (const item of po.items) {
            const pid = item.productId?.toString();
            if (pid) {
              const ordered = item.quantityOrdered || 0;
              const received = item.quantityReceived || 0;
              const remaining = Math.max(0, ordered - received);
              const currentInbound = inboundPoMap.get(pid) || 0;
              inboundPoMap.set(pid, currentInbound + remaining);
            }
          }
        }
      }

      // 6. Evaluate Reorder Mathematics per Product
      const evaluatedItems = [];
      let totalOutOfStock = 0;
      let totalCritical = 0;
      let totalLowStock = 0;
      let totalProcurementSpend = 0;

      for (const p of products) {
        const pid = p._id.toString();

        // Current stock
        const currentStock = branchId && branchId !== "ALL"
          ? (branchStockMap.get(pid) ?? p.stockQuantity ?? 0)
          : (p.stockQuantity ?? 0);

        const inboundPoStock = inboundPoMap.get(pid) || 0;
        const totalSold = salesVolumeMap.get(pid) || 0;

        // Daily Run-Rate (Average Daily Sales)
        const avgDailySales = Math.round((totalSold / lookbackDays) * 10) / 10;

        // Supplier resolution
        let sId = p.supplierId?.toString();
        let supplier = sId ? supplierMap.get(sId) : null;
        if (!supplier && suppliers.length > 0) {
          // If product has no supplier assigned, associate with first supplier or mark UNASSIGNED
          supplier = suppliers[0];
          sId = supplier._id.toString();
        }

        const leadTimeDays = p.leadTimeDays || supplier?.defaultLeadTimeDays || 3;
        const safetyStockDays = p.safetyStockDays || 5;

        // Lead Time Demand (LTD)
        const leadTimeDemand = Math.round(avgDailySales * leadTimeDays);

        // Safety Stock
        const baselineBuffer = p.lowStockThreshold || 5;
        const dynamicBuffer = Math.round(avgDailySales * safetyStockDays);
        const safetyStock = Math.max(baselineBuffer, dynamicBuffer);

        // Dynamic Reorder Point (ROP)
        const reorderPoint = leadTimeDemand + safetyStock;

        // Net Effective Available Inventory
        const effectiveStock = currentStock + inboundPoStock;

        // Determine Urgency
        let urgency: "OUT_OF_STOCK" | "CRITICAL" | "LOW_STOCK" | "NORMAL" = "NORMAL";

        if (currentStock <= 0) {
          urgency = "OUT_OF_STOCK";
          totalOutOfStock++;
        } else if (effectiveStock <= leadTimeDemand) {
          urgency = "CRITICAL";
          totalCritical++;
        } else if (effectiveStock <= reorderPoint) {
          urgency = "LOW_STOCK";
          totalLowStock++;
        }

        // Calculate Suggested Order Quantity (SOQ)
        let suggestedQuantity = 0;
        const packSize = p.orderPackSize || 1;
        const minOrderQty = p.minOrderQuantity || 1;

        if (urgency !== "NORMAL") {
          let targetStock = 0;
          if (p.maxStockLevel && p.maxStockLevel > reorderPoint) {
            targetStock = p.maxStockLevel;
          } else {
            // Target stock covers reorder point plus standard 14 days cycle stock
            targetStock = reorderPoint + Math.max(10, Math.ceil(avgDailySales * 14));
          }

          const rawDeficit = Math.max(minOrderQty, targetStock - effectiveStock);
          // Pack size rounding
          suggestedQuantity = Math.ceil(rawDeficit / packSize) * packSize;
        }

        const unitCost = p.costPrice || 0;
        const estimatedTotal = suggestedQuantity * unitCost;

        if (urgency !== "NORMAL") {
          totalProcurementSpend += estimatedTotal;
        }

        // Days of remaining stock forecast
        const daysRemaining = avgDailySales > 0
          ? Math.round((currentStock / avgDailySales) * 10) / 10
          : currentStock > 0 ? 99 : 0;

        evaluatedItems.push({
          productId: p._id,
          productName: p.name,
          sku: p.sku || "",
          barcode: p.barcode || "",
          unit: p.unit || "pcs",
          supplierId: supplier?._id || null,
          supplierName: supplier?.name || "Unassigned Vendor",
          supplierPhone: supplier?.phone || "",
          supplierEmail: supplier?.email || "",
          supplierPaymentTermsDays: supplier?.paymentTermsDays ?? 30,
          supplierMinOrderAmount: supplier?.minOrderAmount || 0,
          currentStock,
          inboundPoStock,
          avgDailySales,
          lookbackDays,
          leadTimeDays,
          safetyStockDays,
          leadTimeDemand,
          safetyStock,
          reorderPoint,
          effectiveStock,
          suggestedQuantity,
          packSize,
          unitCost,
          sellingPrice: p.sellingPrice || 0,
          estimatedTotal,
          urgency,
          daysRemaining,
          maxStockLevel: p.maxStockLevel,
        });
      }

      // Filter by urgency if requested
      let filteredItems = evaluatedItems;
      if (urgencyFilter !== "ALL") {
        if (urgencyFilter === "REORDER_ONLY") {
          filteredItems = evaluatedItems.filter((i) => i.urgency !== "NORMAL");
        } else {
          filteredItems = evaluatedItems.filter((i) => i.urgency === urgencyFilter);
        }
      }

      // Sort items by priority: OUT_OF_STOCK first, then CRITICAL, then LOW_STOCK
      const urgencyRank: Record<string, number> = {
        OUT_OF_STOCK: 1,
        CRITICAL: 2,
        LOW_STOCK: 3,
        NORMAL: 4,
      };
      filteredItems.sort((a, b) => {
        const rankDiff = urgencyRank[a.urgency] - urgencyRank[b.urgency];
        if (rankDiff !== 0) return rankDiff;
        return a.daysRemaining - b.daysRemaining;
      });

      // 7. Cluster items by Supplier (Purchase Order Proposals)
      const supplierClusterMap = new Map<string, any>();

      for (const item of evaluatedItems) {
        if (item.urgency === "NORMAL") continue; // only understocked items for PO proposals

        const supIdStr = item.supplierId?.toString() || "UNASSIGNED";
        let cluster = supplierClusterMap.get(supIdStr);

        if (!cluster) {
          cluster = {
            supplierId: item.supplierId,
            supplierName: item.supplierName,
            supplierPhone: item.supplierPhone,
            supplierEmail: item.supplierEmail,
            paymentTermsDays: item.supplierPaymentTermsDays,
            minOrderAmount: item.supplierMinOrderAmount,
            totalItemsCount: 0,
            totalUnitsCount: 0,
            totalEstimatedCost: 0,
            items: [],
          };
          supplierClusterMap.set(supIdStr, cluster);
        }

        cluster.totalItemsCount += 1;
        cluster.totalUnitsCount += item.suggestedQuantity;
        cluster.totalEstimatedCost += item.estimatedTotal;
        cluster.items.push(item);
      }

      // Finalize supplier clusters with MOV (Minimum Order Value) checks
      const supplierClusters = Array.from(supplierClusterMap.values()).map((c) => {
        const minOrder = c.minOrderAmount || 0;
        const isMinMet = minOrder === 0 || c.totalEstimatedCost >= minOrder;
        const shortfall = isMinMet ? 0 : minOrder - c.totalEstimatedCost;
        return {
          ...c,
          isMinOrderMet: isMinMet,
          shortfallAmount: shortfall,
        };
      });

      supplierClusters.sort((a, b) => b.totalEstimatedCost - a.totalEstimatedCost);

      return NextResponse.json({
        success: true,
        metrics: {
          totalProductsEvaluated: products.length,
          reorderRequiredCount: totalOutOfStock + totalCritical + totalLowStock,
          outOfStockCount: totalOutOfStock,
          criticalCount: totalCritical,
          lowStockCount: totalLowStock,
          totalProcurementSpend,
          activeSuppliersWithOrders: supplierClusters.length,
        },
        items: filteredItems,
        supplierClusters,
        lookbackDays,
        branch: targetBranch,
      });
    }

    return NextResponse.json({
      success: true,
      metrics: {
        totalProductsEvaluated: 0,
        reorderRequiredCount: 0,
        outOfStockCount: 0,
        criticalCount: 0,
        lowStockCount: 0,
        totalProcurementSpend: 0,
        activeSuppliersWithOrders: 0,
      },
      items: [],
      supplierClusters: [],
      lookbackDays,
      branch: null,
    });
  } catch (error: any) {
    console.error("Error in GET /api/procurement/reorder/suggestions:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate reorder suggestions" },
      { status: 500 }
    );
  }
}
