import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { SupplierDebitNote, generateDebitNoteNumber, ISupplierDebitNoteItem } from "@/models/SupplierDebitNote";
import { Supplier } from "@/models/Supplier";
import { Branch } from "@/models/Branch";
import { BranchStock } from "@/models/BranchStock";
import { Product } from "@/models/Product";
import { InventoryMovement } from "@/models/InventoryMovement";
import { GoodsReceivedNote } from "@/models/GoodsReceivedNote";
import { PurchaseOrder } from "@/models/PurchaseOrder";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth, requireRole } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const context = await requireAuth();
    const { searchParams } = new URL(req.url);

    const status = searchParams.get("status") || "ALL";
    const supplierId = searchParams.get("supplierId");
    const settlementType = searchParams.get("settlementType") || "ALL";
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
      if (supplierId) {
        query.supplierId = supplierId;
      }
      if (settlementType !== "ALL") {
        query.settlementType = settlementType;
      }
      if (search) {
        query.$or = [
          { debitNoteNumber: { $regex: search, $options: "i" } },
          { supplierName: { $regex: search, $options: "i" } },
          { distributorRepName: { $regex: search, $options: "i" } },
          { distributorVehicleNumber: { $regex: search, $options: "i" } },
          { distributorCreditNoteNumber: { $regex: search, $options: "i" } },
          { poNumber: { $regex: search, $options: "i" } },
          { grnNumber: { $regex: search, $options: "i" } },
        ];
      }

      const [debitNotes, totalCount, aggregateStats] = await Promise.all([
        SupplierDebitNote.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        SupplierDebitNote.countDocuments(query),
        SupplierDebitNote.aggregate([
          { $match: { businessId } },
          {
            $group: {
              _id: null,
              totalDebitNotesCount: { $sum: 1 },
              pendingClaimsCount: {
                $sum: {
                  $cond: [{ $in: ["$status", ["DRAFT", "ISSUED"]] }, 1, 0],
                },
              },
              pendingClaimsTotal: {
                $sum: {
                  $cond: [{ $in: ["$status", ["DRAFT", "ISSUED"]] }, "$netTotal", 0],
                },
              },
              appliedCreditsTotal: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$status", "APPLIED"] },
                        { $eq: ["$settlementType", "AP_CREDIT_OFFSET"] },
                      ],
                    },
                    "$netTotal",
                    0,
                  ],
                },
              },
              replacementsPendingCount: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$settlementType", "REPLACEMENT"] },
                        { $eq: ["$replacementReceived", false] },
                        { $ne: ["$status", "CANCELLED"] },
                        { $ne: ["$status", "REJECTED"] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ]),
      ]);

      const metrics = aggregateStats[0] || {
        totalDebitNotesCount: 0,
        pendingClaimsCount: 0,
        pendingClaimsTotal: 0,
        appliedCreditsTotal: 0,
        replacementsPendingCount: 0,
      };

      return NextResponse.json({
        success: true,
        debitNotes,
        metrics,
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
      debitNotes: [],
      metrics: {
        totalDebitNotesCount: 0,
        pendingClaimsCount: 0,
        pendingClaimsTotal: 0,
        appliedCreditsTotal: 0,
        replacementsPendingCount: 0,
      },
      pagination: {
        page: 1,
        limit: 30,
        totalPages: 1,
        totalCount: 0,
      },
    });
  } catch (error: any) {
    console.error("GET /api/purchases/debit-notes error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch debit notes" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPER_ADMIN"]);
    const body = await req.json();

    const {
      supplierId,
      branchId,
      grnId,
      purchaseOrderId,
      items: rawItems = [],
      settlementType = "AP_CREDIT_OFFSET",
      taxRate = 0,
      distributorRepName,
      distributorVehicleNumber,
      distributorCreditNoteNumber,
      notes,
      status: requestedStatus = "DRAFT",
      fromGrnId, // Quick extraction shortcut from dock rejections
    } = body;

    if (!supplierId && !fromGrnId) {
      return NextResponse.json(
        { success: false, error: "Supplier ID is required." },
        { status: 400 }
      );
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      let targetSupplierId = supplierId;
      let targetSupplierName = "";
      let targetBranchId = branchId;
      let targetBranchName = "";
      let targetGrnId = grnId;
      let targetGrnNumber = "";
      let targetPoId = purchaseOrderId;
      let targetPoNumber = "";

      let processedItems: ISupplierDebitNoteItem[] = [];

      // 1. If generated from an existing GRN, extract rejected items
      if (fromGrnId) {
        const grn = await GoodsReceivedNote.findOne({ _id: fromGrnId, businessId });
        if (!grn) {
          return NextResponse.json(
            { success: false, error: "Referenced GRN not found." },
            { status: 404 }
          );
        }

        targetSupplierId = grn.supplierId;
        targetSupplierName = grn.supplierName;
        targetBranchId = grn.branchId;
        targetBranchName = grn.branchName || "";
        targetGrnId = grn._id;
        targetGrnNumber = grn.grnNumber;
        targetPoId = grn.purchaseOrderId;
        targetPoNumber = grn.poNumber || "";

        // Filter items with rejections
        const rejectedItems = grn.items.filter((it) => (it.rejectedQuantity || 0) > 0);
        if (rejectedItems.length === 0) {
          return NextResponse.json(
            { success: false, error: "Selected GRN does not contain any rejected items." },
            { status: 400 }
          );
        }

        processedItems = rejectedItems.map((it) => ({
          productId: it.productId,
          name: it.name,
          sku: it.sku,
          unit: it.unit || "pcs",
          quantity: it.rejectedQuantity,
          unitCost: it.unitCost,
          totalCost: it.rejectedTotalCost || it.rejectedQuantity * it.unitCost,
          reason: (it.rejectionReason as any) || "DOCK_REJECTED",
          batchNumber: it.batchNumber,
          expiryDate: it.expiryDate,
          deductInventory: false, // Items were already quarantined / rejected during dock inspection
          inventoryDeducted: false,
          notes: it.rejectionNotes || it.qcInspectionNotes,
        }));
      } else {
        // Standard manual creation
        const supplier = await Supplier.findOne({ _id: targetSupplierId, businessId });
        if (!supplier) {
          return NextResponse.json(
            { success: false, error: "Supplier not found." },
            { status: 404 }
          );
        }
        targetSupplierName = supplier.name;

        if (targetBranchId) {
          const branch = await Branch.findOne({ _id: targetBranchId, businessId });
          if (branch) targetBranchName = branch.name;
        }

        if (targetPoId) {
          const po = await PurchaseOrder.findOne({ _id: targetPoId, businessId });
          if (po) targetPoNumber = po.poNumber;
        }

        if (!Array.isArray(rawItems) || rawItems.length === 0) {
          return NextResponse.json(
            { success: false, error: "At least one item must be included in the debit note." },
            { status: 400 }
          );
        }

        processedItems = rawItems.map((it: any) => {
          const qty = Math.max(0.001, Number(it.quantity) || 1);
          const cost = Math.max(0, Number(it.unitCost) || 0);
          return {
            productId: it.productId,
            name: it.name,
            sku: it.sku,
            unit: it.unit || "pcs",
            quantity: qty,
            unitCost: cost,
            totalCost: Number((qty * cost).toFixed(2)),
            reason: it.reason || "DAMAGED_IN_TRANSIT",
            batchNumber: it.batchNumber,
            expiryDate: it.expiryDate ? new Date(it.expiryDate) : undefined,
            deductInventory: it.deductInventory !== false,
            inventoryDeducted: false,
            notes: it.notes,
          };
        });
      }

      // Calculate totals
      const subtotal = processedItems.reduce((acc, it) => acc + it.totalCost, 0);
      const calculatedTaxRate = Math.max(0, Number(taxRate) || 0);
      const taxAmount = Number(((subtotal * calculatedTaxRate) / 100).toFixed(2));
      const netTotal = Number((subtotal + taxAmount).toFixed(2));

      // Generate sequential Debit Note Number
      const debitNoteNumber = await generateDebitNoteNumber(businessId);

      const initialStatus = requestedStatus === "ISSUED" ? "ISSUED" : "DRAFT";

      // If issuing directly, deduct stock for marked items
      if (initialStatus === "ISSUED") {
        for (const item of processedItems) {
          if (item.deductInventory) {
            const product = await Product.findOne({ _id: item.productId, businessId });
            if (product) {
              const prev = product.stockQuantity;
              const next = Math.max(0, prev - item.quantity);
              product.stockQuantity = next;
              await product.save();

              if (targetBranchId) {
                await BranchStock.findOneAndUpdate(
                  { businessId, branchId: targetBranchId, productId: item.productId },
                  { $inc: { quantity: -item.quantity } }
                );
              }

              await InventoryMovement.create({
                businessId,
                productId: item.productId,
                branchId: targetBranchId,
                type: "SUPPLIER_RETURN",
                quantityChange: -item.quantity,
                previousStock: prev,
                newStock: next,
                reason: `Supplier Return (${debitNoteNumber}): ${item.reason}`,
                referenceId: debitNoteNumber,
              });

              item.inventoryDeducted = true;
            }
          }
        }
      }

      const debitNote = await SupplierDebitNote.create({
        businessId,
        debitNoteNumber,
        supplierId: targetSupplierId,
        supplierName: targetSupplierName,
        branchId: targetBranchId,
        branchName: targetBranchName,
        grnId: targetGrnId,
        grnNumber: targetGrnNumber,
        purchaseOrderId: targetPoId,
        poNumber: targetPoNumber,
        status: initialStatus,
        settlementType,
        items: processedItems,
        subtotal,
        taxRate: calculatedTaxRate,
        taxAmount,
        netTotal,
        replacementReceived: false,
        distributorRepName,
        distributorVehicleNumber,
        distributorCreditNoteNumber,
        handoverDate: initialStatus === "ISSUED" ? new Date() : undefined,
        notes,
        createdBy: context.username || "Store Manager",
      });

      // Audit Log
      await AuditLog.create({
        businessId,
        userName: context.username || "System",
        action: "DEBIT_NOTE_CREATED",
        entityType: "SupplierDebitNote",
        entityId: debitNote._id.toString(),
        details: {
          debitNoteNumber,
          supplierName: targetSupplierName,
          status: initialStatus,
          netTotal,
          itemsCount: processedItems.length,
        },
      });

      return NextResponse.json({
        success: true,
        debitNote,
        message: `Debit Note ${debitNoteNumber} successfully created.`,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Debit Note created (Demo mode).",
    });
  } catch (error: any) {
    console.error("POST /api/purchases/debit-notes error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create debit note" },
      { status: 500 }
    );
  }
}
