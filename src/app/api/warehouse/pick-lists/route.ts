import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import {
  PickList,
  IPickListItem,
  generatePickListNumber,
  PickListType,
  PickListStatus,
} from "@/models/PickList";
import { StockTransfer } from "@/models/StockTransfer";
import { WarehouseBin } from "@/models/WarehouseBin";
import { BinStock } from "@/models/BinStock";
import { Branch } from "@/models/Branch";
import { Product } from "@/models/Product";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth, requireRole } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const context = await requireAuth();
    const { searchParams } = new URL(req.url);

    const branchId = searchParams.get("branchId");
    const status = searchParams.get("status") || "ALL";
    const type = searchParams.get("type") || "ALL";
    const search = searchParams.get("q")?.trim() || "";

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const query: any = { businessId };

      if (branchId && branchId !== "ALL") {
        query.sourceBranchId = branchId;
      }
      if (status !== "ALL") {
        query.status = status;
      }
      if (type !== "ALL") {
        query.type = type;
      }
      if (search) {
        query.$or = [
          { pickListNumber: { $regex: search, $options: "i" } },
          { referenceNumber: { $regex: search, $options: "i" } },
          { assignedPickerName: { $regex: search, $options: "i" } },
          { destinationBranchName: { $regex: search, $options: "i" } },
        ];
      }

      const pickLists = await PickList.find(query).sort({ createdAt: -1 }).lean();

      const [pendingCount, inProgressCount, pickedCount, dispatchedCount] = await Promise.all([
        PickList.countDocuments({ businessId, status: "PENDING" }),
        PickList.countDocuments({ businessId, status: "IN_PROGRESS" }),
        PickList.countDocuments({ businessId, status: "PICKED" }),
        PickList.countDocuments({ businessId, status: "DISPATCHED" }),
      ]);

      return NextResponse.json({
        success: true,
        pickLists,
        counts: {
          total: pickLists.length,
          pending: pendingCount,
          inProgress: inProgressCount,
          picked: pickedCount,
          dispatched: dispatchedCount,
        },
      });
    }

    return NextResponse.json({
      success: true,
      pickLists: [],
      counts: {
        total: 0,
        pending: 0,
        inProgress: 0,
        picked: 0,
        dispatched: 0,
      },
    });
  } catch (error: any) {
    console.error("Error in GET /api/warehouse/pick-lists:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch pick lists" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "INVENTORY_CLERK", "SUPER_ADMIN"]);
    const body = await req.json();

    const {
      type = "STOCK_TRANSFER",
      transferId,
      sourceBranchId,
      destinationBranchId,
      assignedPickerName,
      priority = "NORMAL",
      notes,
      items: customItems,
    } = body;

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      let resolvedSourceBranchId = sourceBranchId;
      let resolvedSourceBranchName = "";
      let resolvedDestBranchId = destinationBranchId;
      let resolvedDestBranchName = "";
      let referenceId: any = undefined;
      let referenceNumber: string | undefined = undefined;
      let itemsToRoute: any[] = [];

      // Case 1: Created from StockTransfer
      if (transferId) {
        const transfer = await StockTransfer.findOne({ _id: transferId, businessId });
        if (!transfer) {
          return NextResponse.json(
            { success: false, error: "Stock transfer not found." },
            { status: 404 }
          );
        }

        if (transfer.pickListId) {
          const existingPickList = await PickList.findOne({
            _id: transfer.pickListId,
            businessId,
          }).lean();
          if (existingPickList) {
            return NextResponse.json(
              {
                success: false,
                error: `This transfer already has an active Pick List (${existingPickList.pickListNumber}).`,
                pickList: existingPickList,
              },
              { status: 409 }
            );
          }
        }

        resolvedSourceBranchId = transfer.sourceBranchId;
        resolvedSourceBranchName = transfer.sourceBranchName;
        resolvedDestBranchId = transfer.destinationBranchId;
        resolvedDestBranchName = transfer.destinationBranchName;
        referenceId = transfer._id;
        referenceNumber = transfer.transferNumber;

        itemsToRoute = transfer.items.map((it) => ({
          productId: it.productId,
          productName: it.name,
          sku: it.sku,
          barcode: it.barcode,
          unit: it.unit,
          quantityRequested: it.quantitySent,
          batchNumber: it.batchNumber,
          expiryDate: it.expiryDate,
        }));

      } else if (Array.isArray(customItems) && customItems.length > 0) {
        // Case 2: Custom / Direct item request
        if (!resolvedSourceBranchId) {
          return NextResponse.json(
            { success: false, error: "Source branch is required." },
            { status: 400 }
          );
        }
        const srcBranch = await Branch.findOne({ _id: resolvedSourceBranchId, businessId }).lean();
        if (srcBranch) resolvedSourceBranchName = srcBranch.name;

        if (resolvedDestBranchId) {
          const dstBranch = await Branch.findOne({ _id: resolvedDestBranchId, businessId }).lean();
          if (dstBranch) resolvedDestBranchName = dstBranch.name;
        }

        itemsToRoute = customItems;
      } else {
        return NextResponse.json(
          { success: false, error: "Either transferId or items must be provided." },
          { status: 400 }
        );
      }

      // Generate pick list items with optimal bin assignment & minimal path sorting
      const pickListItems: IPickListItem[] = [];
      let totalItemsCount = 0;
      let totalUnitsCount = 0;

      // Fetch warehouse bins in source branch
      const allBins = await WarehouseBin.find({
        businessId,
        branchId: resolvedSourceBranchId,
        isActive: true,
      }).lean();
      const defaultBin = allBins[0];

      for (const reqItem of itemsToRoute) {
        const qtyReq = Number(reqItem.quantityRequested) || 1;
        totalUnitsCount += qtyReq;
        totalItemsCount++;

        // Find best bin stock for this product in source branch
        // Priority 1: isPrimaryPick: true with available quantity
        // Priority 2: earliest expiry date (FIFO)
        const candidateStocks = await BinStock.find({
          businessId,
          branchId: resolvedSourceBranchId,
          productId: reqItem.productId,
          quantity: { $gt: 0 },
        }).sort({ isPrimaryPick: -1, expiryDate: 1 }).lean();

        let assignedBin: any = null;
        let chosenBatchNumber = reqItem.batchNumber;
        let chosenExpiryDate = reqItem.expiryDate;

        if (candidateStocks.length > 0) {
          const stock = candidateStocks[0];
          assignedBin = allBins.find((b) => b._id.toString() === stock.binId.toString());
          if (!chosenBatchNumber && stock.batchNumber) chosenBatchNumber = stock.batchNumber;
          if (!chosenExpiryDate && stock.expiryDate) chosenExpiryDate = stock.expiryDate;

          // Reserve quantity in BinStock
          await BinStock.updateOne(
            { _id: stock._id },
            { $inc: { reservedQuantity: qtyReq } }
          );
        }

        // If no bin stock recorded, fallback to a primary pick bin or default warehouse bin
        if (!assignedBin) {
          assignedBin = allBins.find((b) => b.binType === "PRIMARY_PICK") || defaultBin;
        }

        pickListItems.push({
          productId: reqItem.productId,
          productName: reqItem.productName,
          sku: reqItem.sku,
          barcode: reqItem.barcode,
          unit: reqItem.unit || "pcs",
          quantityRequested: qtyReq,
          quantityPicked: 0,
          binId: assignedBin?._id || defaultBin?._id,
          binCode: assignedBin?.binCode || "UNASSIGNED",
          zone: assignedBin?.zone || "ZA",
          aisle: assignedBin?.aisle || "A01",
          rack: assignedBin?.rack || "R01",
          shelf: assignedBin?.shelf || "S01",
          sequenceOrder: assignedBin?.sequenceOrder || 1000000,
          batchNumber: chosenBatchNumber,
          expiryDate: chosenExpiryDate ? new Date(chosenExpiryDate) : undefined,
          itemStatus: "PENDING",
        });
      }

      // SINGLE-PASS WALKING PATH ROUTER:
      // Sort pick list items ascending by sequenceOrder to minimize zigzags
      pickListItems.sort((a, b) => a.sequenceOrder - b.sequenceOrder);

      const pickListNumber = await generatePickListNumber();

      const newPickList = await PickList.create({
        businessId,
        pickListNumber,
        type: type as PickListType,
        sourceBranchId: resolvedSourceBranchId,
        sourceBranchName: resolvedSourceBranchName || "Main Warehouse",
        destinationBranchId: resolvedDestBranchId,
        destinationBranchName: resolvedDestBranchName,
        referenceId,
        referenceNumber,
        status: "PENDING",
        priority,
        assignedPickerName: assignedPickerName || undefined,
        totalItems: totalItemsCount,
        totalUnits: totalUnitsCount,
        pickedUnits: 0,
        items: pickListItems,
        notes,
        createdBy: context.username || "Warehouse Admin",
      });

      // If tied to StockTransfer, link the pick list
      if (transferId) {
        await StockTransfer.updateOne(
          { _id: transferId, businessId },
          {
            $set: {
              pickListId: newPickList._id,
              pickListNumber: newPickList.pickListNumber,
            },
          }
        );
      }

      await AuditLog.create({
        businessId,
        userId: context.userId,
        action: "GENERATE_PICK_LIST",
        entity: "PickList",
        entityId: newPickList._id,
        details: `Generated pick list ${pickListNumber} with ${pickListItems.length} items optimized by warehouse path sequence.`,
      });

      return NextResponse.json({
        success: true,
        pickList: newPickList,
      });
    }

    return NextResponse.json(
      { success: false, error: "Database unavailable." },
      { status: 503 }
    );
  } catch (error: any) {
    console.error("Error in POST /api/warehouse/pick-lists:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate pick list" },
      { status: 500 }
    );
  }
}
