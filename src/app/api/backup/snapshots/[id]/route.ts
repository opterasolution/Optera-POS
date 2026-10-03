import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/db";
import BackupSnapshot from "@/models/BackupSnapshot";

interface Params {
  params: { id: string };
}

// GET /api/backup/snapshots/[id] - Get snapshot detail
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const snapshot = await BackupSnapshot.findById(params.id)
      .select("-dataPayload")
      .lean();

    if (!snapshot) {
      return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, snapshot });
  } catch (error: any) {
    console.error("GET /api/backup/snapshots/[id] error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load snapshot" },
      { status: 500 }
    );
  }
}

// DELETE /api/backup/snapshots/[id] - Prune snapshot
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const snapshot = await BackupSnapshot.findByIdAndDelete(params.id);
    if (!snapshot) {
      return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Snapshot ${snapshot.snapshotId} pruned from storage`,
    });
  } catch (error: any) {
    console.error("DELETE /api/backup/snapshots/[id] error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete snapshot" },
      { status: 500 }
    );
  }
}
