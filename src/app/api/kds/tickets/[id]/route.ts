import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/db";
import KitchenTicket from "@/models/KitchenTicket";

interface Params {
  params: { id: string };
}

// PATCH /api/kds/tickets/[id] - Bump, toggle items, rush, recall or cancel ticket
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const { id } = params;
    const body = await req.json();
    const { action, itemId, itemIndex, cancelReason } = body;

    const ticket = await KitchenTicket.findById(id);
    if (!ticket) {
      return NextResponse.json({ error: "Kitchen ticket not found" }, { status: 404 });
    }

    const now = new Date();

    if (action === "BUMP") {
      // Step progression: NEW -> PREPARING -> READY -> SERVED
      if (ticket.status === "NEW") {
        ticket.status = "PREPARING";
        ticket.startedAt = now;
      } else if (ticket.status === "PREPARING") {
        ticket.status = "READY";
        ticket.readyAt = now;
        // Mark all unfinished items as COMPLETED
        ticket.items.forEach((it) => {
          if (it.status !== "VOIDED") it.status = "COMPLETED";
        });
      } else if (ticket.status === "READY") {
        ticket.status = "SERVED";
        ticket.servedAt = now;
      }
    } else if (action === "TOGGLE_ITEM") {
      let targetItem: any = null;
      if (itemId) {
        targetItem = ticket.items.find((it: any) => it._id?.toString() === itemId || it.itemId === itemId);
      }
      if (!targetItem && typeof itemIndex === "number" && ticket.items[itemIndex]) {
        targetItem = ticket.items[itemIndex];
      }

      if (targetItem) {
        targetItem.status = targetItem.status === "COMPLETED" ? "PENDING" : "COMPLETED";

        // If ticket was NEW, start it automatically when an item is interacted with
        if (ticket.status === "NEW") {
          ticket.status = "PREPARING";
          ticket.startedAt = now;
        }

        // Check if all non-voided items are completed
        const allDone = ticket.items.every(
          (it: any) => it.status === "COMPLETED" || it.status === "VOIDED"
        );
        if (allDone) {
          ticket.status = "READY";
          ticket.readyAt = now;
        }
      }
    } else if (action === "TOGGLE_RUSH") {
      ticket.priority = ticket.priority === "RUSH" ? "NORMAL" : "RUSH";
    } else if (action === "RECALL") {
      ticket.status = "READY";
      ticket.servedAt = undefined;
    } else if (action === "CANCEL") {
      ticket.status = "CANCELLED";
      ticket.cancelledAt = now;
      if (cancelReason) {
        ticket.notes = ticket.notes
          ? `${ticket.notes} | Cancelled: ${cancelReason}`
          : `Cancelled: ${cancelReason}`;
      }
    } else {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    await ticket.save();

    return NextResponse.json({
      success: true,
      ticket,
      message: `Ticket ${ticket.ticketNumber} updated (${ticket.status})`,
    });
  } catch (error: any) {
    console.error("PATCH /api/kds/tickets/[id] error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update kitchen ticket" },
      { status: 500 }
    );
  }
}

// DELETE /api/kds/tickets/[id] - Void ticket
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const { id } = params;

    const ticket = await KitchenTicket.findById(id);
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    ticket.status = "CANCELLED";
    ticket.cancelledAt = new Date();
    await ticket.save();

    return NextResponse.json({
      success: true,
      message: `Ticket ${ticket.ticketNumber} cancelled`,
    });
  } catch (error: any) {
    console.error("DELETE /api/kds/tickets/[id] error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to cancel ticket" },
      { status: 500 }
    );
  }
}
