import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/db";
import KitchenTicket from "@/models/KitchenTicket";
import Business from "@/models/Business";
import mongoose from "mongoose";

// GET /api/kds/tickets - Retrieve active or filtered kitchen tickets
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
    const station = searchParams.get("station") || "ALL";
    const statusFilter = searchParams.get("status") || "ACTIVE"; // "ACTIVE" | "HISTORY" | specific status

    const query: any = { businessId };

    if (statusFilter === "ACTIVE") {
      query.status = { $in: ["NEW", "PREPARING", "READY"] };
    } else if (statusFilter === "HISTORY") {
      query.status = { $in: ["SERVED", "CANCELLED"] };
    } else if (statusFilter !== "ALL") {
      query.status = statusFilter;
    }

    if (station && station !== "ALL") {
      // Either ticket-level station matches, or ticket has items mapped to this station
      query.$or = [{ station: station }, { "items.station": station }];
    }

    let tickets = await KitchenTicket.find(query)
      .sort({ priority: -1, createdAt: 1 }) // RUSH orders first, then FIFO
      .limit(60)
      .lean();

    // Auto-seed Sri Lankan demo orders if table is completely empty
    if (tickets.length === 0 && statusFilter === "ACTIVE" && station === "ALL") {
      const count = await KitchenTicket.countDocuments({ businessId });
      if (count === 0) {
        const demoTickets = [
          {
            businessId,
            ticketNumber: "KOT-101",
            orderNumber: "INV-8041",
            source: "DINE_IN",
            tableOrCustomer: "Table 03 (Indoor)",
            orderType: "DINE_IN",
            serverName: "Sunil W.",
            station: "ALL",
            priority: "RUSH",
            targetPrepMinutes: 12,
            notes: "Please serve hot ginger tea first before Kottu",
            status: "PREPARING",
            startedAt: new Date(Date.now() - 4 * 60 * 1000),
            createdAt: new Date(Date.now() - 6 * 60 * 1000),
            items: [
              {
                name: "Chicken Cheese Kottu Roti",
                nameSi: "චිකන් චීස් කොත්තු",
                quantity: 2,
                unit: "portions",
                notes: "Medium spicy, extra roast chicken pieces",
                station: "GRILL_HOPPERS",
                status: "PREPARING",
              },
              {
                name: "Hot Ginger Milk Tea",
                nameSi: "ඉඟුරු කිරි තේ",
                quantity: 2,
                unit: "cups",
                notes: "Brown sugar, strong brew",
                station: "BEVERAGE_BAR",
                status: "COMPLETED",
              },
            ],
          },
          {
            businessId,
            ticketNumber: "KOT-102",
            orderNumber: "PM-9418",
            source: "PICKME",
            tableOrCustomer: "PickMe Food • Rider: Kamal",
            orderType: "DELIVERY",
            serverName: "Online Dispatcher",
            station: "ALL",
            priority: "NORMAL",
            targetPrepMinutes: 15,
            notes: "Pack curry containers tightly for motorbike delivery",
            status: "NEW",
            createdAt: new Date(Date.now() - 11 * 60 * 1000), // nearing amber threshold
            items: [
              {
                name: "Fish Rice & Curry (Basmati)",
                nameSi: "මාළු බත් සහ ව්‍යංජන",
                quantity: 1,
                unit: "packets",
                notes: "With pol sambol and dhal",
                station: "HOT_KITCHEN",
                status: "PENDING",
              },
              {
                name: "Fish Chinese Rolls",
                nameSi: "මාළු රෝල්ස්",
                quantity: 4,
                unit: "pcs",
                notes: "Extra crispy crust",
                station: "BAKERY_SHORT_EATS",
                status: "PENDING",
              },
            ],
          },
          {
            businessId,
            ticketNumber: "KOT-103",
            orderNumber: "INV-8045",
            source: "POS_COUNTER",
            tableOrCustomer: "Walk-in Takeaway (A/C)",
            orderType: "TAKEAWAY",
            serverName: "Kasun P.",
            station: "ALL",
            priority: "NORMAL",
            targetPrepMinutes: 15,
            notes: "Customer waiting at front counter",
            status: "READY",
            startedAt: new Date(Date.now() - 14 * 60 * 1000),
            readyAt: new Date(Date.now() - 1 * 60 * 1000),
            createdAt: new Date(Date.now() - 16 * 60 * 1000),
            items: [
              {
                name: "Egg Hopper with Katta Sambol",
                nameSi: "බිත්තර ආප්ප සහ කට්ට සම්බෝල",
                quantity: 4,
                unit: "pcs",
                notes: "Runny yolk center",
                station: "GRILL_HOPPERS",
                status: "COMPLETED",
              },
              {
                name: "Plain Tea with Hakuru",
                nameSi: "කහට තේ සහ හකුරු",
                quantity: 1,
                unit: "cups",
                station: "BEVERAGE_BAR",
                status: "COMPLETED",
              },
            ],
          },
        ];

        await KitchenTicket.insertMany(demoTickets);
        tickets = await KitchenTicket.find(query)
          .sort({ priority: -1, createdAt: 1 })
          .limit(60)
          .lean();
      }
    }

    return NextResponse.json({ success: true, tickets });
  } catch (error: any) {
    console.error("GET /api/kds/tickets error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch kitchen tickets" },
      { status: 500 }
    );
  }
}

// POST /api/kds/tickets - Create a new kitchen ticket
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
    const {
      orderNumber,
      source = "POS_COUNTER",
      tableOrCustomer = "Counter Order",
      orderType = "DINE_IN",
      serverName = user.name || "Staff",
      station = "ALL",
      priority = "NORMAL",
      targetPrepMinutes = 15,
      notes,
      items,
    } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Kitchen ticket must contain at least 1 food item" },
        { status: 400 }
      );
    }

    // Generate sequential ticket number
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const countToday = await KitchenTicket.countDocuments({
      businessId,
      createdAt: { $gte: todayStart },
    });
    const ticketSeq = (countToday + 1).toString().padStart(3, "0");
    const ticketNumber = `KOT-${ticketSeq}`;

    const newTicket = await KitchenTicket.create({
      businessId,
      ticketNumber,
      orderNumber: orderNumber || `ORD-${Date.now().toString().slice(-5)}`,
      source,
      tableOrCustomer,
      orderType,
      serverName,
      station,
      priority,
      targetPrepMinutes: Number(targetPrepMinutes) || 15,
      notes: notes?.trim() || undefined,
      status: "NEW",
      items: items.map((it: any) => ({
        itemId: it.itemId || it.productId,
        name: it.name,
        nameSi: it.nameSi || it.nameSinhala,
        nameTa: it.nameTa || it.nameTamil,
        quantity: Number(it.quantity) || 1,
        unit: it.unit || "portions",
        notes: it.notes?.trim() || undefined,
        station: it.station || it.kitchenStation || "HOT_KITCHEN",
        status: "PENDING",
      })),
    });

    return NextResponse.json({
      success: true,
      ticket: newTicket,
      message: `Kitchen ticket ${ticketNumber} dispatched to ${station}`,
    });
  } catch (error: any) {
    console.error("POST /api/kds/tickets error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create kitchen ticket" },
      { status: 500 }
    );
  }
}
