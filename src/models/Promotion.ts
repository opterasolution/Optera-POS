import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type PromotionType =
  | "BILL_THRESHOLD"
  | "BUY_X_GET_Y"
  | "CATEGORY_DISCOUNT"
  | "PRODUCT_DISCOUNT";

export type PromoDiscountType = "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_ITEM";

export interface IPromotion extends Document {
  businessId: Types.ObjectId;
  name: string;
  code?: string; // Optional coupon code (e.g., "MEGA5", "WEEKEND10"). If omitted, auto-applies when conditions met
  description?: string;
  type: PromotionType;
  discountType: PromoDiscountType;
  discountValue: number; // e.g. 5 for 5%, 250 for Rs. 250, or 100 for 100% free item
  minSpend?: number; // Minimum bill subtotal required (e.g. Rs. 5,000)
  buyProductId?: Types.ObjectId; // For BOGO: required purchased product
  buyQuantity?: number; // For BOGO: e.g. buy 2
  getProductId?: Types.ObjectId; // For BOGO: free/discounted product
  getQuantity?: number; // For BOGO: e.g. get 1 free
  applicableCategories?: Types.ObjectId[]; // Categories eligible for discount
  applicableProducts?: Types.ObjectId[]; // Products eligible for discount
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  usageCount: number;
  usageLimit?: number;
  createdAt: Date;
  updatedAt: Date;
}

const PromotionSchema = new Schema<IPromotion>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    code: { type: String, uppercase: true, trim: true },
    description: { type: String, trim: true },
    type: {
      type: String,
      enum: ["BILL_THRESHOLD", "BUY_X_GET_Y", "CATEGORY_DISCOUNT", "PRODUCT_DISCOUNT"],
      required: true,
      default: "BILL_THRESHOLD",
    },
    discountType: {
      type: String,
      enum: ["PERCENTAGE", "FIXED_AMOUNT", "FREE_ITEM"],
      required: true,
      default: "PERCENTAGE",
    },
    discountValue: { type: Number, required: true, min: 0 },
    minSpend: { type: Number, default: 0, min: 0 },
    buyProductId: { type: Schema.Types.ObjectId, ref: "Product" },
    buyQuantity: { type: Number, default: 1, min: 1 },
    getProductId: { type: Schema.Types.ObjectId, ref: "Product" },
    getQuantity: { type: Number, default: 1, min: 1 },
    applicableCategories: [{ type: Schema.Types.ObjectId, ref: "Category" }],
    applicableProducts: [{ type: Schema.Types.ObjectId, ref: "Product" }],
    startDate: { type: Date, required: true, default: Date.now },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    usageCount: { type: Number, default: 0, min: 0 },
    usageLimit: { type: Number, min: 1 },
  },
  { timestamps: true }
);

PromotionSchema.index({ businessId: 1, isActive: 1 });
PromotionSchema.index({ businessId: 1, code: 1 });
PromotionSchema.index({ businessId: 1, startDate: 1, endDate: 1 });

export const Promotion: Model<IPromotion> =
  mongoose.models.Promotion || mongoose.model<IPromotion>("Promotion", PromotionSchema);

export default Promotion;
