import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/tenant";
import { connectToDatabase } from "@/lib/db";
import { VanSaleSession } from "@/models/VanSaleSession";
import { DeliveryDriver } from "@/models/DeliveryDriver";
import { Product } from "@/models/Product";
import { InventoryMovement } from "@/models/InventoryMovement";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireAuth();
    await connectToDatabase();
    const { id } = await params;

    const body = await req.json();
    const { returns, physicalCashSubmitted, cashierNotes, stockDiscrepancyNotes } = body;

    const session = await VanSaleSession.findOne({
      _id: id,
      businessId: context.businessId,
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Van session not found." },
        { status: 404 }
      );
    }

    if (session.status === "RECONCILED") {
      return NextResponse.json(
        { success: false, error: "This van sales session has already been reconciled." },
        { status: 400 }
      );
    }

    // Process physical stock returns and damages
    if (Array.isArray(returns)) {
      for (const ret of returns) {
        const itemIdx = session.items.findIndex(
          (it) => it.productId.toString() === ret.productId.toString()
        );
        if (itemIdx === -1) continue;

        const retQty = Math.max(0, parseFloat(ret.returnedQty) || 0);
        const dmgQty = Math.max(0, parseFloat(ret.damagedQty) || 0);

        session.items[itemIdx].returnedQty = retQty;
        session.items[itemIdx].damagedQty = dmgQty;
        session.items[itemIdx].remainingQty = Math.max(
          0,
          session.items[itemIdx].loadedQty -
            session.items[itemIdx].soldQty -
            dmgQty -
            retQty
        );

        const product = await Product.findOne({
          _id: ret.productId,
          businessId: context.businessId,
        });

        // 1. Return unsold good stock to main store inventory
        if (product && retQty > 0) {
          const prevStock = product.stockQuantity;
          const newStock = product.stockQuantity + retQty;
          product.stockQuantity = newStock;
          await product.save();

          await InventoryMovement.create({
            businessId: context.businessId,
            productId: product._id,
            type: "VAN_RETURN",
            quantityChange: retQty,
            previousStock: prevStock,
            newStock: newStock,
            reason: `Van Return from Session ${session.sessionNumber} (${session.driverName})`,
            referenceId: session.sessionNumber,
          });
        }

        // 2. Log damaged stock movement
        if (product && dmgQty > 0) {
          await InventoryMovement.create({
            businessId: context.businessId,
            productId: product._id,
            type: "DAMAGE",
            quantityChange: -dmgQty,
            previousStock: product.stockQuantity,
            newStock: product.stockQuantity,
            reason: `Damaged in Van Session ${session.sessionNumber} (${session.driverName})`,
            referenceId: session.sessionNumber,
          });
        }
      }
    }

    const cashSubmitted = parseFloat(physicalCashSubmitted) || 0;
    const expectedCash = session.salesSummary.cashCollected || 0;
    const variance = cashSubmitted - expectedCash;

    session.cashierReconciliation = {
      status: variance === 0 ? "RECONCILED" : "DISCREPANCY",
      reconciledBy: context.username || "Store Cashier",
      reconciledAt: new Date(),
      physicalCashSubmitted: cashSubmitted,
      cashShortageOrOverage: variance,
      stockDiscrepancyNotes: stockDiscrepancyNotes?.trim() || undefined,
      cashierNotes: cashierNotes?.trim() || undefined,
    };

    session.status = "RECONCILED";
    session.reconciledAt = new Date();
    await session.save();

    // Release driver from active session
    await DeliveryDriver.findByIdAndUpdate(session.driverId, {
      $unset: { activeVanSessionId: 1 },
    });

    return NextResponse.json({
      success: true,
      message: `Van session ${session.sessionNumber} successfully reconciled. Inventory and cash drawer updated.`,
      session,
    });
  } catch (error: any) {
    console.error("POST /api/van-sales/sessions/[id]/reconcile error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to reconcile van session" },
      { status: 500 }
    );
  }
}
