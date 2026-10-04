import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type CustomerOrderStatus =
  | "PENDING"
  | "APPROVED"
  | "PROCESSING"
  | "DISPATCHED"
  | "DELIVERED"
  | "CANCELLED";

export interface ICustomerOrderItem {
  productId: Types.ObjectId;
  name: string;
  sku?: string;
  barcode?: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

export interface ICustomerOrder extends Document {
  businessId: Types.ObjectId;
  orderNumber: string;
  customerId: Types.ObjectId;
  customerName: string;
  customerPhone: string;
  companyName?: string;
  customerPoNumber?: string; // Client's corporate PO number (e.g., PO-HILTON-2026-99)
  items: ICustomerOrderItem[];
  subtotal: number;
  taxTotal: number;
  netTotal: number;
  status: CustomerOrderStatus;
  requestedDeliveryDate?: Date;
  deliveryAddress: string;
  notes?: string;
  rejectionReason?: string;
  convertedSaleId?: Types.ObjectId;
  convertedInvoiceNumber?: string;
  convertedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerOrderItemSchema = new Schema<ICustomerOrderItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true },
    barcode: { type: String, trim: true },
    unit: { type: String, default: "pcs", trim: true },
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 0.001 },
    subtotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const CustomerOrderSchema = new Schema<ICustomerOrder>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, required: true, trim: true },
    companyName: { type: String, trim: true },
    customerPoNumber: { type: String, trim: true, uppercase: true },
    items: [CustomerOrderItemSchema],
    subtotal: { type: Number, required: true, min: 0 },
    taxTotal: { type: Number, default: 0, min: 0 },
    netTotal: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "PROCESSING", "DISPATCHED", "DELIVERED", "CANCELLED"],
      default: "PENDING",
      index: true,
    },
    requestedDeliveryDate: { type: Date },
    deliveryAddress: { type: String, required: true, trim: true },
    notes: { type: String, trim: true },
    rejectionReason: { type: String, trim: true },
    convertedSaleId: { type: Schema.Types.ObjectId, ref: "Sale" },
    convertedInvoiceNumber: { type: String, trim: true },
    convertedAt: { type: Date },
  },
  { timestamps: true }
);

CustomerOrderSchema.index({ businessId: 1, createdAt: -1 });
CustomerOrderSchema.index({ businessId: 1, status: 1 });
CustomerOrderSchema.index({ customerId: 1, createdAt: -1 });

export const CustomerOrder: Model<ICustomerOrder> =
  mongoose.models.CustomerOrder || mongoose.model<ICustomerOrder>("CustomerOrder", CustomerOrderSchema);

export default CustomerOrder;
