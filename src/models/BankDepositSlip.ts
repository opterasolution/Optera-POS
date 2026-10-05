import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type DepositSlipStatus = "PREPARED" | "DEPOSITED" | "RECONCILED" | "CANCELLED";

export interface IDepositSlipChequeItem {
  chequeId: Types.ObjectId;
  chequeNumber: string;
  bankName: string;
  bankBranch: string;
  drawerName: string;
  amount: number;
  chequeDate: Date;
}

export interface IBankDepositSlip extends Document {
  businessId: Types.ObjectId;
  slipNumber: string; // e.g. "DS-20261005-0001"
  bankAccountId?: Types.ObjectId;
  bankName: string;
  branchName: string;
  accountNumber: string;
  accountName: string;
  depositDate: Date;

  cheques: IDepositSlipChequeItem[];
  chequeCount: number;
  chequeTotal: number;
  cashAmount: number;
  totalDepositAmount: number;

  status: DepositSlipStatus;
  depositedBy: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BankDepositSlipSchema = new Schema<IBankDepositSlip>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    slipNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    bankAccountId: {
      type: Schema.Types.ObjectId,
      ref: "BankAccount",
    },
    bankName: {
      type: String,
      required: true,
      trim: true,
    },
    branchName: {
      type: String,
      required: true,
      trim: true,
    },
    accountNumber: {
      type: String,
      required: true,
      trim: true,
    },
    accountName: {
      type: String,
      required: true,
      trim: true,
    },
    depositDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    cheques: [
      {
        chequeId: {
          type: Schema.Types.ObjectId,
          ref: "BankCheque",
          required: true,
        },
        chequeNumber: { type: String, required: true },
        bankName: { type: String, required: true },
        bankBranch: { type: String, default: "Main Branch" },
        drawerName: { type: String, required: true },
        amount: { type: Number, required: true, min: 0 },
        chequeDate: { type: Date, required: true },
      },
    ],
    chequeCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    chequeTotal: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    cashAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalDepositAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["PREPARED", "DEPOSITED", "RECONCILED", "CANCELLED"],
      default: "DEPOSITED",
      index: true,
    },
    depositedBy: {
      type: String,
      required: true,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

BankDepositSlipSchema.index({ businessId: 1, slipNumber: 1 });
BankDepositSlipSchema.index({ businessId: 1, depositDate: -1 });

export const BankDepositSlip: Model<IBankDepositSlip> =
  mongoose.models.BankDepositSlip || mongoose.model<IBankDepositSlip>("BankDepositSlip", BankDepositSlipSchema);
