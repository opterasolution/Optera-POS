import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/tenant";
import { runSystemAudit } from "@/lib/diagnostics/system-audit";
import { optimizeProductionIndexes } from "@/lib/diagnostics/index-optimizer";

export async function GET(req: NextRequest) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPER_ADMIN"]);
    const report = await runSystemAudit(context.businessId, context.businessName);

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error: any) {
    console.error("System diagnostics GET error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to retrieve system diagnostics" },
      { status: error.status || 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const context = await requireRole(["OWNER", "SUPER_ADMIN"]);
    const body = await req.json().catch(() => ({}));
    const { action = "RUN_AUDIT" } = body;

    if (action === "OPTIMIZE_INDEXES") {
      const indexResult = await optimizeProductionIndexes();
      const updatedReport = await runSystemAudit(context.businessId, context.businessName);

      return NextResponse.json({
        success: true,
        action: "OPTIMIZE_INDEXES",
        indexResult,
        report: updatedReport,
        message: `Successfully checked and optimized compound indexes (${indexResult.indexesCreated} new indexes built).`,
      });
    }

    if (action === "RUN_AUDIT") {
      const report = await runSystemAudit(context.businessId, context.businessName);
      return NextResponse.json({
        success: true,
        action: "RUN_AUDIT",
        report,
        message: "Full pre-flight system diagnostics audit completed.",
      });
    }

    return NextResponse.json(
      { success: false, error: `Invalid action: ${action}` },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("System diagnostics POST error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to execute diagnostic operation" },
      { status: error.status || 500 }
    );
  }
}
