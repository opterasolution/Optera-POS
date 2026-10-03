import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type SnapshotType =
  | "AUTOMATED_DAILY"
  | "AUTOMATED_WEEKLY"
  | "MANUAL"
  | "PRE_UPGRADE";

export type SnapshotStatus =
  | "COMPLETED"
  | "IN_PROGRESS"
  | "FAILED"
  | "RESTORED";

export interface ISnapshotCollectionMeta {
  name: string;
  count: number;
  sizeBytes: number;
}

export interface IBackupSnapshot extends Document {
  businessId: Types.ObjectId;
  snapshotId: string;
  type: SnapshotType;
  status: SnapshotStatus;
  collections: ISnapshotCollectionMeta[];
  totalRecords: number;
  fileSizeBytes: number;
  checksumSha256: string;
  storageLocation: "CLOUD_VAULT" | "LOCAL_VAULT";
  dataPayload?: string; // Serialized JSON payload
  initiator: string;
  retentionDays: number;
  expiresAt: Date;
  restoredAt?: Date;
  restoredBy?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SnapshotCollectionMetaSchema = new Schema<ISnapshotCollectionMeta>(
  {
    name: { type: String, required: true },
    count: { type: Number, required: true, min: 0 },
    sizeBytes: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const BackupSnapshotSchema = new Schema<IBackupSnapshot>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    snapshotId: { type: String, required: true, trim: true, index: true },
    type: {
      type: String,
      enum: ["AUTOMATED_DAILY", "AUTOMATED_WEEKLY", "MANUAL", "PRE_UPGRADE"],
      default: "MANUAL",
      index: true,
    },
    status: {
      type: String,
      enum: ["COMPLETED", "IN_PROGRESS", "FAILED", "RESTORED"],
      default: "COMPLETED",
      index: true,
    },
    collections: [SnapshotCollectionMetaSchema],
    totalRecords: { type: Number, required: true, default: 0 },
    fileSizeBytes: { type: Number, required: true, default: 0 },
    checksumSha256: { type: String, required: true, trim: true },
    storageLocation: {
      type: String,
      enum: ["CLOUD_VAULT", "LOCAL_VAULT"],
      default: "CLOUD_VAULT",
    },
    dataPayload: { type: String }, // Serialized JSON of all collections
    initiator: { type: String, default: "System", trim: true },
    retentionDays: { type: Number, default: 30, min: 1 },
    expiresAt: { type: Date, required: true },
    restoredAt: { type: Date },
    restoredBy: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

// Compound indexes for rapid historical audits and retention pruning
BackupSnapshotSchema.index({ businessId: 1, createdAt: -1 });
BackupSnapshotSchema.index({ businessId: 1, snapshotId: 1 }, { unique: true });

export const BackupSnapshot: Model<IBackupSnapshot> =
  mongoose.models.BackupSnapshot ||
  mongoose.model<IBackupSnapshot>("BackupSnapshot", BackupSnapshotSchema);

export default BackupSnapshot;
