/**
 * Sri Lanka Multi-Currency & CBSL Exchange Engine Library
 * Provides conversions, standard currency definitions, market benchmarks,
 * merchant buffer margin adjustments, and formatting helpers.
 */

export interface CurrencyConfig {
  code: string;
  symbol: string;
  name: string;
  flag: string;
  defaultRate: number; // Benchmark against 1 unit = X LKR
  decimals: number;
}

export const SUPPORTED_CURRENCY_PRESETS: CurrencyConfig[] = [
  {
    code: "USD",
    symbol: "$",
    name: "US Dollar",
    flag: "🇺🇸",
    defaultRate: 300.0,
    decimals: 2,
  },
  {
    code: "EUR",
    symbol: "€",
    name: "Euro",
    flag: "🇪🇺",
    defaultRate: 328.5,
    decimals: 2,
  },
  {
    code: "GBP",
    symbol: "£",
    name: "British Pound",
    flag: "🇬🇧",
    defaultRate: 392.0,
    decimals: 2,
  },
  {
    code: "AUD",
    symbol: "A$",
    name: "Australian Dollar",
    flag: "🇦🇺",
    defaultRate: 196.5,
    decimals: 2,
  },
  {
    code: "AED",
    symbol: "AED",
    name: "UAE Dirham",
    flag: "🇦🇪",
    defaultRate: 81.75,
    decimals: 2,
  },
  {
    code: "CAD",
    symbol: "C$",
    name: "Canadian Dollar",
    flag: "🇨🇦",
    defaultRate: 218.0,
    decimals: 2,
  },
  {
    code: "SGD",
    symbol: "S$",
    name: "Singapore Dollar",
    flag: "🇸🇬",
    defaultRate: 231.0,
    decimals: 2,
  },
  {
    code: "JPY",
    symbol: "¥",
    name: "Japanese Yen",
    flag: "🇯🇵",
    defaultRate: 2.05,
    decimals: 0,
  },
  {
    code: "INR",
    symbol: "₹",
    name: "Indian Rupee",
    flag: "🇮🇳",
    defaultRate: 3.55,
    decimals: 2,
  },
  {
    code: "CNY",
    symbol: "¥",
    name: "Chinese Yuan",
    flag: "🇨🇳",
    defaultRate: 42.15,
    decimals: 2,
  },
];

/**
 * Formats an amount in a specified foreign currency or LKR
 */
export function formatForeignCurrency(
  amount: number,
  currencyCode: string = "LKR",
  symbol?: string
): string {
  if (currencyCode === "LKR") {
    return `Rs. ${amount.toLocaleString("en-LK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  const preset = SUPPORTED_CURRENCY_PRESETS.find((c) => c.code === currencyCode);
  const sym = symbol || preset?.symbol || currencyCode;
  const decimals = preset ? preset.decimals : 2;

  return `${sym} ${amount.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/**
 * Converts a Sri Lankan Rupee (LKR) amount into a target foreign currency
 * Formula: Foreign Amount = LKR Amount / Exchange Rate
 */
export function convertLkrToForeign(lkrAmount: number, exchangeRate: number): number {
  if (!exchangeRate || exchangeRate <= 0) return 0;
  const val = lkrAmount / exchangeRate;
  return Math.round(val * 100) / 100;
}

/**
 * Converts a Foreign Currency amount into Sri Lankan Rupees (LKR)
 * Formula: LKR Amount = Foreign Amount * Exchange Rate
 */
export function convertForeignToLkr(foreignAmount: number, exchangeRate: number): number {
  if (!exchangeRate || exchangeRate <= 0) return 0;
  return Math.round(foreignAmount * exchangeRate * 100) / 100;
}

/**
 * Calculates change returned in LKR when a customer tenders foreign cash banknotes
 * @param foreignCashReceived - Amount of foreign cash handed by the customer (e.g. $50.00)
 * @param foreignAmountDue - Foreign equivalent of the bill (e.g. $25.00)
 * @param exchangeRate - Counter exchange rate (e.g. 300.00 LKR per 1 USD)
 * @returns Object with change in LKR and change in foreign currency
 */
export function calculateForeignTenderChange(
  foreignCashReceived: number,
  foreignAmountDue: number,
  exchangeRate: number
): { changeLkr: number; changeForeign: number } {
  if (foreignCashReceived <= foreignAmountDue) {
    return { changeLkr: 0, changeForeign: 0 };
  }

  const changeForeign = Math.round((foreignCashReceived - foreignAmountDue) * 100) / 100;
  const changeLkr = Math.round(changeForeign * exchangeRate * 100) / 100;

  return { changeLkr, changeForeign };
}

/**
 * Applies a merchant margin/buffer (e.g. -2% counter fee) to an official indicative rate
 * Example: Official rate is 300.00, buffer is 2% -> Effective rate is 294.00 LKR
 */
export function applyMerchantBuffer(baseRate: number, bufferPercent: number = 0): number {
  if (!baseRate || baseRate <= 0) return 0;
  const factor = 1 - bufferPercent / 100;
  return Math.round(baseRate * factor * 100) / 100;
}
