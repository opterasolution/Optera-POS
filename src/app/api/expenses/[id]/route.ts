import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Expense } from "@/models/Expense";
import { Shift } from "@/models/Shift";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth, verifyActiveSubscription } from "@/lib/tenant";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireAuth();
    await verifyActiveSubscription(context.businessId);

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: "Expense ID required" }, { status: 400 });
    }

    await connectToDatabase();
    const expense = await Expense.findOne({
      _id: id,
      businessId: context.businessId,
    })
      .populate("shiftId")
      .populate("registerId")
      .lean();

    if (!expense) {
      return NextResponse.json({ success: false, error: "Expense record not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, expense });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch expense details" },
      { status: error.status || 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireAuth();
    await verifyActiveSubscription(context.businessId);

    // Only MANAGER or OWNER/ADMIN can delete an expense
    if (!["ADMIN", "MANAGER", "OWNER"].includes(context.role)) {
      return NextResponse.json(
        { success: false, error: "Manager authorization required to void expenses." },
        { status: 403 }
      );
    }

    const { id } = await params;
    await connectToDatabase();

    const expense = await Expense.findOne({
      _id: id,
      businessId: context.businessId,
    });

    if (!expense) {
      return NextResponse.json({ success: false, error: "Expense record not found" }, { status: 404 });
    }

    // If paid from register drawer, add a compensatory PAY_IN to balance the drawer
    if (expense.paidFrom === "REGISTER_DRAWER" && expense.shiftId) {
      await Shift.findByIdAndUpdate(expense.shiftId, {
        $push: {
          cashMovements: {
            type: "PAY_IN",
            amount: expense.amount,
            reason: `Reversal of Expense ${expense.expenseNumber} (${expense.title})`,
            performedBy: context.username || "Manager",
            createdAt: new Date(),
          },
        },
      });
    }

    await Expense.deleteOne({ _id: id });

    // Audit Log
    await AuditLog.create({
      businessId: context.businessId,
      userId: context.userId,
      userName: context.username,
      action: "EXPENSE_DELETED",
      entityType: "Expense",
      entityId: id,
      details: {
        expenseNumber: expense.expenseNumber,
        title: expense.title,
        amount: expense.amount,
        paidFrom: expense.paidFrom,
      },
    });

    return NextResponse.json({ success: true, message: "Expense deleted and drawer adjusted." });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete expense" },
      { status: error.status || 500 }
    );
  }
}
