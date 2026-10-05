import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type BankAccountType = "CURRENT" | "SAVINGS";

export interface IBankAccount extends Document {
  businessId: Types.ObjectId;
  bankName: string;
  bankCode?: string;
  branchName: string;
  accountNumber: string;
  accountName: string;
  accountType: BankAccountType;
  currency: string;
  ledgerBalance: number;
  clearedBalance: number;
  isDefault: boolean;
  isActive: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BankAccountSchema = new Schema<IBankAccount>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    bankName: {
      type: String,
      required: true,
      trim: true,
    },
    bankCode: {
      type: String,
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
    accountType: {
      type: String,
      enum: ["CURRENT", "SAVINGS"],
      default: "CURRENT",
    },
    currency: {
      type: String,
      default: "LKR",
      trim: true,
    },
    ledgerBalance: {
      type: Number,
      default: 0,
    },
    clearedBalance: {
      type: Number,
      default: 0,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
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

BankAccountSchema.index({ businessId: 1, accountNumber: 1 });

export const BankAccount: Model<IBankAccount> =
  mongoose.models.BankAccount || mongoose.model<IBankAccount>("BankAccount", BankAccountSchema);
