import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { BankAccount } from "@/models/BankAccount";
import { Business } from "@/models/Business";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const context = await requireAuth();
    await connectToDatabase();
    const businessId = new Types.ObjectId(context.businessId);

    let accounts: any[] = await BankAccount.find({ businessId, isActive: true })
      .sort({ isDefault: -1, createdAt: 1 })
      .lean();

    // If no bank accounts exist yet, seed one from Business.bankDetails or default Commercial Bank
    if (accounts.length === 0) {
      const business = await Business.findById(businessId).lean();
      const defaultBankName = business?.bankDetails?.bankName || "Commercial Bank of Ceylon PLC";
      const defaultBranch = business?.bankDetails?.branchName || "Colombo Fort";
      const defaultAccNum = business?.bankDetails?.accountNumber || "1000123456";
      const defaultAccName = business?.bankDetails?.accountName || business?.name || "Store Main Account";

      const seeded = await BankAccount.create({
        businessId,
        bankName: defaultBankName,
        branchName: defaultBranch,
        accountNumber: defaultAccNum,
        accountName: defaultAccName,
        accountType: "CURRENT",
        currency: "LKR",
        ledgerBalance: 0,
        clearedBalance: 0,
        isDefault: true,
        isActive: true,
      });

      accounts = [seeded.toObject()];
    }

    return NextResponse.json({
      success: true,
      accounts,
      count: accounts.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch bank accounts." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireAuth();
    const body = await req.json();

    const {
      bankName,
      bankCode,
      branchName = "Main Branch",
      accountNumber,
      accountName,
      accountType = "CURRENT",
      ledgerBalance = 0,
      clearedBalance = 0,
      isDefault = false,
      notes,
    } = body;

    if (!bankName || !accountNumber || !accountName) {
      return NextResponse.json(
        { success: false, error: "Bank name, account number, and account title are required." },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const businessId = new Types.ObjectId(context.businessId);

    // If marked default, unmark others
    if (isDefault) {
      await BankAccount.updateMany({ businessId }, { $set: { isDefault: false } });
    }

    const newAccount = await BankAccount.create({
      businessId,
      bankName: bankName.trim(),
      bankCode: bankCode?.trim(),
      branchName: branchName.trim(),
      accountNumber: accountNumber.trim(),
      accountName: accountName.trim(),
      accountType,
      currency: "LKR",
      ledgerBalance: Number(ledgerBalance) || 0,
      clearedBalance: Number(clearedBalance) || 0,
      isDefault: Boolean(isDefault),
      isActive: true,
      notes,
    });

    await AuditLog.create({
      businessId,
      action: "BANK_ACCOUNT_CREATED",
      performedBy: context.username || "Accountant",
      details: `Added ${bankName} account (${accountNumber})`,
    });

    return NextResponse.json({
      success: true,
      account: newAccount,
      message: "Bank account created successfully.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create bank account." },
      { status: 500 }
    );
  }
}
