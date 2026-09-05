import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IProduct extends Document {
  businessId: Types.ObjectId;
  categoryId?: Types.ObjectId;
  name: string;
  sku?: string;
  barcode?: string;
  costPrice: number;
  sellingPrice: number;
  stockQuantity: number;
  lowStockThreshold: number;
  unit: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      index: true,
    },
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true },
    barcode: { type: String, trim: true },
    costPrice: { type: Number, required: true, min: 0, default: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    stockQuantity: { type: Number, required: true, default: 0 },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    unit: { type: String, default: "pcs", trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Compound indexes for ultra-fast multi-tenant queries
ProductSchema.index({ businessId: 1, barcode: 1 });
ProductSchema.index({ businessId: 1, sku: 1 });
ProductSchema.index({ businessId: 1, name: "text" });

export const Product: Model<IProduct> =
  mongoose.models.Product || mongoose.model<IProduct>("Product", ProductSchema);

export default Product;
