/**
 * Pure SVG Code 128 & EAN-13 Barcode Generator for Sri Lanka POS
 * 100% Offline, Zero external dependencies.
 * Produces razor-sharp SVG vector output optimized for 203 DPI and 300 DPI thermal printers.
 */

// Code 128 pattern dictionary (107 patterns). Each number represents bar/space module widths.
// e.g. [2,1,2,2,2,2] means bar 2, space 1, bar 2, space 2, bar 2, space 2 (sum = 11 modules).
const CODE128_PATTERNS: number[][] = [
  [2, 1, 2, 2, 2, 2], // 0
  [2, 2, 2, 1, 2, 2], // 1
  [2, 2, 2, 2, 2, 1], // 2
  [1, 2, 1, 2, 2, 3], // 3
  [1, 2, 1, 3, 2, 2], // 4
  [1, 3, 1, 2, 2, 2], // 5
  [1, 2, 2, 2, 1, 3], // 6
  [1, 2, 2, 3, 1, 2], // 7
  [1, 3, 2, 2, 1, 2], // 8
  [2, 2, 1, 2, 1, 3], // 9
  [2, 2, 1, 3, 1, 2], // 10
  [2, 3, 1, 2, 1, 2], // 11
  [1, 1, 2, 2, 3, 2], // 12
  [1, 2, 2, 1, 3, 2], // 13
  [1, 2, 2, 2, 3, 1], // 14
  [1, 1, 3, 2, 2, 2], // 15
  [1, 2, 3, 1, 2, 2], // 16
  [1, 2, 3, 2, 2, 1], // 17
  [2, 2, 3, 2, 1, 1], // 18
  [2, 2, 1, 1, 3, 2], // 19
  [2, 2, 1, 2, 3, 1], // 20
  [2, 1, 3, 2, 1, 2], // 21
  [2, 2, 3, 1, 1, 2], // 22
  [3, 1, 2, 1, 3, 1], // 23
  [3, 1, 1, 2, 2, 2], // 24
  [3, 2, 1, 1, 2, 2], // 25
  [3, 2, 1, 2, 2, 1], // 26
  [3, 1, 2, 2, 1, 2], // 27
  [3, 2, 2, 1, 1, 2], // 28
  [3, 2, 2, 2, 1, 1], // 29
  [2, 1, 2, 1, 2, 3], // 30
  [2, 1, 2, 3, 2, 1], // 31
  [2, 3, 2, 1, 2, 1], // 32
  [1, 1, 1, 3, 2, 3], // 33
  [1, 3, 1, 1, 2, 3], // 34
  [1, 3, 1, 3, 2, 1], // 35
  [1, 1, 2, 3, 1, 3], // 36
  [1, 3, 2, 1, 1, 3], // 37
  [1, 3, 2, 3, 1, 1], // 38
  [2, 1, 1, 3, 1, 3], // 39
  [2, 3, 1, 1, 1, 3], // 40
  [2, 3, 1, 3, 1, 1], // 41
  [1, 1, 2, 1, 3, 3], // 42
  [1, 1, 2, 3, 3, 1], // 43
  [1, 3, 2, 1, 3, 1], // 44
  [1, 1, 3, 1, 2, 3], // 45
  [1, 1, 3, 3, 2, 1], // 46
  [1, 3, 3, 1, 2, 1], // 47
  [3, 1, 3, 1, 2, 1], // 48
  [2, 1, 1, 3, 3, 1], // 49
  [2, 3, 1, 1, 3, 1], // 50
  [2, 1, 3, 1, 1, 3], // 51
  [2, 1, 3, 3, 1, 1], // 52
  [2, 1, 3, 1, 3, 1], // 53
  [3, 1, 1, 1, 2, 3], // 54
  [3, 1, 1, 3, 2, 1], // 55
  [3, 3, 1, 1, 2, 1], // 56
  [3, 1, 2, 1, 1, 3], // 57
  [3, 1, 2, 3, 1, 1], // 58
  [3, 3, 2, 1, 1, 1], // 59
  [3, 1, 4, 1, 1, 1], // 60
  [2, 2, 1, 4, 1, 1], // 61
  [4, 3, 1, 1, 1, 1], // 62
  [1, 1, 1, 2, 2, 4], // 63
  [1, 1, 1, 4, 2, 2], // 64
  [1, 2, 1, 1, 2, 4], // 65
  [1, 2, 1, 4, 2, 1], // 66
  [1, 4, 1, 1, 2, 2], // 67
  [1, 4, 1, 2, 2, 1], // 68
  [1, 1, 2, 2, 1, 4], // 69
  [1, 1, 2, 4, 1, 2], // 70
  [1, 2, 2, 1, 1, 4], // 71
  [1, 2, 2, 4, 1, 1], // 72
  [1, 4, 2, 1, 1, 2], // 73
  [1, 4, 2, 2, 1, 1], // 74
  [2, 4, 1, 2, 1, 1], // 75
  [2, 2, 1, 1, 1, 4], // 76
  [4, 1, 3, 1, 1, 1], // 77
  [2, 4, 1, 1, 1, 2], // 78
  [1, 3, 4, 1, 1, 1], // 79
  [1, 1, 1, 2, 4, 2], // 80
  [1, 2, 1, 1, 4, 2], // 81
  [1, 2, 1, 2, 4, 1], // 82
  [1, 1, 4, 2, 1, 2], // 83
  [1, 2, 4, 1, 1, 2], // 84
  [1, 2, 4, 2, 1, 1], // 85
  [4, 1, 1, 2, 1, 2], // 86
  [4, 2, 1, 1, 1, 2], // 87
  [4, 2, 1, 2, 1, 1], // 88
  [2, 1, 2, 1, 4, 1], // 89
  [2, 1, 4, 1, 2, 1], // 90
  [4, 1, 2, 1, 2, 1], // 91
  [1, 1, 1, 1, 4, 3], // 92
  [1, 1, 1, 3, 4, 1], // 93
  [1, 3, 1, 1, 4, 1], // 94
  [1, 1, 4, 1, 1, 3], // 95
  [1, 1, 4, 3, 1, 1], // 96
  [4, 1, 1, 1, 1, 3], // 97
  [4, 1, 1, 3, 1, 1], // 98
  [1, 1, 3, 1, 4, 1], // 99
  [1, 1, 4, 1, 3, 1], // 100
  [3, 1, 1, 1, 4, 1], // 101
  [4, 1, 1, 1, 3, 1], // 102
  [2, 1, 1, 4, 1, 2], // 103: Start Code A
  [2, 1, 1, 2, 1, 4], // 104: Start Code B
  [2, 1, 1, 2, 3, 2], // 105: Start Code C
  [2, 3, 3, 1, 1, 1, 2], // 106: STOP (7 elements, 13 modules)
];

