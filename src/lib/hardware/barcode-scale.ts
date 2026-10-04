/**
 * Sri Lanka Retail POS - Variable-Weight & Scale Barcode Engine (GS1 / EAN-13)
 * 
 * Standard for supermarket deli, meat, seafood, produce, and bakery pre-packing
 * (Keells, Cargills Food City, Arpico Supercentre, Laughs Supermarkets).
 * 
 * Variable Measure Standard Formats:
 * - Weight Embedded (EAN-13):
 *   Prefix [2 digits: "21", "20", "02"] + PLU [4-5 digits] + Weight [5-6 digits (grams)] + Checksum [1 digit]
 *   Example: 21 00105 01250 8 -> PLU 105 (Red Onions), 1,250g (1.250 kg)
 * 
 * - Price Embedded (EAN-13):
 *   Prefix [2 digits: "28", "20", "29"] + PLU [4-5 digits] + Price [5-6 digits (LKR / Cents)] + Checksum [1 digit]
 *   Example: 28 00105 00450 7 -> PLU 105 (Red Onions), Total Rs. 450.00
 */

export interface VariableWeightBarcodeConfig {
  weightPrefixes?: string[]; // default: ["21", "20", "02", "22"]
  pricePrefixes?: string[];  // default: ["28", "29", "23", "24"]
  pluLength?: number;        // default: 5 (or 4)
  valueLength?: number;      // default: 5 (or 6)
  priceDecimals?: number;    // default: 2 (if 00450 -> 450.00 LKR)
  weightDecimals?: number;   // default: 3 (grams / 1000 = kg)
}

export interface ParsedScaleBarcode {
  isVariableBarcode: boolean;
  type: "WEIGHT" | "PRICE";
  prefix: string;
  pluCode: string;
  normalizedPlu: string;     // stripped leading zeros (e.g., "00105" -> "105")
  weightInGrams?: number;    // e.g. 1250
  weightInKg?: number;       // e.g. 1.250
  embeddedPrice?: number;    // e.g. 450.00
  rawCode: string;
  isValidChecksum: boolean;
}

export interface ScaleBarcodeGenerationParams {
  type: "WEIGHT" | "PRICE";
  pluCode: string | number;
  prefix?: string;
  weightKg?: number;
  weightGrams?: number;
  priceLkr?: number;
  pluLength?: number;
}

/**
 * Calculates standard GS1 / EAN-13 check digit using Modulo 10 algorithm
 */
export function calculateEan13Checksum(code12: string): number {
  if (code12.length !== 12) return 0;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(code12[i], 10);
    if (isNaN(digit)) return 0;
    // Odd positions (0-indexed: 0, 2, 4...) weight 1, Even positions weight 3
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const rem = sum % 10;
  return rem === 0 ? 0 : 10 - rem;
}

/**
 * Verifies if an EAN-13 barcode has a mathematically valid check digit.
 */
export function isValidEan13(code13: string): boolean {
  if (!code13 || code13.length !== 13 || !/^\d{13}$/.test(code13)) {
    return false;
  }
  const base12 = code13.slice(0, 12);
  const expectedChecksum = calculateEan13Checksum(base12);
  const actualChecksum = parseInt(code13[12], 10);
  return expectedChecksum === actualChecksum;
}

/**
 * Parses any incoming barcode string to identify if it is a supermarket scale barcode.
 */
export function parseVariableWeightBarcode(
  rawBarcode: string,
  config?: VariableWeightBarcodeConfig
): ParsedScaleBarcode | null {
  const barcode = (rawBarcode || "").trim();
  if (barcode.length !== 13 || !/^\d{13}$/.test(barcode)) {
    return null;
  }

  const weightPrefixes = config?.weightPrefixes || ["21", "20", "02", "22"];
  const pricePrefixes = config?.pricePrefixes || ["28", "29", "23", "24"];
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
  const isValidChecksum = isValidEan13(barcode);

  if (isWeight) {
    const rawVal = parseInt(valueStr, 10);
    if (isNaN(rawVal) || rawVal <= 0) return null;

    // Standard scale format: 5 digits = grams (01250 -> 1.250 kg)
    const weightInGrams = rawVal;
    const weightInKg = parseFloat((weightInGrams / 1000).toFixed(3));

    return {
      isVariableBarcode: true,
      type: "WEIGHT",
      prefix: prefix2,
      pluCode,
      normalizedPlu,
      weightInGrams,
      weightInKg,
      rawCode: barcode,
      isValidChecksum,
    };
  }

  if (isPrice) {
    const rawVal = parseInt(valueStr, 10);
    if (isNaN(rawVal) || rawVal <= 0) return null;

    // In Sri Lankan grocery retail: 5 digits represents total price.
    // If value exceeds 10,000 cents, it may be formatted with 2 decimal places (cents), or direct integer LKR.
    const price = rawVal > 10000 ? rawVal / 100 : rawVal;

    return {
      isVariableBarcode: true,
      type: "PRICE",
      prefix: prefix2,
      pluCode,
      normalizedPlu,
      embeddedPrice: parseFloat(price.toFixed(2)),
      rawCode: barcode,
      isValidChecksum,
    };
  }

  return null;
}

