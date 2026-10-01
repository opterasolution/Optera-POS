import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type CommissionPayoutStatus = "PENDING" | "APPROVED" | "PAID" | "CANCELLED";
export type PayoutPaymentMethod = "CASH" | "BANK_TRANSFER" | "CHEQUE";

export interface IPayoutSaleItem {
  saleId: Types.ObjectId;
  invoiceNumber: string;
  date: Date;
  saleAmount: number;
  commissionAmount: number;
}

export interface ICommissionPayout extends Document {
  businessId: Types.ObjectId;
  payoutNumber: string; // COMM-YYYYMMDD-XXXX
  userId: Types.ObjectId;
  userName: string;
  period: string; // e.g. "October 2026" or "2026-10-01 to 2026-10-31"
  startDate: Date;
  endDate: Date;
  totalSalesCount: number;
  totalSalesVolume: number; // In LKR
  baseCommission: number; // In LKR
  targetBonus: number; // In LKR
  deductions: number; // In LKR
  deductionReason?: string;
  netPayable: number; // In LKR
  status: CommissionPayoutStatus;
  paymentMethod?: PayoutPaymentMethod;
  paymentReference?: string; // Cheque #, transaction ref, or voucher ref
  paidAt?: Date;
  approvedBy?: string;
  paidBy?: string;
  salesBreakdown?: IPayoutSaleItem[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PayoutSaleItemSchema = new Schema<IPayoutSaleItem>(
  {
    saleId: { type: Schema.Types.ObjectId, ref: "Sale", required: true },
    invoiceNumber: { type: String, required: true },
    date: { type: Date, required: true },
    saleAmount: { type: Number, required: true },
    commissionAmount: { type: Number, required: true },
  },
  { _id: false }
);

const CommissionPayoutSchema = new Schema<ICommissionPayout>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    payoutNumber: {
      type: String,
      required: true,
      trim: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userName: { type: String, required: true, trim: true },
    period: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    totalSalesCount: { type: Number, default: 0, min: 0 },
    totalSalesVolume: { type: Number, default: 0, min: 0 },
    baseCommission: { type: Number, default: 0, min: 0 },
    targetBonus: { type: Number, default: 0, min: 0 },
    deductions: { type: Number, default: 0, min: 0 },
    deductionReason: { type: String, trim: true },
    netPayable: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "PAID", "CANCELLED"],
      default: "PENDING",
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ["CASH", "BANK_TRANSFER", "CHEQUE"],
    },
    paymentReference: { type: String, trim: true },
    paidAt: { type: Date },
    approvedBy: { type: String, trim: true },
    paidBy: { type: String, trim: true },
    salesBreakdown: [PayoutSaleItemSchema],
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

CommissionPayoutSchema.index({ businessId: 1, payoutNumber: 1 }, { unique: true });
CommissionPayoutSchema.index({ businessId: 1, status: 1, createdAt: -1 });
CommissionPayoutSchema.index({ businessId: 1, userId: 1, createdAt: -1 });

export const CommissionPayout: Model<ICommissionPayout> =
  mongoose.models.CommissionPayout ||
  mongoose.model<ICommissionPayout>("CommissionPayout", CommissionPayoutSchema);

export default CommissionPayout;
