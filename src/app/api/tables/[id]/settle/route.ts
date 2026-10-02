import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/db";
import RestaurantTable from "@/models/RestaurantTable";
import Sale from "@/models/Sale";
import mongoose from "mongoose";

interface Params {
  params: { id: string };
}

// POST /api/tables/[id]/settle - Settle table dining bill & record sale
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const user = session.user as any;
    const { id } = params;

    const table = await RestaurantTable.findById(id);
    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    if (!table.currentOrder || !table.currentOrder.items || table.currentOrder.items.length === 0) {
      return NextResponse.json(
        { error: "Table has no active order to settle" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const {
      paymentMethod = "CASH",
      cashReceived,
      changeGiven,
      paymentReference,
      resetToStatus = "CLEANING", // "CLEANING" | "AVAILABLE"
    } = body;

    const order = table.currentOrder;
    const now = new Date();

    // Generate invoice sequence
    const invoiceNumber = `INV-TBL-${Date.now().toString().slice(-6)}`;

    // Create Sale record
    const sale = await Sale.create({
      businessId: table.businessId,
      invoiceNumber,
      cashierId: user.id || new mongoose.Types.ObjectId(),
      cashierName: user.name || order.serverName || "Staff",
      customerName: order.customerName || `Dine-In (${table.tableNumber})`,
      items: order.items.map((it: any) => ({
        productId: it.productId || new mongoose.Types.ObjectId(),
        name: it.name,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discount: 0,
        total: it.lineTotal,
      })),
      subtotal: order.subtotal,
      discountTotal: 0,
      taxTotal: (order.taxAmount || 0) + (order.serviceChargeAmount || 0), // includes 10% service charge
      netTotal: order.grandTotal,
      paymentMethod,
      cashReceived: cashReceived ? Number(cashReceived) : order.grandTotal,
      changeGiven: changeGiven ? Number(changeGiven) : 0,
      paymentReference: paymentReference?.trim() || `Table ${table.tableNumber} Dining Bill`,
    });

    // Reset Table
    table.status = resetToStatus === "AVAILABLE" ? "AVAILABLE" : "CLEANING";
    table.currentOrder = undefined as any;
    await table.save();

    return NextResponse.json({
      success: true,
      message: `Table ${table.tableNumber} bill settled successfully!`,
      saleId: sale._id,
      invoiceNumber,
      grandTotal: sale.netTotal,
      tableStatus: table.status,
    });
  } catch (error: any) {
    console.error("POST /api/tables/[id]/settle error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to settle table bill" },
      { status: 500 }
    );
  }
}
