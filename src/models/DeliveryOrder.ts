import mongoose, { Schema, Document, Model } from "mongoose";

export type DeliveryPlatform = "PICKME_FOOD" | "PICKME_FLASH" | "UBER_EATS" | "DIRECT_STORE";

export type DeliveryOrderStatus =
  | "PENDING_ACCEPT"
  | "ACCEPTED"
  | "PREPARING"
  | "READY_FOR_PICKUP"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED"
  | "REJECTED";

export interface IDeliveryOrderItem {
  productId?: mongoose.Types.ObjectId;
  name: string;
  nameSinhala?: string;
  nameTamil?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  unit?: string;
  specialInstructions?: string;
}

export interface IDeliveryOrderCustomer {
  name: string;
  phone: string;
  deliveryAddress: string;
  deliveryCoordinates?: {
    lat: number;
    lng: number;
  };
  deliveryNotes?: string;
}

export interface IDeliveryOrderFinancials {
  subtotal: number;
  platformDiscount?: number;
  merchantDiscount?: number;
  deliveryFee?: number;
  platformCommissionPercent: number; // e.g. 22 for PickMe, 25 for Uber Eats
  platformCommissionAmount: number;
  estimatedNetPayout: number;        // subtotal - platformCommissionAmount
  taxAmount?: number;
  totalBill: number;
  payoutStatus: "PENDING" | "SETTLED" | "DISPUTED";
}

export interface IDeliveryOrderRider {
  name?: string;
  phone?: string;
  vehicleNumber?: string; // e.g. "WP BDF-4512"
  vehicleType?: "BIKE" | "THREE_WHEELER" | "CAR" | "VAN";
  pickupPin: string;      // 4-digit code e.g. "4821"
  arrivalEtaMinutes?: number;
  arrivedAtStore?: boolean;
  handoverConfirmedAt?: Date;
  handoverConfirmedBy?: string;
}

export interface IDeliveryOrderAuditEntry {
  timestamp: Date;
  status: DeliveryOrderStatus;
  actor: string;
  notes?: string;
}

export interface IDeliveryOrder extends Document {
  businessId: mongoose.Types.ObjectId;
  branchId?: mongoose.Types.ObjectId;
  platform: DeliveryPlatform;
  externalOrderId: string; // e.g. "PM-98124" or "UE-45912" or "DIR-1001"
  status: DeliveryOrderStatus;
  customer: IDeliveryOrderCustomer;
  items: IDeliveryOrderItem[];
  financials: IDeliveryOrderFinancials;
  rider: IDeliveryOrderRider;
  prepTimeMinutes: number; // default 15 mins
  scheduledPrepEnd?: Date;
  acceptedAt?: Date;
  readyAt?: Date;
  dispatchedAt?: Date;
  deliveredAt?: Date;
  cancelReason?: string;
  auditTrail: IDeliveryOrderAuditEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const DeliveryOrderSchema = new Schema<IDeliveryOrder>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch" },
    platform: {
      type: String,
      enum: ["PICKME_FOOD", "PICKME_FLASH", "UBER_EATS", "DIRECT_STORE"],
      required: true,
      index: true,
    },
    externalOrderId: { type: String, required: true, trim: true, index: true },
    status: {
      type: String,
      enum: [
        "PENDING_ACCEPT",
        "ACCEPTED",
        "PREPARING",
        "READY_FOR_PICKUP",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "CANCELLED",
        "REJECTED",
      ],
      default: "PENDING_ACCEPT",
      index: true,
    },
    customer: {
      name: { type: String, required: true, trim: true },
      phone: { type: String, required: true, trim: true },
      deliveryAddress: { type: String, required: true, trim: true },
      deliveryCoordinates: {
        lat: { type: Number },
        lng: { type: Number },
      },
      deliveryNotes: { type: String, trim: true },
    },
    items: [
      {
        productId: { type: Schema.Types.ObjectId, ref: "Product" },
        name: { type: String, required: true, trim: true },
        nameSinhala: { type: String, trim: true },
        nameTamil: { type: String, trim: true },
        quantity: { type: Number, required: true, min: 0.001 },
        unitPrice: { type: Number, required: true, min: 0 },
        lineTotal: { type: Number, required: true, min: 0 },
        unit: { type: String, default: "unit" },
        specialInstructions: { type: String, trim: true },
      },
    ],
    financials: {
      subtotal: { type: Number, required: true, min: 0 },
      platformDiscount: { type: Number, default: 0, min: 0 },
      merchantDiscount: { type: Number, default: 0, min: 0 },
      deliveryFee: { type: Number, default: 0, min: 0 },
      platformCommissionPercent: { type: Number, required: true, default: 22, min: 0 },
      platformCommissionAmount: { type: Number, required: true, default: 0, min: 0 },
      estimatedNetPayout: { type: Number, required: true, default: 0, min: 0 },
      taxAmount: { type: Number, default: 0, min: 0 },
      totalBill: { type: Number, required: true, min: 0 },
      payoutStatus: {
        type: String,
        enum: ["PENDING", "SETTLED", "DISPUTED"],
        default: "PENDING",
      },
    },
    rider: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
      vehicleNumber: { type: String, trim: true },
      vehicleType: {
        type: String,
        enum: ["BIKE", "THREE_WHEELER", "CAR", "VAN"],
        default: "BIKE",
      },
      pickupPin: { type: String, required: true, trim: true },
      arrivalEtaMinutes: { type: Number },
      arrivedAtStore: { type: Boolean, default: false },
      handoverConfirmedAt: { type: Date },
      handoverConfirmedBy: { type: String, trim: true },
    },
    prepTimeMinutes: { type: Number, default: 15, min: 1 },
    scheduledPrepEnd: { type: Date },
    acceptedAt: { type: Date },
    readyAt: { type: Date },
    dispatchedAt: { type: Date },
    deliveredAt: { type: Date },
    cancelReason: { type: String, trim: true },
    auditTrail: [
      {
        timestamp: { type: Date, default: Date.now },
        status: { type: String, required: true },
        actor: { type: String, required: true },
        notes: { type: String, trim: true },
      },
    ],
  },
  { timestamps: true }
);

// Compound indexes for dispatch searches and aggregation
DeliveryOrderSchema.index({ businessId: 1, status: 1, createdAt: -1 });
DeliveryOrderSchema.index({ businessId: 1, platform: 1, externalOrderId: 1 });
DeliveryOrderSchema.index({ businessId: 1, "rider.pickupPin": 1 });

export const DeliveryOrder: Model<IDeliveryOrder> =
  mongoose.models.DeliveryOrder || mongoose.model<IDeliveryOrder>("DeliveryOrder", DeliveryOrderSchema);

export default DeliveryOrder;
