import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type CampaignStatus = "DRAFT" | "SCHEDULED" | "RUNNING" | "COMPLETED" | "CANCELLED";

export type CampaignSegment =
  | "ALL"
  | "CHAMPIONS"
  | "LOYAL"
  | "POTENTIAL_LOYAL"
  | "NEW_CUSTOMERS"
  | "AT_RISK"
  | "HIBERNATING"
  | "HIGH_SPENDERS"
  | "CUSTOM";

export type CampaignLanguage = "EN" | "SI" | "TA" | "MULTI";

export interface ICampaignCustomFilter {
  minSpend?: number;
  maxSpend?: number;
  minVisits?: number;
  maxDaysInactive?: number;
  minDaysInactive?: number;
  loyaltyTiers?: string[];
}

export interface ICampaignCouponConfig {
  enabled: boolean;
  codePrefix: string; // e.g. "SAVE15", "AVURUDU", "VIP20"
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number; // e.g. 15 for 15% or 500 for Rs. 500
  minSpend: number; // Minimum cart subtotal in LKR (e.g. 2000)
  validDays: number; // Days valid from dispatch (e.g. 7)
}

export interface ICampaignStats {
  totalTargeted: number;
  smsSent: number;
  smsFailed: number;
  smsSimulated: number;
  smsCost: number; // In LKR (e.g. Rs. 0.40 per SMS)
  couponsIssued: number;
  couponsRedeemed: number;
  revenueGenerated: number; // Cumulative LKR gross sales from redeemed coupons
  discountGiven: number; // Cumulative LKR discounts absorbed
  roiPercent: number; // (revenueGenerated - smsCost - discountGiven) / (smsCost + discountGiven) * 100
}

export interface ICampaignRecipient {
  customerId: Types.ObjectId;
  customerName: string;
  phone: string;
  segment: string;
  couponCode?: string;
  couponExpiresAt?: Date;
  smsStatus: "PENDING" | "SENT" | "FAILED" | "SIMULATED";
  smsLogId?: Types.ObjectId;
  sentAt?: Date;
  redeemed: boolean;
  redeemedAt?: Date;
  saleId?: Types.ObjectId;
  invoiceNumber?: string;
  saleAmount?: number;
  discountAmount?: number;
}

export interface IPromotionalCampaign extends Document {
  businessId: Types.ObjectId;
  campaignNumber: string; // CMP-YYYYMMDD-XXXX
  name: string;
  description?: string;
  status: CampaignStatus;
  targetSegment: CampaignSegment;
  customFilter?: ICampaignCustomFilter;
  messageTemplate: string;
  language: CampaignLanguage;
  couponConfig: ICampaignCouponConfig;
  stats: ICampaignStats;
  recipients: ICampaignRecipient[];
  scheduledAt?: Date;
  sentAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export function generateCampaignNumber(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `CMP-${yyyy}${mm}${dd}-${rand}`;
}

export function generateCouponCode(prefix: string): string {
  const cleanPrefix = (prefix || "PROMO")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 10);
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude ambiguous 0, O, 1, I
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${cleanPrefix}-${suffix}`;
}

const CampaignRecipientSchema = new Schema<ICampaignRecipient>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    customerName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    segment: { type: String, required: true },
    couponCode: { type: String, trim: true, uppercase: true },
    couponExpiresAt: { type: Date },
    smsStatus: {
      type: String,
      enum: ["PENDING", "SENT", "FAILED", "SIMULATED"],
      default: "PENDING",
    },
    smsLogId: { type: Schema.Types.ObjectId, ref: "SmsLog" },
    sentAt: { type: Date },
    redeemed: { type: Boolean, default: false },
    redeemedAt: { type: Date },
    saleId: { type: Schema.Types.ObjectId, ref: "Sale" },
    invoiceNumber: { type: String, trim: true },
    saleAmount: { type: Number, min: 0 },
    discountAmount: { type: Number, min: 0 },
  },
  { _id: true }
);

const PromotionalCampaignSchema = new Schema<IPromotionalCampaign>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    campaignNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["DRAFT", "SCHEDULED", "RUNNING", "COMPLETED", "CANCELLED"],
      default: "DRAFT",
      index: true,
    },
    targetSegment: {
      type: String,
      enum: [
        "ALL",
        "CHAMPIONS",
        "LOYAL",
        "POTENTIAL_LOYAL",
        "NEW_CUSTOMERS",
        "AT_RISK",
        "HIBERNATING",
        "HIGH_SPENDERS",
        "CUSTOM",
      ],
      default: "ALL",
    },
    customFilter: {
      minSpend: { type: Number, min: 0 },
      maxSpend: { type: Number, min: 0 },
      minVisits: { type: Number, min: 0 },
      maxDaysInactive: { type: Number, min: 0 },
      minDaysInactive: { type: Number, min: 0 },
      loyaltyTiers: [{ type: String }],
    },
    messageTemplate: {
      type: String,
      required: true,
    },
    language: {
      type: String,
      enum: ["EN", "SI", "TA", "MULTI"],
      default: "EN",
    },
    couponConfig: {
      enabled: { type: Boolean, default: false },
      codePrefix: { type: String, default: "PROMO", uppercase: true, trim: true },
      discountType: {
        type: String,
        enum: ["PERCENTAGE", "FIXED_AMOUNT"],
        default: "PERCENTAGE",
      },
      discountValue: { type: Number, default: 10, min: 0 },
      minSpend: { type: Number, default: 0, min: 0 },
      validDays: { type: Number, default: 7, min: 1 },
    },
    stats: {
      totalTargeted: { type: Number, default: 0, min: 0 },
      smsSent: { type: Number, default: 0, min: 0 },
      smsFailed: { type: Number, default: 0, min: 0 },
      smsSimulated: { type: Number, default: 0, min: 0 },
      smsCost: { type: Number, default: 0, min: 0 },
      couponsIssued: { type: Number, default: 0, min: 0 },
      couponsRedeemed: { type: Number, default: 0, min: 0 },
      revenueGenerated: { type: Number, default: 0, min: 0 },
      discountGiven: { type: Number, default: 0, min: 0 },
      roiPercent: { type: Number, default: 0 },
    },
    recipients: [CampaignRecipientSchema],
    scheduledAt: { type: Date },
    sentAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

// Indexes
PromotionalCampaignSchema.index({ businessId: 1, createdAt: -1 });
PromotionalCampaignSchema.index({ businessId: 1, status: 1 });
PromotionalCampaignSchema.index({ businessId: 1, campaignNumber: 1 }, { unique: true });
PromotionalCampaignSchema.index({ "recipients.couponCode": 1 }, { sparse: true });
PromotionalCampaignSchema.index({ "recipients.customerId": 1 });

export const PromotionalCampaign: Model<IPromotionalCampaign> =
  mongoose.models.PromotionalCampaign ||
  mongoose.model<IPromotionalCampaign>("PromotionalCampaign", PromotionalCampaignSchema);

export default PromotionalCampaign;
