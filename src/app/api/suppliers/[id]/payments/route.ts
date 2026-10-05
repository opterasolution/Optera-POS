import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Supplier } from "@/models/Supplier";
import { SupplierPayment } from "@/models/SupplierPayment";
import { PurchaseOrder } from "@/models/PurchaseOrder";
import { SupplierDebitNote } from "@/models/SupplierDebitNote";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth, requireRole } from "@/lib/tenant";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireAuth();
    const { id } = params;

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const supplier = await Supplier.findOne({ _id: id, businessId }).lean();
      if (!supplier) {
        return NextResponse.json({ success: false, error: "Supplier not found." }, { status: 404 });
      }

      // Fetch all bills inward (POs received), payments made, and applied debit notes
      const [pos, payments, debitNotes] = await Promise.all([
        PurchaseOrder.find({
          businessId,
          supplierId: id,
          status: { $in: ["RECEIVED", "PARTIALLY_RECEIVED"] },
        }).lean(),
        SupplierPayment.find({
          businessId,
          supplierId: id,
        }).lean(),
        SupplierDebitNote.find({
          businessId,
          supplierId: id,
          status: "APPLIED",
          settlementType: "AP_CREDIT_OFFSET",
        }).lean(),
      ]);

      // Combine into unified chronological ledger
      interface LedgerEntry {
        id: string;
        date: Date;
        ref: string;
        type: "BILL_INWARD" | "PAYMENT_VOUCHER" | "DEBIT_NOTE";
        description: string;
        billAmount?: number;
        paidAmount?: number;
        paymentMethod?: string;
        chequeNumber?: string;
      }

      const entries: LedgerEntry[] = [];

      pos.forEach((po) => {
        entries.push({
          id: po._id.toString(),
          date: po.receivedAt || po.createdAt,
          ref: po.poNumber,
          type: "BILL_INWARD",
          description: `Goods Received${po.supplierInvoiceNumber ? ` (Inv: ${po.supplierInvoiceNumber})` : ""}`,
          billAmount: po.netTotal,
        });
      });

      payments.forEach((pv) => {
        entries.push({
          id: pv._id.toString(),
          date: pv.createdAt,
          ref: pv.paymentNumber,
          type: "PAYMENT_VOUCHER",
          description: `Payment via ${pv.paymentMethod}${pv.chequeNumber ? ` (Chq: ${pv.chequeNumber})` : ""}`,
          paidAmount: pv.amount,
          paymentMethod: pv.paymentMethod,
          chequeNumber: pv.chequeNumber,
        });
      });

      debitNotes.forEach((dn) => {
        entries.push({
          id: dn._id.toString(),
          date: dn.settledAt || dn.createdAt,
          ref: dn.debitNoteNumber,
          type: "DEBIT_NOTE",
          description: `Debit Note: Return of Damaged/Expired Stock${dn.distributorCreditNoteNumber ? ` (CN: ${dn.distributorCreditNoteNumber})` : ""}`,
          paidAmount: dn.netTotal,
          paymentMethod: "DEBIT_NOTE",
        });
      });

      // Sort chronologically ascending to compute running balance
      entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      let running = 0;
      const ledgerWithBalance = entries.map((e) => {
        if (e.billAmount) running += e.billAmount;
        if (e.paidAmount) running = Math.max(0, running - e.paidAmount);
        return {
          ...e,
          runningBalance: running,
        };
      });

      // Reverse for newest-first display
      ledgerWithBalance.reverse();

      return NextResponse.json({
        success: true,
        supplierName: supplier.name,
        currentBalance: supplier.currentBalance,
        creditLimit: supplier.creditLimit,
        paymentTermsDays: supplier.paymentTermsDays,
        statement: ledgerWithBalance,
      });
    }

    return NextResponse.json({
      success: true,
      supplierName: "Demo Supplier",
      currentBalance: 0,
      statement: [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch supplier statement" },
      { status: error.status || 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPER_ADMIN"]);
    const { id } = params;
    const body = await req.json();

    const {
      amount,
      paymentMethod = "CHEQUE",
      chequeNumber,
      chequeDate,
      bankName,
      referenceNumber,
      purchaseOrderId,
      notes,
    } = body;

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      return NextResponse.json(
        { success: false, error: "Payment amount must be greater than zero." },
        { status: 400 }
      );
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const supplier = await Supplier.findOne({ _id: id, businessId });
      if (!supplier) {
        return NextResponse.json({ success: false, error: "Supplier not found." }, { status: 404 });
      }

      // Generate sequential Payment Voucher: PV-YYYYMMDD-XXXX
      const now = new Date();
      const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const countToday = await SupplierPayment.countDocuments({
        businessId,
        createdAt: { $gte: startOfDay },
      });
      const seq = (countToday + 1).toString().padStart(4, "0");
      const paymentNumber = `PV-${datePart}-${seq}`;

      const balanceBefore = supplier.currentBalance || 0;
      const balanceAfter = Math.max(0, balanceBefore - amt);

      let poNumber: string | undefined;
      if (purchaseOrderId) {
        const po = await PurchaseOrder.findOne({ _id: purchaseOrderId, businessId });
        poNumber = po?.poNumber;
      }

      const payment = await SupplierPayment.create({
        businessId,
        paymentNumber,
        supplierId: supplier._id,
        supplierName: supplier.name,
        amount: amt,
        balanceBefore,
        balanceAfter,
        paymentMethod,
        chequeNumber: chequeNumber?.trim() || undefined,
        chequeDate: chequeDate ? new Date(chequeDate) : undefined,
        bankName: bankName?.trim() || undefined,
        referenceNumber: referenceNumber?.trim() || undefined,
        purchaseOrderId: purchaseOrderId || undefined,
        poNumber,
        notes: notes?.trim() || undefined,
        paidBy: context.username || "Accountant",
      });

      // Update supplier's live payable balance
      supplier.currentBalance = balanceAfter;
      await supplier.save();

      await AuditLog.create({
        businessId,
        action: "SUPPLIER_PAYMENT_RECORDED",
        entity: "SUPPLIER_PAYMENT",
        entityId: payment._id.toString(),
        userId: context.userId,
        details: {
          paymentNumber,
          supplierName: supplier.name,
          amount: amt,
          method: paymentMethod,
          balanceBefore,
          balanceAfter,
        },
      });

      return NextResponse.json({
        success: true,
        payment,
        supplier: {
          _id: supplier._id,
          name: supplier.name,
          previousBalance: balanceBefore,
          currentBalance: balanceAfter,
        },
        message: `Payment of Rs. ${amt.toLocaleString()} recorded for ${supplier.name} (${paymentNumber}).`,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Demo: Payment voucher recorded.",
    });
  } catch (error: any) {
    console.error("Error recording supplier payment:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to record payment" },
      { status: error.status || 500 }
    );
  }
}
