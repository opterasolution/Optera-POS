import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { GoodsReceivedNote } from "@/models/GoodsReceivedNote";
import { PurchaseOrder } from "@/models/PurchaseOrder";
import { Supplier } from "@/models/Supplier";
import { Product } from "@/models/Product";
import { Batch } from "@/models/Batch";
import { BranchStock } from "@/models/BranchStock";
import { InventoryMovement } from "@/models/InventoryMovement";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth, requireRole } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const context = await requireAuth();
    const { searchParams } = new URL(req.url);
    const supplierId = searchParams.get("supplierId");
    const poNumber = searchParams.get("poNumber");
    const status = searchParams.get("status");
    const inspectionStatus = searchParams.get("inspectionStatus");
    const search = searchParams.get("search");

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const query: any = { businessId };
      if (supplierId) query.supplierId = supplierId;
      if (poNumber) query.poNumber = new RegExp(poNumber, "i");
      if (status && status !== "ALL") query.status = status;
      if (inspectionStatus && inspectionStatus !== "ALL") query.inspectionStatus = inspectionStatus;
      if (search) {
        query.$or = [
          { grnNumber: new RegExp(search, "i") },
          { poNumber: new RegExp(search, "i") },
          { supplierName: new RegExp(search, "i") },
          { supplierInvoiceNumber: new RegExp(search, "i") },
        ];
      }

      let grns = await GoodsReceivedNote.find(query).sort({ createdAt: -1 }).lean();

      // Seed initial sample GRNs if none exist
      if (grns.length === 0 && !search && !supplierId && !poNumber) {
        const existingPo = await PurchaseOrder.findOne({ businessId }).lean();
        const existingSupplier = await Supplier.findOne({ businessId }).lean();
        const existingProducts = await Product.find({ businessId }).limit(2).lean();

        if (existingSupplier && existingProducts.length > 0) {
          const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
          const seedPoNumber = existingPo?.poNumber || `PO-${todayStr}-1001`;

          const demoItems = existingProducts.map((p, idx) => {
            const ordered = idx === 0 ? 50 : 25;
            const received = ordered;
            const rejected = idx === 0 ? 2 : 0;
            const accepted = received - rejected;
            const unitCost = p.costPrice || 250;
            return {
              productId: p._id,
              name: p.name,
              sku: p.sku || `SKU-${idx + 101}`,
              unit: p.unit || "pcs",
              orderedQuantity: ordered,
              receivedQuantity: received,
              acceptedQuantity: accepted,
              rejectedQuantity: rejected,
              rejectionReason: rejected > 0 ? "DAMAGED_PACKAGING" : undefined,
              rejectionNotes: rejected > 0 ? "Carton crushed during pallet unloading" : undefined,
              unitCost,
              acceptedTotalCost: accepted * unitCost,
              rejectedTotalCost: rejected * unitCost,
              batchNumber: `LOT-SL-${todayStr}-${idx + 1}`,
              manufacturingDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              expiryDate: new Date(Date.now() + 335 * 24 * 60 * 60 * 1000),
              mrp: (p.sellingPrice || 350) + 20,
              sellingPrice: p.sellingPrice || 350,
              qcInspectionNotes: "Inspected dock temp 22C, inner seal intact, cartons clean.",
            };
          });

          const totalOrderedCost = demoItems.reduce((sum, it) => sum + it.orderedQuantity * it.unitCost, 0);
          const totalAcceptedCost = demoItems.reduce((sum, it) => sum + it.acceptedTotalCost, 0);
          const totalRejectedCost = demoItems.reduce((sum, it) => sum + it.rejectedTotalCost, 0);

          const seedGrn = await GoodsReceivedNote.create({
            businessId,
            grnNumber: `GRN-${todayStr}-0001`,
            purchaseOrderId: existingPo?._id || existingSupplier._id,
            poNumber: seedPoNumber,
            supplierId: existingSupplier._id,
            supplierName: existingSupplier.name,
            supplierInvoiceNumber: `INV-${todayStr}-994`,
            supplierInvoiceDate: new Date(),
            branchName: existingPo?.branchName || "Main Central Warehouse",
            status: "CONFIRMED",
            inspectionStatus: "PARTIALLY_ACCEPTED",
            items: demoItems,
            totalOrderedCost,
            totalAcceptedCost,
            totalRejectedCost,
            notes: "Dock receiving verified with transport driver. 2 damaged units quarantined for debit note credit.",
            receivedBy: context.username || "Warehouse Manager",
            inspectedBy: context.username || "Warehouse QC Lead",
            confirmedBy: context.username || "Store Manager",
            confirmedAt: new Date(),
          });

          grns = [seedGrn.toObject() as any];
        }
      }

      return NextResponse.json({ success: true, grns });
    }

    // Demo fallback mode
    return NextResponse.json({
      success: true,
      grns: [
        {
          _id: "demo-grn-1",
          grnNumber: "GRN-20261003-0001",
          poNumber: "PO-20261003-0001",
          supplierName: "Ceylon Wholesale Distributors Ltd",
          supplierInvoiceNumber: "INV-CBL-4421",
          status: "CONFIRMED",
          inspectionStatus: "PARTIALLY_ACCEPTED",
          totalOrderedCost: 45000,
          totalAcceptedCost: 42000,
          totalRejectedCost: 3000,
          receivedBy: "Dock Officer",
          createdAt: new Date().toISOString(),
          items: [
            {
              name: "Munchee Super Cream Cracker 490g",
              unit: "pcs",
              orderedQuantity: 50,
              receivedQuantity: 50,
              acceptedQuantity: 46,
              rejectedQuantity: 4,
              rejectionReason: "DAMAGED_PACKAGING",
              unitCost: 600,
              acceptedTotalCost: 27600,
              rejectedTotalCost: 2400,
              batchNumber: "BN-CBL-1029",
              expiryDate: "2027-05-15",
            },
          ],
        },
      ],
    });
  } catch (error: any) {
    console.error("Error in GET /api/grn:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch GRNs" },
      { status: error.status || 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "INVENTORY_CLERK", "SUPER_ADMIN"]);
    const body = await req.json();

    const {
      purchaseOrderId,
      supplierInvoiceNumber,
      supplierInvoiceDate,
      items,
      notes,
      confirmImmediately = true,
    } = body;

    if (!purchaseOrderId) {
      return NextResponse.json({ success: false, error: "Purchase Order ID is required." }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: "At least one item is required for GRN intake." }, { status: 400 });
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const po = await PurchaseOrder.findOne({ _id: purchaseOrderId, businessId });
      if (!po) {
        return NextResponse.json({ success: false, error: "Purchase Order not found." }, { status: 404 });
      }

      if (po.status === "CANCELLED") {
        return NextResponse.json({ success: false, error: "Cannot receive goods for a cancelled Purchase Order." }, { status: 400 });
      }

      if (po.status === "RECEIVED") {
        return NextResponse.json({ success: false, error: "This Purchase Order has already been fully received." }, { status: 400 });
      }

      const supplier = await Supplier.findOne({ _id: po.supplierId, businessId });

      // Generate unique sequential GRN number
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const countToday = await GoodsReceivedNote.countDocuments({
        businessId,
        createdAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lte: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      });
      const grnNumber = `GRN-${dateStr}-${(countToday + 1).toString().padStart(4, "0")}`;

      // Calculate inspection items & costs
      let totalOrderedCost = 0;
      let totalAcceptedCost = 0;
      let totalRejectedCost = 0;
      let hasRejected = false;
      let hasAccepted = false;

      const grnItems: any[] = [];

      for (const rawItem of items) {
        const poItem = po.items.find(
          (pi) => pi.productId.toString() === rawItem.productId.toString()
        );

        const orderedQty = poItem ? poItem.quantityOrdered : Number(rawItem.orderedQuantity) || 0;
        const receivedQty = Math.max(0, Number(rawItem.receivedQuantity) || 0);
        const rejectedQty = Math.max(0, Number(rawItem.rejectedQuantity) || 0);
        const acceptedQty = Math.max(0, receivedQty - rejectedQty);
        const unitCost = Number(rawItem.unitCost) >= 0 ? Number(rawItem.unitCost) : poItem ? poItem.unitCost : 0;

        const acceptedTotal = acceptedQty * unitCost;
        const rejectedTotal = rejectedQty * unitCost;

        totalOrderedCost += orderedQty * unitCost;
        totalAcceptedCost += acceptedTotal;
        totalRejectedCost += rejectedTotal;

        if (rejectedQty > 0) hasRejected = true;
        if (acceptedQty > 0) hasAccepted = true;

        grnItems.push({
          productId: rawItem.productId,
          name: rawItem.name || poItem?.name || "Product Item",
          sku: rawItem.sku || poItem?.sku,
          unit: rawItem.unit || poItem?.unit || "pcs",
          orderedQuantity: orderedQty,
          receivedQuantity: receivedQty,
          acceptedQuantity: acceptedQty,
          rejectedQuantity: rejectedQty,
          rejectionReason: rejectedQty > 0 ? rawItem.rejectionReason || "DAMAGED_PACKAGING" : undefined,
          rejectionNotes: rawItem.rejectionNotes?.trim(),
          unitCost,
          acceptedTotalCost: acceptedTotal,
          rejectedTotalCost: rejectedTotal,
          batchNumber: rawItem.batchNumber?.trim(),
          manufacturingDate: rawItem.manufacturingDate ? new Date(rawItem.manufacturingDate) : undefined,
          expiryDate: rawItem.expiryDate ? new Date(rawItem.expiryDate) : undefined,
          mrp: rawItem.mrp ? Number(rawItem.mrp) : undefined,
          sellingPrice: rawItem.sellingPrice ? Number(rawItem.sellingPrice) : undefined,
          qcInspectionNotes: rawItem.qcInspectionNotes?.trim(),
        });
      }

      // Determine Inspection Status
      let inspectionStatus: "PASSED" | "PARTIALLY_ACCEPTED" | "REJECTED" = "PASSED";
      if (!hasAccepted && hasRejected) {
        inspectionStatus = "REJECTED";
      } else if (hasAccepted && hasRejected) {
        inspectionStatus = "PARTIALLY_ACCEPTED";
      }

      const isConfirmed = Boolean(confirmImmediately);

      const grn = await GoodsReceivedNote.create({
        businessId,
        grnNumber,
        purchaseOrderId: po._id,
        poNumber: po.poNumber,
        supplierId: po.supplierId,
        supplierName: po.supplierName,
        supplierInvoiceNumber: supplierInvoiceNumber?.trim() || po.supplierInvoiceNumber,
        supplierInvoiceDate: supplierInvoiceDate ? new Date(supplierInvoiceDate) : new Date(),
        branchId: po.branchId,
        branchName: po.branchName,
        status: isConfirmed ? "CONFIRMED" : "DRAFT",
        inspectionStatus,
        items: grnItems,
        totalOrderedCost,
        totalAcceptedCost,
        totalRejectedCost,
        notes: notes?.trim(),
        receivedBy: context.username || "Warehouse Receiving Officer",
        inspectedBy: context.username || "Warehouse QC Lead",
        confirmedBy: isConfirmed ? context.username || "Warehouse Manager" : undefined,
        confirmedAt: isConfirmed ? new Date() : undefined,
      });

      // If confirmed immediately, apply inventory, batch, PO, and supplier accounts payable updates
      if (isConfirmed) {
        let allPoItemsFullyReceived = true;

        for (const grnItem of grnItems) {
          const pidStr = grnItem.productId.toString();
          const poItem = po.items.find((pi) => pi.productId.toString() === pidStr);

          if (poItem) {
            const currentRec = poItem.quantityReceived || 0;
            const newCumulative = currentRec + grnItem.acceptedQuantity;
            poItem.quantityReceived = newCumulative;

            if (newCumulative < poItem.quantityOrdered) {
              allPoItemsFullyReceived = false;
            }
          }

          // 1. Update Product Stock for accepted goods
          if (grnItem.acceptedQuantity > 0) {
            const product = await Product.findOne({ _id: grnItem.productId, businessId });
            if (product) {
              const prev = product.stockQuantity || 0;
              const next = prev + grnItem.acceptedQuantity;
              product.stockQuantity = next;
              if (grnItem.unitCost > 0) product.costPrice = grnItem.unitCost;
              if (grnItem.sellingPrice && grnItem.sellingPrice > 0) {
                product.sellingPrice = grnItem.sellingPrice;
              }
              await product.save();

              // 2. Update BranchStock if applicable
              if (po.branchId) {
                let bStock = await BranchStock.findOne({
                  businessId,
                  branchId: po.branchId,
                  productId: grnItem.productId,
                });
                if (bStock) {
                  bStock.quantity += grnItem.acceptedQuantity;
                  await bStock.save();
                } else {
                  await BranchStock.create({
                    businessId,
                    branchId: po.branchId,
                    productId: grnItem.productId,
                    quantity: grnItem.acceptedQuantity,
                  });
                }
              }

              // 3. Create or Update Batch
              if (grnItem.batchNumber && grnItem.expiryDate) {
                await Batch.create({
                  businessId,
                  productId: product._id,
                  productName: product.name,
                  productBarcode: product.barcode,
                  productSku: product.sku,
                  batchNumber: grnItem.batchNumber,
                  manufacturingDate: grnItem.manufacturingDate,
                  expiryDate: grnItem.expiryDate,
                  costPrice: grnItem.unitCost,
                  sellingPrice: grnItem.sellingPrice || product.sellingPrice,
                  mrp: grnItem.mrp,
                  initialQuantity: grnItem.acceptedQuantity,
                  quantityAvailable: grnItem.acceptedQuantity,
                  quantitySold: 0,
                  quantityDamaged: 0,
                  status: "ACTIVE",
                  supplierId: po.supplierId,
                  supplierName: po.supplierName,
                  purchaseOrderId: po._id,
                  poNumber: po.poNumber,
                  branchId: po.branchId,
                  branchName: po.branchName,
                  notes: `GRN Intake ${grnNumber}`,
                });
                product.isBatchTracked = true;
                await product.save();
              }

              // 4. Record Inventory Movement
              await InventoryMovement.create({
                businessId,
                productId: product._id,
                branchId: po.branchId,
                type: "RESTOCK",
                quantityChange: grnItem.acceptedQuantity,
                previousStock: prev,
                newStock: next,
                reason: `GRN Intake ${grnNumber} (PO ${po.poNumber}) from ${po.supplierName}`,
                referenceId: grnNumber,
                createdBy: context.userId,
              });
            }
          }

          // 5. If rejected items exist, create Quarantined Batch for vendor return / RMA
          if (grnItem.rejectedQuantity > 0) {
            const product = await Product.findOne({ _id: grnItem.productId, businessId });
            if (product && grnItem.batchNumber && grnItem.expiryDate) {
              await Batch.create({
                businessId,
                productId: product._id,
                productName: product.name,
                productBarcode: product.barcode,
                productSku: product.sku,
                batchNumber: `${grnItem.batchNumber}-REJ`,
                manufacturingDate: grnItem.manufacturingDate,
                expiryDate: grnItem.expiryDate,
                costPrice: grnItem.unitCost,
                sellingPrice: product.sellingPrice,
                initialQuantity: grnItem.rejectedQuantity,
                quantityAvailable: 0,
                quantitySold: 0,
                quantityDamaged: grnItem.rejectedQuantity,
                status: "QUARANTINED",
                supplierId: po.supplierId,
                supplierName: po.supplierName,
                purchaseOrderId: po._id,
                poNumber: po.poNumber,
                branchId: po.branchId,
                branchName: po.branchName,
                quarantineReason: `Rejected at dock: ${grnItem.rejectionReason}. ${grnItem.rejectionNotes || ""}`,
                quarantinedAt: new Date(),
                quarantinedBy: context.username || "Warehouse QC",
                notes: `Quarantined during GRN ${grnNumber}`,
              });
            }
          }
        }

        // Update PO status & early payment discount deadline
        po.status = allPoItemsFullyReceived ? "RECEIVED" : "PARTIALLY_RECEIVED";
        po.receivedAt = new Date();
        po.receivedBy = context.username || "Warehouse Manager";
        if (supplierInvoiceNumber) po.supplierInvoiceNumber = supplierInvoiceNumber.trim();

        const discDays = po.earlyPaymentDiscountDays || supplier?.earlyPaymentDiscountDays || 0;
        const discPct = po.earlyPaymentDiscountPercentage || supplier?.earlyPaymentDiscountPercentage || 0;
        if (!po.earlyPaymentDiscountDays && discDays > 0) po.earlyPaymentDiscountDays = discDays;
        if (!po.earlyPaymentDiscountPercentage && discPct > 0) po.earlyPaymentDiscountPercentage = discPct;
        if (discDays > 0) {
          po.discountDeadline = new Date(Date.now() + discDays * 24 * 60 * 60 * 1000);
        }
        if (discPct > 0) {
          po.eligibleDiscountAmount = (po.netTotal || totalAcceptedCost) * (discPct / 100);
        }
        if (!po.paymentStatus) {
          po.paymentStatus = "UNPAID";
        }
        await po.save();

        // 6. Credit Supplier Accounts Payable balance with accepted total
        if (supplier && totalAcceptedCost > 0) {
          supplier.currentBalance = (supplier.currentBalance || 0) + totalAcceptedCost;
          await supplier.save();
        }

        // 7. Audit Log
        await AuditLog.create({
          businessId,
          action: "GRN_CONFIRMED",
          entity: "GOODS_RECEIVED_NOTE",
          entityId: grn._id.toString(),
          userId: context.userId,
          details: {
            grnNumber,
            poNumber: po.poNumber,
            supplierName: po.supplierName,
            totalAcceptedCost,
            totalRejectedCost,
            inspectionStatus,
          },
        });
      }

      return NextResponse.json({
        success: true,
        grn,
        message: isConfirmed
          ? `GRN ${grnNumber} confirmed. Rs. ${totalAcceptedCost.toLocaleString()} credited to ${po.supplierName}.`
          : `GRN ${grnNumber} saved as draft dock inspection.`,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Demo: GRN created successfully.",
    });
  } catch (error: any) {
    console.error("Error in POST /api/grn:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create GRN" },
      { status: error.status || 500 }
    );
  }
}
