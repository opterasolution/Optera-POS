import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type StockTransferStatus = "DRAFT" | "IN_TRANSIT" | "COMPLETED" | "CANCELLED";

export interface IStockTransferItem {
  productId: Types.ObjectId;
  name: string;
  sku?: string;
  unit: string;
  quantitySent: number;
  quantityReceived?: number;
  unitCost?: number;
  notes?: string;
}

export interface IStockTransfer extends Document {
  businessId: Types.ObjectId;
  transferNumber: string; // e.g. "STN-20260930-0001"
  sourceBranchId: Types.ObjectId;
  sourceBranchName: string;
  destinationBranchId: Types.ObjectId;
  destinationBranchName: string;
  status: StockTransferStatus;
  items: IStockTransferItem[];
  totalItemsSent: number;
  totalItemsReceived?: number;
  dispatchedBy?: string;
  dispatchedAt?: Date;
  receivedBy?: string;
  receivedAt?: Date;
  cancelledBy?: string;
  cancelledAt?: Date;
  cancellationReason?: string;
  carrierName?: string; // e.g. "Store Van WP-CAB-1234", "PromptX Courier"
  trackingReference?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const StockTransferItemSchema = new Schema<IStockTransferItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    sku: {
      type: String,
      trim: true,
    },
    unit: {
      type: String,
      default: "pcs",
      trim: true,
    },
    quantitySent: {
      type: Number,
      required: true,
      min: 1,
    },
    quantityReceived: {
      type: Number,
      min: 0,
    },
    unitCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const StockTransferSchema = new Schema<IStockTransfer>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    transferNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    sourceBranchId: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
      index: true,
    },
    sourceBranchName: {
      type: String,
      required: true,
      trim: true,
    },
    destinationBranchId: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
      index: true,
    },
    destinationBranchName: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["DRAFT", "IN_TRANSIT", "COMPLETED", "CANCELLED"],
      default: "DRAFT",
      index: true,
    },
    items: {
      type: [StockTransferItemSchema],
      required: true,
      validate: [(val: IStockTransferItem[]) => val.length > 0, "At least one item is required in transfer"],
    },
    totalItemsSent: {
      type: Number,
      required: true,
      min: 1,
    },
    totalItemsReceived: {
      type: Number,
      min: 0,
    },
    dispatchedBy: {
      type: String,
      trim: true,
    },
    dispatchedAt: {
      type: Date,
    },
    receivedBy: {
      type: String,
      trim: true,
    },
    receivedAt: {
      type: Date,
    },
    cancelledBy: {
      type: String,
      trim: true,
    },
    cancelledAt: {
      type: Date,
    },
    cancellationReason: {
      type: String,
      trim: true,
    },
    carrierName: {
      type: String,
      trim: true,
    },
    trackingReference: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Compound indexes
StockTransferSchema.index({ businessId: 1, transferNumber: 1 }, { unique: true });
StockTransferSchema.index({ businessId: 1, status: 1 });
StockTransferSchema.index({ businessId: 1, sourceBranchId: 1 });
StockTransferSchema.index({ businessId: 1, destinationBranchId: 1 });

export const StockTransfer: Model<IStockTransfer> =
  mongoose.models.StockTransfer || mongoose.model<IStockTransfer>("StockTransfer", StockTransferSchema);

export default StockTransfer;
