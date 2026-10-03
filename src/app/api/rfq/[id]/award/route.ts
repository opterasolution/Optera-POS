import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { RequestForQuotation } from "@/models/RequestForQuotation";
import { PurchaseOrder } from "@/models/PurchaseOrder";
import { Supplier } from "@/models/Supplier";
import { Branch } from "@/models/Branch";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth, requireRole } from "@/lib/tenant";
import { dispatchSms } from "@/lib/sms";
import { Types } from "mongoose";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPER_ADMIN"]);
    const rfqId = params.id;
    const body = await req.json();
    const { supplierId, branchId, notes } = body;

    if (!supplierId) {
      return NextResponse.json({ success: false, error: "Winning supplierId is required" }, { status: 400 });
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const rfq = await RequestForQuotation.findOne({ _id: new Types.ObjectId(rfqId), businessId });
      if (!rfq) {
        return NextResponse.json({ success: false, error: "Quotation request not found" }, { status: 404 });
      }

      if (rfq.status === "AWARDED") {
        return NextResponse.json({ success: false, error: `RFQ has already been awarded to PO ${rfq.awardedPoNumber}` }, { status: 400 });
      }

      // Find the winning bid
      const winningBid = rfq.bids.find((b) => b.supplierId.toString() === supplierId.toString());
      if (!winningBid) {
        return NextResponse.json({ success: false, error: "Selected supplier has not submitted a bid for this RFQ" }, { status: 400 });
      }

      const supplier = await Supplier.findOne({ _id: new Types.ObjectId(supplierId), businessId });
      if (!supplier) {
        return NextResponse.json({ success: false, error: "Supplier record not found" }, { status: 404 });
      }

      // Resolve destination branch
      let branchName = "Main Store / Warehouse";
      let resolvedBranchId = undefined;
      if (branchId && Types.ObjectId.isValid(branchId)) {
        const branch = await Branch.findOne({ _id: new Types.ObjectId(branchId), businessId });
        if (branch) {
          resolvedBranchId = branch._id;
          branchName = branch.name;
        }
      } else {
        const defaultBranch = await Branch.findOne({ businessId, isMainWarehouse: true });
        if (defaultBranch) {
          resolvedBranchId = defaultBranch._id;
          branchName = defaultBranch.name;
        }
      }

      // 1. Generate sequential PO number: PO-YYYYMMDD-XXXX
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const countToday = await PurchaseOrder.countDocuments({
        businessId,
        createdAt: { $gte: startOfDay, $lte: endOfDay },
      });
      const seqStr = String(countToday + 1).padStart(4, "0");
      const poNumber = `PO-${todayStr}-${seqStr}`;

      // 2. Map winning bid items to PO lines
      const poItems = winningBid.items.map((it) => ({
        productId: it.productId,
        name: it.productName,
        sku: "",
        unit: "pcs",
        quantityOrdered: it.offeredQty,
        quantityReceived: 0,
        unitCost: it.netUnitCost || it.unitCost,
        total: it.totalCost,
        notes: it.notes || "",
      }));

      // Calculate delivery date based on lead time
      const maxLeadTime = Math.max(...winningBid.items.map((it) => it.leadTimeDays || 2));
      const expectedDelivery = new Date(Date.now() + maxLeadTime * 24 * 60 * 60 * 1000);

      // 3. Create the Purchase Order
      const newPo = await PurchaseOrder.create({
        businessId,
        poNumber,
        supplierId: supplier._id,
        supplierName: supplier.name,
        branchId: resolvedBranchId,
        branchName,
        status: "SENT",
        items: poItems,
        subtotal: winningBid.subtotal,
        taxTotal: winningBid.taxAmount || 0,
        netTotal: winningBid.netTotal,
        expectedDeliveryDate: expectedDelivery,
        rfqId: rfq._id,
        rfqNumber: rfq.rfqNumber,
        vendorAcknowledgement: {
          status: "PENDING",
        },
        notes: `Awarded via e-Bidding RFQ: ${rfq.rfqNumber}. ${notes || ""}`.trim(),
        createdBy: context.username || "Manager",
      });

      // 4. Update RFQ state & bids
      rfq.status = "AWARDED";
      rfq.awardedSupplierId = supplier._id;
      rfq.awardedSupplierName = supplier.name;
      rfq.awardedPoId = newPo._id;
      rfq.awardedPoNumber = newPo.poNumber;
      rfq.awardedAt = new Date();
      rfq.awardedNotes = notes || "";

      // Update bids status
      rfq.bids.forEach((b) => {
        if (b.supplierId.toString() === supplierId.toString()) {
          b.status = "ACCEPTED";
        } else {
          b.status = "REJECTED";
        }
      });

      // Update invited status
      rfq.invitedSuppliers.forEach((inv) => {
        if (inv.supplierId.toString() === supplierId.toString()) {
          inv.status = "AWARDED";
        }
      });

      await rfq.save();

      // 5. Notify winning supplier via SMS
      if (supplier.phone) {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://pos.srilanka.lk";
          const portalUrl = `${baseUrl}/portal/vendor/${supplier.portalToken}?tab=orders`;
          await dispatchSms({
            businessId,
            recipientPhone: supplier.phone,
            recipientName: supplier.name,
            eventType: "CUSTOM",
            message: `Congratulations ${supplier.name}! Your quotation for ${rfq.rfqNumber} has been accepted. Purchase Order ${poNumber} (Rs. ${newPo.netTotal.toLocaleString()}) has been issued. View & acknowledge in your vendor portal: ${portalUrl}`,
            metadata: { poNumber, rfqNumber: rfq.rfqNumber, type: "RFQ_AWARDED" },
          });
        } catch (smsErr) {
          console.error("Failed to send RFQ award SMS to supplier", supplier.name, smsErr);
        }
      }

      // 6. Record Audit Log
      await AuditLog.create({
        businessId,
        userId: context.userId,
        userName: context.username,
        action: "INVENTORY_ADJUSTED",
        entityType: "Product",
        entityId: newPo._id.toString(),
        details: { action: "RFQ_AWARDED_TO_PO", rfqNumber: rfq.rfqNumber, poNumber, supplierName: supplier.name },
      });

      return NextResponse.json({
        success: true,
        po: newPo,
        rfq,
        message: `Quotation request ${rfq.rfqNumber} awarded to ${supplier.name}. Purchase order ${poNumber} created successfully!`,
      });
    }

    // Demo Mode Response
    return NextResponse.json({
      success: true,
      poNumber: `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-8888`,
      message: "Demo mode: RFQ awarded and PO created.",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to award RFQ";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
