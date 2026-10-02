import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { DeliveryOrder } from "@/models/DeliveryOrder";
import { Business } from "@/models/Business";

/**
 * Webhook handler for Uber Eats Sri Lanka incoming order events
 */
export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const event = payload.event_type || payload.event || "orders.notification";
    const storeId = payload.store_id || payload.storeId;
    const orderData = payload.order || payload;

    if (!orderData || !orderData.id) {
      return NextResponse.json(
        { success: false, error: "Invalid webhook payload: missing order id." },
        { status: 400 }
      );
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      let business = storeId
        ? await Business.findOne({ "deliverySettings.uberEatsStoreId": storeId, isActive: true })
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

      const commissionPercent = business.deliverySettings?.uberEatsCommissionPercent || 25;
      const externalOrderId = orderData.display_id || `UE-${orderData.id.slice(-5)}`;

      // Check if order already exists
      const existing = await DeliveryOrder.findOne({
        businessId: business._id,
        externalOrderId,
      });

      if (existing) {
        if (event === "courier.arrived") {
          existing.rider.arrivedAtStore = true;
          await existing.save();
        }
        return NextResponse.json({ success: true, updated: true, orderId: existing._id });
      }

      // Items
      const items = Array.isArray(orderData.cart?.items || orderData.items)
        ? (orderData.cart?.items || orderData.items).map((i: any) => ({
            name: i.title || i.name,
            quantity: Number(i.quantity) || 1,
            unitPrice: Number(i.price?.amount || i.unitPrice) || 0,
            lineTotal: (Number(i.quantity) || 1) * (Number(i.price?.amount || i.unitPrice) || 0),
            unit: "unit",
            specialInstructions: i.special_instructions || i.notes,
          }))
        : [];

      const subtotal = items.reduce((s: number, i: any) => s + i.lineTotal, 0);
      const commissionAmount = Math.round((subtotal * (commissionPercent / 100)) * 100) / 100;
      const estimatedNetPayout = Math.max(0, subtotal - commissionAmount);
      const totalBill = Number(orderData.payment?.total?.amount || subtotal);

      const pickupPin =
        orderData.courier?.pin ||
        orderData.pickup_pin ||
        Math.floor(1000 + Math.random() * 9000).toString();

      const prepTime = Number(orderData.prep_time_minutes || business.deliverySettings?.defaultPrepTimeMinutes || 15);

      const newOrder = await DeliveryOrder.create({
        businessId: business._id,
        platform: "UBER_EATS",
        externalOrderId,
        status: business.deliverySettings?.autoAcceptOrders ? "ACCEPTED" : "PENDING_ACCEPT",
        acceptedAt: business.deliverySettings?.autoAcceptOrders ? new Date() : undefined,
        scheduledPrepEnd: business.deliverySettings?.autoAcceptOrders
          ? new Date(Date.now() + prepTime * 60 * 1000)
          : undefined,
        customer: {
          name: orderData.eater?.first_name ? `${orderData.eater.first_name} ${orderData.eater.last_name || ""}`.trim() : "Uber Eats Customer",
          phone: orderData.eater?.phone || "07XXXXXXXX",
          deliveryAddress: orderData.delivery_address?.formatted_address || "Colombo Delivery Address",
          deliveryNotes: orderData.delivery_address?.notes,
        },
        items,
        financials: {
          subtotal,
          platformDiscount: 0,
          merchantDiscount: 0,
          deliveryFee: Number(orderData.payment?.delivery_fee?.amount || 0),
          platformCommissionPercent: commissionPercent,
          platformCommissionAmount: commissionAmount,
          estimatedNetPayout,
          totalBill,
          payoutStatus: "PENDING",
        },
        rider: {
          name: orderData.courier?.name || "Uber Courier",
          phone: orderData.courier?.phone,
          vehicleNumber: orderData.courier?.vehicle_number || "WP QD-XXXX",
          vehicleType: "BIKE",
          pickupPin,
          arrivalEtaMinutes: Number(orderData.courier?.eta_minutes || prepTime),
          arrivedAtStore: false,
        },
        prepTimeMinutes: prepTime,
        auditTrail: [
          {
            timestamp: new Date(),
            status: business.deliverySettings?.autoAcceptOrders ? "ACCEPTED" : "PENDING_ACCEPT",
            actor: "Uber Eats Webhook",
            notes: "Incoming order ingested via Uber Eats Sri Lanka API",
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
    const message = error instanceof Error ? error.message : "Uber Eats webhook failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
