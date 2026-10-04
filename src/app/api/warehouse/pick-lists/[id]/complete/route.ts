import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { PickList } from "@/models/PickList";
import { BinStock } from "@/models/BinStock";
import { WarehouseBin } from "@/models/WarehouseBin";
import { StockTransfer } from "@/models/StockTransfer";
import { AuditLog } from "@/models/AuditLog";
import { requireRole } from "@/lib/tenant";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "INVENTORY_CLERK", "SUPER_ADMIN"]);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { dispatchImmediately = false } = body;

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const pickList = await PickList.findOne({ _id: id, businessId });
      if (!pickList) {
        return NextResponse.json(
          { success: false, error: "Pick list not found." },
          { status: 404 }
        );
      }

      if (pickList.status === "DISPATCHED") {
        return NextResponse.json(
          { success: false, error: "This pick list is already dispatched." },
          { status: 400 }
        );
      }

      // Deduct picked stock from BinStock and reduce WarehouseBin occupancy
      for (const item of pickList.items) {
        const pickedQty = item.quantityPicked || 0;
        const requestedQty = item.quantityRequested || 0;

        // Release reserved quantity and deduct actual inventory
        const stockQuery: any = {
          businessId,
          branchId: pickList.sourceBranchId,
          binId: item.binId,
          productId: item.productId,
        };
        if (item.batchNumber) {
          stockQuery.batchNumber = item.batchNumber;
        }

        const binStock = await BinStock.findOne(stockQuery);
        if (binStock) {
          binStock.reservedQuantity = Math.max(0, (binStock.reservedQuantity || 0) - requestedQty);
          binStock.quantity = Math.max(0, binStock.quantity - pickedQty);
          await binStock.save();
        }

        // Update warehouse bin occupancy
        if (pickedQty > 0) {
          const bin = await WarehouseBin.findOne({ _id: item.binId, businessId });
          if (bin) {
            const cur = Math.max(0, (bin.currentOccupancy.totalUnits || 0) - pickedQty);
            const max = bin.capacity.maxUnits || 1;
            bin.currentOccupancy.totalUnits = cur;
            bin.currentOccupancy.utilizationPercent = Math.min(100, Math.round((cur / max) * 100));
            if (bin.currentOccupancy.utilizationPercent < 85 && (bin.status === "FULL" || bin.status === "NEAR_FULL")) {
              bin.status = "AVAILABLE";
            }
            await bin.save();
          }
        }
      }

      pickList.status = dispatchImmediately ? "DISPATCHED" : "PICKED";
      pickList.completedAt = new Date();
      await pickList.save();

      // If linked to a StockTransfer, update transfer status to IN_TRANSIT if dispatching
      if (pickList.referenceId && dispatchImmediately) {
        await StockTransfer.updateOne(
          { _id: pickList.referenceId, businessId },
          {
            $set: {
              status: "IN_TRANSIT",
              shippedAt: new Date(),
            },
          }
        );
      }

      await AuditLog.create({
        businessId,
        userId: context.userId,
        action: "COMPLETE_PICK_LIST",
        entity: "PickList",
        entityId: pickList._id,
        details: `Completed pick list ${pickList.pickListNumber}. Total picked: ${pickList.pickedUnits}/${pickList.totalUnits} units.`,
      });

      return NextResponse.json({
        success: true,
        message: `Pick list ${pickList.pickListNumber} completed successfully.`,
        pickList,
      });
    }

    return NextResponse.json(
      { success: false, error: "Database unavailable." },
      { status: 503 }
    );
  } catch (error: any) {
    console.error("Error in POST /api/warehouse/pick-lists/[id]/complete:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to complete pick list" },
      { status: 500 }
    );
  }
}
