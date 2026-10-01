"use client";

import React, { useRef } from "react";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";
import { Printer, X, Gift, CheckCircle2 } from "lucide-react";

export interface GiftVoucherReceiptProps {
  business: {
    name: string;
    phone?: string;
    address?: string;
    email?: string;
  };
  voucher: {
    code: string;
    initialAmount: number;
    currentBalance: number;
    recipientName?: string;
    recipientPhone?: string;
    customerName?: string;
    customerPhone?: string;
    expiryDate?: string | Date;
    notes?: string;
    issuedByName?: string;
    createdAt: string | Date;
  };
  onClose?: () => void;
  width?: "58mm" | "80mm" | "card";
}

export default function GiftVoucherReceipt({
  business,
  voucher,
  onClose,
  width = "80mm",
}: GiftVoucherReceiptProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const isCard = width === "card";
  const is58mm = width === "58mm";

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
        {/* Modal Controls (Hidden in Print) */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-zinc-900 text-white print:hidden">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-amber-400" />
            <span className="font-semibold text-sm">Print Gift Voucher</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs rounded-lg shadow-sm transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Slip
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Printable Voucher Content */}
        <div className="p-6 overflow-y-auto flex justify-center bg-zinc-100/60 print:bg-white print:p-0">
          <div
            ref={printRef}
            className={`bg-white text-black p-4 font-mono shadow-sm print:shadow-none print:p-0 ${
              isCard
                ? "w-full max-w-[380px] border-2 border-amber-600/40 rounded-xl"
                : is58mm
                ? "w-[260px] text-[11px]"
                : "w-[320px] text-xs"
            }`}
          >
            {/* Header */}
            <div className="text-center space-y-1 pb-2">
              <h2 className="font-extrabold text-sm uppercase tracking-tight text-zinc-900">
                {business.name || "SRI LANKA RETAIL POS"}
              </h2>
              {business.address && (
                <p className="text-[10px] text-zinc-600 leading-tight">{business.address}</p>
              )}
              {business.phone && (
                <p className="text-[10px] text-zinc-600 font-bold">Tel: {business.phone}</p>
              )}
            </div>

            {/* Decorative Title */}
            <div className="my-2 py-1.5 border-y-2 border-dashed border-zinc-800 text-center bg-zinc-50 print:bg-transparent">
              <div className="font-black text-xs sm:text-sm tracking-wider uppercase text-zinc-950">
                ★ GIFT VOUCHER ★
              </div>
              <div className="text-[9px] text-zinc-600 uppercase font-sans tracking-wide">
                Sri Lanka Small Business Rewards
              </div>
            </div>

            {/* Voucher Amount Badge */}
            <div className="my-3 text-center p-2.5 bg-amber-50/80 border border-amber-300 rounded-lg print:border-black print:bg-transparent">
              <div className="text-[10px] text-zinc-600 uppercase font-sans font-semibold">
                Voucher Value
              </div>
              <div className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
                {formatCurrency(voucher.currentBalance || voucher.initialAmount)}
              </div>
              {voucher.currentBalance !== voucher.initialAmount && (
                <div className="text-[9px] text-zinc-500 font-sans mt-0.5">
                  Initial Value: {formatCurrency(voucher.initialAmount)}
                </div>
              )}
            </div>

            {/* Voucher Code Box */}
            <div className="my-2 p-2 border border-dashed border-zinc-500 text-center rounded bg-zinc-50/60 print:bg-transparent">
              <div className="text-[9px] text-zinc-500 uppercase tracking-widest font-sans font-medium">
                Voucher Code
              </div>
              <div className="text-base sm:text-lg font-black tracking-widest text-zinc-900 font-mono select-all">
                {voucher.code}
              </div>
            </div>

            {/* Barcode Mockup for Scanners */}
            <div className="my-3 flex flex-col items-center justify-center">
              <div className="flex items-center justify-center gap-[2px] h-8 w-44 bg-white px-2">
                {voucher.code.split("").map((char, i) => (
                  <div
                    key={i}
                    className="h-full bg-black"
                    style={{
                      width: `${(char.charCodeAt(0) % 3) + 1.5}px`,
                      marginRight: `${(i % 2) * 1.5 + 1}px`,
                    }}
                  />
                ))}
              </div>
              <span className="text-[8px] text-zinc-500 tracking-widest mt-1 font-mono">
                *{voucher.code}*
              </span>
            </div>

            {/* Details Table */}
            <div className="border-t border-dashed border-zinc-300 pt-2 space-y-1 text-[10px]">
              {voucher.recipientName && (
                <div className="flex justify-between">
                  <span className="text-zinc-600">Recipient:</span>
                  <span className="font-bold text-zinc-900">{voucher.recipientName}</span>
                </div>
              )}
              {voucher.recipientPhone && (
                <div className="flex justify-between">
                  <span className="text-zinc-600">Recipient Tel:</span>
                  <span className="font-mono text-zinc-900">{voucher.recipientPhone}</span>
                </div>
              )}
              {voucher.customerName && (
                <div className="flex justify-between">
                  <span className="text-zinc-600">Purchased By:</span>
                  <span className="text-zinc-900 font-medium">{voucher.customerName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-zinc-600">Issued Date:</span>
                <span className="text-zinc-900">{formatSLDateTime(voucher.createdAt)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span className="text-zinc-800">Valid Until:</span>
                <span className="text-red-700 print:text-black">
                  {voucher.expiryDate
                    ? new Date(voucher.expiryDate).toLocaleDateString("en-LK", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : "No Expiry"}
                </span>
              </div>
              {voucher.issuedByName && (
                <div className="flex justify-between text-[9px] text-zinc-500">
                  <span>Issued By:</span>
                  <span>{voucher.issuedByName}</span>
                </div>
              )}
            </div>

            {/* Notes if any */}
            {voucher.notes && (
              <div className="my-2 p-1.5 bg-zinc-50 border border-zinc-200 rounded text-[9px] text-zinc-700 italic print:border-zinc-400">
                "{voucher.notes}"
              </div>
            )}

            {/* Terms and Conditions */}
            <div className="border-t border-dashed border-zinc-400 my-2 pt-2 text-center space-y-1">
              <div className="text-[9px] font-bold text-zinc-800 uppercase tracking-wide">
                Terms & Conditions
              </div>
              <p className="text-[8px] text-zinc-600 leading-tight">
                • Redeemable for merchandise at all registered store locations.
              </p>
              <p className="text-[8px] text-zinc-600 leading-tight">
                • Partial redemptions permitted; remaining balance stays on voucher until expiry.
              </p>
              <p className="text-[8px] text-zinc-600 leading-tight">
                • Not exchangeable for cash. Please safeguard this code.
              </p>
            </div>

            {/* Footer */}
            <div className="text-center pt-2 text-[8px] text-zinc-400 font-sans border-t border-zinc-200">
              Generated by Sri Lanka Small Business POS Platform
            </div>
          </div>
        </div>

        {/* Modal Footer (Hidden in print) */}
        <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex justify-between items-center print:hidden">
          <div className="text-xs text-zinc-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Ready to present or print thermal slip</span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200 rounded-lg transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
