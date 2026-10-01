import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type PaymentMethod = "CASH" | "CARD" | "QR" | "BANK_TRANSFER" | "CREDIT" | "CREDIT_NOTE" | "GIFT_VOUCHER" | "OTHER";
export type SaleStatus = "COMPLETED" | "CANCELLED" | "REFUNDED";
export type SaleReturnStatus = "NONE" | "PARTIAL" | "FULLY_RETURNED";

export interface ISaleItem {
  productId: Types.ObjectId;
  name: string;
  barcode?: string;
  unitPrice: number;
  costPrice: number; // Snapshot of cost at sale time for accurate profit reports
  quantity: number;
  returnedQuantity?: number;
  subtotal: number;
  discount: number;
  total: number;
  priceTier?: "RETAIL" | "WHOLESALE";
}

export interface ISale extends Document {
  businessId: Types.ObjectId;
  invoiceNumber: string;
  cashierId: Types.ObjectId;
  cashierName: string;
  customerId?: Types.ObjectId;
  customerName?: string;
  customerPhone?: string;
  items: ISaleItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  netTotal: number;
  paymentMethod: PaymentMethod;
  cashReceived?: number;
  changeGiven?: number;
  paymentReference?: string;
  registerId?: Types.ObjectId;
  registerName?: string;
  registerNumber?: string;
  shiftId?: Types.ObjectId;
  isCreditSale?: boolean;
  creditTransactionId?: Types.ObjectId;
  offlineId?: string; // Client-generated UUID for idempotent synchronization
  pointsEarned?: number;
  pointsRedeemed?: number;
  loyaltyDiscount?: number;
  appliedPromotions?: Array<{
    promoId?: Types.ObjectId;
    name: string;
    code?: string;
    discountAmount: number;
  }>;
  returnedTotal?: number;
  returnStatus?: SaleReturnStatus;
  creditNoteRedeemed?: {
    creditNoteId?: Types.ObjectId;
    creditNoteNumber: string;
    amount: number;
  };
  giftVoucherRedeemed?: {
    voucherId?: Types.ObjectId;
    code: string;
    amount: number;
    remainingBalance: number;
  };
  billingType?: "RETAIL" | "WHOLESALE";
  isTaxInvoice?: boolean;
  taxBreakdown?: {
    taxableAmount?: number;
    ssclRate?: number;
    ssclAmount?: number;
    vatRate?: number;
    vatAmount?: number;
  };
  buyerDetails?: {
    companyName?: string;
    tin?: string;
    vatNumber?: string;
    address?: string;
    phone?: string;
  };
  quotationId?: Types.ObjectId;
  quotationNumber?: string;
  dueDate?: Date;
  paymentStatus?: "PAID" | "PARTIAL" | "UNPAID";
  amountPaid?: number;
  balanceDue?: number;
  tenderCurrency?: string;
  exchangeRate?: number;
  foreignAmount?: number;
  foreignCashReceived?: number;
  foreignChangeGiven?: number;
  foreignCurrencySymbol?: string;
  status: SaleStatus;
  createdAt: Date;
  updatedAt: Date;
}

const SaleItemSchema = new Schema<ISaleItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    barcode: { type: String },
    unitPrice: { type: Number, required: true, min: 0 },
    costPrice: { type: Number, required: true, min: 0, default: 0 },
    quantity: { type: Number, required: true, min: 1 },
    returnedQuantity: { type: Number, default: 0, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    priceTier: { type: String, enum: ["RETAIL", "WHOLESALE"], default: "RETAIL" },
  },
  { _id: false }
);

