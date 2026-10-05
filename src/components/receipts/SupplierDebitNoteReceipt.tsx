"use client";

import React, { useState } from "react";
import { formatCurrency, formatSLDateTime, amountToWords } from "@/lib/formatters";
import {
  Printer,
  X,
  RotateCcw,
  Building2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  User,
  Truck,
  Package,
  FileText,
} from "lucide-react";

export interface DebitNoteReceiptItem {
  productId: string;
  name: string;
  sku?: string;
  unit: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  reason: string;
  batchNumber?: string;
  expiryDate?: string | Date;
  notes?: string;
}

export interface SupplierDebitNoteData {
  _id: string;
  debitNoteNumber: string;
  supplierId: string;
  supplierName: string;
  branchName?: string;
  grnNumber?: string;
  poNumber?: string;
  status: "DRAFT" | "ISSUED" | "APPLIED" | "REJECTED" | "CANCELLED";
  settlementType: "AP_CREDIT_OFFSET" | "REPLACEMENT" | "REFUND" | "PENDING";
  items: DebitNoteReceiptItem[];
  subtotal: number;
  taxRate?: number;
  taxAmount?: number;
  netTotal: number;
  replacementReceived?: boolean;
  distributorRepName?: string;
  distributorVehicleNumber?: string;
  distributorCreditNoteNumber?: string;
  handoverDate?: string | Date;
  settledAt?: string | Date;
  settledBy?: string;
  rejectionReason?: string;
  notes?: string;
  createdBy: string;
  createdAt: string | Date;
}

export interface SupplierDebitNoteReceiptProps {
  business: {
    name: string;
    phone?: string;
    address?: string;
    taxSettings?: {
      enabled: boolean;
      vatNumber?: string;
      tinNumber?: string;
    };
  };
  supplier?: {
    phone?: string;
    email?: string;
    address?: string;
    taxNumber?: string;
  };
  debitNote: SupplierDebitNoteData;
  onClose: () => void;
}

