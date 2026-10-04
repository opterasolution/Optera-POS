import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { PurchaseOrder, IPurchaseOrderItem } from "@/models/PurchaseOrder";
import { Supplier } from "@/models/Supplier";
import { Product } from "@/models/Product";
import { Branch } from "@/models/Branch";
import { ReorderPlan, generateReorderPlanNumber } from "@/models/ReorderPlan";
import { AuditLog } from "@/models/AuditLog";
import { requireRole } from "@/lib/tenant";

export async function POST(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPER_ADMIN"]);
    const body = await req.json();

    const {
      branchId,
      supplierOrders,
      lookbackDays = 14,
      planNotes,
    } = body;

    if (!Array.isArray(supplierOrders) || supplierOrders.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one supplier order is required to generate POs." },
        { status: 400 }
      );
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      // Determine branch
      let branch = null;
      if (branchId) {
        branch = await Branch.findOne({ _id: branchId, businessId }).lean();
      }
      if (!branch) {
        branch = await Branch.findOne({ businessId, isMainWarehouse: true }).lean() ||
                 await Branch.findOne({ businessId }).lean();
      }

      const createdPOs = [];
      const generatedPoIds = [];
      const generatedPoNumbers = [];
      const planItems = [];

      let totalPlanCost = 0;

      for (const order of supplierOrders) {
        const { supplierId, items: rawItems, notes: orderNotes } = order;

        if (!supplierId || !Array.isArray(rawItems) || rawItems.length === 0) continue;

        const supplier = await Supplier.findOne({ _id: supplierId, businessId }).lean();
        if (!supplier) continue;

        // Fetch products
        const pIds = rawItems.map((it: any) => it.productId);
        const products = await Product.find({ _id: { $in: pIds }, businessId }).lean();
        const prodMap = new Map(products.map((p) => [p._id.toString(), p]));

        // Generate unique PO number: PO-YYYYMMDD-XXXX
        const now = new Date();
        const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const countToday = await PurchaseOrder.countDocuments({
          businessId,
          createdAt: { $gte: startOfDay },
        });
        const seq: string = String(countToday + createdPOs.length + 1).padStart(4, "0");
        const poNumber: string = `PO-${datePart}-${seq}`;


        const poItems: IPurchaseOrderItem[] = [];
        let poSubtotal = 0;

        for (const rawItem of rawItems) {
          const qty = Number(rawItem.quantity) || 1;
          const prod = prodMap.get(rawItem.productId.toString());
          const unitCost = Number(rawItem.unitCost ?? prod?.costPrice ?? 0);
          const totalCost = qty * unitCost;

          poItems.push({
            productId: rawItem.productId,
            name: prod?.name || rawItem.productName || "Ordered Item",
            sku: prod?.sku || rawItem.sku,
            unit: prod?.unit || rawItem.unit || "pcs",
            quantityOrdered: qty,
            quantityReceived: 0,
            unitCost,
            total: totalCost,
            notes: rawItem.notes || "Auto-generated from reorder engine",
          });

          poSubtotal += totalCost;

          // Track for ReorderPlan
          planItems.push({
            productId: rawItem.productId,
            productName: prod?.name || rawItem.productName || "Item",
            sku: prod?.sku,
            unit: prod?.unit || "pcs",
            supplierId: supplier._id,
            supplierName: supplier.name,
            currentStock: prod?.stockQuantity || 0,
            inboundPoStock: 0,
            avgDailySales: rawItem.avgDailySales || 0,
            leadTimeDays: rawItem.leadTimeDays || 3,
            safetyStockDays: rawItem.safetyStockDays || 5,
            reorderPoint: rawItem.reorderPoint || 0,
            suggestedQuantity: qty,
            approvedQuantity: qty,
            packSize: prod?.orderPackSize || 1,
            unitCost,
            estimatedTotal: totalCost,
            urgency: rawItem.urgency || "LOW_STOCK",
            isApproved: true,
            generatedPoNumber: poNumber,
          });
        }

        totalPlanCost += poSubtotal;

        // Delivery expected date = now + supplier payment/lead days
        const deliveryDate = new Date();
        deliveryDate.setDate(deliveryDate.getDate() + (supplier.defaultLeadTimeDays || 3));

        const newPO: any = await PurchaseOrder.create({
          businessId,

          poNumber,
          supplierId: supplier._id,
          supplierName: supplier.name,
          branchId: branch?._id,
          branchName: branch?.name,
          status: "DRAFT",
          items: poItems,
          subtotal: poSubtotal,
          taxTotal: 0,
          netTotal: poSubtotal,
          expectedDeliveryDate: deliveryDate,
          notes: orderNotes || `Auto-generated replenishing PO via Reorder Intelligence Engine.`,
          createdBy: context.username || "Reorder Planner",
        });

        createdPOs.push({
          _id: newPO._id,
          poNumber: newPO.poNumber,
          supplierName: supplier.name,
          itemCount: poItems.length,
          netTotal: poSubtotal,
        });

        generatedPoIds.push(newPO._id);
        generatedPoNumbers.push(newPO.poNumber);
      }

      // Record ReorderPlan
      const planNumber = generateReorderPlanNumber();
      const reorderPlan = await ReorderPlan.create({
        businessId,
        planNumber,
        branchId: branch?._id,
        branchName: branch?.name,
        lookbackDays: Number(lookbackDays),
        status: "CONVERTED",
        totalItemsEvaluated: planItems.length,
        reorderRequiredCount: planItems.length,
        outOfStockCount: planItems.filter((i) => i.urgency === "OUT_OF_STOCK").length,
        criticalCount: planItems.filter((i) => i.urgency === "CRITICAL").length,
        estimatedTotalCost: totalPlanCost,
        items: planItems,
        generatedPoIds,
        generatedPoNumbers,
        notes: planNotes,
        createdBy: context.username || "Reorder Planner",
      });

      await AuditLog.create({
        businessId,
        userId: context.userId,
        action: "GENERATE_REORDER_POS",
        entity: "PurchaseOrder",
        details: `Batch generated ${createdPOs.length} Purchase Orders (${generatedPoNumbers.join(", ")}) for Rs. ${totalPlanCost.toLocaleString()} via Reorder Engine Plan ${planNumber}`,
      });

      return NextResponse.json({
        success: true,
        message: `Successfully generated ${createdPOs.length} Purchase Order(s).`,
        planNumber: reorderPlan.planNumber,
        purchaseOrders: createdPOs,
      });
    }

    return NextResponse.json(
      { success: false, error: "Database unavailable." },
      { status: 503 }
    );
  } catch (error: any) {
    console.error("Error in POST /api/procurement/reorder/generate-pos:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate Purchase Orders" },
      { status: 500 }
    );
  }
}
