import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { RequestForQuotation } from "@/models/RequestForQuotation";
import { Supplier } from "@/models/Supplier";
import { Types } from "mongoose";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      rfqId,
      token,
      items,
      validUntil,
      deliveryTerms,
      paymentTerms,
      notes,
    } = body;

    if (!rfqId || !token) {
      return NextResponse.json({ success: false, error: "RFQ ID and authentication token are required" }, { status: 400 });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: "Quotation item rates are required" }, { status: 400 });
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      // 1. Find RFQ
      const rfq = await RequestForQuotation.findById(rfqId);
      if (!rfq) {
        return NextResponse.json({ success: false, error: "Quotation request not found" }, { status: 404 });
      }

      if (rfq.status !== "OPEN" && rfq.status !== "EVALUATING") {
        return NextResponse.json({ success: false, error: `This RFQ is ${rfq.status.toLowerCase()} and is no longer accepting quotation submissions.` }, { status: 400 });
      }

      if (new Date() > new Date(rfq.deadlineDate)) {
        return NextResponse.json({ success: false, error: "The deadline for submitting quotations on this RFQ has expired." }, { status: 400 });
      }

      // 2. Validate token against invited suppliers OR supplier portalToken
      let invitedSupplier = rfq.invitedSuppliers.find((inv) => inv.token === token);
      let supplierDoc = null;

      if (invitedSupplier) {
        supplierDoc = await Supplier.findById(invitedSupplier.supplierId);
      } else {
        // Check if token matches a supplier's main portalToken
        supplierDoc = await Supplier.findOne({ portalToken: token, businessId: rfq.businessId });
        if (supplierDoc) {
          invitedSupplier = rfq.invitedSuppliers.find(
            (inv) => inv.supplierId.toString() === supplierDoc!._id.toString()
          );
        }
      }

      if (!invitedSupplier || !supplierDoc) {
        return NextResponse.json({ success: false, error: "Unauthorized: You are not an invited bidder for this RFQ." }, { status: 403 });
      }

      // 3. Format and validate bid items
      let subtotal = 0;
      const formattedItems = items.map((it: any) => {
        const unitCost = Number(it.unitCost || 0);
        const offeredQty = Number(it.offeredQty || 1);
        const discountPercent = Number(it.discountPercent || 0);
        const netUnitCost = unitCost * (1 - discountPercent / 100);
        const totalCost = netUnitCost * offeredQty;
        subtotal += totalCost;

        return {
          productId: new Types.ObjectId(it.productId),
          productName: it.productName || "Product",
          offeredQty,
          unitCost,
          discountPercent,
          netUnitCost,
          totalCost,
          leadTimeDays: Number(it.leadTimeDays || 2),
          notes: it.notes?.trim() || "",
        };
      });

      const netTotal = subtotal; // Assuming net prices; taxes can be factored if applicable

      // 4. Update or replace bid
      const existingBidIndex = rfq.bids.findIndex(
        (b) => b.supplierId.toString() === supplierDoc!._id.toString()
      );

      const bidPayload = {
        supplierId: supplierDoc._id,
        supplierName: supplierDoc.name,
        token: invitedSupplier.token,
        submittedAt: new Date(),
        items: formattedItems,
        subtotal,
        taxAmount: 0,
        netTotal,
        validUntil: validUntil ? new Date(validUntil) : undefined,
        deliveryTerms: deliveryTerms?.trim() || "Standard store delivery",
        paymentTerms: paymentTerms?.trim() || `${supplierDoc.paymentTermsDays || 30} Days Credit`,
        notes: notes?.trim() || "",
        status: "PENDING" as const,
      };

      if (existingBidIndex >= 0) {
        rfq.bids[existingBidIndex] = bidPayload as any;
      } else {
        rfq.bids.push(bidPayload as any);
      }

      // Update invited supplier entry
      invitedSupplier.status = "SUBMITTED";
      invitedSupplier.submittedAt = new Date();

      // Check if all invited suppliers have submitted
      const allSubmitted = rfq.invitedSuppliers.every(
        (inv) => inv.status === "SUBMITTED" || inv.status === "DECLINED"
      );
      if (allSubmitted && rfq.status === "OPEN") {
        rfq.status = "EVALUATING";
      }

      await rfq.save();

      return NextResponse.json({
        success: true,
        message: `Your quotation for ${rfq.rfqNumber} (Net Total: Rs. ${netTotal.toLocaleString()}) has been successfully submitted!`,
        bid: bidPayload,
      });
    }

    // Demo Mode Response
    return NextResponse.json({
      success: true,
      message: "Quotation successfully submitted (Demo mode).",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to submit quotation bid";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
