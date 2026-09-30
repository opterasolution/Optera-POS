import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IBranchStock extends Document {
  businessId: Types.ObjectId;
  branchId: Types.ObjectId;
  productId: Types.ObjectId;
  quantity: number;
  reorderLevel?: number;
  reorderQuantity?: number;
  createdAt: Date;
  updatedAt: Date;
}

const BranchStockSchema = new Schema<IBranchStock>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      default: 0,
    },
    reorderLevel: {
      type: Number,
      default: 5,
      min: 0,
    },
    reorderQuantity: {
      type: Number,
      default: 20,
      min: 1,
    },
  },
  { timestamps: true }
);

// Compound unique index ensuring only one stock record per product per branch
BranchStockSchema.index({ businessId: 1, branchId: 1, productId: 1 }, { unique: true });
BranchStockSchema.index({ businessId: 1, branchId: 1 });
BranchStockSchema.index({ businessId: 1, productId: 1 });

export const BranchStock: Model<IBranchStock> =
  mongoose.models.BranchStock || mongoose.model<IBranchStock>("BranchStock", BranchStockSchema);

export default BranchStock;
