"use client";

import React, { useState } from "react";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";
import { Printer, X, CheckCircle2, Award, Calendar, CreditCard, User, Building, FileSpreadsheet } from "lucide-react";

export interface CommissionPayoutData {
  payoutNumber: string;
  userName: string;
  userRole?: string;
  userPhone?: string;
  period: string;
  startDate: string | Date;
  endDate: string | Date;
  totalSalesCount: number;
  totalSalesVolume: number;
  baseCommission: number;
  targetBonus: number;
  deductions: number;
  deductionReason?: string;
  netPayable: number;
  status: "PENDING" | "APPROVED" | "PAID" | "CANCELLED";
  paymentMethod?: "CASH" | "BANK_TRANSFER" | "CHEQUE";
  paymentReference?: string;
  paidAt?: string | Date;
  approvedBy?: string;
  salesBreakdown?: Array<{
    invoiceNumber: string;
    date: string | Date;
    saleAmount: number;
    commissionAmount: number;
  }>;
  notes?: string;
  createdAt?: string | Date;
}

export interface CommissionPayoutReceiptProps {
  business: {
    name: string;
    phone?: string;
    address?: string;
    taxNumber?: string;
    vatNumber?: string;
  };
  payout: CommissionPayoutData;
  onClose?: () => void;
}

