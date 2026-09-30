import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type SupplierPaymentMethod = "CHEQUE" | "BANK_TRANSFER" | "CASH";

export interface ISupplierPayment extends Document {
  businessId: Types.ObjectId;
  paymentNumber: string; // e.g. "PV-20260930-0001"
  supplierId: Types.ObjectId;
  supplierName: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  paymentMethod: SupplierPaymentMethod;
  chequeNumber?: string;
  chequeDate?: Date;
  bankName?: string;
  referenceNumber?: string;
  purchaseOrderId?: Types.ObjectId;
  poNumber?: string;
  notes?: string;
  paidBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierPaymentSchema = new Schema<ISupplierPayment>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    paymentNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
      index: true,
    },
    supplierName: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    balanceBefore: {
      type: Number,
      required: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["CHEQUE", "BANK_TRANSFER", "CASH"],
      default: "CHEQUE",
    },
    chequeNumber: {
      type: String,
      trim: true,
    },
    chequeDate: {
      type: Date,
    },
    bankName: {
      type: String,
      trim: true,
    },
    referenceNumber: {
      type: String,
      trim: true,
    },
    purchaseOrderId: {
      type: Schema.Types.ObjectId,
      ref: "PurchaseOrder",
    },
    poNumber: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    paidBy: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

// Compound indexes
SupplierPaymentSchema.index({ businessId: 1, paymentNumber: 1 }, { unique: true });
SupplierPaymentSchema.index({ businessId: 1, supplierId: 1 });
SupplierPaymentSchema.index({ businessId: 1, createdAt: -1 });

export const SupplierPayment: Model<ISupplierPayment> =
  mongoose.models.SupplierPayment ||
  mongoose.model<ISupplierPayment>("SupplierPayment", SupplierPaymentSchema);

export default SupplierPayment;
