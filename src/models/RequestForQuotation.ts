import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type RfqStatus = "DRAFT" | "OPEN" | "EVALUATING" | "AWARDED" | "CLOSED" | "CANCELLED";
export type InvitedSupplierStatus = "INVITED" | "SUBMITTED" | "DECLINED" | "AWARDED";
export type BidStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export interface IRfqItem {
  productId: Types.ObjectId;
  productName: string;
  sku?: string;
  requestedQty: number;
  unit: string;
  targetPrice?: number;
  specifications?: string;
}

export interface IInvitedSupplier {
  supplierId: Types.ObjectId;
  supplierName: string;
  email?: string;
  phone: string;
  token: string; // Unique token for direct bidding via link
  status: InvitedSupplierStatus;
  invitedAt: Date;
  submittedAt?: Date;
}

export interface ISupplierBidItem {
  productId: Types.ObjectId;
  productName: string;
  offeredQty: number;
  unitCost: number;
  discountPercent?: number;
  netUnitCost: number;
  totalCost: number;
  leadTimeDays: number;
  notes?: string;
}

export interface ISupplierBid {
  supplierId: Types.ObjectId;
  supplierName: string;
  token: string;
  submittedAt: Date;
  items: ISupplierBidItem[];
  subtotal: number;
  taxAmount: number;
  netTotal: number;
  validUntil?: Date;
  deliveryTerms?: string;
  paymentTerms?: string;
  notes?: string;
  status: BidStatus;
}

export interface IRequestForQuotation extends Document {
  businessId: Types.ObjectId;
  rfqNumber: string; // e.g. "RFQ-20261003-0001"
  title: string;
  description?: string;
  requiredByDate: Date;
  deadlineDate: Date;
  status: RfqStatus;
  items: IRfqItem[];
  invitedSuppliers: IInvitedSupplier[];
  bids: ISupplierBid[];
  awardedSupplierId?: Types.ObjectId;
  awardedSupplierName?: string;
  awardedPoId?: Types.ObjectId;
  awardedPoNumber?: string;
  awardedAt?: Date;
  awardedNotes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export function generateBidToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "bid_";
  for (let i = 0; i < 24; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

const RfqItemSchema = new Schema<IRfqItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true, trim: true },
    sku: { type: String, trim: true },
    requestedQty: { type: Number, required: true, min: 1 },
    unit: { type: String, default: "pcs", trim: true },
    targetPrice: { type: Number, min: 0 },
    specifications: { type: String, trim: true },
  },
  { _id: false }
);

const InvitedSupplierSchema = new Schema<IInvitedSupplier>(
  {
    supplierId: { type: Schema.Types.ObjectId, ref: "Supplier", required: true },
    supplierName: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    token: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["INVITED", "SUBMITTED", "DECLINED", "AWARDED"],
      default: "INVITED",
    },
    invitedAt: { type: Date, default: Date.now },
    submittedAt: { type: Date },
  },
  { _id: false }
);

const SupplierBidItemSchema = new Schema<ISupplierBidItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true, trim: true },
    offeredQty: { type: Number, required: true, min: 1 },
    unitCost: { type: Number, required: true, min: 0 },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    netUnitCost: { type: Number, required: true, min: 0 },
    totalCost: { type: Number, required: true, min: 0 },
    leadTimeDays: { type: Number, default: 2, min: 0 },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const SupplierBidSchema = new Schema<ISupplierBid>(
  {
    supplierId: { type: Schema.Types.ObjectId, ref: "Supplier", required: true },
    supplierName: { type: String, required: true, trim: true },
    token: { type: String, required: true, trim: true },
    submittedAt: { type: Date, default: Date.now },
    items: { type: [SupplierBidItemSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    netTotal: { type: Number, required: true, min: 0 },
    validUntil: { type: Date },
    deliveryTerms: { type: String, trim: true },
    paymentTerms: { type: String, trim: true },
    notes: { type: String, trim: true },
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "REJECTED"],
      default: "PENDING",
    },
  },
  { _id: false }
);

const RequestForQuotationSchema = new Schema<IRequestForQuotation>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    rfqNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    requiredByDate: {
      type: Date,
      required: true,
    },
    deadlineDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["DRAFT", "OPEN", "EVALUATING", "AWARDED", "CLOSED", "CANCELLED"],
      default: "OPEN",
      index: true,
    },
    items: {
      type: [RfqItemSchema],
      required: true,
      validate: [(val: IRfqItem[]) => val.length > 0, "At least one item is required in RFQ"],
    },
    invitedSuppliers: {
      type: [InvitedSupplierSchema],
      default: [],
    },
    bids: {
      type: [SupplierBidSchema],
      default: [],
    },
    awardedSupplierId: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
    },
    awardedSupplierName: {
      type: String,
      trim: true,
    },
    awardedPoId: {
      type: Schema.Types.ObjectId,
      ref: "PurchaseOrder",
    },
    awardedPoNumber: {
      type: String,
      trim: true,
    },
    awardedAt: {
      type: Date,
    },
    awardedNotes: {
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
RequestForQuotationSchema.index({ businessId: 1, rfqNumber: 1 }, { unique: true });
RequestForQuotationSchema.index({ businessId: 1, status: 1 });
RequestForQuotationSchema.index({ businessId: 1, deadlineDate: 1 });
RequestForQuotationSchema.index({ businessId: 1, createdAt: -1 });
RequestForQuotationSchema.index({ "invitedSuppliers.token": 1 }, { sparse: true });

export const RequestForQuotation: Model<IRequestForQuotation> =
  mongoose.models.RequestForQuotation ||
  mongoose.model<IRequestForQuotation>("RequestForQuotation", RequestForQuotationSchema);

export default RequestForQuotation;
