import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Quotation, IQuotationItem } from "@/models/Quotation";
import { Product } from "@/models/Product";
import { Business } from "@/models/Business";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth, verifyActiveSubscription } from "@/lib/tenant";
import { createQuotationSchema } from "@/lib/validations/quotation";
import { dispatchSms } from "@/lib/sms";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const context = await requireAuth();
    await verifyActiveSubscription(context.businessId);

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";
    const status = searchParams.get("status")?.trim();
    const dateRange = searchParams.get("dateRange") || "all";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const skip = (page - 1) * limit;

    await connectToDatabase();
    const businessId = context.businessId;

    // Auto-update expired quotations
    await Quotation.updateMany(
      {
        businessId,
        status: { $in: ["DRAFT", "SENT"] },
        validUntil: { $lt: new Date() },
      },
      { $set: { status: "EXPIRED" } }
    );

    const filter: Record<string, unknown> = { businessId };

    if (status && status !== "ALL") {
      filter.status = status;
    }

    if (q) {
      filter.$or = [
        { quotationNumber: { $regex: q, $options: "i" } },
        { customerName: { $regex: q, $options: "i" } },
        { customerPhone: { $regex: q, $options: "i" } },
        { companyName: { $regex: q, $options: "i" } },
        { tin: { $regex: q, $options: "i" } },
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
      } else if (dateRange === "7d") {
        filter.createdAt = { $gte: new Date(startOfDay.getTime() - 7 * 24 * 60 * 60 * 1000) };
      } else if (dateRange === "30d") {
        filter.createdAt = { $gte: new Date(startOfDay.getTime() - 30 * 24 * 60 * 60 * 1000) };
      }
    }

    const [quotations, totalCount] = await Promise.all([
      Quotation.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Quotation.countDocuments(filter),
    ]);

    // Financial stats across all active quotations
    const activeStats = await Quotation.aggregate([
      { $match: { businessId, status: { $in: ["DRAFT", "SENT", "ACCEPTED"] } } },
      {
        $group: {
          _id: null,
          totalValue: { $sum: "$netTotal" },
          count: { $sum: 1 },
        },
      },
    ]);

    const convertedCount = await Quotation.countDocuments({ businessId, status: "CONVERTED" });

    return NextResponse.json({
      success: true,
      quotations,
      totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit),
      summary: {
        activeCount: activeStats[0]?.count || 0,
        activeValue: activeStats[0]?.totalValue || 0,
        convertedCount,
      },
    });
  } catch (error: any) {
    console.error("GET /api/quotations error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch quotations" },
      { status: error.status || 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireAuth();
    await verifyActiveSubscription(context.businessId);

    const body = await req.json();
    const parsed = createQuotationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const {
      customerId,
      customerName,
      customerPhone,
      customerEmail,
      companyName,
      tin,
      vatNumber,
      address,
      items,
      discountTotal,
      applySscl,
      applyVat,
      validUntil,
      notes,
    } = parsed.data;

    await connectToDatabase();
    const businessId = context.businessId;

    // 1. Fetch store tax settings
    const business = await Business.findById(businessId);
    const ssclRate = applySscl ? (business?.taxSettings?.ssclRate || 2.5) : 0;
    const vatRate = applyVat ? (business?.taxSettings?.rate || 18) : 0;

    // 2. Fetch products to snapshot current prices
    const productIds = items.map((i) => i.productId);
    const dbProducts = await Product.find({
      _id: { $in: productIds },
      businessId,
      isActive: true,
    });

    const productMap = new Map(dbProducts.map((p) => [p._id.toString(), p]));

    // 3. Verify items and calculate financial totals
    const verifiedItems: IQuotationItem[] = [];
    let calculatedSubtotal = 0;

    for (const item of items) {
      const dbProduct = productMap.get(item.productId);
      if (!dbProduct) {
        return NextResponse.json(
          { success: false, error: `Product ID "${item.productId}" not found.` },
          { status: 400 }
        );
      }

      const unitPrice =
        item.priceTier === "WHOLESALE" && (dbProduct.wholesalePrice || 0) > 0
          ? (dbProduct.wholesalePrice as number)
          : item.unitPrice > 0
          ? item.unitPrice
          : dbProduct.sellingPrice;

      const costPrice = dbProduct.costPrice || 0;
      const lineSubtotal = unitPrice * item.quantity;
      const lineDiscount = item.discount || 0;
      const lineTotal = Math.max(0, lineSubtotal - lineDiscount);

      calculatedSubtotal += lineTotal;

      verifiedItems.push({
        productId: dbProduct._id,
        name: dbProduct.name,
        barcode: dbProduct.barcode,
        unitPrice,
        costPrice,
        quantity: item.quantity,
        subtotal: lineSubtotal,
        discount: lineDiscount,
        total: lineTotal,
        priceTier: item.priceTier || "RETAIL",
      });
    }

    // 4. Calculate Taxes according to Sri Lanka IRD rules
    const taxableAmount = Math.max(0, calculatedSubtotal - discountTotal);
    const ssclAmount = applySscl && ssclRate > 0
      ? Math.round(((taxableAmount * ssclRate) / 100) * 100) / 100
      : 0;
    const vatAmount = applyVat && vatRate > 0
      ? Math.round((((taxableAmount + ssclAmount) * vatRate) / 100) * 100) / 100
      : 0;
    const taxTotal = Math.round((ssclAmount + vatAmount) * 100) / 100;
    const netTotal = Math.round((taxableAmount + taxTotal) * 100) / 100;

    // 5. Generate sequential quotation number: QT-YYYYMMDD-XXXX
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const countToday = await Quotation.countDocuments({
      businessId,
      createdAt: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
      },
    });
    const quotationNumber = `QT-${todayStr}-${String(countToday + 1).padStart(4, "0")}`;

    // Default validity: 14 days
    const validityDate = validUntil
      ? new Date(validUntil)
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    // 6. Create Quotation document
    const quotation = await Quotation.create({
      businessId,
      quotationNumber,
      customerId: customerId && Types.ObjectId.isValid(customerId) ? new Types.ObjectId(customerId) : undefined,
      customerName,
      customerPhone: customerPhone || undefined,
      customerEmail: customerEmail || undefined,
      companyName: companyName || undefined,
      tin: tin || undefined,
      vatNumber: vatNumber || undefined,
      address: address || undefined,
      items: verifiedItems,
      subtotal: calculatedSubtotal,
      discountTotal,
      taxTotal,
      taxBreakdown: {
        taxableAmount,
        ssclRate,
        ssclAmount,
        vatRate,
        vatAmount,
      },
      netTotal,
      validUntil: validityDate,
      status: "DRAFT",
      notes: notes || undefined,
      createdBy: context.username || "Staff",
      createdById: context.userId,
    });

    // 7. Audit log
    await AuditLog.create({
      businessId,
      userId: context.userId,
      userName: context.username,
      action: "QUOTATION_CREATED",
      entityType: "Quotation",
      entityId: quotation._id.toString(),
      details: {
        quotationNumber,
        customerName,
        netTotal,
        itemsCount: verifiedItems.length,
      },
    });

    // Trigger SMS notification for quotation alert
    if (customerPhone) {
      try {
        await dispatchSms({
          businessId,
          recipientPhone: customerPhone,
          recipientName: customerName || "Valued Customer",
          customerId: customerId && Types.ObjectId.isValid(customerId) ? new Types.ObjectId(customerId) : undefined,
          eventType: "QUOTATION_ALERT",
          templateKey: "quotationAlert",
          variables: {
            customerName: customerName || "Valued Customer",
            amount: netTotal.toLocaleString(),
            dueDate: validityDate.toLocaleDateString(),
            ref: quotationNumber,
            storeName: business?.name || "Our Store",
          },
          metadata: { quotationNumber, quotationId: quotation._id.toString() },
        });
      } catch (smsErr) {
        console.error("Quotation SMS trigger failed:", smsErr);
      }
    }

    return NextResponse.json({ success: true, quotation }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/quotations error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create quotation" },
      { status: error.status || 500 }
    );
  }
}
