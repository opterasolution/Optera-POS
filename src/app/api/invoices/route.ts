import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Sale } from "@/models/Sale";
import { Business } from "@/models/Business";
import { requireAuth, verifyActiveSubscription } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const context = await requireAuth();
    await verifyActiveSubscription(context.businessId);

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";
    const type = searchParams.get("type") || "ALL"; // ALL, TAX_INVOICE, RETAIL, CREDIT
    const paymentStatus = searchParams.get("paymentStatus") || "ALL"; // ALL, PAID, PARTIAL, UNPAID
    const dateRange = searchParams.get("dateRange") || "all";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const skip = (page - 1) * limit;

    await connectToDatabase();
    const businessId = context.businessId;

    const filter: Record<string, unknown> = {
      businessId,
      status: "COMPLETED",
    };

    if (type === "TAX_INVOICE") {
      filter.isTaxInvoice = true;
    } else if (type === "RETAIL") {
      filter.isTaxInvoice = { $ne: true };
    } else if (type === "CREDIT") {
      filter.isCreditSale = true;
    }

    if (paymentStatus && paymentStatus !== "ALL") {
      filter.paymentStatus = paymentStatus;
    }

    if (q) {
      filter.$or = [
        { invoiceNumber: { $regex: q, $options: "i" } },
        { customerName: { $regex: q, $options: "i" } },
        { customerPhone: { $regex: q, $options: "i" } },
        { "buyerDetails.companyName": { $regex: q, $options: "i" } },
        { "buyerDetails.tin": { $regex: q, $options: "i" } },
        { quotationNumber: { $regex: q, $options: "i" } },
      ];
    }

    if (dateRange !== "all") {
      const now = new Date();
      const slOffsetMs = 5.5 * 60 * 60 * 1000;
      const slNow = new Date(now.getTime() + slOffsetMs);

      const startOfDay = new Date(
        Date.UTC(slNow.getUTCFullYear(), slNow.getUTCMonth(), slNow.getUTCDate()) - slOffsetMs
      );

      if (dateRange === "today") {
        filter.createdAt = { $gte: startOfDay };
      } else if (dateRange === "yesterday") {
        const startOfYesterday = new Date(startOfDay.getTime() - 24 * 60 * 60 * 1000);
        filter.createdAt = { $gte: startOfYesterday, $lt: startOfDay };
      } else if (dateRange === "7d") {
        filter.createdAt = { $gte: new Date(startOfDay.getTime() - 7 * 24 * 60 * 60 * 1000) };
      } else if (dateRange === "30d") {
        filter.createdAt = { $gte: new Date(startOfDay.getTime() - 30 * 24 * 60 * 60 * 1000) };
      } else if (dateRange === "month") {
        const startOfMonth = new Date(
          Date.UTC(slNow.getUTCFullYear(), slNow.getUTCMonth(), 1) - slOffsetMs
        );
        filter.createdAt = { $gte: startOfMonth };
      } else if (dateRange === "last_month") {
        const startOfLastMonth = new Date(
          Date.UTC(slNow.getUTCFullYear(), slNow.getUTCMonth() - 1, 1) - slOffsetMs
        );
        const endOfLastMonth = new Date(
          Date.UTC(slNow.getUTCFullYear(), slNow.getUTCMonth(), 0, 23, 59, 59, 999) - slOffsetMs
        );
        filter.createdAt = { $gte: startOfLastMonth, $lte: endOfLastMonth };
      }
    }

    const [invoices, totalCount, businessDoc] = await Promise.all([
      Sale.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Sale.countDocuments(filter),
      Business.findById(businessId).select("name taxSettings bankDetails phone address email"),
    ]);

    // Aggregate B2B metrics & IRD tax schedule totals
    const taxStats = await Sale.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalInvoiced: { $sum: "$netTotal" },
          totalTaxable: { $sum: { $ifNull: ["$taxBreakdown.taxableAmount", "$subtotal"] } },
          outputVatTotal: { $sum: { $ifNull: ["$taxBreakdown.vatAmount", 0] } },
          ssclTotal: { $sum: { $ifNull: ["$taxBreakdown.ssclAmount", 0] } },
          totalUnpaid: { $sum: { $ifNull: ["$balanceDue", 0] } },
          totalPaid: { $sum: { $ifNull: ["$amountPaid", "$netTotal"] } },
          taxInvoiceCount: {
            $sum: { $cond: [{ $eq: ["$isTaxInvoice", true] }, 1, 0] },
          },
        },
      },
    ]);

    const summary = taxStats[0] || {
      totalInvoiced: 0,
      totalTaxable: 0,
      outputVatTotal: 0,
      ssclTotal: 0,
      totalUnpaid: 0,
      totalPaid: 0,
      taxInvoiceCount: 0,
    };

    return NextResponse.json({
      success: true,
      invoices,
      totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit),
      summary,
      business: businessDoc,
    });
  } catch (error: any) {
    console.error("GET /api/invoices error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch invoices" },
      { status: error.status || 500 }
    );
  }
}
