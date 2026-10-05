import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { BankCheque } from "@/models/BankCheque";
import { Customer } from "@/models/Customer";
import { Supplier } from "@/models/Supplier";
import { CreditTransaction } from "@/models/CreditTransaction";
import { SupplierPayment } from "@/models/SupplierPayment";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const context = await requireAuth();
    const { searchParams } = new URL(req.url);

    const direction = searchParams.get("direction"); // INWARD | OUTWARD | ALL
    const status = searchParams.get("status"); // RECEIVED | DEPOSITED | REALIZED | RETURNED | CANCELLED
    const isPdc = searchParams.get("isPdc");
    const timeline = searchParams.get("timeline"); // DUE_TODAY | DUE_WEEK | OVERDUE
    const search = searchParams.get("search")?.trim();
    const partyId = searchParams.get("partyId");

    await connectToDatabase();
    const businessId = new Types.ObjectId(context.businessId);

    const query: any = { businessId };

    if (direction && direction !== "ALL") {
      query.direction = direction;
    }

    if (status && status !== "ALL") {
      query.status = status;
    }

    if (isPdc === "true") {
      query.isPdc = true;
    } else if (isPdc === "false") {
      query.isPdc = false;
    }

    if (partyId) {
      query.partyId = new Types.ObjectId(partyId);
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59, 999);

    if (timeline === "DUE_TODAY") {
      query.chequeDate = { $gte: startOfToday, $lte: endOfToday };
      query.status = { $in: ["RECEIVED", "DEPOSITED"] };
    } else if (timeline === "DUE_WEEK") {
      query.chequeDate = { $gte: startOfToday, $lte: endOfWeek };
      query.status = { $in: ["RECEIVED", "DEPOSITED"] };
    } else if (timeline === "OVERDUE") {
      query.chequeDate = { $lt: startOfToday };
      query.status = "RECEIVED";
    }

    if (search) {
      query.$or = [
        { chequeNumber: { $regex: search, $options: "i" } },
        { partyName: { $regex: search, $options: "i" } },
        { drawerName: { $regex: search, $options: "i" } },
        { payeeName: { $regex: search, $options: "i" } },
        { bankName: { $regex: search, $options: "i" } },
        { bankBranch: { $regex: search, $options: "i" } },
      ];
    }

    const cheques = await BankCheque.find(query).sort({ chequeDate: 1, createdAt: -1 }).lean();

    // Calculate executive KPIs across this business
    const allCheques = await BankCheque.find({ businessId }).lean();

    const metrics = {
      inward: {
        inHandCount: 0,
        inHandTotal: 0,
        pdcPendingCount: 0,
        pdcPendingTotal: 0,
        depositedCount: 0,
        depositedTotal: 0,
        realizedCount: 0,
        realizedTotal: 0,
        returnedCount: 0,
        returnedTotal: 0,
        dueTodayCount: 0,
        dueTodayTotal: 0,
      },
      outward: {
        issuedCount: 0,
        issuedTotal: 0,
        pdcPendingCount: 0,
        pdcPendingTotal: 0,
        realizedCount: 0,
        realizedTotal: 0,
        returnedCount: 0,
        returnedTotal: 0,
      },
    };

    allCheques.forEach((c) => {
      const cDate = new Date(c.chequeDate);
      const isMatured = cDate <= endOfToday;
      const isDueToday = cDate >= startOfToday && cDate <= endOfToday;

      if (c.direction === "INWARD") {
        if (c.status === "RECEIVED") {
          metrics.inward.inHandCount += 1;
          metrics.inward.inHandTotal += c.amount;

          if (c.isPdc && !isMatured) {
            metrics.inward.pdcPendingCount += 1;
            metrics.inward.pdcPendingTotal += c.amount;
          }

          if (isDueToday) {
            metrics.inward.dueTodayCount += 1;
            metrics.inward.dueTodayTotal += c.amount;
          }
        } else if (c.status === "DEPOSITED") {
          metrics.inward.depositedCount += 1;
          metrics.inward.depositedTotal += c.amount;
        } else if (c.status === "REALIZED") {
          metrics.inward.realizedCount += 1;
          metrics.inward.realizedTotal += c.amount;
        } else if (c.status === "RETURNED") {
          metrics.inward.returnedCount += 1;
          metrics.inward.returnedTotal += c.amount;
        }
      } else {
        // OUTWARD
        if (c.status === "RECEIVED") {
          metrics.outward.issuedCount += 1;
          metrics.outward.issuedTotal += c.amount;

          if (c.isPdc && !isMatured) {
            metrics.outward.pdcPendingCount += 1;
            metrics.outward.pdcPendingTotal += c.amount;
          }
        } else if (c.status === "REALIZED") {
          metrics.outward.realizedCount += 1;
          metrics.outward.realizedTotal += c.amount;
        } else if (c.status === "RETURNED") {
          metrics.outward.returnedCount += 1;
          metrics.outward.returnedTotal += c.amount;
        }
      }
    });

    return NextResponse.json({
      success: true,
      cheques,
      metrics,
      totalCount: cheques.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch cheques." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireAuth();
    const body = await req.json();

    const {
      direction = "INWARD",
      chequeNumber,
      bankName,
      bankBranch = "Main Branch",
      bankCode,
      accountNumber,
      drawerName,
      payeeName,
      amount,
      chequeDate,
      partyType = "CUSTOMER",
      partyId,
      partyName,
      partyPhone,
      notes,
      applyAsPayment = false, // Automatically credit customer or debit supplier
    } = body;

    if (!chequeNumber || !bankName || !drawerName || !payeeName || !amount || !chequeDate) {
      return NextResponse.json(
        { success: false, error: "Missing required cheque details (cheque #, bank, drawer, payee, amount, cheque date)." },
        { status: 400 }
      );
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ success: false, error: "Cheque amount must be greater than zero." }, { status: 400 });
    }

    await connectToDatabase();
    const businessId = new Types.ObjectId(context.businessId);

    const cDate = new Date(chequeDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const isPdc = cDate.getTime() > today.getTime();

    let creditTxnId: Types.ObjectId | undefined;
    let supplierPaymentId: Types.ObjectId | undefined;

    // Optional customer settlement integration for inward cheques
    if (direction === "INWARD" && partyType === "CUSTOMER" && partyId && applyAsPayment) {
      const customer = await Customer.findOne({ _id: new Types.ObjectId(partyId), businessId });
      if (customer) {
        const balanceBefore = customer.currentBalance || 0;
        const balanceAfter = Math.max(0, balanceBefore - numAmount);

        customer.currentBalance = balanceAfter;
        await customer.save();

        const count = await CreditTransaction.countDocuments({ businessId });
        const txnNumber = `CR-CHQ-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(count + 1).padStart(4, "0")}`;

        const creditTxn = await CreditTransaction.create({
          businessId,
          customerId: customer._id,
          transactionNumber: txnNumber,
          type: "PAYMENT",
          amount: numAmount,
          balanceBefore,
          balanceAfter,
          paymentMethod: "CHEQUE",
          paymentReference: `Cheque #${chequeNumber} (${bankName})`,
          chequeNumber,
          notes: notes || `Customer payment via Cheque #${chequeNumber}`,
          performedBy: context.username || "Accountant",
        });

        creditTxnId = creditTxn._id;
      }
    }

    // Optional supplier settlement integration for outward cheques
    if (direction === "OUTWARD" && partyType === "SUPPLIER" && partyId && applyAsPayment) {
      const supplier = await Supplier.findOne({ _id: new Types.ObjectId(partyId), businessId });
      if (supplier) {
        const balanceBefore = supplier.currentBalance || 0;
        const balanceAfter = Math.max(0, balanceBefore - numAmount);

        supplier.currentBalance = balanceAfter;
        await supplier.save();

        const count = await SupplierPayment.countDocuments({ businessId });
        const pvNumber = `PV-CHQ-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(count + 1).padStart(4, "0")}`;

        const suppPayment = await SupplierPayment.create({
          businessId,
          paymentNumber: pvNumber,
          supplierId: supplier._id,
          supplierName: supplier.name,
          amount: numAmount,
          balanceBefore,
          balanceAfter,
          paymentMethod: "CHEQUE",
          chequeNumber,
          chequeDate: cDate,
          bankName,
          notes: notes || `Payment issued via Cheque #${chequeNumber}`,
          paidBy: context.username || "Accountant",
        });

        supplierPaymentId = suppPayment._id;
      }
    }

    const newCheque = await BankCheque.create({
      businessId,
      chequeNumber: chequeNumber.trim(),
      direction,
      partyType,
      partyId: partyId ? new Types.ObjectId(partyId) : undefined,
      partyName: partyName || (direction === "INWARD" ? drawerName : payeeName),
      partyPhone,
      bankName: bankName.trim(),
      bankBranch: bankBranch.trim(),
      bankCode,
      accountNumber,
      drawerName: drawerName.trim(),
      payeeName: payeeName.trim(),
      amount: numAmount,
      chequeDate: cDate,
      receivedOrIssuedDate: new Date(),
      isPdc,
      status: "RECEIVED",
      creditTransactionId: creditTxnId,
      supplierPaymentId,
      notes,
      createdBy: context.username || "Accountant",
    });

    await AuditLog.create({
      businessId,
      action: "CHEQUE_RECORDED",
      performedBy: context.username || "User",
      details: `${direction} Cheque #${chequeNumber} for LKR ${numAmount.toLocaleString()} recorded (${bankName})`,
    });

    return NextResponse.json({
      success: true,
      cheque: newCheque,
      message: `Cheque #${chequeNumber} recorded successfully.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to record cheque." },
      { status: 500 }
    );
  }
}
