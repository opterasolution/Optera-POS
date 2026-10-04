import mongoose, { Schema, Document, Model } from "mongoose";
import crypto from "crypto";

export type DriverVehicleType = "BIKE" | "THREE_WHEELER" | "CAR" | "VAN";

export interface IDeliveryDriver extends Document {
  businessId: mongoose.Types.ObjectId;
  name: string;
  phone: string;
  vehicleType: DriverVehicleType;
  vehicleNumber: string; // e.g. "WP BDF-4512"
  nicNumber?: string;
  active: boolean;
  driverToken: string; // Passwordless mobile access token e.g. "drv_a83f9..."
  currentTripId?: mongoose.Types.ObjectId;
  activeVanSessionId?: mongoose.Types.ObjectId;
  totalDeliveriesCompleted: number;
  totalCodCollected: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export function generateDriverToken(): string {
  return "drv_" + crypto.randomBytes(16).toString("hex");
}

const DeliveryDriverSchema = new Schema<IDeliveryDriver>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true, index: true },
    vehicleType: {
      type: String,
      enum: ["BIKE", "THREE_WHEELER", "CAR", "VAN"],
      default: "THREE_WHEELER",
    },
    vehicleNumber: { type: String, required: true, trim: true },
    nicNumber: { type: String, trim: true },
    active: { type: Boolean, default: true, index: true },
    driverToken: {
      type: String,
      required: true,
      unique: true,
      default: generateDriverToken,
      index: true,
    },
    currentTripId: { type: Schema.Types.ObjectId, ref: "DeliveryTrip" },
    activeVanSessionId: { type: Schema.Types.ObjectId, ref: "VanSaleSession" },
    totalDeliveriesCompleted: { type: Number, default: 0 },
    totalCodCollected: { type: Number, default: 0 },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

DeliveryDriverSchema.index({ businessId: 1, active: 1, name: 1 });

export const DeliveryDriver: Model<IDeliveryDriver> =
  mongoose.models.DeliveryDriver || mongoose.model<IDeliveryDriver>("DeliveryDriver", DeliveryDriverSchema);

export default DeliveryDriver;
