import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type PurchaseOrderStatus = "DRAFT" | "SENT" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";

export interface IPurchaseOrderItem {
  productId: Types.ObjectId;
  name: string;
  sku?: string;
  unit: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  total: number;
  batchNumber?: string;
  manufacturingDate?: Date;
  expiryDate?: Date;
  notes?: string;
}

export interface IPurchaseOrder extends Document {
  businessId: Types.ObjectId;
  poNumber: string; // e.g. "PO-20260930-0001"
  supplierId: Types.ObjectId;
  supplierName: string;
  branchId?: Types.ObjectId;
  branchName?: string;
  status: PurchaseOrderStatus;
  items: IPurchaseOrderItem[];
  subtotal: number;
  taxTotal: number;
  netTotal: number;
  expectedDeliveryDate?: Date;
  supplierInvoiceNumber?: string; // Bill number from supplier delivery invoice
  rfqId?: Types.ObjectId;
  rfqNumber?: string;
  vendorAcknowledgement?: {
    status: "PENDING" | "ACKNOWLEDGED" | "REJECTED";
    acknowledgedAt?: Date;
    estimatedDeliveryDate?: Date;
    dispatchInvoiceNumber?: string;
    driverName?: string;
    driverPhone?: string;
    notes?: string;
  };
  receivedAt?: Date;
  receivedBy?: string;
  cancelledAt?: Date;
  cancelledBy?: string;
  cancellationReason?: string;
  notes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseOrderItemSchema = new Schema<IPurchaseOrderItem>(
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
    quantityOrdered: {
      type: Number,
      required: true,
      min: 1,
    },
    quantityReceived: {
      type: Number,
      default: 0,
      min: 0,
    },
    unitCost: {
      type: Number,
      required: true,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
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
    notes: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const PurchaseOrderSchema = new Schema<IPurchaseOrder>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
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
      enum: ["DRAFT", "SENT", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"],
      default: "DRAFT",
      index: true,
    },
    items: {
      type: [PurchaseOrderItemSchema],
      required: true,
      validate: [(val: IPurchaseOrderItem[]) => val.length > 0, "At least one item required in PO"],
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    taxTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    netTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    expectedDeliveryDate: {
      type: Date,
    },
    supplierInvoiceNumber: {
      type: String,
      trim: true,
    },
    rfqId: {
      type: Schema.Types.ObjectId,
      ref: "RequestForQuotation",
      index: true,
    },
    rfqNumber: {
      type: String,
      trim: true,
    },
    vendorAcknowledgement: {
      status: {
        type: String,
        enum: ["PENDING", "ACKNOWLEDGED", "REJECTED"],
        default: "PENDING",
      },
      acknowledgedAt: { type: Date },
      estimatedDeliveryDate: { type: Date },
      dispatchInvoiceNumber: { type: String, trim: true },
      driverName: { type: String, trim: true },
      driverPhone: { type: String, trim: true },
      notes: { type: String, trim: true },
    },
    receivedAt: {
      type: Date,
    },
    receivedBy: {
      type: String,
      trim: true,
    },
    cancelledAt: {
      type: Date,
    },
    cancelledBy: {
      type: String,
      trim: true,
    },
    cancellationReason: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

// Compound indexes
PurchaseOrderSchema.index({ businessId: 1, poNumber: 1 }, { unique: true });
PurchaseOrderSchema.index({ businessId: 1, supplierId: 1 });
PurchaseOrderSchema.index({ businessId: 1, status: 1 });
PurchaseOrderSchema.index({ businessId: 1, createdAt: -1 });

export const PurchaseOrder: Model<IPurchaseOrder> =
  mongoose.models.PurchaseOrder || mongoose.model<IPurchaseOrder>("PurchaseOrder", PurchaseOrderSchema);

export default PurchaseOrder;
