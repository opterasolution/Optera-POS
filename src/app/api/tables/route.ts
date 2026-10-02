import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/db";
import RestaurantTable from "@/models/RestaurantTable";
import Business from "@/models/Business";

// GET /api/tables - List tables with occupancy, totals, and auto-seeder
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const user = session.user as any;
    let businessId = user.businessId;

    if (!businessId) {
      const defaultBiz = await Business.findOne().lean();
      businessId = defaultBiz?._id;
    }

    if (!businessId) {
      return NextResponse.json({ error: "No business found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const section = searchParams.get("section");
    const status = searchParams.get("status");

    const query: any = { businessId, isActive: true };
    if (section && section !== "ALL") query.section = section;
    if (status && status !== "ALL") query.status = status;

    let tables = await RestaurantTable.find(query).sort({ tableNumber: 1 }).lean();

    // Auto-seed default restaurant tables if database is empty
    if (tables.length === 0 && (!section || section === "ALL")) {
      const count = await RestaurantTable.countDocuments({ businessId });
      if (count === 0) {
        const demoTables = [
          // Main Dining Hall
          {
            businessId,
            tableNumber: "T-01",
            tableName: "Window Booth 1",
            section: "Main Dining Hall",
            capacity: 4,
            status: "AVAILABLE",
            shape: "SQUARE",
            position: { x: 50, y: 50 },
          },
          {
            businessId,
            tableNumber: "T-02",
            tableName: "Center Table 2",
            section: "Main Dining Hall",
            capacity: 4,
            status: "OCCUPIED",
            shape: "ROUND",
            position: { x: 220, y: 50 },
            currentOrder: {
              orderNumber: "TBL-8041",
              customerCount: 3,
              customerName: "Dr. Wickramasinghe",
              serverName: "Kamal S.",
              openedAt: new Date(Date.now() - 35 * 60 * 1000),
              subtotal: 4850,
              serviceChargeRate: 10,
              serviceChargeAmount: 485,
              taxRate: 0,
              taxAmount: 0,
              grandTotal: 5335,
              items: [
                {
                  name: "Chicken Cheese Kottu Roti",
                  quantity: 2,
                  unitPrice: 1450,
                  lineTotal: 2900,
                  course: "MAIN",
                  seatNumber: 1,
                  notes: "Medium spicy",
                  station: "GRILL_HOPPERS",
                  sentToKds: true,
                },
                {
                  name: "Hot Butter Cuttlefish (HBC)",
                  quantity: 1,
                  unitPrice: 1350,
                  lineTotal: 1350,
                  course: "STARTER",
                  seatNumber: 2,
                  notes: "Extra crispy with spring onions",
                  station: "HOT_KITCHEN",
                  sentToKds: true,
                },
                {
                  name: "Fresh Lime Soda (Sweet)",
                  quantity: 2,
                  unitPrice: 300,
                  lineTotal: 600,
                  course: "BEVERAGE",
                  seatNumber: 3,
                  station: "BEVERAGE_BAR",
                  sentToKds: true,
                },
              ],
            },
          },
          {
            businessId,
            tableNumber: "T-03",
            tableName: "Center Table 3",
            section: "Main Dining Hall",
            capacity: 6,
            status: "BILL_REQUESTED",
            shape: "RECTANGLE",
            position: { x: 390, y: 50 },
            currentOrder: {
              orderNumber: "TBL-8038",
              customerCount: 4,
              customerName: "Walk-in Guests",
              serverName: "Sunil W.",
              openedAt: new Date(Date.now() - 55 * 60 * 1000),
              subtotal: 6200,
              serviceChargeRate: 10,
              serviceChargeAmount: 620,
              taxRate: 0,
              taxAmount: 0,
              grandTotal: 6820,
              items: [
                {
                  name: "Mutton Biryani Special (Basmati)",
                  quantity: 2,
                  unitPrice: 2200,
                  lineTotal: 4400,
                  course: "MAIN",
                  seatNumber: 1,
                  station: "HOT_KITCHEN",
                  sentToKds: true,
                },
                {
                  name: "Faluda with Ice Cream",
                  quantity: 3,
                  unitPrice: 600,
                  lineTotal: 1800,
                  course: "DESSERT",
                  seatNumber: 2,
                  station: "BEVERAGE_BAR",
                  sentToKds: true,
                },
              ],
            },
          },
          {
            businessId,
            tableNumber: "T-04",
            tableName: "Wall Booth 4",
            section: "Main Dining Hall",
            capacity: 2,
            status: "AVAILABLE",
            shape: "SQUARE",
            position: { x: 50, y: 220 },
          },
          {
            businessId,
            tableNumber: "T-05",
            tableName: "Family Table 5",
            section: "Main Dining Hall",
            capacity: 8,
            status: "CLEANING",
            shape: "RECTANGLE",
            position: { x: 220, y: 220 },
          },
          {
            businessId,
            tableNumber: "T-06",
            tableName: "Corner Table 6",
            section: "Main Dining Hall",
            capacity: 4,
            status: "AVAILABLE",
            shape: "SQUARE",
            position: { x: 420, y: 220 },
          },
          // Outdoor Patio
          {
            businessId,
            tableNumber: "P-01",
            tableName: "Garden Breeze 1",
            section: "Outdoor Patio",
            capacity: 4,
            status: "AVAILABLE",
            shape: "ROUND",
            position: { x: 50, y: 50 },
          },
          {
            businessId,
            tableNumber: "P-02",
            tableName: "Garden Breeze 2",
            section: "Outdoor Patio",
            capacity: 4,
            status: "OCCUPIED",
            shape: "ROUND",
            position: { x: 220, y: 50 },
            currentOrder: {
              orderNumber: "TBL-8042",
              customerCount: 2,
              customerName: "Mrs. Fernando",
              serverName: "Nimal K.",
              openedAt: new Date(Date.now() - 20 * 60 * 1000),
              subtotal: 2800,
              serviceChargeRate: 10,
              serviceChargeAmount: 280,
              taxRate: 0,
              taxAmount: 0,
              grandTotal: 3080,
              items: [
                {
                  name: "Egg Hopper Feast (4 pcs)",
                  quantity: 1,
                  unitPrice: 1200,
                  lineTotal: 1200,
                  course: "MAIN",
                  seatNumber: 1,
                  notes: "Lunu miris on side",
                  station: "GRILL_HOPPERS",
                  sentToKds: true,
                },
                {
                  name: "Iced Ceylon Spiced Tea",
                  quantity: 2,
                  unitPrice: 400,
                  lineTotal: 800,
                  course: "BEVERAGE",
                  seatNumber: 2,
                  station: "BEVERAGE_BAR",
                  sentToKds: true,
                },
                {
                  name: "Watalappam Cup",
                  quantity: 2,
                  unitPrice: 400,
                  lineTotal: 800,
                  course: "DESSERT",
                  seatNumber: 1,
                  station: "BAKERY_SHORT_EATS",
                  sentToKds: true,
                },
              ],
            },
          },
          {
            businessId,
            tableNumber: "P-03",
            tableName: "Under the Mango Tree",
            section: "Outdoor Patio",
            capacity: 6,
            status: "RESERVED",
            shape: "RECTANGLE",
            position: { x: 390, y: 50 },
            reservation: {
              customerName: "Anura Bandara",
              phone: "0771234567",
              reservedTime: new Date(Date.now() + 45 * 60 * 1000),
              guestCount: 6,
              notes: "Birthday celebration dinner",
            },
          },
          // VIP Lounge
          {
            businessId,
            tableNumber: "VIP-1",
            tableName: "Royal Suite",
            section: "VIP Lounge",
            capacity: 10,
            status: "AVAILABLE",
            shape: "RECTANGLE",
            position: { x: 60, y: 60 },
          },
          {
            businessId,
            tableNumber: "VIP-2",
            tableName: "Executive Lounge",
            section: "VIP Lounge",
            capacity: 6,
            status: "AVAILABLE",
            shape: "ROUND",
            position: { x: 260, y: 60 },
          },
        ];

        await RestaurantTable.insertMany(demoTables);
        tables = await RestaurantTable.find(query).sort({ tableNumber: 1 }).lean();
      }
    }

    return NextResponse.json({ success: true, tables });
  } catch (error: any) {
    console.error("GET /api/tables error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load restaurant tables" },
      { status: 500 }
    );
  }
}

