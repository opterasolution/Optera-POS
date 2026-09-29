import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { SubscriptionInvoice } from "@/models/SubscriptionInvoice";
import { requireAuth } from "@/lib/tenant";

export async function GET() {
  try {
    const context = await requireAuth();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const invoices = await SubscriptionInvoice.find({
        businessId: context.businessId,
      }).sort({ createdAt: -1 });

      return NextResponse.json({
        success: true,
        invoices,
      });
    }

    // Demo Mode fallback
    const mockInvoices = [
      {
        _id: "demo_inv_001",
        invoiceNumber: "SUB-2026-0001",
        businessId: context.businessId,
        businessName: "Lanka Super Mart (Client Shop)",
        ownerName: "Sunil Perera",
        phone: "0771234567",
        plan: "PROFESSIONAL",
        billingCycle: "ANNUAL",
        durationMonths: 12,
        amount: 75000,
        discountAmount: 15000,
        paymentMethod: "BANK_TRANSFER",
        paymentReference: "COMM-TXN-984210",
        bankName: "Commercial Bank of Ceylon",
        periodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        periodEnd: new Date(Date.now() + 335 * 24 * 60 * 60 * 1000).toISOString(),
        status: "PAID",
        paidAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        notes: "Annual renewal prepay - 2 months discount applied",
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    return NextResponse.json({
      success: true,
      invoices: mockInvoices,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load store invoices";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
