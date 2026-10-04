import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { PickList, IPickListItem } from "@/models/PickList";
import { requireRole } from "@/lib/tenant";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "INVENTORY_CLERK", "CASHIER", "SUPER_ADMIN"]);
    const { id } = await params;
    const body = await req.json();

    const {
      itemIndex,
      productId,
      barcodeScanned,
      quantityPicked = 1,
      notes,
    } = body;

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

      if (pickList.status === "PICKED" || pickList.status === "DISPATCHED" || pickList.status === "CANCELLED") {
        return NextResponse.json(
          { success: false, error: `Cannot modify item on a ${pickList.status} pick list.` },
          { status: 400 }
        );
      }

      // Find item
      let item: IPickListItem | undefined;
      if (itemIndex !== undefined && pickList.items[itemIndex]) {
        item = pickList.items[itemIndex];
      } else if (productId) {
        item = pickList.items.find((it) => it.productId.toString() === productId);
      }

      if (!item) {
        return NextResponse.json(
          { success: false, error: "Pick list item not found." },
          { status: 404 }
        );
      }

      // Barcode verification (if scanned)
      let barcodeMatched = true;
      if (barcodeScanned) {
        const cleanScan = barcodeScanned.trim().toUpperCase();
        const expectedBarcodes = [
          item.barcode?.toUpperCase(),
          item.sku?.toUpperCase(),
          item.binCode?.toUpperCase(),
          item.binCode?.replace(/-/g, "").toUpperCase(),
        ].filter(Boolean);

        if (expectedBarcodes.length > 0 && !expectedBarcodes.includes(cleanScan)) {
          barcodeMatched = false;
        }
      }

      const qtyToAdd = Number(quantityPicked) || 1;
      item.quantityPicked = Math.min(item.quantityRequested, (item.quantityPicked || 0) + qtyToAdd);
      item.itemStatus = item.quantityPicked >= item.quantityRequested ? "PICKED" : "PENDING";
      item.pickedAt = new Date();
      if (notes) item.pickerNotes = notes;

      // Update aggregate pickedUnits
      pickList.pickedUnits = pickList.items.reduce((sum, it) => sum + (it.quantityPicked || 0), 0);

      const allItemsCompleted = pickList.items.every((it) => it.quantityPicked >= it.quantityRequested);
      if (allItemsCompleted) {
        pickList.status = "PICKED";
      } else if (pickList.status === "PENDING" && pickList.pickedUnits > 0) {
        pickList.status = "IN_PROGRESS";
      }

      if (!pickList.assignedPickerName) {
        pickList.assignedPickerName = context.username;
      }

      await pickList.save();

      return NextResponse.json({
        success: true,
        barcodeMatched,
        pickList,
        updatedItem: item,
      });
    }

    return NextResponse.json(
      { success: false, error: "Database unavailable." },
      { status: 503 }
    );
  } catch (error: any) {
    console.error("Error in POST /api/warehouse/pick-lists/[id]/pick-item:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to record pick item" },
      { status: 500 }
    );
  }
}
