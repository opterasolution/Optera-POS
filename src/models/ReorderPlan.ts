import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type ReorderUrgency = "OUT_OF_STOCK" | "CRITICAL" | "LOW_STOCK" | "NORMAL";
export type ReorderPlanStatus = "DRAFT" | "CONVERTED" | "DISMISSED";

export interface IReorderPlanItem {
  productId: Types.ObjectId;
  productName: string;
  sku?: string;
  barcode?: string;
  unit: string;
  supplierId?: Types.ObjectId;
  supplierName?: string;
  currentStock: number;
  inboundPoStock: number;
  avgDailySales: number;
  leadTimeDays: number;
  safetyStockDays: number;
  reorderPoint: number;
  suggestedQuantity: number;
  approvedQuantity?: number;
  packSize: number;
  unitCost: number;
  estimatedTotal: number;
  urgency: ReorderUrgency;
  isApproved: boolean;
  generatedPoId?: Types.ObjectId;
  generatedPoNumber?: string;
}

export interface IReorderPlan extends Document {
  businessId: Types.ObjectId;
  planNumber: string; // e.g. "ROP-20261004-0001"
  branchId?: Types.ObjectId;
  branchName?: string;
  lookbackDays: number;
  status: ReorderPlanStatus;
  totalItemsEvaluated: number;
  reorderRequiredCount: number;
  outOfStockCount: number;
  criticalCount: number;
  estimatedTotalCost: number;
  items: IReorderPlanItem[];
  generatedPoIds: Types.ObjectId[];
  generatedPoNumbers: string[];
  notes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export function generateReorderPlanNumber(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ROP-${yyyy}${mm}${dd}-${rand}`;
}

const ReorderPlanItemSchema = new Schema<IReorderPlanItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    sku: {
      type: String,
      trim: true,
    },
    barcode: {
      type: String,
      trim: true,
    },
    unit: {
      type: String,
      default: "pcs",
      trim: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
    },
    supplierName: {
      type: String,
      trim: true,
    },
    currentStock: {
      type: Number,
      required: true,
      default: 0,
    },
    inboundPoStock: {
      type: Number,
      default: 0,
    },
    avgDailySales: {
      type: Number,
      default: 0,
    },
    leadTimeDays: {
      type: Number,
      default: 3,
    },
    safetyStockDays: {
      type: Number,
      default: 5,
    },
    reorderPoint: {
      type: Number,
      default: 0,
    },
    suggestedQuantity: {
      type: Number,
      required: true,
      default: 0,
    },
    approvedQuantity: {
      type: Number,
    },
    packSize: {
      type: Number,
      default: 1,
    },
    unitCost: {
      type: Number,
      default: 0,
    },
    estimatedTotal: {
      type: Number,
      default: 0,
    },
    urgency: {
      type: String,
      enum: ["OUT_OF_STOCK", "CRITICAL", "LOW_STOCK", "NORMAL"],
      default: "LOW_STOCK",
    },
    isApproved: {
      type: Boolean,
      default: true,
    },
    generatedPoId: {
      type: Schema.Types.ObjectId,
      ref: "PurchaseOrder",
    },
    generatedPoNumber: {
      type: String,
      trim: true,
    },
  },
  { _id: true }
);

const ReorderPlanSchema = new Schema<IReorderPlan>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    planNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      index: true,
    },
    branchName: {
      type: String,
      trim: true,
    },
    lookbackDays: {
      type: Number,
      required: true,
      default: 14,
    },
    status: {
      type: String,
      enum: ["DRAFT", "CONVERTED", "DISMISSED"],
      default: "DRAFT",
      index: true,
    },
    totalItemsEvaluated: {
      type: Number,
      default: 0,
    },
    reorderRequiredCount: {
      type: Number,
      default: 0,
    },
    outOfStockCount: {
      type: Number,
      default: 0,
    },
    criticalCount: {
      type: Number,
      default: 0,
    },
    estimatedTotalCost: {
      type: Number,
      default: 0,
    },
    items: [ReorderPlanItemSchema],
    generatedPoIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "PurchaseOrder",
      },
    ],
    generatedPoNumbers: [
      {
        type: String,
        trim: true,
      },
    ],
    notes: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

ReorderPlanSchema.index({ businessId: 1, planNumber: 1 }, { unique: true });
ReorderPlanSchema.index({ businessId: 1, status: 1 });
ReorderPlanSchema.index({ businessId: 1, createdAt: -1 });

export const ReorderPlan: Model<IReorderPlan> =
  mongoose.models.ReorderPlan || mongoose.model<IReorderPlan>("ReorderPlan", ReorderPlanSchema);

export default ReorderPlan;
