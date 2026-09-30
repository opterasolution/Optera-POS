import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { StockTransfer } from "@/models/StockTransfer";
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
      const transfer = await StockTransfer.findOne({ _id: id, businessId: context.businessId }).lean();
      if (!transfer) {
        return NextResponse.json({ success: false, error: "Transfer not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, transfer });
    }

    return NextResponse.json({ success: true, transfer: { _id: id, transferNumber: "STN-DEMO-0001" } });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch transfer" },
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

    if (!["DISPATCH", "RECEIVE", "CANCEL"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "Invalid action. Supported actions: DISPATCH, RECEIVE, CANCEL." },
        { status: 400 }
      );
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const transfer = await StockTransfer.findOne({ _id: id, businessId });
      if (!transfer) {
        return NextResponse.json({ success: false, error: "Transfer not found." }, { status: 404 });
      }

      // ----------------- ACTION: DISPATCH -----------------
      if (action === "DISPATCH") {
        if (transfer.status !== "DRAFT") {
          return NextResponse.json(
            { success: false, error: `Cannot dispatch transfer in "${transfer.status}" status.` },
            { status: 400 }
          );
        }

        // Verify source stock availability
        const productIds = transfer.items.map((i) => i.productId);
        const sourceStocks = await BranchStock.find({
          businessId,
          branchId: transfer.sourceBranchId,
          productId: { $in: productIds },
        });
        const stockMap = new Map(sourceStocks.map((s) => [s.productId.toString(), s]));

        for (const item of transfer.items) {
          const sStock = stockMap.get(item.productId.toString());
          const available = sStock ? sStock.quantity : 0;
          if (available < item.quantitySent) {
            return NextResponse.json(
              {
                success: false,
                error: `Cannot dispatch: Insufficient stock for "${item.name}" at source branch. Available: ${available}, Required: ${item.quantitySent}.`,
              },
              { status: 400 }
            );
          }
        }

        // Deduct source branch stock & record movement
        for (const item of transfer.items) {
          const sStock = stockMap.get(item.productId.toString());
          const prev = sStock ? sStock.quantity : 0;
          const next = prev - item.quantitySent;

          if (sStock) {
            sStock.quantity = next;
            await sStock.save();
          } else {
            await BranchStock.create({
              businessId,
              branchId: transfer.sourceBranchId,
              productId: item.productId,
              quantity: next,
            });
          }

          await InventoryMovement.create({
            businessId,
            productId: item.productId,
            branchId: transfer.sourceBranchId,
            transferId: transfer._id,
            type: "TRANSFER_OUT",
            quantityChange: -item.quantitySent,
            previousStock: prev,
            newStock: next,
            reason: `Dispatched to ${transfer.destinationBranchName} (${transfer.transferNumber})`,
            referenceId: transfer.transferNumber,
            createdBy: context.userId,
          });
        }

        transfer.status = "IN_TRANSIT";
        transfer.dispatchedBy = context.username || "Manager";
        transfer.dispatchedAt = new Date();
        if (body.carrierName) transfer.carrierName = body.carrierName.trim();
        if (body.trackingReference) transfer.trackingReference = body.trackingReference.trim();
        if (body.notes) transfer.notes = body.notes.trim();

        await transfer.save();

        await AuditLog.create({
          businessId,
          action: "STOCK_TRANSFER_DISPATCHED",
          entity: "STOCK_TRANSFER",
          entityId: transfer._id.toString(),
          userId: context.userId,
          details: { transferNumber: transfer.transferNumber, carrier: transfer.carrierName },
        });

        return NextResponse.json({
          success: true,
          transfer,
          message: `Transfer ${transfer.transferNumber} marked as IN_TRANSIT.`,
        });
      }

      // ----------------- ACTION: RECEIVE -----------------
      if (action === "RECEIVE") {
        if (transfer.status !== "IN_TRANSIT") {
          return NextResponse.json(
            { success: false, error: `Cannot receive transfer in "${transfer.status}" status (must be IN_TRANSIT).` },
            { status: 400 }
          );
        }

        const receivedItemsMap = new Map<string, number>();
        if (Array.isArray(body.receivedItems)) {
          body.receivedItems.forEach((ri: any) => {
            if (ri.productId && typeof ri.quantityReceived === "number") {
              receivedItemsMap.set(ri.productId.toString(), Math.max(0, ri.quantityReceived));
            }
          });
        }

        let totalReceived = 0;
        const updatedItems = [];

        // Fetch destination branch stock records
        const productIds = transfer.items.map((i) => i.productId);
        const destStocks = await BranchStock.find({
          businessId,
          branchId: transfer.destinationBranchId,
          productId: { $in: productIds },
        });
        const destStockMap = new Map(destStocks.map((s) => [s.productId.toString(), s]));

        for (const item of transfer.items) {
          const pidStr = item.productId.toString();
          const qtyRec = receivedItemsMap.has(pidStr)
            ? (receivedItemsMap.get(pidStr) as number)
            : item.quantitySent;

          totalReceived += qtyRec;

          // Increment destination branch stock
          let dStock = destStockMap.get(pidStr);
          const prev = dStock ? dStock.quantity : 0;
          const next = prev + qtyRec;

          if (dStock) {
            dStock.quantity = next;
            await dStock.save();
          } else {
            dStock = await BranchStock.create({
              businessId,
              branchId: transfer.destinationBranchId,
              productId: item.productId,
              quantity: next,
            });
          }

          // Record Inventory Movement
          await InventoryMovement.create({
            businessId,
            productId: item.productId,
            branchId: transfer.destinationBranchId,
            transferId: transfer._id,
            type: "TRANSFER_IN",
            quantityChange: qtyRec,
            previousStock: prev,
            newStock: next,
            reason: `Received from ${transfer.sourceBranchName} (${transfer.transferNumber})`,
            referenceId: transfer.transferNumber,
            createdBy: context.userId,
          });

          updatedItems.push({
            productId: item.productId,
            name: item.name,
            sku: item.sku,
            unit: item.unit,
            quantitySent: item.quantitySent,
            quantityReceived: qtyRec,
            unitCost: item.unitCost,
            notes: item.notes,
          });
        }

        transfer.items = updatedItems as any;
        transfer.totalItemsReceived = totalReceived;
        transfer.status = "COMPLETED";
        transfer.receivedBy = context.username || "Receiving Officer";
        transfer.receivedAt = new Date();

        await transfer.save();

        await AuditLog.create({
          businessId,
          action: "STOCK_TRANSFER_RECEIVED",
          entity: "STOCK_TRANSFER",
          entityId: transfer._id.toString(),
          userId: context.userId,
          details: {
            transferNumber: transfer.transferNumber,
            totalSent: transfer.totalItemsSent,
            totalReceived,
            discrepancy: transfer.totalItemsSent - totalReceived,
          },
        });

        return NextResponse.json({
          success: true,
          transfer,
          message: `Transfer ${transfer.transferNumber} received successfully at ${transfer.destinationBranchName}.`,
        });
      }

      // ----------------- ACTION: CANCEL -----------------
      if (action === "CANCEL") {
        if (transfer.status === "COMPLETED") {
          return NextResponse.json(
            { success: false, error: "Completed transfers cannot be cancelled." },
            { status: 400 }
          );
        }
        if (transfer.status === "CANCELLED") {
          return NextResponse.json(
            { success: false, error: "Transfer is already cancelled." },
            { status: 400 }
          );
        }

        // If transfer was IN_TRANSIT, return stock to source branch
        if (transfer.status === "IN_TRANSIT") {
          const productIds = transfer.items.map((i) => i.productId);
          const sourceStocks = await BranchStock.find({
            businessId,
            branchId: transfer.sourceBranchId,
            productId: { $in: productIds },
          });
          const stockMap = new Map(sourceStocks.map((s) => [s.productId.toString(), s]));

          for (const item of transfer.items) {
            const sStock = stockMap.get(item.productId.toString());
            const prev = sStock ? sStock.quantity : 0;
            const next = prev + item.quantitySent;

            if (sStock) {
              sStock.quantity = next;
              await sStock.save();
            } else {
              await BranchStock.create({
                businessId,
                branchId: transfer.sourceBranchId,
                productId: item.productId,
                quantity: next,
              });
            }

            await InventoryMovement.create({
              businessId,
              productId: item.productId,
              branchId: transfer.sourceBranchId,
              transferId: transfer._id,
              type: "TRANSFER_IN",
              quantityChange: item.quantitySent,
              previousStock: prev,
              newStock: next,
              reason: `Reversal of cancelled transfer (${transfer.transferNumber})`,
              referenceId: transfer.transferNumber,
              createdBy: context.userId,
            });
          }
        }

        transfer.status = "CANCELLED";
        transfer.cancelledBy = context.username || "Manager";
        transfer.cancelledAt = new Date();
        transfer.cancellationReason = body.cancellationReason?.trim() || "Cancelled by store manager";

        await transfer.save();

        await AuditLog.create({
          businessId,
          action: "STOCK_TRANSFER_CANCELLED",
          entity: "STOCK_TRANSFER",
          entityId: transfer._id.toString(),
          userId: context.userId,
          details: { transferNumber: transfer.transferNumber, reason: transfer.cancellationReason },
        });

        return NextResponse.json({
          success: true,
          transfer,
          message: `Transfer ${transfer.transferNumber} has been cancelled.`,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Demo: Action processed.",
    });
  } catch (error: any) {
    console.error("Error processing transfer action:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process transfer action" },
      { status: error.status || 500 }
    );
  }
}
