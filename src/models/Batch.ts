import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type BatchStatus = "ACTIVE" | "NEAR_EXPIRY" | "EXPIRED" | "DEPLETED" | "QUARANTINED";

export interface IBatch extends Document {
  businessId: Types.ObjectId;
  productId: Types.ObjectId;
  productName: string;
  productBarcode?: string;
  productSku?: string;
  batchNumber: string; // e.g. "BN-202610-001" or manufacturer lot "LOT-9921"
  manufacturingDate?: Date;
  expiryDate: Date; // Primary key for FEFO sorting
  costPrice: number;
  sellingPrice: number;
  mrp?: number; // Maximum Retail Price (widely used in Sri Lankan pharmacies/FMCG)
  initialQuantity: number;
  quantityAvailable: number; // Remaining sellable stock
  quantitySold: number;
  quantityDamaged: number;
  status: BatchStatus;
  supplierId?: Types.ObjectId;
  supplierName?: string;
  purchaseOrderId?: Types.ObjectId;
  poNumber?: string;
  branchId?: Types.ObjectId;
  branchName?: string;
  quarantineReason?: string;
  quarantinedAt?: Date;
  quarantinedBy?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BatchSchema = new Schema<IBatch>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    productName: { type: String, required: true, trim: true },
    productBarcode: { type: String, trim: true },
    productSku: { type: String, trim: true },
    batchNumber: { type: String, required: true, trim: true },
    manufacturingDate: { type: Date },
    expiryDate: { type: Date, required: true, index: true },
    costPrice: { type: Number, required: true, min: 0, default: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    mrp: { type: Number, min: 0 },
    initialQuantity: { type: Number, required: true, min: 0 },
    quantityAvailable: { type: Number, required: true, min: 0 },
    quantitySold: { type: Number, default: 0, min: 0 },
    quantityDamaged: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["ACTIVE", "NEAR_EXPIRY", "EXPIRED", "DEPLETED", "QUARANTINED"],
      default: "ACTIVE",
      index: true,
    },
    supplierId: { type: Schema.Types.ObjectId, ref: "Supplier" },
    supplierName: { type: String, trim: true },
    purchaseOrderId: { type: Schema.Types.ObjectId, ref: "PurchaseOrder" },
    poNumber: { type: String, trim: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch" },
    branchName: { type: String, trim: true },
    quarantineReason: { type: String, trim: true },
    quarantinedAt: { type: Date },
    quarantinedBy: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

// Compound indexes for FEFO allocation and status lookups
BatchSchema.index({ businessId: 1, productId: 1, status: 1, expiryDate: 1 });
BatchSchema.index({ businessId: 1, batchNumber: 1 });
BatchSchema.index({ businessId: 1, expiryDate: 1 });

export const Batch: Model<IBatch> =
  mongoose.models.Batch || mongoose.model<IBatch>("Batch", BatchSchema);

export default Batch;
