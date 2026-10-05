"use client";

import React, { useState } from "react";
import { Printer, X, FileText, CheckCircle2, Building, Calendar, Hash } from "lucide-react";
import { formatCurrency, formatSLDateTime, amountToWords } from "@/lib/formatters";

export interface DepositSlipChequeData {
  chequeId?: string;
  chequeNumber: string;
  bankName: string;
  bankBranch?: string;
  drawerName: string;
  amount: number;
  chequeDate: string | Date;
}

export interface BankDepositSlipData {
  slipNumber: string;
  bankName: string;
  branchName: string;
  accountNumber: string;
  accountName: string;
  depositDate: string | Date;
  cheques: DepositSlipChequeData[];
  chequeCount: number;
  chequeTotal: number;
  cashAmount: number;
  totalDepositAmount: number;
  depositedBy: string;
  notes?: string;
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
}

interface BankDepositSlipReceiptProps {
  data: BankDepositSlipData;
  onClose: () => void;
}

export default function BankDepositSlipReceipt({ data, onClose }: BankDepositSlipReceiptProps) {
  const [printFormat, setPrintFormat] = useState<"A4" | "THERMAL_80MM">("A4");

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Controls Toolbar (Hidden in Print) */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 print:hidden shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold leading-tight">Official Bank Lodgement Slip</h2>
              <p className="text-[11px] text-slate-400 font-mono">Slip #{data.slipNumber} • {data.bankName}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Format Switcher */}
            <div className="bg-slate-800 p-1 rounded-xl flex items-center gap-1 text-xs">
              <button
                type="button"
                onClick={() => setPrintFormat("A4")}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  printFormat === "A4" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                A4 Official Slip
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat("THERMAL_80MM")}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  printFormat === "THERMAL_80MM" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                80mm Thermal
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>Print Slip</span>
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
          {/* ================= A4 FORMAT ================= */}
          {printFormat === "A4" ? (
            <div
              id="printable-deposit-slip"
              className="bg-white p-8 rounded-lg shadow-sm w-full max-w-3xl text-slate-900 border border-slate-200 print:border-none print:shadow-none print:p-0 print:m-0 print:w-full"
              style={{ minHeight: "1050px" }}
            >
              {/* Bank Header Banner */}
              <div className="border-b-2 border-slate-900 pb-4 mb-5 flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold tracking-widest text-blue-700 uppercase block mb-1">
                    CENTRAL BANK OF SRI LANKA CLEARING SYSTEM
                  </span>
                  <h1 className="text-2xl font-black tracking-tight text-slate-950 uppercase">
                    {data.bankName}
                  </h1>
                  <p className="text-xs font-semibold text-slate-600">
                    Branch: <span className="text-slate-950 font-bold">{data.branchName}</span>
                  </p>
                </div>
                <div className="text-right">
                  <div className="inline-block bg-slate-950 text-white px-3 py-1 text-xs font-black uppercase tracking-wider rounded-md mb-1.5">
                    BANK LODGEMENT / DEPOSIT SLIP
                  </div>
                  <p className="text-xs font-mono font-bold text-slate-700">Slip Ref: {data.slipNumber}</p>
                  <p className="text-xs text-slate-500">
                    Date: <span className="font-semibold text-slate-900">{new Date(data.depositDate).toLocaleDateString("en-GB")}</span>
                  </p>
                </div>
              </div>

              {/* Account Particulars Box */}
              <div className="bg-slate-50 border border-slate-300 rounded-xl p-4 mb-6 grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Credit Account Title</span>
                  <p className="text-sm font-black text-slate-900 mt-0.5 uppercase">{data.accountName}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Account Number</span>
                  <p className="text-sm font-mono font-black text-blue-900 tracking-wider mt-0.5">{data.accountNumber}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Currency / Type</span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">LKR — Sri Lankan Rupee</p>
                </div>
              </div>

              {/* Cheque Itemized Table */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    Itemized Cheques Lodged ({data.chequeCount} {data.chequeCount === 1 ? "Cheque" : "Cheques"})
                  </h3>
                  <span className="text-[11px] font-semibold text-slate-500">All cheques subject to clearance</span>
                </div>

                <table className="w-full text-left text-xs border border-slate-300 border-collapse">
                  <thead className="bg-slate-100 text-[10px] uppercase font-bold text-slate-700 border-b border-slate-300">
                    <tr>
                      <th className="p-2 border-r border-slate-300 text-center w-10">#</th>
                      <th className="p-2 border-r border-slate-300 font-mono">Cheque Number</th>
                      <th className="p-2 border-r border-slate-300">Drawee Bank & Branch</th>
                      <th className="p-2 border-r border-slate-300">Drawer / Issuer Name</th>
                      <th className="p-2 border-r border-slate-300 text-center">Cheque Date</th>
                      <th className="p-2 text-right">Amount (LKR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.cheques.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-slate-400 italic">
                          No cheques attached to this deposit slip.
                        </td>
                      </tr>
                    ) : (
                      data.cheques.map((c, idx) => (
                        <tr key={idx} className="border-b border-slate-200 even:bg-slate-50/50">
                          <td className="p-2 border-r border-slate-300 text-center font-bold text-slate-500">{idx + 1}</td>
                          <td className="p-2 border-r border-slate-300 font-mono font-bold text-slate-900">{c.chequeNumber}</td>
                          <td className="p-2 border-r border-slate-300">
                            <span className="font-semibold block">{c.bankName}</span>
                            <span className="text-[10px] text-slate-500">{c.bankBranch || "Main Branch"}</span>
                          </td>
                          <td className="p-2 border-r border-slate-300 text-slate-800">{c.drawerName}</td>
                          <td className="p-2 border-r border-slate-300 text-center font-mono text-slate-600">
                            {new Date(c.chequeDate).toLocaleDateString("en-GB")}
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-slate-950">
                            {formatCurrency(c.amount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300">
                    <tr>
                      <td colSpan={5} className="p-2 text-right uppercase text-[11px] text-slate-700">
                        Subtotal Cheques Lodged:
                      </td>
                      <td className="p-2 text-right font-mono text-sm text-slate-950">
                        {formatCurrency(data.chequeTotal)}
                      </td>
                    </tr>
                    {data.cashAmount > 0 && (
                      <tr>
                        <td colSpan={5} className="p-2 text-right uppercase text-[11px] text-slate-700">
                          Physical Cash Lodgement:
                        </td>
                        <td className="p-2 text-right font-mono text-sm text-slate-950">
                          {formatCurrency(data.cashAmount)}
                        </td>
                      </tr>
                    )}
                    <tr className="bg-slate-200 border-t border-slate-400">
                      <td colSpan={5} className="p-2.5 text-right font-black uppercase text-xs text-slate-950">
                        NET TOTAL DEPOSIT AMOUNT:
                      </td>
                      <td className="p-2.5 text-right font-mono font-black text-base text-blue-900">
                        {formatCurrency(data.totalDepositAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Amount In Words Banner */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-8">
                <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">Amount in Words</span>
                <p className="text-xs font-bold text-blue-950 italic mt-0.5">
                  {amountToWords(data.totalDepositAmount)}
                </p>
              </div>

              {/* Notes / Reference */}
              {data.notes && (
                <div className="mb-6 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                  <span className="font-bold text-slate-800">Deposit Memo / Notes:</span> {data.notes}
                </div>
              )}

              {/* Dual Signature Blocks & Bank Stamp Box */}
              <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-300 mt-12">
                <div>
                  <div className="h-16 border-b border-dashed border-slate-400 mb-2 flex items-end">
                    <span className="text-xs font-semibold text-slate-600 pb-1">
                      {data.depositedBy}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-800 block uppercase">Depositor Signature</span>
                  <span className="text-[10px] text-slate-500">Name: {data.depositedBy}</span>
                  <span className="text-[10px] text-slate-500 block">Organization: {data.storeName || "Corner Store POS Merchant"}</span>
                </div>

                <div>
                  <div className="h-16 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center text-slate-400 text-xs font-bold uppercase mb-2">
                    Bank Teller / Cashier Stamp & Signature
                  </div>
                  <span className="text-xs font-bold text-slate-800 block uppercase">Bank Official Validation</span>
                  <span className="text-[10px] text-slate-500">Date Received & Verified</span>
                </div>
              </div>

              <div className="mt-8 text-center text-[10px] text-slate-400 border-t border-slate-100 pt-3">
                Generated via Corner Store POS Sri Lanka • Centralized Bank Cheque Clearing System
              </div>
            </div>
          ) : (
            /* ================= 80MM THERMAL FORMAT ================= */
            <div
              id="printable-deposit-slip"
              className="bg-white p-4 rounded-lg shadow-sm text-slate-900 border border-slate-200 font-mono text-[11px] print:border-none print:shadow-none print:p-0 print:m-0"
              style={{ width: "320px", maxWidth: "80mm" }}
            >
              <div className="text-center border-b border-dashed border-slate-400 pb-2 mb-2">
                <h2 className="font-bold text-sm tracking-tight uppercase">{data.bankName}</h2>
                <p className="text-[10px] text-slate-600">Branch: {data.branchName}</p>
                <p className="text-xs font-black uppercase mt-1">BANK DEPOSIT SLIP</p>
                <p className="text-[10px] font-bold text-slate-700">Ref: {data.slipNumber}</p>
                <p className="text-[10px] text-slate-500">{new Date(data.depositDate).toLocaleDateString("en-GB")}</p>
              </div>

              <div className="border-b border-dashed border-slate-400 pb-2 mb-2 space-y-0.5 text-[10px]">
                <div><span className="text-slate-500">A/C Title:</span> <span className="font-bold uppercase">{data.accountName}</span></div>
                <div><span className="text-slate-500">A/C No:</span> <span className="font-bold">{data.accountNumber}</span></div>
                <div><span className="text-slate-500">Depositor:</span> {data.depositedBy}</div>
              </div>

              <div className="border-b border-dashed border-slate-400 pb-2 mb-2">
                <div className="font-bold text-[10px] uppercase mb-1">Cheques ({data.chequeCount}):</div>
                {data.cheques.map((c, i) => (
                  <div key={i} className="mb-1 text-[10px]">
                    <div className="flex justify-between">
                      <span className="font-bold">#{c.chequeNumber}</span>
                      <span className="font-bold">{formatCurrency(c.amount)}</span>
                    </div>
                    <div className="text-slate-500 text-[9px] truncate">
                      {c.bankName} • {c.drawerName}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-b border-dashed border-slate-400 pb-2 mb-2 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Cheque Total:</span>
                  <span className="font-bold">{formatCurrency(data.chequeTotal)}</span>
                </div>
                {data.cashAmount > 0 && (
                  <div className="flex justify-between">
                    <span>Cash Amount:</span>
                    <span className="font-bold">{formatCurrency(data.cashAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-sm pt-1 border-t border-slate-300">
                  <span>TOTAL:</span>
                  <span>{formatCurrency(data.totalDepositAmount)}</span>
                </div>
              </div>

              <div className="text-[9px] text-slate-600 italic mb-4">
                {amountToWords(data.totalDepositAmount)}
              </div>

              <div className="pt-4 border-t border-dashed border-slate-400 space-y-6 text-center text-[10px]">
                <div>
                  <div className="border-b border-slate-400 h-6 mx-4"></div>
                  <span className="text-slate-500">Depositor Signature</span>
                </div>
                <div>
                  <div className="border border-slate-400 h-10 mx-4 rounded-sm flex items-center justify-center text-[9px] text-slate-400 uppercase">
                    Bank Stamp
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
