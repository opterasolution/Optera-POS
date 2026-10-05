import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { PurchaseOrder, generatePoAccessToken } from "@/models/PurchaseOrder";
import { Supplier } from "@/models/Supplier";
import { Business } from "@/models/Business";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth } from "@/lib/tenant";
import { formatCurrency } from "@/lib/formatters";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireAuth();
    const body = await req.json();

    const {
      channel = "WHATSAPP", // "WHATSAPP" | "EMAIL" | "DIRECT_LINK" | "MANUAL"
      recipientPhone,
      recipientEmail,
      notes,
    } = body;

    await connectToDatabase();
    const businessId = new Types.ObjectId(context.businessId);

    const po = await PurchaseOrder.findOne({
      _id: new Types.ObjectId(params.id),
      businessId,
    });

    if (!po) {
      return NextResponse.json({ success: false, error: "Purchase Order not found." }, { status: 404 });
    }

    const [supplier, business] = await Promise.all([
      Supplier.findById(po.supplierId).lean(),
      Business.findById(businessId).lean(),
    ]);

    // Ensure secure vendor access token exists on the PO
    if (!po.vendorAccessToken) {
      po.vendorAccessToken = generatePoAccessToken(po._id.toString());
    }

    // Advance status to SENT if it was in DRAFT
    if (po.status === "DRAFT") {
      po.status = "SENT";
    }

    const targetPhone = recipientPhone?.trim() || supplier?.phone || "";
    const targetEmail = recipientEmail?.trim() || supplier?.email || "";

    po.dispatchDetails = {
      dispatchedAt: new Date(),
      dispatchedBy: context.username || "Procurement Officer",
      channel,
      recipientPhone: targetPhone,
      recipientEmail: targetEmail,
    };

    if (!po.vendorAcknowledgement || !po.vendorAcknowledgement.status) {
      po.vendorAcknowledgement = {
        status: "PENDING",
      };
    }

    await po.save();

    const origin = req.headers.get("origin") || "https://pos.srilanka.lk";
    const portalUrl = `${origin}/portal/vendor/po/${po.vendorAccessToken}`;

    const storeName = business?.name || "Our Store";
    const branchName = po.branchName || "Main Warehouse";
    const itemCount = po.items.length;
    const formattedTotal = formatCurrency(po.netTotal);
    const deliveryDateStr = po.expectedDeliveryDate
      ? new Date(po.expectedDeliveryDate).toLocaleDateString("en-GB")
      : "As soon as possible";

    // Item line summaries for message (first 4 items + etc.)
    const itemLines = po.items
      .slice(0, 4)
      .map((it) => `• ${it.quantityOrdered}x ${it.name} @ Rs. ${it.unitCost.toLocaleString()}`)
      .join("\n");
    const extraCount = po.items.length > 4 ? `\n...and ${po.items.length - 4} more items` : "";

    const whatsappMessage = `📦 *PURCHASE ORDER: ${po.poNumber}*\nFrom: *${storeName}* (${branchName})\nSupplier: ${po.supplierName}\nItems: ${itemCount} lines | Value: *${formattedTotal}*\nExpected Delivery: ${deliveryDateStr}\n\n*Order Lines Preview:*\n${itemLines}${extraCount}\n\n🔗 *View PO & Confirm Delivery (ASN):*\n${portalUrl}\n\nPlease review lines, acknowledge delivery date, or notify van dispatch.\nThank you!`;

    const emailSubject = `Purchase Order ${po.poNumber} from ${storeName}`;
    const emailBody = `Dear ${po.supplierName},\n\nPlease find Purchase Order ${po.poNumber} issued by ${storeName} for ${itemCount} items amounting to ${formattedTotal}.\n\nYou can view full item specifications and confirm delivery dates / driver details online:\n${portalUrl}\n\nDelivery Branch: ${branchName}\nExpected Date: ${deliveryDateStr}\n\nThank you,\n${storeName} Procurement Team`;

    await AuditLog.create({
      businessId,
      action: "PURCHASE_ORDER_DISPATCHED",
      performedBy: context.username || "User",
      details: `PO ${po.poNumber} dispatched to ${po.supplierName} via ${channel} (${targetPhone || targetEmail || "Portal Link"})`,
    });

    return NextResponse.json({
      success: true,
      message: `Purchase order ${po.poNumber} dispatched via ${channel}.`,
      po,
      vendorAccessToken: po.vendorAccessToken,
      portalUrl,
      whatsappMessage,
      whatsappTargetPhone: targetPhone,
      emailSubject,
      emailBody,
      emailTargetAddress: targetEmail,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to dispatch purchase order." },
      { status: 500 }
    );
  }
}
