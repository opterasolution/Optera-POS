import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type PaymentMethod = "CASH" | "CARD" | "QR" | "BANK_TRANSFER" | "OTHER";
export type SaleStatus = "COMPLETED" | "CANCELLED" | "REFUNDED";

export interface ISaleItem {
  productId: Types.ObjectId;
  name: string;
  barcode?: string;
  unitPrice: number;
  costPrice: number; // Snapshot of cost at sale time for accurate profit reports
  quantity: number;
  subtotal: number;
  discount: number;
  total: number;
}

export interface ISale extends Document {
  businessId: Types.ObjectId;
  invoiceNumber: string;
  cashierId: Types.ObjectId;
  cashierName: string;
  customerId?: Types.ObjectId;
  customerName?: string;
  customerPhone?: string;
  items: ISaleItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  netTotal: number;
  paymentMethod: PaymentMethod;
  cashReceived?: number;
  changeGiven?: number;
  paymentReference?: string;
  registerId?: Types.ObjectId;
  registerName?: string;
  registerNumber?: string;
  offlineId?: string; // Client-generated UUID for idempotent synchronization
  status: SaleStatus;
  createdAt: Date;
  updatedAt: Date;
}

const SaleItemSchema = new Schema<ISaleItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    barcode: { type: String },
    unitPrice: { type: Number, required: true, min: 0 },
    costPrice: { type: Number, required: true, min: 0, default: 0 },
    quantity: { type: Number, required: true, min: 1 },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const SaleSchema = new Schema<ISale>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
      trim: true,
    },
    cashierId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    cashierName: { type: String, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    customerName: { type: String, trim: true },
    customerPhone: { type: String, trim: true },
    items: [SaleItemSchema],
    subtotal: { type: Number, required: true, min: 0 },
    discountTotal: { type: Number, default: 0, min: 0 },
    taxTotal: { type: Number, default: 0, min: 0 },
    netTotal: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      enum: ["CASH", "CARD", "QR", "BANK_TRANSFER", "OTHER"],
      required: true,
    },
    cashReceived: { type: Number, min: 0 },
    changeGiven: { type: Number, min: 0 },
    paymentReference: { type: String, trim: true },
    registerId: { type: Schema.Types.ObjectId, ref: "Register", index: true },
    registerName: { type: String, trim: true },
    registerNumber: { type: String, trim: true },
    offlineId: { type: String, trim: true, sparse: true, index: true },
    status: {
      type: String,
      enum: ["COMPLETED", "CANCELLED", "REFUNDED"],
      default: "COMPLETED",
    },
  },
  { timestamps: true }
);

SaleSchema.index({ businessId: 1, invoiceNumber: 1 }, { unique: true });
SaleSchema.index({ businessId: 1, offlineId: 1 }, { sparse: true });
SaleSchema.index({ businessId: 1, registerId: 1, createdAt: -1 });
SaleSchema.index({ businessId: 1, createdAt: -1 });

export const Sale: Model<ISale> =
  mongoose.models.Sale || mongoose.model<ISale>("Sale", SaleSchema);

export default Sale;
