import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { SupplierPayment } from "@/models/SupplierPayment";
import { requireAuth } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const context = await requireAuth();
    const { searchParams } = new URL(req.url);

    const paymentMethod = searchParams.get("paymentMethod") || "ALL";
    const supplierId = searchParams.get("supplierId");
    const search = searchParams.get("q")?.trim() || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "30", 10);
    const skip = (page - 1) * limit;

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const query: any = { businessId };

      if (paymentMethod !== "ALL") {
        query.paymentMethod = paymentMethod;
      }

      if (supplierId) {
        query.supplierId = supplierId;
      }

      if (search) {
        query.$or = [
          { paymentNumber: { $regex: search, $options: "i" } },
          { supplierName: { $regex: search, $options: "i" } },
          { chequeNumber: { $regex: search, $options: "i" } },
          { referenceNumber: { $regex: search, $options: "i" } },
          { bankName: { $regex: search, $options: "i" } },
        ];
      }

      const [payments, totalCount, aggregateStats] = await Promise.all([
        SupplierPayment.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        SupplierPayment.countDocuments(query),
        SupplierPayment.aggregate([
          { $match: { businessId } },
          {
            $group: {
              _id: null,
              totalAmount: { $sum: "$amount" },
              totalCheque: {
                $sum: { $cond: [{ $eq: ["$paymentMethod", "CHEQUE"] }, "$amount", 0] },
              },
              totalBankTransfer: {
                $sum: { $cond: [{ $eq: ["$paymentMethod", "BANK_TRANSFER"] }, "$amount", 0] },
              },
              totalCash: {
                $sum: { $cond: [{ $eq: ["$paymentMethod", "CASH"] }, "$amount", 0] },
              },
              totalVouchers: { $sum: 1 },
            },
          },
        ]),
      ]);

      const stats = aggregateStats[0] || {
        totalAmount: 0,
        totalCheque: 0,
        totalBankTransfer: 0,
        totalCash: 0,
        totalVouchers: 0,
      };

      return NextResponse.json({
        success: true,
        payments,
        metrics: stats,
        pagination: {
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit) || 1,
          totalCount,
        },
      });
    }

    // Demo Mode fallback
    const demoPayments = [
      {
        _id: "pv_demo_01",
        paymentNumber: "PV-20260928-0001",
        supplierId: "demo_sup_01",
        supplierName: "Unilever Sri Lanka Ltd",
        amount: 50000,
        balanceBefore: 134500,
        balanceAfter: 84500,
        paymentMethod: "CHEQUE",
        chequeNumber: "CQ-881294",
        chequeDate: new Date("2026-10-15"),
        bankName: "Commercial Bank",
        paidBy: "Store Accountant",
        createdAt: new Date("2026-09-28T10:30:00Z"),
      },
      {
        _id: "pv_demo_02",
        paymentNumber: "PV-20260925-0002",
        supplierId: "demo_sup_02",
        supplierName: "CBL Munchee Distributors",
        amount: 30000,
        balanceBefore: 72000,
        balanceAfter: 42000,
        paymentMethod: "BANK_TRANSFER",
        referenceNumber: "FT-COMM-77261",
        bankName: "Sampath Bank",
        paidBy: "Store Accountant",
        createdAt: new Date("2026-09-25T14:15:00Z"),
      },
      {
        _id: "pv_demo_03",
        paymentNumber: "PV-20260920-0003",
        supplierId: "demo_sup_01",
        supplierName: "Unilever Sri Lanka Ltd",
        amount: 25000,
        balanceBefore: 159500,
        balanceAfter: 134500,
        paymentMethod: "CASH",
        notes: "Cash on delivery invoice receipt",
        paidBy: "Store Accountant",
        createdAt: new Date("2026-09-20T11:00:00Z"),
      },
    ];

    return NextResponse.json({
      success: true,
      payments: demoPayments,
      metrics: {
        totalAmount: 105000,
        totalCheque: 50000,
        totalBankTransfer: 30000,
        totalCash: 25000,
        totalVouchers: 3,
      },
      pagination: { page: 1, limit: 30, totalPages: 1, totalCount: 3 },
    });
  } catch (error: any) {
    console.error("Error fetching supplier payment vouchers:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch payment vouchers" },
      { status: error.status || 500 }
    );
  }
}
