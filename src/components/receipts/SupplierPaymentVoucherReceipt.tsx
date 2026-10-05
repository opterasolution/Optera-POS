"use client";

import React, { useState } from "react";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";
import { Printer, X, FileText, CheckCircle2, Building2, CreditCard, ShieldCheck } from "lucide-react";

export interface SupplierPaymentVoucherData {
  paymentNumber: string;
  supplierName: string;
  supplierCode?: string;
  supplierAddress?: string;
  supplierPhone?: string;
  supplierTaxNumber?: string;
  amount: number; // Net paid LKR (e.g. Rs. 98,000)
  grossBillAmount?: number; // Gross invoice debt LKR (e.g. Rs. 100,000)
  discountPercentage?: number; // e.g. 2.0%
  discountAmount?: number; // e.g. Rs. 2,000
  totalDebtOffset?: number; // full debt reduction (e.g. Rs. 100,000)
  balanceBefore: number;
  balanceAfter: number;
  paymentMethod: "CHEQUE" | "BANK_TRANSFER" | "CASH";
  chequeNumber?: string;
  chequeDate?: string | Date;
  bankName?: string;
  referenceNumber?: string;
  poNumber?: string;
  supplierInvoiceNumber?: string;
  notes?: string;
  paidBy: string;
  approvedBy?: string;
  createdAt: string | Date;
}

export interface SupplierPaymentVoucherReceiptProps {
  business: {
    name: string;
    phone?: string;
    address?: string;
    email?: string;
    taxNumber?: string;
    registrationNumber?: string;
    receiptSettings?: {
      defaultWidth?: "58mm" | "80mm";
    };
  };
  voucher: SupplierPaymentVoucherData;
  onClose?: () => void;
  initialFormat?: "A4_REMITTANCE" | "THERMAL_80MM";
}

// Number to Words in Sri Lankan Rupees
function convertNumberToWordsLKR(amount: number): string {
  const rounded = Math.round(amount);
  if (rounded === 0) return "Rupees Zero Only";

  const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convertChunk(num: number): string {
    let result = "";
    if (num >= 100) {
      result += units[Math.floor(num / 100)] + " Hundred ";
      num %= 100;
    }
    if (num >= 10 && num <= 19) {
      result += teens[num - 10] + " ";
    } else if (num >= 20) {
      result += tens[Math.floor(num / 10)] + " ";
      if (num % 10 > 0) result += units[num % 10] + " ";
    } else if (num > 0) {
      result += units[num] + " ";
    }
    return result.trim();
  }

  let words = "";
  let rem = rounded;

  const crore = Math.floor(rem / 10000000);
  if (crore > 0) {
    words += convertChunk(crore) + " Crore ";
    rem %= 10000000;
  }

  const lakh = Math.floor(rem / 100000);
  if (lakh > 0) {
    words += convertChunk(lakh) + " Lakh ";
    rem %= 100000;
  }

  const thousand = Math.floor(rem / 1000);
  if (thousand > 0) {
    words += convertChunk(thousand) + " Thousand ";
    rem %= 1000;
  }

  if (rem > 0) {
    words += convertChunk(rem) + " ";
  }

  return `Rupees ${words.trim()} Only`;
}

