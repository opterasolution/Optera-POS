import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type CustomerPaymentSlipStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface ICustomerPaymentSlip extends Document {
  businessId: Types.ObjectId;
  customerId: Types.ObjectId;
  customerName: string;
  customerPhone: string;
  slipNumber: string;
  amount: number;
  depositBank: string;
  depositAccount?: string;
  payerBank?: string;
  transactionReference: string;
  paymentDate: Date;
  slipImageUrl?: string;
  notes?: string;
  status: CustomerPaymentSlipStatus;
  verifiedBy?: string;
  verifiedAt?: Date;
  rejectionReason?: string;
  creditTransactionId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerPaymentSlipSchema = new Schema<ICustomerPaymentSlip>(
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
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, required: true, trim: true },
    slipNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    amount: { type: Number, required: true, min: 1 },
    depositBank: { type: String, required: true, trim: true },
    depositAccount: { type: String, trim: true },
    payerBank: { type: String, trim: true },
    transactionReference: { type: String, required: true, trim: true },
    paymentDate: { type: Date, required: true, default: Date.now },
    slipImageUrl: { type: String, trim: true },
    notes: { type: String, trim: true },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
      index: true,
    },
    verifiedBy: { type: String, trim: true },
    verifiedAt: { type: Date },
    rejectionReason: { type: String, trim: true },
    creditTransactionId: { type: Schema.Types.ObjectId, ref: "CreditTransaction" },
  },
  { timestamps: true }
);

CustomerPaymentSlipSchema.index({ businessId: 1, createdAt: -1 });
CustomerPaymentSlipSchema.index({ businessId: 1, status: 1 });
CustomerPaymentSlipSchema.index({ customerId: 1, createdAt: -1 });

export const CustomerPaymentSlip: Model<ICustomerPaymentSlip> =
  mongoose.models.CustomerPaymentSlip ||
  mongoose.model<ICustomerPaymentSlip>("CustomerPaymentSlip", CustomerPaymentSlipSchema);

export default CustomerPaymentSlip;
