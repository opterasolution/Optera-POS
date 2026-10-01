import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { SmsGatewayProvider } from "./Business";

export type SmsEventType =
  | "CREDIT_PURCHASE"
  | "CREDIT_SETTLEMENT"
  | "OVERDUE_REMINDER"
  | "LOYALTY_ACCRUAL"
  | "TIER_UPGRADE"
  | "GIFT_VOUCHER"
  | "QUOTATION"
  | "QUOTATION_ALERT"
  | "BROADCAST"
  | "CUSTOM"
  | "TEST";

export type SmsDeliveryStatus = "SENT" | "FAILED" | "SIMULATED";

export interface ISmsLog extends Document {
  businessId: Types.ObjectId;
  recipientPhone: string;
  recipientName?: string;
  customerId?: Types.ObjectId;
  eventType: SmsEventType;
  message: string;
  provider: SmsGatewayProvider;
  senderId: string;
  status: SmsDeliveryStatus;
  gatewayResponse?: string;
  cost: number; // Cost in LKR (e.g. 0.40 per SMS)
  errorDetails?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const SmsLogSchema = new Schema<ISmsLog>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    recipientPhone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    recipientName: { type: String, trim: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    eventType: {
      type: String,
      enum: [
        "CREDIT_PURCHASE",
        "CREDIT_SETTLEMENT",
        "OVERDUE_REMINDER",
        "LOYALTY_ACCRUAL",
        "TIER_UPGRADE",
        "GIFT_VOUCHER",
        "QUOTATION",
        "QUOTATION_ALERT",
        "BROADCAST",
        "CUSTOM",
        "TEST",
      ],
      default: "CUSTOM",
      index: true,
    },
    message: { type: String, required: true },
    provider: {
      type: String,
      enum: ["NOTIFY_LK", "DIALOG", "MOBITEL", "SIMULATED"],
      default: "NOTIFY_LK",
    },
    senderId: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["SENT", "FAILED", "SIMULATED"],
      default: "SENT",
      index: true,
    },
    gatewayResponse: { type: String },
    cost: { type: Number, default: 0.4, min: 0 },
    errorDetails: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

SmsLogSchema.index({ businessId: 1, createdAt: -1 });
SmsLogSchema.index({ businessId: 1, eventType: 1 });
SmsLogSchema.index({ businessId: 1, status: 1 });

export const SmsLog: Model<ISmsLog> =
  mongoose.models.SmsLog || mongoose.model<ISmsLog>("SmsLog", SmsLogSchema);

export default SmsLog;
