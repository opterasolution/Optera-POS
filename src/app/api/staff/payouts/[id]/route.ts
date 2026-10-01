import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { CommissionPayout } from "@/models/CommissionPayout";
import { SalesTarget } from "@/models/SalesTarget";
import { requireRole } from "@/lib/tenant";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPERVISOR", "ACCOUNTANT", "CASHIER", "SALES_REP"]);

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const payout = await CommissionPayout.findOne({
        _id: params.id,
        businessId: context.businessId,
      }).lean();

      if (!payout) {
        return NextResponse.json({ success: false, error: "Payout voucher not found" }, { status: 404 });
      }

      return NextResponse.json({ success: true, payout });
    }

    return NextResponse.json({
      success: true,
      payout: {
        _id: params.id,
        payoutNumber: "COMM-20261001-0001",
        userName: "Nimal Perera",
        period: "September 2026",
        totalSalesCount: 145,
        totalSalesVolume: 480000,
        baseCommission: 12000,
        targetBonus: 10000,
        deductions: 0,
        netPayable: 22000,
        status: "PAID",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch payout voucher";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "ACCOUNTANT"]);
    const body = await req.json();

    const { status, paymentMethod, paymentReference, notes } = body;

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const payout = await CommissionPayout.findOne({
        _id: params.id,
        businessId: context.businessId,
      });

      if (!payout) {
        return NextResponse.json({ success: false, error: "Payout voucher not found" }, { status: 404 });
      }

      if (status === "APPROVED") {
        payout.status = "APPROVED";
        payout.approvedBy = context.username || "Manager";
      } else if (status === "PAID") {
        payout.status = "PAID";
        payout.paymentMethod = paymentMethod || "CASH";
        payout.paymentReference = paymentReference?.trim() || "";
        payout.paidAt = new Date();
        payout.paidBy = context.username || "Manager";
        if (!payout.approvedBy) {
          payout.approvedBy = context.username || "Manager";
        }

        // If target bonus was included, update SalesTarget to BONUS_PAID
        if (payout.targetBonus > 0) {
          await SalesTarget.updateMany(
            {
              businessId: context.businessId,
              userId: payout.userId,
              status: "ACHIEVED",
              startDate: { $lte: payout.endDate },
              endDate: { $gte: payout.startDate },
            },
            { $set: { status: "BONUS_PAID" } }
          );
        }
      } else if (status === "CANCELLED") {
        payout.status = "CANCELLED";
      }

      if (notes !== undefined) {
        payout.notes = notes.trim();
      }

      await payout.save();

      return NextResponse.json({
        success: true,
        message: `Payout voucher ${payout.payoutNumber} updated to ${payout.status}.`,
        payout,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Payout updated (Demo Mode)",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update payout voucher";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
