"use client";

import React from "react";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";
import { Printer, X, ShieldCheck, CheckCircle2 } from "lucide-react";

export interface SubscriptionInvoiceData {
  _id?: string;
  invoiceNumber: string;
  businessName: string;
  ownerName: string;
  phone: string;
  email?: string;
  address?: string;
  plan: "TRIAL" | "BASIC" | "PROFESSIONAL" | "ENTERPRISE";
  billingCycle: "MONTHLY" | "QUARTERLY" | "BI_ANNUAL" | "ANNUAL";
  durationMonths: number;
  amount: number;
  discountAmount?: number;
  taxAmount?: number;
  paymentMethod: string;
  paymentReference?: string;
  bankName?: string;
  periodStart: string | Date;
  periodEnd: string | Date;
  status: string;
  paidAt?: string | Date;
  issuedAt?: string | Date;
  notes?: string;
}

interface SubscriptionInvoiceReceiptProps {
  invoice: SubscriptionInvoiceData;
  onClose?: () => void;
}

export default function SubscriptionInvoiceReceipt({
  invoice,
  onClose,
}: SubscriptionInvoiceReceiptProps) {
  const handlePrint = () => {
    window.print();
  };

  const planDescriptions: Record<string, string> = {
    BASIC: "Up to 500 product items, 3 counter staff accounts, thermal receipt printing, offline resilience, and daily sales reports.",
    PROFESSIONAL: "Up to 2,000 product items, 10 staff accounts, multi-counter support, inventory movements, customer credit tracking, and automated cloud sync.",
    ENTERPRISE: "Unlimited catalog items, 50 staff accounts, multi-branch ready, dedicated priority hotline support, and custom receipt branding.",
    TRIAL: "Evaluation license with standard grocery and retail POS features.",
  };

  const cycleLabels: Record<string, string> = {
    MONTHLY: "1 Month License",
    QUARTERLY: "3 Months License (Quarterly)",
    BI_ANNUAL: "6 Months License (Bi-Annual)",
    ANNUAL: "12 Months License (Annual Prepay)",
  };

  const formatDate = (dateVal?: string | Date) => {
    if (!dateVal) return "-";
    const d = new Date(dateVal);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[95vh] flex flex-col">
        {/* Header Action Bar (Hidden in Print) */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between print:hidden shrink-0">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
              Official SaaS Receipt
            </span>
            <span className="text-xs font-mono font-semibold text-slate-700">
              {invoice.invoiceNumber}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Invoice / Save PDF</span>
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Printable Invoice Body */}
        <div
          id="saas-invoice-print"
          className="p-6 sm:p-8 overflow-y-auto space-y-6 text-slate-800 font-sans print:p-0 print:m-0 print:overflow-visible print:max-h-none"
        >
          {/* Top Banner / Platform Info */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-200 pb-6">
            <div>
              <div className="flex items-center gap-2 text-blue-600 font-extrabold text-base tracking-tight">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <span>SRI LANKA POS CLOUD PLATFORM</span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Commercial Cloud Point of Sale SaaS Software
                <br />
                Platform Representative & Customer Support
                <br />
                Hotline: <strong className="text-slate-700">077 123 4567</strong> • Colombo, Sri Lanka
              </p>
            </div>

            <div className="sm:text-right">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                INVOICE & RECEIPT
              </h2>
              <div className="text-xs font-mono font-bold text-blue-600 mt-0.5">
                #{invoice.invoiceNumber}
              </div>
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>PAYMENT CONFIRMED (PAID)</span>
              </div>
            </div>
          </div>

          {/* Client Details & Invoice Meta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <div className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                Billed To (Client Store)
              </div>
              <div className="font-black text-slate-900 text-sm">{invoice.businessName}</div>
              <div className="text-slate-700">
                <span className="font-semibold">Contact:</span> {invoice.ownerName}
              </div>
              <div className="text-slate-700">
                <span className="font-semibold">Tel:</span> {invoice.phone}
              </div>
              {invoice.email && (
                <div className="text-slate-700">
                  <span className="font-semibold">Email:</span> {invoice.email}
                </div>
              )}
              {invoice.address && (
                <div className="text-slate-500 text-[11px] leading-snug pt-0.5">
                  {invoice.address}
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
              <div className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                Invoice & Service Dates
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date Issued:</span>
                <span className="font-bold text-slate-800">
                  {formatDate(invoice.issuedAt || invoice.paidAt)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Date:</span>
                <span className="font-bold text-slate-800">{formatDate(invoice.paidAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Service Period:</span>
                <span className="font-bold text-blue-700 font-mono text-[11px]">
                  {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Duration:</span>
                <span className="font-semibold text-slate-800">
                  {invoice.durationMonths} Month{invoice.durationMonths > 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>

          {/* Itemized Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-3">Description & Service Tier</th>
                  <th className="p-3 text-center">Cycle</th>
                  <th className="p-3 text-right">Amount (LKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                <tr>
                  <td className="p-3">
                    <div className="font-bold text-slate-900 text-sm">
                      Sri Lanka POS Cloud — {invoice.plan} Tier
                    </div>
                    <div className="text-slate-500 text-[11px] mt-0.5">
                      {planDescriptions[invoice.plan] || planDescriptions.BASIC}
                    </div>
                    <div className="text-slate-600 text-[10px] font-mono mt-1">
                      Active Validity: {formatDate(invoice.periodStart)} to{" "}
                      {formatDate(invoice.periodEnd)}
                    </div>
                  </td>
                  <td className="p-3 text-center font-medium">
                    {cycleLabels[invoice.billingCycle] || `${invoice.durationMonths} Month(s)`}
                  </td>
                  <td className="p-3 text-right font-black font-mono text-sm text-slate-900">
                    {formatCurrency(invoice.amount + (invoice.discountAmount || 0))}
                  </td>
                </tr>

                {invoice.discountAmount && invoice.discountAmount > 0 ? (
                  <tr className="bg-emerald-50/50 text-emerald-800">
                    <td className="p-2.5 pl-3 font-medium">
                      Promotional / Annual Prepayment Discount
                    </td>
                    <td className="p-2.5 text-center">-</td>
                    <td className="p-2.5 text-right font-bold font-mono">
                      -{formatCurrency(invoice.discountAmount)}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>

            {/* Totals Summary */}
            <div className="bg-slate-50/80 p-4 border-t border-slate-200 flex flex-col items-end space-y-1 text-xs">
              <div className="flex justify-between w-64 text-slate-600">
                <span>Subtotal:</span>
                <span className="font-mono">
                  {formatCurrency(invoice.amount + (invoice.discountAmount || 0))}
                </span>
              </div>
              {invoice.discountAmount && invoice.discountAmount > 0 ? (
                <div className="flex justify-between w-64 text-emerald-700 font-medium">
                  <span>Discount Applied:</span>
                  <span className="font-mono">-{formatCurrency(invoice.discountAmount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between w-64 text-sm font-black text-slate-900 pt-1.5 border-t border-slate-200">
                <span>TOTAL PAID:</span>
                <span className="font-mono text-base text-blue-700">
                  {formatCurrency(invoice.amount)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Method Details */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div>
              <span className="text-slate-500 font-semibold">Payment Method: </span>
              <span className="font-bold text-slate-800 capitalize">
                {invoice.paymentMethod.replace(/_/g, " ")}
                {invoice.bankName ? ` (${invoice.bankName})` : ""}
              </span>
            </div>
            {invoice.paymentReference && (
              <div>
                <span className="text-slate-500 font-semibold">Reference Code: </span>
                <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 border border-slate-200 rounded">
                  {invoice.paymentReference}
                </span>
              </div>
            )}
          </div>

          {invoice.notes && (
            <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="font-semibold text-slate-700">Remarks: </span>
              {invoice.notes}
            </div>
          )}

          {/* Legal / Tax Note & Watermark */}
          <div className="border-t border-dashed border-slate-300 pt-4 text-center text-[10px] text-slate-400 space-y-1">
            <p>
              This is a computer-generated tax invoice and expense receipt issued by Sri Lanka POS
              Cloud Platform.
            </p>
            <p>
              Thank you for trusting Sri Lanka POS to power your business counter and retail
              operations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
