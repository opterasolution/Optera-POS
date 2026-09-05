import mongoose, { Schema, Document, Model } from "mongoose";

export interface IBusiness extends Document {
  name: string;
  businessType: string;
  ownerName: string;
  phone: string;
  email?: string;
  address?: string;
  logo?: string;
  currency: string;
  taxSettings: {
    enabled: boolean;
    name: string;
    rate: number;
    type: "INCLUSIVE" | "EXCLUSIVE";
  };
  receiptSettings: {
    headerMessage: string;
    footerMessage: string;
    showLogo: boolean;
    defaultWidth: "58mm" | "80mm";
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BusinessSchema = new Schema<IBusiness>(
  {
    name: { type: String, required: true, trim: true },
    businessType: { type: String, default: "Grocery", trim: true },
    ownerName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    logo: { type: String },
    currency: { type: String, default: "LKR" },
    taxSettings: {
      enabled: { type: Boolean, default: false },
      name: { type: String, default: "VAT" },
      rate: { type: Number, default: 0, min: 0 },
      type: { type: String, enum: ["INCLUSIVE", "EXCLUSIVE"], default: "INCLUSIVE" },
    },
    receiptSettings: {
      headerMessage: { type: String, default: "Thank you for shopping with us!" },
      footerMessage: { type: String, default: "Please come again" },
      showLogo: { type: Boolean, default: false },
      defaultWidth: { type: String, enum: ["58mm", "80mm"], default: "58mm" },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Business: Model<IBusiness> =
  mongoose.models.Business || mongoose.model<IBusiness>("Business", BusinessSchema);

export default Business;
