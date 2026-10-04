import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { requireAuth } from "@/lib/tenant";
import { DeliveryDriver, generateDriverToken } from "@/models/DeliveryDriver";
import { DeliveryTrip } from "@/models/DeliveryTrip";

export async function GET(req: NextRequest) {
  try {
    const context = await requireAuth();
    await connectToDatabase();

    const url = new URL(req.url);
    const activeOnly = url.searchParams.get("active") === "true";

    const filter: any = { businessId: context.businessId };
    if (activeOnly) {
      filter.active = true;
    }

    const drivers = await DeliveryDriver.find(filter)
      .sort({ active: -1, name: 1 })
      .lean();

    // Attach active trip info if any
    const enrichedDrivers = await Promise.all(
      drivers.map(async (drv) => {
        let activeTrip = null;
        if (drv.currentTripId) {
          activeTrip = await DeliveryTrip.findById(drv.currentTripId)
            .select("tripNumber status totalStops completedStops totalCodExpected totalCodCollected")
            .lean();
        }
        return {
          ...drv,
          activeTrip,
        };
      })
    );

    return NextResponse.json({
      success: true,
      drivers: enrichedDrivers,
    });
  } catch (error: any) {
    console.error("GET /api/delivery/drivers error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load drivers" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const context = await requireAuth();
    await connectToDatabase();

    const body = await req.json();
    const { name, phone, vehicleType, vehicleNumber, nicNumber, notes } = body;

    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: "Driver name is required" }, { status: 400 });
    }
    if (!phone?.trim()) {
      return NextResponse.json({ success: false, error: "Driver phone number is required" }, { status: 400 });
    }
    if (!vehicleNumber?.trim()) {
      return NextResponse.json({ success: false, error: "Vehicle registration number is required" }, { status: 400 });
    }

    const driver = await DeliveryDriver.create({
      businessId: context.businessId,
      name: name.trim(),
      phone: phone.trim(),
      vehicleType: vehicleType || "THREE_WHEELER",
      vehicleNumber: vehicleNumber.trim().toUpperCase(),
      nicNumber: nicNumber?.trim() || undefined,
      active: true,
      driverToken: generateDriverToken(),
      notes: notes?.trim() || undefined,
    });

    return NextResponse.json({
      success: true,
      message: `Driver ${driver.name} registered successfully.`,
      driver,
    });
  } catch (error: any) {
    console.error("POST /api/delivery/drivers error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create driver" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const context = await requireAuth();
    await connectToDatabase();

    const body = await req.json();
    const { driverId, name, phone, vehicleType, vehicleNumber, nicNumber, active, notes, regenerateToken } = body;

    if (!driverId) {
      return NextResponse.json({ success: false, error: "driverId is required" }, { status: 400 });
    }

    const driver = await DeliveryDriver.findOne({ _id: driverId, businessId: context.businessId });
    if (!driver) {
      return NextResponse.json({ success: false, error: "Driver not found" }, { status: 404 });
    }

    if (name !== undefined) driver.name = name.trim();
    if (phone !== undefined) driver.phone = phone.trim();
    if (vehicleType !== undefined) driver.vehicleType = vehicleType;
    if (vehicleNumber !== undefined) driver.vehicleNumber = vehicleNumber.trim().toUpperCase();
    if (nicNumber !== undefined) driver.nicNumber = nicNumber.trim();
    if (active !== undefined) driver.active = Boolean(active);
    if (notes !== undefined) driver.notes = notes.trim();
    if (regenerateToken) {
      driver.driverToken = generateDriverToken();
    }

    await driver.save();

    return NextResponse.json({
      success: true,
      message: `Driver ${driver.name} updated successfully.`,
      driver,
    });
  } catch (error: any) {
    console.error("PUT /api/delivery/drivers error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update driver" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const context = await requireAuth();
    await connectToDatabase();

    const url = new URL(req.url);
    const driverId = url.searchParams.get("id");

    if (!driverId) {
      return NextResponse.json({ success: false, error: "Driver ID is required" }, { status: 400 });
    }

    const driver = await DeliveryDriver.findOne({ _id: driverId, businessId: context.businessId });
    if (!driver) {
      return NextResponse.json({ success: false, error: "Driver not found" }, { status: 404 });
    }

    // Soft delete by deactivating
    driver.active = false;
    await driver.save();

    return NextResponse.json({
      success: true,
      message: `Driver ${driver.name} deactivated.`,
    });
  } catch (error: any) {
    console.error("DELETE /api/delivery/drivers error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to deactivate driver" },
      { status: 500 }
    );
  }
}
