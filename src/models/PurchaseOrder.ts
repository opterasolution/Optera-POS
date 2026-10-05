import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type PurchaseOrderStatus = "DRAFT" | "SENT" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";

export type PurchaseOrderPaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID";

export type VendorFulfillmentStatus = "PENDING" | "ACKNOWLEDGED" | "IN_TRANSIT" | "REJECTED";

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
  vendorAvailability?: "AVAILABLE" | "SHORTAGE" | "OUT_OF_STOCK";
  vendorConfirmedQuantity?: number;
  vendorNotes?: string;
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
  earlyPaymentDiscountPercentage?: number; // e.g. 2.0 for 2%
  earlyPaymentDiscountDays?: number; // e.g. 10 days ("2/10 Net 30")
  discountDeadline?: Date; // calculated discount cut-off date
  eligibleDiscountAmount?: number; // netTotal * (discountPercentage / 100)
  discountApplied?: boolean; // whether discount was claimed
  discountAmountTaken?: number; // actual cash discount deducted
  paidAmount?: number; // actual net cash disbursed
  paymentStatus?: PurchaseOrderPaymentStatus; // UNPAID, PARTIALLY_PAID, PAID
  totalDebtOffset?: number; // paidAmount + discountAmountTaken
  expectedDeliveryDate?: Date;
  supplierInvoiceNumber?: string; // Bill number from supplier delivery invoice
  rfqId?: Types.ObjectId;
  rfqNumber?: string;
  vendorAccessToken?: string;
  dispatchDetails?: {
    dispatchedAt?: Date;
    dispatchedBy?: string;
    channel?: "WHATSAPP" | "EMAIL" | "DIRECT_LINK" | "MANUAL";
    recipientPhone?: string;
    recipientEmail?: string;
  };
  vendorAcknowledgement?: {
    status: VendorFulfillmentStatus;
    acknowledgedAt?: Date;
    estimatedDeliveryDate?: Date;
    vendorReferenceNumber?: string;
    repName?: string;
    repPhone?: string;
    dispatchInvoiceNumber?: string;
    vehicleNumber?: string;
    driverName?: string;
    driverPhone?: string;
    dispatchedAt?: Date;
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
    vendorAvailability: {
      type: String,
      enum: ["AVAILABLE", "SHORTAGE", "OUT_OF_STOCK"],
    },
    vendorConfirmedQuantity: {
      type: Number,
    },
    vendorNotes: {
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
    earlyPaymentDiscountPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    earlyPaymentDiscountDays: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountDeadline: {
      type: Date,
      index: true,
    },
    eligibleDiscountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountApplied: {
      type: Boolean,
      default: false,
    },
    discountAmountTaken: {
      type: Number,
      default: 0,
      min: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ["UNPAID", "PARTIALLY_PAID", "PAID"],
      default: "UNPAID",
      index: true,
    },
    totalDebtOffset: {
      type: Number,
      default: 0,
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
    vendorAccessToken: {
      type: String,
      trim: true,
      index: true,
    },
    dispatchDetails: {
      dispatchedAt: { type: Date },
      dispatchedBy: { type: String, trim: true },
      channel: {
        type: String,
        enum: ["WHATSAPP", "EMAIL", "DIRECT_LINK", "MANUAL"],
      },
      recipientPhone: { type: String, trim: true },
      recipientEmail: { type: String, trim: true },
    },
    vendorAcknowledgement: {
      status: {
        type: String,
        enum: ["PENDING", "ACKNOWLEDGED", "IN_TRANSIT", "REJECTED"],
        default: "PENDING",
      },
      acknowledgedAt: { type: Date },
      estimatedDeliveryDate: { type: Date },
      vendorReferenceNumber: { type: String, trim: true },
      repName: { type: String, trim: true },
      repPhone: { type: String, trim: true },
      dispatchInvoiceNumber: { type: String, trim: true },
      vehicleNumber: { type: String, trim: true },
      driverName: { type: String, trim: true },
      driverPhone: { type: String, trim: true },
      dispatchedAt: { type: Date },
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

import crypto from "crypto";

export function generatePoAccessToken(poId: string): string {
  const hash = crypto.randomBytes(12).toString("hex");
  return `po_${poId.slice(-6)}_${hash}`;
}

export default PurchaseOrder;
