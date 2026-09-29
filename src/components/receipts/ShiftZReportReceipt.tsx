"use client";

import React from "react";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";
import { Printer, X } from "lucide-react";

export interface ShiftZReportData {
  _id: string;
  shiftNumber: string;
  registerName: string;
  registerNumber: string;
  cashierName: string;
  status: "OPEN" | "CLOSED";
  openedAt: string | Date;
  closedAt?: string | Date;
  openingFloat: number;
  cashSales: number;
  cardSales: number;
  qrSales: number;
  bankTransferSales: number;
  totalSales: number;
  salesCount: number;
  totalDiscount: number;
  totalTax: number;
  expectedCash: number;
  actualCash?: number;
  difference?: number;
  closingNotes?: string;
  cashMovements?: Array<{
    type: "CASH_DROP" | "PAY_IN" | "PAY_OUT";
    amount: number;
    reason: string;
    performedBy: string;
    createdAt: string | Date;
  }>;
}

export interface ShiftZReportReceiptProps {
  business: {
    name: string;
    phone?: string;
    address?: string;
    receiptSettings?: {
      defaultWidth?: "58mm" | "80mm";
    };
  };
  shift: ShiftZReportData;
  reportType?: "X_REPORT" | "Z_REPORT";
  onClose?: () => void;
  width?: "58mm" | "80mm";
}

