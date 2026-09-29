import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Shift } from "@/models/Shift";
import { Sale } from "@/models/Sale";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth, verifyActiveSubscription } from "@/lib/tenant";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireAuth();
    const { id } = params;

    if (!id || !Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid Shift ID" }, { status: 400 });
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const shift = await Shift.findOne({
        _id: new Types.ObjectId(id),
        businessId: context.businessId,
      }).lean();

      if (!shift) {
        return NextResponse.json({ success: false, error: "Shift not found" }, { status: 404 });
      }

      // If still OPEN, fetch live sales to compute live numbers for X-Report
      if (shift.status === "OPEN") {
        const shiftSales = await Sale.find({
          businessId: context.businessId,
          $or: [
            { shiftId: shift._id },
            { registerId: shift.registerId, createdAt: { $gte: shift.openedAt } },
          ],
          status: "COMPLETED",
        }).lean();

        let liveCash = 0;
        let liveCard = 0;
        let liveQr = 0;
        let liveBank = 0;
        let liveTotal = 0;
        let liveDiscount = 0;
        let liveTax = 0;

        for (const s of shiftSales) {
          liveTotal += s.netTotal;
          liveDiscount += s.discountTotal || 0;
          liveTax += s.taxTotal || 0;
          if (s.paymentMethod === "CASH") liveCash += s.netTotal;
          else if (s.paymentMethod === "CARD") liveCard += s.netTotal;
          else if (s.paymentMethod === "QR") liveQr += s.netTotal;
          else if (s.paymentMethod === "BANK_TRANSFER") liveBank += s.netTotal;
        }

        const payIns = shift.cashMovements
          .filter((m) => m.type === "PAY_IN")
          .reduce((sum, m) => sum + m.amount, 0);
        const cashDrops = shift.cashMovements
          .filter((m) => m.type === "CASH_DROP")
          .reduce((sum, m) => sum + m.amount, 0);
        const payOuts = shift.cashMovements
          .filter((m) => m.type === "PAY_OUT")
          .reduce((sum, m) => sum + m.amount, 0);

        const expectedCash = shift.openingFloat + liveCash + payIns - cashDrops - payOuts;

        return NextResponse.json({
          success: true,
          shift: {
            ...shift,
            cashSales: liveCash,
            cardSales: liveCard,
            qrSales: liveQr,
            bankTransferSales: liveBank,
            totalSales: liveTotal,
            salesCount: shiftSales.length,
            totalDiscount: liveDiscount,
            totalTax: liveTax,
            expectedCash,
          },
        });
      }

      return NextResponse.json({
        success: true,
        shift,
      });
    }

    return NextResponse.json({
      success: true,
      shift: { _id: id, shiftNumber: "SH-DEMO", status: "CLOSED" },
    });
  } catch (error: any) {
    const status = error.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ success: false, error: error.message || "Failed to fetch shift" }, { status });
  }
}

// PATCH: Record cash movements (Cash Drop, Pay-In, Pay-Out)
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireAuth();
    await verifyActiveSubscription(context.businessId);
    const { id } = params;
    const body = await req.json();

    const { type, amount, reason } = body;

    if (!["CASH_DROP", "PAY_IN", "PAY_OUT"].includes(type)) {
      return NextResponse.json(
        { success: false, error: "Invalid movement type. Must be CASH_DROP, PAY_IN, or PAY_OUT." },
        { status: 400 }
      );
    }

    const amtNum = Number(amount);
    if (!amtNum || amtNum <= 0) {
      return NextResponse.json({ success: false, error: "Movement amount must be greater than zero." }, { status: 400 });
    }

    if (!reason || !reason.trim()) {
      return NextResponse.json({ success: false, error: "Reason/note is required for cash movements." }, { status: 400 });
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const shift = await Shift.findOne({
        _id: new Types.ObjectId(id),
        businessId: context.businessId,
      });

      if (!shift) {
        return NextResponse.json({ success: false, error: "Shift not found" }, { status: 404 });
      }

      if (shift.status !== "OPEN") {
        return NextResponse.json(
          { success: false, error: "Cannot add cash movements to a closed shift." },
          { status: 400 }
        );
      }

      const movement = {
        type,
        amount: amtNum,
        reason: reason.trim(),
        performedBy: context.username || "Cashier",
        createdAt: new Date(),
      };

      shift.cashMovements.push(movement as any);
      await shift.save();

      // Audit Log
      await AuditLog.create({
        businessId: context.businessId,
        userId: context.userId,
        userName: context.username,
        action: "CASH_DRAWER_MOVEMENT",
        entityType: "Shift",
        entityId: shift._id.toString(),
        details: {
          shiftNumber: shift.shiftNumber,
          movementType: type,
          amount: amtNum,
          reason: reason.trim(),
        },
      });

      return NextResponse.json({
        success: true,
        message: `${type === "CASH_DROP" ? "Cash Drop" : type === "PAY_IN" ? "Pay-In" : "Pay-Out"} of Rs. ${amtNum.toFixed(2)} recorded.`,
        shift,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    const status = error.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ success: false, error: error.message || "Failed to record cash movement" }, { status });
  }
}

