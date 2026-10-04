import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface ICustomer extends Document {
  businessId: Types.ObjectId;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  customerType?: "RETAIL" | "WHOLESALE" | "CORPORATE";
  companyName?: string;
  tin?: string;
  vatNumber?: string;
  totalSpent: number;
  visitCount: number;
  lastVisit?: Date;
  notes?: string;
  creditAllowed: boolean;
  creditLimit: number;
  currentBalance: number;
  paymentTermsDays?: number;
  creditStatus?: "ACTIVE" | "ON_HOLD" | "SUSPENDED";
  wholesaleTier?: "TIER_1" | "TIER_2" | "TIER_3";
  contactPerson?: string;
  deliveryAddress?: string;
  nicNumber?: string;
  lastReminderSentAt?: Date;
  reminderCount?: number;
  loyaltyPoints?: number;
  lifetimePointsEarned?: number;
  lifetimePointsRedeemed?: number;
  loyaltyTier?: "REGULAR" | "SILVER" | "GOLD" | "PLATINUM";
  dateOfBirth?: Date;
  portalToken?: string;
  referralCode?: string;
  referredBy?: Types.ObjectId;
  referralCount?: number;
  referralPointsEarned?: number;
  vipCardIssuedAt?: Date;
  anniversaryDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export function generatePortalToken(): string {
  // Generate secure 32-character random hex token for public portal links
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export function generateReferralCode(): string {
  // Generate friendly 6-char alphanumeric referral code (e.g., REF-7K9M2P)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "REF-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    customerType: { type: String, enum: ["RETAIL", "WHOLESALE", "CORPORATE"], default: "RETAIL" },
    companyName: { type: String, trim: true },
    tin: { type: String, trim: true },
    vatNumber: { type: String, trim: true },
    totalSpent: { type: Number, default: 0, min: 0 },
    visitCount: { type: Number, default: 0, min: 0 },
    lastVisit: { type: Date },
    notes: { type: String, trim: true },
    creditAllowed: { type: Boolean, default: false },
    creditLimit: { type: Number, default: 0, min: 0 },
    currentBalance: { type: Number, default: 0, min: 0 },
    paymentTermsDays: { type: Number, default: 30, min: 0 },
    creditStatus: {
      type: String,
      enum: ["ACTIVE", "ON_HOLD", "SUSPENDED"],
      default: "ACTIVE",
    },
    wholesaleTier: {
      type: String,
      enum: ["TIER_1", "TIER_2", "TIER_3"],
      default: "TIER_1",
    },
    contactPerson: { type: String, trim: true },
    deliveryAddress: { type: String, trim: true },
    nicNumber: { type: String, trim: true },
    lastReminderSentAt: { type: Date },
    reminderCount: { type: Number, default: 0 },
    loyaltyPoints: { type: Number, default: 0, min: 0 },
    lifetimePointsEarned: { type: Number, default: 0, min: 0 },
    lifetimePointsRedeemed: { type: Number, default: 0, min: 0 },
    loyaltyTier: {
      type: String,
      enum: ["REGULAR", "SILVER", "GOLD", "PLATINUM"],
      default: "REGULAR",
    },
    dateOfBirth: { type: Date },
    portalToken: { type: String, trim: true },
    referralCode: { type: String, trim: true, uppercase: true },
    referredBy: { type: Schema.Types.ObjectId, ref: "Customer" },
    referralCount: { type: Number, default: 0, min: 0 },
    referralPointsEarned: { type: Number, default: 0, min: 0 },
    vipCardIssuedAt: { type: Date },
    anniversaryDate: { type: Date },
  },
  { timestamps: true }
);

CustomerSchema.index({ businessId: 1, phone: 1 });
CustomerSchema.index({ businessId: 1, currentBalance: -1 });
CustomerSchema.index({ businessId: 1, loyaltyTier: 1 });
CustomerSchema.index({ businessId: 1, referredBy: 1 });
CustomerSchema.index({ portalToken: 1 }, { sparse: true });
CustomerSchema.index({ referralCode: 1 }, { sparse: true });

export const Customer: Model<ICustomer> =
  mongoose.models.Customer || mongoose.model<ICustomer>("Customer", CustomerSchema);

export default Customer;