export default function SupplierDebitNoteReceipt({
  business,
  supplier,
  debitNote,
  onClose,
}: SupplierDebitNoteReceiptProps) {
  const [printFormat, setPrintFormat] = useState<"A4" | "THERMAL">("A4");

  const handlePrint = () => {
    window.print();
  };

  const reasonLabels: Record<string, string> = {
    DAMAGED_IN_TRANSIT: "Damaged in Transit",
    EXPIRED: "Expired Stock",
    NEAR_EXPIRY: "Near Expiry Return",
    FACTORY_DEFECT: "Factory / Quality Defect",
    WRONG_ITEM: "Wrong / Mismatched Item",
    DOCK_REJECTED: "Dock Inspection Rejected",
    QUALITY_ISSUE: "Quality Issue",
    OTHER: "Other Return",
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 my-8 max-h-[92vh] overflow-y-auto print:max-h-none print:max-w-none print:w-full print:border-none print:p-0 print:shadow-none print:my-0">
        {/* Controls - Hidden during print */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Print Supplier Debit Note</h3>
              <p className="text-[11px] text-slate-500 font-mono">{debitNote.debitNoteNumber}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPrintFormat("A4")}
                className={`px-3 py-1 rounded-lg transition ${
                  printFormat === "A4" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                A4 Debit Advice
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat("THERMAL")}
                className={`px-3 py-1 rounded-lg transition ${
                  printFormat === "THERMAL"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                80mm Gate Pass
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>Print Slip</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ================= FORMAT 1: A4 FORMAL DEBIT NOTE ================= */}
        {printFormat === "A4" && (
          <div className="p-4 sm:p-6 text-slate-800 space-y-6 print:p-0">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b-2 border-slate-900">
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {business.name}
                </h1>
                {business.address && (
                  <p className="text-xs text-slate-600 mt-0.5 max-w-sm whitespace-pre-line">
                    {business.address}
                  </p>
                )}
                {business.phone && (
                  <p className="text-xs text-slate-600 font-mono mt-0.5">Tel: {business.phone}</p>
                )}
                {business.taxSettings?.vatNumber && (
                  <p className="text-[11px] font-mono text-slate-500">
                    VAT Reg: {business.taxSettings.vatNumber}
                    {business.taxSettings.tinNumber ? ` | TIN: ${business.taxSettings.tinNumber}` : ""}
                  </p>
                )}
              </div>

              <div className="text-left sm:text-right">
                <span className="inline-block px-3 py-1 bg-rose-100 text-rose-900 font-black text-xs uppercase tracking-wider rounded-md mb-1.5">
                  Supplier Debit Note / RTV
                </span>
                <div className="text-base sm:text-lg font-black font-mono text-slate-900">
                  {debitNote.debitNoteNumber}
                </div>
                <div className="text-xs text-slate-600 mt-0.5 font-mono">
                  Date: {formatSLDateTime(debitNote.createdAt)}
                </div>
                <div className="text-xs font-bold text-slate-700 mt-1">
                  Status: <span className="uppercase">{debitNote.status}</span>
                </div>
              </div>
            </div>

            {/* Recipient & Reference Meta Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Debited Supplier / Distributor
                </span>
                <div className="font-bold text-slate-900 text-sm">{debitNote.supplierName}</div>
                {supplier?.address && <div className="text-slate-600">{supplier.address}</div>}
                {supplier?.phone && (
                  <div className="text-slate-600 font-mono">Phone: {supplier.phone}</div>
                )}
                {supplier?.taxNumber && (
                  <div className="text-slate-500 font-mono text-[11px]">
                    Vendor Tax No: {supplier.taxNumber}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Logistics & Settlement Details
                </span>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-700">
                  <span className="text-slate-500">Facility / Branch:</span>
                  <span className="font-semibold text-slate-900">
                    {debitNote.branchName || "Main Central Warehouse"}
                  </span>

                  <span className="text-slate-500">Settlement Type:</span>
                  <span className="font-semibold text-rose-800 uppercase">
                    {debitNote.settlementType.replace(/_/g, " ")}
                  </span>

                  {debitNote.distributorRepName && (
                    <>
                      <span className="text-slate-500">Distributor Rep:</span>
                      <span className="font-semibold text-slate-900">{debitNote.distributorRepName}</span>
                    </>
                  )}

                  {debitNote.distributorVehicleNumber && (
                    <>
                      <span className="text-slate-500">Van / Lorry Reg:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {debitNote.distributorVehicleNumber}
                      </span>
                    </>
                  )}

                  {debitNote.poNumber && (
                    <>
                      <span className="text-slate-500">Ref PO Number:</span>
                      <span className="font-mono font-semibold text-slate-800">{debitNote.poNumber}</span>
                    </>
                  )}

                  {debitNote.grnNumber && (
                    <>
                      <span className="text-slate-500">Dock GRN Ref:</span>
                      <span className="font-mono font-semibold text-slate-800">{debitNote.grnNumber}</span>
                    </>
                  )}

                  {debitNote.distributorCreditNoteNumber && (
                    <>
                      <span className="text-slate-500">Distributor CN #:</span>
                      <span className="font-mono font-bold text-emerald-700">
                        {debitNote.distributorCreditNoteNumber}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="overflow-hidden border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Item Description</th>
                    <th className="py-2.5 px-3">Reason for Return</th>
                    <th className="py-2.5 px-3 text-center">Batch / Expiry</th>
                    <th className="py-2.5 px-3 text-right">Qty</th>
                    <th className="py-2.5 px-3 text-right">Unit Cost</th>
                    <th className="py-2.5 px-3 text-right">Total (LKR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs">
                  {debitNote.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 text-slate-400 font-sans">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-sans">
                        <div className="font-bold text-slate-900">{item.name}</div>
                        {item.sku && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            SKU: {item.sku}
                          </span>
                        )}
                        {item.notes && (
                          <div className="text-[10px] text-slate-500 italic mt-0.5">{item.notes}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-bold">
                          {reasonLabels[item.reason] || item.reason}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-600 text-[11px]">
                        <div>{item.batchNumber || "—"}</div>
                        {item.expiryDate && (
                          <div className="text-[10px] text-slate-400">
                            Exp: {new Date(item.expiryDate).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-700">
                        {formatCurrency(item.unitCost)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                        {formatCurrency(item.totalCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200 text-xs font-sans">
                  <tr>
                    <td colSpan={6} className="py-2 px-3 text-right font-bold text-slate-600 uppercase">
                      Subtotal:
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(debitNote.subtotal)}
                    </td>
                  </tr>
                  {(debitNote.taxAmount || 0) > 0 && (
                    <tr>
                      <td colSpan={6} className="py-1.5 px-3 text-right text-slate-600 font-semibold">
                        VAT ({debitNote.taxRate}%):
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(debitNote.taxAmount)}
                      </td>
                    </tr>
                  )}
                  <tr className="border-t-2 border-slate-900 bg-rose-50/70">
                    <td colSpan={6} className="py-3 px-3 text-right font-black text-rose-950 uppercase text-xs">
                      Total Debit Note Amount Claimed:
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-rose-900 text-base">
                      {formatCurrency(debitNote.netTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Amount in Words */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Official Amount in English Words
              </span>
              <p className="font-semibold text-slate-900 italic">
                {amountToWords(debitNote.netTotal)}
              </p>
            </div>

            {debitNote.notes && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                <span className="font-bold">Instructions & Notes: </span>
                <span>{debitNote.notes}</span>
              </div>
            )}

            {/* Authorization & Handover Signatures */}
            <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-200 text-xs">
              <div className="space-y-4">
                <div className="h-12 border-b border-dashed border-slate-400"></div>
                <div>
                  <p className="font-bold text-slate-900">Store Dispatcher / Authorized Officer</p>
                  <p className="text-[11px] text-slate-500">Goods dispatched from warehouse/store inventory</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Prepared by: {debitNote.createdBy} &bull; Date: _________________
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="h-12 border-b border-dashed border-slate-400"></div>
                <div>
                  <p className="font-bold text-slate-900">Distributor Representative / Van Driver</p>
                  <p className="text-[11px] text-slate-500">
                    Acknowledged & received return stock in good condition
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Name: {debitNote.distributorRepName || "_________________"} &bull; NIC: _________________
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= FORMAT 2: 80MM THERMAL GATE PASS ================= */}
        {printFormat === "THERMAL" && (
          <div className="max-w-[320px] mx-auto p-4 bg-white text-slate-900 font-mono text-xs space-y-3 border border-slate-200 rounded-xl print:border-none print:p-0">
            <div className="text-center space-y-0.5 border-b border-dashed border-slate-400 pb-2">
              <h2 className="font-black text-sm uppercase">{business.name}</h2>
              {business.address && <p className="text-[10px] text-slate-600">{business.address}</p>}
              {business.phone && <p className="text-[10px]">Tel: {business.phone}</p>}
              <div className="pt-1 font-bold text-xs uppercase tracking-wider">
                *** RETURN GATE PASS ***
              </div>
            </div>

            <div className="space-y-0.5 text-[11px] border-b border-dashed border-slate-400 pb-2">
              <div className="flex justify-between">
                <span>DN Ref:</span>
                <span className="font-bold">{debitNote.debitNoteNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{new Date(debitNote.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Supplier:</span>
                <span className="font-bold truncate max-w-[170px]">{debitNote.supplierName}</span>
              </div>
              {debitNote.distributorVehicleNumber && (
                <div className="flex justify-between">
                  <span>Van #:</span>
                  <span className="font-bold">{debitNote.distributorVehicleNumber}</span>
                </div>
              )}
              {debitNote.distributorRepName && (
                <div className="flex justify-between">
                  <span>Rep:</span>
                  <span>{debitNote.distributorRepName}</span>
                </div>
              )}
            </div>

            {/* Items */}
            <div className="space-y-1.5 border-b border-dashed border-slate-400 pb-2">
              <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                <span>Item & Reason</span>
                <span>Qty x Rate = Total</span>
              </div>
              {debitNote.items.map((item, idx) => (
                <div key={idx} className="text-[11px]">
                  <div className="font-bold truncate">{item.name}</div>
                  <div className="text-[10px] text-slate-500">[{reasonLabels[item.reason] || item.reason}]</div>
                  <div className="flex justify-between text-[10px] text-slate-700">
                    <span>
                      {item.quantity} {item.unit} @ {formatCurrency(item.unitCost)}
                    </span>
                    <span className="font-bold">{formatCurrency(item.totalCost)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="space-y-1 border-b border-dashed border-slate-400 pb-2">
              <div className="flex justify-between font-bold text-sm">
                <span>NET DEBIT:</span>
                <span>{formatCurrency(debitNote.netTotal)}</span>
              </div>
              <div className="text-[10px] text-slate-500 italic">
                {amountToWords(debitNote.netTotal)}
              </div>
            </div>

            {/* Signatures */}
            <div className="pt-2 space-y-4 text-[10px]">
              <div className="flex justify-between pt-4 border-t border-dashed border-slate-300">
                <span>Store Officer: ________</span>
                <span>Driver: ________</span>
              </div>
              <div className="text-center text-[9px] text-slate-400">
                Retain this slip for distributor credit reconciliation.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
