import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type PickListType =
  | "STOCK_TRANSFER"
  | "DELIVERY_DISPATCH"
  | "WHOLESALE_ORDER"
  | "INTERNAL_REPLENISHMENT";

export type PickListStatus =
  | "DRAFT"
  | "PENDING"
  | "IN_PROGRESS"
  | "PICKED"
  | "DISPATCHED"
  | "CANCELLED";

export type PickItemStatus = "PENDING" | "PICKED" | "SHORTAGE" | "SUBSTITUTED";

export interface IPickListItem {
  productId: Types.ObjectId;
  productName: string;
  sku?: string;
  barcode?: string;
  unit: string;
  quantityRequested: number;
  quantityPicked: number;
  binId: Types.ObjectId;
  binCode: string;
  zone: string;
  aisle: string;
  rack: string;
  shelf: string;
  sequenceOrder: number; // Sorted ascending for single-pass walking path
  batchNumber?: string;
  expiryDate?: Date;
  itemStatus: PickItemStatus;
  pickedAt?: Date;
  pickerNotes?: string;
}

export interface IPickList extends Document {
  businessId: Types.ObjectId;
  pickListNumber: string; // e.g. "PCK-20261004-0001"
  type: PickListType;
  sourceBranchId: Types.ObjectId;
  sourceBranchName: string;
  destinationBranchId?: Types.ObjectId;
  destinationBranchName?: string;
  referenceType?: "STOCK_TRANSFER" | "DELIVERY_ORDER" | "SALE" | "REPLENISHMENT";
  referenceId?: Types.ObjectId;
  referenceNumber?: string;
  status: PickListStatus;
  priority?: "NORMAL" | "HIGH" | "URGENT";
  assignedPickerId?: Types.ObjectId;
  assignedPickerName?: string;
  totalItems?: number;
  totalUnits?: number;
  pickedUnits?: number;
  totalItemsRequested?: number;
  totalItemsPicked?: number;
  items: IPickListItem[];
  startedAt?: Date;
  completedAt?: Date;
  notes?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}


export function generatePickListNumber(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `PCK-${yyyy}${mm}${dd}-${rand}`;
}

const PickListItemSchema = new Schema<IPickListItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
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
    quantityRequested: {
      type: Number,
      required: true,
      min: 1,
    },
    quantityPicked: {
      type: Number,
      default: 0,
      min: 0,
    },
    binId: {
      type: Schema.Types.ObjectId,
      ref: "WarehouseBin",
      required: true,
    },
    binCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    zone: {
      type: String,
      required: true,
      trim: true,
    },
    aisle: {
      type: String,
      required: true,
      trim: true,
    },
    rack: {
      type: String,
      required: true,
      trim: true,
    },
    shelf: {
      type: String,
      required: true,
      trim: true,
    },
    sequenceOrder: {
      type: Number,
      required: true,
      default: 1,
    },
    batchNumber: {
      type: String,
      trim: true,
    },
    expiryDate: {
      type: Date,
    },
    itemStatus: {
      type: String,
      enum: ["PENDING", "PICKED", "SHORTAGE", "SUBSTITUTED"],
      default: "PENDING",
    },
    pickedAt: {
      type: Date,
    },
    pickerNotes: {
      type: String,
      trim: true,
    },
  },
  { _id: true }
);

const PickListSchema = new Schema<IPickList>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    pickListNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    type: {
      type: String,
      enum: ["STOCK_TRANSFER", "DELIVERY_DISPATCH", "WHOLESALE_ORDER", "INTERNAL_REPLENISHMENT"],
      default: "STOCK_TRANSFER",
      index: true,
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
    },
    destinationBranchName: {
      type: String,
      trim: true,
    },
    referenceType: {
      type: String,
      enum: ["STOCK_TRANSFER", "DELIVERY_ORDER", "SALE", "REPLENISHMENT"],
    },
    referenceId: {
      type: Schema.Types.ObjectId,
    },
    referenceNumber: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["DRAFT", "PENDING", "IN_PROGRESS", "PICKED", "DISPATCHED", "CANCELLED"],
      default: "PENDING",
      index: true,
    },
    priority: {
      type: String,
      enum: ["NORMAL", "HIGH", "URGENT"],
      default: "NORMAL",
    },
    assignedPickerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    assignedPickerName: {
      type: String,
      trim: true,
    },
    totalItems: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalUnits: {
      type: Number,
      default: 0,
      min: 0,
    },
    pickedUnits: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalItemsRequested: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalItemsPicked: {
      type: Number,
      default: 0,
      min: 0,
    },
    createdBy: {
      type: String,
      trim: true,
    },
    items: [PickListItemSchema],

    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Indexes
PickListSchema.index({ businessId: 1, pickListNumber: 1 }, { unique: true });
PickListSchema.index({ businessId: 1, sourceBranchId: 1, status: 1 });
PickListSchema.index({ businessId: 1, createdAt: -1 });
PickListSchema.index({ businessId: 1, referenceId: 1 });

export const PickList: Model<IPickList> =
  mongoose.models.PickList || mongoose.model<IPickList>("PickList", PickListSchema);

export default PickList;
