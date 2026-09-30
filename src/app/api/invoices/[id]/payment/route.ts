import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Sale } from "@/models/Sale";
import { Customer } from "@/models/Customer";
import { CreditTransaction } from "@/models/CreditTransaction";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth, verifyActiveSubscription } from "@/lib/tenant";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireAuth();
    await verifyActiveSubscription(context.businessId);

    const body = await req.json();
    const { amount, paymentMethod = "CASH", paymentReference, notes } = body;

    const paymentAmount = Number(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Payment amount must be greater than zero." },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const businessId = context.businessId;

    const sale = await Sale.findOne({
      _id: params.id,
      businessId,
    });

    if (!sale) {
      return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
    }

    const currentBalanceDue = sale.balanceDue !== undefined ? sale.balanceDue : (sale.isCreditSale ? sale.netTotal : 0);
    if (currentBalanceDue <= 0) {
      return NextResponse.json(
        { success: false, error: "This invoice is already fully paid." },
        { status: 400 }
      );
    }

    if (paymentAmount > currentBalanceDue) {
      return NextResponse.json(
        {
          success: false,
          error: `Payment amount (Rs. ${paymentAmount.toFixed(2)}) exceeds remaining balance due (Rs. ${currentBalanceDue.toFixed(2)}).`,
        },
        { status: 400 }
      );
    }

    const newAmountPaid = (sale.amountPaid || 0) + paymentAmount;
    const newBalanceDue = Math.max(0, Math.round((currentBalanceDue - paymentAmount) * 100) / 100);
    const newPaymentStatus = newBalanceDue <= 0 ? "PAID" : "PARTIAL";

    sale.amountPaid = newAmountPaid;
    sale.balanceDue = newBalanceDue;
    sale.paymentStatus = newPaymentStatus;
    if (paymentReference) sale.paymentReference = paymentReference;
    await sale.save();

    // If customer linked, deduct customer current balance and create CreditTransaction
    if (sale.customerId) {
      const customer = await Customer.findOne({ _id: sale.customerId, businessId });
      if (customer) {
        const prevBal = customer.currentBalance;
        customer.currentBalance = Math.max(0, prevBal - paymentAmount);
        await customer.save();

        const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const txnNumber = `CR-PAY-${todayStr}-${String(Date.now()).slice(-4)}`;
        await CreditTransaction.create({
          businessId,
          customerId: customer._id,
          saleId: sale._id,
          type: "PAYMENT_RECEIVED",
          transactionNumber: txnNumber,
          amount: paymentAmount,
          previousBalance: prevBal,
          newBalance: customer.currentBalance,
          paymentMethod,
          paymentReference,
          notes: notes || `Settlement on invoice ${sale.invoiceNumber}`,
          recordedBy: context.username || "Staff",
        });
      }
    }

    // Audit Log
    await AuditLog.create({
      businessId,
      userId: context.userId,
      userName: context.username,
      action: "INVOICE_PAYMENT_RECORDED",
      entityType: "Sale",
      entityId: sale._id.toString(),
      details: {
        invoiceNumber: sale.invoiceNumber,
        paymentAmount,
        remainingBalance: newBalanceDue,
        paymentStatus: newPaymentStatus,
        paymentMethod,
        paymentReference,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Payment of Rs. ${paymentAmount.toFixed(2)} recorded on invoice ${sale.invoiceNumber}.`,
      sale,
    });
  } catch (error: any) {
    console.error("POST /api/invoices/[id]/payment error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to record payment" },
      { status: error.status || 500 }
    );
  }
}
