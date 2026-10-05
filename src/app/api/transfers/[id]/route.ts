import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { StockTransfer, generateTransferManifestToken } from "@/models/StockTransfer";
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
      const isObjectId = mongoose.Types.ObjectId.isValid(id);
      const query: any = { businessId: context.businessId };

      if (isObjectId) {
        query.$or = [{ _id: id }, { manifestToken: id }, { transferNumber: id }];
      } else {
        query.$or = [{ manifestToken: id }, { transferNumber: id }];
      }

      const transfer = await StockTransfer.findOne(query).lean();
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

    if (!["DISPATCH", "RECEIVE", "CANCEL", "RESOLVE_DISCREPANCY"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "Invalid action. Supported actions: DISPATCH, RECEIVE, CANCEL, RESOLVE_DISCREPANCY." },
        { status: 400 }
      );
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const isObjectId = mongoose.Types.ObjectId.isValid(id);
      const query: any = { businessId };
      if (isObjectId) {
        query.$or = [{ _id: id }, { manifestToken: id }, { transferNumber: id }];
      } else {
        query.$or = [{ manifestToken: id }, { transferNumber: id }];
      }

      const transfer = await StockTransfer.findOne(query);
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
        transfer.gatePassOutTime = body.gatePassOutTime ? new Date(body.gatePassOutTime) : new Date();

        if (body.carrierName) transfer.carrierName = body.carrierName.trim();
        if (body.trackingReference) transfer.trackingReference = body.trackingReference.trim();
        if (body.vehicleNumber) transfer.vehicleNumber = body.vehicleNumber.trim();
        if (body.driverName) transfer.driverName = body.driverName.trim();
        if (body.driverPhone) transfer.driverPhone = body.driverPhone.trim();
        if (body.estimatedArrival) transfer.estimatedArrival = new Date(body.estimatedArrival);
        if (!transfer.manifestToken) transfer.manifestToken = generateTransferManifestToken();
        if (body.notes) transfer.notes = body.notes.trim();

        // Calculate totalTransitValue if missing
        if (!transfer.totalTransitValue || transfer.totalTransitValue === 0) {
          transfer.totalTransitValue = Math.round(
            transfer.items.reduce((sum, it) => sum + (it.quantitySent * (it.unitCost || 0)), 0) * 100
          ) / 100;
        }

        await transfer.save();

        await AuditLog.create({
          businessId,
          action: "STOCK_TRANSFER_DISPATCHED",
          entity: "STOCK_TRANSFER",
          entityId: transfer._id.toString(),
          userId: context.userId,
          details: {
            transferNumber: transfer.transferNumber,
            carrier: transfer.carrierName,
            vehicleNumber: transfer.vehicleNumber,
            driverName: transfer.driverName,
            totalTransitValue: transfer.totalTransitValue,
          },
        });

        return NextResponse.json({
          success: true,
          transfer,
          message: `Transfer ${transfer.transferNumber} marked as IN_TRANSIT with Gate Pass generated.`,
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

        const receivedItemsMap = new Map<string, any>();
        if (Array.isArray(body.receivedItems)) {
          body.receivedItems.forEach((ri: any) => {
            if (ri.productId) {
              receivedItemsMap.set(ri.productId.toString(), {
                quantityReceived: typeof ri.quantityReceived === "number" ? Math.max(0, ri.quantityReceived) : undefined,
                quantityDamagedInTransit: typeof ri.quantityDamagedInTransit === "number" ? Math.max(0, ri.quantityDamagedInTransit) : 0,
                discrepancyReason: ri.discrepancyReason || undefined,
                discrepancyAction: ri.discrepancyAction || undefined,
                discrepancyNotes: ri.discrepancyNotes?.trim() || undefined,
                batchNumber: ri.batchNumber?.trim() || undefined,
                expiryDate: ri.expiryDate ? new Date(ri.expiryDate) : undefined,
              });
            }
          });
        }

        let totalReceived = 0;
        let totalReceivedValue = 0;
        let hasShortage = false;
        let hasOverage = false;
        let hasDamaged = false;
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
          const receivedData = receivedItemsMap.get(pidStr);

          const qtyRec =
            receivedData && typeof receivedData.quantityReceived === "number"
              ? receivedData.quantityReceived
              : item.quantitySent;
          const qtyDamaged = receivedData?.quantityDamagedInTransit || 0;

          const unitCost = item.unitCost || 0;
          const itemSentCost = item.totalSentCost || Math.round(item.quantitySent * unitCost * 100) / 100;
          const itemRecCost = Math.round(qtyRec * unitCost * 100) / 100;

          // Determine line discrepancy reason & action
          let reason = receivedData?.discrepancyReason || "NONE";
          let actionToTake = receivedData?.discrepancyAction || "NONE";

          if (qtyDamaged > 0) {
            hasDamaged = true;
            if (reason === "NONE") reason = "DAMAGED_IN_TRANSIT";
          }
          if (qtyRec < item.quantitySent) {
            hasShortage = true;
            if (reason === "NONE") reason = "SHORTAGE_IN_TRANSIT";
          } else if (qtyRec > item.quantitySent) {
            hasOverage = true;
            if (reason === "NONE") reason = "OVER_DELIVERED";
          }

          totalReceived += qtyRec;
          totalReceivedValue += itemRecCost;

          // Increment destination branch stock by qtyRec
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
            barcode: item.barcode || item.sku,
            unit: item.unit,
            quantitySent: item.quantitySent,
            quantityReceived: qtyRec,
            quantityDamagedInTransit: qtyDamaged,
            unitCost,
            totalSentCost: itemSentCost,
            totalReceivedCost: itemRecCost,
            discrepancyReason: reason,
            discrepancyAction: actionToTake,
            discrepancyNotes: receivedData?.discrepancyNotes || item.discrepancyNotes,
            batchNumber: receivedData?.batchNumber || item.batchNumber,
            expiryDate: receivedData?.expiryDate || item.expiryDate,
            notes: item.notes,
          });
        }

        transfer.items = updatedItems as any;
        transfer.totalItemsReceived = totalReceived;
        transfer.totalReceivedValue = Math.round(totalReceivedValue * 100) / 100;

        const transitVal =
          transfer.totalTransitValue ||
          Math.round(
            transfer.items.reduce((sum, it) => sum + (it.quantitySent * (it.unitCost || 0)), 0) * 100
          ) / 100;
        transfer.totalTransitValue = transitVal;

        // Discrepancy value
        const discrepancyVal = Math.max(0, Math.round((transitVal - totalReceivedValue) * 100) / 100);
        transfer.totalDiscrepancyValue = discrepancyVal;

        let discrepancyStatus: "NO_DISCREPANCY" | "SHORTAGE" | "OVERAGE" | "DAMAGED" = "NO_DISCREPANCY";
        if (hasDamaged) {
          discrepancyStatus = "DAMAGED";
        } else if (hasShortage) {
          discrepancyStatus = "SHORTAGE";
        } else if (hasOverage) {
          discrepancyStatus = "OVERAGE";
        }

        transfer.discrepancyStatus = discrepancyStatus;
        transfer.discrepancyResolved = discrepancyStatus === "NO_DISCREPANCY";
        transfer.status = "COMPLETED";
        transfer.receivedBy = context.username || "Receiving Officer";
        transfer.receivedAt = new Date();
        if (body.notes) transfer.notes = body.notes.trim();

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
            discrepancyStatus,
            totalTransitValue: transitVal,
            totalReceivedValue,
            totalDiscrepancyValue: discrepancyVal,
          },
        });

        return NextResponse.json({
          success: true,
          transfer,
          message: `Transfer ${transfer.transferNumber} received successfully with discrepancy status: ${discrepancyStatus}.`,
        });
      }

      // ----------------- ACTION: RESOLVE_DISCREPANCY -----------------
      if (action === "RESOLVE_DISCREPANCY") {
        if (transfer.status !== "COMPLETED") {
          return NextResponse.json(
            { success: false, error: "Only completed transfers can have discrepancies resolved." },
            { status: 400 }
          );
        }

        const { resolutionNotes, resolutionAction, itemsResolution } = body;

        transfer.discrepancyResolved = true;
        transfer.discrepancyResolvedBy = context.username || "Manager";
        transfer.discrepancyResolvedAt = new Date();
        transfer.discrepancyResolutionNotes = resolutionNotes?.trim() || "Discrepancy settled and reconciled.";

        if (Array.isArray(itemsResolution)) {
          const resMap = new Map(itemsResolution.map((r: any) => [r.productId?.toString(), r]));
          transfer.items = transfer.items.map((it) => {
            const rData = resMap.get(it.productId?.toString());
            if (rData) {
              if (rData.discrepancyAction) it.discrepancyAction = rData.discrepancyAction;
              if (rData.discrepancyNotes) it.discrepancyNotes = rData.discrepancyNotes;
            } else if (resolutionAction) {
              it.discrepancyAction = resolutionAction;
            }
            return it;
          }) as any;
        } else if (resolutionAction) {
          transfer.items = transfer.items.map((it) => {
            it.discrepancyAction = resolutionAction;
            return it;
          }) as any;
        }

        await transfer.save();

        await AuditLog.create({
          businessId,
          action: "STOCK_TRANSFER_DISCREPANCY_RESOLVED",
          entity: "STOCK_TRANSFER",
          entityId: transfer._id.toString(),
          userId: context.userId,
          details: {
            transferNumber: transfer.transferNumber,
            resolutionNotes: transfer.discrepancyResolutionNotes,
            resolutionAction: resolutionAction || "RECONCILED",
            resolvedBy: transfer.discrepancyResolvedBy,
          },
        });

        return NextResponse.json({
          success: true,
          transfer,
          message: `Discrepancy for ${transfer.transferNumber} has been successfully resolved.`,
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
