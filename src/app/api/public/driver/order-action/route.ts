import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { DeliveryDriver } from "@/models/DeliveryDriver";
import { DeliveryTrip } from "@/models/DeliveryTrip";
import { DeliveryOrder } from "@/models/DeliveryOrder";

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    const body = await req.json();
    const {
      token,
      action,
      tripId,
      orderId,
      signatureUrl,
      photoUrl,
      receivedBy,
      notes,
      collectedCod,
      changeGiven,
      coordinates,
      failureReason,
    } = body;

    if (!token) {
      return NextResponse.json({ success: false, error: "Driver token is required." }, { status: 401 });
    }
    if (!tripId || !orderId) {
      return NextResponse.json({ success: false, error: "tripId and orderId are required." }, { status: 400 });
    }

    const driver = await DeliveryDriver.findOne({ driverToken: token, active: true });
    if (!driver) {
      return NextResponse.json({ success: false, error: "Invalid driver token." }, { status: 404 });
    }

    const trip = await DeliveryTrip.findOne({ _id: tripId, driverId: driver._id });
    if (!trip) {
      return NextResponse.json({ success: false, error: "Trip not found for this driver." }, { status: 404 });
    }

    const order = await DeliveryOrder.findById(orderId);
    if (!order) {
      return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 });
    }

    const stop = trip.stops.find((s) => s.orderId.toString() === orderId.toString());
    if (!stop) {
      return NextResponse.json({ success: false, error: "Order is not part of this trip." }, { status: 400 });
    }

    if (action === "CONFIRM_DELIVERY") {
      const parsedCollected = typeof collectedCod === "number" ? collectedCod : parseFloat(collectedCod) || 0;
      const parsedChange = typeof changeGiven === "number" ? changeGiven : parseFloat(changeGiven) || 0;

      // Update DeliveryOrder
      order.status = "DELIVERED";
      order.deliveredAt = new Date();
      order.proofOfDelivery = {
        signatureUrl,
        photoUrl,
        receivedBy: receivedBy?.trim() || "Customer",
        notes: notes?.trim() || undefined,
        deliveredAt: new Date(),
        coordinates,
      };

      if (stop.isCod) {
        order.cashOnDelivery = {
          isCod: true,
          expectedAmount: stop.codAmount,
          collectedAmount: parsedCollected,
          changeGiven: parsedChange,
          paymentMethod: "CASH",
          notes: notes?.trim(),
        };
      }

      order.auditTrail.push({
        timestamp: new Date(),
        status: "DELIVERED",
        actor: `Driver: ${driver.name}`,
        notes: `Delivered at doorstep. POD Received by: ${receivedBy || "Customer"}. ${stop.isCod ? `Collected COD Rs. ${parsedCollected.toLocaleString()}` : ""}`,
      });

      await order.save();

      // Update Trip Stop
      stop.status = "DELIVERED";
      stop.deliveredAt = new Date();
      stop.collectedCod = parsedCollected;
      stop.changeGiven = parsedChange;
      stop.signatureUrl = signatureUrl;
      stop.photoUrl = photoUrl;
      stop.receivedBy = receivedBy?.trim() || "Customer";

      // Recalculate Trip Stats
      trip.completedStops = trip.stops.filter((s) => s.status === "DELIVERED").length;
      trip.failedStops = trip.stops.filter((s) => s.status === "FAILED").length;
      trip.totalCodCollected = trip.stops
        .filter((s) => s.status === "DELIVERED")
        .reduce((sum, s) => sum + (s.collectedCod || 0), 0);

      // If all stops are resolved
      if (trip.completedStops + trip.failedStops >= trip.totalStops) {
        trip.completedAt = new Date();
      }

      await trip.save();

      return NextResponse.json({
        success: true,
        message: `Delivery completed for Order #${order.externalOrderId}. POD recorded.`,
        trip,
      });
    }

    if (action === "FAIL_DELIVERY") {
      if (!failureReason) {
        return NextResponse.json({ success: false, error: "Please provide a reason for delivery failure." }, { status: 400 });
      }

      // Update DeliveryOrder
      order.deliveryFailure = {
        reason: failureReason,
        notes: notes?.trim() || undefined,
        failedAt: new Date(),
      };

      order.auditTrail.push({
        timestamp: new Date(),
        status: order.status,
        actor: `Driver: ${driver.name}`,
        notes: `Delivery attempt failed: ${failureReason}. Notes: ${notes || "None"}`,
      });

      await order.save();

      // Update Trip Stop
      stop.status = "FAILED";
      stop.failureReason = failureReason;

      trip.completedStops = trip.stops.filter((s) => s.status === "DELIVERED").length;
      trip.failedStops = trip.stops.filter((s) => s.status === "FAILED").length;

      if (trip.completedStops + trip.failedStops >= trip.totalStops) {
        trip.completedAt = new Date();
      }

      await trip.save();

      return NextResponse.json({
        success: true,
        message: `Order #${order.externalOrderId} marked as delivery failed.`,
        trip,
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/public/driver/order-action error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process driver action" },
      { status: 500 }
    );
  }
}