export default function CommissionPayoutReceipt({
  business,
  payout,
  onClose,
}: CommissionPayoutReceiptProps) {
  const [layoutMode, setLayoutMode] = useState<"thermal" | "a4">("a4");

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8 print:p-0 print:border-none print:shadow-none print:max-w-none print:m-0 print:w-full">
        {/* Modal Controls Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 print:hidden">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-emerald-600" />
              Commission Voucher
            </span>
            <span className="text-sm font-mono font-bold text-slate-800">
              {payout.payoutNumber}
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                payout.status === "PAID"
                  ? "bg-green-100 text-green-700"
                  : payout.status === "APPROVED"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {payout.status}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Layout switch */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setLayoutMode("a4")}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  layoutMode === "a4" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                A4 Statement
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode("thermal")}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  layoutMode === "thermal" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Thermal Slip (80mm)
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Slip</span>
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* ================= A4 CORPORATE LAYOUT ================= */}
        {layoutMode === "a4" && (
          <div id="printable-commission-a4" className="p-6 border border-slate-200 rounded-xl bg-white text-slate-900 font-sans space-y-6 print:border-none print:p-0">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-200 pb-5">
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">{business.name || "Sri Lanka Commercial Store"}</h1>
                {business.address && <p className="text-xs text-slate-500 mt-0.5">{business.address}</p>}
                {business.phone && <p className="text-xs text-slate-500">Tel: {business.phone}</p>}
                {business.taxNumber && <p className="text-xs text-slate-500">TIN: {business.taxNumber}</p>}
              </div>

              <div className="text-right">
                <span className="inline-block px-3 py-1 bg-emerald-600 text-white font-extrabold text-xs tracking-wider rounded uppercase">
                  Staff Commission Settlement
                </span>
                <p className="font-mono font-bold text-base text-slate-900 mt-2">{payout.payoutNumber}</p>
                <p className="text-xs text-slate-500">
                  Date: {payout.paidAt ? formatSLDateTime(payout.paidAt) : payout.createdAt ? formatSLDateTime(payout.createdAt) : new Date().toLocaleDateString("en-GB")}
                </p>
              </div>
            </div>

            {/* Staff & Period Information */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div className="space-y-1">
                <p className="text-slate-400 uppercase text-[10px] font-bold tracking-wider">Employee Information</p>
                <p className="text-sm font-bold text-slate-900">{payout.userName}</p>
                {payout.userRole && <p className="text-slate-600">Designation: <span className="font-semibold text-slate-800">{payout.userRole}</span></p>}
                {payout.userPhone && <p className="text-slate-600">Contact: {payout.userPhone}</p>}
              </div>

              <div className="space-y-1 text-right">
                <p className="text-slate-400 uppercase text-[10px] font-bold tracking-wider">Settlement Period</p>
                <p className="text-sm font-bold text-slate-900">{payout.period}</p>
                <p className="text-slate-600">
                  Window: {new Date(payout.startDate).toLocaleDateString("en-GB")} — {new Date(payout.endDate).toLocaleDateString("en-GB")}
                </p>
                <p className="text-slate-600 font-medium">Invoices Closed: <span className="font-bold text-slate-900">{payout.totalSalesCount}</span></p>
              </div>
            </div>

            {/* Financial Summary Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5">Performance Component</th>
                    <th className="px-4 py-2.5 text-center">Basis / Volume</th>
                    <th className="px-4 py-2.5 text-right">Settlement (LKR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      Sales Commission (Accrued)
                      <p className="text-[11px] text-slate-400 font-normal">Earned from closed client invoices in period</p>
                    </td>
                    <td className="px-4 py-2.5 text-center text-slate-600 font-mono">
                      Rs. {formatCurrency(payout.totalSalesVolume)} ({payout.totalSalesCount} bills)
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-900 font-mono">
                      Rs. {formatCurrency(payout.baseCommission)}
                    </td>
                  </tr>

                  {payout.targetBonus > 0 && (
                    <tr className="bg-emerald-50/50">
                      <td className="px-4 py-2.5 font-medium text-emerald-900">
                        Sales Quota Target Bonus
                        <p className="text-[11px] text-emerald-600 font-normal">Achieved store sales target incentive reward</p>
                      </td>
                      <td className="px-4 py-2.5 text-center text-emerald-800 font-bold">TARGET ACHIEVED ★</td>
                      <td className="px-4 py-2.5 text-right font-bold text-emerald-700 font-mono">
                        + Rs. {formatCurrency(payout.targetBonus)}
                      </td>
                    </tr>
                  )}

                  {payout.deductions > 0 && (
                    <tr className="bg-rose-50/40">
                      <td className="px-4 py-2.5 font-medium text-rose-900">
                        Adjustments & Deductions
                        {payout.deductionReason && (
                          <p className="text-[11px] text-rose-600 font-normal">{payout.deductionReason}</p>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center text-rose-600">Deduction</td>
                      <td className="px-4 py-2.5 text-right font-bold text-rose-600 font-mono">
                        - Rs. {formatCurrency(payout.deductions)}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-slate-900 text-white font-bold">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-right uppercase tracking-wider text-xs font-semibold">
                      Net Payout Disbursed:
                    </td>
                    <td className="px-4 py-3 text-right text-base font-mono text-emerald-400">
                      Rs. {formatCurrency(payout.netPayable)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Payment Details */}
            {payout.status === "PAID" && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between text-xs text-emerald-900">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-bold">Disbursed via {payout.paymentMethod || "CASH"}</p>
                    {payout.paymentReference && <p className="text-[11px] text-emerald-700">Ref / Cheque #: {payout.paymentReference}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-emerald-700 font-medium">Disbursed by: {payout.approvedBy || "Manager"}</p>
                </div>
              </div>
            )}

            {/* Itemized Invoices List (if available) */}
            {payout.salesBreakdown && payout.salesBreakdown.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Itemized Sales Breakdown ({payout.salesBreakdown.length} sales)</p>
                <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-1.5">Invoice #</th>
                        <th className="px-3 py-1.5">Date</th>
                        <th className="px-3 py-1.5 text-right">Sale Amount</th>
                        <th className="px-3 py-1.5 text-right">Commission</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {payout.salesBreakdown.map((sb, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-3 py-1 font-semibold text-slate-800">{sb.invoiceNumber}</td>
                          <td className="px-3 py-1 text-slate-500">{new Date(sb.date).toLocaleDateString("en-GB")}</td>
                          <td className="px-3 py-1 text-right text-slate-700">Rs. {formatCurrency(sb.saleAmount)}</td>
                          <td className="px-3 py-1 text-right font-bold text-emerald-700">Rs. {formatCurrency(sb.commissionAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-10 pt-10 border-t border-slate-200 text-xs">
              <div className="text-center">
                <div className="border-t border-slate-300 w-48 mx-auto mb-1"></div>
                <p className="font-semibold text-slate-800">Authorized Manager Signature</p>
                <p className="text-[10px] text-slate-400">Store Stamp & Date</p>
              </div>
              <div className="text-center">
                <div className="border-t border-slate-300 w-48 mx-auto mb-1"></div>
                <p className="font-semibold text-slate-800">Employee Acknowledgment</p>
                <p className="text-[10px] text-slate-400">Received with thanks</p>
              </div>
            </div>
          </div>
        )}

        {/* ================= THERMAL 80MM LAYOUT ================= */}
        {layoutMode === "thermal" && (
          <div
            id="printable-commission-thermal"
            className="mx-auto bg-white p-4 border border-dashed border-slate-300 font-mono text-[11px] leading-tight text-slate-900 space-y-2 max-w-[320px] print:border-none print:p-0"
          >
            <div className="text-center space-y-0.5 pb-2 border-b border-dashed border-slate-400">
              <p className="font-black text-sm tracking-tight">{business.name || "SRI LANKA STORE"}</p>
              {business.address && <p className="text-[10px] text-slate-600">{business.address}</p>}
              {business.phone && <p className="text-[10px] text-slate-600">Tel: {business.phone}</p>}
              <p className="font-bold text-xs uppercase mt-1">COMMISSION PAYOUT SLIP</p>
              <p className="text-[10px] font-semibold text-slate-700">{payout.payoutNumber}</p>
            </div>

            <div className="space-y-1 py-1 border-b border-dashed border-slate-300 text-[10px]">
              <div className="flex justify-between">
                <span className="text-slate-600">Staff:</span>
                <span className="font-bold">{payout.userName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Period:</span>
                <span>{payout.period}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Bills Closed:</span>
                <span>{payout.totalSalesCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Gross Sales:</span>
                <span>Rs. {formatCurrency(payout.totalSalesVolume)}</span>
              </div>
            </div>

            <div className="space-y-1 py-1 border-b border-dashed border-slate-300 text-[11px]">
              <div className="flex justify-between">
                <span>Base Commission:</span>
                <span className="font-bold">Rs. {formatCurrency(payout.baseCommission)}</span>
              </div>
              {payout.targetBonus > 0 && (
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>Target Bonus:</span>
                  <span>+ Rs. {formatCurrency(payout.targetBonus)}</span>
                </div>
              )}
              {payout.deductions > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Deductions:</span>
                  <span>- Rs. {formatCurrency(payout.deductions)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black pt-1 border-t border-slate-900">
                <span>NET PAYOUT:</span>
                <span>Rs. {formatCurrency(payout.netPayable)}</span>
              </div>
            </div>

            <div className="text-[10px] space-y-0.5 py-1">
              <div className="flex justify-between">
                <span>Status:</span>
                <span className="font-bold uppercase">{payout.status}</span>
              </div>
              {payout.paymentMethod && (
                <div className="flex justify-between">
                  <span>Method:</span>
                  <span>{payout.paymentMethod}</span>
                </div>
              )}
              {payout.paymentReference && (
                <div className="flex justify-between">
                  <span>Ref #:</span>
                  <span>{payout.paymentReference}</span>
                </div>
              )}
            </div>

            <div className="pt-6 pb-2 text-[10px] space-y-4 text-center">
              <div>
                <p className="border-t border-dotted border-slate-400 pt-1">Authorized Signature</p>
              </div>
              <div>
                <p className="border-t border-dotted border-slate-400 pt-1">Staff Signature</p>
              </div>
              <p className="text-[9px] text-slate-400">Powered by Sri Lanka POS Cloud SaaS</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
