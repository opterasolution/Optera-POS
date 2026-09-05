import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Customer } from "@/models/Customer";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth } from "@/lib/tenant";
import { customerSchema } from "@/lib/validations/customer";
import { normalizeSLPhone } from "@/lib/formatters";

// Default Sri Lankan retail customers for demo mode
const defaultDemoCustomers = [
  {
    _id: "cust_1",
    name: "Sunil Perera",
    phone: "0771234567",
    email: "sunil.perera@gmail.com",
    address: "Peradeniya Road, Kandy",
    totalSpent: 12450,
    visitCount: 6,
    lastVisit: new Date().toISOString(),
    notes: "Regular customer, prefers Ceylon tea",
  },
  {
    _id: "cust_2",
    name: "Anoma Silva",
    phone: "0719876543",
    email: "anoma.s@yahoo.com",
    address: "Katugastota, Kandy",
    totalSpent: 8650,
    visitCount: 4,
    lastVisit: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    notes: "Buys weekly groceries",
  },
  {
    _id: "cust_3",
    name: "Kamal Gunaratne",
    phone: "0765551234",
    email: "",
    address: "Ampitiya, Kandy",
    totalSpent: 3420,
    visitCount: 2,
    lastVisit: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    notes: "",
  },
];

export async function GET(req: Request) {
  try {
    const context = await requireAuth();
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const filter: Record<string, unknown> = {
        businessId: context.businessId,
      };

      if (query) {
        filter.$or = [
          { name: { $regex: query, $options: "i" } },
          { phone: { $regex: query, $options: "i" } },
          { email: { $regex: query, $options: "i" } },
        ];
      }

      const customers = await Customer.find(filter).sort({ totalSpent: -1 });

      const totalSpentAll = customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
      const avgSpend = customers.length > 0 ? totalSpentAll / customers.length : 0;

      return NextResponse.json({
        success: true,
        summary: {
          totalCustomers: customers.length,
          totalRevenue: totalSpentAll,
          averageSpend: Math.round(avgSpend * 100) / 100,
        },
        customers,
      });
    }

    // Demo Data
    let demoList = [...defaultDemoCustomers];
    if (query) {
      const qLower = query.toLowerCase();
      demoList = demoList.filter(
        (c) =>
          c.name.toLowerCase().includes(qLower) ||
          c.phone.includes(qLower) ||
          c.email.toLowerCase().includes(qLower)
      );
    }

    const totalDemo = demoList.reduce((s, c) => s + c.totalSpent, 0);

    return NextResponse.json({
      success: true,
      summary: {
        totalCustomers: demoList.length,
        totalRevenue: totalDemo,
        averageSpend: demoList.length ? Math.round(totalDemo / demoList.length) : 0,
      },
      customers: demoList,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load customers";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireAuth();
    const body = await req.json();

    const parsed = customerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { name, phone, email, address, notes } = parsed.data;
    const normalizedPhone = normalizeSLPhone(phone);

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      // Check duplicate phone per business
      const existing = await Customer.findOne({
        businessId: context.businessId,
        phone: normalizedPhone,
      });

      if (existing) {
        return NextResponse.json(
          {
            success: false,
            error: `Customer with phone number "${normalizedPhone}" already exists (${existing.name}).`,
          },
          { status: 409 }
        );
      }

      const customer = await Customer.create({
        businessId: context.businessId,
        name,
        phone: normalizedPhone,
        email: email || undefined,
        address: address || undefined,
        notes: notes || undefined,
        totalSpent: 0,
        visitCount: 0,
      });

      await AuditLog.create({
        businessId: context.businessId,
        userId: context.userId,
        userName: context.username,
        action: "CUSTOMER_CREATED",
        entityType: "Customer",
        entityId: customer._id.toString(),
        details: { name, phone: normalizedPhone },
      });

      return NextResponse.json({ success: true, customer }, { status: 201 });
    }

    // Demo Mode fallback
    const newDemoCustomer = {
      _id: `cust_${Date.now()}`,
      name,
      phone: normalizedPhone,
      email,
      address,
      notes,
      totalSpent: 0,
      visitCount: 0,
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, customer: newDemoCustomer }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create customer";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
