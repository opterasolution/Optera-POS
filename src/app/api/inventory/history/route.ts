import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { InventoryMovement } from "@/models/InventoryMovement";
import { requireAuth } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const context = await requireAuth();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const productId = searchParams.get("productId");

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const filter: Record<string, unknown> = {
        businessId: context.businessId,
      };

      if (type && type !== "all") {
        filter.type = type;
      }

      if (productId) {
        filter.productId = productId;
      }

      const movements = await InventoryMovement.find(filter)
        .populate("productId", "name unit barcode")
        .populate("createdBy", "name username")
        .sort({ createdAt: -1 })
        .limit(100);

      return NextResponse.json({ success: true, movements });
    }

    // Demo Data
    return NextResponse.json({
      success: true,
      movements: [
        {
          _id: "demo_m1",
          type: "SALE",
          quantityChange: -3,
          previousStock: 25,
          newStock: 22,
          reason: "POS Sale INV-2026-0034",
          createdAt: new Date().toISOString(),
          productId: { name: "Munchee Super Cream Cracker 490g", unit: "packet" },
          createdBy: { name: "Admin" },
        },
        {
          _id: "demo_m2",
          type: "RESTOCK",
          quantityChange: 15,
          previousStock: 7,
          newStock: 22,
          reason: "Supplier delivery (Prima Ceylon)",
          createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          productId: { name: "Prima Special Flour 1kg", unit: "packet" },
          createdBy: { name: "Admin" },
        },
        {
          _id: "demo_m3",
          type: "DAMAGE",
          quantityChange: -2,
          previousStock: 10,
          newStock: 8,
          reason: "Torn carton packaging during transit",
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          productId: { name: "Kotmale Fresh Milk 1L", unit: "bottle" },
          createdBy: { name: "Admin" },
        },
      ],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load stock history";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
