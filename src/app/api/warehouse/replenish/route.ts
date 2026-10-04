import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { WarehouseBin } from "@/models/WarehouseBin";
import { BinStock } from "@/models/BinStock";
import { AuditLog } from "@/models/AuditLog";
import { requireRole } from "@/lib/tenant";

export async function POST(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "INVENTORY_CLERK", "SUPER_ADMIN"]);
    const body = await req.json();

    const {
      branchId,
      productId,
      sourceBinId,
      targetBinId,
      quantity,
      batchNumber,
      notes,
    } = body;

    const qty = Number(quantity);
    if (!branchId || !productId || !sourceBinId || !targetBinId || !qty || qty <= 0) {
      return NextResponse.json(
        { success: false, error: "Missing required replenishment transfer parameters." },
        { status: 400 }
      );
    }

    if (sourceBinId === targetBinId) {
      return NextResponse.json(
        { success: false, error: "Source and target bins cannot be identical." },
        { status: 400 }
      );
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      // 1. Fetch source and target bins
      const [sourceBin, targetBin] = await Promise.all([
        WarehouseBin.findOne({ _id: sourceBinId, businessId, branchId }),
        WarehouseBin.findOne({ _id: targetBinId, businessId, branchId }),
      ]);

      if (!sourceBin || !targetBin) {
        return NextResponse.json(
          { success: false, error: "Source or target bin not found in this branch." },
          { status: 404 }
        );
      }

      // 2. Fetch source BinStock
      const stockQuery: any = {
        businessId,
        branchId,
        binId: sourceBinId,
        productId,
      };
      if (batchNumber) {
        stockQuery.batchNumber = batchNumber;
      }

      const sourceStock = await BinStock.findOne(stockQuery);
      if (!sourceStock || sourceStock.quantity < qty) {
        return NextResponse.json(
          {
            success: false,
            error: `Insufficient stock in source bin ${sourceBin.binCode}. Available: ${sourceStock?.quantity || 0}, Requested: ${qty}`,
          },
          { status: 400 }
        );
      }

      // 3. Deduct from source BinStock
      sourceStock.quantity -= qty;
      await sourceStock.save();

      // Update source bin occupancy
      const srcUnits = Math.max(0, (sourceBin.currentOccupancy.totalUnits || 0) - qty);
      const srcMax = sourceBin.capacity.maxUnits || 1;
      sourceBin.currentOccupancy.totalUnits = srcUnits;
      sourceBin.currentOccupancy.utilizationPercent = Math.min(100, Math.round((srcUnits / srcMax) * 100));
      if (sourceBin.currentOccupancy.utilizationPercent < 85 && sourceBin.status === "NEAR_FULL") {
        sourceBin.status = "AVAILABLE";
      }
      await sourceBin.save();

      // 4. Find or create target BinStock
      let targetStock = await BinStock.findOne({
        businessId,
        branchId,
        binId: targetBinId,
        productId,
        ...(sourceStock.batchNumber ? { batchNumber: sourceStock.batchNumber } : {}),
      });

      if (targetStock) {
        targetStock.quantity += qty;
        await targetStock.save();
      } else {
        targetStock = await BinStock.create({
          businessId,
          branchId,
          binId: targetBin._id,
          binCode: targetBin.binCode,
          productId: sourceStock.productId,
          productName: sourceStock.productName,
          sku: sourceStock.sku,
          barcode: sourceStock.barcode,
          unit: sourceStock.unit,
          batchId: sourceStock.batchId,
          batchNumber: sourceStock.batchNumber,
          expiryDate: sourceStock.expiryDate,
          quantity: qty,
          reservedQuantity: 0,
          isPrimaryPick: targetBin.binType === "PRIMARY_PICK",
          minReplenishThreshold: targetBin.binType === "PRIMARY_PICK" ? 15 : undefined,
          maxReplenishCapacity: targetBin.capacity.maxUnits,
        });
      }

      // Update target bin occupancy
      const tgtUnits = (targetBin.currentOccupancy.totalUnits || 0) + qty;
      const tgtMax = targetBin.capacity.maxUnits || 1;
      const tgtUtil = Math.min(100, Math.round((tgtUnits / tgtMax) * 100));
      targetBin.currentOccupancy.totalUnits = tgtUnits;
      targetBin.currentOccupancy.utilizationPercent = tgtUtil;
      if (tgtUtil >= 100) targetBin.status = "FULL";
      else if (tgtUtil >= 85) targetBin.status = "NEAR_FULL";
      else if (targetBin.status !== "MAINTENANCE" && targetBin.status !== "INACTIVE") {
        targetBin.status = "AVAILABLE";
      }
      await targetBin.save();

      await AuditLog.create({
        businessId,
        userId: context.userId,
        action: "INTERNAL_REPLENISHMENT",
        entity: "BinStock",
        details: `Replenished ${qty} units of ${sourceStock.productName} from overstock bin ${sourceBin.binCode} to pick face ${targetBin.binCode}. Notes: ${notes || "None"}`,
      });

      return NextResponse.json({
        success: true,
        message: `Replenished ${qty} units from ${sourceBin.binCode} to ${targetBin.binCode}.`,
        sourceBinCode: sourceBin.binCode,
        targetBinCode: targetBin.binCode,
        transferredQuantity: qty,
      });
    }

    return NextResponse.json(
      { success: false, error: "Database unavailable." },
      { status: 503 }
    );
  } catch (error: any) {
    console.error("Error in POST /api/warehouse/replenish:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to execute replenishment" },
      { status: 500 }
    );
  }
}
