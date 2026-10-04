import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/tenant";
import { connectToDatabase } from "@/lib/db";
import { DeliveryOrder, generateTrackingToken } from "@/models/DeliveryOrder";
import { DeliveryTrip } from "@/models/DeliveryTrip";
import { Business } from "@/models/Business";
import { dispatchSms } from "@/lib/sms";
import { buildWhatsAppUrl } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  try {
    const context = await requireAuth();
    await connectToDatabase();

    const body = await req.json();
    const { orderId, tripId } = body;

    if (!orderId && !tripId) {
      return NextResponse.json(
        { success: false, error: "Either orderId or tripId must be provided." },
        { status: 400 }
      );
    }

    const business = await Business.findById(context.businessId).lean();
    const storeName = business?.name || "Corner Store POS";

    // Resolve domain origin for tracking URLs
    const origin =
      req.headers.get("origin") ||
      req.headers.get("referer")?.replace(/\/$/, "") ||
      process.env.NEXTAUTH_URL ||
      "http://localhost:3000";

    const ordersToNotify: any[] = [];

    if (orderId) {
      const order = await DeliveryOrder.findOne({
        _id: orderId,
        businessId: context.businessId,
      });
      if (!order) {
        return NextResponse.json(
          { success: false, error: "Order not found." },
          { status: 404 }
        );
      }
      ordersToNotify.push(order);
    } else if (tripId) {
      const trip = await DeliveryTrip.findOne({
        _id: tripId,
        businessId: context.businessId,
      });
      if (!trip) {
        return NextResponse.json(
          { success: false, error: "Trip not found." },
          { status: 404 }
        );
      }

      const orderIds = trip.stops.map((s) => s.orderId);
      const tripOrders = await DeliveryOrder.find({
        _id: { $in: orderIds },
        businessId: context.businessId,
      });
      ordersToNotify.push(...tripOrders);
    }

    const results: Array<{
      orderId: string;
      orderNumber: string;
      customerName: string;
      customerPhone: string;
      smsSuccess: boolean;
      smsStatus: string;
      trackingUrl: string;
      waUrl: string;
      error?: string;
    }> = [];

    for (const order of ordersToNotify) {
      // Ensure tracking token
      if (!order.trackingToken) {
        order.trackingToken = generateTrackingToken();
      }

      const trackingUrl = `${origin}/delivery/track/${order.trackingToken}`;
      const driverName = order.rider?.name || "Fleet Delivery Partner";
      const vehicleNumber = order.rider?.vehicleNumber || "Motorbike / Tuk-Tuk";

      const smsText = `Dear ${order.customer.name}, your order ${order.externalOrderId} from ${storeName} is on the way with driver ${driverName} (${vehicleNumber})! Track live: ${trackingUrl}`;
      const waUrl = buildWhatsAppUrl(order.customer.phone, smsText);

      // Attempt dispatching SMS
      const smsResult = await dispatchSms({
        businessId: context.businessId,
        recipientPhone: order.customer.phone,
        recipientName: order.customer.name,
        eventType: "DELIVERY_DISPATCH",
        templateKey: "deliveryDispatch",
        variables: {
          customerName: order.customer.name,
          orderNumber: order.externalOrderId,
          driverName,
          vehicleNumber,
          trackingUrl,
        },
      });

      if (smsResult.success) {
        order.trackingSmsStatus = "SENT";
        order.trackingSmsSentAt = new Date();
      } else {
        order.trackingSmsStatus = "FAILED";
      }

      await order.save();

      results.push({
        orderId: order._id.toString(),
        orderNumber: order.externalOrderId,
        customerName: order.customer.name,
        customerPhone: order.customer.phone,
        smsSuccess: smsResult.success,
        smsStatus: smsResult.status,
        trackingUrl,
        waUrl,
        error: smsResult.error,
      });
    }

    const successCount = results.filter((r) => r.smsSuccess).length;

    return NextResponse.json({
      success: true,
      message: `Processed live tracking alerts for ${results.length} order(s). ${successCount} SMS sent successfully.`,
      notifiedOrders: results,
    });
  } catch (error: any) {
    console.error("POST /api/delivery/sms error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to send tracking alerts." },
      { status: 500 }
    );
  }
}
