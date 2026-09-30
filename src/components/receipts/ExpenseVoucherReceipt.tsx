"use client";

import React from "react";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";

export interface ExpenseVoucherReceiptProps {
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
  expense: {
    expenseNumber: string;
    category: string;
    title: string;
    amount: number;
    paymentMethod: string;
    paidFrom: string;
    registerName?: string;
    payee?: string;
    receiptNumber?: string;
    notes?: string;
    recordedBy: string;
    date: string | Date;
  };
  width?: "58mm" | "80mm";
  className?: string;
}

export default function ExpenseVoucherReceipt({
  business,
  expense,
  width,
  className = "",
}: ExpenseVoucherReceiptProps) {
  const receiptWidth = width || business.receiptSettings?.defaultWidth || "58mm";
  const is80mm = receiptWidth === "80mm";

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case "STAFF_MEALS":
        return "Staff Meals & Refreshments (කෑම/තේ)";
      case "PACKAGING":
        return "Packaging & Bags (ඇසුරුම්)";
      case "TRANSPORT":
        return "Transport & Deliveries (ප්‍රවාහන)";
      case "UTILITIES":
        return "Electricity / Water / Internet (බිල්පත්)";
      case "MAINTENANCE":
        return "Store Repairs & Cleaning";
      case "RENT":
        return "Building / Counter Rent";
      case "MUNICIPAL_TAX":
        return "Council Tax & Waste Fees";
      case "SALARY_ADVANCE":
        return "Staff Salary Advance";
      default:
        return "General Store Expense";
    }
  };

  const getSourceLabel = (src: string) => {
    switch (src) {
      case "REGISTER_DRAWER":
        return expense.registerName
          ? `Cash Drawer (${expense.registerName})`
          : "Register Cash Drawer";
      case "STORE_PETTY_CASH":
        return "Store Petty Cash Safe";
      case "BANK_ACCOUNT":
        return "Commercial Bank Transfer";
      default:
        return src;
    }
  };

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

      {/* Voucher Banner */}
      <div className="my-2 py-1 border-y-2 border-black text-center font-black text-xs uppercase tracking-wider">
        ** PETTY CASH VOUCHER **
      </div>

      {/* Metadata */}
      <div className="space-y-0.5 text-[10px] pb-2 border-b border-dashed border-zinc-400">
        <div className="flex justify-between">
          <span className="font-bold">VOUCHER NO:</span>
          <span className="font-bold">{expense.expenseNumber}</span>
        </div>
        <div className="flex justify-between">
          <span>DATE:</span>
          <span>{formatSLDateTime(expense.date)}</span>
        </div>
        <div className="flex justify-between">
          <span>DISBURSED FROM:</span>
          <span className="font-semibold text-right">{getSourceLabel(expense.paidFrom)}</span>
        </div>
        <div className="flex justify-between">
          <span>METHOD:</span>
          <span>{expense.paymentMethod}</span>
        </div>
        <div className="flex justify-between">
          <span>RECORDED BY:</span>
          <span>{expense.recordedBy}</span>
        </div>
      </div>

      {/* Expense Particulars */}
      <div className="my-2 py-1 space-y-1.5 text-[10px]">
        <div>
          <span className="text-zinc-500 block text-[9px] uppercase font-bold">
            Category:
          </span>
          <span className="font-semibold">{getCategoryLabel(expense.category)}</span>
        </div>

        <div>
          <span className="text-zinc-500 block text-[9px] uppercase font-bold">
            Description / Particulars:
          </span>
          <span className="font-bold text-xs">{expense.title}</span>
        </div>

        {expense.payee && (
          <div className="flex justify-between">
            <span className="text-zinc-500">Paid To (Payee):</span>
            <span className="font-semibold">{expense.payee}</span>
          </div>
        )}

        {expense.receiptNumber && (
          <div className="flex justify-between">
            <span className="text-zinc-500">Bill/Ref Slip No:</span>
            <span className="font-mono">{expense.receiptNumber}</span>
          </div>
        )}

        {expense.notes && (
          <div className="text-[9px] text-zinc-600 italic">
            Note: {expense.notes}
          </div>
        )}
      </div>

      {/* Amount Box */}
      <div className="my-2.5 p-2 border-2 border-black bg-zinc-50 text-center space-y-0.5">
        <p className="text-[9px] uppercase font-bold text-zinc-600 tracking-wider">
          AMOUNT PAID (LKR)
        </p>
        <p className="text-base sm:text-lg font-black tracking-tight text-black">
          {formatCurrency(expense.amount)}
        </p>
      </div>

      {/* Signatures */}
      <div className="mt-6 pt-3 border-t border-dashed border-zinc-400 grid grid-cols-2 gap-4 text-[9px] text-center">
        <div>
          <div className="border-b border-zinc-400 h-6"></div>
          <p className="mt-1 font-semibold">Disbursed By (Cashier)</p>
        </div>
        <div>
          <div className="border-b border-zinc-400 h-6"></div>
          <p className="mt-1 font-semibold">Received By (Payee)</p>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center pt-3 text-[8.5px] text-zinc-500">
        Internal Accounting Record • Sri Lanka POS
      </div>
    </div>
  );
}
