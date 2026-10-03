import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Supplier, generateVendorPortalToken } from "@/models/Supplier";
import { Business } from "@/models/Business";
import { PurchaseOrder } from "@/models/PurchaseOrder";
import { RequestForQuotation } from "@/models/RequestForQuotation";
import { GoodsReceivedNote } from "@/models/GoodsReceivedNote";
import { SupplierPayment } from "@/models/SupplierPayment";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token")?.trim();

    if (!token) {
      return NextResponse.json({ success: false, error: "Supplier portal access token is required" }, { status: 400 });
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      // 1. Find supplier by portalToken
      let supplier = await Supplier.findOne({ portalToken: token, isActive: true }).lean();

      // If token not matched directly, check if it is a specific RFQ invitation token
      let specificRfqId: string | null = null;
      if (!supplier) {
        const matchedRfq = await RequestForQuotation.findOne({ "invitedSuppliers.token": token }).lean();
        if (matchedRfq) {
          const invitedEntry = matchedRfq.invitedSuppliers.find((inv) => inv.token === token);
          if (invitedEntry) {
            supplier = await Supplier.findById(invitedEntry.supplierId).lean();
            specificRfqId = matchedRfq._id.toString();
          }
        }
      }

      if (!supplier) {
        return NextResponse.json({ success: false, error: "Invalid or expired vendor portal access token" }, { status: 404 });
      }

      const businessId = supplier.businessId;

      // 2. Fetch Business details
      const business = await Business.findById(businessId).lean();

      // 3. Fetch Purchase Orders for this supplier
      const purchaseOrders = await PurchaseOrder.find({
        businessId,
        supplierId: supplier._id,
      })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      // 4. Fetch RFQs where this supplier is invited
      const allRfqs = await RequestForQuotation.find({
        businessId,
        "invitedSuppliers.supplierId": supplier._id,
      })
        .sort({ createdAt: -1 })
        .limit(30)
        .lean();

      // Format RFQs to include this supplier's specific invitation & bid data
      const rfqs = allRfqs.map((rfq) => {
        const invitation = rfq.invitedSuppliers.find(
          (inv) => inv.supplierId.toString() === supplier!._id.toString()
        );
        const myBid = rfq.bids.find(
          (b) => b.supplierId.toString() === supplier!._id.toString()
        );

        return {
          _id: rfq._id,
          rfqNumber: rfq.rfqNumber,
          title: rfq.title,
          description: rfq.description,
          requiredByDate: rfq.requiredByDate,
          deadlineDate: rfq.deadlineDate,
          status: rfq.status,
          items: rfq.items,
          myInvitationStatus: invitation?.status || "INVITED",
          myBidToken: invitation?.token || "",
          myBid: myBid || null,
          awardedToMe: rfq.awardedSupplierId?.toString() === supplier!._id.toString(),
          awardedPoNumber: rfq.awardedPoNumber,
          createdAt: rfq.createdAt,
        };
      });

      // 5. Fetch Goods Received Notes (GRN) dock inspection records
      const grns = await GoodsReceivedNote.find({
        businessId,
        supplierId: supplier._id,
      })
        .sort({ createdAt: -1 })
        .limit(30)
        .lean();

      // 6. Fetch Payment Vouchers / Ledger
      const vouchers = await SupplierPayment.find({
        businessId,
        supplierId: supplier._id,
      })
        .sort({ paymentDate: -1 })
        .limit(50)
        .lean();

      return NextResponse.json({
        success: true,
        data: {
          supplier: {
            _id: supplier._id,
            name: supplier.name,
            code: supplier.code,
            contactPerson: supplier.contactPerson,
            phone: supplier.phone,
            email: supplier.email,
            address: supplier.address,
            taxNumber: supplier.taxNumber,
            paymentTermsDays: supplier.paymentTermsDays,
            creditLimit: supplier.creditLimit,
            currentBalance: supplier.currentBalance,
            portalToken: supplier.portalToken,
          },
          business: {
            name: business?.name || "Sri Lanka Store POS",
            phone: business?.phone || "",
            email: business?.email || "",
            address: business?.address || "",
            taxNumber: (business?.taxSettings as any)?.tin || (business?.taxSettings as any)?.vatNumber || "",
            currency: business?.currency || "LKR",
            logo: business?.logo,
          },
          purchaseOrders,
          rfqs,
          grns,
          vouchers,
          targetRfqId: specificRfqId,
        },
      });
    }

    // Demo Mode Fallback Response
    return NextResponse.json({
      success: true,
      data: {
        supplier: {
          _id: "demo_sup_unilever",
          name: "Unilever Sri Lanka Ltd",
          code: "SUP-UNI",
          contactPerson: "Rohan De Silva",
          phone: "0771122334",
          email: "orders@unilever.lk",
          address: "Commercial Area, Colombo 10",
          taxNumber: "VAT-10928374",
          paymentTermsDays: 30,
          creditLimit: 500000,
          currentBalance: 145000,
          portalToken: token,
        },
        business: {
          name: "Kandy Super Grocers",
          phone: "0812233445",
          email: "procurement@kandysuper.lk",
          address: "No. 45, Peradeniya Road, Kandy",
          taxNumber: "TIN-89372183",
          currency: "LKR",
        },
        purchaseOrders: [
          {
            _id: "demo_po_1",
            poNumber: "PO-20261001-0001",
            supplierName: "Unilever Sri Lanka Ltd",
            branchName: "Kandy Main Warehouse",
            status: "SENT",
            items: [
              {
                productId: "prod_tea_1",
                name: "Dilmah Premium Ceylon Tea 400g",
                unit: "packs",
                quantityOrdered: 250,
                quantityReceived: 0,
                unitCost: 715.40,
                total: 178850,
              },
            ],
            subtotal: 178850,
            taxTotal: 0,
            netTotal: 178850,
            expectedDeliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
            vendorAcknowledgement: {
              status: "PENDING",
            },
            createdAt: new Date().toISOString(),
          },
        ],
        rfqs: [
          {
            _id: "demo_rfq_1",
            rfqNumber: "RFQ-20261001-0001",
            title: "Q4 High-Demand Ceylon Tea & Spices Replenishment",
            description: "Annual competitive e-bidding for premium BOPF Ceylon tea packs.",
            requiredByDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            deadlineDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
            status: "OPEN",
            items: [
              {
                productId: "prod_tea_1",
                productName: "Dilmah Premium Ceylon Tea 400g",
                requestedQty: 250,
                unit: "packs",
                targetPrice: 750,
                specifications: "Export quality foil wrapped sealed cartons.",
              },
            ],
            myInvitationStatus: "SUBMITTED",
            myBidToken: "bid_demo_token",
            myBid: {
              subtotal: 178850,
              netTotal: 178850,
              deliveryTerms: "Free store delivery to main warehouse.",
              paymentTerms: "30 Days Credit",
              status: "PENDING",
            },
            awardedToMe: false,
            createdAt: new Date().toISOString(),
          },
        ],
        grns: [
          {
            _id: "demo_grn_1",
            grnNumber: "GRN-20260928-0001",
            poNumber: "PO-20260920-0004",
            supplierName: "Unilever Sri Lanka Ltd",
            inspectionStatus: "PASSED",
            totalAcceptedCost: 125000,
            totalRejectedCost: 0,
            createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
        vouchers: [
          {
            _id: "demo_vouch_1",
            voucherNumber: "PV-20260925-0001",
            amount: 80000,
            paymentMethod: "CHEQUE",
            chequeNumber: "CHQ-982143",
            paymentDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
            status: "COMPLETED",
          },
        ],
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load supplier portal";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
