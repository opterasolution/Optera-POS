import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type BranchType = "WAREHOUSE" | "RETAIL_STORE" | "OUTLET";

export interface IBranch extends Document {
  businessId: Types.ObjectId;
  name: string;
  code: string; // e.g. "HQ-01", "BR-KND", "BR-GAL"
  type: BranchType;
  address?: string;
  phone?: string;
  email?: string;
  managerName?: string;
  isMainWarehouse: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BranchSchema = new Schema<IBranch>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    type: {
      type: String,
      enum: ["WAREHOUSE", "RETAIL_STORE", "OUTLET"],
      default: "RETAIL_STORE",
    },
    address: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    managerName: {
      type: String,
      trim: true,
    },
    isMainWarehouse: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Compound indexes
BranchSchema.index({ businessId: 1, code: 1 }, { unique: true });
BranchSchema.index({ businessId: 1, isActive: 1 });
BranchSchema.index({ businessId: 1, isMainWarehouse: 1 });

export const Branch: Model<IBranch> =
  mongoose.models.Branch || mongoose.model<IBranch>("Branch", BranchSchema);

export default Branch;