// POST /api/tables - Create new table or batch update layout positions
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const user = session.user as any;
    let businessId = user.businessId;

    if (!businessId) {
      const defaultBiz = await Business.findOne().lean();
      businessId = defaultBiz?._id;
    }

    const body = await req.json();

    // Check if batch layout position update
    if (body.positions && Array.isArray(body.positions)) {
      const bulkOps = body.positions.map((pos: { tableId: string; x: number; y: number }) => ({
        updateOne: {
          filter: { _id: pos.tableId, businessId },
          update: { $set: { "position.x": pos.x, "position.y": pos.y } },
        },
      }));
      await RestaurantTable.bulkWrite(bulkOps);
      return NextResponse.json({ success: true, message: "Floor plan layout updated" });
    }

    // Single Table Creation
    const { tableNumber, tableName, section, capacity, shape, position } = body;
    if (!tableNumber || !section) {
      return NextResponse.json(
        { error: "Table number and section are required" },
        { status: 400 }
      );
    }

    const existing = await RestaurantTable.findOne({
      businessId,
      tableNumber: tableNumber.trim(),
    });
    if (existing) {
      return NextResponse.json(
        { error: `Table "${tableNumber}" already exists in this store.` },
        { status: 409 }
      );
    }

    const table = await RestaurantTable.create({
      businessId,
      tableNumber: tableNumber.trim(),
      tableName: tableName?.trim() || undefined,
      section: section.trim(),
      capacity: Number(capacity) || 4,
      shape: shape || "SQUARE",
      position: position || { x: 50, y: 50 },
      status: "AVAILABLE",
    });

    return NextResponse.json({ success: true, table });
  } catch (error: any) {
    console.error("POST /api/tables error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create restaurant table" },
      { status: 500 }
    );
  }
}
