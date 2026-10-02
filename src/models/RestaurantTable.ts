import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type TableStatus =
  | "AVAILABLE"
  | "OCCUPIED"
  | "BILL_REQUESTED"
  | "CLEANING"
  | "RESERVED";

export type TableShape = "ROUND" | "SQUARE" | "RECTANGLE";

export type MealCourse = "STARTER" | "MAIN" | "DESSERT" | "BEVERAGE";

export interface ITableOrderItem {
  _id?: Types.ObjectId;
  productId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  course: MealCourse;
  seatNumber: number;
  notes?: string;
  station?: string;
  sentToKds?: boolean;
}

export interface ITableOrder {
  orderNumber: string;
  customerCount: number;
  customerName?: string;
  serverName: string;
  openedAt: Date;
  items: ITableOrderItem[];
  subtotal: number;
  serviceChargeRate: number; // default 10% standard Sri Lankan restaurant service charge
  serviceChargeAmount: number;
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
}

export interface ITableReservation {
  customerName: string;
  phone: string;
  reservedTime: Date;
  guestCount: number;
  notes?: string;
}

export interface IRestaurantTable extends Document {
  businessId: Types.ObjectId;
  tableNumber: string;
  tableName?: string;
  section: string;
  capacity: number;
  status: TableStatus;
  shape: TableShape;
  position: {
    x: number;
    y: number;
  };
  currentOrder?: ITableOrder;
  reservation?: ITableReservation;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TableOrderItemSchema = new Schema<ITableOrderItem>(
  {
    productId: { type: String },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0.1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
    course: {
      type: String,
      enum: ["STARTER", "MAIN", "DESSERT", "BEVERAGE"],
      default: "MAIN",
    },
    seatNumber: { type: Number, default: 1, min: 1 },
    notes: { type: String, trim: true },
    station: { type: String, default: "HOT_KITCHEN" },
    sentToKds: { type: Boolean, default: false },
  },
  { _id: true }
);

const TableOrderSchema = new Schema<ITableOrder>(
  {
    orderNumber: { type: String, required: true },
    customerCount: { type: Number, default: 2, min: 1 },
    customerName: { type: String, trim: true },
    serverName: { type: String, default: "Staff" },
    openedAt: { type: Date, default: Date.now },
    items: [TableOrderItemSchema],
    subtotal: { type: Number, default: 0 },
    serviceChargeRate: { type: Number, default: 10 },
    serviceChargeAmount: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
  },
  { _id: false }
);

const TableReservationSchema = new Schema<ITableReservation>(
  {
    customerName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    reservedTime: { type: Date, required: true },
    guestCount: { type: Number, default: 2, min: 1 },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const RestaurantTableSchema = new Schema<IRestaurantTable>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    tableNumber: { type: String, required: true, trim: true },
    tableName: { type: String, trim: true },
    section: { type: String, required: true, default: "Main Dining Hall", index: true },
    capacity: { type: Number, required: true, default: 4, min: 1 },
    status: {
      type: String,
      enum: ["AVAILABLE", "OCCUPIED", "BILL_REQUESTED", "CLEANING", "RESERVED"],
      default: "AVAILABLE",
      index: true,
    },
    shape: {
      type: String,
      enum: ["ROUND", "SQUARE", "RECTANGLE"],
      default: "SQUARE",
    },
    position: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
    },
    currentOrder: { type: TableOrderSchema, default: null },
    reservation: { type: TableReservationSchema, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Compound indexes for rapid section queries and uniqueness per business
RestaurantTableSchema.index({ businessId: 1, tableNumber: 1 }, { unique: true });
RestaurantTableSchema.index({ businessId: 1, section: 1, status: 1 });

export const RestaurantTable: Model<IRestaurantTable> =
  mongoose.models.RestaurantTable ||
  mongoose.model<IRestaurantTable>("RestaurantTable", RestaurantTableSchema);

export default RestaurantTable;
