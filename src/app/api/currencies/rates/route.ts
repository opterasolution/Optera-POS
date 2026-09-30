import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Business } from "@/models/Business";
import { requireAuth, verifyActiveSubscription } from "@/lib/tenant";
import {
  SUPPORTED_CURRENCY_PRESETS,
  applyMerchantBuffer,
} from "@/lib/currency";

export const dynamic = "force-dynamic";

// In-memory cache for external indicative rates (valid for 1 hour)
let cachedRates: { timestamp: number; rates: Record<string, number> } | null = null;
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

/**
 * Fetches latest market exchange rates against LKR
 * Falls back to CBSL benchmark presets if upstream is unreachable
 */
async function fetchLatestMarketRates(): Promise<Record<string, number>> {
  const now = Date.now();
  if (cachedRates && now - cachedRates.timestamp < CACHE_DURATION_MS) {
    return cachedRates.rates;
  }

  const benchmarkRates: Record<string, number> = {};
  SUPPORTED_CURRENCY_PRESETS.forEach((preset) => {
    benchmarkRates[preset.code] = preset.defaultRate;
  });

  try {
    // Attempt to fetch from public open exchange rate service
    const response = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 3600 },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.result === "success" && data.rates && data.rates.LKR) {
        const usdLkr = data.rates.LKR;
        // Derived rates: 1 Foreign = (USD_LKR / USD_Foreign)
        const computedRates: Record<string, number> = {
          USD: Math.round(usdLkr * 100) / 100,
        };

        SUPPORTED_CURRENCY_PRESETS.forEach((preset) => {
          if (preset.code === "USD") return;
          const rateToUsd = data.rates[preset.code];
          if (rateToUsd && rateToUsd > 0) {
            computedRates[preset.code] = Math.round((usdLkr / rateToUsd) * 100) / 100;
          } else {
            computedRates[preset.code] = preset.defaultRate;
          }
        });

        cachedRates = { timestamp: now, rates: computedRates };
        return computedRates;
      }
    }
  } catch (err) {
    console.warn("Could not fetch remote rates; using CBSL benchmark rates:", err);
  }

  // Fallback to presets
  cachedRates = { timestamp: now, rates: benchmarkRates };
  return benchmarkRates;
}

/**
 * GET /api/currencies/rates
 * Returns latest indicative market rates and store's active counter rates
 */
export async function GET() {
  try {
    const context = await requireAuth();
    await verifyActiveSubscription(context.businessId);

    const marketRates = await fetchLatestMarketRates();

    return NextResponse.json({
      success: true,
      baseCurrency: "LKR",
      marketRates,
      timestamp: new Date().toISOString(),
      source: "Central Bank of Sri Lanka (CBSL) & Market Indicative Rates",
    });
  } catch (error: any) {
    console.error("Error in GET /api/currencies/rates:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch exchange rates" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/currencies/rates
 * Syncs the store's currency settings with current market indicative rates,
 * applying the store's configured buffer margin.
 */
export async function POST(req: Request) {
  try {
    const context = await requireAuth();
    await verifyActiveSubscription(context.businessId);

    if (context.role !== "OWNER" && context.role !== "MANAGER") {
      return NextResponse.json(
        { success: false, error: "Only store owners or managers can sync exchange rates" },
        { status: 403 }
      );
    }

    await connectToDatabase();
    const business = await Business.findById(context.businessId);
    if (!business) {
      return NextResponse.json({ success: false, error: "Business profile not found" }, { status: 404 });
    }

    const marketRates = await fetchLatestMarketRates();
    const bufferPercent = business.currencySettings?.exchangeBufferPercent || 2;

    const currentCurrencies = business.currencySettings?.currencies || [];
    const updatedCurrencies = SUPPORTED_CURRENCY_PRESETS.map((preset) => {
      const existing = currentCurrencies.find((c) => c.code === preset.code);
      const marketRate = marketRates[preset.code] || preset.defaultRate;
      // If auto-update is enabled, apply merchant buffer
      const newRate =
        existing && !existing.isAutoUpdated
          ? existing.exchangeRate
          : applyMerchantBuffer(marketRate, bufferPercent);

      return {
        code: preset.code,
        symbol: preset.symbol,
        name: preset.name,
        exchangeRate: newRate,
        isEnabled: existing ? existing.isEnabled : ["USD", "EUR", "GBP"].includes(preset.code),
        isAutoUpdated: existing ? existing.isAutoUpdated : true,
        marginPercent: bufferPercent,
        updatedAt: new Date(),
      };
    });

    business.currencySettings = {
      enabled: business.currencySettings?.enabled ?? true,
      baseCurrency: "LKR",
      exchangeBufferPercent: bufferPercent,
      currencies: updatedCurrencies,
    };

    await business.save();

    return NextResponse.json({
      success: true,
      message: "Exchange rates updated with live indicative market rates",
      currencySettings: business.currencySettings,
      marketRates,
    });
  } catch (error: any) {
    console.error("Error in POST /api/currencies/rates:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update exchange rates" },
      { status: 500 }
    );
  }
}
