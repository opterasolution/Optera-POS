import { Types } from "mongoose";
import { Batch, IBatch, BatchStatus } from "@/models/Batch";

export interface BatchAllocation {
  batchId: Types.ObjectId | string;
  batchNumber: string;
  expiryDate: Date;
  quantityAllocated: number;
  costPrice: number;
  sellingPrice: number;
}

export interface FefoAllocationResult {
  success: boolean;
  allocations: BatchAllocation[];
  allocatedTotal: number;
  unfulfilledQuantity: number;
  error?: string;
}

/**
 * Returns number of calendar days until an expiry date
 * Positive = valid/future, 0 = expires today, Negative = expired in past
 */
export function getDaysUntilExpiry(expiryDate: Date | string): number {
  const exp = new Date(expiryDate);
  const now = new Date();
  // Strip time for clean day diff
  const expUtc = Date.UTC(exp.getUTCFullYear(), exp.getUTCMonth(), exp.getUTCDate());
  const nowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((expUtc - nowUtc) / (1000 * 60 * 60 * 24));
}

/**
 * Computes the life-cycle status of a batch based on expiry date and stock
 */
export function calculateBatchStatus(
  expiryDate: Date | string,
  quantityAvailable: number,
  isQuarantined: boolean = false
): BatchStatus {
  if (isQuarantined) return "QUARANTINED";
  if (quantityAvailable <= 0) return "DEPLETED";

  const days = getDaysUntilExpiry(expiryDate);
  if (days <= 0) return "EXPIRED";
  if (days <= 60) return "NEAR_EXPIRY";
  return "ACTIVE";
}

/**
 * UI visual helper for shelf-life telemetry and color badges
 */
export function getExpiryBadgeInfo(expiryDate: Date | string, status: BatchStatus) {
  const days = getDaysUntilExpiry(expiryDate);

  if (status === "QUARANTINED") {
    return {
      label: "Quarantined",
      badgeColor: "bg-purple-100 text-purple-800 border-purple-200",
      indicatorColor: "bg-purple-600",
      days,
      isSellable: false,
    };
  }

  if (status === "DEPLETED") {
    return {
      label: "Depleted (0 stock)",
      badgeColor: "bg-slate-100 text-slate-600 border-slate-200",
      indicatorColor: "bg-slate-400",
      days,
      isSellable: false,
    };
  }

  if (days <= 0 || status === "EXPIRED") {
    return {
      label: days === 0 ? "Expires Today" : `Expired (${Math.abs(days)}d ago)`,
      badgeColor: "bg-red-100 text-red-800 border-red-200",
      indicatorColor: "bg-red-600",
      days,
      isSellable: false,
    };
  }

  if (days <= 30) {
    return {
      label: `Critical (${days}d left)`,
      badgeColor: "bg-amber-100 text-amber-900 border-amber-300",
      indicatorColor: "bg-amber-600",
      days,
      isSellable: true,
    };
  }

  if (days <= 60) {
    return {
      label: `Near Expiry (${days}d left)`,
      badgeColor: "bg-yellow-100 text-yellow-800 border-yellow-200",
      indicatorColor: "bg-yellow-500",
      days,
      isSellable: true,
    };
  }

  return {
    label: `Good (${days}d left)`,
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    indicatorColor: "bg-emerald-600",
    days,
    isSellable: true,
  };
}

/**
 * Allocates inventory stock according to FEFO (First-Expired, First-Out).
 * Pulls exclusively from active unexpired batches sorted in ascending order of expiryDate.
 */
