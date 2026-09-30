import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Supplier } from "@/models/Supplier";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth, requireRole } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const context = await requireAuth();
    const { searchParams } = new URL(req.url);

    const search = searchParams.get("q")?.trim() || "";
    const hasBalance = searchParams.get("hasBalance") === "true";

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const query: any = { businessId, isActive: true };

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { code: { $regex: search, $options: "i" } },
          { contactPerson: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
        ];
      }

      if (hasBalance) {
        query.currentBalance = { $gt: 0 };
      }

      const [suppliers, metrics] = await Promise.all([
        Supplier.find(query).sort({ currentBalance: -1, name: 1 }).lean(),
        Supplier.aggregate([
          { $match: { businessId, isActive: true } },
          {
            $group: {
              _id: null,
              totalPayableBalance: { $sum: "$currentBalance" },
              totalSuppliers: { $sum: 1 },
              activePayablesCount: {
                $sum: { $cond: [{ $gt: ["$currentBalance", 0] }, 1, 0] },
              },
            },
          },
        ]),
      ]);

      const summary = metrics[0] || {
        totalPayableBalance: 0,
        totalSuppliers: 0,
        activePayablesCount: 0,
      };

      return NextResponse.json({
        success: true,
        suppliers,
        metrics: summary,
      });
    }

    // Demo Mode fallback
    return NextResponse.json({
      success: true,
      suppliers: [
        {
          _id: "demo_sup_01",
          name: "Unilever Sri Lanka Ltd",
          code: "SUP-UNI",
          contactPerson: "Kamal Jayasinghe",
          phone: "0112180000",
          paymentTermsDays: 30,
          creditLimit: 500000,
          currentBalance: 84500,
          isActive: true,
        },
        {
          _id: "demo_sup_02",
          name: "CBL Munchee Distributors",
          code: "SUP-CBL",
          contactPerson: "Nuwan Bandara",
          phone: "0112445566",
          paymentTermsDays: 14,
          creditLimit: 250000,
          currentBalance: 42000,
          isActive: true,
        },
      ],
      metrics: {
        totalPayableBalance: 126500,
        totalSuppliers: 2,
        activePayablesCount: 2,
      },
    });
  } catch (error: any) {
    console.error("Error fetching suppliers:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch suppliers" },
      { status: error.status || 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPER_ADMIN"]);
    const body = await req.json();

    const {
      name,
      code,
      contactPerson,
      phone,
      email,
      address,
      taxNumber,
      paymentTermsDays = 30,
      creditLimit = 0,
      notes,
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: "Supplier name is required." }, { status: 400 });
    }
    if (!phone?.trim()) {
      return NextResponse.json({ success: false, error: "Supplier phone number is required." }, { status: 400 });
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const supplier = await Supplier.create({
        businessId,
        name: name.trim(),
        code: code?.trim()?.toUpperCase() || undefined,
        contactPerson: contactPerson?.trim() || undefined,
        phone: phone.trim(),
        email: email?.trim()?.toLowerCase() || undefined,
        address: address?.trim() || undefined,
        taxNumber: taxNumber?.trim() || undefined,
        paymentTermsDays: Number(paymentTermsDays) || 30,
        creditLimit: Number(creditLimit) || 0,
        currentBalance: 0,
        notes: notes?.trim() || undefined,
        isActive: true,
      });

      await AuditLog.create({
        businessId,
        action: "SUPPLIER_CREATED",
        entity: "SUPPLIER",
        entityId: supplier._id.toString(),
        userId: context.userId,
        details: {
          name: supplier.name,
          code: supplier.code,
          phone: supplier.phone,
          terms: supplier.paymentTermsDays,
        },
      });

      return NextResponse.json({
        success: true,
        supplier,
        message: `Supplier "${supplier.name}" created successfully.`,
      });
    }

    return NextResponse.json({
      success: true,
      supplier: {
        _id: `sup_${Date.now()}`,
        name: name.trim(),
        phone: phone.trim(),
        currentBalance: 0,
        paymentTermsDays,
      },
      message: "Demo: Supplier created.",
    });
  } catch (error: any) {
    console.error("Error creating supplier:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create supplier" },
      { status: error.status || 500 }
    );
  }
}
