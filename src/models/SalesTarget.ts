import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type TargetPeriod = "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY";
export type TargetStatus = "IN_PROGRESS" | "ACHIEVED" | "MISSED" | "BONUS_PAID";

export interface ISalesTarget extends Document {
  businessId: Types.ObjectId;
  userId: Types.ObjectId;
  userName: string;
  period: TargetPeriod;
  periodLabel: string;
  startDate: Date;
  endDate: Date;
  targetAmount: number; // In LKR
  targetUnits?: number;
  achievedAmount: number;
  achievedUnits: number;
  bonusReward: number; // Bonus incentive paid if target is achieved (in LKR)
  status: TargetStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SalesTargetSchema = new Schema<ISalesTarget>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userName: { type: String, required: true, trim: true },
    period: {
      type: String,
      enum: ["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY"],
      default: "MONTHLY",
      required: true,
    },
    periodLabel: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    targetAmount: { type: Number, required: true, min: 0 },
    targetUnits: { type: Number, default: 0, min: 0 },
    achievedAmount: { type: Number, default: 0, min: 0 },
    achievedUnits: { type: Number, default: 0, min: 0 },
    bonusReward: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["IN_PROGRESS", "ACHIEVED", "MISSED", "BONUS_PAID"],
      default: "IN_PROGRESS",
      index: true,
    },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

SalesTargetSchema.index({ businessId: 1, userId: 1, startDate: 1, endDate: 1 });
SalesTargetSchema.index({ businessId: 1, status: 1 });

export const SalesTarget: Model<ISalesTarget> =
  mongoose.models.SalesTarget ||
  mongoose.model<ISalesTarget>("SalesTarget", SalesTargetSchema);

export default SalesTarget;