const SaleSchema = new Schema<ISale>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
      trim: true,
    },
    cashierId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    cashierName: { type: String, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    customerName: { type: String, trim: true },
    customerPhone: { type: String, trim: true },
    items: [SaleItemSchema],
    subtotal: { type: Number, required: true, min: 0 },
    discountTotal: { type: Number, default: 0, min: 0 },
    taxTotal: { type: Number, default: 0, min: 0 },
    netTotal: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      enum: ["CASH", "CARD", "QR", "BANK_TRANSFER", "CREDIT", "CREDIT_NOTE", "GIFT_VOUCHER", "OTHER"],
      required: true,
    },
    cashReceived: { type: Number, min: 0 },
    changeGiven: { type: Number, min: 0 },
    paymentReference: { type: String, trim: true },
    registerId: { type: Schema.Types.ObjectId, ref: "Register", index: true },
    registerName: { type: String, trim: true },
    registerNumber: { type: String, trim: true },
    shiftId: { type: Schema.Types.ObjectId, ref: "Shift", index: true },
    isCreditSale: { type: Boolean, default: false },
    creditTransactionId: { type: Schema.Types.ObjectId, ref: "CreditTransaction" },
    offlineId: { type: String, trim: true, sparse: true, index: true },
    pointsEarned: { type: Number, default: 0, min: 0 },
    pointsRedeemed: { type: Number, default: 0, min: 0 },
    loyaltyDiscount: { type: Number, default: 0, min: 0 },
    appliedPromotions: [
      {
        promoId: { type: Schema.Types.ObjectId, ref: "Promotion" },
        name: { type: String },
        code: { type: String },
        discountAmount: { type: Number, default: 0 },
      },
    ],
    returnedTotal: { type: Number, default: 0, min: 0 },
    returnStatus: {
      type: String,
      enum: ["NONE", "PARTIAL", "FULLY_RETURNED"],
      default: "NONE",
    },
    creditNoteRedeemed: {
      creditNoteId: { type: Schema.Types.ObjectId, ref: "CreditNote" },
      creditNoteNumber: { type: String, trim: true },
      amount: { type: Number, min: 0 },
    },
    giftVoucherRedeemed: {
      voucherId: { type: Schema.Types.ObjectId, ref: "GiftVoucher" },
      code: { type: String, trim: true },
      amount: { type: Number, min: 0 },
      remainingBalance: { type: Number, min: 0 },
    },
    billingType: { type: String, enum: ["RETAIL", "WHOLESALE"], default: "RETAIL" },
    isTaxInvoice: { type: Boolean, default: false },
    taxBreakdown: {
      taxableAmount: { type: Number, default: 0 },
      ssclRate: { type: Number, default: 0 },
      ssclAmount: { type: Number, default: 0 },
      vatRate: { type: Number, default: 0 },
      vatAmount: { type: Number, default: 0 },
    },
    buyerDetails: {
      companyName: { type: String, trim: true },
      tin: { type: String, trim: true },
      vatNumber: { type: String, trim: true },
      address: { type: String, trim: true },
      phone: { type: String, trim: true },
    },
    quotationId: { type: Schema.Types.ObjectId, ref: "Quotation" },
    quotationNumber: { type: String, trim: true },
    dueDate: { type: Date },
    paymentStatus: {
      type: String,
      enum: ["PAID", "PARTIAL", "UNPAID"],
      default: "PAID",
    },
    amountPaid: { type: Number, default: 0 },
    balanceDue: { type: Number, default: 0 },
    tenderCurrency: { type: String, default: "LKR" },
    exchangeRate: { type: Number, default: 1 },
    foreignAmount: { type: Number },
    foreignCashReceived: { type: Number },
    foreignChangeGiven: { type: Number },
    foreignCurrencySymbol: { type: String, default: "Rs." },
    status: {
      type: String,
      enum: ["COMPLETED", "CANCELLED", "REFUNDED"],
      default: "COMPLETED",
    },
  },
  { timestamps: true }
);

SaleSchema.index({ businessId: 1, invoiceNumber: 1 }, { unique: true });
SaleSchema.index({ businessId: 1, offlineId: 1 }, { sparse: true });
SaleSchema.index({ businessId: 1, registerId: 1, createdAt: -1 });
SaleSchema.index({ businessId: 1, shiftId: 1 });
SaleSchema.index({ businessId: 1, createdAt: -1 });

export const Sale: Model<ISale> =
  mongoose.models.Sale || mongoose.model<ISale>("Sale", SaleSchema);

export default Sale;
