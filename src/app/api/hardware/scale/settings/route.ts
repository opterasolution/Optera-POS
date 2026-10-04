import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Business } from "@/models/Business";
import { requireAuth, requireRole } from "@/lib/tenant";

export async function GET() {
  try {
    const context = await requireAuth();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const business = await Business.findById(context.businessId).select("name currency hardwareSettings");
      if (!business) {
        return NextResponse.json({ success: false, error: "Business not found" }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        weighingScale: business.hardwareSettings?.weighingScale || {
          enabled: true,
          scaleModel: "CAS_PD_II",
          baudRate: 9600,
          autoTare: true,
          defaultTareWeightGrams: 5,
        },
        variableWeightBarcodes: business.hardwareSettings?.variableWeightBarcodes || {
          enabled: true,
          weightPrefixes: ["21", "20", "02"],
          pricePrefixes: ["28", "29"],
          defaultUnit: "kg",
        },
      });
    }

    // Demo fallback
    return NextResponse.json({
      success: true,
      weighingScale: {
        enabled: true,
        scaleModel: "CAS_PD_II",
        baudRate: 9600,
        autoTare: true,
        defaultTareWeightGrams: 5,
      },
      variableWeightBarcodes: {
        enabled: true,
        weightPrefixes: ["21", "20", "02"],
        pricePrefixes: ["28", "29"],
        defaultUnit: "kg",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER"]);
    const body = await req.json();

    const { weighingScale, variableWeightBarcodes } = body;

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const business = await Business.findById(context.businessId);
      if (!business) {
        return NextResponse.json({ success: false, error: "Business not found" }, { status: 404 });
      }

      if (!business.hardwareSettings) {
        business.hardwareSettings = {};
      }

      if (weighingScale) {
        business.hardwareSettings.weighingScale = {
          ...business.hardwareSettings.weighingScale,
          ...weighingScale,
        };
      }

      if (variableWeightBarcodes) {
        business.hardwareSettings.variableWeightBarcodes = {
          ...business.hardwareSettings.variableWeightBarcodes,
          ...variableWeightBarcodes,
        };
      }

      business.markModified("hardwareSettings");
      await business.save();

      return NextResponse.json({
        success: true,
        weighingScale: business.hardwareSettings.weighingScale,
        variableWeightBarcodes: business.hardwareSettings.variableWeightBarcodes,
      });
    }

    return NextResponse.json({
      success: true,
      weighingScale,
      variableWeightBarcodes,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
