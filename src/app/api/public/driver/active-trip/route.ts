import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { DeliveryDriver } from "@/models/DeliveryDriver";
import { DeliveryTrip } from "@/models/DeliveryTrip";
import { DeliveryOrder } from "@/models/DeliveryOrder";
import { Business } from "@/models/Business";

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();

    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return NextResponse.json({ success: false, error: "Driver token is required." }, { status: 401 });
    }

    const driver = await DeliveryDriver.findOne({ driverToken: token, active: true }).lean();
    if (!driver) {
      return NextResponse.json({ success: false, error: "Invalid or inactive driver token." }, { status: 404 });
    }

    const business = await Business.findById(driver.businessId)
      .select("name phone address settings")
      .lean();

    // Find active trip: either via currentTripId or latest DISPATCHED trip
    let activeTrip: any = null;
    if (driver.currentTripId) {
      activeTrip = await DeliveryTrip.findById(driver.currentTripId).lean();
    }

    if (!activeTrip) {
      activeTrip = await DeliveryTrip.findOne({
        businessId: driver.businessId,
        driverId: driver._id,
        status: { $in: ["DISPATCHED", "DRAFT"] },
      })
        .sort({ createdAt: -1 })
        .lean();
    }

    // If an active trip exists, fetch full order items for each stop
    let stopsWithOrderDetails = [];
    if (activeTrip && activeTrip.stops?.length > 0) {
      const orderIds = activeTrip.stops.map((s: any) => s.orderId);
      const orders = await DeliveryOrder.find({ _id: { $in: orderIds } }).lean();
      const orderMap = new Map(orders.map((o: any) => [o._id.toString(), o]));

      stopsWithOrderDetails = activeTrip.stops.map((stop: any) => {
        const fullOrder: any = orderMap.get(stop.orderId.toString());
        return {
          ...stop,
          items: fullOrder?.items || [],
          financials: fullOrder?.financials || null,
          prepTimeMinutes: fullOrder?.prepTimeMinutes || 15,
          createdAt: fullOrder?.createdAt,
          proofOfDelivery: fullOrder?.proofOfDelivery,
          cashOnDelivery: fullOrder?.cashOnDelivery,
        };
      });
    }

    return NextResponse.json({
      success: true,
      driver: {
        _id: driver._id,
        name: driver.name,
        phone: driver.phone,
        vehicleType: driver.vehicleType,
        vehicleNumber: driver.vehicleNumber,
        totalDeliveriesCompleted: driver.totalDeliveriesCompleted || 0,
        totalCodCollected: driver.totalCodCollected || 0,
      },
      business: {
        name: business?.name || "Store Express Delivery",
        phone: business?.phone || "",
        address: business?.address || "",
      },
      trip: activeTrip
        ? {
            ...activeTrip,
            stops: stopsWithOrderDetails,
          }
        : null,
    });
  } catch (error: any) {
    console.error("GET /api/public/driver/active-trip error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load driver active trip" },
      { status: 500 }
    );
  }
}
