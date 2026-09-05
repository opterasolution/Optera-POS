import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type UserRole = "OWNER" | "MANAGER" | "CASHIER";

export interface IUser extends Document {
  businessId: Types.ObjectId;
  name: string;
  username: string;
  password: string; // Hashed with bcrypt
  role: UserRole;
  phone?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    username: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["OWNER", "MANAGER", "CASHIER"],
      default: "CASHIER",
      required: true,
    },
    phone: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Compound index: username must be unique per business
UserSchema.index({ businessId: 1, username: 1 }, { unique: true });

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
