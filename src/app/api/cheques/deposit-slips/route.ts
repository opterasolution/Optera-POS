import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { BankDepositSlip, IDepositSlipChequeItem } from "@/models/BankDepositSlip";
import { BankCheque } from "@/models/BankCheque";
import { BankAccount } from "@/models/BankAccount";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const context = await requireAuth();
    await connectToDatabase();
    const businessId = new Types.ObjectId(context.businessId);

    const slips = await BankDepositSlip.find({ businessId })
      .sort({ depositDate: -1, createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      slips,
      count: slips.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch deposit slips." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireAuth();
    const body = await req.json();

    const {
      bankAccountId,
      bankName,
      branchName = "Main Branch",
      accountNumber,
      accountName,
      depositDate = new Date(),
      chequeIds = [],
      cashAmount = 0,
      notes,
    } = body;

    if (!bankName || !accountNumber || !accountName) {
      return NextResponse.json(
        { success: false, error: "Missing required bank details (Bank Name, Account #, Account Name)." },
        { status: 400 }
      );
    }

    if (!Array.isArray(chequeIds) || chequeIds.length === 0) {
      if (Number(cashAmount) <= 0) {
        return NextResponse.json(
          { success: false, error: "Select at least one cheque or enter cash amount to deposit." },
          { status: 400 }
        );
      }
    }

    await connectToDatabase();
    const businessId = new Types.ObjectId(context.businessId);

    // Fetch and validate cheques
    const objectIds = chequeIds.map((id: string) => new Types.ObjectId(id));
    const cheques = await BankCheque.find({
      _id: { $in: objectIds },
      businessId,
    });

    const chequeItems: IDepositSlipChequeItem[] = [];
    let chequeTotal = 0;

    for (const c of cheques) {
      chequeTotal += c.amount;
      chequeItems.push({
        chequeId: c._id as Types.ObjectId,
        chequeNumber: c.chequeNumber,
        bankName: c.bankName,
        bankBranch: c.bankBranch,
        drawerName: c.drawerName,
        amount: c.amount,
        chequeDate: c.chequeDate,
      });
    }

    const numCash = Math.max(0, Number(cashAmount) || 0);
    const totalDepositAmount = chequeTotal + numCash;

    // Generate slip number DS-YYYYMMDD-XXXX
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const countToday = await BankDepositSlip.countDocuments({
      businessId,
      slipNumber: { $regex: `^DS-${todayStr}` },
    });
    const slipNumber = `DS-${todayStr}-${String(countToday + 1).padStart(4, "0")}`;

    const userName = context.username || "Accountant";

    const depositSlip = await BankDepositSlip.create({
      businessId,
      slipNumber,
      bankAccountId: bankAccountId ? new Types.ObjectId(bankAccountId) : undefined,
      bankName: bankName.trim(),
      branchName: branchName.trim(),
      accountNumber: accountNumber.trim(),
      accountName: accountName.trim(),
      depositDate: new Date(depositDate),
      cheques: chequeItems,
      chequeCount: chequeItems.length,
      chequeTotal,
      cashAmount: numCash,
      totalDepositAmount,
      status: "DEPOSITED",
      depositedBy: userName,
      notes,
    });

    // Update all cheques to DEPOSITED status
    if (objectIds.length > 0) {
      await BankCheque.updateMany(
        { _id: { $in: objectIds }, businessId },
        {
          $set: {
            status: "DEPOSITED",
            depositDetails: {
              depositSlipId: depositSlip._id,
              depositSlipNumber: depositSlip.slipNumber,
              depositedAt: new Date(depositDate),
              depositedBy: userName,
              bankAccountId: bankAccountId ? new Types.ObjectId(bankAccountId) : undefined,
              bankName: bankName.trim(),
              accountNumber: accountNumber.trim(),
              branchName: branchName.trim(),
              notes: notes || `Deposited via Slip #${slipNumber}`,
            },
          },
        }
      );
    }

    // Update merchant bank account balance
    if (bankAccountId) {
      await BankAccount.findByIdAndUpdate(bankAccountId, {
        $inc: { ledgerBalance: totalDepositAmount },
      });
    }

    await AuditLog.create({
      businessId,
      action: "BANK_DEPOSIT_SLIP_CREATED",
      performedBy: userName,
      details: `Created Bank Deposit Slip #${slipNumber} for LKR ${totalDepositAmount.toLocaleString()} (${chequeItems.length} cheques + LKR ${numCash} cash) to ${bankName}`,
    });

    return NextResponse.json({
      success: true,
      depositSlip,
      message: `Deposit slip #${slipNumber} generated with ${chequeItems.length} cheques.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create bank deposit slip." },
      { status: 500 }
    );
  }
}
