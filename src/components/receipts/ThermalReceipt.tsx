"use client";

import React, { useEffect, useState } from "react";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";
import QRCodeImage from "@/components/common/QRCodeImage";

export interface ThermalReceiptProps {
  business: {
    name: string;
    phone?: string;
    address?: string;
    taxSettings?: {
      enabled?: boolean;
      tin?: string;
      vatNumber?: string;
      ssclEnabled?: boolean;
      ssclRate?: number;
    };
    receiptSettings?: {
      headerMessage?: string;
      footerMessage?: string;
      defaultWidth?: "58mm" | "80mm";
      receiptLanguage?: "en" | "si" | "ta" | "bilingual_si" | "bilingual_ta" | "trilingual";
    };
  };
  sale: {
    _id?: string;
    invoiceNumber: string;
    cashierName: string;
    customerName?: string;
    customerPhone?: string;
    registerName?: string;
    registerNumber?: string;
    items: Array<{
      name: string;
      nameSinhala?: string;
      nameTamil?: string;
      unitPrice: number;
      quantity: number;
      total: number;
      batchNumber?: string;
      expiryDate?: string | Date;
    }>;
    subtotal: number;
    discountTotal?: number;
    taxTotal?: number;
    netTotal: number;
    paymentMethod: string;
    cashReceived?: number;
    changeGiven?: number;
    paymentReference?: string;
    isOffline?: boolean;
    pointsEarned?: number;
    pointsRedeemed?: number;
    loyaltyDiscount?: number;
    customerTier?: string;
    giftVoucherRedeemed?: {
      code: string;
      amount: number;
      remainingBalance: number;
    };
    appliedPromotions?: Array<{
      name: string;
      code?: string;
      discountAmount: number;
    }>;
    createdAt: string | Date;
  };
  width?: "58mm" | "80mm";
  receiptLanguage?: "en" | "si" | "ta" | "bilingual_si" | "bilingual_ta" | "trilingual";
  publicReceiptUrl?: string;
  showQrCode?: boolean;
  className?: string;
}

