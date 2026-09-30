import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type ExpenseCategory =
  | "UTILITIES"
  | "STAFF_MEALS"
  | "PACKAGING"
  | "TRANSPORT"
  | "MAINTENANCE"
  | "RENT"
  | "MUNICIPAL_TAX"
  | "SALARY_ADVANCE"
  | "OTHER";

export type ExpensePaymentMethod = "CASH" | "BANK_TRANSFER" | "CARD" | "PETTY_CASH";

export type ExpensePaidFrom = "REGISTER_DRAWER" | "STORE_PETTY_CASH" | "BANK_ACCOUNT";

export interface IExpense extends Document {
  businessId: Types.ObjectId;
  expenseNumber: string; // EXP-YYYYMMDD-XXXX
  category: ExpenseCategory;
  title: string;
  amount: number;
  paymentMethod: ExpensePaymentMethod;
  paidFrom: ExpensePaidFrom;
  shiftId?: Types.ObjectId;
  registerId?: Types.ObjectId;
  registerName?: string;
  payee?: string;
  receiptNumber?: string;
  notes?: string;
  recordedBy: string;
  recordedById: Types.ObjectId;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema = new Schema<IExpense>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    expenseNumber: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: [
        "UTILITIES",
        "STAFF_MEALS",
        "PACKAGING",
        "TRANSPORT",
        "MAINTENANCE",
        "RENT",
        "MUNICIPAL_TAX",
        "SALARY_ADVANCE",
        "OTHER",
      ],
      required: true,
      default: "OTHER",
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: ["CASH", "BANK_TRANSFER", "CARD", "PETTY_CASH"],
      default: "CASH",
      required: true,
    },
    paidFrom: {
      type: String,
      enum: ["REGISTER_DRAWER", "STORE_PETTY_CASH", "BANK_ACCOUNT"],
      default: "STORE_PETTY_CASH",
      required: true,
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
    payee: {
      type: String,
      trim: true,
    },
    receiptNumber: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    recordedBy: {
      type: String,
      required: true,
      trim: true,
    },
    recordedById: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  { timestamps: true }
);

ExpenseSchema.index({ businessId: 1, expenseNumber: 1 });
ExpenseSchema.index({ businessId: 1, date: -1 });
ExpenseSchema.index({ businessId: 1, category: 1 });
ExpenseSchema.index({ businessId: 1, paidFrom: 1 });
ExpenseSchema.index({ businessId: 1, shiftId: 1 });

export const Expense: Model<IExpense> =
  mongoose.models.Expense || mongoose.model<IExpense>("Expense", ExpenseSchema);

export default Expense;
