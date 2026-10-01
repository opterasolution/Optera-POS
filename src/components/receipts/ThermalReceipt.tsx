"use client";

import React from "react";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";

export interface ThermalReceiptProps {
  business: {
    name: string;
    phone?: string;
    address?: string;
    receiptSettings?: {
      headerMessage?: string;
      footerMessage?: string;
      defaultWidth?: "58mm" | "80mm";
    };
  };
  sale: {
    invoiceNumber: string;
    cashierName: string;
    customerName?: string;
    customerPhone?: string;
    registerName?: string;
    registerNumber?: string;
    items: Array<{
      name: string;
      unitPrice: number;
      quantity: number;
      total: number;
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
  className?: string;
}

export default function ThermalReceipt({
  business,
  sale,
  width,
  className = "",
}: ThermalReceiptProps) {
  const receiptWidth = width || business.receiptSettings?.defaultWidth || "58mm";
  const is80mm = receiptWidth === "80mm";

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
          <span className="font-bold">INVOICE:</span>
          <span className="font-bold">{sale.invoiceNumber}</span>
        </div>
        <div className="flex justify-between">
          <span>DATE:</span>
          <span>{formatSLDateTime(sale.createdAt)}</span>
        </div>
        <div className="flex justify-between">
          <span>CASHIER:</span>
          <span>{sale.cashierName}</span>
        </div>
        {sale.registerName && (
          <div className="flex justify-between">
            <span>REGISTER:</span>
            <span>{sale.registerName}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>CUSTOMER:</span>
          <span>{sale.customerName || "Walk-in Customer"}</span>
        </div>
        {sale.customerPhone && (
          <div className="flex justify-between">
            <span>TEL:</span>
            <span>{sale.customerPhone}</span>
          </div>
        )}
      </div>

      {/* Itemized Table */}
      <div className="border-t border-zinc-800 my-2 pt-2">
        <div className="flex justify-between font-bold pb-1 text-[10px] uppercase border-b border-zinc-300 mb-1">
          <span>Item</span>
          <span>Total (Rs.)</span>
        </div>

        <div className="space-y-1.5">
          {sale.items.map((item, idx) => (
            <div key={idx}>
              <div className="flex justify-between font-semibold">
                <span className="truncate pr-2">{item.name}</span>
                <span className="shrink-0">{formatCurrency(item.total)}</span>
              </div>
              <div className="flex justify-between text-[9px] text-zinc-600 pl-2">
                <span>
                  {item.quantity} x {formatCurrency(item.unitPrice)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Financial Calculations */}
      <div className="border-t border-dashed border-zinc-400 my-2 pt-1.5 space-y-0.5 text-right font-medium">
        <div className="flex justify-between text-zinc-700">
          <span>Subtotal:</span>
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
            <span>Discount:</span>
            <span>-{formatCurrency(sale.discountTotal)}</span>
          </div>
        ) : null}

        {sale.taxTotal && sale.taxTotal > 0 ? (
          <div className="flex justify-between text-zinc-700">
            <span>Tax:</span>
            <span>+{formatCurrency(sale.taxTotal)}</span>
          </div>
        ) : null}

        {/* Grand Total */}
        <div className="flex justify-between text-xs sm:text-sm font-black pt-1 border-t border-zinc-800 text-black">
          <span>TOTAL:</span>
          <span>{formatCurrency(sale.netTotal)}</span>
        </div>

        {/* Payment & Change */}
        <div className="pt-1 text-[10px] space-y-0.5">
          <div className="flex justify-between text-zinc-700">
            <span>Payment Method:</span>
            <span className="font-bold">{sale.paymentMethod}</span>
          </div>

          {sale.paymentMethod === "CASH" && (
            <>
              <div className="flex justify-between text-zinc-700">
                <span>Cash Tendered:</span>
                <span>{formatCurrency(sale.cashReceived)}</span>
              </div>
              <div className="flex justify-between font-bold text-black">
                <span>Change Returned:</span>
                <span>{formatCurrency(sale.changeGiven)}</span>
              </div>
            </>
          )}

          {sale.paymentMethod === "CREDIT" && (
            <div className="pt-2 border-t border-dashed border-zinc-400 space-y-2 text-[10px]">
              <div className="text-center font-bold uppercase tracking-wider text-[9px] bg-zinc-100 py-0.5 border border-zinc-300">
                * BILLED TO CREDIT ACCOUNT (NAYA POTHA) *
              </div>
              <div className="pt-6 text-center">
                <div className="border-t border-black pt-1 text-[9px]">
                  Customer Acknowledgement Signature
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

      {/* Footer Return Policy */}
      <div className="border-t border-dashed border-zinc-400 my-2 pt-2 text-center space-y-1">
        <p className="text-[10px] font-semibold text-zinc-800">
          {business.receiptSettings?.footerMessage || "Goods returnable within 3 days with receipt."}
        </p>
        <p className="text-[9px] text-zinc-500">Thank you! Please visit us again.</p>
        <div className="text-[8px] text-zinc-400 pt-1 font-mono">
          Powered by Sri Lanka Small Business POS
        </div>
      </div>
    </div>
  );
}