export async function allocateBatchesFefo({
  businessId,
  productId,
  requestedQuantity,
  preferredBatchId,
}: {
  businessId: Types.ObjectId | string;
  productId: Types.ObjectId | string;
  requestedQuantity: number;
  preferredBatchId?: Types.ObjectId | string;
}): Promise<FefoAllocationResult> {
  const now = new Date();

  // If cashier explicitly picked a preferred batch:
  if (preferredBatchId && Types.ObjectId.isValid(preferredBatchId)) {
    const specificBatch = await Batch.findOne({
      _id: preferredBatchId,
      businessId,
      productId,
    });

    if (!specificBatch) {
      return {
        success: false,
        allocations: [],
        allocatedTotal: 0,
        unfulfilledQuantity: requestedQuantity,
        error: "Specified batch could not be found.",
      };
    }

    if (specificBatch.status === "QUARANTINED") {
      return {
        success: false,
        allocations: [],
        allocatedTotal: 0,
        unfulfilledQuantity: requestedQuantity,
        error: `Batch ${specificBatch.batchNumber} is QUARANTINED and cannot be sold (${specificBatch.quarantineReason || "Quality issue"}).`,
      };
    }

    if (new Date(specificBatch.expiryDate) <= now || specificBatch.status === "EXPIRED") {
      return {
        success: false,
        allocations: [],
        allocatedTotal: 0,
        unfulfilledQuantity: requestedQuantity,
        error: `Batch ${specificBatch.batchNumber} expired on ${new Date(specificBatch.expiryDate).toLocaleDateString("en-LK")} and cannot be dispensed.`,
      };
    }

    if (specificBatch.quantityAvailable < requestedQuantity) {
      return {
        success: false,
        allocations: [],
        allocatedTotal: 0,
        unfulfilledQuantity: requestedQuantity,
        error: `Batch ${specificBatch.batchNumber} only has ${specificBatch.quantityAvailable} units available (requested ${requestedQuantity}).`,
      };
    }

    return {
      success: true,
      allocations: [
        {
          batchId: specificBatch._id,
          batchNumber: specificBatch.batchNumber,
          expiryDate: specificBatch.expiryDate,
          quantityAllocated: requestedQuantity,
          costPrice: specificBatch.costPrice,
          sellingPrice: specificBatch.sellingPrice,
        },
      ],
      allocatedTotal: requestedQuantity,
      unfulfilledQuantity: 0,
    };
  }

  // Automatic FEFO Engine: Fetch valid batches sorted by expiryDate ASC
  const candidateBatches = await Batch.find({
    businessId,
    productId,
    status: { $in: ["ACTIVE", "NEAR_EXPIRY"] },
    quantityAvailable: { $gt: 0 },
    expiryDate: { $gt: now },
  })
    .sort({ expiryDate: 1 })
    .lean();

  if (!candidateBatches || candidateBatches.length === 0) {
    return {
      success: false,
      allocations: [],
      allocatedTotal: 0,
      unfulfilledQuantity: requestedQuantity,
      error: "No active, unexpired batches available for this product.",
    };
  }

  const allocations: BatchAllocation[] = [];
  let remainingNeeded = requestedQuantity;

  for (const b of candidateBatches) {
    if (remainingNeeded <= 0) break;

    const available = b.quantityAvailable;
    const take = Math.min(available, remainingNeeded);

    allocations.push({
      batchId: b._id,
      batchNumber: b.batchNumber,
      expiryDate: b.expiryDate,
      quantityAllocated: take,
      costPrice: b.costPrice,
      sellingPrice: b.sellingPrice,
    });

    remainingNeeded -= take;
  }

  if (remainingNeeded > 0) {
    const totalAvail = candidateBatches.reduce((acc, cur) => acc + cur.quantityAvailable, 0);
    return {
      success: false,
      allocations: [],
      allocatedTotal: 0,
      unfulfilledQuantity: remainingNeeded,
      error: `Insufficient unexpired batch stock. Required: ${requestedQuantity}, only ${totalAvail} unexpired units available in valid batches.`,
    };
  }

  return {
    success: true,
    allocations,
    allocatedTotal: requestedQuantity,
    unfulfilledQuantity: 0,
  };
}

/**
 * Sweeps batches and transitions near-expiry and expired records
 */
export async function refreshBatchStatuses(businessId: Types.ObjectId | string): Promise<{
  expiredCount: number;
  nearExpiryCount: number;
}> {
  const now = new Date();
  const sixtyDaysAhead = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

  // Mark expired
  const expiredRes = await Batch.updateMany(
    {
      businessId,
      status: { $in: ["ACTIVE", "NEAR_EXPIRY"] },
      expiryDate: { $lte: now },
    },
    {
      $set: { status: "EXPIRED" },
    }
  );

  // Mark near expiry
  const nearExpiryRes = await Batch.updateMany(
    {
      businessId,
      status: "ACTIVE",
      quantityAvailable: { $gt: 0 },
      expiryDate: { $gt: now, $lte: sixtyDaysAhead },
    },
    {
      $set: { status: "NEAR_EXPIRY" },
    }
  );

  // Mark depleted
  await Batch.updateMany(
    {
      businessId,
      status: { $in: ["ACTIVE", "NEAR_EXPIRY"] },
      quantityAvailable: { $lte: 0 },
    },
    {
      $set: { status: "DEPLETED" },
    }
  );

  return {
    expiredCount: expiredRes.modifiedCount || 0,
    nearExpiryCount: nearExpiryRes.modifiedCount || 0,
  };
}
