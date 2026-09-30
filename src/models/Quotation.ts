import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type QuotationStatus = "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "CONVERTED" | "EXPIRED";

export interface IQuotationItem {
  productId: Types.ObjectId;
  name: string;
  barcode?: string;
  unitPrice: number;
  costPrice: number;
  quantity: number;
  subtotal: number;
  discount: number;
  total: number;
  priceTier: "RETAIL" | "WHOLESALE";
}

export interface IQuotation extends Document {
  businessId: Types.ObjectId;
  quotationNumber: string;
  customerId?: Types.ObjectId;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  companyName?: string;
  tin?: string;
  vatNumber?: string;
  address?: string;
  items: IQuotationItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  taxBreakdown: {
    taxableAmount: number;
    ssclRate: number;
    ssclAmount: number;
    vatRate: number;
    vatAmount: number;
  };
  netTotal: number;
  validUntil: Date;
  status: QuotationStatus;
  convertedSaleId?: Types.ObjectId;
  convertedInvoiceNumber?: string;
  convertedAt?: Date;
  notes?: string;
  createdBy: string;
  createdById: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const QuotationItemSchema = new Schema<IQuotationItem>(
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
    priceTier: { type: String, enum: ["RETAIL", "WHOLESALE"], default: "RETAIL" },
  },
  { _id: false }
);

const QuotationSchema = new Schema<IQuotation>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    quotationNumber: {
      type: String,
      required: true,
      trim: true,
    },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, trim: true },
    customerEmail: { type: String, trim: true },
    companyName: { type: String, trim: true },
    tin: { type: String, trim: true },
    vatNumber: { type: String, trim: true },
    address: { type: String, trim: true },
    items: [QuotationItemSchema],
    subtotal: { type: Number, required: true, min: 0 },
    discountTotal: { type: Number, default: 0, min: 0 },
    taxTotal: { type: Number, default: 0, min: 0 },
    taxBreakdown: {
      taxableAmount: { type: Number, default: 0 },
      ssclRate: { type: Number, default: 0 },
      ssclAmount: { type: Number, default: 0 },
      vatRate: { type: Number, default: 0 },
      vatAmount: { type: Number, default: 0 },
    },
    netTotal: { type: Number, required: true, min: 0 },
    validUntil: { type: Date, required: true },
    status: {
      type: String,
      enum: ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "CONVERTED", "EXPIRED"],
      default: "DRAFT",
    },
    convertedSaleId: { type: Schema.Types.ObjectId, ref: "Sale" },
    convertedInvoiceNumber: { type: String, trim: true },
    convertedAt: { type: Date },
    notes: { type: String, trim: true },
    createdBy: { type: String, required: true },
    createdById: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

QuotationSchema.index({ businessId: 1, quotationNumber: 1 }, { unique: true });
QuotationSchema.index({ businessId: 1, status: 1 });
QuotationSchema.index({ businessId: 1, createdAt: -1 });

export const Quotation: Model<IQuotation> =
  mongoose.models.Quotation || mongoose.model<IQuotation>("Quotation", QuotationSchema);

export default Quotation;
