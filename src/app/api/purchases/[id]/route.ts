import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { PurchaseOrder } from "@/models/PurchaseOrder";
import { Supplier } from "@/models/Supplier";
import { Product } from "@/models/Product";
import { Batch } from "@/models/Batch";
import { BranchStock } from "@/models/BranchStock";
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

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const purchaseOrder = await PurchaseOrder.findOne({
        _id: id,
        businessId: context.businessId,
      }).lean();

      if (!purchaseOrder) {
        return NextResponse.json({ success: false, error: "Purchase Order not found" }, { status: 404 });
      }

      return NextResponse.json({ success: true, purchaseOrder });
    }

    return NextResponse.json({
      success: true,
      purchaseOrder: { _id: id, poNumber: "PO-DEMO-0001", status: "SENT" },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch purchase order" },
      { status: error.status || 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPER_ADMIN"]);
    const { id } = params;
    const body = await req.json();
    const { action } = body;

    if (!["RECEIVE_GRN", "CANCEL"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "Invalid action. Supported: RECEIVE_GRN, CANCEL." },
        { status: 400 }
      );
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const po = await PurchaseOrder.findOne({ _id: id, businessId });
      if (!po) {
        return NextResponse.json({ success: false, error: "Purchase Order not found." }, { status: 404 });
      }

      // ----------------- ACTION: RECEIVE_GRN -----------------
      if (action === "RECEIVE_GRN") {
        if (po.status === "RECEIVED") {
          return NextResponse.json(
            { success: false, error: "This Purchase Order has already been fully received." },
            { status: 400 }
          );
        }
        if (po.status === "CANCELLED") {
          return NextResponse.json(
            { success: false, error: "Cannot receive items against a cancelled Purchase Order." },
            { status: 400 }
          );
        }

        const supplier = await Supplier.findOne({ _id: po.supplierId, businessId });

        const receivedMap = new Map<string, number>();
        if (Array.isArray(body.receivedItems)) {
          body.receivedItems.forEach((ri: any) => {
            if (ri.productId && typeof ri.quantityReceived === "number") {
              receivedMap.set(ri.productId.toString(), Math.max(0, ri.quantityReceived));
            }
          });
        }

        let batchNetValue = 0;
        let allItemsFullyReceived = true;

        const updatedItems = [];

        for (const item of po.items) {
          const pidStr = item.productId.toString();
          // Total cumulative quantity received for this item after this batch
          const cumulativeRec = receivedMap.has(pidStr)
            ? (receivedMap.get(pidStr) as number)
            : item.quantityOrdered;

          const previouslyRec = item.quantityReceived || 0;
          const delta = Math.max(0, cumulativeRec - previouslyRec);

          if (cumulativeRec < item.quantityOrdered) {
            allItemsFullyReceived = false;
          }

          if (delta > 0) {
            batchNetValue += delta * item.unitCost;

            // 1. Update Product stockQuantity
            const prod = await Product.findOne({ _id: item.productId, businessId });
            if (prod) {
              const prev = prod.stockQuantity || 0;
              const next = prev + delta;
              prod.stockQuantity = next;
              if (item.unitCost > 0) prod.costPrice = item.unitCost;
              await prod.save();

              // 2. Update BranchStock if branch is attached to PO
              if (po.branchId) {
                let bStock = await BranchStock.findOne({
                  businessId,
                  branchId: po.branchId,
                  productId: item.productId,
                });
                if (bStock) {
                  bStock.quantity += delta;
                  await bStock.save();
                } else {
                  await BranchStock.create({
                    businessId,
                    branchId: po.branchId,
                    productId: item.productId,
                    quantity: delta,
                  });
                }
              }

              // 3. Record Inventory Movement
              await InventoryMovement.create({
                businessId,
                productId: item.productId,
                branchId: po.branchId,
                type: "RESTOCK",
                quantityChange: delta,
                previousStock: prev,
                newStock: next,
                reason: `GRN Intake from ${po.supplierName} (${po.poNumber})`,
                referenceId: body.supplierInvoiceNumber || po.poNumber,
                createdBy: context.userId,
              });

              // Create Batch document if batch number and expiry date are provided
              const riItem = Array.isArray(body.receivedItems)
                ? body.receivedItems.find((r: any) => r.productId === pidStr)
                : null;
              const batchNum = riItem?.batchNumber || item.batchNumber;
              const expDate = riItem?.expiryDate || item.expiryDate;
              const mfgDate = riItem?.manufacturingDate || item.manufacturingDate;

              if (batchNum && expDate) {
                await Batch.create({
                  businessId,
                  productId: prod._id,
                  productName: prod.name,
                  productBarcode: prod.barcode,
                  productSku: prod.sku,
                  batchNumber: batchNum.trim(),
                  manufacturingDate: mfgDate ? new Date(mfgDate) : undefined,
                  expiryDate: new Date(expDate),
                  costPrice: item.unitCost,
                  sellingPrice: prod.sellingPrice,
                  initialQuantity: delta,
                  quantityAvailable: delta,
                  quantitySold: 0,
                  quantityDamaged: 0,
                  status: "ACTIVE",
                  supplierId: po.supplierId,
                  supplierName: po.supplierName,
                  purchaseOrderId: po._id,
                  poNumber: po.poNumber,
                  branchId: po.branchId,
                  branchName: po.branchName,
                  notes: `Auto-intake from PO ${po.poNumber}`,
                });
                prod.isBatchTracked = true;
                await prod.save();
              }
            }
          }

          const riItem = Array.isArray(body.receivedItems)
            ? body.receivedItems.find((r: any) => r.productId === pidStr)
            : null;

          updatedItems.push({
            productId: item.productId,
            name: item.name,
            sku: item.sku,
            unit: item.unit,
            quantityOrdered: item.quantityOrdered,
            quantityReceived: cumulativeRec,
            unitCost: item.unitCost,
            total: item.total,
            batchNumber: riItem?.batchNumber || item.batchNumber,
            manufacturingDate: riItem?.manufacturingDate ? new Date(riItem.manufacturingDate) : item.manufacturingDate,
            expiryDate: riItem?.expiryDate ? new Date(riItem.expiryDate) : item.expiryDate,
            notes: item.notes,
          });
        }

        po.items = updatedItems as any;
        po.status = allItemsFullyReceived ? "RECEIVED" : "PARTIALLY_RECEIVED";
        po.receivedAt = new Date();
        po.receivedBy = context.username || "Warehouse Manager";
        if (body.supplierInvoiceNumber) po.supplierInvoiceNumber = body.supplierInvoiceNumber.trim();
        if (body.notes) po.notes = body.notes.trim();

        await po.save();

        // Credit supplier Accounts Payable ledger with newly received stock value
        if (supplier && batchNetValue > 0) {
          supplier.currentBalance = (supplier.currentBalance || 0) + batchNetValue;
          await supplier.save();
        }

        await AuditLog.create({
          businessId,
          action: "PURCHASE_ORDER_RECEIVED",
          entity: "PURCHASE_ORDER",
          entityId: po._id.toString(),
          userId: context.userId,
          details: {
            poNumber: po.poNumber,
            supplierName: po.supplierName,
            status: po.status,
            batchValue: batchNetValue,
            invoiceNumber: po.supplierInvoiceNumber,
          },
        });

        return NextResponse.json({
          success: true,
          purchaseOrder: po,
          message: `Goods received against ${po.poNumber}. Bill amount of Rs. ${batchNetValue.toLocaleString()} credited to ${po.supplierName}.`,
        });
      }

      // ----------------- ACTION: CANCEL -----------------
      if (action === "CANCEL") {
        if (po.status === "RECEIVED" || po.status === "PARTIALLY_RECEIVED") {
          return NextResponse.json(
            { success: false, error: "Cannot cancel a Purchase Order that has already received goods." },
            { status: 400 }
          );
        }

        po.status = "CANCELLED";
        po.cancelledAt = new Date();
        po.cancelledBy = context.username || "Manager";
        po.cancellationReason = body.cancellationReason?.trim() || "Cancelled by manager";

        await po.save();

        await AuditLog.create({
          businessId,
          action: "PURCHASE_ORDER_CANCELLED",
          entity: "PURCHASE_ORDER",
          entityId: po._id.toString(),
          userId: context.userId,
          details: { poNumber: po.poNumber, reason: po.cancellationReason },
        });

        return NextResponse.json({
          success: true,
          purchaseOrder: po,
          message: `Purchase Order ${po.poNumber} has been cancelled.`,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Demo: Action processed.",
    });
  } catch (error: any) {
    console.error("Error updating purchase order:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update purchase order" },
      { status: error.status || 500 }
    );
  }
}
