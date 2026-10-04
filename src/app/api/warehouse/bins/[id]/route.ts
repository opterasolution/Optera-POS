import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { WarehouseBin } from "@/models/WarehouseBin";
import { BinStock } from "@/models/BinStock";
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

      const bin = await WarehouseBin.findOne({ _id: id, businessId }).lean();
      if (!bin) {
        return NextResponse.json(
          { success: false, error: "Warehouse bin not found." },
          { status: 404 }
        );
      }

      // Fetch all stock items located in this bin
      const stockItems = await BinStock.find({
        businessId,
        binId: id,
        quantity: { $gt: 0 },
      }).sort({ productName: 1 }).lean();

      return NextResponse.json({
        success: true,
        bin,
        stockItems,
      });
    }

    return NextResponse.json(
      { success: false, error: "Database unavailable." },
      { status: 503 }
    );
  } catch (error: any) {
    console.error("Error in GET /api/warehouse/bins/[id]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch bin details" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPER_ADMIN"]);
    const { id } = await params;
    const body = await req.json();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const bin = await WarehouseBin.findOne({ _id: id, businessId });
      if (!bin) {
        return NextResponse.json(
          { success: false, error: "Warehouse bin not found." },
          { status: 404 }
        );
      }

      const {
        zoneName,
        binType,
        maxUnits,
        maxWeightKg,
        temperatureZone,
        status,
        notes,
        isActive,
      } = body;

      if (zoneName !== undefined) bin.zoneName = zoneName;
      if (binType !== undefined) bin.binType = binType;
      if (temperatureZone !== undefined) bin.temperatureZone = temperatureZone;
      if (notes !== undefined) bin.notes = notes;
      if (isActive !== undefined) bin.isActive = isActive;

      if (maxUnits !== undefined) {
        bin.capacity.maxUnits = Number(maxUnits);
      }
      if (maxWeightKg !== undefined) {
        bin.capacity.maxWeightKg = Number(maxWeightKg);
      }

      // Recalculate occupancy and status
      const totalUnits = bin.currentOccupancy.totalUnits || 0;
      const capacityUnits = bin.capacity.maxUnits || 1;
      const utilization = Math.min(100, Math.round((totalUnits / capacityUnits) * 100));
      bin.currentOccupancy.utilizationPercent = utilization;

      if (status !== undefined) {
        bin.status = status;
      } else {
        if (utilization >= 100) {
          bin.status = "FULL";
        } else if (utilization >= 85) {
          bin.status = "NEAR_FULL";
        } else if (bin.status !== "MAINTENANCE" && bin.status !== "INACTIVE") {
          bin.status = "AVAILABLE";
        }
      }

      await bin.save();

      await AuditLog.create({
        businessId,
        userId: context.userId,
        action: "UPDATE_WAREHOUSE_BIN",
        entity: "WarehouseBin",
        entityId: bin._id,
        details: `Updated bin ${bin.binCode} capacity/type/status`,
      });

      return NextResponse.json({
        success: true,
        bin,
      });
    }

    return NextResponse.json(
      { success: false, error: "Database unavailable." },
      { status: 503 }
    );
  } catch (error: any) {
    console.error("Error in PUT /api/warehouse/bins/[id]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update bin" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPER_ADMIN"]);
    const { id } = await params;

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const bin = await WarehouseBin.findOne({ _id: id, businessId });
      if (!bin) {
        return NextResponse.json(
          { success: false, error: "Warehouse bin not found." },
          { status: 404 }
        );
      }

      // Check if stock exists in bin
      const activeStock = await BinStock.findOne({
        businessId,
        binId: id,
        quantity: { $gt: 0 },
      });

      if (activeStock) {
        return NextResponse.json(
          {
            success: false,
            error: `Cannot delete bin ${bin.binCode} because it contains active inventory (${activeStock.productName}: ${activeStock.quantity} units). Clear or transfer stock first.`,
          },
          { status: 400 }
        );
      }

      bin.isActive = false;
      bin.status = "INACTIVE";
      await bin.save();

      await AuditLog.create({
        businessId,
        userId: context.userId,
        action: "DEACTIVATE_WAREHOUSE_BIN",
        entity: "WarehouseBin",
        entityId: bin._id,
        details: `Deactivated bin ${bin.binCode}`,
      });

      return NextResponse.json({
        success: true,
        message: `Bin ${bin.binCode} has been deactivated.`,
      });
    }

    return NextResponse.json(
      { success: false, error: "Database unavailable." },
      { status: 503 }
    );
  } catch (error: any) {
    console.error("Error in DELETE /api/warehouse/bins/[id]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete bin" },
      { status: 500 }
    );
  }
}
