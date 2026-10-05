"use client";

import React from "react";
import { Printer, X, AlertTriangle, Building, Phone, Mail, FileWarning } from "lucide-react";
import { formatCurrency, formatSLDateTime, amountToWords } from "@/lib/formatters";

export interface ChequeReturnNoticeData {
  noticeNumber: string;
  noticeDate: string | Date;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  chequeNumber: string;
  bankName: string;
  bankBranch: string;
  drawerName: string;
  chequeDate: string | Date;
  amount: number;
  reasonCode?: string;
  reasonText: string;
  penaltyFee: number;
  totalReDebited: number;
  newCustomerBalance?: number;
  bankStatementRef?: string;
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  storeEmail?: string;
  settlementBankAccount?: {
    bankName: string;
    branchName: string;
    accountNumber: string;
    accountName: string;
  };
  authorizedSignatory?: string;
}

interface ChequeReturnNoticeProps {
  data: ChequeReturnNoticeData;
  onClose: () => void;
}

export default function ChequeReturnNotice({ data, onClose }: ChequeReturnNoticeProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Controls Toolbar (Hidden in Print) */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 print:hidden shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-600 flex items-center justify-center text-white">
              <FileWarning className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold leading-tight">Dishonored Cheque Debit Advice</h2>
              <p className="text-[11px] text-slate-400 font-mono">Notice #{data.noticeNumber} • Cheque #{data.chequeNumber}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>Print Debit Advice</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Container */}
        <div className="p-6 overflow-y-auto bg-slate-100 flex justify-center flex-1">
          <div
            id="printable-return-notice"
            className="bg-white p-10 rounded-lg shadow-sm w-full max-w-2xl text-slate-900 border border-slate-200 print:border-none print:shadow-none print:p-0 print:m-0 print:w-full"
            style={{ minHeight: "1000px" }}
          >
            {/* Store Letterhead */}
            <div className="border-b-2 border-slate-900 pb-5 mb-6 flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-950 uppercase">
                  {data.storeName}
                </h1>
                {data.storeAddress && (
                  <p className="text-xs text-slate-600 mt-0.5">{data.storeAddress}</p>
                )}
                <div className="flex items-center gap-3 text-xs text-slate-600 mt-1">
                  {data.storePhone && <span>Tel: {data.storePhone}</span>}
                  {data.storeEmail && <span>Email: {data.storeEmail}</span>}
                </div>
              </div>
              <div className="text-right">
                <span className="inline-block bg-rose-100 border border-rose-300 text-rose-800 text-[11px] font-black uppercase px-2.5 py-1 rounded-md mb-1.5">
                  DEBIT ADVICE
                </span>
                <p className="text-xs font-mono font-bold text-slate-700">Ref: {data.noticeNumber}</p>
                <p className="text-xs text-slate-500">
                  Date: <span className="font-semibold text-slate-900">{new Date(data.noticeDate).toLocaleDateString("en-GB")}</span>
                </p>
              </div>
            </div>

            {/* Customer Addressee Block */}
            <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">TO (CUSTOMER / DRAWER):</span>
              <h2 className="text-sm font-black text-slate-900 uppercase">{data.customerName}</h2>
              {data.customerAddress && (
                <p className="text-xs text-slate-600">{data.customerAddress}</p>
              )}
              {data.customerPhone && (
                <p className="text-xs text-slate-600 font-mono mt-0.5">Phone: {data.customerPhone}</p>
              )}
            </div>

            {/* Formal Notice Title */}
            <div className="mb-6 text-center border-y border-rose-200 bg-rose-50/60 py-3">
              <h3 className="text-sm font-black text-rose-900 uppercase tracking-wide">
                NOTICE OF DISHONORED CHEQUE & ACCOUNT RE-DEBIT
              </h3>
            </div>

            {/* Letter Body Intro */}
            <p className="text-xs text-slate-700 leading-relaxed mb-4">
              Dear Sir / Madam,
            </p>
            <p className="text-xs text-slate-700 leading-relaxed mb-5">
              Please be informed that the bank cheque detailed below, which was tendered in settlement of your purchases/credit account, has been returned unpaid by the clearing bank. Consequently, your customer credit account has been re-debited with the full cheque value plus the standard bank administrative return fee.
            </p>

            {/* Cheque Specification Table */}
            <div className="mb-6 border border-slate-300 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <tbody>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <td className="p-2.5 font-bold text-slate-700 w-1/3 border-r border-slate-200">Cheque Number:</td>
                    <td className="p-2.5 font-mono font-bold text-slate-900">{data.chequeNumber}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="p-2.5 font-bold text-slate-700 border-r border-slate-200">Drawee Bank & Branch:</td>
                    <td className="p-2.5 text-slate-900">{data.bankName} — {data.bankBranch}</td>
                  </tr>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <td className="p-2.5 font-bold text-slate-700 border-r border-slate-200">Drawer / Issuer:</td>
                    <td className="p-2.5 text-slate-900">{data.drawerName}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="p-2.5 font-bold text-slate-700 border-r border-slate-200">Cheque Face Date:</td>
                    <td className="p-2.5 font-mono text-slate-900">{new Date(data.chequeDate).toLocaleDateString("en-GB")}</td>
                  </tr>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <td className="p-2.5 font-bold text-rose-800 border-r border-slate-200">Return / Dishonor Reason:</td>
                    <td className="p-2.5 font-bold text-rose-700">
                      {data.reasonCode ? `[Code ${data.reasonCode}] ` : ""}{data.reasonText}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Financial Re-Debit Statement */}
            <div className="mb-6 p-4 bg-slate-50 border border-slate-300 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-700">
                <span>Original Cheque Face Amount:</span>
                <span className="font-mono font-bold text-slate-900">{formatCurrency(data.amount)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-700">
                <span>Bank Administrative Return / Bounce Fee:</span>
                <span className="font-mono font-bold text-rose-700">+{formatCurrency(data.penaltyFee)}</span>
              </div>
              <div className="border-t border-slate-300 pt-2 flex justify-between items-center font-black text-sm text-slate-950">
                <span>TOTAL RE-DEBITED TO YOUR ACCOUNT:</span>
                <span className="font-mono text-rose-700">{formatCurrency(data.totalReDebited)}</span>
              </div>
              {data.newCustomerBalance !== undefined && (
                <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-xs text-slate-600">
                  <span>Current Outstanding Credit Balance:</span>
                  <span className="font-mono font-bold text-slate-900">{formatCurrency(data.newCustomerBalance)}</span>
                </div>
              )}
            </div>

            {/* Amount In Words */}
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl mb-6 text-xs">
              <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">Total Re-Debit in Words:</span>
              <p className="font-bold text-rose-950 italic mt-0.5">{amountToWords(data.totalReDebited)}</p>
            </div>

            {/* Settlement Instructions */}
            <div className="mb-8 p-4 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-slate-800">
              <h4 className="font-bold text-blue-900 uppercase text-[11px] mb-1.5 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-blue-700" />
                Urgent Settlement Notice
              </h4>
              <p className="leading-relaxed mb-2">
                Kindly arrange for the immediate settlement of this amount in cash or electronic bank transfer within <strong>3 working days</strong> to avoid suspension of credit facilities.
              </p>
              {data.settlementBankAccount && (
                <div className="mt-2 pt-2 border-t border-blue-200 text-[11px] space-y-0.5 font-mono">
                  <div><strong>Bank:</strong> {data.settlementBankAccount.bankName}</div>
                  <div><strong>Account Title:</strong> {data.settlementBankAccount.accountName}</div>
                  <div><strong>Account Number:</strong> {data.settlementBankAccount.accountNumber}</div>
                  <div><strong>Branch:</strong> {data.settlementBankAccount.branchName}</div>
                </div>
              )}
            </div>

            {/* Sign-Off Block */}
            <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-300 mt-10">
              <div>
                <p className="text-xs text-slate-500 mb-8">Yours faithfully,</p>
                <div className="border-b border-slate-400 w-48 mb-1"></div>
                <span className="text-xs font-bold text-slate-900 block">{data.authorizedSignatory || "Finance / Credit Controller"}</span>
                <span className="text-[10px] text-slate-500">{data.storeName}</span>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-8">Customer Acknowledgement:</p>
                <div className="border-b border-dashed border-slate-400 w-48 mb-1"></div>
                <span className="text-xs font-bold text-slate-700 block">Received Cheque / Advice</span>
                <span className="text-[10px] text-slate-400">Signature & Date</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
