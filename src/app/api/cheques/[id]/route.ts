import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { BankCheque } from "@/models/BankCheque";
import { Customer } from "@/models/Customer";
import { Supplier } from "@/models/Supplier";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth } from "@/lib/tenant";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireAuth();
    await connectToDatabase();
    const businessId = new Types.ObjectId(context.businessId);

    const cheque = await BankCheque.findOne({
      _id: new Types.ObjectId(params.id),
      businessId,
    }).lean();

    if (!cheque) {
      return NextResponse.json({ success: false, error: "Cheque not found." }, { status: 404 });
    }

    let customerDetails = null;
    let supplierDetails = null;

    if (cheque.partyType === "CUSTOMER" && cheque.partyId) {
      customerDetails = await Customer.findOne({ _id: cheque.partyId, businessId }).lean();
    } else if (cheque.partyType === "SUPPLIER" && cheque.partyId) {
      supplierDetails = await Supplier.findOne({ _id: cheque.partyId, businessId }).lean();
    }

    return NextResponse.json({
      success: true,
      cheque,
      customer: customerDetails,
      supplier: supplierDetails,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch cheque." },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireAuth();
    const body = await req.json();

    await connectToDatabase();
    const businessId = new Types.ObjectId(context.businessId);

    const cheque = await BankCheque.findOne({
      _id: new Types.ObjectId(params.id),
      businessId,
    });

    if (!cheque) {
      return NextResponse.json({ success: false, error: "Cheque not found." }, { status: 404 });
    }

    // Only allow editing metadata if not yet realized or returned
    if (cheque.status === "REALIZED" || cheque.status === "RETURNED") {
      return NextResponse.json(
        { success: false, error: `Cannot edit cheque in ${cheque.status} status.` },
        { status: 400 }
      );
    }

    const {
      bankName,
      bankBranch,
      accountNumber,
      drawerName,
      payeeName,
      amount,
      chequeDate,
      partyPhone,
      notes,
    } = body;

    if (bankName) cheque.bankName = bankName.trim();
    if (bankBranch) cheque.bankBranch = bankBranch.trim();
    if (accountNumber !== undefined) cheque.accountNumber = accountNumber.trim();
    if (drawerName) cheque.drawerName = drawerName.trim();
    if (payeeName) cheque.payeeName = payeeName.trim();
    if (partyPhone !== undefined) cheque.partyPhone = partyPhone.trim();
    if (notes !== undefined) cheque.notes = notes.trim();

    if (amount) {
      const numAmount = Number(amount);
      if (!isNaN(numAmount) && numAmount > 0) {
        cheque.amount = numAmount;
      }
    }

    if (chequeDate) {
      const cDate = new Date(chequeDate);
      cheque.chequeDate = cDate;
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      cheque.isPdc = cDate.getTime() > today.getTime();
    }

    await cheque.save();

    await AuditLog.create({
      businessId,
      action: "CHEQUE_UPDATED",
      performedBy: context.username || "User",
      details: `Updated details for Cheque #${cheque.chequeNumber}`,
    });

    return NextResponse.json({
      success: true,
      cheque,
      message: "Cheque details updated.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update cheque." },
      { status: 500 }
    );
  }
}