export default function SupplierPaymentVoucherReceipt({
  business,
  voucher,
  onClose,
  initialFormat = "A4_REMITTANCE",
}: SupplierPaymentVoucherReceiptProps) {
  const [printFormat, setPrintFormat] = useState<"A4_REMITTANCE" | "THERMAL_80MM">(initialFormat);

  const handlePrint = () => {
    window.print();
  };

  const grossBill = voucher.grossBillAmount || (voucher.amount + (voucher.discountAmount || 0));
  const discountAmt = voucher.discountAmount || 0;
  const discountPct = voucher.discountPercentage || 0;
  const totalOffset = voucher.totalDebtOffset || (voucher.amount + discountAmt);
  const wordsAmount = convertNumberToWordsLKR(voucher.amount);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className={`bg-white rounded-2xl w-full shadow-2xl border border-slate-200 space-y-4 my-6 transition-all print:p-0 print:border-none print:shadow-none print:m-0 print:w-full ${
        printFormat === "A4_REMITTANCE" ? "max-w-4xl p-6 sm:p-8" : "max-w-sm p-5"
      }`}>
        {/* Modal Controls Header */}
        <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-100 gap-2 print:hidden">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-blue-700 text-white flex items-center gap-1.5 shadow-xs">
              <FileText className="w-3.5 h-3.5" />
              <span>Payment Voucher & Remittance</span>
            </span>
            <span className="text-xs font-mono font-bold text-slate-800">
              {voucher.paymentNumber}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Format Toggle */}
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPrintFormat("A4_REMITTANCE")}
                className={`px-2.5 py-1 rounded-md transition ${
                  printFormat === "A4_REMITTANCE"
                    ? "bg-white text-blue-700 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                A4 Remittance Advice
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat("THERMAL_80MM")}
                className={`px-2.5 py-1 rounded-md transition ${
                  printFormat === "THERMAL_80MM"
                    ? "bg-white text-blue-700 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                80mm Thermal Slip
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Voucher</span>
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* VIEW 1: A4 FORMAL SUPPLIER PAYMENT VOUCHER & REMITTANCE ADVICE            */}
        {/* ========================================================================= */}
        {printFormat === "A4_REMITTANCE" && (
          <div
            id="printable-supplier-a4-remittance"
            className="bg-white p-6 sm:p-10 border border-slate-200 rounded-xl font-sans text-slate-800 space-y-6 text-sm print:border-none print:p-0 print:rounded-none"
          >
            {/* Top Corporate Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-6 border-b-2 border-slate-900 gap-4">
              <div className="space-y-1">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                  {business?.name || "SRI LANKA COMMERCIAL ENTERPRISES"}
                </h1>
                <p className="text-xs text-slate-600">
                  {business?.address || "Head Office, Colombo, Sri Lanka"}
                </p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-0.5">
                  {business?.phone && <span>Tel: {business.phone}</span>}
                  {business?.email && <span>Email: {business.email}</span>}
                  {business?.taxNumber && (
                    <span className="font-semibold text-slate-700">VAT/TIN: {business.taxNumber}</span>
                  )}
                  {business?.registrationNumber && (
                    <span>Reg No: {business.registrationNumber}</span>
                  )}
                </div>
              </div>

              <div className="text-left sm:text-right bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-lg border sm:border-none border-slate-200 w-full sm:w-auto">
                <span className="inline-block px-3 py-1 bg-slate-900 text-white text-xs font-black uppercase tracking-wider rounded">
                  PAYMENT VOUCHER & REMITTANCE ADVICE
                </span>
                <div className="mt-2 text-xs space-y-0.5">
                  <div>
                    <span className="text-slate-500">Voucher No: </span>
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {voucher.paymentNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Date: </span>
                    <span className="font-medium text-slate-800">
                      {formatSLDateTime(voucher.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Beneficiary & Payment Method Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              {/* Payee / Supplier Details */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Beneficiary (Payee Supplier)
                </span>
                <h3 className="text-base font-extrabold text-slate-900">
                  {voucher.supplierName}
                </h3>
                {voucher.supplierCode && (
                  <p className="text-xs font-mono text-slate-600">Code: {voucher.supplierCode}</p>
                )}
                {voucher.supplierAddress && (
                  <p className="text-xs text-slate-600">{voucher.supplierAddress}</p>
                )}
                {voucher.supplierPhone && (
                  <p className="text-xs text-slate-500">Tel: {voucher.supplierPhone}</p>
                )}
                {voucher.supplierTaxNumber && (
                  <p className="text-xs text-slate-600">VAT/TIN: {voucher.supplierTaxNumber}</p>
                )}
              </div>

              {/* Disbursement Details */}
              <div className="space-y-1 text-xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Disbursement Mode & References
                </span>
                <div className="flex justify-between py-0.5 border-b border-slate-200">
                  <span className="text-slate-600">Payment Method:</span>
                  <span className="font-bold text-slate-900">{voucher.paymentMethod}</span>
                </div>
                {voucher.chequeNumber && (
                  <div className="flex justify-between py-0.5 border-b border-slate-200 font-mono">
                    <span className="text-slate-600 font-sans">Cheque Number:</span>
                    <span className="font-bold text-blue-900">{voucher.chequeNumber}</span>
                  </div>
                )}
                {voucher.chequeDate && (
                  <div className="flex justify-between py-0.5 border-b border-slate-200">
                    <span className="text-slate-600">Realization Date:</span>
                    <span className="font-medium text-slate-900">
                      {new Date(voucher.chequeDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {voucher.bankName && (
                  <div className="flex justify-between py-0.5 border-b border-slate-200">
                    <span className="text-slate-600">Drawee Bank:</span>
                    <span className="font-medium text-slate-900">{voucher.bankName}</span>
                  </div>
                )}
                {voucher.referenceNumber && (
                  <div className="flex justify-between py-0.5 border-b border-slate-200 font-mono">
                    <span className="text-slate-600 font-sans">Bank Transfer Ref:</span>
                    <span className="font-bold text-slate-900">{voucher.referenceNumber}</span>
                  </div>
                )}
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">Processed By:</span>
                  <span className="font-medium text-slate-900">{voucher.paidBy}</span>
                </div>
              </div>
            </div>

            {/* Remittance Item Breakdown Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Remittance Advice & Prompt Settlement Breakdown
                </h4>
                {discountAmt > 0 && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Early Settlement Skonto Rate Applied ({discountPct}%)
                  </span>
                )}
              </div>

              <div className="overflow-x-auto border border-slate-300 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 font-bold text-slate-700 border-b border-slate-300">
                    <tr>
                      <th className="p-3">Reference / Order</th>
                      <th className="p-3">Description</th>
                      <th className="p-3 text-right">Gross Bill (LKR)</th>
                      <th className="p-3 text-right">Prompt Discount Deducted</th>
                      <th className="p-3 text-right">Net Disbursed (LKR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-slate-900">
                        {voucher.poNumber || "PO-SETTLEMENT"}
                        {voucher.supplierInvoiceNumber && (
                          <div className="text-[11px] font-normal text-slate-500">
                            Inv: {voucher.supplierInvoiceNumber}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-slate-700">
                        Commercial goods inventory intake settlement
                        {discountAmt > 0 && (
                          <span className="block text-[11px] text-emerald-700 font-semibold">
                            Eligible prompt payment rebate ({discountPct}% terms claimed)
                          </span>
                        )}
                        {voucher.notes && (
                          <span className="block text-[11px] text-slate-500 italic">
                            Note: {voucher.notes}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(grossBill)}
                      </td>
                      <td className="p-3 text-right font-mono text-emerald-700 font-bold">
                        {discountAmt > 0 ? (
                          <span>- {formatCurrency(discountAmt)} ({discountPct}%)</span>
                        ) : (
                          <span className="text-slate-400">Rs. 0.00</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono font-black text-blue-900 text-sm">
                        {formatCurrency(voucher.amount)}
                      </td>
                    </tr>
                  </tbody>
                  <tfoot className="bg-slate-100 font-bold text-slate-800 border-t-2 border-slate-300">
                    <tr>
                      <td colSpan={2} className="p-3 text-right uppercase tracking-wider text-[11px]">
                        Totals:
                      </td>
                      <td className="p-3 text-right font-mono">
                        {formatCurrency(grossBill)}
                      </td>
                      <td className="p-3 text-right font-mono text-emerald-700">
                        {discountAmt > 0 ? `- ${formatCurrency(discountAmt)}` : "Rs. 0.00"}
                      </td>
                      <td className="p-3 text-right font-mono text-blue-900 text-sm">
                        {formatCurrency(voucher.amount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Net Amount in Words Banner */}
            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between flex-wrap gap-2">
              <div className="space-y-0.5">
                <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider block">
                  Net Amount Disbursed (In Words):
                </span>
                <p className="text-xs font-bold text-blue-950 italic">
                  {wordsAmount}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-blue-700 block">Total Payout:</span>
                <span className="text-lg font-black font-mono text-blue-950">
                  {formatCurrency(voucher.amount)}
                </span>
              </div>
            </div>

            {/* Accounts Payable Reconciliation Statement Block */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-xs">
              <h5 className="font-bold uppercase tracking-wider text-slate-600 text-[11px]">
                Accounts Payable (AP) Ledger Reconciliation
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Opening AP Debt:</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {formatCurrency(voucher.balanceBefore)}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-emerald-200 bg-emerald-50/30">
                  <span className="text-emerald-800 block text-[11px] font-semibold">
                    Total Debt Cleared:
                  </span>
                  <span className="font-mono font-bold text-emerald-900 text-sm">
                    {formatCurrency(totalOffset)}
                  </span>
                  {discountAmt > 0 && (
                    <span className="text-[10px] text-emerald-700 block">
                      (Disbursed {formatCurrency(voucher.amount)} + Discount {formatCurrency(discountAmt)})
                    </span>
                  )}
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Closing AP Debt:</span>
                  <span className={`font-mono font-bold text-sm ${
                    voucher.balanceAfter === 0 ? "text-emerald-700" : "text-rose-700"
                  }`}>
                    {formatCurrency(voucher.balanceAfter)}
                  </span>
                </div>
              </div>
            </div>

            {/* Tripartite Signatures Block */}
            <div className="pt-8 border-t border-slate-300 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center text-xs text-slate-700">
              <div className="space-y-8">
                <div className="h-10 border-b border-dashed border-slate-400"></div>
                <div>
                  <div className="font-bold text-slate-900">Prepared By</div>
                  <div className="text-[11px] text-slate-500">Accounts Executive ({voucher.paidBy})</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Signature & Date</div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="h-10 border-b border-dashed border-slate-400"></div>
                <div>
                  <div className="font-bold text-slate-900">Approved By</div>
                  <div className="text-[11px] text-slate-500">Finance Manager / Director</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Signature & Date</div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="h-10 border-b border-dashed border-slate-400"></div>
                <div>
                  <div className="font-bold text-slate-900">Received With Thanks</div>
                  <div className="text-[11px] text-slate-500">Payee Signature & Rubber Stamp</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Name / NIC / Date</div>
                </div>
              </div>
            </div>

            {/* Footer Legal Audit Note */}
            <div className="text-center text-[10px] text-slate-400 pt-3 border-t border-slate-200">
              This is a legally binding Commercial Payment Voucher & Remittance Advice generated in compliance with Sri Lanka Inland Revenue Act and statutory audit guidelines.
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: 80MM THERMAL CASH PAYOUT / CHEQUE SLIP                            */}
        {/* ========================================================================= */}
        {printFormat === "THERMAL_80MM" && (
          <div
            id="printable-supplier-payment-receipt"
            className="mx-auto bg-white p-4 border border-dashed border-slate-300 font-mono text-[11px] leading-tight text-slate-900 space-y-2 max-w-[320px] print:border-none print:p-0"
          >
            {/* Header */}
            <div className="text-center space-y-0.5">
              <h4 className="font-extrabold text-xs uppercase tracking-tight">
                {business?.name || "SRI LANKA COMMERCIAL STORE"}
              </h4>
              <p className="text-[10px] text-slate-600">{business?.address || "Commercial Division"}</p>
              {business?.phone && <p className="text-[10px] text-slate-500">Tel: {business.phone}</p>}
              <div className="pt-1 border-b border-dashed border-slate-300 pb-1">
                <span className="font-bold text-[11px] uppercase tracking-wider block">
                  * PAYMENT VOUCHER *
                </span>
                <span className="text-[9px] text-slate-500 font-sans">
                  විකුණුම්කරු ගෙවීම් කුවිතාන්සිය
                </span>
              </div>
            </div>

            {/* Voucher Metadata */}
            <div className="space-y-0.5 pt-1 text-[10px] border-b border-dashed border-slate-300 pb-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Voucher #:</span>
                <span className="font-bold">{voucher.paymentNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <span>{formatSLDateTime(voucher.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Paid By:</span>
                <span>{voucher.paidBy}</span>
              </div>
            </div>

            {/* Supplier Details */}
            <div className="space-y-0.5 text-[10px] border-b border-dashed border-slate-300 pb-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Supplier:</span>
                <span className="font-bold text-slate-900 truncate max-w-[150px]">
                  {voucher.supplierName}
                </span>
              </div>
              {voucher.poNumber && (
                <div className="flex justify-between">
                  <span className="text-slate-500">PO Ref:</span>
                  <span className="font-mono">{voucher.poNumber}</span>
                </div>
              )}
              {voucher.supplierInvoiceNumber && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Invoice Ref:</span>
                  <span className="font-mono">{voucher.supplierInvoiceNumber}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Mode:</span>
                <span className="font-bold">{voucher.paymentMethod}</span>
              </div>
              {voucher.chequeNumber && (
                <div className="flex justify-between font-mono">
                  <span className="text-slate-500">Cheque #:</span>
                  <span className="font-bold">{voucher.chequeNumber}</span>
                </div>
              )}
              {voucher.chequeDate && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Realize Date:</span>
                  <span>{new Date(voucher.chequeDate).toLocaleDateString()}</span>
                </div>
              )}
              {voucher.bankName && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Bank:</span>
                  <span>{voucher.bankName}</span>
                </div>
              )}
              {voucher.referenceNumber && (
                <div className="flex justify-between font-mono">
                  <span className="text-slate-500">Transfer Ref:</span>
                  <span>{voucher.referenceNumber}</span>
                </div>
              )}
            </div>

            {/* Prompt Settlement & Net Calculation */}
            <div className="space-y-1 pt-1 text-[11px] border-b border-dashed border-slate-300 pb-2">
              <div className="flex justify-between text-slate-600 text-[10px]">
                <span>Gross Bill Debt:</span>
                <span>{formatCurrency(grossBill)}</span>
              </div>

              {discountAmt > 0 && (
                <div className="flex justify-between text-emerald-700 font-bold text-[10px]">
                  <span>Prompt Cash Discount ({discountPct}%):</span>
                  <span>- {formatCurrency(discountAmt)}</span>
                </div>
              )}

              <div className="flex justify-between font-extrabold text-xs text-blue-900 pt-0.5">
                <span>NET AMOUNT PAID:</span>
                <span className="font-mono">{formatCurrency(voucher.amount)}</span>
              </div>

              <div className="flex justify-between text-[10px] text-slate-600 pt-0.5">
                <span>Total Debt Offset:</span>
                <span className="font-bold">{formatCurrency(totalOffset)}</span>
              </div>

              <div className="flex justify-between font-bold text-[11px] text-slate-900 pt-1 border-t border-dotted border-slate-300">
                <span>REMAINING PAYABLE:</span>
                <span className={`font-mono ${voucher.balanceAfter === 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  {formatCurrency(voucher.balanceAfter)}
                </span>
              </div>
            </div>

            {/* Words Banner */}
            <div className="text-[9px] text-slate-600 italic border-b border-dashed border-slate-300 pb-1.5">
              {wordsAmount}
            </div>

            {/* Dual Signatures */}
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

            {/* Footer */}
            <div className="pt-2 text-center text-[9px] text-slate-400 border-t border-dashed border-slate-200">
              Retain this voucher for company financial audit & accounts reconciliation.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
