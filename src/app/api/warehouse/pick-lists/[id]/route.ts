import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { PickList } from "@/models/PickList";
import { BinStock } from "@/models/BinStock";
import { StockTransfer } from "@/models/StockTransfer";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth, requireRole } from "@/lib/tenant";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireAuth();
    const { id } = await params;

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const pickList = await PickList.findOne({ _id: id, businessId }).lean();
      if (!pickList) {
        return NextResponse.json(
          { success: false, error: "Pick list not found." },
          { status: 404 }
        );
      }

      // If linked to a StockTransfer, load reference transfer info
      let transfer = null;
      if (pickList.referenceId) {
        transfer = await StockTransfer.findOne({
          _id: pickList.referenceId,
          businessId,
        }).lean();
      }

      return NextResponse.json({
        success: true,
        pickList,
        transfer,
      });
    }

    return NextResponse.json(
      { success: false, error: "Database unavailable." },
      { status: 503 }
    );
  } catch (error: any) {
    console.error("Error in GET /api/warehouse/pick-lists/[id]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch pick list" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "INVENTORY_CLERK", "SUPER_ADMIN"]);
    const { id } = await params;
    const body = await req.json();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const pickList = await PickList.findOne({ _id: id, businessId });
      if (!pickList) {
        return NextResponse.json(
          { success: false, error: "Pick list not found." },
          { status: 404 }
        );
      }

      const { assignedPickerName, priority, notes, status } = body;

      if (assignedPickerName !== undefined) pickList.assignedPickerName = assignedPickerName;
      if (priority !== undefined) pickList.priority = priority;
      if (notes !== undefined) pickList.notes = notes;

      // Handle cancellation -> release reserved stock
      if (status === "CANCELLED" && pickList.status !== "CANCELLED" && pickList.status !== "DISPATCHED") {
        for (const it of pickList.items) {
          const unpicked = Math.max(0, it.quantityRequested - it.quantityPicked);
          if (unpicked > 0) {
            await BinStock.updateOne(
              {
                businessId,
                branchId: pickList.sourceBranchId,
                binId: it.binId,
                productId: it.productId,
              },
              { $inc: { reservedQuantity: -unpicked } }
            );
          }
        }
        pickList.status = "CANCELLED";

        if (pickList.referenceId) {
          await StockTransfer.updateOne(
            { _id: pickList.referenceId, businessId },
            { $unset: { pickListId: "", pickListNumber: "" } }
          );
        }
      } else if (status) {
        pickList.status = status;
      }

      await pickList.save();

      await AuditLog.create({
        businessId,
        userId: context.userId,
        action: "UPDATE_PICK_LIST",
        entity: "PickList",
        entityId: pickList._id,
        details: `Updated pick list ${pickList.pickListNumber} status: ${pickList.status}`,
      });

      return NextResponse.json({
        success: true,
        pickList,
      });
    }

    return NextResponse.json(
      { success: false, error: "Database unavailable." },
      { status: 503 }
    );
  } catch (error: any) {
    console.error("Error in PUT /api/warehouse/pick-lists/[id]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update pick list" },
      { status: 500 }
    );
  }
}
