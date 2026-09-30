import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type ReturnCondition = "RESTOCKABLE" | "DAMAGED" | "EXPIRED";
export type RefundMethod = "CASH" | "CREDIT_NOTE" | "CUSTOMER_BALANCE";

export interface ISaleReturnItem {
  productId: Types.ObjectId;
  name: string;
  barcode?: string;
  unitPrice: number;
  quantity: number;
  condition: ReturnCondition;
  reason: string;
  total: number;
}

export interface ISaleReturn extends Document {
  businessId: Types.ObjectId;
  returnNumber: string; // RTN-YYYYMMDD-XXXX
  originalSaleId?: Types.ObjectId;
  originalInvoiceNumber?: string;
  customerId?: Types.ObjectId;
  customerName: string;
  customerPhone?: string;
  cashierId: Types.ObjectId;
  cashierName: string;
  registerId?: Types.ObjectId;
  registerName?: string;
  shiftId?: Types.ObjectId;
  items: ISaleReturnItem[];
  subtotal: number;
  taxRefunded: number;
  netRefundTotal: number;
  refundMethod: RefundMethod;
  creditNoteId?: Types.ObjectId;
  creditNoteNumber?: string;
  pointsDeducted: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SaleReturnItemSchema = new Schema<ISaleReturnItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    barcode: { type: String },
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    condition: {
      type: String,
      enum: ["RESTOCKABLE", "DAMAGED", "EXPIRED"],
      default: "RESTOCKABLE",
      required: true,
    },
    reason: { type: String, required: true, trim: true },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const SaleReturnSchema = new Schema<ISaleReturn>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    returnNumber: {
      type: String,
      required: true,
      trim: true,
    },
    originalSaleId: { type: Schema.Types.ObjectId, ref: "Sale" },
    originalInvoiceNumber: { type: String, trim: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    customerName: { type: String, required: true, default: "Customer" },
    customerPhone: { type: String, trim: true },
    cashierId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    cashierName: { type: String, required: true },
    registerId: { type: Schema.Types.ObjectId, ref: "Register" },
    registerName: { type: String },
    shiftId: { type: Schema.Types.ObjectId, ref: "Shift" },
    items: [SaleReturnItemSchema],
    subtotal: { type: Number, required: true, min: 0 },
    taxRefunded: { type: Number, default: 0, min: 0 },
    netRefundTotal: { type: Number, required: true, min: 0 },
    refundMethod: {
      type: String,
      enum: ["CASH", "CREDIT_NOTE", "CUSTOMER_BALANCE"],
      required: true,
      default: "CASH",
    },
    creditNoteId: { type: Schema.Types.ObjectId, ref: "CreditNote" },
    creditNoteNumber: { type: String, trim: true },
    pointsDeducted: { type: Number, default: 0, min: 0 },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

SaleReturnSchema.index({ businessId: 1, returnNumber: 1 });
SaleReturnSchema.index({ businessId: 1, originalInvoiceNumber: 1 });
SaleReturnSchema.index({ businessId: 1, createdAt: -1 });

export const SaleReturn: Model<ISaleReturn> =
  mongoose.models.SaleReturn || mongoose.model<ISaleReturn>("SaleReturn", SaleReturnSchema);

export default SaleReturn;
