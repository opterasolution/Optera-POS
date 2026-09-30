import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface ISupplier extends Document {
  businessId: Types.ObjectId;
  name: string; // e.g. "Unilever Sri Lanka Ltd", "CBL Munchee Distributors"
  code?: string; // e.g. "SUP-UNI", "SUP-CBL"
  contactPerson?: string;
  phone: string;
  email?: string;
  address?: string;
  taxNumber?: string; // VAT / TIN
  paymentTermsDays: number; // e.g. 0 for Cash On Delivery (COD), 7, 14, 30, 60
  creditLimit: number;
  currentBalance: number; // outstanding accounts payable debt owed in LKR
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierSchema = new Schema<ISupplier>(
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
      trim: true,
      uppercase: true,
    },
    contactPerson: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    address: {
      type: String,
      trim: true,
    },
    taxNumber: {
      type: String,
      trim: true,
    },
    paymentTermsDays: {
      type: Number,
      default: 30,
      min: 0,
    },
    creditLimit: {
      type: Number,
      default: 0,
      min: 0,
    },
    currentBalance: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Compound indexes
SupplierSchema.index({ businessId: 1, name: 1 });
SupplierSchema.index({ businessId: 1, currentBalance: -1 });
SupplierSchema.index({ businessId: 1, isActive: 1 });

export const Supplier: Model<ISupplier> =
  mongoose.models.Supplier || mongoose.model<ISupplier>("Supplier", SupplierSchema);

export default Supplier;
