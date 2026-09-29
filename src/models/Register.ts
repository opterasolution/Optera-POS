import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IRegister extends Document {
  businessId: Types.ObjectId;
  registerNumber: string; // e.g. "REG-01", "REG-02"
  name: string; // e.g. "Counter 01 (Main Register)", "Express Counter"
  location?: string; // e.g. "Ground Floor", "Section B"
  printerWidth: "58mm" | "80mm";
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RegisterSchema = new Schema<IRegister>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    registerNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      trim: true,
    },
    printerWidth: {
      type: String,
      enum: ["58mm", "80mm"],
      default: "58mm",
    },
    isDefault: {
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

// Compound unique index so registerNumber is unique per business
RegisterSchema.index({ businessId: 1, registerNumber: 1 }, { unique: true });
RegisterSchema.index({ businessId: 1, isActive: 1 });

export const Register: Model<IRegister> =
  mongoose.models.Register || mongoose.model<IRegister>("Register", RegisterSchema);

export default Register;
