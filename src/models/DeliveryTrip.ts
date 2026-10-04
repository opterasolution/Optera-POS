import mongoose, { Schema, Document, Model } from "mongoose";

export type DeliveryTripStatus = "DRAFT" | "DISPATCHED" | "COMPLETED" | "CANCELLED";

export interface IDeliveryTripStop {
  orderId: mongoose.Types.ObjectId;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryNotes?: string;
  stopSequence: number;
  isCod: boolean;
  codAmount: number;
  status: "PENDING" | "DELIVERED" | "FAILED";
  deliveredAt?: Date;
  collectedCod?: number;
  changeGiven?: number;
  failureReason?: string;
  signatureUrl?: string;
  photoUrl?: string;
  receivedBy?: string;
}

export interface IDeliveryTrip extends Document {
  businessId: mongoose.Types.ObjectId;
  tripNumber: string; // e.g. "TRIP-20261004-0001"
  driverId: mongoose.Types.ObjectId;
  driverName: string;
  driverPhone: string;
  vehicleType: "BIKE" | "THREE_WHEELER" | "CAR" | "VAN";
  vehicleNumber: string;
  status: DeliveryTripStatus;
  stops: IDeliveryTripStop[];
  totalStops: number;
  completedStops: number;
  failedStops: number;
  totalCodExpected: number;
  totalCodCollected: number;
  cashierReconciliation: {
    status: "PENDING" | "RECONCILED" | "DISCREPANCY";
    reconciledAt?: Date;
    reconciledBy?: string;
    registerId?: mongoose.Types.ObjectId;
    cashDrawerAmountSubmitted?: number;
    shortageOrOverage?: number;
    cashierNotes?: string;
  };
  dispatchedAt?: Date;
  completedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DeliveryTripSchema = new Schema<IDeliveryTrip>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    tripNumber: { type: String, required: true, trim: true, index: true },
    driverId: { type: Schema.Types.ObjectId, ref: "DeliveryDriver", required: true, index: true },
    driverName: { type: String, required: true, trim: true },
    driverPhone: { type: String, required: true, trim: true },
    vehicleType: {
      type: String,
      enum: ["BIKE", "THREE_WHEELER", "CAR", "VAN"],
      default: "THREE_WHEELER",
    },
    vehicleNumber: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["DRAFT", "DISPATCHED", "COMPLETED", "CANCELLED"],
      default: "DRAFT",
      index: true,
    },
    stops: [
      {
        orderId: { type: Schema.Types.ObjectId, ref: "DeliveryOrder", required: true },
        orderNumber: { type: String, required: true, trim: true },
        customerName: { type: String, required: true, trim: true },
        customerPhone: { type: String, required: true, trim: true },
        deliveryAddress: { type: String, required: true, trim: true },
        deliveryNotes: { type: String, trim: true },
        stopSequence: { type: Number, required: true },
        isCod: { type: Boolean, default: false },
        codAmount: { type: Number, default: 0 },
        status: {
          type: String,
          enum: ["PENDING", "DELIVERED", "FAILED"],
          default: "PENDING",
        },
        deliveredAt: { type: Date },
        collectedCod: { type: Number },
        changeGiven: { type: Number },
        failureReason: { type: String, trim: true },
        signatureUrl: { type: String },
        photoUrl: { type: String },
        receivedBy: { type: String, trim: true },
      },
    ],
    totalStops: { type: Number, default: 0 },
    completedStops: { type: Number, default: 0 },
    failedStops: { type: Number, default: 0 },
    totalCodExpected: { type: Number, default: 0 },
    totalCodCollected: { type: Number, default: 0 },
    cashierReconciliation: {
      status: {
        type: String,
        enum: ["PENDING", "RECONCILED", "DISCREPANCY"],
        default: "PENDING",
      },
      reconciledAt: { type: Date },
      reconciledBy: { type: String, trim: true },
      registerId: { type: Schema.Types.ObjectId, ref: "Register" },
      cashDrawerAmountSubmitted: { type: Number },
      shortageOrOverage: { type: Number },
      cashierNotes: { type: String, trim: true },
    },
    dispatchedAt: { type: Date },
    completedAt: { type: Date },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

DeliveryTripSchema.index({ businessId: 1, status: 1, createdAt: -1 });
DeliveryTripSchema.index({ businessId: 1, driverId: 1, status: 1 });

export const DeliveryTrip: Model<IDeliveryTrip> =
  mongoose.models.DeliveryTrip || mongoose.model<IDeliveryTrip>("DeliveryTrip", DeliveryTripSchema);

export default DeliveryTrip;
