import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type CreditNoteStatus = "ACTIVE" | "FULLY_REDEEMED" | "EXPIRED" | "CANCELLED";

export interface ICreditNoteRedemption {
  saleId?: Types.ObjectId;
  invoiceNumber?: string;
  amount: number;
  redeemedAt: Date;
}

export interface ICreditNote extends Document {
  businessId: Types.ObjectId;
  creditNoteNumber: string; // CN-YYYYMMDD-XXXX
  returnId?: Types.ObjectId;
  returnNumber?: string;
  customerId?: Types.ObjectId;
  customerName: string;
  customerPhone?: string;
  initialAmount: number;
  remainingBalance: number;
  status: CreditNoteStatus;
  expiryDate: Date;
  issuedBy: string;
  redemptions: ICreditNoteRedemption[];
  createdAt: Date;
  updatedAt: Date;
}

const CreditNoteRedemptionSchema = new Schema<ICreditNoteRedemption>(
  {
    saleId: { type: Schema.Types.ObjectId, ref: "Sale" },
    invoiceNumber: { type: String },
    amount: { type: Number, required: true, min: 0 },
    redeemedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const CreditNoteSchema = new Schema<ICreditNote>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    creditNoteNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    returnId: { type: Schema.Types.ObjectId, ref: "SaleReturn" },
    returnNumber: { type: String, trim: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    customerName: { type: String, required: true, default: "Customer" },
    customerPhone: { type: String, trim: true },
    initialAmount: { type: Number, required: true, min: 0 },
    remainingBalance: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["ACTIVE", "FULLY_REDEEMED", "EXPIRED", "CANCELLED"],
      default: "ACTIVE",
      required: true,
    },
    expiryDate: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
    issuedBy: { type: String, required: true },
    redemptions: [CreditNoteRedemptionSchema],
  },
  { timestamps: true }
);

CreditNoteSchema.index({ businessId: 1, creditNoteNumber: 1 });
CreditNoteSchema.index({ businessId: 1, status: 1 });
CreditNoteSchema.index({ businessId: 1, customerPhone: 1 });
CreditNoteSchema.index({ businessId: 1, expiryDate: 1 });

export const CreditNote: Model<ICreditNote> =
  mongoose.models.CreditNote || mongoose.model<ICreditNote>("CreditNote", CreditNoteSchema);

export default CreditNote;
