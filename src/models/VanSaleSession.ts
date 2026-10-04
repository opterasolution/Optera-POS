import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type VanSaleSessionStatus = "LOADED" | "ON_ROUTE" | "COMPLETED" | "RECONCILED";

export interface IVanLoadedStockItem {
  productId: Types.ObjectId;
  productName: string;
  nameSinhala?: string;
  nameTamil?: string;
  barcode?: string;
  unit: string;
  costPrice: number;
  unitPrice: number;
  wholesalePrice?: number;
  loadedQty: number;
  soldQty: number;
  returnedQty: number;
  damagedQty: number;
  remainingQty: number;
}

export interface IVanSaleTransactionRef {
  saleId: Types.ObjectId;
  invoiceNumber: string;
  customerName?: string;
  customerPhone?: string;
  itemCount: number;
  netTotal: number;
  paymentMethod: string;
  createdAt: Date;
}

export interface IVanSaleSession extends Document {
  businessId: Types.ObjectId;
  branchId?: Types.ObjectId;
  sessionNumber: string;
  driverId: Types.ObjectId;
  driverName: string;
  driverPhone: string;
  vehicleType: "BIKE" | "THREE_WHEELER" | "CAR" | "VAN";
  vehicleNumber: string;
  routeZone?: string;
  notes?: string;
  status: VanSaleSessionStatus;
  loadedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  reconciledAt?: Date;
  items: IVanLoadedStockItem[];
  salesSummary: {
    totalSalesCount: number;
    grossSalesTotal: number;
    discountsTotal: number;
    netSalesTotal: number;
    cashCollected: number;
    lankaQrCollected: number;
    creditCollected: number;
    otherCollected: number;
  };
  transactions: IVanSaleTransactionRef[];
  cashierReconciliation?: {
    status: "PENDING" | "RECONCILED" | "DISCREPANCY";
    reconciledBy?: string;
    reconciledAt?: Date;
    physicalCashSubmitted: number;
    cashShortageOrOverage: number;
    stockDiscrepancyNotes?: string;
    cashierNotes?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const VanLoadedStockItemSchema = new Schema<IVanLoadedStockItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true, trim: true },
    nameSinhala: { type: String, trim: true },
    nameTamil: { type: String, trim: true },
    barcode: { type: String, trim: true },
    unit: { type: String, default: "unit", trim: true },
    costPrice: { type: Number, required: true, min: 0, default: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    wholesalePrice: { type: Number, min: 0 },
    loadedQty: { type: Number, required: true, min: 0.001 },
    soldQty: { type: Number, default: 0, min: 0 },
    returnedQty: { type: Number, default: 0, min: 0 },
    damagedQty: { type: Number, default: 0, min: 0 },
    remainingQty: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const VanSaleTransactionRefSchema = new Schema<IVanSaleTransactionRef>(
  {
    saleId: { type: Schema.Types.ObjectId, ref: "Sale", required: true },
    invoiceNumber: { type: String, required: true, trim: true },
    customerName: { type: String, trim: true },
    customerPhone: { type: String, trim: true },
    itemCount: { type: Number, default: 1 },
    netTotal: { type: Number, required: true },
    paymentMethod: { type: String, default: "CASH" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const VanSaleSessionSchema = new Schema<IVanSaleSession>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", index: true },
    sessionNumber: { type: String, required: true, unique: true, trim: true, index: true },
    driverId: { type: Schema.Types.ObjectId, ref: "DeliveryDriver", required: true, index: true },
    driverName: { type: String, required: true, trim: true },
    driverPhone: { type: String, required: true, trim: true },
    vehicleType: {
      type: String,
      enum: ["BIKE", "THREE_WHEELER", "CAR", "VAN"],
      default: "VAN",
    },
    vehicleNumber: { type: String, required: true, trim: true },
    routeZone: { type: String, trim: true },
    notes: { type: String, trim: true },
    status: {
      type: String,
      enum: ["LOADED", "ON_ROUTE", "COMPLETED", "RECONCILED"],
      default: "LOADED",
      index: true,
    },
    loadedAt: { type: Date, default: Date.now },
    startedAt: { type: Date },
    completedAt: { type: Date },
    reconciledAt: { type: Date },
    items: [VanLoadedStockItemSchema],
    salesSummary: {
      totalSalesCount: { type: Number, default: 0 },
      grossSalesTotal: { type: Number, default: 0 },
      discountsTotal: { type: Number, default: 0 },
      netSalesTotal: { type: Number, default: 0 },
      cashCollected: { type: Number, default: 0 },
      lankaQrCollected: { type: Number, default: 0 },
      creditCollected: { type: Number, default: 0 },
      otherCollected: { type: Number, default: 0 },
    },
    transactions: [VanSaleTransactionRefSchema],
    cashierReconciliation: {
      status: { type: String, enum: ["PENDING", "RECONCILED", "DISCREPANCY"], default: "PENDING" },
      reconciledBy: { type: String, trim: true },
      reconciledAt: { type: Date },
      physicalCashSubmitted: { type: Number, default: 0 },
      cashShortageOrOverage: { type: Number, default: 0 },
      stockDiscrepancyNotes: { type: String, trim: true },
      cashierNotes: { type: String, trim: true },
    },
  },
  { timestamps: true }
);

VanSaleSessionSchema.index({ businessId: 1, status: 1, createdAt: -1 });
VanSaleSessionSchema.index({ businessId: 1, driverId: 1, status: 1 });

export const VanSaleSession: Model<IVanSaleSession> =
  mongoose.models.VanSaleSession || mongoose.model<IVanSaleSession>("VanSaleSession", VanSaleSessionSchema);

export default VanSaleSession;
