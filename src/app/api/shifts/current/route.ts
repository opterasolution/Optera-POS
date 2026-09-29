import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Shift } from "@/models/Shift";
import { Sale } from "@/models/Sale";
import { Register } from "@/models/Register";
import { requireAuth } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const context = await requireAuth();
    const { searchParams } = new URL(req.url);
    const registerId = searchParams.get("registerId");

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const query: Record<string, unknown> = {
        businessId,
        status: "OPEN",
      };

      if (registerId && registerId.trim() && registerId !== "all") {
        query.registerId = new Types.ObjectId(registerId);
      }

      let shift = await Shift.findOne(query).sort({ openedAt: -1 }).lean();

      // If no open shift found specifically for that register, check if there's any open shift for the store
      if (!shift && (!registerId || registerId === "all")) {
        shift = await Shift.findOne({ businessId, status: "OPEN" }).sort({ openedAt: -1 }).lean();
      }

      if (!shift) {
        return NextResponse.json({
          success: true,
          shift: null,
        });
      }

      // Compute live sales for this shift
      const shiftSales = await Sale.find({
        businessId,
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
        shift,
        liveMetrics: {
          cashSales: liveCash,
          cardSales: liveCard,
          qrSales: liveQr,
          bankTransferSales: liveBank,
          totalSales: liveTotal,
          salesCount: shiftSales.length,
          totalDiscount: liveDiscount,
          totalTax: liveTax,
          payIns,
          cashDrops,
          payOuts,
          expectedCash,
        },
      });
    }

    // Demo Mode fallback
    return NextResponse.json({
      success: true,
      shift: null,
    });
  } catch (error: any) {
    const status = error.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch current shift" },
      { status }
    );
  }
}