export default function ShiftZReportReceipt({
  business,
  shift,
  reportType,
  onClose,
  width,
}: ShiftZReportReceiptProps) {
  const isZ = reportType === "Z_REPORT" || shift.status === "CLOSED";
  const title = isZ ? "Z-REPORT • SHIFT CLOSURE" : "X-REPORT • INTERIM AUDIT";
  const receiptWidth = width || business.receiptSettings?.defaultWidth || "58mm";
  const is80mm = receiptWidth === "80mm";

  const payIns = (shift.cashMovements || [])
    .filter((m) => m.type === "PAY_IN")
    .reduce((sum, m) => sum + m.amount, 0);
  const cashDrops = (shift.cashMovements || [])
    .filter((m) => m.type === "CASH_DROP")
    .reduce((sum, m) => sum + m.amount, 0);
  const payOuts = (shift.cashMovements || [])
    .filter((m) => m.type === "PAY_OUT")
    .reduce((sum, m) => sum + m.amount, 0);

  const diff = shift.difference ?? 0;
  const isBalanced = Math.abs(diff) < 0.01;
  const isOver = diff > 0.01;
  const isShort = diff < -0.01;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4 my-8 print:p-0 print:border-none print:shadow-none print:max-w-none print:m-0 print:w-full">
        {/* Modal Controls (Hidden in Print) */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 print:hidden">
          <div className="flex items-center gap-1.5">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                isZ ? "bg-slate-900 text-white" : "bg-blue-600 text-white"
              }`}
            >
              {isZ ? "Z-Report" : "X-Report"}
            </span>
            <span className="text-xs font-semibold text-slate-800">{shift.shiftNumber}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
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

        {/* Printable Thermal Receipt Area */}
        <div
          className={`font-mono text-black bg-white p-2 leading-tight mx-auto select-text ${
            is80mm ? "max-w-[320px] text-xs" : "max-w-[260px] text-[11px]"
          }`}
        >
          {/* Header */}
          <div className="text-center space-y-0.5">
            <h2 className="font-extrabold text-sm uppercase tracking-tight">
              {business.name || "SRI LANKA RETAIL POS"}
            </h2>
            {business.address && (
              <p className="text-[10px] text-zinc-600 leading-snug">{business.address}</p>
            )}
            {business.phone && (
              <p className="text-[10px] text-zinc-700 font-bold">Tel: {business.phone}</p>
            )}
            <div className="my-1.5 py-1 border-y-2 border-black font-extrabold text-xs uppercase tracking-wider">
              *** {title} ***
            </div>
          </div>

          {/* Shift Metadata */}
          <div className="space-y-0.5 text-[10px] my-2">
            <div className="flex justify-between">
              <span className="font-bold">SHIFT NO:</span>
              <span className="font-bold">{shift.shiftNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>REGISTER:</span>
              <span>
                {shift.registerNumber} ({shift.registerName})
              </span>
            </div>
            <div className="flex justify-between">
              <span>CASHIER:</span>
              <span>{shift.cashierName}</span>
            </div>
            <div className="flex justify-between">
              <span>OPENED:</span>
              <span>{formatSLDateTime(shift.openedAt)}</span>
            </div>
            <div className="flex justify-between">
              <span>CLOSED:</span>
              <span>
                {shift.closedAt ? formatSLDateTime(shift.closedAt) : "ACTIVE (IN PROGRESS)"}
              </span>
            </div>
          </div>

          {/* Sales Breakdown Section */}
          <div className="border-t border-dashed border-zinc-400 my-2 pt-1.5 space-y-1">
            <div className="text-center font-bold text-[10px] uppercase border-b border-zinc-300 pb-0.5 mb-1">
              Sales by Payment Method
            </div>
            <div className="flex justify-between">
              <span>CASH SALES:</span>
              <span className="font-semibold">{formatCurrency(shift.cashSales)}</span>
            </div>
            <div className="flex justify-between">
              <span>CARD TERMINAL:</span>
              <span className="font-semibold">{formatCurrency(shift.cardSales)}</span>
            </div>
            <div className="flex justify-between">
              <span>LANKAQR / QR:</span>
              <span className="font-semibold">{formatCurrency(shift.qrSales)}</span>
            </div>
            <div className="flex justify-between">
              <span>BANK TRANSFER:</span>
              <span className="font-semibold">{formatCurrency(shift.bankTransferSales)}</span>
            </div>
            <div className="flex justify-between font-bold pt-1 border-t border-zinc-300 text-xs">
              <span>GROSS SALES TOTAL:</span>
              <span>{formatCurrency(shift.totalSales)}</span>
            </div>
            <div className="flex justify-between text-[10px] text-zinc-600">
              <span>Total Transactions:</span>
              <span>{shift.salesCount} bills</span>
            </div>
            {shift.totalDiscount > 0 && (
              <div className="flex justify-between text-[10px] text-zinc-600">
                <span>Total Discounts Given:</span>
                <span>-{formatCurrency(shift.totalDiscount)}</span>
              </div>
            )}
            {shift.totalTax > 0 && (
              <div className="flex justify-between text-[10px] text-zinc-600">
                <span>Total Tax (VAT) Logged:</span>
                <span>+{formatCurrency(shift.totalTax)}</span>
              </div>
            )}
          </div>

          {/* Cash Drawer Reconciliation Section */}
          <div className="border-t-2 border-zinc-800 my-2 pt-1.5 space-y-1">
            <div className="text-center font-extrabold text-[10px] uppercase border-b border-zinc-300 pb-0.5 mb-1">
              Cash Drawer Reconciliation
            </div>
            <div className="flex justify-between">
              <span>(+) Opening Float:</span>
              <span>{formatCurrency(shift.openingFloat)}</span>
            </div>
            <div className="flex justify-between">
              <span>(+) Net Cash Sales:</span>
              <span>{formatCurrency(shift.cashSales)}</span>
            </div>
            {payIns > 0 && (
              <div className="flex justify-between text-zinc-700">
                <span>(+) Pay-Ins (Added Float):</span>
                <span>+{formatCurrency(payIns)}</span>
              </div>
            )}
            {cashDrops > 0 && (
              <div className="flex justify-between text-zinc-700">
                <span>(-) Cash Drops (To Safe):</span>
                <span>-{formatCurrency(cashDrops)}</span>
              </div>
            )}
            {payOuts > 0 && (
              <div className="flex justify-between text-zinc-700">
                <span>(-) Pay-Outs (Expenses):</span>
                <span>-{formatCurrency(payOuts)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold pt-1 border-t border-dashed border-zinc-400">
              <span>EXPECTED CASH IN DRAWER:</span>
              <span>{formatCurrency(shift.expectedCash)}</span>
            </div>

            {isZ ? (
              <>
                <div className="flex justify-between font-bold text-xs bg-zinc-100 p-1 rounded">
                  <span>ACTUAL CASH COUNTED:</span>
                  <span>{formatCurrency(shift.actualCash || 0)}</span>
                </div>
                <div className="flex justify-between font-black text-xs pt-0.5">
                  <span>OVER / SHORT:</span>
                  <span
                    className={
                      isBalanced
                        ? "text-emerald-700 print:text-black"
                        : isOver
                        ? "text-blue-700 print:text-black"
                        : "text-rose-700 print:text-black"
                    }
                  >
                    {isBalanced
                      ? "Rs. 0.00 (BALANCED)"
                      : isOver
                      ? `+${formatCurrency(diff)} (OVER)`
                      : `-${formatCurrency(Math.abs(diff))} (SHORT)`}
                  </span>
                </div>
              </>
            ) : (
              <div className="p-1 bg-amber-50 text-amber-900 border border-amber-200 text-center font-bold text-[9px] uppercase tracking-wide print:border-black print:text-black">
                * SHIFT ACTIVE • CASH COUNT PENDING *
              </div>
            )}
          </div>

          {/* Cash Movements Itemized Log (if any) */}
          {shift.cashMovements && shift.cashMovements.length > 0 && (
            <div className="border-t border-dashed border-zinc-400 my-2 pt-1 text-[9px] space-y-0.5">
              <div className="font-bold uppercase text-[9px] pb-0.5">Cash Movements Log:</div>
              {shift.cashMovements.map((mov, idx) => (
                <div key={idx} className="flex justify-between text-zinc-700">
                  <span className="truncate pr-1">
                    • {mov.type.replace("_", " ")}: {mov.reason}
                  </span>
                  <span className="font-semibold shrink-0">{formatCurrency(mov.amount)}</span>
                </div>
              ))}
            </div>
          )}

          {shift.closingNotes && (
            <div className="border-t border-dashed border-zinc-400 my-2 pt-1 text-[9px]">
              <span className="font-bold">NOTES: </span>
              <span className="italic">{shift.closingNotes}</span>
            </div>
          )}

          {/* Signatures */}
          <div className="border-t border-zinc-800 pt-4 mt-3 space-y-4 text-[10px]">
            <div className="flex justify-between pt-2">
              <span className="border-t border-zinc-400 w-28 text-center pt-0.5">
                Cashier Signature
              </span>
              <span className="border-t border-zinc-400 w-28 text-center pt-0.5">
                Manager Signature
              </span>
            </div>
            <div className="text-center text-[9px] text-zinc-500 pt-1">
              *** END OF {isZ ? "Z-REPORT" : "X-REPORT"} ***
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
