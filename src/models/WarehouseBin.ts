import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type BinType =
  | "PRIMARY_PICK"
  | "BULK_OVERSTOCK"
  | "QUARANTINE"
  | "COLD_STORAGE"
  | "STAGING";

export type BinStatus = "AVAILABLE" | "NEAR_FULL" | "FULL" | "MAINTENANCE" | "INACTIVE";

export type TemperatureZone = "AMBIENT" | "CHILLED" | "FROZEN" | "SECURE_CAGE";

export interface IBinCapacity {
  maxUnits: number;
  maxWeightKg?: number;
  maxVolumeCbm?: number;
}

export interface IBinOccupancy {
  totalUnits: number;
  totalWeightKg?: number;
  utilizationPercent: number; // 0 - 100
}

export interface IWarehouseBin extends Document {
  businessId: Types.ObjectId;
  branchId: Types.ObjectId;
  branchName: string;
  zone: string; // e.g. "ZA", "ZB", "ZC", "ZQ"
  zoneName: string; // e.g. "Zone A - Ambient Grocery", "Zone Q - Quarantine"
  aisle: string; // e.g. "A01", "A02"
  rack: string; // e.g. "R01", "R02"
  shelf: string; // e.g. "S01", "S02"
  binCode: string; // e.g. "ZA-A01-R01-S01"
  barcode: string; // Scannable barcode representation
  binType: BinType;
  capacity: IBinCapacity;
  currentOccupancy: IBinOccupancy;
  sequenceOrder: number; // For minimal walking path sorting
  temperatureZone: TemperatureZone;
  status: BinStatus;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function generateBinCode(
  zone: string,
  aisle: string,
  rack: string,
  shelf: string
): string {
  const z = (zone || "ZA").trim().toUpperCase();
  const a = (aisle || "A01").trim().toUpperCase();
  const r = (rack || "R01").trim().toUpperCase();
  const s = (shelf || "S01").trim().toUpperCase();
  return `${z}-${a}-${r}-${s}`;
}

export function calculateSequenceOrder(
  zone: string,
  aisle: string,
  rack: string,
  shelf: string
): number {
  // Extract numbers to construct an integer route sequence:
  // e.g. Zone A (1) * 1000000 + Aisle 01 (1) * 10000 + Rack 02 (2) * 100 + Shelf 03 (3) = 1010203
  const zCharCode = (zone || "ZA").charCodeAt(1) || (zone || "ZA").charCodeAt(0) || 65;
  const aNum = parseInt(aisle?.replace(/[^0-9]/g, "") || "1", 10);
  const rNum = parseInt(rack?.replace(/[^0-9]/g, "") || "1", 10);
  const sNum = parseInt(shelf?.replace(/[^0-9]/g, "") || "1", 10);

  return (zCharCode - 64) * 1000000 + aNum * 10000 + rNum * 100 + sNum;
}

const WarehouseBinSchema = new Schema<IWarehouseBin>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
      index: true,
    },
    branchName: {
      type: String,
      required: true,
      trim: true,
    },
    zone: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    zoneName: {
      type: String,
      required: true,
      trim: true,
    },
    aisle: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    rack: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    shelf: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    binCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    barcode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    binType: {
      type: String,
      enum: ["PRIMARY_PICK", "BULK_OVERSTOCK", "QUARANTINE", "COLD_STORAGE", "STAGING"],
      default: "PRIMARY_PICK",
      index: true,
    },
    capacity: {
      maxUnits: { type: Number, required: true, default: 200, min: 1 },
      maxWeightKg: { type: Number, min: 0 },
      maxVolumeCbm: { type: Number, min: 0 },
    },
    currentOccupancy: {
      totalUnits: { type: Number, default: 0, min: 0 },
      totalWeightKg: { type: Number, default: 0, min: 0 },
      utilizationPercent: { type: Number, default: 0, min: 0, max: 100 },
    },
    sequenceOrder: {
      type: Number,
      default: 1,
      index: true,
    },
    temperatureZone: {
      type: String,
      enum: ["AMBIENT", "CHILLED", "FROZEN", "SECURE_CAGE"],
      default: "AMBIENT",
    },
    status: {
      type: String,
      enum: ["AVAILABLE", "NEAR_FULL", "FULL", "MAINTENANCE", "INACTIVE"],
      default: "AVAILABLE",
      index: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Compound indexes
WarehouseBinSchema.index({ businessId: 1, branchId: 1, binCode: 1 }, { unique: true });
WarehouseBinSchema.index({ businessId: 1, branchId: 1, zone: 1, aisle: 1 });
WarehouseBinSchema.index({ businessId: 1, barcode: 1 });
WarehouseBinSchema.index({ businessId: 1, branchId: 1, sequenceOrder: 1 });

export const WarehouseBin: Model<IWarehouseBin> =
  mongoose.models.WarehouseBin ||
  mongoose.model<IWarehouseBin>("WarehouseBin", WarehouseBinSchema);

export default WarehouseBin;
