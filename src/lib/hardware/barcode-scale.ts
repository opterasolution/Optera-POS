/**
 * Sri Lanka Retail POS - Variable-Weight & Scale Barcode Parser
 * 
 * Supports in-store scale barcodes (EAN-13) standard across Sri Lankan supermarkets
 * (Keells, Cargills, Arpico, Laughs, local deli and produce counters).
 * 
 * Format 1 (Weight Embedded): 20 [PLU: 5 digits] [Weight: 5 digits (grams)] [Checksum: 1 digit]
 * Format 2 (Price Embedded):  28 [PLU: 5 digits] [Price: 5 digits (cents or LKR)] [Checksum: 1 digit]
 */

export interface VariableWeightBarcodeConfig {
  weightPrefixes?: string[]; // default: ["20", "21", "02"]
  pricePrefixes?: string[];  // default: ["28", "29"]
  pluLength?: number;        // default: 5
  valueLength?: number;      // default: 5
}

export interface ParsedScaleBarcode {
  isVariableBarcode: boolean;
  type: "WEIGHT" | "PRICE";
  prefix: string;
  pluCode: string;
  normalizedPlu: string;     // stripped leading zeros (e.g., "00105" -> "105")
  weightInGrams?: number;    // e.g. 450
  weightInKg?: number;       // e.g. 0.450
  embeddedPrice?: number;    // e.g. 250.00
  rawCode: string;
}

/**
 * Calculates EAN-13 check digit using Modulo 10 algorithm
 */
export function calculateEan13Checksum(code12: string): number {
  if (code12.length !== 12) return 0;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(code12[i], 10);
    if (isNaN(digit)) return 0;
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const rem = sum % 10;
  return rem === 0 ? 0 : 10 - rem;
}

/**
 * Parses a barcode string to determine if it is an in-store scale generated variable barcode.
 */
export function parseVariableWeightBarcode(
  rawBarcode: string,
  config?: VariableWeightBarcodeConfig
): ParsedScaleBarcode | null {
  const barcode = (rawBarcode || "").trim();
  if (barcode.length !== 13 || !/^\d{13}$/.test(barcode)) {
    return null;
  }

  const weightPrefixes = config?.weightPrefixes || ["20", "21", "02"];
  const pricePrefixes = config?.pricePrefixes || ["28", "29"];
  const pluLen = config?.pluLength || 5;
  const valLen = config?.valueLength || 5;

  const prefix2 = barcode.slice(0, 2);

  const isWeight = weightPrefixes.includes(prefix2);
  const isPrice = pricePrefixes.includes(prefix2);

  if (!isWeight && !isPrice) {
    return null;
  }

  const pluCode = barcode.slice(2, 2 + pluLen);
  const valueStr = barcode.slice(2 + pluLen, 2 + pluLen + valLen);
  const normalizedPlu = pluCode.replace(/^0+/, "") || pluCode;

  if (isWeight) {
    const grams = parseInt(valueStr, 10);
    if (isNaN(grams) || grams <= 0) return null;

    return {
      isVariableBarcode: true,
      type: "WEIGHT",
      prefix: prefix2,
      pluCode,
      normalizedPlu,
      weightInGrams: grams,
      weightInKg: parseFloat((grams / 1000).toFixed(3)),
      rawCode: barcode,
    };
  }

  if (isPrice) {
    const rawVal = parseInt(valueStr, 10);
    if (isNaN(rawVal) || rawVal <= 0) return null;

    // Price embedded is usually in integer LKR or cents (if 2 decimal points).
    // For standard Sri Lankan supermarkets, 5 digits represents total LKR (e.g. 00350 = Rs. 350.00).
    const price = rawVal > 10000 ? rawVal / 100 : rawVal;

    return {
      isVariableBarcode: true,
      type: "PRICE",
      prefix: prefix2,
      pluCode,
      normalizedPlu,
      embeddedPrice: price,
      rawCode: barcode,
    };
  }

  return null;
}

/**
 * Generates an in-store EAN-13 scale barcode for testing or scale barcode printing.
 * Example: PLU 105, 850 grams -> "200010500850X" with valid checksum
 */
export function generateVariableWeightBarcode(
  pluCode: string | number,
  weightInGrams: number,
  prefix = "20"
): string {
  const paddedPlu = String(pluCode).padStart(5, "0").slice(-5);
  const clampedGrams = Math.max(1, Math.min(99999, Math.round(weightInGrams)));
  const paddedWeight = String(clampedGrams).padStart(5, "0");

  const base12 = `${prefix}${paddedPlu}${paddedWeight}`;
  const checksum = calculateEan13Checksum(base12);

  return `${base12}${checksum}`;
}
