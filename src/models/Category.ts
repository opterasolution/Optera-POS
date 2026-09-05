import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface ICategory extends Document {
  businessId: Types.ObjectId;
  name: string;
  description?: string;
  color?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    color: { type: String, default: "#3b82f6" }, // Hex color for UI pill buttons
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

CategorySchema.index({ businessId: 1, name: 1 });

export const Category: Model<ICategory> =
  mongoose.models.Category || mongoose.model<ICategory>("Category", CategorySchema);

export default Category;