function getReceiptLabels(lang: "en" | "si" | "ta" | "bilingual_si" | "bilingual_ta" | "trilingual") {
  if (lang === "si") {
    return {
      title: "විකුණුම් බිල්පත (RECEIPT)",
      invoice: "බිල්පත් අංකය (Inv):",
      date: "දිනය (Date):",
      cashier: "අයකැමි (Cashier):",
      register: "පර්යන්තය (Reg):",
      customer: "පාරිභෝගිකයා (Cust):",
      tel: "දුරකථන (Tel):",
      itemHeader: "භාණ්ඩය (Item)",
      totalHeader: "මුදල (Total)",
      subtotal: "උප එකතුව (Subtotal):",
      discount: "වට්ටම් (Discount):",
      tax: "බදු (Tax):",
      total: "මුළු එකතුව (TOTAL):",
      paymentMethod: "ගෙවීම් ක්‍රමය (Payment):",
      cashTendered: "ලැබුණු මුදල (Cash):",
      changeReturned: "ඉතිරි මුදල (Change):",
      creditAccount: "* ණය ගිණුමට හර කරන ලදී (ණය පොත) *",
      signature: "පාරිභෝගික අත්සන (Customer Signature)",
      qrScan: "ඩිජිටල් බිල්පත සඳහා ස්කෑන් කරන්න",
      thankYou: "ස්තූතියි! නැවත පැමිණෙන්න.",
      defaultReturn: "දින 3ක් ඇතුළත බිල්පත සමඟ භාණ්ඩ මාරු කළ හැක.",
    };
  }
  if (lang === "ta") {
    return {
      title: "விற்பனை ரசீது (RECEIPT)",
      invoice: "விலைப்பட்டியல் (Inv):",
      date: "தேதி (Date):",
      cashier: "காசாளர் (Cashier):",
      register: "கவுண்டர் (Reg):",
      customer: "வாடிக்கையாளர் (Cust):",
      tel: "தொலைபேசி (Tel):",
      itemHeader: "பொருள் (Item)",
      totalHeader: "தொகை (Total)",
      subtotal: "கூட்டுத்தொகை (Subtotal):",
      discount: "தள்ளுபடி (Discount):",
      tax: "வரி (Tax):",
      total: "மொத்த தொகை (TOTAL):",
      paymentMethod: "கட்டண முறை (Payment):",
      cashTendered: "பெறப்பட்ட தொகை (Cash):",
      changeReturned: "மீதி தொகை (Change):",
      creditAccount: "* கடன் கணக்கில் பற்று வைக்கப்பட்டது (நய போத) *",
      signature: "வாடிக்கையாளர் கையொப்பம் (Signature)",
      qrScan: "டிஜிட்டல் ரசீதுக்கு ஸ்கேன் செய்க",
      thankYou: "நன்றி! மீண்டும் வருக.",
      defaultReturn: "ரசீதுடன் 3 நாட்களுக்குள் பொருட்களை மாற்றலாம்.",
    };
  }
  if (lang === "bilingual_si") {
    return {
      title: "RECEIPT / විකුණුම් බිල්පත",
      invoice: "INVOICE / බිල්පත:",
      date: "DATE / දිනය:",
      cashier: "CASHIER / අයකැමි:",
      register: "REGISTER / පර්යන්තය:",
      customer: "CUSTOMER / පාරිභෝගිකයා:",
      tel: "TEL / දුරකථන:",
      itemHeader: "ITEM / භාණ්ඩය",
      totalHeader: "TOTAL / මුදල",
      subtotal: "Subtotal / උප එකතුව:",
      discount: "Discount / වට්ටම්:",
      tax: "Tax / බදු:",
      total: "TOTAL / මුළු එකතුව:",
      paymentMethod: "Payment / ගෙවීම්:",
      cashTendered: "Cash / ලැබුණු මුදල:",
      changeReturned: "Change / ඉතිරි මුදල:",
      creditAccount: "* CREDIT ACCOUNT / ණය පොත *",
      signature: "Customer Signature / පාරිභෝගික අත්සන",
      qrScan: "Scan for E-Receipt / ඩිජිටල් බිල්පත",
      thankYou: "Thank You! / ස්තූතියි! නැවත පැමිණෙන්න.",
      defaultReturn: "Goods returnable within 3 days / දින 3ක් ඇතුළත භාණ්ඩ මාරු කළ හැක.",
    };
  }
  if (lang === "bilingual_ta") {
    return {
      title: "RECEIPT / விற்பனை ரசீது",
      invoice: "INVOICE / விலைப்பட்டியல்:",
      date: "DATE / தேதி:",
      cashier: "CASHIER / காசாளர்:",
      register: "REGISTER / கவுண்டர்:",
      customer: "CUSTOMER / வாடிக்கையாளர்:",
      tel: "TEL / தொலைபேசி:",
      itemHeader: "ITEM / பொருள்",
      totalHeader: "TOTAL / தொகை",
      subtotal: "Subtotal / கூட்டுத்தொகை:",
      discount: "Discount / தள்ளுபடி:",
      tax: "Tax / வரி:",
      total: "TOTAL / மொத்தம்:",
      paymentMethod: "Payment / கட்டண முறை:",
      cashTendered: "Cash / பெறப்பட்ட தொகை:",
      changeReturned: "Change / மீதி தொகை:",
      creditAccount: "* CREDIT ACCOUNT / கடன் கணக்கு *",
      signature: "Customer Signature / வாடிக்கையாளர் கையொப்பம்",
      qrScan: "Scan for E-Receipt / டிஜிட்டல் ரசீது",
      thankYou: "Thank You! / நன்றி! மீண்டும் வருக.",
      defaultReturn: "Goods returnable within 3 days / 3 நாட்களுக்குள் மாற்றலாம்.",
    };
  }
  if (lang === "trilingual") {
    return {
      title: "RECEIPT / බිල්පත / ரசீது",
      invoice: "INV / බිල්පත් / ரசீது:",
      date: "DATE / දිනය / தேதி:",
      cashier: "CASHIER / අයකැමි / காசாளர்:",
      register: "REG / පර්යන්ත / கவுண்டர்:",
      customer: "CUST / පාරිභෝගික / வாடிக்கையாளர்:",
      tel: "TEL / දුර / தொலை:",
      itemHeader: "ITEM / භාණ්ඩය / பொருள்",
      totalHeader: "TOTAL (Rs.)",
      subtotal: "Subtotal / උප එකතුව:",
      discount: "Discount / වට්ටම්:",
      tax: "Tax / බදු / வரி:",
      total: "TOTAL / මුළු එකතුව / மொத்தம்:",
      paymentMethod: "Payment / ගෙවීම්:",
      cashTendered: "Cash / ලැබුණු මුදල:",
      changeReturned: "Change / ඉතිරි මුදල:",
      creditAccount: "* CREDIT ACCOUNT / ණය පොත / நய போத *",
      signature: "Signature / පාරිභෝගික අත්සන / கையொப்பம்",
      qrScan: "Scan for E-Receipt / ඩිජිටල් බිල්පත",
      thankYou: "Thank You! / ස්තූතියි! / நன்றி!",
      defaultReturn: "Returnable within 3 days with receipt / දින 3ක් ඇතුළත / 3 நாட்களுக்குள்.",
    };
  }
  // Default English
  return {
    title: "SALES RECEIPT",
    invoice: "INVOICE:",
    date: "DATE:",
    cashier: "CASHIER:",
    register: "REGISTER:",
    customer: "CUSTOMER:",
    tel: "TEL:",
    itemHeader: "Item",
    totalHeader: "Total (Rs.)",
    subtotal: "Subtotal:",
    discount: "Discount:",
    tax: "Tax:",
    total: "TOTAL:",
    paymentMethod: "Payment Method:",
    cashTendered: "Cash Tendered:",
    changeReturned: "Change Returned:",
    creditAccount: "* BILLED TO CREDIT ACCOUNT (NAYA POTHA) *",
    signature: "Customer Acknowledgement Signature",
    qrScan: "Scan for Digital E-Receipt & Tax Invoice",
    thankYou: "Thank you! Please visit us again.",
    defaultReturn: "Goods returnable within 3 days with receipt.",
  };
}

