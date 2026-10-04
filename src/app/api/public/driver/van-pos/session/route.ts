import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { DeliveryDriver } from "@/models/DeliveryDriver";
import { VanSaleSession } from "@/models/VanSaleSession";
import { Business } from "@/models/Business";
import { Customer } from "@/models/Customer";

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Driver token is required." },
        { status: 400 }
      );
    }

    const driver = await DeliveryDriver.findOne({ driverToken: token });
    if (!driver || !driver.active) {
      return NextResponse.json(
        { success: false, error: "Invalid or inactive driver token." },
        { status: 401 }
      );
    }

    const session = await VanSaleSession.findOne({
      driverId: driver._id,
      status: { $in: ["LOADED", "ON_ROUTE"] },
    }).lean();

    const business = await Business.findById(driver.businessId)
      .select("name phone address logoUrl currency")
      .lean();

    // Fetch customers for credit sale search
    const customers = await Customer.find({
      businessId: driver.businessId,
    })
      .select("name phone companyName customerType creditLimit balance")
      .sort({ name: 1 })
      .limit(100)
      .lean();

    return NextResponse.json({
      success: true,
      driver: {
        _id: driver._id,
        name: driver.name,
        phone: driver.phone,
        vehicleType: driver.vehicleType,
        vehicleNumber: driver.vehicleNumber,
      },
      business: {
        name: business?.name || "Corner Store POS",
        phone: business?.phone || "",
        address: business?.address || "",
        currency: (business as any)?.currency || "LKR",
      },
      session: session || null,
      customers,
    });
  } catch (error: any) {
    console.error("GET /api/public/driver/van-pos/session error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load van session" },
      { status: 500 }
    );
  }
}
