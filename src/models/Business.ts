import mongoose, { Schema, Document, Model } from "mongoose";

export type SubscriptionPlan = "TRIAL" | "BASIC" | "PROFESSIONAL" | "ENTERPRISE";
export type SubscriptionStatus = "TRIAL" | "ACTIVE" | "EXPIRED" | "SUSPENDED" | "CANCELLED";

export interface ISupportedCurrency {
  code: string;
  symbol: string;
  name: string;
  exchangeRate: number;
  isEnabled: boolean;
  isAutoUpdated?: boolean;
  marginPercent?: number;
  updatedAt?: Date;
}

export interface ICurrencySettings {
  enabled: boolean;
  baseCurrency: string;
  exchangeBufferPercent?: number;
  currencies: ISupportedCurrency[];
}

export type SmsGatewayProvider = "NOTIFY_LK" | "DIALOG" | "MOBITEL" | "SIMULATED";

export interface ISmsSettings {
  enabled: boolean;
  provider: SmsGatewayProvider;
  senderId: string; // e.g. "MYSTORE", "NOTIFYDEMO", or registered Sri Lankan SMS mask
  userId?: string; // Notify.lk user_id or Dialog/Mobitel account
  apiKey?: string; // Notify.lk api_key or Dialog token
  apiSecret?: string;
  sendOnCreditSale: boolean;
  sendOnCreditSettlement: boolean;
  sendOnLoyaltyPoints: boolean;
  sendOnGiftVoucher: boolean;
  sendOnQuotation: boolean;
  templates?: {
    creditSale?: string;
    creditSettlement?: string;
    overdueReminder?: string;
    loyaltyAccrual?: string;
    giftVoucher?: string;
    quotation?: string;
  };
}

export interface IHardwareSettings {
  weighingScale?: {
    enabled?: boolean;
    scaleModel?: string; // "CAS", "TOLEDO", "DIBAL", "GENERIC"
    baudRate?: number;    // default 9600
    autoTare?: boolean;
    defaultTareWeightGrams?: number;
  };
  variableWeightBarcodes?: {
    enabled?: boolean;
    weightPrefixes?: string[]; // default ["20", "21", "02"]
    pricePrefixes?: string[];  // default ["28", "29"]
    defaultUnit?: "kg" | "g";
  };
  cashDrawer?: {
    enabled?: boolean;
    autoKickOnCash?: boolean;
    kickPin?: "PIN2" | "PIN5";
    openKeyShortcut?: string; // default "F9"
  };
  customerDisplay?: {
    enabled?: boolean;
    welcomeMessage?: string;
    promotionalMessage?: string;
  };
}

export interface IDeliverySettings {
  pickmeEnabled?: boolean;
  pickmeApiKey?: string;
  pickmeStoreId?: string;
  pickmeCommissionPercent?: number; // default 22%
  uberEatsEnabled?: boolean;
  uberEatsApiKey?: string;
  uberEatsStoreId?: string;
  uberEatsCommissionPercent?: number; // default 25%
  directDeliveryEnabled?: boolean;
  autoAcceptOrders?: boolean;
  defaultPrepTimeMinutes?: number; // default 15
  notifySoundEnabled?: boolean;
}

export interface IKdsStation {
  id: string;
  name: string;
  nameSi?: string;
  nameTa?: string;
  color?: string;
}

export interface IKdsSettings {
  enabled?: boolean;
  soundAlerts?: boolean;
  targetPrepTimeMinutes?: number; // default 15 mins
  alertThresholdMinutes?: number; // default 10 mins
  autoPrintKOT?: boolean;
  defaultStation?: string; // "ALL"
  stations?: IKdsStation[];
}

