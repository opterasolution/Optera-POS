import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { PurchaseOrder } from "@/models/PurchaseOrder";
import { Supplier } from "@/models/Supplier";
import { AuditLog } from "@/models/AuditLog";
import { Types } from "mongoose";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      poId,
      token,
      action, // "ACKNOWLEDGE" | "REJECT"
      estimatedDeliveryDate,
      dispatchInvoiceNumber,
      driverName,
      driverPhone,
      notes,
    } = body;

    if (!poId || !token) {
      return NextResponse.json({ success: false, error: "Purchase Order ID and vendor token are required" }, { status: 400 });
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      // 1. Verify supplier via token
      const supplier = await Supplier.findOne({ portalToken: token, isActive: true });
      if (!supplier) {
        return NextResponse.json({ success: false, error: "Invalid vendor portal token" }, { status: 403 });
      }

      // 2. Find PO and verify it belongs to this supplier
      const po = await PurchaseOrder.findOne({
        _id: new Types.ObjectId(poId),
        supplierId: supplier._id,
      });

      if (!po) {
        return NextResponse.json({ success: false, error: "Purchase order not found for this vendor account" }, { status: 404 });
      }

      const isAck = action === "ACKNOWLEDGE" || action === undefined;

      // 3. Update acknowledgement details
      po.vendorAcknowledgement = {
        status: isAck ? "ACKNOWLEDGED" : "REJECTED",
        acknowledgedAt: new Date(),
        estimatedDeliveryDate: estimatedDeliveryDate ? new Date(estimatedDeliveryDate) : po.expectedDeliveryDate,
        dispatchInvoiceNumber: dispatchInvoiceNumber?.trim() || po.supplierInvoiceNumber,
        driverName: driverName?.trim(),
        driverPhone: driverPhone?.trim(),
        notes: notes?.trim(),
      };

      if (dispatchInvoiceNumber?.trim()) {
        po.supplierInvoiceNumber = dispatchInvoiceNumber.trim();
      }
      if (estimatedDeliveryDate) {
        po.expectedDeliveryDate = new Date(estimatedDeliveryDate);
      }

      await po.save();

      // 4. Log Audit
      await AuditLog.create({
        businessId: po.businessId,
        action: "INVENTORY_ADJUSTED",
        entityType: "Product",
        entityId: po._id.toString(),
        details: {
          action: "PO_VENDOR_ACKNOWLEDGED",
          poNumber: po.poNumber,
          supplierName: supplier.name,
          status: po.vendorAcknowledgement.status,
          dispatchInvoiceNumber: po.supplierInvoiceNumber,
        },
      });

      return NextResponse.json({
        success: true,
        message: isAck
          ? `Purchase Order ${po.poNumber} has been acknowledged. Dispatch details logged successfully.`
          : `Purchase Order ${po.poNumber} rejection noted. Store procurement has been notified.`,
        po,
      });
    }

    // Demo Mode Response
    return NextResponse.json({
      success: true,
      message: "Purchase order acknowledged (Demo mode).",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to acknowledge purchase order";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
