import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type VoucherStatus = "ACTIVE" | "REDEEMED" | "EXPIRED" | "CANCELLED";

export interface IVoucherRedemption {
  saleId?: Types.ObjectId;
  invoiceNumber?: string;
  amount: number;
  balanceAfter: number;
  redeemedAt: Date;
  cashierName?: string;
}

export interface IGiftVoucher extends Document {
  businessId: Types.ObjectId;
  code: string; // e.g. GV-20261001-4921
  initialAmount: number;
  currentBalance: number;
  status: VoucherStatus;
  customerId?: Types.ObjectId;
  customerName?: string;
  customerPhone?: string;
  recipientName?: string;
  recipientPhone?: string;
  notes?: string;
  expiryDate?: Date;
  issuedBy?: Types.ObjectId;
  issuedByName?: string;
  redemptionHistory: IVoucherRedemption[];
  createdAt: Date;
  updatedAt: Date;
}

const VoucherRedemptionSchema = new Schema<IVoucherRedemption>(
  {
    saleId: { type: Schema.Types.ObjectId, ref: "Sale" },
    invoiceNumber: { type: String, trim: true },
    amount: { type: Number, required: true, min: 0 },
    balanceAfter: { type: Number, required: true, min: 0 },
    redeemedAt: { type: Date, default: Date.now },
    cashierName: { type: String, trim: true },
  },
  { _id: false }
);

const GiftVoucherSchema = new Schema<IGiftVoucher>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    initialAmount: { type: Number, required: true, min: 1 },
    currentBalance: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["ACTIVE", "REDEEMED", "EXPIRED", "CANCELLED"],
      default: "ACTIVE",
    },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    customerName: { type: String, trim: true },
    customerPhone: { type: String, trim: true },
    recipientName: { type: String, trim: true },
    recipientPhone: { type: String, trim: true },
    notes: { type: String, trim: true },
    expiryDate: { type: Date },
    issuedBy: { type: Schema.Types.ObjectId, ref: "User" },
    issuedByName: { type: String, trim: true },
    redemptionHistory: [VoucherRedemptionSchema],
  },
  { timestamps: true }
);

GiftVoucherSchema.index({ businessId: 1, code: 1 }, { unique: true });
GiftVoucherSchema.index({ businessId: 1, status: 1 });
GiftVoucherSchema.index({ businessId: 1, createdAt: -1 });

export const GiftVoucher: Model<IGiftVoucher> =
  mongoose.models.GiftVoucher ||
  mongoose.model<IGiftVoucher>("GiftVoucher", GiftVoucherSchema);

export default GiftVoucher;
