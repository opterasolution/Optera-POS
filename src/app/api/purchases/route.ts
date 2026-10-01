import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { PurchaseOrder, IPurchaseOrderItem } from "@/models/PurchaseOrder";
import { Supplier } from "@/models/Supplier";
import { Branch } from "@/models/Branch";
import { BranchStock } from "@/models/BranchStock";
import { Product } from "@/models/Product";
import { InventoryMovement } from "@/models/InventoryMovement";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth, requireRole } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const context = await requireAuth();
    const { searchParams } = new URL(req.url);

    const status = searchParams.get("status") || "ALL";
    const supplierId = searchParams.get("supplierId");
    const branchId = searchParams.get("branchId");
    const search = searchParams.get("q")?.trim() || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "30", 10);
    const skip = (page - 1) * limit;

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const query: any = { businessId };

      if (status !== "ALL") {
        query.status = status;
      }
      if (supplierId) {
        query.supplierId = supplierId;
      }
      if (branchId) {
        query.branchId = branchId;
      }
      if (search) {
        query.$or = [
          { poNumber: { $regex: search, $options: "i" } },
          { supplierName: { $regex: search, $options: "i" } },
          { supplierInvoiceNumber: { $regex: search, $options: "i" } },
        ];
      }

      const [purchaseOrders, totalCount, openCount, receivedCount, totalProcurementResult] =
        await Promise.all([
          PurchaseOrder.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
          PurchaseOrder.countDocuments(query),
          PurchaseOrder.countDocuments({
            businessId,
            status: { $in: ["DRAFT", "SENT", "PARTIALLY_RECEIVED"] },
          }),
          PurchaseOrder.countDocuments({ businessId, status: "RECEIVED" }),
          PurchaseOrder.aggregate([
            { $match: { businessId, status: { $ne: "CANCELLED" } } },
            { $group: { _id: null, total: { $sum: "$netTotal" } } },
          ]),
        ]);

      return NextResponse.json({
        success: true,
        purchaseOrders,
        metrics: {
          totalCount,
          openOrdersCount: openCount,
          receivedOrdersCount: receivedCount,
          totalProcurementValue: totalProcurementResult[0]?.total || 0,
        },
        pagination: {
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit) || 1,
          totalCount,
        },
      });
    }

    return NextResponse.json({
      success: true,
      purchaseOrders: [],
      metrics: {
        totalCount: 0,
        openOrdersCount: 0,
        receivedOrdersCount: 0,
        totalProcurementValue: 0,
      },
      pagination: { page: 1, limit: 30, totalPages: 1, totalCount: 0 },
    });
  } catch (error: any) {
    console.error("Error fetching purchase orders:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch purchase orders" },
      { status: error.status || 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPER_ADMIN"]);
    const body = await req.json();

    const {
      supplierId,
      branchId,
      items,
      expectedDeliveryDate,
      supplierInvoiceNumber,
      notes,
      receiveImmediately = false,
      saveAsDraft = false,
    } = body;

    if (!supplierId) {
      return NextResponse.json({ success: false, error: "Supplier is required." }, { status: 400 });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: "At least one item is required." }, { status: 400 });
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const [supplier, branch] = await Promise.all([
        Supplier.findOne({ _id: supplierId, businessId }),
        branchId ? Branch.findOne({ _id: branchId, businessId }) : Branch.findOne({ businessId, isMainWarehouse: true }),
      ]);

      if (!supplier) {
        return NextResponse.json({ success: false, error: "Supplier not found." }, { status: 404 });
      }

      // Generate sequential PO number: PO-YYYYMMDD-XXXX
      const now = new Date();
      const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const countToday = await PurchaseOrder.countDocuments({
        businessId,
        createdAt: { $gte: startOfDay },
      });
      const seq = (countToday + 1).toString().padStart(4, "0");
      const poNumber = `PO-${datePart}-${seq}`;

      // Enrich items
      const productIds = items.map((i: any) => i.productId);
      const products = await Product.find({ _id: { $in: productIds }, businessId }).lean();
      const prodMap = new Map(products.map((p) => [p._id.toString(), p]));

      const poItems: IPurchaseOrderItem[] = [];
      let subtotal = 0;

      for (const item of items) {
        const prod = prodMap.get(item.productId);
        if (!prod) {
          return NextResponse.json(
            { success: false, error: `Product ID ${item.productId} was not found.` },
            { status: 400 }
          );
        }

        const qty = parseFloat(item.quantityOrdered);
        const cost = parseFloat(item.unitCost ?? prod.costPrice);

        if (isNaN(qty) || qty <= 0) {
          return NextResponse.json(
            { success: false, error: `Invalid order quantity for "${prod.name}".` },
            { status: 400 }
          );
        }
        if (isNaN(cost) || cost < 0) {
          return NextResponse.json(
            { success: false, error: `Invalid unit cost for "${prod.name}".` },
            { status: 400 }
          );
        }

        const lineTotal = qty * cost;
        subtotal += lineTotal;

        poItems.push({
          productId: prod._id,
          name: prod.name,
          sku: prod.sku,
          unit: prod.unit || "pcs",
          quantityOrdered: qty,
          quantityReceived: receiveImmediately ? qty : 0,
          unitCost: cost,
          total: lineTotal,
          notes: item.notes?.trim() || undefined,
        });
      }

      const initialStatus = receiveImmediately
        ? "RECEIVED"
        : saveAsDraft
        ? "DRAFT"
        : "SENT";

      const purchaseOrder = await PurchaseOrder.create({
        businessId,
        poNumber,
        supplierId: supplier._id,
        supplierName: supplier.name,
        branchId: branch?._id,
        branchName: branch?.name,
        status: initialStatus,
        items: poItems,
        subtotal,
        taxTotal: 0,
        netTotal: subtotal,
        expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : undefined,
        supplierInvoiceNumber: supplierInvoiceNumber?.trim() || undefined,
        receivedAt: receiveImmediately ? now : undefined,
        receivedBy: receiveImmediately ? context.username || "Manager" : undefined,
        notes: notes?.trim() || undefined,
        createdBy: context.username || "Manager",
      });

      // If direct inward stock receiving (Direct GRN):
      if (receiveImmediately) {
        for (const item of poItems) {
          // 1. Increment storewide Product stock
          const prod = await Product.findOne({ _id: item.productId, businessId });
          if (prod) {
            const prevStock = prod.stockQuantity || 0;
            const newStock = prevStock + item.quantityOrdered;
            prod.stockQuantity = newStock;
            // Optionally update cost price to newest GRN cost
            if (item.unitCost > 0) prod.costPrice = item.unitCost;
            await prod.save();

            // 2. Increment BranchStock if branch is active
            if (branch) {
              let bStock = await BranchStock.findOne({
                businessId,
                branchId: branch._id,
                productId: item.productId,
              });
              if (bStock) {
                bStock.quantity += item.quantityOrdered;
                await bStock.save();
              } else {
                await BranchStock.create({
                  businessId,
                  branchId: branch._id,
                  productId: item.productId,
                  quantity: item.quantityOrdered,
                });
              }
            }

            // 3. Record Inventory Movement
            await InventoryMovement.create({
              businessId,
              productId: item.productId,
              branchId: branch?._id,
              type: "RESTOCK",
              quantityChange: item.quantityOrdered,
              previousStock: prevStock,
              newStock,
              reason: `GRN Received from ${supplier.name} (${poNumber})`,
              referenceId: supplierInvoiceNumber || poNumber,
              createdBy: context.userId,
            });
          }
        }

        // 4. Increment supplier's Accounts Payable balance
        supplier.currentBalance = (supplier.currentBalance || 0) + subtotal;
        await supplier.save();
      }

      await AuditLog.create({
        businessId,
        action: receiveImmediately ? "PURCHASE_ORDER_RECEIVED" : "PURCHASE_ORDER_CREATED",
        entity: "PURCHASE_ORDER",
        entityId: purchaseOrder._id.toString(),
        userId: context.userId,
        details: {
          poNumber,
          supplierName: supplier.name,
          netTotal: subtotal,
          itemCount: poItems.length,
          status: initialStatus,
        },
      });

      return NextResponse.json({
        success: true,
        purchaseOrder,
        message: receiveImmediately
          ? `Goods received & inventory restocked (${poNumber}). Bill of Rs. ${subtotal.toLocaleString()} credited to ${supplier.name}.`
          : `Purchase Order ${poNumber} created successfully.`,
      });
    }

    return NextResponse.json({
      success: true,
      purchaseOrder: {
        _id: `po_${Date.now()}`,
        poNumber: `PO-${Date.now()}`,
        status: receiveImmediately ? "RECEIVED" : "SENT",
        netTotal: 15000,
      },
      message: "Demo: PO created.",
    });
  } catch (error: any) {
    console.error("Error creating purchase order:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create purchase order" },
      { status: error.status || 500 }
    );
  }
}
