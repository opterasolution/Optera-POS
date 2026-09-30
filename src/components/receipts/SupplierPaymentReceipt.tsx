"use client";

import React from "react";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";
import { Printer, X, CheckCircle2 } from "lucide-react";

export interface SupplierPaymentData {
  paymentNumber: string;
  supplierName: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  paymentMethod: "CHEQUE" | "BANK_TRANSFER" | "CASH";
  chequeNumber?: string;
  chequeDate?: string | Date;
  bankName?: string;
  referenceNumber?: string;
  poNumber?: string;
  notes?: string;
  paidBy: string;
  createdAt: string | Date;
}

export interface SupplierPaymentReceiptProps {
  business: {
    name: string;
    phone?: string;
    address?: string;
    receiptSettings?: {
      defaultWidth?: "58mm" | "80mm";
    };
  };
  payment: SupplierPaymentData;
  onClose?: () => void;
  width?: "58mm" | "80mm";
}

export default function SupplierPaymentReceipt({
  business,
  payment,
  onClose,
  width,
}: SupplierPaymentReceiptProps) {
  const receiptWidth = width || business.receiptSettings?.defaultWidth || "80mm";
  const is80mm = receiptWidth === "80mm";

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4 my-8 print:p-0 print:border-none print:shadow-none print:max-w-none print:m-0 print:w-full">
        {/* Controls */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 print:hidden">
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-700 text-white">
              Vendor Payment Voucher
            </span>
            <span className="text-xs font-mono font-semibold text-slate-800">
              {payment.paymentNumber}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 shadow-sm transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* ================= PRINTABLE THERMAL SLIP ================= */}
        <div
          id="printable-supplier-payment-receipt"
          className={`mx-auto bg-white p-4 border border-dashed border-slate-300 font-mono text-[11px] leading-tight text-slate-900 space-y-2 print:border-none print:p-0 ${
            is80mm ? "max-w-[320px]" : "max-w-[240px]"
          }`}
        >
          {/* Header */}
          <div className="text-center space-y-0.5">
            <h4 className="font-extrabold text-xs uppercase tracking-tight">
              {business?.name || "SRI LANKA STORE"}
            </h4>
            <p className="text-[10px] text-slate-600">{business?.address || "Commercial Division"}</p>
            {business?.phone && <p className="text-[10px] text-slate-500">Tel: {business.phone}</p>}
            <div className="pt-1 border-b border-dashed border-slate-300 pb-1">
              <span className="font-bold text-[11px] uppercase tracking-wider block">
                * PAYMENT VOUCHER *
              </span>
              <span className="text-[9px] text-slate-500 font-sans">විකුණුම්කරු ගෙවීම් කුවිතාන්සිය</span>
            </div>
          </div>

          {/* Voucher Info */}
          <div className="space-y-0.5 pt-1 text-[10px] border-b border-dashed border-slate-300 pb-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Voucher #:</span>
              <span className="font-bold">{payment.paymentNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Date:</span>
              <span>{formatSLDateTime(payment.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Paid By:</span>
              <span>{payment.paidBy}</span>
            </div>
          </div>

          {/* Supplier Details */}
          <div className="space-y-0.5 text-[10px] border-b border-dashed border-slate-300 pb-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Supplier:</span>
              <span className="font-bold text-slate-900 truncate max-w-[150px]">{payment.supplierName}</span>
            </div>
            {payment.poNumber && (
              <div className="flex justify-between">
                <span className="text-slate-500">PO Ref:</span>
                <span className="font-mono">{payment.poNumber}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Payment Mode:</span>
              <span className="font-bold">{payment.paymentMethod}</span>
            </div>
            {payment.chequeNumber && (
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">Cheque #:</span>
                <span className="font-bold">{payment.chequeNumber}</span>
              </div>
            )}
            {payment.chequeDate && (
              <div className="flex justify-between">
                <span className="text-slate-500">Realization Date:</span>
                <span>{new Date(payment.chequeDate).toLocaleDateString()}</span>
              </div>
            )}
            {payment.bankName && (
              <div className="flex justify-between">
                <span className="text-slate-500">Bank:</span>
                <span>{payment.bankName}</span>
              </div>
            )}
          </div>

          {/* Accounts Payable Reconciliation */}
          <div className="space-y-1 pt-1 text-[11px] border-b border-dashed border-slate-300 pb-2">
            <div className="flex justify-between text-slate-600 text-[10px]">
              <span>Previous Payable:</span>
              <span>{formatCurrency(payment.balanceBefore)}</span>
            </div>

            <div className="flex justify-between font-extrabold text-xs text-blue-900 pt-0.5">
              <span>AMOUNT PAID:</span>
              <span className="font-mono">{formatCurrency(payment.amount)}</span>
            </div>

            <div className="flex justify-between font-bold text-[11px] text-slate-900 pt-1 border-t border-dotted border-slate-300">
              <span>REMAINING PAYABLE:</span>
              <span className={`font-mono ${payment.balanceAfter === 0 ? "text-emerald-700" : "text-rose-700"}`}>
                {formatCurrency(payment.balanceAfter)}
              </span>
            </div>
          </div>

          {/* Dual Sign-off Blocks */}
          <div className="pt-4 grid grid-cols-2 gap-3 text-center text-[9px] text-slate-600">
            <div className="border-t border-dotted border-slate-400 pt-1">
              <div>Authorized Signatory</div>
              <div className="text-[8px] text-slate-400 italic">For {business?.name || "Company"}</div>
            </div>

            <div className="border-t border-dotted border-slate-400 pt-1">
              <div>Supplier Stamp / Sign</div>
              <div className="text-[8px] text-slate-400 italic">Received with thanks</div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="pt-2 text-center text-[9px] text-slate-400 border-t border-dashed border-slate-200">
            Keep this voucher for company financial audit & accounts reconciliation.
          </div>
        </div>
      </div>
    </div>
  );
}
