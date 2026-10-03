import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { GoodsReceivedNote } from "@/models/GoodsReceivedNote";
import { requireAuth, requireRole } from "@/lib/tenant";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireAuth();
    const { id } = params;

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const grn = await GoodsReceivedNote.findOne({
        _id: id,
        businessId: context.businessId,
      }).lean();

      if (!grn) {
        return NextResponse.json({ success: false, error: "Goods Received Note not found" }, { status: 404 });
      }

      return NextResponse.json({ success: true, grn });
    }

    return NextResponse.json({
      success: true,
      grn: {
        _id: id,
        grnNumber: "GRN-DEMO-0001",
        poNumber: "PO-DEMO-0001",
        supplierName: "Demo Supplier",
        status: "CONFIRMED",
        totalAcceptedCost: 15000,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch GRN" },
      { status: error.status || 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "INVENTORY_CLERK", "SUPER_ADMIN"]);
    const { id } = params;
    const body = await req.json();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const grn = await GoodsReceivedNote.findOne({
        _id: id,
        businessId: context.businessId,
      });

      if (!grn) {
        return NextResponse.json({ success: false, error: "Goods Received Note not found" }, { status: 404 });
      }

      if (grn.status !== "DRAFT") {
        return NextResponse.json(
          { success: false, error: "Only DRAFT Goods Received Notes can be modified." },
          { status: 400 }
        );
      }

      if (body.supplierInvoiceNumber) grn.supplierInvoiceNumber = body.supplierInvoiceNumber.trim();
      if (body.supplierInvoiceDate) grn.supplierInvoiceDate = new Date(body.supplierInvoiceDate);
      if (body.notes !== undefined) grn.notes = body.notes?.trim();

      if (Array.isArray(body.items)) {
        let totalAccepted = 0;
        let totalRejected = 0;
        let hasAccepted = false;
        let hasRejected = false;

        const updatedItems = grn.items.map((it) => {
          const match = body.items.find(
            (bItem: any) => bItem.productId?.toString() === it.productId.toString()
          );
          if (match) {
            const receivedQty = Math.max(0, Number(match.receivedQuantity) || 0);
            const rejectedQty = Math.max(0, Number(match.rejectedQuantity) || 0);
            const acceptedQty = Math.max(0, receivedQty - rejectedQty);
            const acceptedTotal = acceptedQty * it.unitCost;
            const rejectedTotal = rejectedQty * it.unitCost;

            totalAccepted += acceptedTotal;
            totalRejected += rejectedTotal;
            if (rejectedQty > 0) hasRejected = true;
            if (acceptedQty > 0) hasAccepted = true;

            return {
              ...it,
              receivedQuantity: receivedQty,
              acceptedQuantity: acceptedQty,
              rejectedQuantity: rejectedQty,
              rejectionReason: rejectedQty > 0 ? match.rejectionReason : undefined,
              rejectionNotes: match.rejectionNotes?.trim(),
              acceptedTotalCost: acceptedTotal,
              rejectedTotalCost: rejectedTotal,
              batchNumber: match.batchNumber?.trim() || it.batchNumber,
              manufacturingDate: match.manufacturingDate ? new Date(match.manufacturingDate) : it.manufacturingDate,
              expiryDate: match.expiryDate ? new Date(match.expiryDate) : it.expiryDate,
              mrp: match.mrp ? Number(match.mrp) : it.mrp,
              sellingPrice: match.sellingPrice ? Number(match.sellingPrice) : it.sellingPrice,
              qcInspectionNotes: match.qcInspectionNotes?.trim() || it.qcInspectionNotes,
            };
          }
          totalAccepted += it.acceptedTotalCost;
          totalRejected += it.rejectedTotalCost;
          if (it.rejectedQuantity > 0) hasRejected = true;
          if (it.acceptedQuantity > 0) hasAccepted = true;
          return it;
        });

        grn.items = updatedItems as any;
        grn.totalAcceptedCost = totalAccepted;
        grn.totalRejectedCost = totalRejected;

        if (!hasAccepted && hasRejected) grn.inspectionStatus = "REJECTED";
        else if (hasAccepted && hasRejected) grn.inspectionStatus = "PARTIALLY_ACCEPTED";
        else grn.inspectionStatus = "PASSED";
      }

      await grn.save();

      return NextResponse.json({
        success: true,
        grn,
        message: "Draft GRN updated successfully.",
      });
    }

    return NextResponse.json({ success: true, message: "Demo: Draft GRN updated." });
  } catch (error: any) {
    console.error("Error in PATCH /api/grn/[id]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update GRN" },
      { status: error.status || 500 }
    );
  }
}
