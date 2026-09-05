import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";

export async function GET() {
  const isConfigured = Boolean(process.env.MONGODB_URI);

  if (!isConfigured) {
    return NextResponse.json({
      status: "unconfigured",
      message: "MONGODB_URI is not set in .env.local yet.",
      database: "disconnected",
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const startTime = Date.now();
    const mongooseInstance = await connectToDatabase();
    const latencyMs = Date.now() - startTime;

    const readyState = mongooseInstance.connection.readyState;
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    const stateMap: Record<number, string> = {
      0: "disconnected",
      1: "connected",
      2: "connecting",
      3: "disconnecting",
    };

    return NextResponse.json({
      status: readyState === 1 ? "healthy" : "degraded",
      database: stateMap[readyState] || "unknown",
      latencyMs,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown database connection error";
    return NextResponse.json(
      {
        status: "error",
        database: "error",
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
