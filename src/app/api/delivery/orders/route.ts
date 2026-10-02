import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { DeliveryOrder, IDeliveryOrder } from "@/models/DeliveryOrder";
import { requireAuth } from "@/lib/tenant";

// Realistic demonstration orders for Sri Lankan counter setup
const demoDeliveryOrders = [
  {
    platform: "PICKME_FOOD",
    externalOrderId: "PM-89214",
    status: "PENDING_ACCEPT",
    customer: {
      name: "Kasun Jayawardena",
      phone: "077 123 4567",
      deliveryAddress: "No. 42/1, Galle Road, Colombo 03",
      deliveryNotes: "Call when at security gate. Extra spicy pol sambol please.",
    },
    items: [
      {
        name: "Chicken Cheese Kottu (Full)",
        nameSinhala: "චිකන් චීස් කොත්තු",
        quantity: 1,
        unitPrice: 1850,
        lineTotal: 1850,
        specialInstructions: "Extra gravy on the side",
      },
      {
        name: "Iced Milo Dinosaur",
        nameSinhala: "අයිස් මයිලෝ ඩයිනෝසෝර්",
        quantity: 2,
        unitPrice: 450,
        lineTotal: 900,
      },
    ],
    financials: {
      subtotal: 2750,
      platformDiscount: 0,
      merchantDiscount: 0,
      deliveryFee: 250,
      platformCommissionPercent: 22,
      platformCommissionAmount: 605,
      estimatedNetPayout: 2145,
      totalBill: 3000,
      payoutStatus: "PENDING",
    },
    rider: {
      name: "Pradeep Kumara",
      phone: "071 889 9123",
      vehicleNumber: "WP BDF-4512",
      vehicleType: "BIKE",
      pickupPin: "4821",
      arrivalEtaMinutes: 12,
      arrivedAtStore: false,
    },
    prepTimeMinutes: 15,
  },
  {
    platform: "UBER_EATS",
    externalOrderId: "UE-49102",
    status: "PREPARING",
    customer: {
      name: "Dinithi Wickramasinghe",
      phone: "076 992 3411",
      deliveryAddress: "Apt 4B, Fairway Sky Luxury, Rajagiriya",
      deliveryNotes: "Ring doorbell 4B. Leave at door if contactless.",
    },
    items: [
      {
        name: "Egg Hopper Set with Katta Sambol (4 pcs)",
        nameSinhala: "බිත්තර ආප්ප සෙට්",
        quantity: 2,
        unitPrice: 650,
        lineTotal: 1300,
      },
      {
        name: "Ceylon Milk Tea (Hot Flask)",
        nameSinhala: "කිරි තේ",
        quantity: 2,
        unitPrice: 280,
        lineTotal: 560,
      },
    ],
    financials: {
      subtotal: 1860,
      platformDiscount: 100,
      merchantDiscount: 0,
      deliveryFee: 200,
      platformCommissionPercent: 25,
      platformCommissionAmount: 465,
      estimatedNetPayout: 1395,
      totalBill: 1960,
      payoutStatus: "PENDING",
    },
    rider: {
      name: "Mohamed Rilwan",
      phone: "072 341 0022",
      vehicleNumber: "WP QD-1982",
      vehicleType: "BIKE",
      pickupPin: "1934",
      arrivalEtaMinutes: 6,
      arrivedAtStore: false,
    },
    prepTimeMinutes: 20,
    acceptedAt: new Date(Date.now() - 8 * 60 * 1000),
    scheduledPrepEnd: new Date(Date.now() + 12 * 60 * 1000),
  },
  {
    platform: "PICKME_FLASH",
    externalOrderId: "PMF-3301",
    status: "READY_FOR_PICKUP",
    customer: {
      name: "Nuwan Senanayake",
      phone: "075 554 8812",
      deliveryAddress: "No. 15, Duplication Road, Kollupitiya",
      deliveryNotes: "Package contains fragile bakery items. Handle carefully.",
    },
    items: [
      {
        name: "Fish Pastry Box (Pack of 6)",
        quantity: 1,
        unitPrice: 960,
        lineTotal: 960,
      },
      {
        name: "Seeni Sambol Bun",
        quantity: 4,
        unitPrice: 150,
        lineTotal: 600,
      },
    ],
    financials: {
      subtotal: 1560,
      platformDiscount: 0,
      merchantDiscount: 0,
      deliveryFee: 300,
      platformCommissionPercent: 18,
      platformCommissionAmount: 280.8,
      estimatedNetPayout: 1279.2,
      totalBill: 1860,
      payoutStatus: "PENDING",
    },
    rider: {
      name: "Sanjeewa Perera",
      phone: "077 712 3991",
      vehicleNumber: "WP YD-8821",
      vehicleType: "THREE_WHEELER",
      pickupPin: "7702",
      arrivalEtaMinutes: 1,
      arrivedAtStore: true,
    },
    prepTimeMinutes: 10,
    acceptedAt: new Date(Date.now() - 15 * 60 * 1000),
    readyAt: new Date(Date.now() - 2 * 60 * 1000),
  },
];

