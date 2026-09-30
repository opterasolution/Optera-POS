"use client";

import React, { useRef } from "react";
import {
  Printer,
  X,
  Building,
  Calendar,
  CheckCircle2,
  Clock,
  Landmark,
  FileSpreadsheet,
  ArrowRight,
} from "lucide-react";
import { formatCurrency, amountToWords } from "@/lib/formatters";

export interface QuotationPrintData {
  _id: string;
  quotationNumber: string;
  createdAt: string | Date;
  validUntil: string | Date;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  companyName?: string;
  tin?: string;
  vatNumber?: string;
  address?: string;
  items: Array<{
    name: string;
    barcode?: string;
    unitPrice: number;
    quantity: number;
    subtotal: number;
    discount?: number;
    total: number;
    priceTier?: "RETAIL" | "WHOLESALE";
  }>;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  netTotal: number;
  taxBreakdown?: {
    taxableAmount?: number;
    ssclRate?: number;
    ssclAmount?: number;
    vatRate?: number;
    vatAmount?: number;
  };
  status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "CONVERTED" | "EXPIRED";
  convertedInvoiceNumber?: string;
  notes?: string;
  createdBy?: string;
}

export interface BusinessTaxProfile {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  taxSettings?: {
    enabled?: boolean;
    name?: string;
    rate?: number;
    tin?: string;
    vatNumber?: string;
    ssclEnabled?: boolean;
    ssclRate?: number;
    invoiceNotes?: string;
  };
  bankDetails?: {
    bankName?: string;
    branchName?: string;
    accountNumber?: string;
    accountName?: string;
  };
}

interface CommercialQuotationA4Props {
  quotation: QuotationPrintData;
  business: BusinessTaxProfile;
  onClose: () => void;
  onConvert?: () => void;
}

