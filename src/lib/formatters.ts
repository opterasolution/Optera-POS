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
