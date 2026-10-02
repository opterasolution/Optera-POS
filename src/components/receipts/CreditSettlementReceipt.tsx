"use client";

import React, { useEffect, useState } from "react";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";
import { Printer, X } from "lucide-react";
import QRCodeImage from "@/components/common/QRCodeImage";

export interface CreditSettlementData {
  transactionNumber: string;
  customerName: string;
  customerPhone: string;
  customerNic?: string;
  previousBalance: number;
  amountPaid: number;
  remainingBalance: number;
  paymentMethod: string;
  paymentReference?: string;
  notes?: string;
  cashierName?: string;
  registerName?: string;
  portalToken?: string;
  portalUrl?: string;
  createdAt: string | Date;
}

export interface CreditSettlementReceiptProps {
  business: {
    name: string;
    phone?: string;
    address?: string;
    receiptSettings?: {
      defaultWidth?: "58mm" | "80mm";
      footerMessage?: string;
    };
  };
  settlement: CreditSettlementData;
  onClose?: () => void;
  width?: "58mm" | "80mm";
}

export default function CreditSettlementReceipt({
  business,
  settlement,
  onClose,
  width,
}: CreditSettlementReceiptProps) {
  const receiptWidth = width || business.receiptSettings?.defaultWidth || "58mm";
  const is80mm = receiptWidth === "80mm";

  const [mountedOrigin, setMountedOrigin] = useState<string>("");
  useEffect(() => {
    if (typeof window !== "undefined") {
      setMountedOrigin(window.location.origin);
    }
  }, []);

  const qrStatementUrl =
    settlement.portalUrl ||
    (settlement.portalToken
      ? `${mountedOrigin || "https://pos.srilanka.lk"}/portal/statement/${settlement.portalToken}`
      : "");

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4 my-8 print:p-0 print:border-none print:shadow-none print:max-w-none print:m-0 print:w-full">
        {/* Controls */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 print:hidden">
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-700 text-white">
              Debt Settlement
            </span>
            <span className="text-xs font-mono font-semibold text-slate-800">
              {settlement.transactionNumber}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Slip</span>
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Printable Thermal Slip */}
        <div
          className={`font-mono text-black bg-white p-2 leading-tight mx-auto select-text ${
            is80mm ? "max-w-[320px] text-xs" : "max-w-[260px] text-[11px]"
          }`}
        >
          {/* Header */}
          <div className="text-center space-y-0.5">
            <h2 className="font-extrabold text-sm uppercase tracking-tight">
              {business.name || "SRI LANKA RETAIL STORE"}
            </h2>
            {business.address && (
              <p className="text-[10px] text-zinc-600 leading-snug">{business.address}</p>
            )}
            {business.phone && (
              <p className="text-[10px] text-zinc-700 font-bold">Tel: {business.phone}</p>
            )}
            <div className="my-1.5 py-1 border-y-2 border-black font-extrabold text-[11px] uppercase tracking-wider">
              *** CREDIT SETTLEMENT RECEIPT ***
            </div>
          </div>

          {/* Metadata */}
          <div className="border-b border-dashed border-zinc-400 pb-1.5 mb-1.5 space-y-0.5 text-[10px]">
            <div className="flex justify-between">
              <span>Receipt No:</span>
              <span className="font-bold">{settlement.transactionNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Date & Time:</span>
              <span>{formatSLDateTime(settlement.createdAt)}</span>
            </div>
            {settlement.registerName && (
              <div className="flex justify-between">
                <span>Counter:</span>
                <span>{settlement.registerName}</span>
              </div>
            )}
            {settlement.cashierName && (
              <div className="flex justify-between">
                <span>Cashier:</span>
                <span>{settlement.cashierName}</span>
              </div>
            )}
          </div>

          {/* Customer Info */}
          <div className="border-b border-dashed border-zinc-400 pb-1.5 mb-1.5 space-y-0.5 text-[10px]">
            <div className="flex justify-between">
              <span>Customer:</span>
              <span className="font-bold uppercase">{settlement.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span>Phone:</span>
              <span>{settlement.customerPhone}</span>
            </div>
            {settlement.customerNic && (
              <div className="flex justify-between">
                <span>NIC:</span>
                <span>{settlement.customerNic}</span>
              </div>
            )}
          </div>

          {/* Financial Breakdown */}
          <div className="border-b-2 border-black py-2 space-y-1">
            <div className="flex justify-between text-zinc-700">
              <span>Previous Balance:</span>
              <span>{formatCurrency(settlement.previousBalance)}</span>
            </div>
            <div className="flex justify-between font-extrabold text-sm border-y border-dashed border-zinc-400 py-1">
              <span>AMOUNT RECEIVED:</span>
              <span>{formatCurrency(settlement.amountPaid)}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span>Payment Mode:</span>
              <span className="font-semibold uppercase">{settlement.paymentMethod}</span>
            </div>
            {settlement.paymentReference && (
              <div className="flex justify-between text-[10px] text-zinc-600">
                <span>Ref / Cheque:</span>
                <span>{settlement.paymentReference}</span>
              </div>
            )}
            <div className="flex justify-between font-extrabold pt-1">
              <span>REMAINING BALANCE:</span>
              <span className={settlement.remainingBalance > 0 ? "text-black" : "text-black"}>
                {formatCurrency(settlement.remainingBalance)}
              </span>
            </div>
          </div>

          {settlement.notes && (
            <div className="py-1 text-[9px] text-zinc-600 italic">
              Note: {settlement.notes}
            </div>
          )}

          {/* Signatures */}
          <div className="pt-6 pb-2 grid grid-cols-2 gap-4 text-center text-[9px]">
            <div>
              <div className="border-t border-black pt-1">Cashier Signature</div>
            </div>
            <div>
              <div className="border-t border-black pt-1">Customer Signature</div>
            </div>
          </div>

          {/* Live Naya Potha Statement QR Code */}
          {qrStatementUrl && (
            <div className="pt-2 text-center space-y-1 border-t border-dashed border-zinc-400">
              <div className="flex justify-center py-0.5">
                <QRCodeImage
                  value={qrStatementUrl}
                  size={is80mm ? 80 : 68}
                  margin={1}
                  className="border border-zinc-200 p-0.5 rounded bg-white shadow-xs"
                />
              </div>
              <p className="text-[8px] font-bold text-zinc-900 tracking-tight uppercase">
                Scan to view Live Naya Potha Statement
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="text-center text-[9px] text-zinc-500 pt-2 border-t border-dashed border-zinc-400">
            {business.receiptSettings?.footerMessage || "Thank you for keeping your account settled!"}
            <br />
            Naya Potha • Digital Credit Ledger
          </div>
        </div>
      </div>
    </div>
  );
}
