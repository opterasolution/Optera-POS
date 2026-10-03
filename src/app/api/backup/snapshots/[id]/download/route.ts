import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/db";
import BackupSnapshot from "@/models/BackupSnapshot";

interface Params {
  params: { id: string };
}

// GET /api/backup/snapshots/[id]/download - Download backup JSON file
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const snapshot = await BackupSnapshot.findById(params.id);
    if (!snapshot || !snapshot.dataPayload) {
      return NextResponse.json(
        { error: "Snapshot payload not found or expired" },
        { status: 404 }
      );
    }

    const filename = `backup-${snapshot.snapshotId}.json`;

    return new NextResponse(snapshot.dataPayload, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Checksum-SHA256": snapshot.checksumSha256,
      },
    });
  } catch (error: any) {
    console.error("GET /api/backup/snapshots/[id]/download error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to download backup snapshot" },
      { status: 500 }
    );
  }
}
