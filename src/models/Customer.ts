import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface ICustomer extends Document {
  businessId: Types.ObjectId;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  totalSpent: number;
  visitCount: number;
  lastVisit?: Date;
  notes?: string;
  creditAllowed: boolean;
  creditLimit: number;
  currentBalance: number;
  nicNumber?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    totalSpent: { type: Number, default: 0, min: 0 },
    visitCount: { type: Number, default: 0, min: 0 },
    lastVisit: { type: Date },
    notes: { type: String, trim: true },
    creditAllowed: { type: Boolean, default: false },
    creditLimit: { type: Number, default: 0, min: 0 },
    currentBalance: { type: Number, default: 0, min: 0 },
    nicNumber: { type: String, trim: true },
  },
  { timestamps: true }
);

CustomerSchema.index({ businessId: 1, phone: 1 });
CustomerSchema.index({ businessId: 1, currentBalance: -1 });

export const Customer: Model<ICustomer> =
  mongoose.models.Customer || mongoose.model<ICustomer>("Customer", CustomerSchema);

export default Customer;
