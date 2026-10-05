import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { SupplierDebitNote } from "@/models/SupplierDebitNote";
import { Supplier } from "@/models/Supplier";
import { Product } from "@/models/Product";
import { BranchStock } from "@/models/BranchStock";
import { InventoryMovement } from "@/models/InventoryMovement";
import { AuditLog } from "@/models/AuditLog";
import { requireRole } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPER_ADMIN"]);
    const { id } = params;
    const body = await req.json();

    const {
      action,
      distributorRepName,
      distributorVehicleNumber,
      distributorCreditNoteNumber,
      rejectionReason,
      notes,
      restockReplacement = true, // Whether to add replacement stock back to store inventory
      revertInventory = false, // Whether to put stock back if debit note was rejected/cancelled
    } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, error: "Action parameter is required." },
        { status: 400 }
      );
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const debitNote = await SupplierDebitNote.findOne({ _id: id, businessId });
      if (!debitNote) {
        return NextResponse.json(
          { success: false, error: "Supplier Debit Note not found." },
          { status: 404 }
        );
      }

      switch (action) {
        case "ISSUE": {
          if (debitNote.status !== "DRAFT") {
            return NextResponse.json(
              { success: false, error: "Only DRAFT debit notes can be issued for handover." },
              { status: 400 }
            );
          }

          // Deduct live store inventory for items marked deductInventory
          for (const item of debitNote.items) {
            if (item.deductInventory && !item.inventoryDeducted) {
              const product = await Product.findOne({ _id: item.productId, businessId });
              if (product) {
                const prev = product.stockQuantity;
                const next = Math.max(0, prev - item.quantity);
                product.stockQuantity = next;
                await product.save();

                if (debitNote.branchId) {
                  await BranchStock.findOneAndUpdate(
                    { businessId, branchId: debitNote.branchId, productId: item.productId },
                    { $inc: { quantity: -item.quantity } }
                  );
                }

                await InventoryMovement.create({
                  businessId,
                  productId: item.productId,
                  branchId: debitNote.branchId,
                  type: "SUPPLIER_RETURN",
                  quantityChange: -item.quantity,
                  previousStock: prev,
                  newStock: next,
                  reason: `Supplier Return (${debitNote.debitNoteNumber}): ${item.reason}`,
                  referenceId: debitNote.debitNoteNumber,
                });

                item.inventoryDeducted = true;
              }
            }
          }

          debitNote.status = "ISSUED";
          debitNote.handoverDate = new Date();
          if (distributorRepName) debitNote.distributorRepName = distributorRepName;
          if (distributorVehicleNumber) debitNote.distributorVehicleNumber = distributorVehicleNumber.toUpperCase();
          if (notes) debitNote.notes = notes;
          await debitNote.save();

          await AuditLog.create({
            businessId,
            userName: context.username || "System",
            action: "DEBIT_NOTE_ISSUED",
            entityType: "SupplierDebitNote",
            entityId: debitNote._id.toString(),
            details: {
              debitNoteNumber: debitNote.debitNoteNumber,
              distributorRepName: debitNote.distributorRepName,
              distributorVehicleNumber: debitNote.distributorVehicleNumber,
            },
          });

          return NextResponse.json({
            success: true,
            debitNote,
            message: `Debit Note ${debitNote.debitNoteNumber} issued and inventory deducted.`,
          });
        }

        case "APPLY_CREDIT": {
          if (debitNote.status !== "ISSUED") {
            return NextResponse.json(
              { success: false, error: "Only ISSUED debit notes can be applied as AP credit offset." },
              { status: 400 }
            );
          }

          const supplier = await Supplier.findOne({ _id: debitNote.supplierId, businessId });
          if (!supplier) {
            return NextResponse.json(
              { success: false, error: "Linked supplier not found." },
              { status: 404 }
            );
          }

          // Deduct net debit amount from supplier accounts payable balance
          const balanceBefore = supplier.currentBalance || 0;
          const balanceAfter = Math.max(0, balanceBefore - debitNote.netTotal);
          supplier.currentBalance = balanceAfter;
          await supplier.save();

          debitNote.status = "APPLIED";
          debitNote.settlementType = "AP_CREDIT_OFFSET";
          debitNote.settledAt = new Date();
          debitNote.settledBy = context.username || "Store Manager";
          if (distributorCreditNoteNumber) {
            debitNote.distributorCreditNoteNumber = distributorCreditNoteNumber;
          }
          await debitNote.save();

          await AuditLog.create({
            businessId,
            userName: context.username || "System",
            action: "DEBIT_NOTE_APPLIED_AP_CREDIT",
            entityType: "SupplierDebitNote",
            entityId: debitNote._id.toString(),
            details: {
              debitNoteNumber: debitNote.debitNoteNumber,
              supplierName: supplier.name,
              amountCredited: debitNote.netTotal,
              balanceBefore,
              balanceAfter,
              distributorCreditNoteNumber: debitNote.distributorCreditNoteNumber,
            },
          });

          return NextResponse.json({
            success: true,
            debitNote,
            supplierCurrentBalance: supplier.currentBalance,
            message: `Rs. ${debitNote.netTotal.toLocaleString()} successfully credited against accounts payable debt for ${supplier.name}.`,
          });
        }

        case "CONFIRM_REPLACEMENT": {
          if (debitNote.status !== "ISSUED") {
            return NextResponse.json(
              { success: false, error: "Only ISSUED debit notes can be marked as replaced." },
              { status: 400 }
            );
          }

          // If restockReplacement is true, add returned items back to store stock
          if (restockReplacement) {
            for (const item of debitNote.items) {
              const product = await Product.findOne({ _id: item.productId, businessId });
              if (product) {
                const prev = product.stockQuantity;
                const next = prev + item.quantity;
                product.stockQuantity = next;
                await product.save();

                if (debitNote.branchId) {
                  await BranchStock.findOneAndUpdate(
                    { businessId, branchId: debitNote.branchId, productId: item.productId },
                    { $inc: { quantity: item.quantity } }
                  );
                }

                await InventoryMovement.create({
                  businessId,
                  productId: item.productId,
                  branchId: debitNote.branchId,
                  type: "RESTOCK",
                  quantityChange: item.quantity,
                  previousStock: prev,
                  newStock: next,
                  reason: `Supplier Replacement Stock (${debitNote.debitNoteNumber})`,
                  referenceId: debitNote.debitNoteNumber,
                });
              }
            }
          }

          debitNote.status = "APPLIED";
          debitNote.settlementType = "REPLACEMENT";
          debitNote.replacementReceived = true;
          debitNote.settledAt = new Date();
          debitNote.settledBy = context.username || "Store Manager";
          if (notes) debitNote.notes = notes;
          await debitNote.save();

          await AuditLog.create({
            businessId,
            userName: context.username || "System",
            action: "DEBIT_NOTE_REPLACEMENT_RECEIVED",
            entityType: "SupplierDebitNote",
            entityId: debitNote._id.toString(),
            details: {
              debitNoteNumber: debitNote.debitNoteNumber,
              restocked: restockReplacement,
            },
          });

          return NextResponse.json({
            success: true,
            debitNote,
            message: `Replacement goods recorded and marked as completed for ${debitNote.debitNoteNumber}.`,
          });
        }

        case "CONFIRM_REFUND": {
          if (debitNote.status !== "ISSUED") {
            return NextResponse.json(
              { success: false, error: "Only ISSUED debit notes can be settled as cash/cheque refund." },
              { status: 400 }
            );
          }

          debitNote.status = "APPLIED";
          debitNote.settlementType = "REFUND";
          debitNote.settledAt = new Date();
          debitNote.settledBy = context.username || "Store Manager";
          if (notes) debitNote.notes = notes;
          await debitNote.save();

          await AuditLog.create({
            businessId,
            userName: context.username || "System",
            action: "DEBIT_NOTE_REFUND_SETTLED",
            entityType: "SupplierDebitNote",
            entityId: debitNote._id.toString(),
            details: {
              debitNoteNumber: debitNote.debitNoteNumber,
              refundAmount: debitNote.netTotal,
            },
          });

          return NextResponse.json({
            success: true,
            debitNote,
            message: `Cash / cheque refund recorded for ${debitNote.debitNoteNumber}.`,
          });
        }

        case "REJECT": {
          if (debitNote.status === "APPLIED") {
            return NextResponse.json(
              { success: false, error: "Cannot reject a debit note that has already been applied." },
              { status: 400 }
            );
          }

          // If inventory was previously deducted and merchant wishes to revert
          if (revertInventory) {
            for (const item of debitNote.items) {
              if (item.inventoryDeducted) {
                const product = await Product.findOne({ _id: item.productId, businessId });
                if (product) {
                  const prev = product.stockQuantity;
                  const next = prev + item.quantity;
                  product.stockQuantity = next;
                  await product.save();

                  if (debitNote.branchId) {
                    await BranchStock.findOneAndUpdate(
                      { businessId, branchId: debitNote.branchId, productId: item.productId },
                      { $inc: { quantity: item.quantity } }
                    );
                  }

                  await InventoryMovement.create({
                    businessId,
                    productId: item.productId,
                    branchId: debitNote.branchId,
                    type: "RESTOCK",
                    quantityChange: item.quantity,
                    previousStock: prev,
                    newStock: next,
                    reason: `Reversal of Rejected Debit Note (${debitNote.debitNoteNumber})`,
                    referenceId: debitNote.debitNoteNumber,
                  });

                  item.inventoryDeducted = false;
                }
              }
            }
          }

          debitNote.status = "REJECTED";
          debitNote.rejectionReason = rejectionReason || "Rejected by distributor";
          await debitNote.save();

          await AuditLog.create({
            businessId,
            userName: context.username || "System",
            action: "DEBIT_NOTE_REJECTED",
            entityType: "SupplierDebitNote",
            entityId: debitNote._id.toString(),
            details: {
              debitNoteNumber: debitNote.debitNoteNumber,
              rejectionReason: debitNote.rejectionReason,
              revertedStock: revertInventory,
            },
          });

          return NextResponse.json({
            success: true,
            debitNote,
            message: `Debit Note marked as REJECTED.`,
          });
        }

        case "CANCEL": {
          if (debitNote.status === "APPLIED") {
            return NextResponse.json(
              { success: false, error: "Cannot cancel an AP-applied debit note." },
              { status: 400 }
            );
          }

          // Revert stock if inventory was already deducted
          for (const item of debitNote.items) {
            if (item.inventoryDeducted) {
              const product = await Product.findOne({ _id: item.productId, businessId });
              if (product) {
                const prev = product.stockQuantity;
                const next = prev + item.quantity;
                product.stockQuantity = next;
                await product.save();

                if (debitNote.branchId) {
                  await BranchStock.findOneAndUpdate(
                    { businessId, branchId: debitNote.branchId, productId: item.productId },
                    { $inc: { quantity: item.quantity } }
                  );
                }

                await InventoryMovement.create({
                  businessId,
                  productId: item.productId,
                  branchId: debitNote.branchId,
                  type: "RESTOCK",
                  quantityChange: item.quantity,
                  previousStock: prev,
                  newStock: next,
                  reason: `Cancellation of Debit Note (${debitNote.debitNoteNumber})`,
                  referenceId: debitNote.debitNoteNumber,
                });

                item.inventoryDeducted = false;
              }
            }
          }

          debitNote.status = "CANCELLED";
          await debitNote.save();

          await AuditLog.create({
            businessId,
            userName: context.username || "System",
            action: "DEBIT_NOTE_CANCELLED",
            entityType: "SupplierDebitNote",
            entityId: debitNote._id.toString(),
            details: { debitNoteNumber: debitNote.debitNoteNumber },
          });

          return NextResponse.json({
            success: true,
            debitNote,
            message: `Debit Note ${debitNote.debitNoteNumber} cancelled.`,
          });
        }

        default:
          return NextResponse.json(
            { success: false, error: `Unsupported action: ${action}` },
            { status: 400 }
          );
      }
    }

    return NextResponse.json({ success: true, message: "Action processed (Demo mode)." });
  } catch (error: any) {
    console.error("POST /api/purchases/debit-notes/[id]/action error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process debit note action" },
      { status: 500 }
    );
  }
}
