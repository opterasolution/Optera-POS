"use client";

import React from "react";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";

export interface CreditNoteReceiptProps {
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
  creditNote: {
    creditNoteNumber: string;
    returnNumber?: string;
    customerName: string;
    customerPhone?: string;
    initialAmount: number;
    remainingBalance: number;
    status: "ACTIVE" | "FULLY_REDEEMED" | "EXPIRED" | "CANCELLED";
    expiryDate: string | Date;
    issuedBy: string;
    createdAt: string | Date;
  };
  width?: "58mm" | "80mm";
  className?: string;
}

export default function CreditNoteReceipt({
  business,
  creditNote,
  width,
  className = "",
}: CreditNoteReceiptProps) {
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
      </div>

      {/* Voucher Header */}
      <div className="my-2 py-1.5 border-y-2 border-black text-center">
        <p className="font-black text-xs uppercase tracking-wider">
          *** STORE CREDIT VOUCHER ***
        </p>
        <p className="text-[9px] text-zinc-600 mt-0.5">REDEEMABLE AT ANY POS CHECKOUT</p>
      </div>

      {/* Voucher Code Box */}
      <div className="my-3 p-2.5 border-2 border-dashed border-black bg-zinc-50 text-center space-y-1">
        <p className="text-[9px] uppercase font-bold text-zinc-600 tracking-wider">VOUCHER CODE</p>
        <p className="text-base sm:text-lg font-black tracking-widest text-black">
          {creditNote.creditNoteNumber}
        </p>
        <div className="pt-1 flex justify-center items-center gap-1 font-mono text-[9px] text-zinc-600">
          <span>||| |||| || | ||||| || |||</span>
        </div>
      </div>

      {/* Financial Details */}
      <div className="space-y-1 text-[10px] border-b border-dashed border-zinc-400 pb-2">
        <div className="flex justify-between">
          <span className="font-semibold">VOUCHER VALUE:</span>
          <span className="font-bold text-xs">{formatCurrency(creditNote.initialAmount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-bold">AVAILABLE BALANCE:</span>
          <span className="font-extrabold text-sm text-black">
            {formatCurrency(creditNote.remainingBalance)}
          </span>
        </div>
        <div className="flex justify-between text-zinc-600">
          <span>STATUS:</span>
          <span className="font-bold uppercase">{creditNote.status}</span>
        </div>
      </div>

      {/* Customer & Issue Metadata */}
      <div className="my-2 space-y-0.5 text-[10px]">
        <div className="flex justify-between">
          <span>CUSTOMER:</span>
          <span className="font-semibold">{creditNote.customerName}</span>
        </div>
        {creditNote.customerPhone && (
          <div className="flex justify-between">
            <span>TEL:</span>
            <span>{creditNote.customerPhone}</span>
          </div>
        )}
        {creditNote.returnNumber && (
          <div className="flex justify-between">
            <span>ISSUED FROM:</span>
            <span>{creditNote.returnNumber}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>ISSUED ON:</span>
          <span>{formatSLDateTime(creditNote.createdAt)}</span>
        </div>
        <div className="flex justify-between text-amber-950 font-bold border-t border-dashed border-zinc-300 pt-1 mt-1">
          <span>VALID UNTIL:</span>
          <span>{new Date(creditNote.expiryDate).toLocaleDateString()}</span>
        </div>
        <div className="flex justify-between">
          <span>ISSUED BY:</span>
          <span>{creditNote.issuedBy}</span>
        </div>
      </div>

      {/* Terms & Conditions */}
      <div className="mt-3 pt-2 border-t border-dashed border-zinc-400 text-[8.5px] text-zinc-600 space-y-1">
        <p>1. This voucher is valid for 30 days from the date of issue.</p>
        <p>2. Redeemable for goods at our checkout counter. Non-refundable for cash.</p>
        <p>3. If purchase is less than voucher value, the remaining balance stays on this code.</p>
        <p>4. Please keep this slip safe. Damaged or lost slips cannot be reissued.</p>
      </div>

      {/* Footer */}
      <div className="text-center pt-3 text-[9px] font-bold text-zinc-800">
        THANK YOU FOR SHOPPING WITH US!
      </div>
    </div>
  );
}
