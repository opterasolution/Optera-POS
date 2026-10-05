import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type ChequeDirection = "INWARD" | "OUTWARD";
export type ChequePartyType = "CUSTOMER" | "SUPPLIER" | "OTHER";
export type ChequeStatus = "RECEIVED" | "DEPOSITED" | "REALIZED" | "RETURNED" | "CANCELLED";

export interface IBankCheque extends Document {
  businessId: Types.ObjectId;
  chequeNumber: string;
  direction: ChequeDirection;
  partyType: ChequePartyType;
  partyId?: Types.ObjectId;
  partyName: string;
  partyPhone?: string;

  // Cheque bank metadata
  bankName: string;
  bankBranch: string;
  bankCode?: string;
  accountNumber?: string;
  drawerName: string;
  payeeName: string;

  amount: number;
  chequeDate: Date; // Date inscribed on cheque face (used for PDC evaluation)
  receivedOrIssuedDate: Date;
  isPdc: boolean;
  status: ChequeStatus;

  // Deposit tracking
  depositDetails?: {
    depositSlipId?: Types.ObjectId;
    depositSlipNumber?: string;
    depositedAt?: Date;
    depositedBy?: string;
    bankAccountId?: Types.ObjectId;
    bankName?: string;
    accountNumber?: string;
    branchName?: string;
    notes?: string;
  };

  // Realization / Clearance tracking
  realizationDetails?: {
    realizedAt?: Date;
    realizedBy?: string;
    bankStatementRef?: string;
    clearedAmount?: number;
    notes?: string;
  };

  // Dishonor / Bounce tracking
  returnDetails?: {
    returnedAt?: Date;
    returnedBy?: string;
    reasonCode?: string;
    reasonText?: string;
    returnPenaltyFee?: number;
    customerReDebited?: boolean;
    smsAlertSent?: boolean;
    notes?: string;
  };

  // Linked commercial vouchers
  saleId?: Types.ObjectId;
  invoiceNumber?: string;
  creditTransactionId?: Types.ObjectId;
  supplierPaymentId?: Types.ObjectId;
  paymentVoucherNumber?: string;

  notes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const BankChequeSchema = new Schema<IBankCheque>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    chequeNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    direction: {
      type: String,
      enum: ["INWARD", "OUTWARD"],
      required: true,
      index: true,
    },
    partyType: {
      type: String,
      enum: ["CUSTOMER", "SUPPLIER", "OTHER"],
      default: "CUSTOMER",
    },
    partyId: {
      type: Schema.Types.ObjectId,
      index: true,
    },
    partyName: {
      type: String,
      required: true,
      trim: true,
    },
    partyPhone: {
      type: String,
      trim: true,
    },
    bankName: {
      type: String,
      required: true,
      trim: true,
    },
    bankBranch: {
      type: String,
      default: "Main Branch",
      trim: true,
    },
    bankCode: {
      type: String,
      trim: true,
    },
    accountNumber: {
      type: String,
      trim: true,
    },
    drawerName: {
      type: String,
      required: true,
      trim: true,
    },
    payeeName: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    chequeDate: {
      type: Date,
      required: true,
      index: true,
    },
    receivedOrIssuedDate: {
      type: Date,
      default: Date.now,
    },
    isPdc: {
      type: Boolean,
      default: false,
      index: true,
    },
    status: {
      type: String,
      enum: ["RECEIVED", "DEPOSITED", "REALIZED", "RETURNED", "CANCELLED"],
      default: "RECEIVED",
      index: true,
    },
    depositDetails: {
      depositSlipId: { type: Schema.Types.ObjectId, ref: "BankDepositSlip" },
      depositSlipNumber: { type: String, trim: true },
      depositedAt: { type: Date },
      depositedBy: { type: String, trim: true },
      bankAccountId: { type: Schema.Types.ObjectId, ref: "BankAccount" },
      bankName: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      branchName: { type: String, trim: true },
      notes: { type: String, trim: true },
    },
    realizationDetails: {
      realizedAt: { type: Date },
      realizedBy: { type: String, trim: true },
      bankStatementRef: { type: String, trim: true },
      clearedAmount: { type: Number },
      notes: { type: String, trim: true },
    },
    returnDetails: {
      returnedAt: { type: Date },
      returnedBy: { type: String, trim: true },
      reasonCode: { type: String, trim: true },
      reasonText: { type: String, trim: true },
      returnPenaltyFee: { type: Number, default: 0 },
      customerReDebited: { type: Boolean, default: false },
      smsAlertSent: { type: Boolean, default: false },
      notes: { type: String, trim: true },
    },
    saleId: {
      type: Schema.Types.ObjectId,
      ref: "Sale",
    },
    invoiceNumber: {
      type: String,
      trim: true,
    },
    creditTransactionId: {
      type: Schema.Types.ObjectId,
      ref: "CreditTransaction",
    },
    supplierPaymentId: {
      type: Schema.Types.ObjectId,
      ref: "SupplierPayment",
    },
    paymentVoucherNumber: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying cheques by status and PDC date
BankChequeSchema.index({ businessId: 1, direction: 1, status: 1, chequeDate: 1 });
BankChequeSchema.index({ businessId: 1, chequeNumber: 1 });

export const BankCheque: Model<IBankCheque> =
  mongoose.models.BankCheque || mongoose.model<IBankCheque>("BankCheque", BankChequeSchema);
