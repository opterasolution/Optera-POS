import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Shift } from "@/models/Shift";
import { Register } from "@/models/Register";
import { Sale } from "@/models/Sale";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth, verifyActiveSubscription } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const context = await requireAuth();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const registerId = searchParams.get("registerId");
    const dateRange = searchParams.get("dateRange") || "all";

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const filter: Record<string, unknown> = {
        businessId: context.businessId,
      };

      if (status && status !== "all") {
        filter.status = status;
      }

      if (registerId && registerId !== "all") {
        filter.registerId = new Types.ObjectId(registerId);
      }

      // Date range filtering on openedAt
      if (dateRange !== "all") {
        const now = new Date();
        const slOffsetMs = 5.5 * 60 * 60 * 1000;
        const slNow = new Date(now.getTime() + slOffsetMs);

        if (dateRange === "today") {
          const startOfTodaySL = new Date(slNow);
          startOfTodaySL.setUTCHours(0, 0, 0, 0);
          const startOfTodayUTC = new Date(startOfTodaySL.getTime() - slOffsetMs);
          filter.openedAt = { $gte: startOfTodayUTC };
        } else if (dateRange === "yesterday") {
          const startOfYesterdaySL = new Date(slNow);
          startOfYesterdaySL.setUTCDate(startOfYesterdaySL.getUTCDate() - 1);
          startOfYesterdaySL.setUTCHours(0, 0, 0, 0);
          const endOfYesterdaySL = new Date(slNow);
          endOfYesterdaySL.setUTCDate(endOfYesterdaySL.getUTCDate() - 1);
          endOfYesterdaySL.setUTCHours(23, 59, 59, 999);

          filter.openedAt = {
            $gte: new Date(startOfYesterdaySL.getTime() - slOffsetMs),
            $lte: new Date(endOfYesterdaySL.getTime() - slOffsetMs),
          };
        } else if (dateRange === "week") {
          const past7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          filter.openedAt = { $gte: past7Days };
        } else if (dateRange === "month") {
          const startOfMonthSL = new Date(slNow);
          startOfMonthSL.setUTCDate(1);
          startOfMonthSL.setUTCHours(0, 0, 0, 0);
          filter.openedAt = { $gte: new Date(startOfMonthSL.getTime() - slOffsetMs) };
        }
      }

      const shifts = await Shift.find(filter).sort({ openedAt: -1 }).lean();

      // Compute live totals for any OPEN shifts in the list
      const enrichedShifts = await Promise.all(
        shifts.map(async (shift) => {
          if (shift.status === "OPEN") {
            const shiftSales = await Sale.find({
              businessId: context.businessId,
              $or: [{ shiftId: shift._id }, { registerId: shift.registerId, createdAt: { $gte: shift.openedAt } }],
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

            return {
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
            };
          }
          return shift;
        })
      );

      return NextResponse.json({
        success: true,
        shifts: enrichedShifts,
      });
    }

    // Demo fallback
    return NextResponse.json({
      success: true,
      shifts: [],
    });
  } catch (error: any) {
    const status = error.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ success: false, error: error.message || "Failed to fetch shifts" }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireAuth();
    await verifyActiveSubscription(context.businessId);
    const body = await req.json();

    const { registerId, openingFloat = 0, registerName, registerNumber } = body;

    if (!registerId) {
      return NextResponse.json({ success: false, error: "Register ID is required to open a shift" }, { status: 400 });
    }

    const floatNum = Number(openingFloat) || 0;
    if (floatNum < 0) {
      return NextResponse.json({ success: false, error: "Opening float cannot be negative" }, { status: 400 });
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      // 1. Check if register exists and belongs to this store
      let regObj = await Register.findOne({
        _id: new Types.ObjectId(registerId),
        businessId,
      });

      if (!regObj) {
        // Fallback: check if store has a default register or create one
        regObj = await Register.findOne({ businessId, isDefault: true });
        if (!regObj) {
          regObj = await Register.create({
            businessId,
            registerNumber: registerNumber || "REG-01",
            name: registerName || "Counter 01 (Main Register)",
            location: "Main Counter",
            isDefault: true,
            isActive: true,
          });
        }
      }

      // 2. Prevent opening multiple simultaneous shifts on the same physical register
      const existingOpenShift = await Shift.findOne({
        businessId,
        registerId: regObj._id,
        status: "OPEN",
      });

      if (existingOpenShift) {
        return NextResponse.json(
          {
            success: false,
            error: `An active shift (${existingOpenShift.shiftNumber}) is already OPEN on ${regObj.name}. Please close the active shift before opening a new one.`,
            shift: existingOpenShift,
          },
          { status: 400 }
        );
      }

      // 3. Generate sequential shift number: SH-YYYYMMDD-XXXX
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
      const count = await Shift.countDocuments({ businessId });
      const shiftNumber = `SH-${dateStr}-${(count + 1).toString().padStart(4, "0")}`;

      // 4. Create Shift record
      const shift = await Shift.create({
        businessId,
        shiftNumber,
        registerId: regObj._id,
        registerName: regObj.name,
        registerNumber: regObj.registerNumber,
        cashierId: context.userId,
        cashierName: context.username || "Cashier",
        status: "OPEN",
        openedAt: now,
        openingFloat: floatNum,
        expectedCash: floatNum,
        cashMovements: [],
      });

      // 5. Audit Log
      await AuditLog.create({
        businessId,
        userId: context.userId,
        userName: context.username,
        action: "SHIFT_OPENED",
        entityType: "Shift",
        entityId: shift._id.toString(),
        details: {
          shiftNumber,
          registerName: regObj.name,
          registerNumber: regObj.registerNumber,
          openingFloat: floatNum,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Shift ${shiftNumber} opened on ${regObj.name} with opening float of Rs. ${floatNum.toFixed(2)}`,
        shift,
      });
    }

    return NextResponse.json({
      success: true,
      shift: {
        _id: "demo_shift_01",
        shiftNumber: "SH-20260930-0001",
        status: "OPEN",
        openingFloat: floatNum,
      },
    });
  } catch (error: any) {
    const status = error.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ success: false, error: error.message || "Failed to open shift" }, { status });
  }
}
