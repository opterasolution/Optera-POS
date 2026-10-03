import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { RequestForQuotation, generateBidToken } from "@/models/RequestForQuotation";
import { Supplier, generateVendorPortalToken } from "@/models/Supplier";
import { Product } from "@/models/Product";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth, requireRole } from "@/lib/tenant";
import { dispatchSms } from "@/lib/sms";
import { Types } from "mongoose";

// Demo RFQs for development and demonstration mode
const defaultDemoRfqs = [
  {
    _id: "demo_rfq_1",
    rfqNumber: "RFQ-20261001-0001",
    title: "Q4 High-Demand Ceylon Tea & Spices Replenishment",
    description: "Annual competitive e-bidding for premium BOPF Ceylon tea packs and cinnamon quill assortments.",
    requiredByDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    deadlineDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    status: "OPEN",
    items: [
      {
        productId: "prod_tea_1",
        productName: "Dilmah Premium Ceylon Tea 400g",
        sku: "TEA-DIL-400G",
        requestedQty: 250,
        unit: "packs",
        targetPrice: 750,
        specifications: "Export quality foil wrapped sealed cartons, min 18 months expiry.",
      },
      {
        productId: "prod_cin_1",
        productName: "Ceylon True Alba Cinnamon 100g",
        sku: "SPICE-CIN-100",
        requestedQty: 100,
        unit: "packs",
        targetPrice: 620,
        specifications: "Pure Alba grade sticks, certified organic aroma.",
      },
    ],
    invitedSuppliers: [
      {
        supplierId: "sup_1",
        supplierName: "Unilever Sri Lanka Ltd",
        email: "orders@unilever.lk",
        phone: "0771122334",
        token: "bid_demo_unilever_token",
        status: "SUBMITTED",
        invitedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        submittedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        supplierId: "sup_2",
        supplierName: "CBL Munchee Distributors",
        email: "bids@cbl.lk",
        phone: "0779988776",
        token: "bid_demo_cbl_token",
        status: "SUBMITTED",
        invitedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        submittedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      },
      {
        supplierId: "sup_3",
        supplierName: "Maliban Biscuit Manufactories",
        email: "supply@maliban.lk",
        phone: "0712345678",
        token: "bid_demo_maliban_token",
        status: "INVITED",
        invitedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    bids: [
      {
        supplierId: "sup_1",
        supplierName: "Unilever Sri Lanka Ltd",
        token: "bid_demo_unilever_token",
        submittedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        items: [
          {
            productId: "prod_tea_1",
            productName: "Dilmah Premium Ceylon Tea 400g",
            offeredQty: 250,
            unitCost: 730,
            discountPercent: 2,
            netUnitCost: 715.40,
            totalCost: 178850,
            leadTimeDays: 3,
            notes: "Direct factory shipment palletized.",
          },
          {
            productId: "prod_cin_1",
            productName: "Ceylon True Alba Cinnamon 100g",
            offeredQty: 100,
            unitCost: 610,
            discountPercent: 0,
            netUnitCost: 610,
            totalCost: 61000,
            leadTimeDays: 3,
            notes: "Packed in moisture proof bags.",
          },
        ],
        subtotal: 239850,
        taxAmount: 0,
        netTotal: 239850,
        validUntil: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        deliveryTerms: "Free store delivery to main warehouse.",
        paymentTerms: "30 Days Credit",
        notes: "Includes promotional display stand free of charge.",
        status: "PENDING",
      },
      {
        supplierId: "sup_2",
        supplierName: "CBL Munchee Distributors",
        token: "bid_demo_cbl_token",
        submittedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        items: [
          {
            productId: "prod_tea_1",
            productName: "Dilmah Premium Ceylon Tea 400g",
            offeredQty: 250,
            unitCost: 740,
            discountPercent: 4,
            netUnitCost: 710.40,
            totalCost: 177600,
            leadTimeDays: 2,
            notes: "Immediate dispatch from regional depot.",
          },
          {
            productId: "prod_cin_1",
            productName: "Ceylon True Alba Cinnamon 100g",
            offeredQty: 100,
            unitCost: 640,
            discountPercent: 5,
            netUnitCost: 608,
            totalCost: 60800,
            leadTimeDays: 2,
            notes: "High aroma guaranteed.",
          },
        ],
        subtotal: 238400,
        taxAmount: 0,
        netTotal: 238400,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        deliveryTerms: "Doorstep delivery within 48 hours.",
        paymentTerms: "14 Days Credit",
        notes: "Best wholesale rate match guarantee.",
        status: "PENDING",
      },
    ],
    createdBy: "Procurement Manager",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  },
];

export async function GET(req: Request) {
  try {
    const context = await requireAuth();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const query: any = { businessId };
      if (status && status !== "ALL") {
        query.status = status;
      }
      if (search) {
        query.$or = [
          { rfqNumber: new RegExp(search, "i") },
          { title: new RegExp(search, "i") },
          { description: new RegExp(search, "i") },
          { "invitedSuppliers.supplierName": new RegExp(search, "i") },
        ];
      }

      let rfqs: any[] = await RequestForQuotation.find(query).sort({ createdAt: -1 }).lean();

      // Seed sample RFQ if database is empty
      if (rfqs.length === 0 && !search && (!status || status === "ALL")) {
        const suppliers = await Supplier.find({ businessId }).limit(3).lean();
        const products = await Product.find({ businessId }).limit(2).lean();

        if (suppliers.length > 0 && products.length > 0) {
          const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
          const seededNumber = `RFQ-${todayStr}-0001`;

          const seededItems = products.map((p) => ({
            productId: p._id,
            productName: p.name,
            sku: p.sku || "SKU-PROD",
            requestedQty: 100,
            unit: p.unit || "pcs",
            targetPrice: p.costPrice || 250,
            specifications: "Standard commercial quality with batch manufacturing seals.",
          }));

          const seededInvited = suppliers.map((s) => ({
            supplierId: s._id,
            supplierName: s.name,
            email: s.email || "",
            phone: s.phone || "0771234567",
            token: generateBidToken(),
            status: "INVITED" as const,
            invitedAt: new Date(),
          }));

          const seededDoc = await RequestForQuotation.create({
            businessId,
            rfqNumber: seededNumber,
            title: "Store General Merchandise Stock Replenishment",
            description: "Quarterly supplier price enquiry and lead-time competitive bidding.",
            requiredByDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            deadlineDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            status: "OPEN",
            items: seededItems,
            invitedSuppliers: seededInvited,
            bids: [],
            createdBy: context.username || "Procurement Manager",
          });

          rfqs = [seededDoc.toObject()];
        }
      }

      return NextResponse.json({
        success: true,
        rfqs,
      });
    }

    // Demo Mode Fallback
    let filtered = [...defaultDemoRfqs];
    if (status && status !== "ALL") {
      filtered = filtered.filter((r) => r.status === status);
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.rfqNumber.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          r.invitedSuppliers.some((s) => s.supplierName.toLowerCase().includes(q))
      );
    }

    return NextResponse.json({
      success: true,
      rfqs: filtered,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch quotation requests";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPER_ADMIN"]);

    const body = await req.json();
    const {
      title,
      description,
      requiredByDate,
      deadlineDate,
      items,
      supplierIds,
      sendSmsAlerts,
    } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ success: false, error: "RFQ title is required" }, { status: 400 });
    }
    if (!requiredByDate) {
      return NextResponse.json({ success: false, error: "Required delivery date is required" }, { status: 400 });
    }
    if (!deadlineDate) {
      return NextResponse.json({ success: false, error: "Quotation submission deadline is required" }, { status: 400 });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: "At least one product item is required" }, { status: 400 });
    }
    if (!Array.isArray(supplierIds) || supplierIds.length === 0) {
      return NextResponse.json({ success: false, error: "Please invite at least one supplier to bid" }, { status: 400 });
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      // 1. Generate sequential RFQ Number: RFQ-YYYYMMDD-XXXX
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const countToday = await RequestForQuotation.countDocuments({
        businessId,
        createdAt: { $gte: startOfDay, $lte: endOfDay },
      });
      const seqStr = String(countToday + 1).padStart(4, "0");
      const rfqNumber = `RFQ-${todayStr}-${seqStr}`;

      // 2. Resolve invited suppliers and ensure they each have a portalToken & bidToken
      const suppliers = await Supplier.find({
        businessId,
        _id: { $in: supplierIds.map((id: string) => new Types.ObjectId(id)) },
        isActive: true,
      });

      if (suppliers.length === 0) {
        return NextResponse.json({ success: false, error: "No valid active suppliers found for selected IDs" }, { status: 400 });
      }

      const invitedSuppliers = [];
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://pos.srilanka.lk";

      for (const s of suppliers) {
        if (!s.portalToken) {
          s.portalToken = generateVendorPortalToken();
          await s.save();
        }

        const bidToken = generateBidToken();
        invitedSuppliers.push({
          supplierId: s._id,
          supplierName: s.name,
          email: s.email || "",
          phone: s.phone,
          token: bidToken,
          status: "INVITED" as const,
          invitedAt: new Date(),
        });

        // 3. Optional SMS Dispatch to Supplier representative
        if (sendSmsAlerts && s.phone) {
          try {
            const portalUrl = `${baseUrl}/portal/vendor/${s.portalToken}?tab=rfq`;
            await dispatchSms({
              businessId: context.businessId,
              recipientPhone: s.phone,
              recipientName: s.name,
              eventType: "CUSTOM",
              message: `Dear ${s.name}, you are invited to submit a quotation for ${rfqNumber} ("${title.slice(0, 30)}..."). Please submit your best prices before ${new Date(deadlineDate).toLocaleDateString()}: ${portalUrl}`,
              metadata: { rfqNumber, type: "RFQ_INVITATION" },
            });
          } catch (smsErr) {
            console.error("Failed to send RFQ invitation SMS to supplier", s.name, smsErr);
          }
        }
      }

      // 4. Map line items
      const formattedItems = items.map((it: any) => ({
        productId: new Types.ObjectId(it.productId),
        productName: it.name || it.productName,
        sku: it.sku || "",
        requestedQty: Number(it.requestedQty || it.quantityOrdered || 1),
        unit: it.unit || "pcs",
        targetPrice: it.targetPrice ? Number(it.targetPrice) : undefined,
        specifications: it.specifications || "",
      }));

      // 5. Create RFQ document
      const rfq = await RequestForQuotation.create({
        businessId,
        rfqNumber,
        title: title.trim(),
        description: description?.trim() || "",
        requiredByDate: new Date(requiredByDate),
        deadlineDate: new Date(deadlineDate),
        status: "OPEN",
        items: formattedItems,
        invitedSuppliers,
        bids: [],
        createdBy: context.username || "Manager",
      });

      // 6. Record Audit Log
      await AuditLog.create({
        businessId,
        userId: context.userId,
        userName: context.username,
        action: "INVENTORY_ADJUSTED",
        entityType: "Product",
        entityId: rfq._id.toString(),
        details: { action: "RFQ_CREATED", rfqNumber, invitedCount: invitedSuppliers.length },
      });

      return NextResponse.json({
        success: true,
        rfq,
        message: `Quotation request ${rfqNumber} created and dispatched to ${invitedSuppliers.length} supplier(s).`,
      });
    }

    // Demo Mode Response
    const mockRfq = {
      _id: `demo_rfq_${Date.now()}`,
      rfqNumber: `RFQ-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-9999`,
      title: title.trim(),
      description: description?.trim() || "",
      requiredByDate: new Date(requiredByDate).toISOString(),
      deadlineDate: new Date(deadlineDate).toISOString(),
      status: "OPEN",
      items: items.map((it: any) => ({
        productId: it.productId || "prod_demo",
        productName: it.name || it.productName,
        sku: it.sku || "SKU-DEMO",
        requestedQty: Number(it.requestedQty || 1),
        unit: it.unit || "pcs",
        targetPrice: Number(it.targetPrice || 0),
        specifications: it.specifications || "",
      })),
      invitedSuppliers: supplierIds.map((id: string) => ({
        supplierId: id,
        supplierName: "Demo Supplier",
        email: "demo@supplier.lk",
        phone: "0771234567",
        token: `bid_${Date.now()}`,
        status: "INVITED",
        invitedAt: new Date().toISOString(),
      })),
      bids: [],
      createdBy: context.username || "Manager",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      rfq: mockRfq,
      message: `Quotation request created successfully.`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create quotation request";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
