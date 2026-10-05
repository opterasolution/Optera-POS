import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type SupplierDebitNoteStatus = "DRAFT" | "ISSUED" | "APPLIED" | "REJECTED" | "CANCELLED";
export type DebitNoteSettlementType = "AP_CREDIT_OFFSET" | "REPLACEMENT" | "REFUND" | "PENDING";
export type DebitNoteReturnReason =
  | "DAMAGED_IN_TRANSIT"
  | "EXPIRED"
  | "NEAR_EXPIRY"
  | "FACTORY_DEFECT"
  | "WRONG_ITEM"
  | "DOCK_REJECTED"
  | "QUALITY_ISSUE"
  | "OTHER";

export interface ISupplierDebitNoteItem {
  productId: Types.ObjectId;
  name: string;
  sku?: string;
  unit: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  reason: DebitNoteReturnReason;
  batchNumber?: string;
  expiryDate?: Date;
  deductInventory: boolean;
  inventoryDeducted: boolean;
  notes?: string;
}

export interface ISupplierDebitNote extends Document {
  businessId: Types.ObjectId;
  debitNoteNumber: string; // e.g. "DN-202610-0001"
  supplierId: Types.ObjectId;
  supplierName: string;
  branchId?: Types.ObjectId;
  branchName?: string;
  grnId?: Types.ObjectId;
  grnNumber?: string;
  purchaseOrderId?: Types.ObjectId;
  poNumber?: string;
  status: SupplierDebitNoteStatus;
  settlementType: DebitNoteSettlementType;
  items: ISupplierDebitNoteItem[];
  subtotal: number;
  taxRate?: number; // e.g. 0 or 18%
  taxAmount?: number;
  netTotal: number; // Total claim amount in LKR
  replacementReceived: boolean;
  distributorRepName?: string;
  distributorVehicleNumber?: string; // Delivery van / lorry #
  distributorCreditNoteNumber?: string; // Vendor's official credit note reference
  handoverDate?: Date;
  settledAt?: Date;
  settledBy?: string;
  rejectionReason?: string;
  notes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function generateDebitNoteNumber(
  businessId: Types.ObjectId | string,
  model?: Model<ISupplierDebitNote>
): Promise<string> {
  const targetModel = model || mongoose.models.SupplierDebitNote || mongoose.model<ISupplierDebitNote>("SupplierDebitNote", SupplierDebitNoteSchema);
  const now = new Date();
  const yearMonth = now.toISOString().slice(0, 7).replace("-", ""); // e.g. "202610"
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const countThisMonth = await targetModel.countDocuments({
    businessId,
    createdAt: { $gte: startOfMonth },
  });

  const seq = (countThisMonth + 1).toString().padStart(4, "0");
  return `DN-${yearMonth}-${seq}`;
}

const SupplierDebitNoteItemSchema = new Schema<ISupplierDebitNoteItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    sku: {
      type: String,
      trim: true,
    },
    unit: {
      type: String,
      required: true,
      default: "pcs",
    },
    quantity: {
      type: Number,
      required: true,
      min: 0.001,
    },
    unitCost: {
      type: Number,
      required: true,
      min: 0,
    },
    totalCost: {
      type: Number,
      required: true,
      min: 0,
    },
    reason: {
      type: String,
      enum: [
        "DAMAGED_IN_TRANSIT",
        "EXPIRED",
        "NEAR_EXPIRY",
        "FACTORY_DEFECT",
        "WRONG_ITEM",
        "DOCK_REJECTED",
        "QUALITY_ISSUE",
        "OTHER",
      ],
      required: true,
      default: "DAMAGED_IN_TRANSIT",
    },
    batchNumber: {
      type: String,
      trim: true,
    },
    expiryDate: {
      type: Date,
    },
    deductInventory: {
      type: Boolean,
      default: true,
    },
    inventoryDeducted: {
      type: Boolean,
      default: false,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const SupplierDebitNoteSchema = new Schema<ISupplierDebitNote>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    debitNoteNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
      index: true,
    },
    supplierName: {
      type: String,
      required: true,
      trim: true,
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
    grnId: {
      type: Schema.Types.ObjectId,
      ref: "GoodsReceivedNote",
      index: true,
    },
    grnNumber: {
      type: String,
      trim: true,
    },
    purchaseOrderId: {
      type: Schema.Types.ObjectId,
      ref: "PurchaseOrder",
      index: true,
    },
    poNumber: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["DRAFT", "ISSUED", "APPLIED", "REJECTED", "CANCELLED"],
      default: "DRAFT",
      index: true,
    },
    settlementType: {
      type: String,
      enum: ["AP_CREDIT_OFFSET", "REPLACEMENT", "REFUND", "PENDING"],
      default: "AP_CREDIT_OFFSET",
      index: true,
    },
    items: {
      type: [SupplierDebitNoteItemSchema],
      required: true,
      default: [],
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    taxRate: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    netTotal: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    replacementReceived: {
      type: Boolean,
      default: false,
    },
    distributorRepName: {
      type: String,
      trim: true,
    },
    distributorVehicleNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },
    distributorCreditNoteNumber: {
      type: String,
      trim: true,
    },
    handoverDate: {
      type: Date,
    },
    settledAt: {
      type: Date,
    },
    settledBy: {
      type: String,
      trim: true,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
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
  {
    timestamps: true,
  }
);

SupplierDebitNoteSchema.index({ businessId: 1, debitNoteNumber: 1 }, { unique: true });
SupplierDebitNoteSchema.index({ businessId: 1, supplierId: 1, status: 1 });
SupplierDebitNoteSchema.index({ businessId: 1, createdAt: -1 });

export const SupplierDebitNote: Model<ISupplierDebitNote> =
  mongoose.models.SupplierDebitNote ||
  mongoose.model<ISupplierDebitNote>("SupplierDebitNote", SupplierDebitNoteSchema);

export default SupplierDebitNote;