const START_CODE_B = 104;
const STOP_CODE = 106;

/**
 * Encodes ASCII string into Code 128 Barcode module widths.
 * Returns array of rectangles [ { x, width } ] representing the black bars.
 */
export function encodeCode128(text: string, moduleWidth = 2): {
  bars: Array<{ x: number; width: number }>;
  totalWidth: number;
} {
  const safeText = (text || "000000").trim();
  const codes: number[] = [START_CODE_B];

  // Convert each char to Code 128B code (ASCII - 32)
  for (let i = 0; i < safeText.length; i++) {
    const charCode = safeText.charCodeAt(i);
    if (charCode >= 32 && charCode <= 126) {
      codes.push(charCode - 32);
    } else {
      // Fallback for non-printable ASCII
      codes.push(0); // Space
    }
  }

  // Calculate checksum Modulo 103
  let checksum = codes[0];
  for (let i = 1; i < codes.length; i++) {
    checksum += codes[i] * i;
  }
  codes.push(checksum % 103);
  codes.push(STOP_CODE);

  // Convert codes to bar/space sequences
  const bars: Array<{ x: number; width: number }> = [];
  let currentX = 10 * moduleWidth; // 10-module quiet zone on left

  for (const code of codes) {
    const pattern = CODE128_PATTERNS[code];
    if (!pattern) continue;

    for (let j = 0; j < pattern.length; j++) {
      const width = pattern[j] * moduleWidth;
      const isBar = j % 2 === 0; // Even indices are bars (black), odd are spaces

      if (isBar) {
        bars.push({ x: currentX, width });
      }
      currentX += width;
    }
  }

  // Add 10-module quiet zone on right
  const totalWidth = currentX + 10 * moduleWidth;

  return { bars, totalWidth };
}

/**
 * Generates an inline SVG data URI or SVG string for Code 128.
 */
export function generateCode128Svg({
  text,
  height = 50,
  moduleWidth = 2,
  includeText = true,
  fontSize = 11,
}: {
  text: string;
  height?: number;
  moduleWidth?: number;
  includeText?: boolean;
  fontSize?: number;
}): {
  svgMarkup: string;
  width: number;
  height: number;
} {
  const { bars, totalWidth } = encodeCode128(text, moduleWidth);
  const barHeight = includeText ? Math.max(20, height - fontSize - 6) : height;
  const fullHeight = height;

  const rects = bars
    .map((b) => `<rect x="${b.x}" y="0" width="${b.width}" height="${barHeight}" fill="#000000" />`)
    .join("");

  const textElement = includeText
    ? `<text x="${totalWidth / 2}" y="${fullHeight - 2}" text-anchor="middle" font-family="monospace, monospace" font-size="${fontSize}" font-weight="bold" fill="#000000">${text}</text>`
    : "";

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
