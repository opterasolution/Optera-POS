import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/db";
import RestaurantTable from "@/models/RestaurantTable";

interface Params {
  params: { id: string };
}

// POST /api/tables/[id]/split - Compute Equal or By-Seat Split Bills
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const table = await RestaurantTable.findById(params.id).lean();
    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    if (!table.currentOrder || !table.currentOrder.items || table.currentOrder.items.length === 0) {
      return NextResponse.json(
        { error: "Table has no active food items to split." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { mode = "EQUAL", ways = 2 } = body;
    const order = table.currentOrder;

    if (mode === "EQUAL") {
      const splitWays = Math.max(2, Math.min(20, Number(ways) || 2));
      const evenAmount = Math.floor(order.grandTotal / splitWays);
      const remainder = order.grandTotal - evenAmount * splitWays;

      const splits = Array.from({ length: splitWays }).map((_, idx) => {
        // Distribute rounding remainder onto first share
        const shareAmount = idx === 0 ? evenAmount + remainder : evenAmount;
        return {
          shareIndex: idx + 1,
          title: `Guest ${idx + 1} (${Math.round((1 / splitWays) * 100)}%)`,
          subtotal: Math.round(order.subtotal / splitWays),
          serviceCharge: Math.round(order.serviceChargeAmount / splitWays),
          taxAmount: Math.round(order.taxAmount / splitWays),
          grandTotal: shareAmount,
        };
      });

      return NextResponse.json({
        success: true,
        mode: "EQUAL",
        tableNumber: table.tableNumber,
        originalGrandTotal: order.grandTotal,
        splitWays,
        splits,
      });
    }

    if (mode === "BY_SEAT") {
      // Group items by seatNumber
      const seatMap = new Map<number, typeof order.items>();
      order.items.forEach((it) => {
        const s = it.seatNumber || 1;
        if (!seatMap.has(s)) seatMap.set(s, []);
        seatMap.get(s)!.push(it);
      });

      const svcRate = order.serviceChargeRate || 10;
      const taxRate = order.taxRate || 0;

      const splits = Array.from(seatMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([seatNum, items]) => {
          const seatSubtotal = items.reduce((sum, it) => sum + (it.lineTotal || 0), 0);
          const seatSvc = Math.round(seatSubtotal * (svcRate / 100));
          const seatTax = Math.round(seatSubtotal * (taxRate / 100));
          const seatGrandTotal = seatSubtotal + seatSvc + seatTax;

          return {
            seatNumber: seatNum,
            title: `Seat ${seatNum}`,
            items,
            subtotal: seatSubtotal,
            serviceCharge: seatSvc,
            taxAmount: seatTax,
            grandTotal: seatGrandTotal,
          };
        });

      return NextResponse.json({
        success: true,
        mode: "BY_SEAT",
        tableNumber: table.tableNumber,
        originalGrandTotal: order.grandTotal,
        seatCount: splits.length,
        splits,
      });
    }

    return NextResponse.json({ error: `Unsupported split mode: ${mode}` }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/tables/[id]/split error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to calculate split bill" },
      { status: 500 }
    );
  }
}
