"use client";

import React from "react";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";

export interface ReturnSlipReceiptProps {
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
  saleReturn: {
    returnNumber: string;
    originalInvoiceNumber?: string;
    customerName: string;
    customerPhone?: string;
    cashierName: string;
    registerName?: string;
    items: Array<{
      name: string;
      barcode?: string;
      unitPrice: number;
      quantity: number;
      condition: "RESTOCKABLE" | "DAMAGED" | "EXPIRED";
      reason: string;
      total: number;
    }>;
    subtotal: number;
    netRefundTotal: number;
    refundMethod: "CASH" | "CREDIT_NOTE" | "CUSTOMER_BALANCE";
    creditNoteNumber?: string;
    pointsDeducted?: number;
    notes?: string;
    createdAt: string | Date;
  };
  width?: "58mm" | "80mm";
  className?: string;
}

export default function ReturnSlipReceipt({
  business,
  saleReturn,
  width,
  className = "",
}: ReturnSlipReceiptProps) {
  const receiptWidth = width || business.receiptSettings?.defaultWidth || "58mm";
  const is80mm = receiptWidth === "80mm";

  const getConditionLabel = (condition: string) => {
    switch (condition) {
      case "RESTOCKABLE":
        return "RESTOCKED";
      case "DAMAGED":
        return "DAMAGED (QUARANTINED)";
      case "EXPIRED":
        return "EXPIRED (QUARANTINED)";
      default:
        return condition;
    }
  };

  const getRefundMethodLabel = (method: string) => {
    switch (method) {
      case "CASH":
        return "CASH REFUND";
      case "CREDIT_NOTE":
        return "STORE CREDIT VOUCHER";
      case "CUSTOMER_BALANCE":
        return "NAYA POTHA (CREDITED)";
      default:
        return method;
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

      {/* Slip Title */}
      <div className="my-2 py-1 border-y-2 border-black text-center font-black text-xs uppercase tracking-wider">
        ** CUSTOMER RETURN SLIP **
      </div>

      {/* Return Meta Section */}
      <div className="space-y-0.5 text-[10px] pb-2 border-b border-dashed border-zinc-400">
        <div className="flex justify-between">
          <span className="font-bold">RETURN SLIP:</span>
          <span className="font-bold">{saleReturn.returnNumber}</span>
        </div>
        {saleReturn.originalInvoiceNumber && (
          <div className="flex justify-between">
            <span>ORIGINAL INV:</span>
            <span className="font-semibold">{saleReturn.originalInvoiceNumber}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>DATE:</span>
          <span>{formatSLDateTime(saleReturn.createdAt)}</span>
        </div>
        <div className="flex justify-between">
          <span>CASHIER:</span>
          <span>{saleReturn.cashierName}</span>
        </div>
        {saleReturn.registerName && (
          <div className="flex justify-between">
            <span>REGISTER:</span>
            <span>{saleReturn.registerName}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>CUSTOMER:</span>
          <span>{saleReturn.customerName || "Walk-in Customer"}</span>
        </div>
        {saleReturn.customerPhone && (
          <div className="flex justify-between">
            <span>TEL:</span>
            <span>{saleReturn.customerPhone}</span>
          </div>
        )}
      </div>

      {/* Returned Items List */}
      <div className="my-2">
        <div className="flex justify-between font-bold pb-1 text-[10px] uppercase border-b border-zinc-300 mb-1">
          <span>Returned Item</span>
          <span>Refund (Rs.)</span>
        </div>

        <div className="space-y-2">
          {saleReturn.items.map((item, idx) => (
            <div key={idx} className="border-b border-dashed border-zinc-200 pb-1">
              <div className="flex justify-between font-semibold">
                <span className="truncate pr-2">{item.name}</span>
                <span className="shrink-0">{formatCurrency(item.total)}</span>
              </div>
              <div className="flex justify-between text-[9px] text-zinc-600 pl-2">
                <span>
                  {item.quantity} x {formatCurrency(item.unitPrice)}
                </span>
                <span className="font-medium text-zinc-800">
                  [{getConditionLabel(item.condition)}]
                </span>
              </div>
              <div className="text-[9px] text-zinc-500 italic pl-2">
                Reason: {item.reason}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Totals & Refund Breakdown */}
      <div className="border-t-2 border-black pt-2 space-y-1 text-[10px]">
        <div className="flex justify-between">
          <span>Subtotal Refund:</span>
          <span>{formatCurrency(saleReturn.subtotal)}</span>
        </div>
        <div className="flex justify-between text-xs sm:text-sm font-extrabold border-t border-black pt-1">
          <span>TOTAL REFUND:</span>
          <span>{formatCurrency(saleReturn.netRefundTotal)}</span>
        </div>
        <div className="flex justify-between font-bold pt-1 border-t border-dashed border-zinc-400">
          <span>REFUND METHOD:</span>
          <span>{getRefundMethodLabel(saleReturn.refundMethod)}</span>
        </div>

        {saleReturn.creditNoteNumber && (
          <div className="mt-2 p-1.5 border border-black bg-zinc-50 text-center space-y-0.5">
            <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">
              Store Credit Voucher Code:
            </p>
            <p className="text-sm font-black tracking-widest">{saleReturn.creditNoteNumber}</p>
            <p className="text-[8px] text-zinc-500">Valid for 30 days from issue</p>
          </div>
        )}

        {saleReturn.pointsDeducted && saleReturn.pointsDeducted > 0 && (
          <div className="flex justify-between text-[9px] text-amber-900 pt-0.5">
            <span>Loyalty Points Reversed:</span>
            <span>-{saleReturn.pointsDeducted} pts</span>
          </div>
        )}

        {saleReturn.notes && (
          <div className="pt-1 text-[9px] text-zinc-600">
            <span className="font-semibold">Notes: </span>
            <span>{saleReturn.notes}</span>
          </div>
        )}
      </div>

      {/* Signatures */}
      <div className="mt-5 pt-3 border-t border-dashed border-zinc-400 grid grid-cols-2 gap-4 text-[9px] text-center">
        <div>
          <div className="border-b border-zinc-400 h-6"></div>
          <p className="mt-1 font-semibold">Cashier Signature</p>
        </div>
        <div>
          <div className="border-b border-zinc-400 h-6"></div>
          <p className="mt-1 font-semibold">Customer Signature</p>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center pt-3 text-[9px] text-zinc-500 space-y-0.5">
        <p>Goods once accepted as returned cannot be re-refunded.</p>
        <p className="font-bold">THANK YOU FOR YOUR PATRONAGE</p>
      </div>
    </div>
  );
}