export interface IBusiness extends Document {
  name: string;
  businessType: string;
  ownerName: string;
  phone: string;
  email?: string;
  address?: string;
  logo?: string;
  currency: string;
  currencySettings?: ICurrencySettings;
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
    receiptLanguage?: "en" | "si" | "ta" | "bilingual_si" | "bilingual_ta" | "trilingual";
  };
  localeSettings?: {
    defaultLanguage: "en" | "si" | "ta";
    supportedLanguages: Array<"en" | "si" | "ta">;
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
  smsSettings?: ISmsSettings;
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
  hardwareSettings?: IHardwareSettings;
  deliverySettings?: IDeliverySettings;
  kdsSettings?: IKdsSettings;
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
    currencySettings: {
      enabled: { type: Boolean, default: false },
      baseCurrency: { type: String, default: "LKR" },
      exchangeBufferPercent: { type: Number, default: 2 },
      currencies: [
        {
          code: { type: String, required: true },
          symbol: { type: String, required: true },
          name: { type: String, required: true },
          exchangeRate: { type: Number, required: true, min: 0 },
          isEnabled: { type: Boolean, default: true },
          isAutoUpdated: { type: Boolean, default: true },
          marginPercent: { type: Number, default: 0 },
          updatedAt: { type: Date, default: Date.now },
        },
      ],
    },
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
      receiptLanguage: {
        type: String,
        enum: ["en", "si", "ta", "bilingual_si", "bilingual_ta", "trilingual"],
        default: "en",
      },
    },
    localeSettings: {
      defaultLanguage: { type: String, enum: ["en", "si", "ta"], default: "en" },
      supportedLanguages: [{ type: String, enum: ["en", "si", "ta"] }],
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
    smsSettings: {
      enabled: { type: Boolean, default: false },
      provider: {
        type: String,
        enum: ["NOTIFY_LK", "DIALOG", "MOBITEL", "SIMULATED"],
        default: "NOTIFY_LK",
      },
      senderId: { type: String, default: "NOTIFYDEMO", trim: true },
      userId: { type: String, trim: true },
      apiKey: { type: String, trim: true },
      apiSecret: { type: String, trim: true },
      sendOnCreditSale: { type: Boolean, default: true },
      sendOnCreditSettlement: { type: Boolean, default: true },
      sendOnLoyaltyPoints: { type: Boolean, default: false },
      sendOnGiftVoucher: { type: Boolean, default: true },
      sendOnQuotation: { type: Boolean, default: false },
      templates: {
        creditSale: { type: String, trim: true },
        creditSettlement: { type: String, trim: true },
        overdueReminder: { type: String, trim: true },
        loyaltyAccrual: { type: String, trim: true },
        giftVoucher: { type: String, trim: true },
        quotation: { type: String, trim: true },
      },
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
    hardwareSettings: {
      weighingScale: {
        enabled: { type: Boolean, default: false },
        scaleModel: { type: String, default: "CAS" },
        baudRate: { type: Number, default: 9600 },
        autoTare: { type: Boolean, default: false },
        defaultTareWeightGrams: { type: Number, default: 0 },
      },
      variableWeightBarcodes: {
        enabled: { type: Boolean, default: true },
        weightPrefixes: { type: [String], default: ["20", "21", "02"] },
        pricePrefixes: { type: [String], default: ["28", "29"] },
        defaultUnit: { type: String, enum: ["kg", "g"], default: "kg" },
      },
      cashDrawer: {
        enabled: { type: Boolean, default: true },
        autoKickOnCash: { type: Boolean, default: true },
        kickPin: { type: String, enum: ["PIN2", "PIN5"], default: "PIN2" },
        openKeyShortcut: { type: String, default: "F9" },
      },
      customerDisplay: {
        enabled: { type: Boolean, default: true },
        welcomeMessage: { type: String, default: "Welcome! ආයුබෝවන්! வணக்கம்!" },
        promotionalMessage: { type: String, default: "Fresh local produce daily • Islandwide quality guaranteed" },
      },
    },
    deliverySettings: {
      pickmeEnabled: { type: Boolean, default: false },
      pickmeApiKey: { type: String, trim: true },
      pickmeStoreId: { type: String, trim: true },
      pickmeCommissionPercent: { type: Number, default: 22, min: 0 },
      uberEatsEnabled: { type: Boolean, default: false },
      uberEatsApiKey: { type: String, trim: true },
      uberEatsStoreId: { type: String, trim: true },
      uberEatsCommissionPercent: { type: Number, default: 25, min: 0 },
      directDeliveryEnabled: { type: Boolean, default: true },
      autoAcceptOrders: { type: Boolean, default: false },
      defaultPrepTimeMinutes: { type: Number, default: 15, min: 1 },
      notifySoundEnabled: { type: Boolean, default: true },
    },
    kdsSettings: {
      enabled: { type: Boolean, default: true },
      soundAlerts: { type: Boolean, default: true },
      targetPrepTimeMinutes: { type: Number, default: 15, min: 1 },
      alertThresholdMinutes: { type: Number, default: 10, min: 1 },
      autoPrintKOT: { type: Boolean, default: false },
      defaultStation: { type: String, default: "ALL" },
      stations: [
        {
          id: { type: String, required: true },
          name: { type: String, required: true },
          nameSi: { type: String },
          nameTa: { type: String },
          color: { type: String },
        },
      ],
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
