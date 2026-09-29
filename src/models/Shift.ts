import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type ShiftStatus = "OPEN" | "CLOSED";
export type CashMovementType = "CASH_DROP" | "PAY_IN" | "PAY_OUT";

export interface ICashMovement {
  _id?: Types.ObjectId;
  type: CashMovementType;
  amount: number;
  reason: string;
  performedBy: string;
  createdAt: Date;
}

export interface IShift extends Document {
  businessId: Types.ObjectId;
  shiftNumber: string;
  registerId: Types.ObjectId;
  registerName: string;
  registerNumber: string;
  cashierId: Types.ObjectId;
  cashierName: string;
  status: ShiftStatus;
  openedAt: Date;
  closedAt?: Date;
  openingFloat: number;
  cashMovements: ICashMovement[];
  cashSales: number;
  cardSales: number;
  qrSales: number;
  bankTransferSales: number;
  totalSales: number;
  salesCount: number;
  totalDiscount: number;
  totalTax: number;
  expectedCash: number;
  actualCash?: number;
  difference?: number;
  closingNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CashMovementSchema = new Schema<ICashMovement>(
  {
    type: {
      type: String,
      enum: ["CASH_DROP", "PAY_IN", "PAY_OUT"],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true, trim: true },
    performedBy: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const ShiftSchema = new Schema<IShift>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    shiftNumber: {
      type: String,
      required: true,
      trim: true,
    },
    registerId: {
      type: Schema.Types.ObjectId,
      ref: "Register",
      required: true,
      index: true,
    },
    registerName: { type: String, required: true, trim: true },
    registerNumber: { type: String, required: true, trim: true },
    cashierId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    cashierName: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["OPEN", "CLOSED"],
      default: "OPEN",
      index: true,
    },
    openedAt: { type: Date, default: Date.now, required: true },
    closedAt: { type: Date },
    openingFloat: { type: Number, required: true, min: 0, default: 0 },
    cashMovements: { type: [CashMovementSchema], default: [] },
    cashSales: { type: Number, default: 0, min: 0 },
    cardSales: { type: Number, default: 0, min: 0 },
    qrSales: { type: Number, default: 0, min: 0 },
    bankTransferSales: { type: Number, default: 0, min: 0 },
    totalSales: { type: Number, default: 0, min: 0 },
    salesCount: { type: Number, default: 0, min: 0 },
    totalDiscount: { type: Number, default: 0, min: 0 },
    totalTax: { type: Number, default: 0, min: 0 },
    expectedCash: { type: Number, default: 0 },
    actualCash: { type: Number },
    difference: { type: Number },
    closingNotes: { type: String, trim: true },
  },
  { timestamps: true }
);

// Compound indexes for active shift checks and historical reporting
ShiftSchema.index({ businessId: 1, registerId: 1, status: 1 });
ShiftSchema.index({ businessId: 1, openedAt: -1 });

export const Shift: Model<IShift> =
  mongoose.models.Shift || mongoose.model<IShift>("Shift", ShiftSchema);

export default Shift;
