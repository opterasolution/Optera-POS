import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type UserRole =
  | "SUPER_ADMIN"
  | "OWNER"
  | "MANAGER"
  | "SUPERVISOR"
  | "INVENTORY_CLERK"
  | "ACCOUNTANT"
  | "CASHIER";

export interface IUser extends Document {
  businessId?: Types.ObjectId; // Optional for SUPER_ADMIN
  name: string;
  username: string;
  password: string; // Hashed with bcrypt
  role: UserRole;
  phone?: string;
  supervisorPin?: string; // 4-6 digit numeric PIN (hashed with bcrypt)
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: false, // Optional for Super Admin
      index: true,
    },
    name: { type: String, required: true, trim: true },
    username: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: [
        "SUPER_ADMIN",
        "OWNER",
        "MANAGER",
        "SUPERVISOR",
        "INVENTORY_CLERK",
        "ACCOUNTANT",
        "CASHIER",
      ],
      default: "CASHIER",
      required: true,
    },
    phone: { type: String, trim: true },
    supervisorPin: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
