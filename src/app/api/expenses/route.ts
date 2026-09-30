import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Expense } from "@/models/Expense";
import { Shift } from "@/models/Shift";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth, verifyActiveSubscription } from "@/lib/tenant";
import { createExpenseSchema } from "@/lib/validations/expense";

export async function GET(req: Request) {
  try {
    const context = await requireAuth();
    await verifyActiveSubscription(context.businessId);

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";
    const category = searchParams.get("category")?.trim();
    const paidFrom = searchParams.get("paidFrom")?.trim();
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const skip = (page - 1) * limit;

    await connectToDatabase();
    const businessId = context.businessId;

    const query: any = { businessId };

    if (q) {
      query.$or = [
        { expenseNumber: { $regex: q, $options: "i" } },
        { title: { $regex: q, $options: "i" } },
        { payee: { $regex: q, $options: "i" } },
        { receiptNumber: { $regex: q, $options: "i" } },
        { notes: { $regex: q, $options: "i" } },
      ];
    }

    if (category && category !== "ALL") {
      query.category = category;
    }

    if (paidFrom && paidFrom !== "ALL") {
      query.paidFrom = paidFrom;
    }

    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }

    const [expenses, total] = await Promise.all([
      Expense.find(query).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      Expense.countDocuments(query),
    ]);

    // Calculate aggregate metrics across all expenses for this store
    const allExpenses = await Expense.find({ businessId }).lean();
    let totalExpensesAmount = 0;
    let dailyPettyCashToday = 0;
    let drawerPayoutsTotal = 0;
    let centralSafeTotal = 0;
    let bankTransferTotal = 0;
    const categoryBreakdown: Record<string, number> = {};

    const todayStr = new Date().toISOString().slice(0, 10);

    for (const exp of allExpenses) {
      const amt = exp.amount || 0;
      totalExpensesAmount += amt;

      const expDateStr = new Date(exp.date).toISOString().slice(0, 10);
      if (expDateStr === todayStr) {
        dailyPettyCashToday += amt;
      }

      if (exp.paidFrom === "REGISTER_DRAWER") {
        drawerPayoutsTotal += amt;
      } else if (exp.paidFrom === "STORE_PETTY_CASH") {
        centralSafeTotal += amt;
      } else if (exp.paidFrom === "BANK_ACCOUNT") {
        bankTransferTotal += amt;
      }

      const cat = exp.category || "OTHER";
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + amt;
    }

    return NextResponse.json({
      success: true,
      expenses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        totalExpensesCount: allExpenses.length,
        totalExpensesAmount: Math.round(totalExpensesAmount * 100) / 100,
        dailyPettyCashToday: Math.round(dailyPettyCashToday * 100) / 100,
        drawerPayoutsTotal: Math.round(drawerPayoutsTotal * 100) / 100,
        centralSafeTotal: Math.round(centralSafeTotal * 100) / 100,
        bankTransferTotal: Math.round(bankTransferTotal * 100) / 100,
        categoryBreakdown,
      },
    });
  } catch (error: any) {
    console.error("GET /api/expenses error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch expenses" },
      { status: error.status || 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireAuth();
    await verifyActiveSubscription(context.businessId);

    const body = await req.json();
    const parsed = createExpenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const {
      title,
      category,
      amount,
      paymentMethod,
      paidFrom,
      shiftId,
      registerId,
      registerName,
      payee,
      receiptNumber,
      notes,
      date,
    } = parsed.data;

    await connectToDatabase();
    const businessId = context.businessId;

    // 1. Generate sequential expense number: EXP-YYYYMMDD-XXXX
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const count = await Expense.countDocuments({ businessId });
    const expenseNumber = `EXP-${todayStr}-${String(count + 1).padStart(4, "0")}`;

    // 2. Resolve active Shift if paid from counter register drawer
    let resolvedShiftId = shiftId && Types.ObjectId.isValid(shiftId)
      ? new Types.ObjectId(shiftId)
      : undefined;

    if (!resolvedShiftId && paidFrom === "REGISTER_DRAWER") {
      if (registerId && Types.ObjectId.isValid(registerId)) {
        const activeShift = await Shift.findOne({
          businessId,
          registerId: new Types.ObjectId(registerId),
          status: "OPEN",
        });
        if (activeShift) {
          resolvedShiftId = activeShift._id;
        }
      } else {
        // Find any open shift for this user
        const userShift = await Shift.findOne({
          businessId,
          cashierId: context.userId,
          status: "OPEN",
        });
        if (userShift) {
          resolvedShiftId = userShift._id;
        }
      }
    }

    // 3. If paid from register drawer, atomically append PAY_OUT movement to active shift drawer
    if (paidFrom === "REGISTER_DRAWER" && resolvedShiftId) {
      await Shift.findByIdAndUpdate(resolvedShiftId, {
        $push: {
          cashMovements: {
            type: "PAY_OUT",
            amount,
            reason: `Petty Cash: ${title} (${expenseNumber})`,
            performedBy: context.username || "Cashier",
            createdAt: new Date(),
          },
        },
      });
    }

    // 4. Create Expense document
    const expense = await Expense.create({
      businessId,
      expenseNumber,
      category,
      title,
      amount,
      paymentMethod,
      paidFrom,
      shiftId: resolvedShiftId,
      registerId: registerId && Types.ObjectId.isValid(registerId) ? new Types.ObjectId(registerId) : undefined,
      registerName: registerName || undefined,
      payee: payee?.trim() || undefined,
      receiptNumber: receiptNumber?.trim() || undefined,
      notes: notes?.trim() || undefined,
      recordedBy: context.username || "Staff",
      recordedById: context.userId,
      date: date ? new Date(date) : new Date(),
    });

    // 5. Create Audit Log
    await AuditLog.create({
      businessId,
      userId: context.userId,
      userName: context.username,
      action: "EXPENSE_RECORDED",
      entityType: "Expense",
      entityId: expense._id.toString(),
      details: {
        expenseNumber,
        category,
        title,
        amount,
        paidFrom,
        payee,
      },
    });

    return NextResponse.json({ success: true, expense }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/expenses error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to record expense" },
      { status: error.status || 500 }
    );
  }
}
