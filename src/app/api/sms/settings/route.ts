import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Business } from "@/models/Business";
import { requireRole } from "@/lib/tenant";
import { DEFAULT_SMS_TEMPLATES } from "@/lib/sms";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPERVISOR", "ACCOUNTANT"]);

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const business = await Business.findById(context.businessId).lean();

      if (!business) {
        return NextResponse.json({ success: false, error: "Business not found" }, { status: 404 });
      }

      const settings = business.smsSettings || {
        enabled: false,
        provider: "NOTIFY_LK",
        senderId: "NOTIFYDEMO",
        sendOnCreditSale: true,
        sendOnCreditSettlement: true,
        sendOnLoyaltyPoints: false,
        sendOnGiftVoucher: true,
        sendOnQuotation: false,
        templates: {},
      };

      // Mask sensitive API Key for frontend display
      const maskedKey = settings.apiKey
        ? settings.apiKey.length > 8
          ? "••••••••" + settings.apiKey.slice(-4)
          : "••••••••"
        : "";

      return NextResponse.json({
        success: true,
        settings: {
          ...settings,
          apiKey: maskedKey,
          hasApiKey: Boolean(settings.apiKey),
        },
        defaultTemplates: DEFAULT_SMS_TEMPLATES,
      });
    }

    // Demo Data
    return NextResponse.json({
      success: true,
      settings: {
        enabled: true,
        provider: "NOTIFY_LK",
        senderId: "NOTIFYDEMO",
        userId: "10948",
        apiKey: "••••••••f9a1",
        hasApiKey: true,
        sendOnCreditSale: true,
        sendOnCreditSettlement: true,
        sendOnLoyaltyPoints: true,
        sendOnGiftVoucher: true,
        sendOnQuotation: true,
        templates: {},
      },
      defaultTemplates: DEFAULT_SMS_TEMPLATES,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load SMS settings";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER"]);
    const body = await req.json();

    const {
      enabled,
      provider = "NOTIFY_LK",
      senderId,
      userId,
      apiKey,
      sendOnCreditSale,
      sendOnCreditSettlement,
      sendOnLoyaltyPoints,
      sendOnGiftVoucher,
      sendOnQuotation,
      templates,
    } = body;

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const business = await Business.findById(context.businessId);

      if (!business) {
        return NextResponse.json({ success: false, error: "Business not found" }, { status: 404 });
      }

      if (!business.smsSettings) {
        business.smsSettings = {
          enabled: false,
          provider: "NOTIFY_LK",
          senderId: "NOTIFYDEMO",
          sendOnCreditSale: true,
          sendOnCreditSettlement: true,
          sendOnLoyaltyPoints: false,
          sendOnGiftVoucher: true,
          sendOnQuotation: false,
        };
      }

      if (typeof enabled === "boolean") business.smsSettings.enabled = enabled;
      if (provider) business.smsSettings.provider = provider;
      if (senderId !== undefined) business.smsSettings.senderId = senderId.trim();
      if (userId !== undefined) business.smsSettings.userId = userId.trim();

      // Only update API key if not masked string
      if (apiKey && !apiKey.includes("••••")) {
        business.smsSettings.apiKey = apiKey.trim();
      }

      if (typeof sendOnCreditSale === "boolean") business.smsSettings.sendOnCreditSale = sendOnCreditSale;
      if (typeof sendOnCreditSettlement === "boolean") business.smsSettings.sendOnCreditSettlement = sendOnCreditSettlement;
      if (typeof sendOnLoyaltyPoints === "boolean") business.smsSettings.sendOnLoyaltyPoints = sendOnLoyaltyPoints;
      if (typeof sendOnGiftVoucher === "boolean") business.smsSettings.sendOnGiftVoucher = sendOnGiftVoucher;
      if (typeof sendOnQuotation === "boolean") business.smsSettings.sendOnQuotation = sendOnQuotation;

      if (templates) {
        business.smsSettings.templates = {
          ...business.smsSettings.templates,
          ...templates,
        };
      }

      await business.save();

      return NextResponse.json({
        success: true,
        message: "SMS gateway settings saved successfully",
        settings: business.smsSettings,
      });
    }

    return NextResponse.json({
      success: true,
      message: "SMS gateway settings saved (Demo Mode)",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save SMS settings";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
