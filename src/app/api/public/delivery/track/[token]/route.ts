import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { DeliveryOrder, generateTrackingToken } from "@/models/DeliveryOrder";
import { DeliveryTrip } from "@/models/DeliveryTrip";
import { Business } from "@/models/Business";
import mongoose from "mongoose";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    await connectToDatabase();
    const { token } = await params;

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Tracking token is required." },
        { status: 400 }
      );
    }

    // Lookup order by trackingToken or fallback to valid MongoDB ObjectId
    let order = await DeliveryOrder.findOne({ trackingToken: token });

    if (!order && mongoose.isValidObjectId(token)) {
      order = await DeliveryOrder.findById(token);
    }

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Delivery order not found." },
        { status: 404 }
      );
    }

    // Ensure trackingToken exists on order
    if (!order.trackingToken) {
      order.trackingToken = generateTrackingToken();
      await order.save();
    }

    // Fetch store business branding
    const business = await Business.findById(order.businessId)
      .select("name phone address logoUrl currency")
      .lean();

    // Fetch Trip details if order is part of a runsheet
    let tripData = null;
    if (order.tripId) {
      const trip = await DeliveryTrip.findById(order.tripId).lean();
      if (trip) {
        const orderIdStr = order._id.toString();
        const currentStopIdx = trip.stops.findIndex(
          (s) => s.orderId.toString() === orderIdStr
        );
        const currentStop = currentStopIdx >= 0 ? trip.stops[currentStopIdx] : null;

        // Count how many stops before this one are still pending
        let precedingPendingStops = 0;
        if (currentStop) {
          precedingPendingStops = trip.stops.filter(
            (s) => s.stopSequence < currentStop.stopSequence && s.status === "PENDING"
          ).length;
        }

        tripData = {
          tripNumber: trip.tripNumber,
          totalStops: trip.totalStops,
          completedStops: trip.completedStops,
          stopSequence: currentStop ? currentStop.stopSequence : (order.stopSequence || 1),
          precedingPendingStops,
        };
      }
    }

    // Calculate dynamic ETA window
    let etaMinutes = order.estimatedDeliveryMinutes || 25;
    if (tripData?.precedingPendingStops) {
      etaMinutes += tripData.precedingPendingStops * 10;
    }

    const payload = {
      _id: order._id,
      trackingToken: order.trackingToken,
      externalOrderId: order.externalOrderId,
      platform: order.platform,
      status: order.status,
      createdAt: order.createdAt,
      acceptedAt: order.acceptedAt,
      readyAt: order.readyAt,
      dispatchedAt: order.dispatchedAt,
      deliveredAt: order.deliveredAt,
      etaMinutes,
      customer: {
        name: order.customer.name,
        phone: order.customer.phone,
        deliveryAddress: order.customer.deliveryAddress,
        deliveryNotes: order.customer.deliveryNotes,
        deliveryCoordinates: order.customer.deliveryCoordinates,
      },
      items: order.items.map((it) => ({
        name: it.name,
        nameSinhala: it.nameSinhala,
        nameTamil: it.nameTamil,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        lineTotal: it.lineTotal,
        unit: it.unit,
        specialInstructions: it.specialInstructions,
      })),
      financials: {
        subtotal: order.financials.subtotal,
        deliveryFee: order.financials.deliveryFee || 0,
        merchantDiscount: order.financials.merchantDiscount || 0,
        totalBill: order.financials.totalBill,
        payoutStatus: order.financials.payoutStatus,
      },
      cashOnDelivery: order.cashOnDelivery
        ? {
            isCod: order.cashOnDelivery.isCod,
            expectedAmount: order.cashOnDelivery.expectedAmount,
            collectedAmount: order.cashOnDelivery.collectedAmount,
            changeGiven: order.cashOnDelivery.changeGiven,
            paymentMethod: order.cashOnDelivery.paymentMethod,
          }
        : null,
      rider: {
        name: order.rider?.name,
        phone: order.rider?.phone,
        vehicleType: order.rider?.vehicleType || "BIKE",
        vehicleNumber: order.rider?.vehicleNumber,
        arrivedAtStore: order.rider?.arrivedAtStore,
      },
      trip: tripData,
      proofOfDelivery: order.proofOfDelivery
        ? {
            signatureUrl: order.proofOfDelivery.signatureUrl,
            photoUrl: order.proofOfDelivery.photoUrl,
            receivedBy: order.proofOfDelivery.receivedBy,
            notes: order.proofOfDelivery.notes,
            deliveredAt: order.proofOfDelivery.deliveredAt,
          }
        : null,
      deliveryFailure: order.deliveryFailure
        ? {
            reason: order.deliveryFailure.reason,
            notes: order.deliveryFailure.notes,
            failedAt: order.deliveryFailure.failedAt,
          }
        : null,
    };

    return NextResponse.json({
      success: true,
      order: payload,
      business: {
        name: business?.name || "Corner Store POS",
        phone: business?.phone || "",
        address: business?.address || "",
        logoUrl: (business as any)?.logoUrl || "",
      },
    });
  } catch (error: any) {
    console.error("GET /api/public/delivery/track/[token] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load tracking details." },
      { status: 500 }
    );
  }
}