// POST: Close Shift, Reconcile Cash Drawer, and Compute Z-Report
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireAuth();
    await verifyActiveSubscription(context.businessId);
    const { id } = params;
    const body = await req.json();

    const { actualCash, closingNotes } = body;

    const countedNum = Number(actualCash);
    if (isNaN(countedNum) || countedNum < 0) {
      return NextResponse.json(
        { success: false, error: "Actual cash counted must be a valid non-negative number." },
        { status: 400 }
      );
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const shift = await Shift.findOne({
        _id: new Types.ObjectId(id),
        businessId: context.businessId,
      });

      if (!shift) {
        return NextResponse.json({ success: false, error: "Shift not found" }, { status: 404 });
      }

      if (shift.status === "CLOSED") {
        return NextResponse.json(
          { success: false, error: `Shift ${shift.shiftNumber} has already been closed.` },
          { status: 400 }
        );
      }

      // Compute final verified sales metrics from MongoDB
      const shiftSales = await Sale.find({
        businessId: context.businessId,
        $or: [
          { shiftId: shift._id },
          { registerId: shift.registerId, createdAt: { $gte: shift.openedAt } },
        ],
        status: "COMPLETED",
      }).lean();

      // Ensure all sales from this period on this register are permanently attached to this shift
      await Sale.updateMany(
        {
          businessId: context.businessId,
          registerId: shift.registerId,
          createdAt: { $gte: shift.openedAt },
          shiftId: { $exists: false },
        },
        { $set: { shiftId: shift._id } }
      );

      let finalCash = 0;
      let finalCard = 0;
      let finalQr = 0;
      let finalBank = 0;
      let finalTotal = 0;
      let finalDiscount = 0;
      let finalTax = 0;

      for (const s of shiftSales) {
        finalTotal += s.netTotal;
        finalDiscount += s.discountTotal || 0;
        finalTax += s.taxTotal || 0;
        if (s.paymentMethod === "CASH") finalCash += s.netTotal;
        else if (s.paymentMethod === "CARD") finalCard += s.netTotal;
        else if (s.paymentMethod === "QR") finalQr += s.netTotal;
        else if (s.paymentMethod === "BANK_TRANSFER") finalBank += s.netTotal;
      }

      const payIns = shift.cashMovements
        .filter((m) => m.type === "PAY_IN")
        .reduce((sum, m) => sum + m.amount, 0);
      const cashDrops = shift.cashMovements
        .filter((m) => m.type === "CASH_DROP")
        .reduce((sum, m) => sum + m.amount, 0);
      const payOuts = shift.cashMovements
        .filter((m) => m.type === "PAY_OUT")
        .reduce((sum, m) => sum + m.amount, 0);

      const expectedCash = Math.round((shift.openingFloat + finalCash + payIns - cashDrops - payOuts) * 100) / 100;
      const difference = Math.round((countedNum - expectedCash) * 100) / 100;

      shift.status = "CLOSED";
      shift.closedAt = new Date();
      shift.cashSales = finalCash;
      shift.cardSales = finalCard;
      shift.qrSales = finalQr;
      shift.bankTransferSales = finalBank;
      shift.totalSales = finalTotal;
      shift.salesCount = shiftSales.length;
      shift.totalDiscount = finalDiscount;
      shift.totalTax = finalTax;
      shift.expectedCash = expectedCash;
      shift.actualCash = countedNum;
      shift.difference = difference;
      if (closingNotes) shift.closingNotes = closingNotes.trim();

      await shift.save();

      // Audit Log
      await AuditLog.create({
        businessId: context.businessId,
        userId: context.userId,
        userName: context.username,
        action: "SHIFT_CLOSED",
        entityType: "Shift",
        entityId: shift._id.toString(),
        details: {
          shiftNumber: shift.shiftNumber,
          registerName: shift.registerName,
          openingFloat: shift.openingFloat,
          cashSales: finalCash,
          expectedCash,
          actualCash: countedNum,
          difference,
          salesCount: shiftSales.length,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Shift ${shift.shiftNumber} closed successfully. Expected: Rs. ${expectedCash.toFixed(2)}, Actual: Rs. ${countedNum.toFixed(2)} (${difference >= 0 ? `+Rs. ${difference.toFixed(2)} Over` : `-Rs. ${Math.abs(difference).toFixed(2)} Short`}).`,
        shift,
      });
    }

    return NextResponse.json({
      success: true,
      shift: {
        _id: id,
        status: "CLOSED",
        actualCash: countedNum,
      },
    });
  } catch (error: any) {
    const status = error.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ success: false, error: error.message || "Failed to close shift" }, { status });
  }
}
