import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type LoyaltyTransactionType =
  | "EARN"
  | "REDEEM"
  | "ADJUST"
  | "BIRTHDAY_BONUS"
  | "EXPIRE"
  | "REFERRAL_BONUS"
  | "TIER_UPGRADE_BONUS";

export interface ILoyaltyTransaction extends Document {
  businessId: Types.ObjectId;
  customerId: Types.ObjectId;
  type: LoyaltyTransactionType;
  points: number; // positive for EARN/ADJUST(+)/BIRTHDAY_BONUS/REFERRAL_BONUS/TIER_UPGRADE_BONUS, negative for REDEEM/EXPIRE/ADJUST(-)
  pointsBefore: number;
  pointsAfter: number;
  saleId?: Types.ObjectId;
  invoiceNumber?: string;
  description: string;
  notes?: string;
  performedBy?: Types.ObjectId;
  performedByName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LoyaltyTransactionSchema = new Schema<ILoyaltyTransaction>(
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
    type: {
      type: String,
      enum: ["EARN", "REDEEM", "ADJUST", "BIRTHDAY_BONUS", "EXPIRE", "REFERRAL_BONUS", "TIER_UPGRADE_BONUS"],
      required: true,
    },
    points: { type: Number, required: true },
    pointsBefore: { type: Number, required: true, min: 0 },
    pointsAfter: { type: Number, required: true, min: 0 },
    saleId: { type: Schema.Types.ObjectId, ref: "Sale" },
    invoiceNumber: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    notes: { type: String, trim: true },
    performedBy: { type: Schema.Types.ObjectId, ref: "User" },
    performedByName: { type: String, trim: true },
  },
  { timestamps: true }
);

LoyaltyTransactionSchema.index({ businessId: 1, customerId: 1, createdAt: -1 });
LoyaltyTransactionSchema.index({ businessId: 1, createdAt: -1 });

export const LoyaltyTransaction: Model<ILoyaltyTransaction> =
  mongoose.models.LoyaltyTransaction ||
  mongoose.model<ILoyaltyTransaction>("LoyaltyTransaction", LoyaltyTransactionSchema);

export default LoyaltyTransaction;
