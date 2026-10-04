import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import {
  WarehouseBin,
  IWarehouseBin,
  BinType,
  BinStatus,
  TemperatureZone,
  generateBinCode,
  calculateSequenceOrder,
} from "@/models/WarehouseBin";
import { BinStock } from "@/models/BinStock";
import { Branch } from "@/models/Branch";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth, requireRole } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const context = await requireAuth();
    const { searchParams } = new URL(req.url);

    const branchId = searchParams.get("branchId");
    const zone = searchParams.get("zone");
    const binType = searchParams.get("binType");
    const status = searchParams.get("status");
    const search = searchParams.get("q")?.trim() || "";

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const query: any = { businessId, isActive: true };

      if (branchId && branchId !== "ALL") {
        query.branchId = branchId;
      }
      if (zone && zone !== "ALL") {
        query.zone = zone;
      }
      if (binType && binType !== "ALL") {
        query.binType = binType;
      }
      if (status && status !== "ALL") {
        query.status = status;
      }
      if (search) {
        query.$or = [
          { binCode: { $regex: search, $options: "i" } },
          { barcode: { $regex: search, $options: "i" } },
          { zoneName: { $regex: search, $options: "i" } },
          { aisle: { $regex: search, $options: "i" } },
        ];
      }

      let bins = await WarehouseBin.find(query).sort({ sequenceOrder: 1 }).lean();

      // Auto-seed default warehouse spatial layout if 0 bins exist
      if (bins.length === 0 && !search && (!binType || binType === "ALL") && (!status || status === "ALL")) {
        // Find or use branch
        let targetBranch: any = null;
        if (branchId && branchId !== "ALL") {
          targetBranch = await Branch.findOne({ _id: branchId, businessId }).lean();
        } else {
          targetBranch = await Branch.findOne({ businessId, isMainWarehouse: true }).lean() ||
                         await Branch.findOne({ businessId }).lean();
        }

        if (targetBranch) {
          const seedBins: Partial<IWarehouseBin>[] = [];

          // Zone A: Fast-Moving Dry Grocery (Aisles A01-A02, Racks R01-R02, Shelves S01-S03)
          const zoneAisles = ["A01", "A02"];
          const zoneRacks = ["R01", "R02"];
          const zoneShelves = ["S01", "S02", "S03"];

          for (const aisle of zoneAisles) {
            for (const rack of zoneRacks) {
              for (const shelf of zoneShelves) {
                const bCode = generateBinCode("ZA", aisle, rack, shelf);
                const seq = calculateSequenceOrder("ZA", aisle, rack, shelf);
                // Shelf S01 is Primary Pick face (ground level), S02-S03 are Bulk Overstock
                const bType: BinType = shelf === "S01" ? "PRIMARY_PICK" : "BULK_OVERSTOCK";
                const maxUnits = shelf === "S01" ? 150 : 400;

                seedBins.push({
                  businessId: targetBranch.businessId,
                  branchId: targetBranch._id,
                  branchName: targetBranch.name,
                  zone: "ZA",
                  zoneName: "Zone A - Fast Moving Groceries",
                  aisle,
                  rack,
                  shelf,
                  binCode: bCode,
                  barcode: bCode.replace(/-/g, ""),
                  binType: bType,
                  capacity: { maxUnits, maxWeightKg: maxUnits * 1.5 },
                  currentOccupancy: { totalUnits: 0, utilizationPercent: 0 },
                  sequenceOrder: seq,
                  temperatureZone: "AMBIENT",
                  status: "AVAILABLE",
                  isActive: true,
                });
              }
            }
          }

          // Zone C: Cold Storage (Aisle C01, Rack R01, Shelves S01-S02)
          for (const shelf of ["S01", "S02"]) {
            const bCode = generateBinCode("ZC", "C01", "R01", shelf);
            const seq = calculateSequenceOrder("ZC", "C01", "R01", shelf);
            seedBins.push({
              businessId: targetBranch.businessId,
              branchId: targetBranch._id,
              branchName: targetBranch.name,
              zone: "ZC",
              zoneName: "Zone C - Cold Chain & Dairy",
              aisle: "C01",
              rack: "R01",
              shelf,
              binCode: bCode,
              barcode: bCode.replace(/-/g, ""),
              binType: "COLD_STORAGE",
              capacity: { maxUnits: 100, maxWeightKg: 120 },
              currentOccupancy: { totalUnits: 0, utilizationPercent: 0 },
              sequenceOrder: seq,
              temperatureZone: "CHILLED",
              status: "AVAILABLE",
              isActive: true,
            });
          }

          // Zone Q: Quarantine & Defect Inspection Dock (Aisle Q01, Rack R01, Shelves S01-S02)
          for (const shelf of ["S01", "S02"]) {
            const bCode = generateBinCode("ZQ", "Q01", "R01", shelf);
            const seq = calculateSequenceOrder("ZQ", "Q01", "R01", shelf);
            seedBins.push({
              businessId: targetBranch.businessId,
              branchId: targetBranch._id,
              branchName: targetBranch.name,
              zone: "ZQ",
              zoneName: "Zone Q - Defect & Quarantine Holding",
              aisle: "Q01",
              rack: "R01",
              shelf,
              binCode: bCode,
              barcode: bCode.replace(/-/g, ""),
              binType: "QUARANTINE",
              capacity: { maxUnits: 80, maxWeightKg: 100 },
              currentOccupancy: { totalUnits: 0, utilizationPercent: 0 },
              sequenceOrder: seq,
              temperatureZone: "AMBIENT",
              status: "AVAILABLE",
              isActive: true,
            });
          }

          await WarehouseBin.insertMany(seedBins, { ordered: false }).catch(() => {});
          bins = await WarehouseBin.find(query).sort({ sequenceOrder: 1 }).lean();
        }
      }

      // Compute statistics
      const totalBins = bins.length;
      let totalCapacityUnits = 0;
      let totalOccupiedUnits = 0;
      let primaryPickCount = 0;
      let bulkOverstockCount = 0;
      let quarantineCount = 0;
      let coldStorageCount = 0;

      bins.forEach((b) => {
        totalCapacityUnits += b.capacity?.maxUnits || 0;
        totalOccupiedUnits += b.currentOccupancy?.totalUnits || 0;
        if (b.binType === "PRIMARY_PICK") primaryPickCount++;
        else if (b.binType === "BULK_OVERSTOCK") bulkOverstockCount++;
        else if (b.binType === "QUARANTINE") quarantineCount++;
        else if (b.binType === "COLD_STORAGE") coldStorageCount++;
      });

      const overallUtilization = totalCapacityUnits > 0
        ? Math.round((totalOccupiedUnits / totalCapacityUnits) * 100)
        : 0;

      // Group distinct zones for filter dropdown
      const distinctZones = Array.from(
        new Set(bins.map((b) => JSON.stringify({ zone: b.zone, zoneName: b.zoneName })))
      ).map((str) => JSON.parse(str));

      return NextResponse.json({
        success: true,
        bins,
        stats: {
          totalBins,
          totalCapacityUnits,
          totalOccupiedUnits,
          overallUtilization,
          primaryPickCount,
          bulkOverstockCount,
          quarantineCount,
          coldStorageCount,
        },
        zones: distinctZones,
      });
    }

    return NextResponse.json({
      success: true,
      bins: [],
      stats: {
        totalBins: 0,
        totalCapacityUnits: 0,
        totalOccupiedUnits: 0,
        overallUtilization: 0,
        primaryPickCount: 0,
        bulkOverstockCount: 0,
        quarantineCount: 0,
        coldStorageCount: 0,
      },
      zones: [],
    });
  } catch (error: any) {
    console.error("Error in GET /api/warehouse/bins:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch warehouse bins" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPER_ADMIN"]);
    const body = await req.json();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const {
        branchId,
        batchMode,
        // Single bin fields
        zone,
        zoneName,
        aisle,
        rack,
        shelf,
        binType = "PRIMARY_PICK",
        temperatureZone = "AMBIENT",
        maxUnits = 100,
        maxWeightKg,
        notes,
        // Batch generator fields
        batchConfig,
      } = body;

      if (!branchId) {
        return NextResponse.json(
          { success: false, error: "Branch ID is required." },
          { status: 400 }
        );
      }

      const branch = await Branch.findOne({ _id: branchId, businessId }).lean();
      if (!branch) {
        return NextResponse.json(
          { success: false, error: "Branch not found." },
          { status: 404 }
        );
      }

      if (batchMode && batchConfig) {
        // Batch generator: create grid of bins
        // batchConfig: { zone, zoneName, aislePrefix, aisleStart, aisleEnd, rackStart, rackEnd, shelfStart, shelfEnd, binType, maxUnits, temperatureZone }
        const {
          zone: bZone = "ZA",
          zoneName: bZoneName = "Main Storage Zone",
          aislePrefix = "A",
          aisleStart = 1,
          aisleEnd = 2,
          rackStart = 1,
          rackEnd = 2,
          shelfStart = 1,
          shelfEnd = 3,
          binType: bType = "PRIMARY_PICK",
          maxUnits: bMaxUnits = 100,
          temperatureZone: bTempZone = "AMBIENT",
        } = batchConfig;

        const binsToCreate: any[] = [];

        for (let a = Number(aisleStart); a <= Number(aisleEnd); a++) {
          const aisleStr = `${aislePrefix}${String(a).padStart(2, "0")}`;
          for (let r = Number(rackStart); r <= Number(rackEnd); r++) {
            const rackStr = `R${String(r).padStart(2, "0")}`;
            for (let s = Number(shelfStart); s <= Number(shelfEnd); s++) {
              const shelfStr = `S${String(s).padStart(2, "0")}`;
              const binCode = generateBinCode(bZone, aisleStr, rackStr, shelfStr);
              const seq = calculateSequenceOrder(bZone, aisleStr, rackStr, shelfStr);

              // Auto-assign PRIMARY_PICK to shelf 1, BULK_OVERSTOCK to higher shelves if not explicitly overridden
              const resolvedType: BinType =
                bType === "PRIMARY_PICK" && s > 1 ? "BULK_OVERSTOCK" : (bType as BinType);

              binsToCreate.push({
                businessId,
                branchId: branch._id,
                branchName: branch.name,
                zone: bZone.toUpperCase(),
                zoneName: bZoneName,
                aisle: aisleStr,
                rack: rackStr,
                shelf: shelfStr,
                binCode,
                barcode: binCode.replace(/-/g, ""),
                binType: resolvedType,
                capacity: {
                  maxUnits: Number(bMaxUnits),
                  maxWeightKg: Number(bMaxUnits) * 1.5,
                },
                currentOccupancy: {
                  totalUnits: 0,
                  utilizationPercent: 0,
                },
                sequenceOrder: seq,
                temperatureZone: bTempZone as TemperatureZone,
                status: "AVAILABLE",
                isActive: true,
              });
            }
          }
        }

        const created = await WarehouseBin.insertMany(binsToCreate, { ordered: false });

        await AuditLog.create({
          businessId,
          userId: context.userId,
          action: "BATCH_CREATE_WAREHOUSE_BINS",
          entity: "WarehouseBin",
          details: `Batch created ${created.length} warehouse bins in branch ${branch.name} for zone ${bZone}`,
        });

        return NextResponse.json({
          success: true,
          count: created.length,
          message: `Successfully created ${created.length} warehouse bins.`,
        });
      }

      // Single bin creation
      if (!zone || !aisle || !rack || !shelf) {
        return NextResponse.json(
          { success: false, error: "Zone, aisle, rack, and shelf are required." },
          { status: 400 }
        );
      }

      const formattedZone = zone.trim().toUpperCase();
      const formattedAisle = aisle.trim().toUpperCase();
      const formattedRack = rack.trim().toUpperCase();
      const formattedShelf = shelf.trim().toUpperCase();

      const binCode = generateBinCode(formattedZone, formattedAisle, formattedRack, formattedShelf);
      const seq = calculateSequenceOrder(formattedZone, formattedAisle, formattedRack, formattedShelf);

      const existing = await WarehouseBin.findOne({
        businessId,
        branchId: branch._id,
        binCode,
      });

      if (existing) {
        return NextResponse.json(
          { success: false, error: `Bin code ${binCode} already exists in this branch.` },
          { status: 409 }
        );
      }

      const newBin = await WarehouseBin.create({
        businessId,
        branchId: branch._id,
        branchName: branch.name,
        zone: formattedZone,
        zoneName: zoneName || `Zone ${formattedZone}`,
        aisle: formattedAisle,
        rack: formattedRack,
        shelf: formattedShelf,
        binCode,
        barcode: binCode.replace(/-/g, ""),
        binType,
        capacity: {
          maxUnits: Number(maxUnits) || 100,
          maxWeightKg: maxWeightKg ? Number(maxWeightKg) : undefined,
        },
        currentOccupancy: {
          totalUnits: 0,
          utilizationPercent: 0,
        },
        sequenceOrder: seq,
        temperatureZone,
        status: "AVAILABLE",
        notes,
        isActive: true,
      });

      await AuditLog.create({
        businessId,
        userId: context.userId,
        action: "CREATE_WAREHOUSE_BIN",
        entity: "WarehouseBin",
        entityId: newBin._id,
        details: `Created bin ${binCode} in branch ${branch.name}`,
      });

      return NextResponse.json({
        success: true,
        bin: newBin,
      });
    }

    return NextResponse.json(
      { success: false, error: "Database unavailable." },
      { status: 503 }
    );
  } catch (error: any) {
    console.error("Error in POST /api/warehouse/bins:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create warehouse bin" },
      { status: 500 }
    );
  }
}