export default function CommercialQuotationA4({
  quotation,
  business,
  onClose,
  onConvert,
}: CommercialQuotationA4Props) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const isExpired = new Date(quotation.validUntil) < new Date();
  const taxableAmount =
    quotation.taxBreakdown?.taxableAmount !== undefined
      ? quotation.taxBreakdown.taxableAmount
      : Math.max(0, quotation.subtotal - quotation.discountTotal);

  const ssclAmount = quotation.taxBreakdown?.ssclAmount || 0;
  const vatAmount = quotation.taxBreakdown?.vatAmount || (quotation.taxTotal - ssclAmount > 0 ? quotation.taxTotal - ssclAmount : 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {/* Container Card */}
      <div className="bg-slate-100 rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-300 my-auto overflow-hidden flex flex-col max-h-[95vh]">
        {/* Modal Controls Header (Hidden in Print) */}
        <div className="no-print bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-purple-400" />
            <div>
              <h2 className="text-sm font-bold tracking-tight">Commercial Quotation / Estimate (A4)</h2>
              <p className="text-[11px] text-slate-400 font-mono">Reference #{quotation.quotationNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {onConvert && quotation.status !== "CONVERTED" && (
              <button
                onClick={onConvert}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
              >
                <span>Convert to Tax Invoice</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
            >
              <Printer className="w-4 h-4" />
              <span>Print A4 Quotation</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable A4 Sheet */}
        <div className="overflow-y-auto p-4 sm:p-8 flex justify-center bg-slate-200">
          <div
            ref={printRef}
            className="print-quotation-sheet bg-white text-slate-900 p-8 sm:p-12 rounded-xl shadow-lg border border-slate-300 w-full max-w-[210mm] min-h-[297mm] text-xs flex flex-col justify-between"
          >
            {/* 1. Header Section */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b-2 border-purple-900">
                <div className="space-y-1 max-w-md">
                  <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                    {business.name || "Sri Lanka General Merchant"}
                  </h1>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    {business.address || "Main Street, Colombo, Sri Lanka"}
                  </p>
                  <div className="text-[11px] text-slate-600 flex flex-wrap gap-x-4">
                    {business.phone && <span>Tel: {business.phone}</span>}
                    {business.email && <span>Email: {business.email}</span>}
                  </div>

                  {/* Seller Tax Numbers */}
                  <div className="pt-2 flex flex-wrap gap-2 text-[10px] font-mono">
                    {business.taxSettings?.tin && (
                      <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200 font-bold">
                        TIN: {business.taxSettings.tin}
                      </span>
                    )}
                    {business.taxSettings?.vatNumber && (
                      <span className="bg-purple-50 text-purple-900 px-2 py-0.5 rounded border border-purple-200 font-bold">
                        VAT Reg: {business.taxSettings.vatNumber}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right Header */}
                <div className="text-right sm:min-w-[200px]">
                  <div className="inline-block bg-purple-900 text-white px-3 py-1 rounded text-sm font-black tracking-widest uppercase mb-2">
                    PRO-FORMA QUOTATION
                  </div>
                  <div className="text-xs space-y-1">
                    <div className="font-mono font-bold text-slate-900">
                      <span className="text-slate-400">Quote #: </span>
                      {quotation.quotationNumber}
                    </div>
                    <div className="text-[11px] text-slate-600">
                      <span className="text-slate-400">Date: </span>
                      {new Date(quotation.createdAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                    <div className="text-[11px] font-semibold text-rose-700">
                      <span className="text-slate-400">Valid Until: </span>
                      {new Date(quotation.validUntil).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>

                    <div className="pt-1">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          quotation.status === "CONVERTED"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : isExpired
                            ? "bg-rose-100 text-rose-800 border border-rose-300"
                            : "bg-purple-100 text-purple-800 border border-purple-300"
                        }`}
                      >
                        {quotation.status}
                      </span>
                    </div>

                    {quotation.convertedInvoiceNumber && (
                      <div className="text-[10px] text-emerald-700 font-mono mt-0.5 font-bold">
                        Converted to: {quotation.convertedInvoiceNumber}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Customer Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 border-b border-slate-200">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Quotation Prepared For
                  </span>
                  <div className="font-bold text-sm text-slate-900">
                    {quotation.companyName || quotation.customerName}
                  </div>
                  {quotation.companyName && quotation.customerName && (
                    <div className="text-[11px] text-slate-600">
                      Contact: {quotation.customerName}
                    </div>
                  )}
                  {(quotation.address || quotation.customerPhone) && (
                    <div className="text-[11px] text-slate-600 leading-tight">
                      {quotation.address && <div>{quotation.address}</div>}
                      {quotation.customerPhone && <div>Phone: {quotation.customerPhone}</div>}
                    </div>
                  )}
                </div>

                <div className="sm:text-right space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Customer Compliance Info
                  </span>
                  <div className="text-[11px] font-mono space-y-0.5">
                    {quotation.tin && (
                      <div>
                        <span className="text-slate-400">Customer TIN: </span>
                        <span className="font-semibold text-slate-800">{quotation.tin}</span>
                      </div>
                    )}
                    {quotation.vatNumber && (
                      <div>
                        <span className="text-slate-400">Customer VAT: </span>
                        <span className="font-semibold text-slate-800">{quotation.vatNumber}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-400">Sales Representative: </span>
                      <span className="font-semibold text-slate-800">
                        {quotation.createdBy || "Staff"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Items Table */}
              <div className="py-4">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-purple-950 text-white text-[10px] font-bold uppercase tracking-wider">
                      <th className="py-2.5 px-3 rounded-l">#</th>
                      <th className="py-2.5 px-3">Item Description</th>
                      <th className="py-2.5 px-3 text-center">Price Tier</th>
                      <th className="py-2.5 px-3 text-right">Quantity</th>
                      <th className="py-2.5 px-3 text-right">Unit Price</th>
                      <th className="py-2.5 px-3 text-right">Discount</th>
                      <th className="py-2.5 px-3 text-right rounded-r">Total (LKR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {quotation.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">{item.name}</div>
                          {item.barcode && (
                            <div className="text-[10px] font-mono text-slate-400">
                              Barcode: {item.barcode}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              item.priceTier === "WHOLESALE"
                                ? "bg-amber-100 text-amber-900"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {item.priceTier || "RETAIL"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium">
                          {item.quantity}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          {formatCurrency(item.unitPrice)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-rose-600">
                          {item.discount ? `-${formatCurrency(item.discount)}` : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(item.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 4. Financial Totals */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-200">
                <div className="space-y-4">
                  <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block mb-0.5">
                      Total in Official Words
                    </span>
                    <p className="text-xs font-semibold text-slate-900 italic">
                      {amountToWords(quotation.netTotal)}
                    </p>
                  </div>

                  {business.bankDetails?.accountNumber && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-900 text-xs font-bold">
                        <Landmark className="w-3.5 h-3.5 text-slate-600" />
                        <span>Direct Bank Transfer Details for Purchase Orders</span>
                      </div>
                      <div className="text-[11px] text-slate-700 font-mono space-y-0.5">
                        <div>Bank: {business.bankDetails.bankName || "—"}</div>
                        <div>Branch: {business.bankDetails.branchName || "—"}</div>
                        <div className="font-bold text-slate-900">
                          Acc No: {business.bankDetails.accountNumber}
                        </div>
                        <div>Name: {business.bankDetails.accountName || business.name}</div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                    <span>Subtotal (Excl. Tax):</span>
                    <span className="font-semibold">{formatCurrency(quotation.subtotal)}</span>
                  </div>

                  {quotation.discountTotal > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100 text-rose-600">
                      <span>Volume Discount:</span>
                      <span>-{formatCurrency(quotation.discountTotal)}</span>
                    </div>
                  )}

                  <div className="flex justify-between py-1 border-b border-slate-100 text-slate-800 font-semibold">
                    <span>Taxable Base Value:</span>
                    <span>{formatCurrency(taxableAmount)}</span>
                  </div>

                  {ssclAmount > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100 text-purple-800">
                      <span>Social Security Levy (SSCL @ {quotation.taxBreakdown?.ssclRate || 2.5}%):</span>
                      <span className="font-semibold">{formatCurrency(ssclAmount)}</span>
                    </div>
                  )}

                  {vatAmount > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100 text-blue-800">
                      <span>Value Added Tax (VAT @ {quotation.taxBreakdown?.vatRate || 18}%):</span>
                      <span className="font-semibold">{formatCurrency(vatAmount)}</span>
                    </div>
                  )}

                  <div className="flex justify-between py-2 border-b-2 border-purple-950 text-base font-black text-slate-900">
                    <span>ESTIMATED TOTAL (LKR):</span>
                    <span>{formatCurrency(quotation.netTotal)}</span>
                  </div>
                </div>
              </div>

              {/* 5. Quotation Terms */}
              <div className="mt-4 pt-3 border-t border-slate-200 text-[10px] text-slate-500 leading-normal space-y-1">
                <div>
                  <span className="font-bold text-slate-700">Validity & Conditions: </span>
                  This quotation is valid until{" "}
                  {new Date(quotation.validUntil).toLocaleDateString("en-GB")}. Goods subject to stock
                  availability at confirmation. Delivery terms: standard commercial delivery within Colombo district.
                </div>
                {quotation.notes && (
                  <div>
                    <span className="font-bold text-slate-700">Special Notes: </span>
                    {quotation.notes}
                  </div>
                )}
              </div>
            </div>

            {/* 6. Footer Signature Block */}
            <div className="pt-10 mt-8 border-t border-slate-200">
              <div className="grid grid-cols-2 gap-12 text-center text-xs text-slate-600">
                <div>
                  <div className="border-b border-slate-400 pb-8 mb-2"></div>
                  <span className="font-bold text-slate-800 block">Prepared By</span>
                  <span className="text-[10px] text-slate-400">{quotation.createdBy || business.name}</span>
                </div>
                <div>
                  <div className="border-b border-slate-400 pb-8 mb-2"></div>
                  <span className="font-bold text-slate-800 block">Customer Acceptance</span>
                  <span className="text-[10px] text-slate-400">Signature / Purchase Order Reference</span>
                </div>
              </div>
              <div className="mt-6 text-center text-[9px] text-slate-400 font-mono">
                Commercial Quotation & Pro-Forma Estimate • Powered by Sri Lanka POS SaaS
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Embedded Print Styling */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .no-print {
            display: none !important;
          }
          .print-quotation-sheet,
          .print-quotation-sheet * {
            visibility: visible;
          }
          .print-quotation-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 15mm 20mm !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
