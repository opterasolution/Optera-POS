import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type CommissionSchemeType = "FLAT_PERCENT" | "CATEGORY_BASED" | "TIERED_VOLUME";

export interface ICategoryCommissionRate {
  categoryId: Types.ObjectId;
  categoryName: string;
  rate: number; // Percentage, e.g. 5 for 5%
}

export interface IVolumeCommissionTier {
  minSales: number; // e.g. 0
  maxSales?: number; // e.g. 100000
  rate: number; // Percentage, e.g. 1.5
}

export interface ICommissionRule extends Document {
  businessId: Types.ObjectId;
  name: string;
  description?: string;
  type: CommissionSchemeType;
  defaultRate: number; // Base percentage, e.g. 2.0%
  categoryRates: ICategoryCommissionRate[];
  volumeTiers: IVolumeCommissionTier[];
  applicableRoles: string[]; // ["CASHIER", "SALES_REP", "SUPERVISOR", "MANAGER"]
  applicableUsers?: Types.ObjectId[]; // Specific staff IDs (optional override)
  minSaleAmount?: number; // Minimum sale netTotal required to qualify for commission
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CategoryCommissionRateSchema = new Schema<ICategoryCommissionRate>(
  {
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    categoryName: { type: String, required: true },
    rate: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false }
);

const VolumeCommissionTierSchema = new Schema<IVolumeCommissionTier>(
  {
    minSales: { type: Number, required: true, min: 0 },
    maxSales: { type: Number, min: 0 },
    rate: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false }
);

const CommissionRuleSchema = new Schema<ICommissionRule>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    type: {
      type: String,
      enum: ["FLAT_PERCENT", "CATEGORY_BASED", "TIERED_VOLUME"],
      default: "FLAT_PERCENT",
      required: true,
    },
    defaultRate: { type: Number, default: 2.0, min: 0, max: 100 },
    categoryRates: [CategoryCommissionRateSchema],
    volumeTiers: [VolumeCommissionTierSchema],
    applicableRoles: {
      type: [String],
      default: ["CASHIER", "SALES_REP"],
    },
    applicableUsers: [{ type: Schema.Types.ObjectId, ref: "User" }],
    minSaleAmount: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

CommissionRuleSchema.index({ businessId: 1, isActive: 1 });

export const CommissionRule: Model<ICommissionRule> =
  mongoose.models.CommissionRule ||
  mongoose.model<ICommissionRule>("CommissionRule", CommissionRuleSchema);

export default CommissionRule;
