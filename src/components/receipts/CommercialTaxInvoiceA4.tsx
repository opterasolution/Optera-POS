"use client";

import React, { useRef } from "react";
import {
  Printer,
  X,
  Building,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  CreditCard,
  Landmark,
  FileCheck,
  ShieldCheck,
} from "lucide-react";
import { formatCurrency, formatSLDateTime, amountToWords } from "@/lib/formatters";

export interface TaxInvoiceData {
  _id: string;
  invoiceNumber: string;
  createdAt: string | Date;
  dueDate?: string | Date;
  cashierName?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  paymentMethod: string;
  paymentReference?: string;
  paymentStatus?: "PAID" | "PARTIAL" | "UNPAID";
  amountPaid?: number;
  balanceDue?: number;
  billingType?: "RETAIL" | "WHOLESALE";
  isTaxInvoice?: boolean;
  quotationNumber?: string;
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
  buyerDetails?: {
    companyName?: string;
    tin?: string;
    vatNumber?: string;
    address?: string;
    phone?: string;
  };
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

interface CommercialTaxInvoiceA4Props {
  invoice: TaxInvoiceData;
  business: BusinessTaxProfile;
  onClose: () => void;
}

export default function CommercialTaxInvoiceA4({
  invoice,
  business,
  onClose,
}: CommercialTaxInvoiceA4Props) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const isVatRegistered = !!business.taxSettings?.vatNumber;
  const isTaxInvoice = invoice.isTaxInvoice || isVatRegistered;

  const taxableAmount =
    invoice.taxBreakdown?.taxableAmount !== undefined
      ? invoice.taxBreakdown.taxableAmount
      : Math.max(0, invoice.subtotal - invoice.discountTotal);

  const ssclAmount = invoice.taxBreakdown?.ssclAmount || 0;
  const vatAmount = invoice.taxBreakdown?.vatAmount || (invoice.taxTotal - ssclAmount > 0 ? invoice.taxTotal - ssclAmount : 0);