/**
 * Generates an in-store EAN-13 scale barcode string for sticky scale labels.
 */
export function generateScaleBarcode({
  type,
  pluCode,
  prefix,
  weightKg,
  weightGrams,
  priceLkr,
  pluLength = 5,
}: ScaleBarcodeGenerationParams): string {
  const chosenPrefix =
    prefix || (type === "WEIGHT" ? "21" : "28");

  const cleanPlu = String(pluCode).replace(/\D/g, "");
  const paddedPlu = cleanPlu.padStart(pluLength, "0").slice(-pluLength);

  let valStr = "00000";
  if (type === "WEIGHT") {
    let grams = weightGrams;
    if (grams === undefined && weightKg !== undefined) {
      grams = Math.round(weightKg * 1000);
    }
    const clampedGrams = Math.max(1, Math.min(99999, Math.round(grams || 0)));
    valStr = String(clampedGrams).padStart(5, "0");
  } else {
    const clampedPrice = Math.max(1, Math.min(99999, Math.round(priceLkr || 0)));
    valStr = String(clampedPrice).padStart(5, "0");
  }

  const base12 = `${chosenPrefix}${paddedPlu}${valStr}`;
  const checksum = calculateEan13Checksum(base12);

  return `${base12}${checksum}`;
}

/**
 * Backward compatibility alias
 */
export function generateVariableWeightBarcode(
  pluCode: string | number,
  weightInGrams: number,
  prefix = "21"
): string {
  return generateScaleBarcode({
    type: "WEIGHT",
    pluCode,
    prefix,
    weightGrams: weightInGrams,
  });
}

// ============================================================================
// GS1 EAN-13 VECTOR SVG BARCODE ENCODER
// ============================================================================

// EAN-13 Digit patterns (7 modules each)
// L-code (Left odd parity), G-code (Left even parity), R-code (Right parity)
const EAN_L_CODES = [
  "0001101", "0011001", "0010011", "0111101", "0100011",
  "0110001", "0101111", "0111011", "0110111", "0001011"
];

const EAN_G_CODES = [
  "0100111", "0110011", "0011011", "0100001", "0011101",
  "0111001", "0000101", "0010001", "0001001", "0010111"
];

const EAN_R_CODES = [
  "1110010", "1100110", "1101100", "1000010", "1011100",
  "1001110", "1010000", "1000100", "1001000", "1110100"
];

// First digit parity selection for digits 2 to 7 (L = 0, G = 1)
const EAN_PARITY_TABLE = [
  [0, 0, 0, 0, 0, 0], // 0: LLLLLL
  [0, 0, 1, 0, 1, 1], // 1: LLGLGG
  [0, 0, 1, 1, 0, 1], // 2: LLGGLG
  [0, 0, 1, 1, 1, 0], // 3: LLGGGL
  [0, 1, 0, 0, 1, 1], // 4: LGLLGG
  [0, 1, 1, 0, 0, 1], // 5: LGGLLG
  [0, 1, 1, 1, 0, 0], // 6: LGGGLL
  [0, 1, 0, 1, 0, 1], // 7: LGLGLG
  [0, 1, 0, 1, 1, 0], // 8: LGLGGL
  [0, 1, 1, 0, 1, 0], // 9: LGGLGL
];

export interface Ean13SvgOptions {
  barcode: string;
  height?: number;       // default 50
  moduleWidth?: number;  // default 2
  includeText?: boolean; // default true
  fontSize?: number;     // default 11
}

/**
 * Encodes an EAN-13 string into full GS1 bar module sequences with guard bars.
 */