export async function GET(req: Request) {
  try {
    const context = await requireAuth();
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status") || "ALL";
    const platformFilter = searchParams.get("platform");
    const query = searchParams.get("q")?.trim();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const filter: Record<string, unknown> = {
        businessId: context.businessId,
      };

      if (statusFilter === "ACTIVE") {
        filter.status = { $in: ["PENDING_ACCEPT", "ACCEPTED", "PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY"] };
      } else if (statusFilter === "PENDING_ACCEPT") {
        filter.status = "PENDING_ACCEPT";
      } else if (statusFilter === "COMPLETED") {
        filter.status = { $in: ["DELIVERED", "CANCELLED", "REJECTED"] };
      } else if (statusFilter !== "ALL") {
        filter.status = statusFilter;
      }

      if (platformFilter && platformFilter !== "ALL") {
        filter.platform = platformFilter;
      }

      if (query) {
        filter.$or = [
          { externalOrderId: { $regex: query, $options: "i" } },
          { "customer.name": { $regex: query, $options: "i" } },
          { "customer.phone": { $regex: query, $options: "i" } },
          { "rider.vehicleNumber": { $regex: query, $options: "i" } },
        ];
      }

      let orders = await DeliveryOrder.find(filter).sort({ createdAt: -1 });

      // Auto seed initial demo orders if brand new business
      if (orders.length === 0 && statusFilter === "ALL" && !query && !platformFilter) {
        const seeded = demoDeliveryOrders.map((d) => ({
          ...d,
          businessId: context.businessId,
          auditTrail: [
            {
              timestamp: new Date(),
              status: d.status,
              actor: "System Ingest",
              notes: "Order ingested via delivery aggregator",
            },
          ],
        }));
        await DeliveryOrder.insertMany(seeded);
        orders = await DeliveryOrder.find(filter).sort({ createdAt: -1 });
      }

      return NextResponse.json({ success: true, orders });
    }

    return NextResponse.json({ success: true, orders: demoDeliveryOrders });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch delivery orders";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireAuth();
    const body = await req.json();

    const {
      platform = "DIRECT_STORE",
      customer,
      items,
      prepTimeMinutes = 15,
      deliveryFee = 0,
      merchantDiscount = 0,
      riderName,
      riderPhone,
      riderVehicleNumber,
      riderVehicleType = "BIKE",
    } = body;

    if (!customer?.name || !customer?.phone || !customer?.deliveryAddress) {
      return NextResponse.json(
        { success: false, error: "Customer name, phone, and delivery address are required." },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Order must contain at least one item." },
        { status: 400 }
      );
    }

    // Calculate financials
    const subtotal = items.reduce(
      (sum: number, item: any) => sum + (Number(item.unitPrice) * Number(item.quantity) || 0),
      0
    );

    const commissionRate = platform === "PICKME_FOOD" ? 22 : platform === "UBER_EATS" ? 25 : 0;
    const commissionAmount = Math.round((subtotal * (commissionRate / 100)) * 100) / 100;
    const estimatedNetPayout = Math.max(0, subtotal - commissionAmount);
    const totalBill = Math.max(0, subtotal + Number(deliveryFee) - Number(merchantDiscount));

    const pickupPin = Math.floor(1000 + Math.random() * 9000).toString();
    const externalOrderId =
      body.externalOrderId ||
      `${platform === "DIRECT_STORE" ? "DIR" : platform === "PICKME_FOOD" ? "PM" : "UE"}-${Math.floor(
        10000 + Math.random() * 90000
      )}`;

    const newOrderPayload: Partial<IDeliveryOrder> = {
      businessId: context.businessId as any,
      platform,
      externalOrderId,
      status: "PENDING_ACCEPT",
      customer: {
        name: customer.name.trim(),
        phone: customer.phone.trim(),
        deliveryAddress: customer.deliveryAddress.trim(),
        deliveryNotes: customer.deliveryNotes?.trim(),
      },
      items: items.map((i: any) => ({
        name: i.name,
        nameSinhala: i.nameSinhala,
        nameTamil: i.nameTamil,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        lineTotal: Math.round(Number(i.unitPrice) * Number(i.quantity) * 100) / 100,
        unit: i.unit || "unit",
        specialInstructions: i.specialInstructions,
      })),
      financials: {
        subtotal,
        platformDiscount: 0,
        merchantDiscount: Number(merchantDiscount),
        deliveryFee: Number(deliveryFee),
        platformCommissionPercent: commissionRate,
        platformCommissionAmount: commissionAmount,
        estimatedNetPayout,
        totalBill,
        payoutStatus: "PENDING",
      },
      rider: {
        name: riderName || (platform === "DIRECT_STORE" ? "Store Driver" : "Assigned Delivery Partner"),
        phone: riderPhone || "",
        vehicleNumber: riderVehicleNumber || "",
        vehicleType: riderVehicleType,
        pickupPin,
        arrivalEtaMinutes: prepTimeMinutes,
        arrivedAtStore: false,
      },
      prepTimeMinutes: Number(prepTimeMinutes),
      scheduledPrepEnd: new Date(Date.now() + Number(prepTimeMinutes) * 60 * 1000),
      auditTrail: [
        {
          timestamp: new Date(),
          status: "PENDING_ACCEPT",
          actor: context.username || "Cashier",
          notes: "Created direct/phone delivery order",
        },
      ],
    };

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const order = await DeliveryOrder.create(newOrderPayload);
      return NextResponse.json({ success: true, order });
    }

    return NextResponse.json({ success: true, order: { _id: "order_demo", ...newOrderPayload } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create delivery order";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
