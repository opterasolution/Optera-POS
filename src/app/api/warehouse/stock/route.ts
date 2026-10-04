import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { BinStock } from "@/models/BinStock";
import { WarehouseBin } from "@/models/WarehouseBin";
import { requireAuth } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const context = await requireAuth();
    const { searchParams } = new URL(req.url);

    const branchId = searchParams.get("branchId");
    const binId = searchParams.get("binId");
    const productId = searchParams.get("productId");
    const isPrimaryPick = searchParams.get("isPrimaryPick");
    const lowStockOnly = searchParams.get("lowStockOnly") === "true";
    const search = searchParams.get("q")?.trim() || "";

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const query: any = { businessId, quantity: { $gt: 0 } };

      if (branchId && branchId !== "ALL") {
        query.branchId = branchId;
      }
      if (binId) {
        query.binId = binId;
      }
      if (productId) {
        query.productId = productId;
      }
      if (isPrimaryPick !== null && isPrimaryPick !== undefined && isPrimaryPick !== "ALL") {
        query.isPrimaryPick = isPrimaryPick === "true";
      }
      if (search) {
        query.$or = [
          { binCode: { $regex: search, $options: "i" } },
          { productName: { $regex: search, $options: "i" } },
          { sku: { $regex: search, $options: "i" } },
          { barcode: { $regex: search, $options: "i" } },
          { batchNumber: { $regex: search, $options: "i" } },
        ];
      }

      let stock = await BinStock.find(query).sort({ binCode: 1, productName: 1 }).lean();

      if (lowStockOnly) {
        stock = stock.filter(
          (item) =>
            item.minReplenishThreshold !== undefined &&
            item.quantity <= item.minReplenishThreshold
        );
      }

      // Populate bin details (zone, aisle, rack, shelf)
      const binIds = Array.from(new Set(stock.map((s) => s.binId.toString())));
      const bins = await WarehouseBin.find({ _id: { $in: binIds } }).lean();
      const binMap = new Map(bins.map((b) => [b._id.toString(), b]));

      const enrichedStock = stock.map((s) => {
        const bin = binMap.get(s.binId.toString());
        return {
          ...s,
          zone: bin?.zone || "",
          zoneName: bin?.zoneName || "",
          aisle: bin?.aisle || "",
          rack: bin?.rack || "",
          shelf: bin?.shelf || "",
          binType: bin?.binType || "PRIMARY_PICK",
          temperatureZone: bin?.temperatureZone || "AMBIENT",
          isLowReplenish:
            s.minReplenishThreshold !== undefined &&
            s.quantity <= s.minReplenishThreshold,
        };
      });

      // Total aggregated metrics
      const totalUnits = enrichedStock.reduce((sum, item) => sum + item.quantity, 0);
      const totalReserved = enrichedStock.reduce(
        (sum, item) => sum + (item.reservedQuantity || 0),
        0
      );
      const lowStockAlerts = enrichedStock.filter((s) => s.isLowReplenish).length;

      return NextResponse.json({
        success: true,
        stock: enrichedStock,
        metrics: {
          totalRecords: enrichedStock.length,
          totalUnits,
          totalReserved,
          lowStockAlerts,
        },
      });
    }

    return NextResponse.json({
      success: true,
      stock: [],
      metrics: {
        totalRecords: 0,
        totalUnits: 0,
        totalReserved: 0,
        lowStockAlerts: 0,
      },
    });
  } catch (error: any) {
    console.error("Error in GET /api/warehouse/stock:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch bin stock" },
      { status: 500 }
    );
  }
}