export function encodeEan13(
  code13: string,
  moduleWidth = 2
): {
  bars: Array<{ x: number; width: number; isGuard?: boolean }>;
  totalWidth: number;
} {
  const code = (code13 || "").trim().padStart(13, "0").slice(0, 13);
  const firstDigit = parseInt(code[0], 10) || 0;
  const parity = EAN_PARITY_TABLE[firstDigit];

  const bars: Array<{ x: number; width: number; isGuard?: boolean }> = [];
  let currentX = 10 * moduleWidth; // Quiet zone left

  // 1. Start Guard: 101 (3 modules)
  bars.push({ x: currentX, width: moduleWidth, isGuard: true });
  currentX += moduleWidth * 2; // bar + space
  bars.push({ x: currentX, width: moduleWidth, isGuard: true });
  currentX += moduleWidth;

  // 2. Left 6 digits (digits 2 to 7)
  for (let i = 1; i <= 6; i++) {
    const digit = parseInt(code[i], 10);
    const useG = parity[i - 1] === 1;
    const pattern = useG ? EAN_G_CODES[digit] : EAN_L_CODES[digit];

    for (let m = 0; m < 7; m++) {
      if (pattern[m] === "1") {
        bars.push({ x: currentX, width: moduleWidth, isGuard: false });
      }
      currentX += moduleWidth;
    }
  }

  // 3. Center Guard: 01010 (5 modules)
  currentX += moduleWidth; // space
  bars.push({ x: currentX, width: moduleWidth, isGuard: true });
  currentX += moduleWidth * 2; // bar + space
  bars.push({ x: currentX, width: moduleWidth, isGuard: true });
  currentX += moduleWidth * 2; // bar + space

  // 4. Right 6 digits (digits 8 to 13)
  for (let i = 7; i <= 12; i++) {
    const digit = parseInt(code[i], 10);
    const pattern = EAN_R_CODES[digit];

    for (let m = 0; m < 7; m++) {
      if (pattern[m] === "1") {
        bars.push({ x: currentX, width: moduleWidth, isGuard: false });
      }
      currentX += moduleWidth;
    }
  }

  // 5. End Guard: 101 (3 modules)
  bars.push({ x: currentX, width: moduleWidth, isGuard: true });
  currentX += moduleWidth * 2; // bar + space
  bars.push({ x: currentX, width: moduleWidth, isGuard: true });
  currentX += moduleWidth;

  // 6. Quiet zone right (10 modules)
  const totalWidth = currentX + 10 * moduleWidth;

  return { bars, totalWidth };
}

/**
 * Generates razor-sharp SVG markup for EAN-13 barcodes with extended guard bars.
 */
export function generateEan13Svg({
  barcode,
  height = 54,
  moduleWidth = 1.9,
  includeText = true,
  fontSize = 11,
}: Ean13SvgOptions): {
  svgMarkup: string;
  width: number;
  height: number;
} {
  const code = (barcode || "").padStart(13, "0").slice(0, 13);
  const { bars, totalWidth } = encodeEan13(code, moduleWidth);

  const fullHeight = height;
  const guardBarHeight = includeText ? height - fontSize - 1 : height;
  const normalBarHeight = includeText ? height - fontSize - 6 : height;

  const rects = bars
    .map(
      (b) =>
        `<rect x="${b.x}" y="0" width="${b.width}" height="${
          b.isGuard ? guardBarHeight : normalBarHeight
        }" fill="#000000" />`
    )
    .join("");

  let textElement = "";
  if (includeText) {
    // First digit in left quiet zone
    const d0 = code[0];
    const left6 = code.slice(1, 7);
    const right6 = code.slice(7, 13);

    const leftStartX = 10 * moduleWidth;
    const centerGuardX = leftStartX + 3 * moduleWidth + 42 * moduleWidth;
    const rightEndX = centerGuardX + 5 * moduleWidth + 42 * moduleWidth;

    textElement = `
      <text x="${leftStartX - 4}" y="${fullHeight - 1}" text-anchor="end" font-family="monospace, monospace" font-size="${fontSize}" font-weight="bold" fill="#000000">${d0}</text>
      <text x="${leftStartX + 22 * moduleWidth}" y="${fullHeight - 1}" text-anchor="middle" font-family="monospace, monospace" font-size="${fontSize}" font-weight="bold" letter-spacing="1" fill="#000000">${left6}</text>
      <text x="${centerGuardX + 23 * moduleWidth}" y="${fullHeight - 1}" text-anchor="middle" font-family="monospace, monospace" font-size="${fontSize}" font-weight="bold" letter-spacing="1" fill="#000000">${right6}</text>
    `;
  }

  const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${fullHeight}" width="${totalWidth}" height="${fullHeight}">
    <rect width="${totalWidth}" height="${fullHeight}" fill="#ffffff"/>
    ${rects}
    ${textElement}
  </svg>`;

  return {
    svgMarkup,
    width: totalWidth,
    height: fullHeight,
  };
}
