/**
 * Sri Lanka POS — WhatsApp & SMS Digital Notification Utility
 * Provides standardized phone normalization, digital receipt formatting,
 * and culturally polite customer debt ("Naya Potha") reminders.
 */

import { formatCurrency, formatSLDateTime } from "./formatters";

/**
 * Normalizes Sri Lankan phone numbers for WhatsApp 'wa.me' format
 * Examples:
 * - "077 123 4567" -> "94771234567"
 * - "+94771234567" -> "94771234567"
 * - "0112345678"   -> "94112345678"
 * - "771234567"    -> "94771234567"
 */
export function toWhatsAppPhone(phone: string | undefined | null): string {
  if (!phone) return "";
  let clean = phone.trim().replace(/[\s\-\+()]/g, "");
  if (clean.startsWith("0")) {
    clean = "94" + clean.slice(1);
  } else if (!clean.startsWith("94") && (clean.length === 9 || clean.length === 8)) {
    clean = "94" + clean;
  }
  return clean;
}

/**
 * Builds direct WhatsApp Web / App intent URL
 */
export function buildWhatsAppUrl(phone: string | undefined | null, messageText: string): string {
  const formattedPhone = toWhatsAppPhone(phone);
  const encodedText = encodeURIComponent(messageText);
  if (!formattedPhone) {
    return `https://wa.me/?text=${encodedText}`;
  }
  return `https://wa.me/${formattedPhone}?text=${encodedText}`;
}

export interface ReceiptMessageOptions {
  sale: {
    _id?: string;
    invoiceNumber: string;
    createdAt?: string | Date;
    cashierName?: string;
    customerName?: string;
    customerPhone?: string;
    registerName?: string;
    registerNumber?: string;
    items: Array<{
      name: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }>;
    subtotal: number;
    discountTotal?: number;
    taxTotal?: number;
    netTotal: number;
    paymentMethod: string;
    cashReceived?: number;
    changeGiven?: number;
    pointsEarned?: number;
    pointsRedeemed?: number;
    loyaltyDiscount?: number;
    appliedPromotions?: Array<{
      name: string;
      code?: string;
      discountAmount: number;
    }>;
  };
  business: {
    name?: string;
    phone?: string;
    address?: string;
    receiptSettings?: {
      headerMessage?: string;
      footerMessage?: string;
    };
  };
  publicReceiptUrl?: string;
}

/**
 * Formats clean, professional WhatsApp text receipt
 */
