import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IProduct extends Document {
  businessId: Types.ObjectId;
  categoryId?: Types.ObjectId;
  name: string;
  nameSinhala?: string;
  nameTamil?: string;
  sku?: string;
  barcode?: string;
  pluCode?: string;
  isWeighable?: boolean;
  tareWeightGrams?: number;
  costPrice: number;
  sellingPrice: number;
  wholesalePrice?: number;
  wholesaleMinQty?: number;
  stockQuantity: number;
  lowStockThreshold: number;
  unit: string;
  isBatchTracked?: boolean;
  kitchenStation?: string;
  supplierId?: Types.ObjectId;
  supplierName?: string;
  leadTimeDays?: number;
  safetyStockDays?: number;
  minOrderQuantity?: number;
  orderPackSize?: number;
  maxStockLevel?: number;
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
    nameSinhala: { type: String, trim: true },
    nameTamil: { type: String, trim: true },
    sku: { type: String, trim: true },
    barcode: { type: String, trim: true },
    pluCode: { type: String, trim: true },
    isWeighable: { type: Boolean, default: false },
    tareWeightGrams: { type: Number, default: 0, min: 0 },
    costPrice: { type: Number, required: true, min: 0, default: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    wholesalePrice: { type: Number, min: 0 },
    wholesaleMinQty: { type: Number, min: 1, default: 1 },
    stockQuantity: { type: Number, required: true, default: 0 },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    unit: { type: String, default: "pcs", trim: true },
    isBatchTracked: { type: Boolean, default: false },
    kitchenStation: { type: String, trim: true, default: "HOT_KITCHEN" },
    supplierId: { type: Schema.Types.ObjectId, ref: "Supplier" },
    supplierName: { type: String, trim: true },
    leadTimeDays: { type: Number, default: 3, min: 0 },
    safetyStockDays: { type: Number, default: 5, min: 0 },
    minOrderQuantity: { type: Number, default: 1, min: 1 },
    orderPackSize: { type: Number, default: 1, min: 1 },
    maxStockLevel: { type: Number, min: 0 },
    isActive: { type: Boolean, default: true },
  },

  { timestamps: true }
);

// Compound indexes for ultra-fast multi-tenant queries
ProductSchema.index({ businessId: 1, barcode: 1 });
ProductSchema.index({ businessId: 1, pluCode: 1 });
ProductSchema.index({ businessId: 1, sku: 1 });
ProductSchema.index({ businessId: 1, name: "text" });

export const Product: Model<IProduct> =
  mongoose.models.Product || mongoose.model<IProduct>("Product", ProductSchema);

export default Product;