  const isPaid = invoice.paymentStatus === "PAID" || (!invoice.paymentStatus && invoice.paymentMethod !== "CREDIT");
  const isUnpaid = invoice.paymentStatus === "UNPAID" || invoice.paymentMethod === "CREDIT";

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {/* Container Card */}
      <div className="bg-slate-100 rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-300 my-auto overflow-hidden flex flex-col max-h-[95vh]">
        {/* Modal Controls Header (Hidden in Print) */}
        <div className="no-print bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-blue-400" />
            <div>
              <h2 className="text-sm font-bold tracking-tight">
                {isTaxInvoice ? "IRD Tax Invoice (A4 Standard)" : "Commercial Sales Invoice (A4)"}
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">Invoice #{invoice.invoiceNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
            >
              <Printer className="w-4 h-4" />
              <span>Print A4 Invoice</span>
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
            className="print-invoice-sheet bg-white text-slate-900 p-8 sm:p-12 rounded-xl shadow-lg border border-slate-300 w-full max-w-[210mm] min-h-[297mm] text-xs flex flex-col justify-between"
          >
            {/* 1. Header Section: Seller Branding & Tax Identification */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b-2 border-slate-900">
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

                  {/* Seller IRD Tax Details */}
                  <div className="pt-2 flex flex-wrap gap-2 text-[10px] font-mono">
                    {business.taxSettings?.tin ? (
                      <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200 font-bold">
                        TIN: {business.taxSettings.tin}
                      </span>
                    ) : (
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                        TIN: Registered
                      </span>
                    )}

                    {business.taxSettings?.vatNumber && (
                      <span className="bg-blue-50 text-blue-900 px-2 py-0.5 rounded border border-blue-200 font-bold">
                        VAT Reg: {business.taxSettings.vatNumber}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right Header: Document Title & Metadata */}
                <div className="text-right sm:min-w-[200px]">
                  <div className="inline-block bg-slate-900 text-white px-3 py-1 rounded text-sm font-black tracking-widest uppercase mb-2">
                    {isTaxInvoice ? "TAX INVOICE" : "COMMERCIAL INVOICE"}
                  </div>
                  <div className="text-xs space-y-1">
                    <div className="font-mono font-bold text-slate-900">
                      <span className="text-slate-400">Invoice #: </span>
                      {invoice.invoiceNumber}
                    </div>
                    <div className="text-[11px] text-slate-600">
                      <span className="text-slate-400">Date of Supply: </span>
                      {new Date(invoice.createdAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                    {invoice.dueDate && (
                      <div className="text-[11px] text-rose-700 font-semibold">
                        <span className="text-slate-400">Due Date: </span>
                        {new Date(invoice.dueDate).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                    )}
                    {invoice.quotationNumber && (
                      <div className="text-[10px] text-purple-700 font-mono">
                        Quote Ref: {invoice.quotationNumber}
                      </div>
                    )}

                    <div className="pt-1">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          isPaid
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : isUnpaid
                            ? "bg-rose-100 text-rose-800 border border-rose-300"
                            : "bg-amber-100 text-amber-800 border border-amber-300"
                        }`}
                      >
                        {invoice.paymentStatus || (invoice.paymentMethod === "CREDIT" ? "UNPAID" : "PAID")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Bill To / Buyer Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 border-b border-slate-200">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Billed To (Customer / Entity)
                  </span>
                  <div className="font-bold text-sm text-slate-900">
                    {invoice.buyerDetails?.companyName || invoice.customerName || "Walk-in Customer"}
                  </div>
                  {invoice.buyerDetails?.companyName && invoice.customerName && (
                    <div className="text-[11px] text-slate-600">
                      Attn: {invoice.customerName}
                    </div>
                  )}
                  {(invoice.buyerDetails?.address || invoice.customerPhone) && (
                    <div className="text-[11px] text-slate-600 leading-tight">
                      {invoice.buyerDetails?.address && <div>{invoice.buyerDetails.address}</div>}
                      {invoice.customerPhone && <div>Phone: {invoice.customerPhone}</div>}
                    </div>
                  )}
                </div>

                <div className="sm:text-right space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Buyer Tax & Compliance Info
                  </span>
                  <div className="text-[11px] font-mono space-y-0.5">
                    <div>
                      <span className="text-slate-400">Buyer TIN: </span>
                      <span className="font-semibold text-slate-800">
                        {invoice.buyerDetails?.tin || "Not Provided"}
                      </span>
                    </div>
                    {invoice.buyerDetails?.vatNumber && (
                      <div>
                        <span className="text-slate-400">Buyer VAT #: </span>
                        <span className="font-semibold text-slate-800">
                          {invoice.buyerDetails.vatNumber}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-400">Pricing Mode: </span>
                      <span className="font-semibold text-slate-800">
                        {invoice.billingType || "RETAIL"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Payment Channel: </span>
                      <span className="font-semibold text-slate-800">
                        {invoice.paymentMethod.replace("_", " ")}
                        {invoice.paymentReference ? ` (${invoice.paymentReference})` : ""}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Line Items Table */}
              <div className="py-4">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider">
                      <th className="py-2.5 px-3 rounded-l">#</th>
                      <th className="py-2.5 px-3">Item Description</th>
                      <th className="py-2.5 px-3 text-center">Tier</th>
                      <th className="py-2.5 px-3 text-right">Qty</th>
                      <th className="py-2.5 px-3 text-right">Unit Price</th>
                      <th className="py-2.5 px-3 text-right">Discount</th>
                      <th className="py-2.5 px-3 text-right rounded-r">Total (LKR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {invoice.items.map((item, idx) => (
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

              {/* 4. Financial Totals & Tax Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-200">
                {/* Left: Amount in Words & Bank Details */}
                <div className="space-y-4">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                      Amount in Official Words
                    </span>
                    <p className="text-xs font-semibold text-slate-900 italic">
                      {amountToWords(invoice.netTotal)}
                    </p>
                  </div>

                  {business.bankDetails?.accountNumber && (
                    <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1">
                      <div className="flex items-center gap-1.5 text-blue-900 text-xs font-bold">
                        <Landmark className="w-3.5 h-3.5 text-blue-600" />
                        <span>Direct Bank Deposit / Transfer Details</span>
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

                {/* Right: Calculations (Taxable, SSCL 2.5%, VAT 18%, Grand Total) */}
                <div className="space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                    <span>Subtotal (Excl. Tax):</span>
                    <span className="font-semibold">{formatCurrency(invoice.subtotal)}</span>
                  </div>

                  {invoice.discountTotal > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100 text-rose-600">
                      <span>Trade / Cashier Discount:</span>
                      <span>-{formatCurrency(invoice.discountTotal)}</span>
                    </div>
                  )}

                  <div className="flex justify-between py-1 border-b border-slate-100 text-slate-800 font-semibold">
                    <span>Taxable Turnover:</span>
                    <span>{formatCurrency(taxableAmount)}</span>
                  </div>

                  {ssclAmount > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100 text-purple-800">
                      <span>Social Security Levy (SSCL @ {invoice.taxBreakdown?.ssclRate || 2.5}%):</span>
                      <span className="font-semibold">{formatCurrency(ssclAmount)}</span>
                    </div>
                  )}

                  {vatAmount > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100 text-blue-800">
                      <span>Value Added Tax (VAT @ {invoice.taxBreakdown?.vatRate || 18}%):</span>
                      <span className="font-semibold">{formatCurrency(vatAmount)}</span>
                    </div>
                  )}

                  <div className="flex justify-between py-2 border-b-2 border-slate-900 text-base font-black text-slate-900">
                    <span>TOTAL PAYABLE (LKR):</span>
                    <span>{formatCurrency(invoice.netTotal)}</span>
                  </div>

                  {invoice.amountPaid !== undefined && invoice.amountPaid > 0 && (
                    <div className="flex justify-between py-1 text-emerald-700">
                      <span>Amount Received:</span>
                      <span>{formatCurrency(invoice.amountPaid)}</span>
                    </div>
                  )}

                  {invoice.balanceDue !== undefined && invoice.balanceDue > 0 && (
                    <div className="flex justify-between py-1 text-rose-700 font-bold">
                      <span>Balance Outstanding Due:</span>
                      <span>{formatCurrency(invoice.balanceDue)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 5. Policy Notes */}
              {business.taxSettings?.invoiceNotes && (
                <div className="mt-4 pt-3 border-t border-slate-200 text-[10px] text-slate-500 leading-normal">
                  <span className="font-bold text-slate-600">Terms & Instructions: </span>
                  {business.taxSettings.invoiceNotes}
                </div>
              )}
            </div>

            {/* 6. Footer Signature & Rubber Stamp Block */}
            <div className="pt-10 mt-8 border-t border-slate-200">
              <div className="grid grid-cols-2 gap-12 text-center text-xs text-slate-600">
                <div>
                  <div className="border-b border-slate-400 pb-8 mb-2"></div>
                  <span className="font-bold text-slate-800 block">Authorized Signature & Rubber Stamp</span>
                  <span className="text-[10px] text-slate-400">For {business.name}</span>
                </div>
                <div>
                  <div className="border-b border-slate-400 pb-8 mb-2"></div>
                  <span className="font-bold text-slate-800 block">Customer Acceptance & Goods Received</span>
                  <span className="text-[10px] text-slate-400">Signature / Seal & Date</span>
                </div>
              </div>
              <div className="mt-6 text-center text-[9px] text-slate-400 font-mono">
                System Generated IRD Compliant Tax Invoice • Powered by Sri Lanka POS SaaS
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
          .print-invoice-sheet,
          .print-invoice-sheet * {
            visibility: visible;
          }
          .print-invoice-sheet {
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
