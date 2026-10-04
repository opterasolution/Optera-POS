import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { requireAuth } from "@/lib/tenant";
import { DeliveryTrip } from "@/models/DeliveryTrip";
import { DeliveryDriver } from "@/models/DeliveryDriver";
import { DeliveryOrder } from "@/models/DeliveryOrder";

export async function GET(req: NextRequest) {
  try {
    const context = await requireAuth();
    await connectToDatabase();

    const url = new URL(req.url);
    const tripId = url.searchParams.get("id");
    const status = url.searchParams.get("status");
    const driverId = url.searchParams.get("driverId");

    if (tripId) {
      const trip = await DeliveryTrip.findOne({ _id: tripId, businessId: context.businessId })
        .populate("driverId")
        .lean();
      if (!trip) {
        return NextResponse.json({ success: false, error: "Trip not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, trip });
    }

    const filter: any = { businessId: context.businessId };
    if (status && status !== "ALL") {
      filter.status = status;
    }
    if (driverId) {
      filter.driverId = driverId;
    }

    const trips = await DeliveryTrip.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return NextResponse.json({
      success: true,
      trips,
    });
  } catch (error: any) {
    console.error("GET /api/delivery/trips error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load trips" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const context = await requireAuth();
    await connectToDatabase();

    const body = await req.json();
    const { driverId, orderIds, notes, dispatchImmediately } = body;

    if (!driverId) {
      return NextResponse.json({ success: false, error: "Please select a driver for this trip." }, { status: 400 });
    }
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ success: false, error: "At least one order must be selected for the trip." }, { status: 400 });
    }

    const driver = await DeliveryDriver.findOne({ _id: driverId, businessId: context.businessId });
    if (!driver) {
      return NextResponse.json({ success: false, error: "Selected driver does not exist." }, { status: 404 });
    }

    // Fetch the orders
    const orders = await DeliveryOrder.find({
      _id: { $in: orderIds },
      businessId: context.businessId,
    });

    if (orders.length === 0) {
      return NextResponse.json({ success: false, error: "No valid orders found." }, { status: 400 });
    }

    // Generate Trip Number: TRIP-YYYYMMDD-XXXX
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
    const countToday = await DeliveryTrip.countDocuments({
      businessId: context.businessId,
      createdAt: {
        $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
      },
    });
    const tripNumber = `TRIP-${dateStr}-${String(countToday + 1).padStart(4, "0")}`;

    let totalCodExpected = 0;
    const stops = orders.map((ord, idx) => {
      // Check if COD
      const isCod = ord.cashOnDelivery?.isCod ?? (ord.financials.payoutStatus !== "SETTLED");
      const codAmount = isCod
        ? (ord.cashOnDelivery?.expectedAmount || ord.financials.totalBill || 0)
        : 0;
      if (isCod) {
        totalCodExpected += codAmount;
      }

      return {
        orderId: ord._id,
        orderNumber: ord.externalOrderId,
        customerName: ord.customer.name,
        customerPhone: ord.customer.phone,
        deliveryAddress: ord.customer.deliveryAddress,
        deliveryNotes: ord.customer.deliveryNotes,
        stopSequence: idx + 1,
        isCod,
        codAmount,
        status: "PENDING" as const,
      };
    });

    const isDispatched = Boolean(dispatchImmediately);

    const trip = await DeliveryTrip.create({
      businessId: context.businessId,
      tripNumber,
      driverId: driver._id,
      driverName: driver.name,
      driverPhone: driver.phone,
      vehicleType: driver.vehicleType,
      vehicleNumber: driver.vehicleNumber,
      status: isDispatched ? "DISPATCHED" : "DRAFT",
      stops,
      totalStops: stops.length,
      completedStops: 0,
      failedStops: 0,
      totalCodExpected,
      totalCodCollected: 0,
      cashierReconciliation: {
        status: "PENDING",
      },
      dispatchedAt: isDispatched ? new Date() : undefined,
      notes: notes?.trim() || undefined,
    });

    if (isDispatched) {
      driver.currentTripId = trip._id;
      await driver.save();

      // Update orders to OUT_FOR_DELIVERY and attach rider & trip details
      for (const ord of orders) {
        ord.status = "OUT_FOR_DELIVERY";
        ord.tripId = trip._id;
        ord.dispatchedAt = new Date();
        ord.rider = {
          name: driver.name,
          phone: driver.phone,
          vehicleType: driver.vehicleType,
          vehicleNumber: driver.vehicleNumber,
          pickupPin: ord.rider?.pickupPin || Math.floor(1000 + Math.random() * 9000).toString(),
        };
        ord.auditTrail.push({
          timestamp: new Date(),
          status: "OUT_FOR_DELIVERY",
          actor: context.username || "Dispatcher",
          notes: `Assigned to trip ${tripNumber} with driver ${driver.name}`,
        });
        await ord.save();
      }
    } else {
      // Just stamp tripId
      for (const ord of orders) {
        ord.tripId = trip._id;
        await ord.save();
      }
    }

    return NextResponse.json({
      success: true,
      message: `Delivery Trip ${trip.tripNumber} created successfully.`,
      trip,
    });
  } catch (error: any) {
    console.error("POST /api/delivery/trips error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create trip" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const context = await requireAuth();
    await connectToDatabase();

    const body = await req.json();
    const { tripId, action, cashDrawerAmountSubmitted, registerId, cashierNotes } = body;

    if (!tripId) {
      return NextResponse.json({ success: false, error: "tripId is required" }, { status: 400 });
    }

    const trip = await DeliveryTrip.findOne({ _id: tripId, businessId: context.businessId });
    if (!trip) {
      return NextResponse.json({ success: false, error: "Trip not found" }, { status: 404 });
    }

    const driver = await DeliveryDriver.findById(trip.driverId);

    if (action === "DISPATCH") {
      trip.status = "DISPATCHED";
      trip.dispatchedAt = new Date();
      await trip.save();

      if (driver) {
        driver.currentTripId = trip._id;
        await driver.save();
      }

      // Update all stops to OUT_FOR_DELIVERY
      for (const stop of trip.stops) {
        await DeliveryOrder.findByIdAndUpdate(stop.orderId, {
          status: "OUT_FOR_DELIVERY",
          dispatchedAt: new Date(),
          "rider.name": trip.driverName,
          "rider.phone": trip.driverPhone,
          "rider.vehicleType": trip.vehicleType,
          "rider.vehicleNumber": trip.vehicleNumber,
          $push: {
            auditTrail: {
              timestamp: new Date(),
              status: "OUT_FOR_DELIVERY",
              actor: context.username || "Dispatcher",
              notes: `Dispatched on Trip ${trip.tripNumber}`,
            },
          },
        });
      }

      return NextResponse.json({
        success: true,
        message: `Trip ${trip.tripNumber} dispatched! Driver and orders updated.`,
        trip,
      });
    }

    if (action === "RECONCILE") {
      const submittedCash = parseFloat(cashDrawerAmountSubmitted) || 0;
      const expectedCash = trip.totalCodCollected;
      const variance = submittedCash - expectedCash;

      trip.cashierReconciliation = {
        status: variance === 0 ? "RECONCILED" : "DISCREPANCY",
        reconciledAt: new Date(),
        reconciledBy: context.username || "Cashier",
        registerId: registerId || undefined,
        cashDrawerAmountSubmitted: submittedCash,
        shortageOrOverage: variance,
        cashierNotes: cashierNotes?.trim() || undefined,
      };

      trip.status = "COMPLETED";
      trip.completedAt = trip.completedAt || new Date();
      await trip.save();

      if (driver) {
        if (driver.currentTripId?.toString() === trip._id.toString()) {
          driver.currentTripId = undefined as any;
        }
        driver.totalDeliveriesCompleted = (driver.totalDeliveriesCompleted || 0) + trip.completedStops;
        driver.totalCodCollected = (driver.totalCodCollected || 0) + trip.totalCodCollected;
        await driver.save();
      }

      return NextResponse.json({
        success: true,
        message: `Trip ${trip.tripNumber} cash reconciled successfully! Status: ${trip.cashierReconciliation.status}`,
        trip,
      });
    }

    if (action === "CANCEL") {
      trip.status = "CANCELLED";
      await trip.save();

      if (driver && driver.currentTripId?.toString() === trip._id.toString()) {
        driver.currentTripId = undefined as any;
        await driver.save();
      }

      // Reset orders to READY_FOR_PICKUP if they were not delivered
      for (const stop of trip.stops) {
        if (stop.status !== "DELIVERED") {
          await DeliveryOrder.findByIdAndUpdate(stop.orderId, {
            status: "READY_FOR_PICKUP",
            tripId: undefined,
          });
        }
      }

      return NextResponse.json({
        success: true,
        message: `Trip ${trip.tripNumber} cancelled.`,
        trip,
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action specified." }, { status: 400 });
  } catch (error: any) {
    console.error("PUT /api/delivery/trips error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update trip" },
      { status: 500 }
    );
  }
}
