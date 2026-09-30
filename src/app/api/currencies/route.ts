import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Business } from "@/models/Business";
import { requireAuth, verifyActiveSubscription } from "@/lib/tenant";
import { SUPPORTED_CURRENCY_PRESETS, applyMerchantBuffer } from "@/lib/currency";

export const dynamic = "force-dynamic";

/**
 * GET /api/currencies
 * Returns the store's configured currency settings and active exchange rates.
 */
export async function GET() {
  try {
    const context = await requireAuth();
    await verifyActiveSubscription(context.businessId);
    await connectToDatabase();

    const business = await Business.findById(context.businessId).select(
      "currency currencySettings name"
    );

    if (!business) {
      return NextResponse.json({ success: false, error: "Business profile not found" }, { status: 404 });
    }

    let currencySettings = business.currencySettings;

    // Auto-seed defaults if not yet initialized
    if (!currencySettings || !currencySettings.currencies || currencySettings.currencies.length === 0) {
      const defaultCurrencies = SUPPORTED_CURRENCY_PRESETS.map((preset) => ({
        code: preset.code,
        symbol: preset.symbol,
        name: preset.name,
        exchangeRate: preset.defaultRate,
        isEnabled: ["USD", "EUR", "GBP"].includes(preset.code), // USD, EUR, GBP enabled by default
        isAutoUpdated: true,
        marginPercent: 2, // 2% merchant buffer
        updatedAt: new Date(),
      }));

      currencySettings = {
        enabled: true,
        baseCurrency: "LKR",
        exchangeBufferPercent: 2,
        currencies: defaultCurrencies,
      };

      business.currencySettings = currencySettings;
      await business.save();
    }

    return NextResponse.json({
      success: true,
      currencySettings,
      presets: SUPPORTED_CURRENCY_PRESETS,
    });
  } catch (error: any) {
    console.error("Error in GET /api/currencies:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load currency settings" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/currencies
 * Updates multi-currency settings, exchange rates, and enabled currencies.
 */
export async function PUT(req: Request) {
  try {
    const context = await requireAuth();
    await verifyActiveSubscription(context.businessId);

    // Only OWNER or MANAGER can modify exchange rate policies
    if (context.role !== "OWNER" && context.role !== "MANAGER") {
      return NextResponse.json(
        { success: false, error: "Only store owners or managers can modify exchange rates" },
        { status: 403 }
      );
    }

    await connectToDatabase();
    const body = await req.json();

    const business = await Business.findById(context.businessId);
    if (!business) {
      return NextResponse.json({ success: false, error: "Business profile not found" }, { status: 404 });
    }

    const { enabled, baseCurrency, exchangeBufferPercent, currencies } = body;

    const validatedCurrencies = Array.isArray(currencies)
      ? currencies.map((c: any) => ({
          code: String(c.code).toUpperCase().trim(),
          symbol: String(c.symbol).trim(),
          name: String(c.name).trim(),
          exchangeRate: Math.max(0.001, parseFloat(c.exchangeRate) || 1),
          isEnabled: Boolean(c.isEnabled),
          isAutoUpdated: Boolean(c.isAutoUpdated),
          marginPercent: parseFloat(c.marginPercent) || 0,
          updatedAt: new Date(),
        }))
      : business.currencySettings?.currencies || [];

    business.currencySettings = {
      enabled: enabled !== undefined ? Boolean(enabled) : true,
      baseCurrency: baseCurrency || "LKR",
      exchangeBufferPercent:
        exchangeBufferPercent !== undefined ? parseFloat(exchangeBufferPercent) : 2,
      currencies: validatedCurrencies,
    };

    await business.save();

    return NextResponse.json({
      success: true,
      message: "Exchange rates and currency settings saved successfully",
      currencySettings: business.currencySettings,
    });
  } catch (error: any) {
    console.error("Error in PUT /api/currencies:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update currency settings" },
      { status: 500 }
    );
  }
}
