import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type StockTransferStatus = "DRAFT" | "IN_TRANSIT" | "COMPLETED" | "CANCELLED";
export type TransferDiscrepancyReason =
  | "SHORTAGE_IN_TRANSIT"
  | "DAMAGED_IN_TRANSIT"
  | "WRONG_ITEM"
  | "OVER_DELIVERED"
  | "NONE";

export type TransferDiscrepancyAction =
  | "ACCEPT_SHORTAGE"
  | "CLAIM_DRIVER"
  | "RETURN_TO_SENDER"
  | "RECONCILED";

export interface IStockTransferItem {
  productId: Types.ObjectId;
  name: string;
  sku?: string;
  barcode?: string;
  unit: string;
  quantitySent: number;
  quantityReceived?: number;
  quantityDamagedInTransit?: number;
  discrepancyReason?: TransferDiscrepancyReason;
  discrepancyAction?: TransferDiscrepancyAction;
  discrepancyNotes?: string;
  unitCost?: number;
  totalSentCost?: number;
  totalReceivedCost?: number;
  batchNumber?: string;
  expiryDate?: Date;
  notes?: string;
}

export function generateTransferManifestToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "stn_";
  for (let i = 0; i < 24; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
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
  totalTransitValue: number; // In-transit inventory financial valuation (Rs.)
  totalReceivedValue?: number;
  totalDiscrepancyValue?: number;
  discrepancyStatus?: "NO_DISCREPANCY" | "SHORTAGE" | "OVERAGE" | "DAMAGED";
  discrepancyResolved?: boolean;
  discrepancyResolutionNotes?: string;
  discrepancyResolvedBy?: string;
  discrepancyResolvedAt?: Date;
  dispatchedBy?: string;
  dispatchedAt?: Date;
  receivedBy?: string;
  receivedAt?: Date;
  cancelledBy?: string;
  cancelledAt?: Date;
  cancellationReason?: string;
  carrierName?: string; // e.g. "Company Logistics", "PromptX"
  vehicleNumber?: string; // e.g. "WP-CAB-4921"
  driverName?: string;
  driverPhone?: string;
  gatePassOutTime?: Date;
  estimatedArrival?: Date;
  trackingReference?: string;
  manifestToken?: string;
  pickListId?: Types.ObjectId;
  pickListNumber?: string;
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
    barcode: {
      type: String,
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
    quantityDamagedInTransit: {
      type: Number,
      min: 0,
      default: 0,
    },
    discrepancyReason: {
      type: String,
      enum: [
        "SHORTAGE_IN_TRANSIT",
        "DAMAGED_IN_TRANSIT",
        "WRONG_ITEM",
        "OVER_DELIVERED",
        "NONE",
      ],
      default: "NONE",
    },
    discrepancyAction: {
      type: String,
      enum: [
        "ACCEPT_SHORTAGE",
        "CLAIM_DRIVER",
        "RETURN_TO_SENDER",
        "RECONCILED",
      ],
    },
    discrepancyNotes: {
      type: String,
      trim: true,
    },
    unitCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalSentCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalReceivedCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    batchNumber: {
      type: String,
      trim: true,
    },
    expiryDate: {
      type: Date,
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
    totalTransitValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalReceivedValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalDiscrepancyValue: {
      type: Number,
      default: 0,
    },
    discrepancyStatus: {
      type: String,
      enum: ["NO_DISCREPANCY", "SHORTAGE", "OVERAGE", "DAMAGED"],
      default: "NO_DISCREPANCY",
      index: true,
    },
    discrepancyResolved: {
      type: Boolean,
      default: true,
    },
    discrepancyResolutionNotes: {
      type: String,
      trim: true,
    },
    discrepancyResolvedBy: {
      type: String,
      trim: true,
    },
    discrepancyResolvedAt: {
      type: Date,
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
    vehicleNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },
    driverName: {
      type: String,
      trim: true,
    },
    driverPhone: {
      type: String,
      trim: true,
    },
    gatePassOutTime: {
      type: Date,
    },
    estimatedArrival: {
      type: Date,
    },
    trackingReference: {
      type: String,
      trim: true,
    },
    manifestToken: {
      type: String,
      trim: true,
      index: true,
    },
    pickListId: {
      type: Schema.Types.ObjectId,
      ref: "PickList",
    },
    pickListNumber: {
      type: String,
      trim: true,
      uppercase: true,
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
