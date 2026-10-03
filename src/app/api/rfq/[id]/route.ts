import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { RequestForQuotation, generateBidToken } from "@/models/RequestForQuotation";
import { Supplier, generateVendorPortalToken } from "@/models/Supplier";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth, requireRole } from "@/lib/tenant";
import { Types } from "mongoose";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireAuth();
    const rfqId = params.id;

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      let rfq = null;
      if (Types.ObjectId.isValid(rfqId)) {
        rfq = await RequestForQuotation.findOne({ _id: new Types.ObjectId(rfqId), businessId }).lean();
      } else {
        rfq = await RequestForQuotation.findOne({ rfqNumber: rfqId, businessId }).lean();
      }

      if (!rfq) {
        return NextResponse.json({ success: false, error: "Quotation request not found" }, { status: 404 });
      }

      // Compute Side-by-Side Comparison Matrix
      const itemMatrix = rfq.items.map((item) => {
        const lineBids = rfq.bids.map((b) => {
          const matchedLine = b.items.find(
            (bi) => bi.productId?.toString() === item.productId?.toString() || bi.productName === item.productName
          );
          return {
            supplierId: b.supplierId,
            supplierName: b.supplierName,
            offeredQty: matchedLine ? matchedLine.offeredQty : 0,
            unitCost: matchedLine ? matchedLine.unitCost : 0,
            discountPercent: matchedLine ? matchedLine.discountPercent : 0,
            netUnitCost: matchedLine ? matchedLine.netUnitCost : 0,
            totalCost: matchedLine ? matchedLine.totalCost : 0,
            leadTimeDays: matchedLine ? matchedLine.leadTimeDays : b.items[0]?.leadTimeDays || 2,
            notes: matchedLine?.notes || "",
          };
        }).filter((b) => b.netUnitCost > 0);

        // Find lowest price
        const sorted = [...lineBids].sort((a, b) => a.netUnitCost - b.netUnitCost);
        const lowestBid = sorted[0] || null;

        return {
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          requestedQty: item.requestedQty,
          unit: item.unit,
          targetPrice: item.targetPrice,
          specifications: item.specifications,
          lowestBid,
          lineBids,
        };
      });

      // Supplier comparison summary
      const supplierComparison = rfq.bids.map((b) => ({
        supplierId: b.supplierId,
        supplierName: b.supplierName,
        submittedAt: b.submittedAt,
        subtotal: b.subtotal,
        taxAmount: b.taxAmount,
        netTotal: b.netTotal,
        leadTimeDays: Math.max(...b.items.map((it) => it.leadTimeDays || 2)),
        deliveryTerms: b.deliveryTerms || "Standard",
        paymentTerms: b.paymentTerms || "30 Days Credit",
        validUntil: b.validUntil,
        status: b.status,
      })).sort((a, b) => a.netTotal - b.netTotal);

      return NextResponse.json({
        success: true,
        rfq,
        comparison: {
          itemMatrix,
          supplierComparison,
          lowestOverallBid: supplierComparison[0] || null,
        },
      });
    }

    // Demo Mode Response
    return NextResponse.json({
      success: false,
      error: "Live database required for RFQ inspection",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load RFQ";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPER_ADMIN"]);
    const rfqId = params.id;
    const body = await req.json();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const rfq = await RequestForQuotation.findOne({ _id: new Types.ObjectId(rfqId), businessId });
      if (!rfq) {
        return NextResponse.json({ success: false, error: "Quotation request not found" }, { status: 404 });
      }

      if (body.title) rfq.title = body.title.trim();
      if (body.description !== undefined) rfq.description = body.description?.trim();
      if (body.requiredByDate) rfq.requiredByDate = new Date(body.requiredByDate);
      if (body.deadlineDate) rfq.deadlineDate = new Date(body.deadlineDate);
      if (body.status) rfq.status = body.status;

      // Add additional invited suppliers
      if (Array.isArray(body.addSupplierIds) && body.addSupplierIds.length > 0) {
        const suppliers = await Supplier.find({
          businessId,
          _id: { $in: body.addSupplierIds.map((id: string) => new Types.ObjectId(id)) },
        });

        for (const s of suppliers) {
          if (!rfq.invitedSuppliers.some((inv) => inv.supplierId.toString() === s._id.toString())) {
            if (!s.portalToken) {
              s.portalToken = generateVendorPortalToken();
              await s.save();
            }
            rfq.invitedSuppliers.push({
              supplierId: s._id,
              supplierName: s.name,
              email: s.email || "",
              phone: s.phone,
              token: generateBidToken(),
              status: "INVITED",
              invitedAt: new Date(),
            });
          }
        }
      }

      await rfq.save();

      return NextResponse.json({
        success: true,
        rfq,
        message: "Quotation request updated successfully.",
      });
    }

    return NextResponse.json({ success: true, message: "Demo mode: RFQ updated" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update RFQ";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPER_ADMIN"]);
    const rfqId = params.id;

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const rfq = await RequestForQuotation.findOne({ _id: new Types.ObjectId(rfqId), businessId });
      if (!rfq) {
        return NextResponse.json({ success: false, error: "Quotation request not found" }, { status: 404 });
      }

      if (rfq.status === "AWARDED") {
        return NextResponse.json({ success: false, error: "Cannot delete an awarded RFQ. Cancel the associated PO instead." }, { status: 400 });
      }

      rfq.status = "CANCELLED";
      await rfq.save();

      await AuditLog.create({
        businessId,
        userId: context.userId,
        userName: context.username,
        action: "INVENTORY_ADJUSTED",
        entityType: "Product",
        entityId: rfq._id.toString(),
        details: { action: "RFQ_CANCELLED", rfqNumber: rfq.rfqNumber },
      });

      return NextResponse.json({
        success: true,
        message: `Quotation request ${rfq.rfqNumber} has been cancelled.`,
      });
    }

    return NextResponse.json({ success: true, message: "Demo mode: RFQ cancelled" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to cancel RFQ";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
