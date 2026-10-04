import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IBinStock extends Document {
  businessId: Types.ObjectId;
  branchId: Types.ObjectId;
  binId: Types.ObjectId;
  binCode: string;
  productId: Types.ObjectId;
  productName: string;
  sku?: string;
  barcode?: string;
  unit: string;
  batchId?: Types.ObjectId;
  batchNumber?: string;
  expiryDate?: Date;
  quantity: number;
  reservedQuantity: number;
  isPrimaryPick: boolean;
  minReplenishThreshold?: number;
  maxReplenishCapacity?: number;
  lastStockAuditAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BinStockSchema = new Schema<IBinStock>(
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
    binId: {
      type: Schema.Types.ObjectId,
      ref: "WarehouseBin",
      required: true,
      index: true,
    },
    binCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    sku: {
      type: String,
      trim: true,
    },
    barcode: {
      type: String,
      trim: true,
    },
    unit: {
      type: String,
      default: "pcs",
      trim: true,
    },
    batchId: {
      type: Schema.Types.ObjectId,
      ref: "Batch",
    },
    batchNumber: {
      type: String,
      trim: true,
    },
    expiryDate: {
      type: Date,
    },
    quantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    reservedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    isPrimaryPick: {
      type: Boolean,
      default: false,
    },
    minReplenishThreshold: {
      type: Number,
      default: 10,
      min: 0,
    },
    maxReplenishCapacity: {
      type: Number,
      min: 0,
    },
    lastStockAuditAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Compound indexes
BinStockSchema.index({ businessId: 1, binId: 1, productId: 1, batchNumber: 1 });
BinStockSchema.index({ businessId: 1, branchId: 1, productId: 1 });
BinStockSchema.index({ businessId: 1, branchId: 1, binCode: 1 });
BinStockSchema.index({ businessId: 1, isPrimaryPick: 1 });

export const BinStock: Model<IBinStock> =
  mongoose.models.BinStock || mongoose.model<IBinStock>("BinStock", BinStockSchema);

export default BinStock;
