import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { PurchaseOrder } from "@/models/PurchaseOrder";
import { Supplier } from "@/models/Supplier";
import { Business } from "@/models/Business";
import { Product } from "@/models/Product";
import { AuditLog } from "@/models/AuditLog";

export async function GET(
  req: Request,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;
    const { searchParams } = new URL(req.url);
    const poId = searchParams.get("poId");

    await connectToDatabase();

    // 1. Try finding PO by direct vendorAccessToken
    let po = await PurchaseOrder.findOne({ vendorAccessToken: token }).lean();

    // 2. If not found, try finding supplier by portalToken and poId
    if (!po && poId) {
      const supplier = await Supplier.findOne({ portalToken: token, isActive: true }).lean();
      if (supplier) {
        po = await PurchaseOrder.findOne({
          _id: new Types.ObjectId(poId),
          supplierId: supplier._id,
        }).lean();
      }
    }

    if (!po) {
      return NextResponse.json(
        { success: false, error: "Purchase Order not found or link has expired." },
        { status: 404 }
      );
    }

    // 3. Fetch store business and supplier info
    const [business, supplier] = await Promise.all([
      Business.findById(po.businessId).lean(),
      Supplier.findById(po.supplierId).lean(),
    ]);

    // 4. Enrich PO items with product barcodes if available
    const productIds = po.items.map((it: any) => it.productId);
    const products = await Product.find({ _id: { $in: productIds } }).lean();
    const productMap = new Map(products.map((p: any) => [p._id.toString(), p]));

    const enrichedItems = po.items.map((it: any) => {
      const p = productMap.get(it.productId?.toString());
      return {
        ...it,
        barcode: p?.barcode || "",
        category: p?.category || "",
        currentStoreStock: p?.stockQuantity ?? 0,
      };
    });

    return NextResponse.json({
      success: true,
      po: {
        ...po,
        items: enrichedItems,
      },
      business: {
        name: business?.name || "Our Store",
        phone: business?.phone || "",
        email: business?.email || "",
        address: business?.address || "",
        currency: business?.currency || "LKR",
      },
      supplier: {
        name: supplier?.name || po.supplierName,
        phone: supplier?.phone || "",
        contactPerson: supplier?.contactPerson || "",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch purchase order fulfillment details." },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;
    const body = await req.json();
    const { action } = body; // "ACKNOWLEDGE" | "DISPATCH_ASN" | "UPDATE_LINES" | "REJECT"

    await connectToDatabase();

    // Find PO by direct vendorAccessToken or fallback
    let po = await PurchaseOrder.findOne({ vendorAccessToken: token });
    if (!po && body.poId) {
      const supplier = await Supplier.findOne({ portalToken: token, isActive: true });
      if (supplier) {
        po = await PurchaseOrder.findOne({
          _id: new Types.ObjectId(body.poId),
          supplierId: supplier._id,
        });
      }
    }

    if (!po) {
      return NextResponse.json(
        { success: false, error: "Purchase Order not found or link has expired." },
        { status: 404 }
      );
    }

    if (!po.vendorAcknowledgement) {
      po.vendorAcknowledgement = { status: "PENDING" };
    }

    // ================= 1. ACKNOWLEDGE ORDER =================
    if (action === "ACKNOWLEDGE") {
      const {
        estimatedDeliveryDate,
        vendorReferenceNumber,
        repName,
        repPhone,
        notes,
      } = body;

      po.vendorAcknowledgement.status = "ACKNOWLEDGED";
      po.vendorAcknowledgement.acknowledgedAt = new Date();
      if (estimatedDeliveryDate) {
        po.vendorAcknowledgement.estimatedDeliveryDate = new Date(estimatedDeliveryDate);
        po.expectedDeliveryDate = new Date(estimatedDeliveryDate);
      }
      if (vendorReferenceNumber) po.vendorAcknowledgement.vendorReferenceNumber = vendorReferenceNumber.trim();
      if (repName) po.vendorAcknowledgement.repName = repName.trim();
      if (repPhone) po.vendorAcknowledgement.repPhone = repPhone.trim();
      if (notes) po.vendorAcknowledgement.notes = notes.trim();

      await po.save();

      await AuditLog.create({
        businessId: po.businessId,
        action: "PO_VENDOR_ACKNOWLEDGED",
        performedBy: repName || "Distributor Sales Rep",
        details: `PO ${po.poNumber} acknowledged by vendor. Est Delivery: ${estimatedDeliveryDate || "Unspecified"}. Ref: ${vendorReferenceNumber || "None"}`,
      });

      return NextResponse.json({
        success: true,
        message: `Purchase Order ${po.poNumber} acknowledged successfully. Thank you!`,
        po,
      });
    }

    // ================= 2. ADVANCE SHIPPING NOTICE (ASN / IN-TRANSIT) =================
    if (action === "DISPATCH_ASN") {
      const {
        dispatchInvoiceNumber,
        vehicleNumber,
        driverName,
        driverPhone,
        notes,
      } = body;

      po.vendorAcknowledgement.status = "IN_TRANSIT";
      po.vendorAcknowledgement.dispatchedAt = new Date();
      if (dispatchInvoiceNumber) {
        po.vendorAcknowledgement.dispatchInvoiceNumber = dispatchInvoiceNumber.trim();
        po.supplierInvoiceNumber = dispatchInvoiceNumber.trim();
      }
      if (vehicleNumber) po.vendorAcknowledgement.vehicleNumber = vehicleNumber.trim();
      if (driverName) po.vendorAcknowledgement.driverName = driverName.trim();
      if (driverPhone) po.vendorAcknowledgement.driverPhone = driverPhone.trim();
      if (notes) {
        po.vendorAcknowledgement.notes = (po.vendorAcknowledgement.notes ? po.vendorAcknowledgement.notes + " | " : "") + notes.trim();
      }

      await po.save();

      await AuditLog.create({
        businessId: po.businessId,
        action: "PO_VENDOR_DISPATCHED_ASN",
        performedBy: driverName || "Distributor Delivery Fleet",
        details: `PO ${po.poNumber} marked IN_TRANSIT. Van: ${vehicleNumber || "N/A"}, Driver: ${driverName || "N/A"} (${driverPhone || "N/A"}), Inv: ${dispatchInvoiceNumber || "N/A"}`,
      });

      return NextResponse.json({
        success: true,
        message: `Advance Shipping Notice (ASN) submitted. Order ${po.poNumber} marked as IN-TRANSIT.`,
        po,
      });
    }

    // ================= 3. UPDATE LINE AVAILABILITY =================
    if (action === "UPDATE_LINES") {
      const { lineUpdates = [] } = body;

      // Update line availability on PO items
      for (const update of lineUpdates) {
        const item = po.items.find((it) => it.productId.toString() === update.productId);
        if (item) {
          if (update.availability) item.vendorAvailability = update.availability;
          if (update.confirmedQuantity !== undefined) item.vendorConfirmedQuantity = Number(update.confirmedQuantity);
          if (update.vendorNotes) item.vendorNotes = update.vendorNotes.trim();
        }
      }

      await po.save();

      return NextResponse.json({
        success: true,
        message: "Line item availability updated successfully.",
        po,
      });
    }

    // ================= 4. REJECT ORDER =================
    if (action === "REJECT") {
      po.vendorAcknowledgement.status = "REJECTED";
      po.vendorAcknowledgement.acknowledgedAt = new Date();
      if (body.notes) po.vendorAcknowledgement.notes = body.notes.trim();

      await po.save();

      await AuditLog.create({
        businessId: po.businessId,
        action: "PO_VENDOR_REJECTED",
        performedBy: "Distributor Representative",
        details: `PO ${po.poNumber} rejected by vendor: ${body.notes || "No reason specified"}`,
      });

      return NextResponse.json({
        success: true,
        message: `Purchase Order rejection recorded.`,
        po,
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action specified." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process vendor fulfillment action." },
      { status: 500 }
    );
  }
}
