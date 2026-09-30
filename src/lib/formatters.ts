/**
 * Sri Lanka POS — Core Formatting Utilities
 */

/**
 * Format any numeric value as Sri Lankan Rupees (Rs. 1,250.00)
 */
export function formatCurrency(amount: number | undefined | null, currency: string = "LKR"): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return "Rs. 0.00";
  }

  const formattedNumber = new Intl.NumberFormat("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  if (currency === "LKR") {
    return `Rs. ${formattedNumber}`;
  }

  return `${currency} ${formattedNumber}`;
}

/**
 * Validates Sri Lankan mobile and landline numbers
 * Accepts formats:
 * - 0712345678 (10 digits starting with 07X)
 * - +94712345678 / 94712345678
 * - 0112345678 (Landline)
 */
export function isValidSLPhone(phone: string): boolean {
  if (!phone) return false;
  const cleanPhone = phone.trim().replace(/[\s-]/g, "");
  // Matches +94 followed by 9 digits OR 0 followed by 9 digits
  const slPhoneRegex = /^(?:\+?94|0)[1-9][0-9]{8}$/;
  return slPhoneRegex.test(cleanPhone);
}

/**
 * Standardize Sri Lankan phone numbers to local standard (e.g. 0771234567)
 */
export function normalizeSLPhone(phone: string): string {
  if (!phone) return "";
  let clean = phone.trim().replace(/[\s-]/g, "");
  if (clean.startsWith("+94")) {
    clean = "0" + clean.slice(3);
  } else if (clean.startsWith("94")) {
    clean = "0" + clean.slice(2);
  }
  return clean;
}

/**
 * Format dates into Asia/Colombo readable format
 */
export function formatSLDateTime(dateInput: Date | string | number): string {
  if (!dateInput) return "";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-LK", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/**
 * Convert numerical currency amount into official English words
 * (Used on IRD Tax Invoices and Commercial Quotations)
 * e.g. 52450.75 -> "Rupees Fifty Two Thousand Four Hundred Fifty and Cents Seventy Five Only"
 */
export function amountToWords(amount: number): string {
  if (amount === undefined || amount === null || isNaN(amount) || amount === 0) {
    return "Rupees Zero Only";
  }

  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
  ];

  function convertGroup(n: number): string {
    let str = "";
    if (n >= 100) {
      str += ones[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)] + " ";
      n %= 10;
    }
    if (n > 0) {
      str += ones[n] + " ";
    }
    return str.trim();
  }

  const integerPart = Math.floor(Math.abs(amount));
  const centsPart = Math.round((Math.abs(amount) - integerPart) * 100);

  if (integerPart === 0 && centsPart === 0) {
    return "Rupees Zero Only";
  }

  const chunks = [
    { value: 1_000_000_000, name: "Billion" },
    { value: 1_000_000, name: "Million" },
    { value: 1_000, name: "Thousand" },
    { value: 1, name: "" },
  ];

  let words = "";
  let rem = integerPart;

  for (const chunk of chunks) {
    if (rem >= chunk.value) {
      const count = Math.floor(rem / chunk.value);
      words += convertGroup(count) + (chunk.name ? " " + chunk.name + " " : " ");
      rem %= chunk.value;
    }
  }

  words = words.trim();
  let result = words ? `Rupees ${words}` : "";

  if (centsPart > 0) {
    const centsWords = convertGroup(centsPart);
    result += (result ? " and " : "") + `Cents ${centsWords}`;
  }

  return (result + " Only").replace(/\s+/g, " ");
}

