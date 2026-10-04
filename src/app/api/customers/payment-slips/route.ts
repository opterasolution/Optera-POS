import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { CustomerPaymentSlip } from "@/models/CustomerPaymentSlip";
import { Customer } from "@/models/Customer";
import { CreditTransaction } from "@/models/CreditTransaction";
import { requireAuth, requireRole } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const context = await requireAuth();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status")?.trim();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const query: any = { businessId: context.businessId };
      if (status && status !== "ALL") {
        query.status = status;
      }

      const slips = await CustomerPaymentSlip.find(query)
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

      return NextResponse.json({ success: true, slips });
    }

    // Demo Mode Fallback
    return NextResponse.json({
      success: true,
      slips: [
        {
          _id: "demo_slip_1",
          slipNumber: "SLIP-20261002-0003",
          customerId: "demo_cust_sunil",
          customerName: "Sunil Perera (Perera Caterers)",
          customerPhone: "0771234567",
          amount: 15000,
          depositBank: "Bank of Ceylon (BOC)",
          depositAccount: "8472910472",
          payerBank: "Commercial Bank of Ceylon",
          transactionReference: "BOC-TXN-90214",
          paymentDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          status: "PENDING",
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPERVISOR", "ACCOUNTANT"]);
    const body = await req.json();
    const { slipId, action, rejectionReason } = body;

    if (!slipId) {
      return NextResponse.json(
        { success: false, error: "Slip ID is required" },
        { status: 400 }
      );
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const slip = await CustomerPaymentSlip.findOne({
        _id: slipId,
        businessId: context.businessId,
      });

      if (!slip) {
        return NextResponse.json(
          { success: false, error: "Payment slip not found" },
          { status: 404 }
        );
      }

      if (slip.status !== "PENDING") {
        return NextResponse.json(
          { success: false, error: `Slip is already ${slip.status}` },
          { status: 400 }
        );
      }

      const customer = await Customer.findById(slip.customerId);
      if (!customer) {
        return NextResponse.json(
          { success: false, error: "Associated customer not found" },
          { status: 404 }
        );
      }

      if (action === "APPROVE") {
        const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const balanceBefore = customer.currentBalance || 0;
        const balanceAfter = Math.max(0, balanceBefore - slip.amount);

        customer.currentBalance = balanceAfter;
        await customer.save();

        const count = await CreditTransaction.countDocuments({ businessId: context.businessId });
        const txNumber = `CR-PAY-${todayStr}-${String(count + 1).padStart(4, "0")}`;

        const creditTx = await CreditTransaction.create({
          businessId: context.businessId,
          customerId: customer._id,
          transactionNumber: txNumber,
          type: "PAYMENT",
          amount: slip.amount,
          balanceBefore,
          balanceAfter,
          paymentMethod: "BANK_TRANSFER",
          paymentReference: slip.transactionReference,
          notes: `Bank deposit verified: ${slip.depositBank} Ref #${slip.transactionReference} (${slip.slipNumber})`,
          performedBy: context.username || "Merchant",
        });

        slip.status = "APPROVED";
        slip.verifiedBy = context.username || "Merchant";
        slip.verifiedAt = new Date();
        slip.creditTransactionId = creditTx._id;
        await slip.save();

        return NextResponse.json({
          success: true,
          message: `Payment of Rs. ${slip.amount.toLocaleString()} approved! Customer balance reduced from Rs. ${balanceBefore.toLocaleString()} to Rs. ${balanceAfter.toLocaleString()}.`,
          slip,
        });
      }

      if (action === "REJECT") {
        slip.status = "REJECTED";
        slip.verifiedBy = context.username || "Merchant";
        slip.verifiedAt = new Date();
        slip.rejectionReason = rejectionReason || "Bank deposit could not be verified on statement.";
        await slip.save();

        return NextResponse.json({
          success: true,
          message: `Payment slip ${slip.slipNumber} marked as rejected.`,
          slip,
        });
      }

      return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Demo payment slip processed successfully.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
