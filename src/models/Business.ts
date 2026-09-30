import mongoose, { Schema, Document, Model } from "mongoose";

export type SubscriptionPlan = "TRIAL" | "BASIC" | "PROFESSIONAL" | "ENTERPRISE";
export type SubscriptionStatus = "TRIAL" | "ACTIVE" | "EXPIRED" | "SUSPENDED" | "CANCELLED";

export interface IBusiness extends Document {
  name: string;
  businessType: string;
  ownerName: string;
  phone: string;
  email?: string;
  address?: string;
  logo?: string;
  currency: string;
  taxSettings: {
    enabled: boolean;
    name: string;
    rate: number;
    type: "INCLUSIVE" | "EXCLUSIVE";
    tin?: string;
    vatNumber?: string;
    ssclEnabled?: boolean;
    ssclRate?: number;
    invoiceNotes?: string;
  };
  receiptSettings: {
    headerMessage: string;
    footerMessage: string;
    showLogo: boolean;
    defaultWidth: "58mm" | "80mm";
  };
  bankDetails?: {
    bankName?: string;
    branchName?: string;
    accountNumber?: string;
    accountName?: string;
  };
  notificationSettings?: {
    whatsappEnabled: boolean;
    autoPromptWhatsappReceipt: boolean;
    defaultReminderTemplate?: string;
  };
  loyaltySettings?: {
    enabled: boolean;
    pointsPerSpend: number;
    redemptionRate: number;
    minPointsToRedeem: number;
  };
  securityPolicy?: {
    requireSupervisorForVoid: boolean;
    requireSupervisorForDiscount: boolean;
    maxCashierDiscountPercent: number;
    maxCashierDiscountAmount: number;
    requireSupervisorForPriceOverride: boolean;
    requireSupervisorForNoSale: boolean;
    requireSupervisorForExpenseDelete: boolean;
  };
  subscription: {
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    startDate: Date;
    expiryDate: Date;
    maxProducts?: number;
    maxUsers?: number;
    maxRegisters?: number;
  };
  onboardingCompleted?: boolean;
  onboardingStep?: number;
  catalogPreset?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BusinessSchema = new Schema<IBusiness>(
  {
    name: { type: String, required: true, trim: true },
    businessType: { type: String, default: "Grocery", trim: true },
    ownerName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    logo: { type: String },
    currency: { type: String, default: "LKR" },
    taxSettings: {
      enabled: { type: Boolean, default: false },
      name: { type: String, default: "VAT" },
      rate: { type: Number, default: 0, min: 0 },
      type: { type: String, enum: ["INCLUSIVE", "EXCLUSIVE"], default: "INCLUSIVE" },
      tin: { type: String, trim: true },
      vatNumber: { type: String, trim: true },
      ssclEnabled: { type: Boolean, default: false },
      ssclRate: { type: Number, default: 2.5, min: 0 },
      invoiceNotes: { type: String, trim: true },
    },
    receiptSettings: {
      headerMessage: { type: String, default: "Thank you for shopping with us!" },
      footerMessage: { type: String, default: "Please come again" },
      showLogo: { type: Boolean, default: false },
      defaultWidth: { type: String, enum: ["58mm", "80mm"], default: "58mm" },
    },
    bankDetails: {
      bankName: { type: String, trim: true },
      branchName: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      accountName: { type: String, trim: true },
    },
    notificationSettings: {
      whatsappEnabled: { type: Boolean, default: true },
      autoPromptWhatsappReceipt: { type: Boolean, default: true },
      defaultReminderTemplate: { type: String, trim: true },
    },
    loyaltySettings: {
      enabled: { type: Boolean, default: true },
      pointsPerSpend: { type: Number, default: 100, min: 1 },
      redemptionRate: { type: Number, default: 1, min: 0.01 },
      minPointsToRedeem: { type: Number, default: 50, min: 0 },
    },
    securityPolicy: {
      requireSupervisorForVoid: { type: Boolean, default: true },
      requireSupervisorForDiscount: { type: Boolean, default: true },
      maxCashierDiscountPercent: { type: Number, default: 5 },
      maxCashierDiscountAmount: { type: Number, default: 500 },
      requireSupervisorForPriceOverride: { type: Boolean, default: true },
      requireSupervisorForNoSale: { type: Boolean, default: true },
      requireSupervisorForExpenseDelete: { type: Boolean, default: true },
    },
    subscription: {
      plan: {
        type: String,
        enum: ["TRIAL", "BASIC", "PROFESSIONAL", "ENTERPRISE"],
        default: "TRIAL",
      },
      status: {
        type: String,
        enum: ["TRIAL", "ACTIVE", "EXPIRED", "SUSPENDED", "CANCELLED"],
        default: "TRIAL",
      },
      startDate: { type: Date, default: Date.now },
      expiryDate: {
        type: Date,
        default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Default 14-day free trial
      },
      maxProducts: { type: Number, default: 500 },
      maxUsers: { type: Number, default: 5 },
      maxRegisters: { type: Number, default: 2 },
    },
    onboardingCompleted: { type: Boolean, default: false },
    onboardingStep: { type: Number, default: 1 },
    catalogPreset: { type: String, default: "GROCERY" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Business: Model<IBusiness> =
  mongoose.models.Business || mongoose.model<IBusiness>("Business", BusinessSchema);

export default Business;
