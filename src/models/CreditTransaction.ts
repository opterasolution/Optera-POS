import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type CreditTransactionType = "CREDIT_SALE" | "PAYMENT" | "ADJUSTMENT" | "CHEQUE_RETURN";
export type CreditPaymentMethod = "CASH" | "CARD" | "QR" | "BANK_TRANSFER" | "CHEQUE";

export interface ICreditTransaction extends Document {
  businessId: Types.ObjectId;
  customerId: Types.ObjectId;
  transactionNumber: string;
  type: CreditTransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  saleId?: Types.ObjectId;
  invoiceNumber?: string;
  paymentMethod?: CreditPaymentMethod;
  paymentReference?: string;
  chequeId?: Types.ObjectId;
  chequeNumber?: string;
  shiftId?: Types.ObjectId;
  registerId?: Types.ObjectId;
  registerName?: string;
  notes?: string;
  performedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const CreditTransactionSchema = new Schema<ICreditTransaction>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    transactionNumber: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["CREDIT_SALE", "PAYMENT", "ADJUSTMENT", "CHEQUE_RETURN"],
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    balanceBefore: {
      type: Number,
      required: true,
      min: 0,
    },
    balanceAfter: {
      type: Number,
      required: true,
      min: 0,
    },
    saleId: {
      type: Schema.Types.ObjectId,
      ref: "Sale",
    },
    invoiceNumber: {
      type: String,
      trim: true,
    },
    paymentMethod: {
      type: String,
      enum: ["CASH", "CARD", "QR", "BANK_TRANSFER"],
    },
    paymentReference: {
      type: String,
      trim: true,
    },
    shiftId: {
      type: Schema.Types.ObjectId,
      ref: "Shift",
    },
    registerId: {
      type: Schema.Types.ObjectId,
      ref: "Register",
    },
    registerName: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    performedBy: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

CreditTransactionSchema.index({ businessId: 1, customerId: 1, createdAt: -1 });
CreditTransactionSchema.index({ businessId: 1, transactionNumber: 1 });

export const CreditTransaction: Model<ICreditTransaction> =
  mongoose.models.CreditTransaction ||
  mongoose.model<ICreditTransaction>("CreditTransaction", CreditTransactionSchema);

export default CreditTransaction;