function getItemLocalizedName(
  item: { name: string; nameSinhala?: string; nameTamil?: string },
  lang: "en" | "si" | "ta" | "bilingual_si" | "bilingual_ta" | "trilingual"
): { primary: string; secondary?: string } {
  if (lang === "si" && item.nameSinhala) {
    return { primary: item.nameSinhala, secondary: item.name };
  }
  if (lang === "ta" && item.nameTamil) {
    return { primary: item.nameTamil, secondary: item.name };
  }
  if ((lang === "bilingual_si" || lang === "trilingual") && item.nameSinhala) {
    return { primary: item.name, secondary: item.nameSinhala };
  }
  if (lang === "bilingual_ta" && item.nameTamil) {
    return { primary: item.name, secondary: item.nameTamil };
  }
  return { primary: item.name };
}

export default function ThermalReceipt({
  business,
  sale,
  width,
  receiptLanguage,
  publicReceiptUrl,
  showQrCode = true,
  className = "",
}: ThermalReceiptProps) {
  const receiptWidth = width || business.receiptSettings?.defaultWidth || "58mm";
  const is80mm = receiptWidth === "80mm";
  const effectiveLang = receiptLanguage || business.receiptSettings?.receiptLanguage || "en";
  const labels = getReceiptLabels(effectiveLang);

  const [mountedOrigin, setMountedOrigin] = useState<string>("");
  useEffect(() => {
    if (typeof window !== "undefined") {
      setMountedOrigin(window.location.origin);
    }
  }, []);

  const qrUrl =
    publicReceiptUrl ||
    (mountedOrigin
      ? `${mountedOrigin}/receipt/${sale._id || sale.invoiceNumber}`
      : `https://pos.srilanka.lk/receipt/${sale._id || sale.invoiceNumber}`);

  return (
    <div
      className={`thermal-receipt font-mono bg-white text-black p-3 sm:p-4 leading-tight mx-auto shadow-sm print:shadow-none print:p-0 ${
        is80mm ? "max-w-[320px] text-xs" : "max-w-[260px] text-[11px]"
      } ${className}`}
    >
      {/* Store Header */}
      <div className="text-center space-y-1">
        <h2 className="font-extrabold text-sm sm:text-base uppercase tracking-tight">
          {business.name || "SRI LANKA RETAIL POS"}
        </h2>
        {business.address && (
          <p className="text-[10px] text-zinc-700 leading-snug">{business.address}</p>
        )}
        {business.phone && (
          <p className="text-[10px] text-zinc-700 font-bold">Tel: {business.phone}</p>
        )}
        {business.taxSettings?.tin && (
          <p className="text-[9px] text-zinc-700 font-mono">TIN: {business.taxSettings.tin}</p>
        )}
        {business.taxSettings?.vatNumber && (
          <p className="text-[9px] text-zinc-700 font-mono">VAT Reg: {business.taxSettings.vatNumber}</p>
        )}
        <div className="pt-0.5">
          <span className="text-[9px] font-bold tracking-wider uppercase text-zinc-800 border-b border-zinc-400 pb-0.5 inline-block">
            {labels.title}
          </span>
        </div>
        {business.receiptSettings?.headerMessage && (
          <p className="text-[9px] text-zinc-600 italic mt-1">
            {business.receiptSettings.headerMessage}
          </p>
        )}
      </div>

      {/* Invoice Meta Section */}
      <div className="border-t border-dashed border-zinc-400 my-2 pt-2 space-y-0.5 text-[10px]">
        {(sale.isOffline || sale.invoiceNumber.startsWith("OFFLINE-")) && (
          <div className="my-1 py-0.5 border border-dashed border-amber-600 bg-amber-50 text-amber-950 text-center font-bold text-[9px] uppercase tracking-wider print:border-black print:text-black">
            * OFFLINE COUNTER SALE *
          </div>
        )}
        <div className="flex justify-between">
          <span className="font-bold">{labels.invoice}</span>
          <span className="font-bold">{sale.invoiceNumber}</span>
        </div>
        <div className="flex justify-between">
          <span>{labels.date}</span>
          <span>{formatSLDateTime(sale.createdAt)}</span>
        </div>
        <div className="flex justify-between">
          <span>{labels.cashier}</span>
          <span>{sale.cashierName}</span>
        </div>
        {sale.registerName && (
          <div className="flex justify-between">
            <span>{labels.register}</span>
            <span>{sale.registerName}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>{labels.customer}</span>
          <span>{sale.customerName || "Walk-in Customer"}</span>
        </div>
        {sale.customerPhone && (
          <div className="flex justify-between">
            <span>{labels.tel}</span>
            <span>{sale.customerPhone}</span>
          </div>
        )}
      </div>

      {/* Itemized Table */}
      <div className="border-t border-zinc-800 my-2 pt-2">
        <div className="flex justify-between font-bold pb-1 text-[10px] uppercase border-b border-zinc-300 mb-1">
          <span>{labels.itemHeader}</span>
          <span>{labels.totalHeader}</span>
        </div>

        <div className="space-y-1.5">
          {sale.items.map((item, idx) => {
            const itemNames = getItemLocalizedName(item, effectiveLang);
            return (
              <div key={idx}>
                <div className="flex justify-between font-semibold">
                  <span className="truncate pr-2">{itemNames.primary}</span>
                  <span className="shrink-0">{formatCurrency(item.total)}</span>
                </div>
                {itemNames.secondary && (
                  <div className="text-[9px] text-zinc-500 font-sans pl-1">
                    {itemNames.secondary}
                  </div>
                )}
                <div className="flex justify-between text-[9px] text-zinc-600 pl-2">
                  <span>
                    {item.quantity} x {formatCurrency(item.unitPrice)}
                  </span>
                  {item.batchNumber && (
                    <span className="text-[8px] font-mono text-zinc-500">
                      Lot: {item.batchNumber}
                      {item.expiryDate ? ` Exp: ${new Date(item.expiryDate).toLocaleDateString("en-GB")}` : ""}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Financial Calculations */}
      <div className="border-t border-dashed border-zinc-400 my-2 pt-1.5 space-y-0.5 text-right font-medium">
        <div className="flex justify-between text-zinc-700">
          <span>{labels.subtotal}</span>
          <span>{formatCurrency(sale.subtotal)}</span>
        </div>

        {sale.appliedPromotions && sale.appliedPromotions.length > 0 && (
          <div className="space-y-0.5 text-zinc-700">
            {sale.appliedPromotions.map((p, idx) => (
              <div key={idx} className="flex justify-between text-[10px]">
                <span className="truncate pr-1">PROMO ({p.name}):</span>
                <span>-{formatCurrency(p.discountAmount)}</span>
              </div>
            ))}
          </div>
        )}

        {sale.loyaltyDiscount && sale.loyaltyDiscount > 0 ? (
          <div className="flex justify-between text-zinc-700 text-[10px]">
            <span>REWARDS ({sale.pointsRedeemed || 0} pts):</span>
            <span>-{formatCurrency(sale.loyaltyDiscount)}</span>
          </div>
        ) : null}

        {sale.discountTotal && sale.discountTotal > 0 && (!sale.appliedPromotions || sale.appliedPromotions.length === 0) && (!sale.loyaltyDiscount || sale.loyaltyDiscount === 0) ? (
          <div className="flex justify-between text-zinc-700">
            <span>{labels.discount}</span>
            <span>-{formatCurrency(sale.discountTotal)}</span>
          </div>
        ) : null}

        {sale.taxTotal && sale.taxTotal > 0 ? (
          <div className="flex justify-between text-zinc-700">
            <span>{labels.tax}</span>
            <span>+{formatCurrency(sale.taxTotal)}</span>
          </div>
        ) : null}

        {/* Grand Total */}
        <div className="flex justify-between text-xs sm:text-sm font-black pt-1 border-t border-zinc-800 text-black">
          <span>{labels.total}</span>
          <span>{formatCurrency(sale.netTotal)}</span>
        </div>

        {/* Payment & Change */}
        <div className="pt-1 text-[10px] space-y-0.5">
          <div className="flex justify-between text-zinc-700">
            <span>{labels.paymentMethod}</span>
            <span className="font-bold">{sale.paymentMethod}</span>
          </div>

          {sale.paymentMethod === "CASH" && (
            <>
              <div className="flex justify-between text-zinc-700">
                <span>{labels.cashTendered}</span>
                <span>{formatCurrency(sale.cashReceived)}</span>
              </div>
              <div className="flex justify-between font-bold text-black">
                <span>{labels.changeReturned}</span>
                <span>{formatCurrency(sale.changeGiven)}</span>
              </div>
            </>
          )}

          {sale.paymentMethod === "CREDIT" && (
            <div className="pt-2 border-t border-dashed border-zinc-400 space-y-2 text-[10px]">
              <div className="text-center font-bold uppercase tracking-wider text-[9px] bg-zinc-100 py-0.5 border border-zinc-300">
                {labels.creditAccount}
              </div>
              <div className="pt-6 text-center">
                <div className="border-t border-black pt-1 text-[9px]">
                  {labels.signature}
                </div>
              </div>
            </div>
          )}

          {sale.paymentReference && (
            <div className="flex justify-between text-zinc-600 text-[9px]">
              <span>Ref / Auth:</span>
              <span>{sale.paymentReference}</span>
            </div>
          )}
        </div>

        {/* Gift Voucher Redemption Block */}
        {sale.giftVoucherRedeemed && (
          <div className="border-t border-dashed border-zinc-400 mt-2 pt-1 text-[10px] space-y-0.5">
            <div className="font-bold uppercase tracking-wider text-[9px] text-zinc-800 text-center">
              * GIFT VOUCHER TENDER *
            </div>
            <div className="flex justify-between text-zinc-700">
              <span>Voucher Code:</span>
              <span className="font-mono font-bold">{sale.giftVoucherRedeemed.code}</span>
            </div>
            <div className="flex justify-between text-zinc-700 font-semibold">
              <span>Amount Deducted:</span>
              <span>-{formatCurrency(sale.giftVoucherRedeemed.amount)}</span>
            </div>
            <div className="flex justify-between text-zinc-900 font-bold">
              <span>Remaining Balance:</span>
              <span>{formatCurrency(sale.giftVoucherRedeemed.remainingBalance)}</span>
            </div>
          </div>
        )}

        {/* Loyalty Points Earned / Redeemed Block */}
        {(Boolean(sale.pointsEarned && sale.pointsEarned > 0) ||
          Boolean(sale.pointsRedeemed && sale.pointsRedeemed > 0) ||
          Boolean(sale.customerTier)) && (
          <div className="border-t border-dashed border-zinc-400 mt-2 pt-1 text-[10px] space-y-0.5 text-center">
            <div className="font-bold uppercase tracking-wider text-[9px] text-zinc-800">
              * LOYALTY REWARDS SUMMARY *
            </div>
            {sale.customerTier && (
              <div className="flex justify-between text-zinc-700 font-semibold">
                <span>Customer VIP Tier:</span>
                <span className="font-bold text-amber-700 uppercase">{sale.customerTier}</span>
              </div>
            )}
            {sale.pointsEarned && sale.pointsEarned > 0 ? (
              <div className="flex justify-between text-zinc-700 font-semibold">
                <span>Points Earned Today:</span>
                <span>+{sale.pointsEarned} pts</span>
              </div>
            ) : null}
            {sale.pointsRedeemed && sale.pointsRedeemed > 0 ? (
              <div className="flex justify-between text-zinc-700 font-semibold">
                <span>Points Redeemed:</span>
                <span>-{sale.pointsRedeemed} pts</span>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Digital QR E-Receipt Scan Area */}
      {showQrCode && qrUrl && (
        <div className="border-t border-dashed border-zinc-400 my-2 pt-2 text-center space-y-1">
          <div className="flex justify-center py-0.5">
            <QRCodeImage
              value={qrUrl}
              size={is80mm ? 96 : 80}
              margin={1}
              className="border border-zinc-200 p-0.5 rounded bg-white shadow-xs"
            />
          </div>
          <p className="text-[9px] font-bold text-zinc-900 tracking-tight uppercase">
            {labels.qrScan}
          </p>
          <p className="text-[8px] text-zinc-500 font-mono break-all line-clamp-1">
            {qrUrl}
          </p>
        </div>
      )}

      {/* Footer Return Policy */}
      <div className="border-t border-dashed border-zinc-400 my-2 pt-2 text-center space-y-1">
        <p className="text-[10px] font-semibold text-zinc-800">
          {business.receiptSettings?.footerMessage || labels.defaultReturn}
        </p>
        <p className="text-[9px] text-zinc-500">{labels.thankYou}</p>
        <div className="text-[8px] text-zinc-400 pt-1 font-mono">
          Powered by Sri Lanka Small Business POS
        </div>
      </div>
    </div>
  );
}
