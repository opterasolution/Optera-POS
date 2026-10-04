import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type MovementType =
  | "SALE"
  | "RESTOCK"
  | "ADJUSTMENT"
  | "DAMAGE"
  | "RETURN"
  | "TRANSFER_OUT"
  | "TRANSFER_IN"
  | "VAN_LOAD"
  | "VAN_RETURN";

export interface IInventoryMovement extends Document {
  businessId: Types.ObjectId;
  productId: Types.ObjectId;
  branchId?: Types.ObjectId;
  transferId?: Types.ObjectId;
  type: MovementType;
  quantityChange: number; // e.g. -3 or +10
  previousStock: number;
  newStock: number;
  reason?: string;
  referenceId?: string; // e.g. invoice number or STN number
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const InventoryMovementSchema = new Schema<IInventoryMovement>(
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
    branchId: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      index: true,
    },
    transferId: {
      type: Schema.Types.ObjectId,
      ref: "StockTransfer",
      index: true,
    },
    type: {
      type: String,
      enum: [
        "SALE",
        "RESTOCK",
        "ADJUSTMENT",
        "DAMAGE",
        "RETURN",
        "TRANSFER_OUT",
        "TRANSFER_IN",
        "VAN_LOAD",
        "VAN_RETURN",
      ],
      required: true,
    },
    quantityChange: { type: Number, required: true },
    previousStock: { type: Number, required: true },
    newStock: { type: Number, required: true },
    reason: { type: String, trim: true },
    referenceId: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

InventoryMovementSchema.index({ businessId: 1, productId: 1, createdAt: -1 });

export const InventoryMovement: Model<IInventoryMovement> =
  mongoose.models.InventoryMovement ||
  mongoose.model<IInventoryMovement>("InventoryMovement", InventoryMovementSchema);

export default InventoryMovement;
