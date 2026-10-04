import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Customer } from "@/models/Customer";
import { CustomerPaymentSlip } from "@/models/CustomerPaymentSlip";

/**
 * Public Customer Bank Deposit Slip API
 * Allows credit / corporate customers to submit payment proofs (CEFT, LankaPay, Cheque)
 * with reference numbers and optional slip images directly to the store for verification.
 */
export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token")?.trim();

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Missing customer portal token" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const {
      amount,
      depositBank,
      depositAccount,
      payerBank,
      transactionReference,
      paymentDate,
      slipImageUrl,
      notes,
    } = body;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid payment amount." },
        { status: 400 }
      );
    }

    if (!depositBank?.trim()) {
      return NextResponse.json(
        { success: false, error: "Please select the deposit bank account." },
        { status: 400 }
      );
    }

    if (!transactionReference?.trim()) {
      return NextResponse.json(
        { success: false, error: "Please enter the transaction reference or cheque number." },
        { status: 400 }
      );
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const customer = await Customer.findOne({ portalToken: token });
      if (!customer) {
        return NextResponse.json(
          { success: false, error: "Invalid or expired portal token" },
          { status: 404 }
        );
      }

      // Generate slip number: SLIP-YYYYMMDD-XXXX
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const count = await CustomerPaymentSlip.countDocuments({
        businessId: customer.businessId,
        slipNumber: new RegExp(`^SLIP-${todayStr}`),
      });
      const slipNumber = `SLIP-${todayStr}-${String(count + 1).padStart(4, "0")}`;

      const slip = await CustomerPaymentSlip.create({
        businessId: customer.businessId,
        customerId: customer._id,
        customerName: customer.name,
        customerPhone: customer.phone,
        slipNumber,
        amount: numAmount,
        depositBank: depositBank.trim(),
        depositAccount: depositAccount?.trim() || "",
        payerBank: payerBank?.trim() || "",
        transactionReference: transactionReference.trim(),
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        slipImageUrl: slipImageUrl?.trim() || "",
        notes: notes?.trim() || "",
        status: "PENDING",
      });

      return NextResponse.json({
        success: true,
        message: `Payment notification ${slipNumber} for Rs. ${numAmount.toLocaleString()} submitted successfully. Our accounts team will verify and credit your ledger.`,
        slip,
      });
    }

    // Demo Mode Fallback Response
    const demoSlipNumber = `SLIP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-0018`;
    return NextResponse.json({
      success: true,
      message: `Demo payment notification ${demoSlipNumber} submitted successfully!`,
      slip: {
        _id: "demo_slip_created",
        slipNumber: demoSlipNumber,
        amount: numAmount,
        depositBank,
        transactionReference,
        status: "PENDING",
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
