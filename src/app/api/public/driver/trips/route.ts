import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { DeliveryDriver } from "@/models/DeliveryDriver";
import { DeliveryTrip } from "@/models/DeliveryTrip";

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
      return NextResponse.json({ success: false, error: "Invalid driver token." }, { status: 404 });
    }

    const trips = await DeliveryTrip.find({
      businessId: driver.businessId,
      driverId: driver._id,
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

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
      trips,
    });
  } catch (error: any) {
    console.error("GET /api/public/driver/trips error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load driver trip history" },
      { status: 500 }
    );
  }
}
