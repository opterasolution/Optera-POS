import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/db";
import BackupSnapshot from "@/models/BackupSnapshot";
import crypto from "crypto";

interface Params {
  params: { id: string };
}

// POST /api/backup/snapshots/[id]/restore - Point-in-time database restoration
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    if (user.role !== "OWNER" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Access denied. Only Store Owners and Super Admins can execute database restores." },
        { status: 403 }
      );
    }

    await connectDB();
    const { id } = params;
    const body = await req.json().catch(() => ({}));
    const { confirmationText } = body;

    if (confirmationText !== "CONFIRM RESTORE") {
      return NextResponse.json(
        { error: 'Safety confirmation required. Please type "CONFIRM RESTORE" to authorize.' },
        { status: 400 }
      );
    }

    const snapshot = await BackupSnapshot.findById(id);
    if (!snapshot) {
      return NextResponse.json({ error: "Backup snapshot not found" }, { status: 404 });
    }

    if (!snapshot.dataPayload) {
      return NextResponse.json(
        { error: "Snapshot payload is missing or archived in cold storage." },
        { status: 400 }
      );
    }

    // Step 1: Cryptographic Integrity Verification
    const calculatedHash = crypto
      .createHash("sha256")
      .update(snapshot.dataPayload)
      .digest("hex");

    if (calculatedHash !== snapshot.checksumSha256) {
      return NextResponse.json(
        {
          error:
            "CRITICAL INTEGRITY FAILURE: Cryptographic checksum mismatch. Snapshot may have been corrupted or tampered with. Restoration aborted.",
        },
        { status: 422 }
      );
    }

    // Step 2: Parse and restore collections
    const parsedPayload = JSON.parse(snapshot.dataPayload);
    const backupData = parsedPayload.data || {};

    const { Product } = await import("@/models/Product");
    const { Category } = await import("@/models/Category");
    const { Customer } = await import("@/models/Customer");
    const { Sale } = await import("@/models/Sale");
    const { Batch } = await import("@/models/Batch");
    const { Expense } = await import("@/models/Expense");
    const { RestaurantTable } = await import("@/models/RestaurantTable");

    let restoredCount = 0;

    // Restore Products
    if (Array.isArray(backupData.products) && backupData.products.length > 0) {
      const ops = backupData.products.map((doc: any) => ({
        replaceOne: {
          filter: { _id: doc._id },
          replacement: doc,
          upsert: true,
        },
      }));
      await Product.bulkWrite(ops);
      restoredCount += backupData.products.length;
    }

    // Restore Categories
    if (Array.isArray(backupData.categories) && backupData.categories.length > 0) {
      const ops = backupData.categories.map((doc: any) => ({
        replaceOne: {
          filter: { _id: doc._id },
          replacement: doc,
          upsert: true,
        },
      }));
      await Category.bulkWrite(ops);
      restoredCount += backupData.categories.length;
    }

    // Restore Customers
    if (Array.isArray(backupData.customers) && backupData.customers.length > 0) {
      const ops = backupData.customers.map((doc: any) => ({
        replaceOne: {
          filter: { _id: doc._id },
          replacement: doc,
          upsert: true,
        },
      }));
      await Customer.bulkWrite(ops);
      restoredCount += backupData.customers.length;
    }

    // Restore Sales
    if (Array.isArray(backupData.sales) && backupData.sales.length > 0) {
      const ops = backupData.sales.map((doc: any) => ({
        replaceOne: {
          filter: { _id: doc._id },
          replacement: doc,
          upsert: true,
        },
      }));
      await Sale.bulkWrite(ops);
      restoredCount += backupData.sales.length;
    }

    // Restore Batches
    if (Array.isArray(backupData.batches) && backupData.batches.length > 0) {
      const ops = backupData.batches.map((doc: any) => ({
        replaceOne: {
          filter: { _id: doc._id },
          replacement: doc,
          upsert: true,
        },
      }));
      await Batch.bulkWrite(ops);
      restoredCount += backupData.batches.length;
    }

    // Restore Expenses
    if (Array.isArray(backupData.expenses) && backupData.expenses.length > 0) {
      const ops = backupData.expenses.map((doc: any) => ({
        replaceOne: {
          filter: { _id: doc._id },
          replacement: doc,
          upsert: true,
        },
      }));
      await Expense.bulkWrite(ops);
      restoredCount += backupData.expenses.length;
    }

    // Restore Tables
    if (Array.isArray(backupData.tables) && backupData.tables.length > 0) {
      const ops = backupData.tables.map((doc: any) => ({
        replaceOne: {
          filter: { _id: doc._id },
          replacement: doc,
          upsert: true,
        },
      }));
      await RestaurantTable.bulkWrite(ops);
      restoredCount += backupData.tables.length;
    }

    // Update snapshot record
    snapshot.status = "RESTORED";
    snapshot.restoredAt = new Date();
    snapshot.restoredBy = user.name || "Owner";
    await snapshot.save();

    return NextResponse.json({
      success: true,
      message: `Disaster Recovery Complete! Restored ${restoredCount} records from snapshot ${snapshot.snapshotId}.`,
      restoredCount,
      checksumVerified: true,
      restoredAt: snapshot.restoredAt,
    });
  } catch (error: any) {
    console.error("POST /api/backup/snapshots/[id]/restore error:", error);
    return NextResponse.json(
      { error: error.message || "Disaster recovery restore operation failed" },
      { status: 500 }
    );
  }
}
