import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { GoodsReceivedNote } from "@/models/GoodsReceivedNote";
import { WarehouseBin } from "@/models/WarehouseBin";
import { BinStock } from "@/models/BinStock";
import { AuditLog } from "@/models/AuditLog";
import { requireRole } from "@/lib/tenant";

export async function POST(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "INVENTORY_CLERK", "SUPER_ADMIN"]);
    const body = await req.json();

    const { grnId, branchId, assignments } = body;

    if (!grnId || !Array.isArray(assignments) || assignments.length === 0) {
      return NextResponse.json(
        { success: false, error: "GRN ID and at least one putaway assignment are required." },
        { status: 400 }
      );
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const grn = await GoodsReceivedNote.findOne({ _id: grnId, businessId });
      if (!grn) {
        return NextResponse.json(
          { success: false, error: "Goods Received Note not found." },
          { status: 404 }
        );
      }

      for (const assignment of assignments) {
        const {
          itemId,
          productId,
          productName,
          sku,
          barcode,
          unit = "pcs",
          binId,
          quantity,
          batchNumber,
          expiryDate,
        } = assignment;

        if (!binId || !quantity || quantity <= 0) continue;

        const bin = await WarehouseBin.findOne({ _id: binId, businessId });
        if (!bin) continue;

        // 1. Find or create BinStock
        let binStock = await BinStock.findOne({
          businessId,
          branchId: bin.branchId,
          binId: bin._id,
          productId,
          ...(batchNumber ? { batchNumber } : {}),
        });

        if (binStock) {
          binStock.quantity += Number(quantity);
          if (expiryDate) binStock.expiryDate = new Date(expiryDate);
          await binStock.save();
        } else {
          binStock = await BinStock.create({
            businessId,
            branchId: bin.branchId,
            binId: bin._id,
            binCode: bin.binCode,
            productId,
            productName: productName || "Stock Item",
            sku,
            barcode,
            unit,
            batchNumber,
            expiryDate: expiryDate ? new Date(expiryDate) : undefined,
            quantity: Number(quantity),
            reservedQuantity: 0,
            isPrimaryPick: bin.binType === "PRIMARY_PICK",
            minReplenishThreshold: bin.binType === "PRIMARY_PICK" ? 15 : undefined,
            maxReplenishCapacity: bin.capacity.maxUnits,
          });
        }

        // 2. Update bin occupancy
        const curUnits = (bin.currentOccupancy?.totalUnits || 0) + Number(quantity);
        const maxUnits = bin.capacity?.maxUnits || 1;
        const utilization = Math.min(100, Math.round((curUnits / maxUnits) * 100));

        bin.currentOccupancy.totalUnits = curUnits;
        bin.currentOccupancy.utilizationPercent = utilization;
        if (utilization >= 100) {
          bin.status = "FULL";
        } else if (utilization >= 85) {
          bin.status = "NEAR_FULL";
        } else if (bin.status !== "MAINTENANCE" && bin.status !== "INACTIVE") {
          bin.status = "AVAILABLE";
        }
        await bin.save();

        // 3. Mark GRN item putaway info
        if (itemId) {
          const item = grn.items.find(
            (it: any) => it._id?.toString() === itemId || it.productId.toString() === productId
          );
          if (item) {
            item.putawayBinId = bin._id;
            item.putawayBinCode = bin.binCode;
            item.putawayStatus = "PUTAWAY_DONE";
          }
        }
      }

      // 4. Update overall GRN putaway status
      const allPutaway = grn.items.every(
        (it) => it.putawayStatus === "PUTAWAY_DONE" || (it.acceptedQuantity === 0 && it.rejectedQuantity === 0)
      );
      grn.putawayStatus = allPutaway ? "COMPLETED" : "PARTIAL";
      await grn.save();

      await AuditLog.create({
        businessId,
        userId: context.userId,
        action: "CONFIRM_GRN_PUTAWAY",
        entity: "GoodsReceivedNote",
        entityId: grn._id,
        details: `Confirmed putaway for GRN ${grn.grnNumber}. Updated bin inventory.`,
      });

      return NextResponse.json({
        success: true,
        message: "Putaway successfully recorded and warehouse bins updated.",
        grn,
      });
    }

    return NextResponse.json(
      { success: false, error: "Database unavailable." },
      { status: 503 }
    );
  } catch (error: any) {
    console.error("Error in POST /api/warehouse/putaway/confirm:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to confirm putaway" },
      { status: 500 }
    );
  }
}
