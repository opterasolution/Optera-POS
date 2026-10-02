import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/db";
import RestaurantTable from "@/models/RestaurantTable";
import KitchenTicket from "@/models/KitchenTicket";

interface Params {
  params: { id: string };
}

// GET /api/tables/[id] - Get table details
export async function GET(req: NextRequest, { params }: Params) {
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

    return NextResponse.json({ success: true, table });
  } catch (error: any) {
    console.error("GET /api/tables/[id] error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load table" },
      { status: 500 }
    );
  }
}

// PATCH /api/tables/[id] - Occupy, Add Items, Request Bill, Clean, Reserve, Move
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const { id } = params;
    const body = await req.json();
    const { action } = body;

    const table = await RestaurantTable.findById(id);
    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    const now = new Date();

    if (action === "OCCUPY") {
      const { customerCount = 2, customerName, serverName = "Staff" } = body;
      table.status = "OCCUPIED";
      table.currentOrder = {
        orderNumber: `TBL-${Date.now().toString().slice(-4)}`,
        customerCount: Number(customerCount) || 1,
        customerName: customerName?.trim() || undefined,
        serverName: serverName.trim(),
        openedAt: now,
        items: [],
        subtotal: 0,
        serviceChargeRate: 10,
        serviceChargeAmount: 0,
        taxRate: 0,
        taxAmount: 0,
        grandTotal: 0,
      };
    } else if (action === "ADD_ITEMS") {
      const { items = [], sendToKds = false } = body;
      if (!table.currentOrder) {
        table.currentOrder = {
          orderNumber: `TBL-${Date.now().toString().slice(-4)}`,
          customerCount: 2,
          serverName: (session.user as any).name || "Staff",
          openedAt: now,
          items: [],
          subtotal: 0,
          serviceChargeRate: 10,
          serviceChargeAmount: 0,
          taxRate: 0,
          taxAmount: 0,
          grandTotal: 0,
        };
      }

      // Append new items
      const newItems = items.map((it: any) => ({
        productId: it.productId,
        name: it.name,
        quantity: Number(it.quantity) || 1,
        unitPrice: Number(it.unitPrice) || 0,
        lineTotal: (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0),
        course: it.course || "MAIN",
        seatNumber: Number(it.seatNumber) || 1,
        notes: it.notes?.trim() || undefined,
        station: it.station || "HOT_KITCHEN",
        sentToKds: Boolean(sendToKds),
      }));

      table.currentOrder.items.push(...newItems);

      // Recalculate totals
      const subtotal = table.currentOrder.items.reduce(
        (sum, it) => sum + (it.lineTotal || 0),
        0
      );
      const svcRate = table.currentOrder.serviceChargeRate || 10;
      const svcAmount = Math.round(subtotal * (svcRate / 100));
      const taxRate = table.currentOrder.taxRate || 0;
      const taxAmount = Math.round(subtotal * (taxRate / 100));
      const grandTotal = subtotal + svcAmount + taxAmount;

      table.currentOrder.subtotal = subtotal;
      table.currentOrder.serviceChargeAmount = svcAmount;
      table.currentOrder.taxAmount = taxAmount;
      table.currentOrder.grandTotal = grandTotal;
      table.status = "OCCUPIED";

      // If sendToKds is enabled, create a Kitchen Ticket immediately
      if (sendToKds && newItems.length > 0) {
        try {
          const countToday = await KitchenTicket.countDocuments({
            businessId: table.businessId,
          });
          await KitchenTicket.create({
            businessId: table.businessId,
            ticketNumber: `KOT-${(countToday + 1).toString().padStart(3, "0")}`,
            orderNumber: table.currentOrder.orderNumber,
            source: "DINE_IN",
            tableOrCustomer: `${table.tableNumber} (${table.section})`,
            orderType: "DINE_IN",
            serverName: table.currentOrder.serverName,
            station: "ALL",
            priority: "NORMAL",
            targetPrepMinutes: 15,
            notes: `Dine-In Table ${table.tableNumber}`,
            status: "NEW",
            items: newItems.map((it: any) => ({
              name: it.name,
              quantity: it.quantity,
              unit: "portions",
              notes: it.notes,
              station: it.station || "HOT_KITCHEN",
              status: "PENDING",
            })),
          });
        } catch (kdsErr) {
          console.error("Auto KDS dispatch from table order failed:", kdsErr);
        }
      }
    } else if (action === "REQUEST_BILL") {
      table.status = "BILL_REQUESTED";
    } else if (action === "MARK_CLEANING") {
      table.status = "CLEANING";
      table.currentOrder = undefined as any;
    } else if (action === "CLEAN_TABLE") {
      table.status = "AVAILABLE";
      table.currentOrder = undefined as any;
    } else if (action === "RESERVE") {
      const { customerName, phone, reservedTime, guestCount = 2, notes } = body;
      table.status = "RESERVED";
      table.reservation = {
        customerName: customerName?.trim() || "Guest",
        phone: phone?.trim() || "",
        reservedTime: new Date(reservedTime || Date.now() + 60 * 60 * 1000),
        guestCount: Number(guestCount) || 2,
        notes: notes?.trim() || undefined,
      };
    } else if (action === "CANCEL_RESERVATION") {
      table.status = "AVAILABLE";
      table.reservation = undefined as any;
    } else if (action === "MOVE_TABLE") {
      const { targetTableId } = body;
      const targetTable = await RestaurantTable.findById(targetTableId);
      if (!targetTable) {
        return NextResponse.json({ error: "Target table not found" }, { status: 404 });
      }
      if (targetTable.status !== "AVAILABLE") {
        return NextResponse.json(
          { error: `Target table ${targetTable.tableNumber} is currently ${targetTable.status}.` },
          { status: 400 }
        );
      }

      // Transfer order to target table
      targetTable.currentOrder = table.currentOrder;
      targetTable.status = "OCCUPIED";
      await targetTable.save();

      // Reset source table
      table.currentOrder = undefined as any;
      table.status = "AVAILABLE";
    } else if (action === "UPDATE_POSITION") {
      const { x, y } = body;
      if (typeof x === "number" && typeof y === "number") {
        table.position = { x, y };
      }
    } else {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    await table.save();

    return NextResponse.json({
      success: true,
      table,
      message: `Table ${table.tableNumber} updated (${table.status})`,
    });
  } catch (error: any) {
    console.error("PATCH /api/tables/[id] error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update restaurant table" },
      { status: 500 }
    );
  }
}

// DELETE /api/tables/[id] - Soft delete table
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const table = await RestaurantTable.findById(params.id);
    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    table.isActive = false;
    await table.save();

    return NextResponse.json({
      success: true,
      message: `Table ${table.tableNumber} deleted`,
    });
  } catch (error: any) {
    console.error("DELETE /api/tables/[id] error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete table" },
      { status: 500 }
    );
  }
}
