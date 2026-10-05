import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { StockTransfer, IStockTransferItem, generateTransferManifestToken } from "@/models/StockTransfer";
import { Branch } from "@/models/Branch";
import { BranchStock } from "@/models/BranchStock";
import { Product } from "@/models/Product";
import { InventoryMovement } from "@/models/InventoryMovement";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth, requireRole } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const context = await requireAuth();
    const { searchParams } = new URL(req.url);

    const status = searchParams.get("status") || "ALL";
    const sourceBranchId = searchParams.get("sourceBranchId");
    const destinationBranchId = searchParams.get("destinationBranchId");
    const search = searchParams.get("q")?.trim() || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "30", 10);
    const skip = (page - 1) * limit;

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const query: any = { businessId };

      if (status !== "ALL") {
        query.status = status;
      }
      if (sourceBranchId) {
        query.sourceBranchId = sourceBranchId;
      }
      if (destinationBranchId) {
        query.destinationBranchId = destinationBranchId;
      }
      if (search) {
        query.$or = [
          { transferNumber: { $regex: search, $options: "i" } },
          { carrierName: { $regex: search, $options: "i" } },
          { trackingReference: { $regex: search, $options: "i" } },
          { vehicleNumber: { $regex: search, $options: "i" } },
          { driverName: { $regex: search, $options: "i" } },
          { manifestToken: { $regex: search, $options: "i" } },
          { sourceBranchName: { $regex: search, $options: "i" } },
          { destinationBranchName: { $regex: search, $options: "i" } },
        ];
      }

      const [
        transfers,
        totalCount,
        inTransitCount,
        completedCount,
        draftCount,
        cancelledCount,
        inTransitAggregate,
        discrepanciesPendingCount,
      ] = await Promise.all([
        StockTransfer.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        StockTransfer.countDocuments(query),
        StockTransfer.countDocuments({ businessId, status: "IN_TRANSIT" }),
        StockTransfer.countDocuments({ businessId, status: "COMPLETED" }),
        StockTransfer.countDocuments({ businessId, status: "DRAFT" }),
        StockTransfer.countDocuments({ businessId, status: "CANCELLED" }),
        StockTransfer.aggregate([
          { $match: { businessId, status: "IN_TRANSIT" } },
          { $group: { _id: null, totalValuation: { $sum: "$totalTransitValue" } } },
        ]),
        StockTransfer.countDocuments({
          businessId,
          discrepancyStatus: { $in: ["SHORTAGE", "OVERAGE", "DAMAGED"] },
          discrepancyResolved: false,
        }),
      ]);

      const inTransitValuation =
        inTransitAggregate.length > 0 && inTransitAggregate[0].totalValuation
          ? Math.round(inTransitAggregate[0].totalValuation * 100) / 100
          : 0;

      return NextResponse.json({
        success: true,
        transfers,
        metrics: {
          inTransitCount,
          completedCount,
          draftCount,
          cancelledCount,
          totalCount,
          inTransitValuation,
          discrepanciesPendingCount,
        },
        pagination: {
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit) || 1,
          totalCount,
        },
      });
    }

    // Demo Mode fallback
    return NextResponse.json({
      success: true,
      transfers: [],
      metrics: {
        inTransitCount: 0,
        completedCount: 0,
        draftCount: 0,
        cancelledCount: 0,
        totalCount: 0,
        inTransitValuation: 0,
        discrepanciesPendingCount: 0,
      },
      pagination: { page: 1, limit: 30, totalPages: 1, totalCount: 0 },
    });
  } catch (error: any) {
    console.error("Error fetching transfers:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch transfers" },
      { status: error.status || 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPER_ADMIN"]);
    const body = await req.json();

    const {
      sourceBranchId,
      destinationBranchId,
      items,
      dispatchImmediately = false,
      carrierName,
      trackingReference,
      vehicleNumber,
      driverName,
      driverPhone,
      gatePassOutTime,
      estimatedArrival,
      notes,
    } = body;

    if (!sourceBranchId || !destinationBranchId) {
      return NextResponse.json(
        { success: false, error: "Source and destination branches are both required." },
        { status: 400 }
      );
    }

    if (sourceBranchId === destinationBranchId) {
      return NextResponse.json(
        { success: false, error: "Source and destination branches cannot be the same location." },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one product line item is required." },
        { status: 400 }
      );
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const [sourceBranch, destBranch] = await Promise.all([
        Branch.findOne({ _id: sourceBranchId, businessId }),
        Branch.findOne({ _id: destinationBranchId, businessId }),
      ]);

      if (!sourceBranch) return NextResponse.json({ success: false, error: "Source branch not found." }, { status: 404 });
      if (!destBranch) return NextResponse.json({ success: false, error: "Destination branch not found." }, { status: 404 });

      // Generate sequential STN number: STN-YYYYMMDD-XXXX
      const now = new Date();
      const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const countToday = await StockTransfer.countDocuments({
        businessId,
        createdAt: { $gte: startOfDay },
      });
      const seq = (countToday + 1).toString().padStart(4, "0");
      const transferNumber = `STN-${datePart}-${seq}`;

      // Validate & enrich items
      const productIds = items.map((i: any) => i.productId);
      const products = await Product.find({ _id: { $in: productIds }, businessId }).lean();
      const productMap = new Map(products.map((p) => [p._id.toString(), p]));

      // If dispatchImmediately is selected, check source stock availability
      let sourceStocksMap = new Map<string, any>();
      if (dispatchImmediately) {
        const sourceStocks = await BranchStock.find({
          businessId,
          branchId: sourceBranch._id,
          productId: { $in: productIds },
        });
        sourceStocksMap = new Map(sourceStocks.map((s) => [s.productId.toString(), s]));
      }

      const transferItems: IStockTransferItem[] = [];
      let totalQty = 0;
      let totalTransitValue = 0;

      for (const item of items) {
        const prod = productMap.get(item.productId);
        if (!prod) {
          return NextResponse.json(
            { success: false, error: `Product ID ${item.productId} was not found.` },
            { status: 400 }
          );
        }

        const qty = parseFloat(item.quantitySent);
        if (isNaN(qty) || qty <= 0) {
          return NextResponse.json(
            { success: false, error: `Invalid quantity for product "${prod.name}".` },
            { status: 400 }
          );
        }

        if (dispatchImmediately) {
          const sStock = sourceStocksMap.get(prod._id.toString());
          const available = sStock ? sStock.quantity : 0;
          if (available < qty) {
            return NextResponse.json(
              {
                success: false,
                error: `Insufficient stock for "${prod.name}" at ${sourceBranch.name}. Available: ${available}, Requested: ${qty}.`,
              },
              { status: 400 }
            );
          }
        }

        const unitCost = prod.costPrice || 0;
        const totalSentCost = Math.round(qty * unitCost * 100) / 100;
        totalTransitValue += totalSentCost;

        transferItems.push({
          productId: prod._id,
          name: prod.name,
          sku: prod.sku,
          barcode: prod.barcode || prod.sku,
          unit: prod.unit || "pcs",
          quantitySent: qty,
          unitCost,
          totalSentCost,
          notes: item.notes?.trim() || undefined,
          batchNumber: item.batchNumber?.trim() || undefined,
          expiryDate: item.expiryDate ? new Date(item.expiryDate) : undefined,
        });

        totalQty += qty;
      }

      const initialStatus = dispatchImmediately ? "IN_TRANSIT" : "DRAFT";
      const manifestToken = generateTransferManifestToken();

      const transfer = await StockTransfer.create({
        businessId,
        transferNumber,
        manifestToken,
        sourceBranchId: sourceBranch._id,
        sourceBranchName: sourceBranch.name,
        destinationBranchId: destBranch._id,
        destinationBranchName: destBranch.name,
        status: initialStatus,
        items: transferItems,
        totalItemsSent: totalQty,
        totalTransitValue: Math.round(totalTransitValue * 100) / 100,
        dispatchedBy: dispatchImmediately ? context.username || "Manager" : undefined,
        dispatchedAt: dispatchImmediately ? new Date() : undefined,
        gatePassOutTime: dispatchImmediately ? (gatePassOutTime ? new Date(gatePassOutTime) : new Date()) : undefined,
        estimatedArrival: estimatedArrival ? new Date(estimatedArrival) : undefined,
        vehicleNumber: vehicleNumber?.trim() || undefined,
        driverName: driverName?.trim() || undefined,
        driverPhone: driverPhone?.trim() || undefined,
        carrierName: carrierName?.trim() || undefined,
        trackingReference: trackingReference?.trim() || undefined,
        notes: notes?.trim() || undefined,
      });

      // If dispatchImmediately, decrement source branch stock and record TRANSFER_OUT movements
      if (dispatchImmediately) {
        for (const it of transferItems) {
          const sStock = sourceStocksMap.get(it.productId.toString());
          const prev = sStock ? sStock.quantity : 0;
          const next = prev - it.quantitySent;

          if (sStock) {
            sStock.quantity = next;
            await sStock.save();
          } else {
            await BranchStock.create({
              businessId,
              branchId: sourceBranch._id,
              productId: it.productId,
              quantity: next,
            });
          }

          await InventoryMovement.create({
            businessId,
            productId: it.productId,
            branchId: sourceBranch._id,
            transferId: transfer._id,
            type: "TRANSFER_OUT",
            quantityChange: -it.quantitySent,
            previousStock: prev,
            newStock: next,
            reason: `Dispatched to ${destBranch.name} (${transferNumber})`,
            referenceId: transferNumber,
            createdBy: context.userId,
          });
        }
      }

      // Audit Log
      await AuditLog.create({
        businessId,
        action: dispatchImmediately ? "STOCK_TRANSFER_DISPATCHED" : "STOCK_TRANSFER_CREATED",
        entity: "STOCK_TRANSFER",
        entityId: transfer._id.toString(),
        userId: context.userId,
        details: {
          transferNumber,
          source: sourceBranch.name,
          destination: destBranch.name,
          itemCount: transferItems.length,
          totalQty,
          status: initialStatus,
        },
      });

      return NextResponse.json({
        success: true,
        transfer,
        message: `Transfer ${transferNumber} ${dispatchImmediately ? "dispatched in transit" : "created as draft"}.`,
      });
    }

    return NextResponse.json({
      success: true,
      transfer: {
        _id: `stn_${Date.now()}`,
        transferNumber: `STN-${Date.now()}`,
        sourceBranchName: "Main Warehouse",
        destinationBranchName: "Kandy Branch",
        status: dispatchImmediately ? "IN_TRANSIT" : "DRAFT",
      },
      message: "Demo: Transfer created.",
    });
  } catch (error: any) {
    console.error("Error creating stock transfer:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create transfer" },
      { status: error.status || 500 }
    );
  }
}