export function formatWhatsAppReceipt({
  sale,
  business,
  publicReceiptUrl,
}: ReceiptMessageOptions): string {
  const storeName = business.name || "SRI LANKA POS";
  const dateFormatted = sale.createdAt ? formatSLDateTime(sale.createdAt) : new Date().toLocaleDateString();
  const counterStr = sale.registerNumber || sale.registerName ? ` • ${sale.registerNumber || sale.registerName}` : "";

  // Items summary (show up to 8 items, then summarize remaining)
  const itemsText = sale.items
    .slice(0, 8)
    .map(
      (it) => `• ${it.name} (x${it.quantity}) — ${formatCurrency(it.total)}`
    )
    .join("\n");

  const moreItemsText =
    sale.items.length > 8
      ? `\n• ... and ${sale.items.length - 8} more item(s)`
      : "";

  let paymentDetails = `*Payment Method:* ${sale.paymentMethod}`;
  if (sale.paymentMethod === "CASH" && (sale.cashReceived || 0) > 0) {
    paymentDetails += `\n*Cash Received:* ${formatCurrency(sale.cashReceived)} | *Change:* ${formatCurrency(sale.changeGiven || 0)}`;
  } else if (sale.paymentMethod === "CREDIT") {
    paymentDetails += `\n*Account:* Billed to Credit Ledger (Naya Potha)`;
  }

  let text = `🧾 *DIGITAL RECEIPT: ${storeName.toUpperCase()}*\n`;
  if (business.address) text += `${business.address}\n`;
  text += `---------------------------------\n`;
  text += `*Invoice:* #${sale.invoiceNumber}\n`;
  text += `*Date:* ${dateFormatted}\n`;
  text += `*Cashier:* ${sale.cashierName || "Staff"}${counterStr}\n`;
  if (sale.customerName && sale.customerName !== "Walk-in Customer") {
    text += `*Customer:* ${sale.customerName}\n`;
  }
  text += `---------------------------------\n`;
  text += `*Items Purchased:*\n${itemsText}${moreItemsText}\n`;
  text += `---------------------------------\n`;
  text += `*Subtotal:* ${formatCurrency(sale.subtotal)}\n`;

  // Applied Promotions breakdown
  if (sale.appliedPromotions && sale.appliedPromotions.length > 0) {
    for (const p of sale.appliedPromotions) {
      text += `*Promo (${p.name}):* -${formatCurrency(p.discountAmount)}\n`;
    }
  }

  // Loyalty Discount
  if (sale.loyaltyDiscount && sale.loyaltyDiscount > 0) {
    text += `*Loyalty Discount (${sale.pointsRedeemed || 0} pts):* -${formatCurrency(sale.loyaltyDiscount)}\n`;
  }

  if ((sale.discountTotal || 0) > 0 && (!sale.appliedPromotions || sale.appliedPromotions.length === 0) && (!sale.loyaltyDiscount || sale.loyaltyDiscount === 0)) {
    text += `*Discount:* -${formatCurrency(sale.discountTotal)}\n`;
  }
  if ((sale.taxTotal || 0) > 0) {
    text += `*Tax:* +${formatCurrency(sale.taxTotal)}\n`;
  }
  text += `*NET TOTAL:* *${formatCurrency(sale.netTotal)}*\n`;
  text += `${paymentDetails}\n`;

  // Loyalty Points Rewards breakdown
  if ((sale.pointsEarned && sale.pointsEarned > 0) || (sale.pointsRedeemed && sale.pointsRedeemed > 0)) {
    text += `---------------------------------\n`;
    text += `⭐ *Loyalty Rewards Summary:*\n`;
    if (sale.pointsEarned && sale.pointsEarned > 0) {
      text += `• Points Earned: +${sale.pointsEarned} pts\n`;
    }
    if (sale.pointsRedeemed && sale.pointsRedeemed > 0) {
      text += `• Points Redeemed: -${sale.pointsRedeemed} pts\n`;
    }
  }
  text += `---------------------------------\n`;

  if (publicReceiptUrl) {
    text += `🌐 *View Interactive E-Receipt:*\n${publicReceiptUrl}\n\n`;
  }

  const footer = business.receiptSettings?.footerMessage || "Thank you for shopping with us! Please come again.";
  text += `${footer} 🙏\n`;
  if (business.phone) {
    text += `📞 Hotline: ${business.phone}`;
  }

  return text.trim();
}

export interface DebtReminderOptions {
  customer: {
    _id?: string;
    name: string;
    phone: string;
    currentBalance?: number;
    creditLimit?: number;
    lastReminderSentAt?: string | Date;
  };
  business: {
    name?: string;
    phone?: string;
    address?: string;
    bankDetails?: {
      bankName?: string;
      branchName?: string;
      accountNumber?: string;
      accountName?: string;
    };
    notificationSettings?: {
      defaultReminderTemplate?: string;
    };
  };
}

/**
 * Formats polite, culturally sensitive Sri Lankan customer credit ("Naya Potha") debt reminder
 */
export function formatWhatsAppDebtReminder({
  customer,
  business,
}: DebtReminderOptions): string {
  const storeName = business.name || "Our Store";
  const balance = customer.currentBalance || 0;
  const limit = customer.creditLimit || 0;
  const available = Math.max(0, limit - balance);

  let bankSection = "";
  if (
    business.bankDetails?.bankName &&
    business.bankDetails?.accountNumber
  ) {
    bankSection = `\n🏦 *Direct Bank Transfer Details:*\n` +
      `• *Bank:* ${business.bankDetails.bankName}\n` +
      (business.bankDetails.branchName ? `• *Branch:* ${business.bankDetails.branchName}\n` : "") +
      `• *Account Name:* ${business.bankDetails.accountName || storeName}\n` +
      `• *Account No:* *${business.bankDetails.accountNumber}*\n` +
      `_(Please send deposit slip / transfer screenshot after payment)_\n`;
  }

  const defaultMsg =
    `Dear ${customer.name},\n\n` +
    `This is a friendly reminder from *${storeName}* regarding your store credit balance (Naya Potha).\n\n` +
    `📌 *Credit Account Summary:*\n` +
    `• Outstanding Balance (හිඟ මුදල): *${formatCurrency(balance)}*\n` +
    (limit > 0 ? `• Credit Limit: ${formatCurrency(limit)}\n` : "") +
    (limit > 0 ? `• Available Credit: ${formatCurrency(available)}\n` : "") +
    bankSection +
    `\nYou are also welcome to settle in cash or card at our counter during store opening hours.\n\n` +
    `For any questions, feel free to contact us${business.phone ? ` at *${business.phone}*` : ""}.\n\n` +
    `Thank you for your continued friendship and valued patronage! 🙏`;

  return defaultMsg.trim();
}
