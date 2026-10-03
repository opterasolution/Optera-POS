import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { GoodsReceivedNote } from "@/models/GoodsReceivedNote";
import { PurchaseOrder } from "@/models/PurchaseOrder";
import { Supplier } from "@/models/Supplier";
import { Product } from "@/models/Product";
import { Batch } from "@/models/Batch";
import { BranchStock } from "@/models/BranchStock";
import { InventoryMovement } from "@/models/InventoryMovement";
import { AuditLog } from "@/models/AuditLog";
import { requireRole } from "@/lib/tenant";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "INVENTORY_CLERK", "SUPER_ADMIN"]);
    const { id } = params;

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const grn = await GoodsReceivedNote.findOne({ _id: id, businessId });
      if (!grn) {
        return NextResponse.json({ success: false, error: "Goods Received Note not found." }, { status: 404 });
      }

      if (grn.status === "CONFIRMED") {
        return NextResponse.json(
          { success: false, error: "This GRN has already been confirmed." },
          { status: 400 }
        );
      }

      if (grn.status === "CANCELLED") {
        return NextResponse.json(
          { success: false, error: "Cannot confirm a cancelled GRN." },
          { status: 400 }
        );
      }

      const po = await PurchaseOrder.findOne({ _id: grn.purchaseOrderId, businessId });
      if (!po) {
        return NextResponse.json(
          { success: false, error: "Linked Purchase Order not found." },
          { status: 404 }
        );
      }

      const supplier = await Supplier.findOne({ _id: grn.supplierId, businessId });

      let allPoItemsFullyReceived = true;

      for (const grnItem of grn.items) {
        const pidStr = grnItem.productId.toString();
        const poItem = po.items.find((pi) => pi.productId.toString() === pidStr);

        if (poItem) {
          const currentRec = poItem.quantityReceived || 0;
          const newCumulative = currentRec + grnItem.acceptedQuantity;
          poItem.quantityReceived = newCumulative;

          if (newCumulative < poItem.quantityOrdered) {
            allPoItemsFullyReceived = false;
          }
        }

        // 1. Update Product Stock for accepted goods
        if (grnItem.acceptedQuantity > 0) {
          const product = await Product.findOne({ _id: grnItem.productId, businessId });
          if (product) {
            const prev = product.stockQuantity || 0;
            const next = prev + grnItem.acceptedQuantity;
            product.stockQuantity = next;
            if (grnItem.unitCost > 0) product.costPrice = grnItem.unitCost;
            if (grnItem.sellingPrice && grnItem.sellingPrice > 0) {
              product.sellingPrice = grnItem.sellingPrice;
            }
            await product.save();

            // 2. BranchStock
            if (po.branchId) {
              let bStock = await BranchStock.findOne({
                businessId,
                branchId: po.branchId,
                productId: grnItem.productId,
              });
              if (bStock) {
                bStock.quantity += grnItem.acceptedQuantity;
                await bStock.save();
              } else {
                await BranchStock.create({
                  businessId,
                  branchId: po.branchId,
                  productId: grnItem.productId,
                  quantity: grnItem.acceptedQuantity,
                });
              }
            }

            // 3. Batch
            if (grnItem.batchNumber && grnItem.expiryDate) {
              await Batch.create({
                businessId,
                productId: product._id,
                productName: product.name,
                productBarcode: product.barcode,
                productSku: product.sku,
                batchNumber: grnItem.batchNumber,
                manufacturingDate: grnItem.manufacturingDate,
                expiryDate: grnItem.expiryDate,
                costPrice: grnItem.unitCost,
                sellingPrice: grnItem.sellingPrice || product.sellingPrice,
                mrp: grnItem.mrp,
                initialQuantity: grnItem.acceptedQuantity,
                quantityAvailable: grnItem.acceptedQuantity,
                quantitySold: 0,
                quantityDamaged: 0,
                status: "ACTIVE",
                supplierId: po.supplierId,
                supplierName: po.supplierName,
                purchaseOrderId: po._id,
                poNumber: po.poNumber,
                branchId: po.branchId,
                branchName: po.branchName,
                notes: `GRN Intake ${grn.grnNumber}`,
              });
              product.isBatchTracked = true;
              await product.save();
            }

            // 4. Movement
            await InventoryMovement.create({
              businessId,
              productId: product._id,
              branchId: po.branchId,
              type: "RESTOCK",
              quantityChange: grnItem.acceptedQuantity,
              previousStock: prev,
              newStock: next,
              reason: `GRN Intake ${grn.grnNumber} (PO ${po.poNumber}) from ${po.supplierName}`,
              referenceId: grn.grnNumber,
              createdBy: context.userId,
            });
          }
        }

        // 5. Quarantined Batch for rejected items
        if (grnItem.rejectedQuantity > 0) {
          const product = await Product.findOne({ _id: grnItem.productId, businessId });
          if (product && grnItem.batchNumber && grnItem.expiryDate) {
            await Batch.create({
              businessId,
              productId: product._id,
              productName: product.name,
              productBarcode: product.barcode,
              productSku: product.sku,
              batchNumber: `${grnItem.batchNumber}-REJ`,
              manufacturingDate: grnItem.manufacturingDate,
              expiryDate: grnItem.expiryDate,
              costPrice: grnItem.unitCost,
              sellingPrice: product.sellingPrice,
              initialQuantity: grnItem.rejectedQuantity,
              quantityAvailable: 0,
              quantitySold: 0,
              quantityDamaged: grnItem.rejectedQuantity,
              status: "QUARANTINED",
              supplierId: po.supplierId,
              supplierName: po.supplierName,
              purchaseOrderId: po._id,
              poNumber: po.poNumber,
              branchId: po.branchId,
              branchName: po.branchName,
              quarantineReason: `Rejected at dock: ${grnItem.rejectionReason}. ${grnItem.rejectionNotes || ""}`,
              quarantinedAt: new Date(),
              quarantinedBy: context.username || "Warehouse QC",
              notes: `Quarantined during GRN ${grn.grnNumber}`,
            });
          }
        }
      }

      // Update PO
      po.status = allPoItemsFullyReceived ? "RECEIVED" : "PARTIALLY_RECEIVED";
      po.receivedAt = new Date();
      po.receivedBy = context.username || "Warehouse Manager";
      if (grn.supplierInvoiceNumber) po.supplierInvoiceNumber = grn.supplierInvoiceNumber;
      await po.save();

      // Credit Supplier balance
      if (supplier && grn.totalAcceptedCost > 0) {
        supplier.currentBalance = (supplier.currentBalance || 0) + grn.totalAcceptedCost;
        await supplier.save();
      }

      // Mark GRN CONFIRMED
      grn.status = "CONFIRMED";
      grn.confirmedBy = context.username || "Warehouse Manager";
      grn.confirmedAt = new Date();
      await grn.save();

      // Audit Log
      await AuditLog.create({
        businessId,
        action: "GRN_CONFIRMED",
        entity: "GOODS_RECEIVED_NOTE",
        entityId: grn._id.toString(),
        userId: context.userId,
        details: {
          grnNumber: grn.grnNumber,
          poNumber: po.poNumber,
          supplierName: po.supplierName,
          totalAcceptedCost: grn.totalAcceptedCost,
          totalRejectedCost: grn.totalRejectedCost,
        },
      });

      return NextResponse.json({
        success: true,
        grn,
        message: `GRN ${grn.grnNumber} confirmed. Rs. ${grn.totalAcceptedCost.toLocaleString()} credited to ${po.supplierName}.`,
      });
    }

    return NextResponse.json({ success: true, message: "Demo: GRN confirmed." });
  } catch (error: any) {
    console.error("Error in POST /api/grn/[id]/confirm:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to confirm GRN" },
      { status: error.status || 500 }
    );
  }
}
