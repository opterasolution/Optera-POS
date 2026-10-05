import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { PurchaseOrder } from "@/models/PurchaseOrder";
import { Supplier } from "@/models/Supplier";
import { requireAuth } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export interface EarlyDiscountOpportunity {
  purchaseOrderId: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  supplierInvoiceNumber?: string;
  receivedAt: string;
  netTotal: number;
  paidAmount: number;
  discountAmountTaken: number;
  totalDebtOffset: number;
  outstandingBalance: number;
  earlyPaymentDiscountPercentage: number;
  earlyPaymentDiscountDays: number;
  discountDeadline: string | null;
  eligibleDiscountAmount: number;
  hoursRemaining: number;
  daysRemaining: number;
  urgency: "EXPIRING_TODAY" | "URGENT" | "ACTIVE" | "EXPIRED" | "NO_DISCOUNT";
  potentialSavingsLkr: number;
  missedSavingsLkr: number;
  netSettlementAmountLkr: number;
  paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID";
}

export async function GET(req: Request) {
  try {
    const context = await requireAuth();
    const { searchParams } = new URL(req.url);

    const supplierId = searchParams.get("supplierId");
    const urgencyFilter = searchParams.get("urgency") || "ALL"; // ALL | EXPIRING_TODAY | URGENT | ACTIVE | EXPIRED
    const search = searchParams.get("q")?.trim() || "";

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const poQuery: any = {
        businessId,
        status: { $in: ["RECEIVED", "PARTIALLY_RECEIVED"] },
        paymentStatus: { $ne: "PAID" },
      };

      if (supplierId) {
        poQuery.supplierId = supplierId;
      }

      if (search) {
        poQuery.$or = [
          { poNumber: { $regex: search, $options: "i" } },
          { supplierName: { $regex: search, $options: "i" } },
          { supplierInvoiceNumber: { $regex: search, $options: "i" } },
        ];
      }

      const [pos, suppliers] = await Promise.all([
        PurchaseOrder.find(poQuery).sort({ discountDeadline: 1, receivedAt: -1 }).lean(),
        Supplier.find({ businessId, isActive: true }).lean(),
      ]);

      const supplierMap = new Map(suppliers.map((s) => [s._id.toString(), s]));
      const now = new Date();

      const opportunities: EarlyDiscountOpportunity[] = [];

      let totalEligibleBillsCount = 0;
      let totalPendingDebtLkr = 0;
      let totalPotentialDiscountSavingsLkr = 0;
      let expiringTodayCount = 0;
      let urgentCount = 0;
      let activeCount = 0;
      let expiredCount = 0;
      let missedSavingsLkr = 0;

      for (const po of pos) {
        const sup = supplierMap.get(po.supplierId.toString());
        const totalPaid = po.paidAmount || 0;
        const totalDiscountTaken = po.discountAmountTaken || 0;
        const totalOffset = po.totalDebtOffset || totalPaid + totalDiscountTaken;
        const outstanding = Math.max(0, po.netTotal - totalOffset);

        if (outstanding <= 0) continue;

        const discPct = po.earlyPaymentDiscountPercentage || sup?.earlyPaymentDiscountPercentage || 0;
        const discDays = po.earlyPaymentDiscountDays || sup?.earlyPaymentDiscountDays || 0;

        let deadline: Date | null = null;
        if (po.discountDeadline) {
          deadline = new Date(po.discountDeadline);
        } else if (discDays > 0) {
          const baseDate = po.receivedAt ? new Date(po.receivedAt) : new Date(po.createdAt);
          deadline = new Date(baseDate.getTime() + discDays * 86400000);
        }

        let hoursRemaining = 0;
        let daysRemaining = 0;
        let urgency: EarlyDiscountOpportunity["urgency"] = "NO_DISCOUNT";
        let potentialSavings = 0;
        let missedSavings = 0;

        if (deadline && discPct > 0) {
          const diffMs = deadline.getTime() - now.getTime();
          hoursRemaining = Math.round(diffMs / (1000 * 60 * 60));
          daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

          const calcDiscount = Math.round(outstanding * (discPct / 100));

          if (diffMs <= 0) {
            urgency = "EXPIRED";
            missedSavings = calcDiscount;
            expiredCount++;
            missedSavingsLkr += missedSavings;
          } else if (hoursRemaining <= 24) {
            urgency = "EXPIRING_TODAY";
            potentialSavings = calcDiscount;
            expiringTodayCount++;
            totalPotentialDiscountSavingsLkr += potentialSavings;
          } else if (daysRemaining <= 2) {
            urgency = "URGENT";
            potentialSavings = calcDiscount;
            urgentCount++;
            totalPotentialDiscountSavingsLkr += potentialSavings;
          } else {
            urgency = "ACTIVE";
            potentialSavings = calcDiscount;
            activeCount++;
            totalPotentialDiscountSavingsLkr += potentialSavings;
          }
        }

        totalEligibleBillsCount++;
        totalPendingDebtLkr += outstanding;

        const netSettlement = outstanding - potentialSavings;

        opportunities.push({
          purchaseOrderId: po._id.toString(),
          poNumber: po.poNumber,
          supplierId: po.supplierId.toString(),
          supplierName: po.supplierName,
          supplierInvoiceNumber: po.supplierInvoiceNumber,
          receivedAt: (po.receivedAt || po.createdAt).toISOString(),
          netTotal: po.netTotal,
          paidAmount: totalPaid,
          discountAmountTaken: totalDiscountTaken,
          totalDebtOffset: totalOffset,
          outstandingBalance: outstanding,
          earlyPaymentDiscountPercentage: discPct,
          earlyPaymentDiscountDays: discDays,
          discountDeadline: deadline ? deadline.toISOString() : null,
          eligibleDiscountAmount: Math.round(outstanding * (discPct / 100)),
          hoursRemaining,
          daysRemaining,
          urgency,
          potentialSavingsLkr: potentialSavings,
          missedSavingsLkr: missedSavings,
          netSettlementAmountLkr: netSettlement,
          paymentStatus: (po.paymentStatus || (totalOffset > 0 ? "PARTIALLY_PAID" : "UNPAID")) as any,
        });
      }

      // Filter by urgency if requested
      const filtered = opportunities.filter((op) => {
        if (urgencyFilter === "ALL") return true;
        return op.urgency === urgencyFilter;
      });

      return NextResponse.json({
        success: true,
        summary: {
          totalEligibleBillsCount,
          totalPendingDebtLkr,
          totalPotentialDiscountSavingsLkr,
          expiringTodayCount,
          urgentCount,
          activeCount,
          expiredCount,
          missedSavingsLkr,
        },
        discounts: filtered,
      });
    }

    // Demo Mode Realistic Data
    const now = new Date();
    const todayEnd = new Date(now.getTime() + 14 * 60 * 60 * 1000); // 14 hours
    const twoDaysEnd = new Date(now.getTime() + 42 * 60 * 60 * 1000); // 42 hours
    const sixDaysEnd = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);
    const sevenDaysEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const expiredDate = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);

    const demoOpportunities: EarlyDiscountOpportunity[] = [
      {
        purchaseOrderId: "demo_po_01",
        poNumber: "PO-20261003-0012",
        supplierId: "demo_sup_01",
        supplierName: "Unilever Sri Lanka Ltd",
        supplierInvoiceNumber: "INV-UNI-8849",
        receivedAt: new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000).toISOString(),
        netTotal: 140000,
        paidAmount: 0,
        discountAmountTaken: 0,
        totalDebtOffset: 0,
        outstandingBalance: 140000,
        earlyPaymentDiscountPercentage: 2,
        earlyPaymentDiscountDays: 10,
        discountDeadline: todayEnd.toISOString(),
        eligibleDiscountAmount: 2800,
        hoursRemaining: 14,
        daysRemaining: 1,
        urgency: "EXPIRING_TODAY",
        potentialSavingsLkr: 2800,
        missedSavingsLkr: 0,
        netSettlementAmountLkr: 137200,
        paymentStatus: "UNPAID",
      },
      {
        purchaseOrderId: "demo_po_02",
        poNumber: "PO-20261002-0008",
        supplierId: "demo_sup_02",
        supplierName: "CBL Munchee Distributors",
        supplierInvoiceNumber: "INV-CBL-4421",
        receivedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        netTotal: 85000,
        paidAmount: 0,
        discountAmountTaken: 0,
        totalDebtOffset: 0,
        outstandingBalance: 85000,
        earlyPaymentDiscountPercentage: 3,
        earlyPaymentDiscountDays: 7,
        discountDeadline: twoDaysEnd.toISOString(),
        eligibleDiscountAmount: 2550,
        hoursRemaining: 42,
        daysRemaining: 2,
        urgency: "URGENT",
        potentialSavingsLkr: 2550,
        missedSavingsLkr: 0,
        netSettlementAmountLkr: 82450,
        paymentStatus: "UNPAID",
      },
      {
        purchaseOrderId: "demo_po_03",
        poNumber: "PO-20260930-0005",
        supplierId: "demo_sup_03",
        supplierName: "Maliban Biscuit Manufactories",
        supplierInvoiceNumber: "INV-MLB-9022",
        receivedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        netTotal: 62000,
        paidAmount: 0,
        discountAmountTaken: 0,
        totalDebtOffset: 0,
        outstandingBalance: 62000,
        earlyPaymentDiscountPercentage: 2.5,
        earlyPaymentDiscountDays: 10,
        discountDeadline: sixDaysEnd.toISOString(),
        eligibleDiscountAmount: 1550,
        hoursRemaining: 144,
        daysRemaining: 6,
        urgency: "ACTIVE",
        potentialSavingsLkr: 1550,
        missedSavingsLkr: 0,
        netSettlementAmountLkr: 60450,
        paymentStatus: "UNPAID",
      },
      {
        purchaseOrderId: "demo_po_04",
        poNumber: "PO-20260929-0002",
        supplierId: "demo_sup_04",
        supplierName: "Hemas Manufacturing Ltd",
        supplierInvoiceNumber: "INV-HMS-3011",
        receivedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        netTotal: 110000,
        paidAmount: 0,
        discountAmountTaken: 0,
        totalDebtOffset: 0,
        outstandingBalance: 110000,
        earlyPaymentDiscountPercentage: 2,
        earlyPaymentDiscountDays: 10,
        discountDeadline: sevenDaysEnd.toISOString(),
        eligibleDiscountAmount: 2200,
        hoursRemaining: 168,
        daysRemaining: 7,
        urgency: "ACTIVE",
        potentialSavingsLkr: 2200,
        missedSavingsLkr: 0,
        netSettlementAmountLkr: 107800,
        paymentStatus: "UNPAID",
      },
      {
        purchaseOrderId: "demo_po_05",
        poNumber: "PO-20260915-0001",
        supplierId: "demo_sup_05",
        supplierName: "Ceylon Tobacco Company",
        supplierInvoiceNumber: "INV-CTC-1109",
        receivedAt: new Date(now.getTime() - 19 * 24 * 60 * 60 * 1000).toISOString(),
        netTotal: 220000,
        paidAmount: 0,
        discountAmountTaken: 0,
        totalDebtOffset: 0,
        outstandingBalance: 220000,
        earlyPaymentDiscountPercentage: 1.5,
        earlyPaymentDiscountDays: 7,
        discountDeadline: expiredDate.toISOString(),
        eligibleDiscountAmount: 3300,
        hoursRemaining: -96,
        daysRemaining: -4,
        urgency: "EXPIRED",
        potentialSavingsLkr: 0,
        missedSavingsLkr: 3300,
        netSettlementAmountLkr: 220000,
        paymentStatus: "UNPAID",
      },
    ];

    const filtered = demoOpportunities.filter((op) => {
      if (urgencyFilter === "ALL") return true;
      return op.urgency === urgencyFilter;
    });

    return NextResponse.json({
      success: true,
      summary: {
        totalEligibleBillsCount: 5,
        totalPendingDebtLkr: 617000,
        totalPotentialDiscountSavingsLkr: 9100, // 2800 + 2550 + 1550 + 2200
        expiringTodayCount: 1,
        urgentCount: 1,
        activeCount: 2,
        expiredCount: 1,
        missedSavingsLkr: 3300,
      },
      discounts: filtered,
    });
  } catch (error: any) {
    console.error("GET /api/purchases/early-discounts error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch early settlement discounts" },
      { status: error.status || 500 }
    );
  }
}
