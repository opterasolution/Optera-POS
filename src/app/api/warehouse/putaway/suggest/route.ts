import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { GoodsReceivedNote } from "@/models/GoodsReceivedNote";
import { WarehouseBin, IWarehouseBin } from "@/models/WarehouseBin";
import { BinStock } from "@/models/BinStock";
import { Branch } from "@/models/Branch";
import { requireAuth } from "@/lib/tenant";

export async function POST(req: Request) {
  try {
    const context = await requireAuth();
    const body = await req.json();
    const { grnId, branchId } = body;

    if (!grnId) {
      return NextResponse.json(
        { success: false, error: "GRN ID is required." },
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

      // Determine warehouse branch
      let targetBranchId = branchId;
      if (!targetBranchId) {
        const defaultBranch = await Branch.findOne({ businessId, isMainWarehouse: true }).lean() ||
                              await Branch.findOne({ businessId }).lean();
        targetBranchId = defaultBranch?._id;
      }

      if (!targetBranchId) {
        return NextResponse.json(
          { success: false, error: "No warehouse branch found for putaway routing." },
          { status: 400 }
        );
      }

      // Fetch all active bins in the warehouse branch
      const bins = await WarehouseBin.find({
        businessId,
        branchId: targetBranchId,
        isActive: true,
        status: { $in: ["AVAILABLE", "NEAR_FULL"] },
      }).sort({ sequenceOrder: 1 }).lean();

      // Separate bins by type
      const primaryPickBins = bins.filter((b) => b.binType === "PRIMARY_PICK");
      const bulkOverstockBins = bins.filter((b) => b.binType === "BULK_OVERSTOCK");
      const quarantineBins = bins.filter((b) => b.binType === "QUARANTINE");
      const coldStorageBins = bins.filter((b) => b.binType === "COLD_STORAGE");

      // Track running occupancy changes during suggestion allocation
      const binAllocatedUnits = new Map<string, number>();

      const getBinFreeCapacity = (bin: any) => {
        const current = bin.currentOccupancy?.totalUnits || 0;
        const extraAllocated = binAllocatedUnits.get(bin._id.toString()) || 0;
        const max = bin.capacity?.maxUnits || 100;
        return Math.max(0, max - (current + extraAllocated));
      };

      const suggestions = [];

      for (let i = 0; i < grn.items.length; i++) {
        const item = grn.items[i];
        const acceptedQty = item.acceptedQuantity || 0;
        const rejectedQty = item.rejectedQuantity || 0;

        let suggestedAcceptedBin: any = null;
        let suggestedQuarantineBin: any = null;

        // 1. Resolve bin for accepted stock
        if (acceptedQty > 0) {
          // Check if this product is already assigned to a primary pick bin
          const existingStock = await BinStock.findOne({
            businessId,
            branchId: targetBranchId,
            productId: item.productId,
            isPrimaryPick: true,
          }).lean();

          if (existingStock) {
            const existingBin = primaryPickBins.find(
              (b) => b._id.toString() === existingStock.binId.toString()
            );
            if (existingBin && getBinFreeCapacity(existingBin) >= acceptedQty) {
              suggestedAcceptedBin = existingBin;
            }
          }

          // If not assigned or full, find any primary pick bin with enough capacity
          if (!suggestedAcceptedBin) {
            suggestedAcceptedBin = primaryPickBins.find(
              (b) => getBinFreeCapacity(b) >= acceptedQty
            );
          }

          // If all primary pick bins are full, allocate to bulk overstock
          if (!suggestedAcceptedBin) {
            suggestedAcceptedBin = bulkOverstockBins.find(
              (b) => getBinFreeCapacity(b) >= acceptedQty
            );
          }

          // Fallback to any bin with capacity
          if (!suggestedAcceptedBin && bins.length > 0) {
            suggestedAcceptedBin = bins[0];
          }

          if (suggestedAcceptedBin) {
            const binIdStr = suggestedAcceptedBin._id.toString();
            const currentAlloc = binAllocatedUnits.get(binIdStr) || 0;
            binAllocatedUnits.set(binIdStr, currentAlloc + acceptedQty);

            // Update item in GRN
            item.suggestedBinId = suggestedAcceptedBin._id;
            item.suggestedBinCode = suggestedAcceptedBin.binCode;
          }
        }

        // 2. Resolve bin for quarantined/rejected stock
        if (rejectedQty > 0) {
          suggestedQuarantineBin = quarantineBins.find(
            (b) => getBinFreeCapacity(b) >= rejectedQty
          ) || quarantineBins[0];

          if (suggestedQuarantineBin) {
            const binIdStr = suggestedQuarantineBin._id.toString();
            const currentAlloc = binAllocatedUnits.get(binIdStr) || 0;
            binAllocatedUnits.set(binIdStr, currentAlloc + rejectedQty);
          }
        }

        suggestions.push({
          itemId: (item as any)._id?.toString() || `item-${i}`,
          productId: item.productId,
          productName: item.name,
          sku: item.sku,
          unit: item.unit,
          batchNumber: item.batchNumber,
          expiryDate: item.expiryDate,
          acceptedQuantity: acceptedQty,
          suggestedAcceptedBin: suggestedAcceptedBin
            ? {
                _id: suggestedAcceptedBin._id,
                binCode: suggestedAcceptedBin.binCode,
                binType: suggestedAcceptedBin.binType,
                zone: suggestedAcceptedBin.zone,
                aisle: suggestedAcceptedBin.aisle,
                rack: suggestedAcceptedBin.rack,
                shelf: suggestedAcceptedBin.shelf,
                maxUnits: suggestedAcceptedBin.capacity?.maxUnits,
                remainingCapacity: getBinFreeCapacity(suggestedAcceptedBin),
              }
            : null,
          rejectedQuantity: rejectedQty,
          suggestedQuarantineBin: suggestedQuarantineBin
            ? {
                _id: suggestedQuarantineBin._id,
                binCode: suggestedQuarantineBin.binCode,
                binType: suggestedQuarantineBin.binType,
                zone: suggestedQuarantineBin.zone,
                aisle: suggestedQuarantineBin.aisle,
                remainingCapacity: getBinFreeCapacity(suggestedQuarantineBin),
              }
            : null,
        });
      }

      // Persist suggestions on GRN
      await grn.save();

      return NextResponse.json({
        success: true,
        grnId: grn._id,
        grnNumber: grn.grnNumber,
        branchId: targetBranchId,
        suggestions,
      });
    }

    return NextResponse.json(
      { success: false, error: "Database unavailable." },
      { status: 503 }
    );
  } catch (error: any) {
    console.error("Error in POST /api/warehouse/putaway/suggest:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate putaway suggestions" },
      { status: 500 }
    );
  }
}
