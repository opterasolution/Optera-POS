import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { DeliveryOrder } from "@/models/DeliveryOrder";
import { requireAuth } from "@/lib/tenant";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireAuth();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const order = await DeliveryOrder.findOne({
        _id: params.id,
        businessId: context.businessId,
      });

      if (!order) {
        return NextResponse.json({ success: false, error: "Delivery order not found." }, { status: 404 });
      }

      return NextResponse.json({ success: true, order });
    }

    return NextResponse.json({
      success: true,
      order: { _id: params.id, status: "ACCEPTED" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load delivery order";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireAuth();
    const body = await req.json();
    const { action, prepTimeMinutes, enteredPin, cancelReason, riderUpdate } = body;

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const order = await DeliveryOrder.findOne({
        _id: params.id,
        businessId: context.businessId,
      });

      if (!order) {
        return NextResponse.json({ success: false, error: "Delivery order not found." }, { status: 404 });
      }

      const now = new Date();
      let newStatus = order.status;
      let notes = "";

      switch (action) {
        case "ACCEPT":
          newStatus = "ACCEPTED";
          order.acceptedAt = now;
          if (prepTimeMinutes) {
            order.prepTimeMinutes = Number(prepTimeMinutes);
          }
          order.scheduledPrepEnd = new Date(now.getTime() + order.prepTimeMinutes * 60 * 1000);
          notes = `Order accepted with ${order.prepTimeMinutes} mins prep time.`;
          break;

        case "START_PREP":
          newStatus = "PREPARING";
          notes = "Kitchen started preparation.";
          break;

        case "MARK_READY":
          newStatus = "READY_FOR_PICKUP";
          order.readyAt = now;
          notes = "Order packed and waiting for delivery partner pickup.";
          break;

        case "HANDOVER":
          // Security verification: Verify rider pickup PIN
          if (enteredPin && enteredPin.trim() !== order.rider.pickupPin.trim()) {
            return NextResponse.json(
              {
                success: false,
                error: `Invalid Pickup PIN "${enteredPin}". Please verify the 4-digit code on the driver's phone app.`,
              },
              { status: 400 }
            );
          }
          newStatus = "OUT_FOR_DELIVERY";
          order.dispatchedAt = now;
          order.rider.handoverConfirmedAt = now;
          order.rider.handoverConfirmedBy = context.username || "Counter Staff";
          notes = `Order securely handed over to rider ${order.rider.name || ""} (${order.rider.vehicleNumber || ""}) after PIN verification.`;
          break;

        case "MARK_DELIVERED":
          newStatus = "DELIVERED";
          order.deliveredAt = now;
          notes = "Delivery completed and confirmed by platform.";
          break;

        case "CANCEL":
        case "REJECT":
          newStatus = action === "REJECT" ? "REJECTED" : "CANCELLED";
          order.cancelReason = cancelReason || "Store cancelled order";
          notes = `Order ${newStatus.toLowerCase()}: ${order.cancelReason}`;
          break;

        case "UPDATE_RIDER":
          if (riderUpdate) {
            if (riderUpdate.name) order.rider.name = riderUpdate.name;
            if (riderUpdate.phone) order.rider.phone = riderUpdate.phone;
            if (riderUpdate.vehicleNumber) order.rider.vehicleNumber = riderUpdate.vehicleNumber;
            if (riderUpdate.vehicleType) order.rider.vehicleType = riderUpdate.vehicleType;
            if (riderUpdate.arrivalEtaMinutes !== undefined)
              order.rider.arrivalEtaMinutes = riderUpdate.arrivalEtaMinutes;
            if (riderUpdate.arrivedAtStore !== undefined)
              order.rider.arrivedAtStore = riderUpdate.arrivedAtStore;
            notes = `Rider details updated (${order.rider.name || "Driver"}, ${order.rider.vehicleNumber || ""}).`;
          }
          break;

        default:
          return NextResponse.json({ success: false, error: `Invalid action: ${action}` }, { status: 400 });
      }

      order.status = newStatus;
      order.auditTrail.push({
        timestamp: now,
        status: newStatus,
        actor: context.username || "Staff",
        notes,
      });

      await order.save();
      return NextResponse.json({ success: true, order });
    }

    return NextResponse.json({
      success: true,
      order: { _id: params.id, status: body.action || "ACCEPTED" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update delivery order";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
