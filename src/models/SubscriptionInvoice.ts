import mongoose, { Schema, Document, Model } from "mongoose";

export type BillingCycle = "MONTHLY" | "QUARTERLY" | "BI_ANNUAL" | "ANNUAL";
export type SubscriptionInvoicePaymentMethod = "BANK_TRANSFER" | "CASH" | "ONLINE_CARD" | "CHEQUE" | "OTHER";
export type SubscriptionInvoiceStatus = "PAID" | "PENDING" | "CANCELLED";

export interface ISubscriptionInvoice extends Document {
  invoiceNumber: string; // e.g. SUB-2026-0001
  businessId: mongoose.Types.ObjectId;
  businessName: string;
  ownerName: string;
  phone: string;
  email?: string;
  address?: string;
  plan: "TRIAL" | "BASIC" | "PROFESSIONAL" | "ENTERPRISE";
  billingCycle: BillingCycle;
  durationMonths: number;
  amount: number; // LKR
  discountAmount?: number;
  taxAmount?: number;
  paymentMethod: SubscriptionInvoicePaymentMethod;
  paymentReference?: string;
  bankName?: string;
  periodStart: Date;
  periodEnd: Date;
  status: SubscriptionInvoiceStatus;
  issuedAt: Date;
  paidAt?: Date;
  notes?: string;
  createdById?: string;
  createdByName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionInvoiceSchema = new Schema<ISubscriptionInvoice>(
  {
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    businessName: { type: String, required: true, trim: true },
    ownerName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    plan: {
      type: String,
      enum: ["TRIAL", "BASIC", "PROFESSIONAL", "ENTERPRISE"],
      required: true,
    },
    billingCycle: {
      type: String,
      enum: ["MONTHLY", "QUARTERLY", "BI_ANNUAL", "ANNUAL"],
      default: "MONTHLY",
    },
    durationMonths: { type: Number, required: true, min: 1, default: 1 },
    amount: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    paymentMethod: {
      type: String,
      enum: ["BANK_TRANSFER", "CASH", "ONLINE_CARD", "CHEQUE", "OTHER"],
      default: "BANK_TRANSFER",
    },
    paymentReference: { type: String, trim: true },
    bankName: { type: String, trim: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    status: {
      type: String,
      enum: ["PAID", "PENDING", "CANCELLED"],
      default: "PAID",
      index: true,
    },
    issuedAt: { type: Date, default: Date.now },
    paidAt: { type: Date, default: Date.now },
    notes: { type: String, trim: true },
    createdById: { type: String },
    createdByName: { type: String },
  },
  { timestamps: true }
);

// Helpful compound index for queries
SubscriptionInvoiceSchema.index({ businessId: 1, createdAt: -1 });

export const SubscriptionInvoice: Model<ISubscriptionInvoice> =
  mongoose.models.SubscriptionInvoice ||
  mongoose.model<ISubscriptionInvoice>("SubscriptionInvoice", SubscriptionInvoiceSchema);

export default SubscriptionInvoice;
