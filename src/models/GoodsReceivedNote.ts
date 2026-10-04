import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type GrnStatus = "DRAFT" | "CONFIRMED" | "CANCELLED";
export type GrnInspectionStatus = "PENDING_INSPECTION" | "PASSED" | "PARTIALLY_ACCEPTED" | "REJECTED";
export type GrnRejectionReason =
  | "DAMAGED_PACKAGING"
  | "EXPIRED_SHORT_DATE"
  | "WRONG_ITEM"
  | "QUALITY_DEFECT"
  | "TEMPERATURE_EXCURSION"
  | "OTHER";

export interface IGrnItem {
  productId: Types.ObjectId;
  name: string;
  sku?: string;
  unit: string;
  orderedQuantity: number;
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  rejectionReason?: GrnRejectionReason | string;
  rejectionNotes?: string;
  unitCost: number;
  acceptedTotalCost: number;
  rejectedTotalCost: number;
  batchNumber?: string;
  manufacturingDate?: Date;
  expiryDate?: Date;
  mrp?: number;
  sellingPrice?: number;
  qcInspectionNotes?: string;
  suggestedBinId?: Types.ObjectId;
  suggestedBinCode?: string;
  putawayBinId?: Types.ObjectId;
  putawayBinCode?: string;
  putawayStatus?: "PENDING" | "PUTAWAY_DONE";
}

export interface IGoodsReceivedNote extends Document {
  businessId: Types.ObjectId;
  grnNumber: string; // e.g. "GRN-20261003-0001"
  purchaseOrderId: Types.ObjectId;
  poNumber: string;
  supplierId: Types.ObjectId;
  supplierName: string;
  supplierInvoiceNumber?: string;
  supplierInvoiceDate?: Date;
  branchId?: Types.ObjectId;
  branchName?: string;
  status: GrnStatus;
  inspectionStatus: GrnInspectionStatus;
  putawayStatus?: "PENDING" | "PARTIAL" | "COMPLETED";
  items: IGrnItem[];
  totalOrderedCost: number;
  totalAcceptedCost: number;
  totalRejectedCost: number;
  notes?: string;
  receivedBy: string;
  inspectedBy?: string;
  confirmedBy?: string;
  confirmedAt?: Date;
  cancelledBy?: string;
  cancelledAt?: Date;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const GrnItemSchema = new Schema<IGrnItem>(
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
    orderedQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    receivedQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    acceptedQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    rejectedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    rejectionNotes: {
      type: String,
      trim: true,
    },
    unitCost: {
      type: Number,
      required: true,
      min: 0,
    },
    acceptedTotalCost: {
      type: Number,
      required: true,
      min: 0,
    },
    rejectedTotalCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    batchNumber: {
      type: String,
      trim: true,
    },
    manufacturingDate: {
      type: Date,
    },
    expiryDate: {
      type: Date,
    },
    mrp: {
      type: Number,
      min: 0,
    },
    sellingPrice: {
      type: Number,
      min: 0,
    },
    qcInspectionNotes: {
      type: String,
      trim: true,
    },
    suggestedBinId: {
      type: Schema.Types.ObjectId,
      ref: "WarehouseBin",
    },
    suggestedBinCode: {
      type: String,
      trim: true,
      uppercase: true,
    },
    putawayBinId: {
      type: Schema.Types.ObjectId,
      ref: "WarehouseBin",
    },
    putawayBinCode: {
      type: String,
      trim: true,
      uppercase: true,
    },
    putawayStatus: {
      type: String,
      enum: ["PENDING", "PUTAWAY_DONE"],
      default: "PENDING",
    },
  },
  { _id: false }
);

const GoodsReceivedNoteSchema = new Schema<IGoodsReceivedNote>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    grnNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    purchaseOrderId: {
      type: Schema.Types.ObjectId,
      ref: "PurchaseOrder",
      required: true,
      index: true,
    },
    poNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
      index: true,
    },
    supplierName: {
      type: String,
      required: true,
      trim: true,
    },
    supplierInvoiceNumber: {
      type: String,
      trim: true,
    },
    supplierInvoiceDate: {
      type: Date,
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      index: true,
    },
    branchName: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["DRAFT", "CONFIRMED", "CANCELLED"],
      default: "CONFIRMED",
      index: true,
    },
    inspectionStatus: {
      type: String,
      enum: ["PENDING_INSPECTION", "PASSED", "PARTIALLY_ACCEPTED", "REJECTED"],
      default: "PASSED",
      index: true,
    },
    putawayStatus: {
      type: String,
      enum: ["PENDING", "PARTIAL", "COMPLETED"],
      default: "PENDING",
      index: true,
    },
    items: {
      type: [GrnItemSchema],
      required: true,
      validate: [(val: IGrnItem[]) => val.length > 0, "At least one item required in GRN"],
    },
    totalOrderedCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAcceptedCost: {
      type: Number,
      required: true,
      min: 0,
    },
    totalRejectedCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
    receivedBy: {
      type: String,
      required: true,
      trim: true,
    },
    inspectedBy: {
      type: String,
      trim: true,
    },
    confirmedBy: {
      type: String,
      trim: true,
    },
    confirmedAt: {
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
  },
  { timestamps: true }
);

// Compound indexes
GoodsReceivedNoteSchema.index({ businessId: 1, grnNumber: 1 }, { unique: true });
GoodsReceivedNoteSchema.index({ businessId: 1, purchaseOrderId: 1 });
GoodsReceivedNoteSchema.index({ businessId: 1, supplierId: 1 });
GoodsReceivedNoteSchema.index({ businessId: 1, status: 1 });
GoodsReceivedNoteSchema.index({ businessId: 1, createdAt: -1 });

export const GoodsReceivedNote: Model<IGoodsReceivedNote> =
  mongoose.models.GoodsReceivedNote ||
  mongoose.model<IGoodsReceivedNote>("GoodsReceivedNote", GoodsReceivedNoteSchema);

export default GoodsReceivedNote;
