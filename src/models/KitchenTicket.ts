import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type KitchenTicketSource =
  | "POS_COUNTER"
  | "PICKME"
  | "UBER_EATS"
  | "DIRECT_DELIVERY"
  | "DINE_IN";

export type KitchenTicketStatus =
  | "NEW"
  | "PREPARING"
  | "READY"
  | "SERVED"
  | "CANCELLED";

export type KitchenPriority = "NORMAL" | "RUSH" | "VIP";

export type KitchenStation =
  | "ALL"
  | "HOT_KITCHEN"
  | "BAKERY_SHORT_EATS"
  | "BEVERAGE_BAR"
  | "GRILL_HOPPERS"
  | "PACKING";

export interface IKitchenTicketItem {
  itemId?: string;
  name: string;
  nameSi?: string;
  nameTa?: string;
  quantity: number;
  unit?: string;
  notes?: string;
  station: string;
  status: "PENDING" | "PREPARING" | "COMPLETED" | "VOIDED";
}

export interface IKitchenTicket extends Document {
  businessId: Types.ObjectId;
  ticketNumber: string;
  orderNumber: string;
  source: KitchenTicketSource;
  tableOrCustomer: string;
  orderType: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  serverName?: string;
  station: string;
  priority: KitchenPriority;
  items: IKitchenTicketItem[];
  status: KitchenTicketStatus;
  targetPrepMinutes: number;
  notes?: string;
  startedAt?: Date;
  readyAt?: Date;
  servedAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const KitchenTicketItemSchema = new Schema<IKitchenTicketItem>(
  {
    itemId: { type: String },
    name: { type: String, required: true },
    nameSi: { type: String },
    nameTa: { type: String },
    quantity: { type: Number, required: true, min: 0.1 },
    unit: { type: String, default: "portions" },
    notes: { type: String, trim: true },
    station: { type: String, default: "HOT_KITCHEN" },
    status: {
      type: String,
      enum: ["PENDING", "PREPARING", "COMPLETED", "VOIDED"],
      default: "PENDING",
    },
  },
  { _id: true }
);

const KitchenTicketSchema = new Schema<IKitchenTicket>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    ticketNumber: { type: String, required: true, trim: true },
    orderNumber: { type: String, required: true, trim: true },
    source: {
      type: String,
      enum: ["POS_COUNTER", "PICKME", "UBER_EATS", "DIRECT_DELIVERY", "DINE_IN"],
      default: "POS_COUNTER",
      index: true,
    },
    tableOrCustomer: { type: String, required: true, default: "Counter Order" },
    orderType: {
      type: String,
      enum: ["DINE_IN", "TAKEAWAY", "DELIVERY"],
      default: "DINE_IN",
    },
    serverName: { type: String, default: "Cashier" },
    station: { type: String, default: "ALL", index: true },
    priority: {
      type: String,
      enum: ["NORMAL", "RUSH", "VIP"],
      default: "NORMAL",
      index: true,
    },
    items: [KitchenTicketItemSchema],
    status: {
      type: String,
      enum: ["NEW", "PREPARING", "READY", "SERVED", "CANCELLED"],
      default: "NEW",
      index: true,
    },
    targetPrepMinutes: { type: Number, default: 15, min: 1 },
    notes: { type: String, trim: true },
    startedAt: { type: Date },
    readyAt: { type: Date },
    servedAt: { type: Date },
    cancelledAt: { type: Date },
  },
  { timestamps: true }
);

// Compound indexes for active kitchen queues and fast station filtering
KitchenTicketSchema.index({ businessId: 1, status: 1, createdAt: 1 });
KitchenTicketSchema.index({ businessId: 1, station: 1, status: 1 });
KitchenTicketSchema.index({ businessId: 1, ticketNumber: 1 });

export const KitchenTicket: Model<IKitchenTicket> =
  mongoose.models.KitchenTicket ||
  mongoose.model<IKitchenTicket>("KitchenTicket", KitchenTicketSchema);

export default KitchenTicket;
