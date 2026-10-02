import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { DeliveryOrder } from "@/models/DeliveryOrder";
import { Business } from "@/models/Business";

/**
 * Webhook handler for PickMe Food & PickMe Flash incoming order events
 */
export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const event = payload.event || "order.created";
    const storeId = payload.store_id || payload.storeId;
    const orderData = payload.order || payload;

    if (!orderData || !orderData.order_id) {
      return NextResponse.json(
        { success: false, error: "Invalid webhook payload: missing order_id." },
        { status: 400 }
      );
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      // Find business by storeId or match first active business
      let business = storeId
        ? await Business.findOne({ "deliverySettings.pickmeStoreId": storeId, isActive: true })
        : null;

      if (!business) {
        business = await Business.findOne({ isActive: true });
      }

      if (!business) {
        return NextResponse.json(
          { success: false, error: "No active merchant found for this store ID." },
          { status: 404 }
        );
      }

      const commissionPercent = business.deliverySettings?.pickmeCommissionPercent || 22;

      // Handle Rider Assignment or Arrival events
      if (event === "rider.assigned" || event === "rider.arrived") {
        const existing = await DeliveryOrder.findOne({
          businessId: business._id,
          externalOrderId: orderData.order_id,
        });

        if (existing) {
          if (orderData.rider) {
            if (orderData.rider.name) existing.rider.name = orderData.rider.name;
            if (orderData.rider.phone) existing.rider.phone = orderData.rider.phone;
            if (orderData.rider.vehicle) existing.rider.vehicleNumber = orderData.rider.vehicle;
            if (orderData.rider.pin) existing.rider.pickupPin = orderData.rider.pin;
          }
          if (event === "rider.arrived") {
            existing.rider.arrivedAtStore = true;
          }
          await existing.save();
          return NextResponse.json({ success: true, updated: true, orderId: existing._id });
        }
      }

      // Handle New Order Creation
      const items = Array.isArray(orderData.items)
        ? orderData.items.map((i: any) => ({
            name: i.name,
            quantity: Number(i.quantity) || 1,
            unitPrice: Number(i.price || i.unitPrice) || 0,
            lineTotal: (Number(i.quantity) || 1) * (Number(i.price || i.unitPrice) || 0),
            unit: i.unit || "unit",
            specialInstructions: i.notes || i.instructions,
          }))
        : [];

      const subtotal = items.reduce((s: number, i: any) => s + i.lineTotal, 0);
      const commissionAmount = Math.round((subtotal * (commissionPercent / 100)) * 100) / 100;
      const estimatedNetPayout = Math.max(0, subtotal - commissionAmount);
      const totalBill = Number(orderData.total || subtotal);

      const pickupPin =
        orderData.rider?.pin ||
        orderData.pickup_pin ||
        Math.floor(1000 + Math.random() * 9000).toString();

      const platform = orderData.type === "FLASH" ? "PICKME_FLASH" : "PICKME_FOOD";
      const prepTime = Number(orderData.prep_time || business.deliverySettings?.defaultPrepTimeMinutes || 15);

      const newOrder = await DeliveryOrder.create({
        businessId: business._id,
        platform,
        externalOrderId: orderData.order_id,
        status: business.deliverySettings?.autoAcceptOrders ? "ACCEPTED" : "PENDING_ACCEPT",
        acceptedAt: business.deliverySettings?.autoAcceptOrders ? new Date() : undefined,
        scheduledPrepEnd: business.deliverySettings?.autoAcceptOrders
          ? new Date(Date.now() + prepTime * 60 * 1000)
          : undefined,
        customer: {
          name: orderData.customer?.name || "PickMe Customer",
          phone: orderData.customer?.phone || "07XXXXXXXX",
          deliveryAddress: orderData.customer?.address || "Colombo Delivery Address",
          deliveryNotes: orderData.customer?.notes,
        },
        items,
        financials: {
          subtotal,
          platformDiscount: Number(orderData.discount || 0),
          merchantDiscount: 0,
          deliveryFee: Number(orderData.delivery_fee || 0),
          platformCommissionPercent: commissionPercent,
          platformCommissionAmount: commissionAmount,
          estimatedNetPayout,
          totalBill,
          payoutStatus: "PENDING",
        },
        rider: {
          name: orderData.rider?.name || "PickMe Delivery Partner",
          phone: orderData.rider?.phone,
          vehicleNumber: orderData.rider?.vehicle || "WP BDF-XXXX",
          vehicleType: (orderData.rider?.vehicle_type as any) || "BIKE",
          pickupPin,
          arrivalEtaMinutes: Number(orderData.rider?.eta || prepTime),
          arrivedAtStore: false,
        },
        prepTimeMinutes: prepTime,
        auditTrail: [
          {
            timestamp: new Date(),
            status: business.deliverySettings?.autoAcceptOrders ? "ACCEPTED" : "PENDING_ACCEPT",
            actor: "PickMe Webhook",
            notes: `Incoming order ingested via PickMe API (${platform})`,
          },
        ],
      });

      return NextResponse.json({
        success: true,
        orderId: newOrder._id,
        externalOrderId: newOrder.externalOrderId,
        status: newOrder.status,
      });
    }

    return NextResponse.json({ success: true, simulated: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "PickMe webhook failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
