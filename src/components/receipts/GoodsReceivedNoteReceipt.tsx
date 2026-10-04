"use client";

import React from "react";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";
import {
  Printer,
  X,
  FileCheck,
  Building2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  User,
  Truck,
  Package,
} from "lucide-react";

export interface GrnReceiptItem {
  productId: string;
  name: string;
  sku?: string;
  unit: string;
  orderedQuantity: number;
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  rejectionReason?: string;
  rejectionNotes?: string;
  unitCost: number;
  acceptedTotalCost: number;
  rejectedTotalCost: number;
  batchNumber?: string;
  manufacturingDate?: string | Date;
  expiryDate?: string | Date;
  mrp?: number;
  sellingPrice?: number;
  qcInspectionNotes?: string;
}

export interface GoodsReceivedNoteData {
  _id: string;
  grnNumber: string;
  poNumber: string;
  supplierName: string;
  supplierInvoiceNumber?: string;
  supplierInvoiceDate?: string | Date;
  branchName?: string;
  status: "DRAFT" | "CONFIRMED" | "CANCELLED";
  inspectionStatus: "PENDING_INSPECTION" | "PASSED" | "PARTIALLY_ACCEPTED" | "REJECTED";
  items: GrnReceiptItem[];
  totalOrderedCost: number;
  totalAcceptedCost: number;
  totalRejectedCost: number;
  notes?: string;
  receivedBy: string;
  inspectedBy?: string;
  confirmedBy?: string;
  confirmedAt?: string | Date;
  putawayStatus?: "PENDING" | "PARTIAL" | "COMPLETED";
  createdAt: string | Date;
}


export interface GoodsReceivedNoteReceiptProps {
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
  grn: GoodsReceivedNoteData;
  onClose?: () => void;
}

export default function GoodsReceivedNoteReceipt({
  business,
  grn,
  onClose,
}: GoodsReceivedNoteReceiptProps) {
  const handlePrint = () => {
    window.print();
  };

  const getInspectionBadge = (status: string) => {
    switch (status) {
      case "PASSED":
        return {
          label: "100% PASSED & ACCEPTED",
          classes: "bg-emerald-100 text-emerald-800 border-emerald-300",
          icon: CheckCircle2,
        };
      case "PARTIALLY_ACCEPTED":
        return {
          label: "PARTIALLY ACCEPTED (VARIANCE DETECTED)",
          classes: "bg-amber-100 text-amber-800 border-amber-300",
          icon: AlertTriangle,
        };
      case "REJECTED":
        return {
          label: "REJECTED AT DOCK",
          classes: "bg-red-100 text-red-800 border-red-300",
          icon: AlertTriangle,
        };
      default:
        return {
          label: "PENDING INSPECTION",
          classes: "bg-blue-100 text-blue-800 border-blue-300",
          icon: FileCheck,
        };
    }
  };

  const badge = getInspectionBadge(grn.inspectionStatus);
  const BadgeIcon = badge.icon;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-6 my-8 print:p-0 print:border-none print:shadow-none print:max-w-none print:m-0 print:w-full text-slate-800">
        {/* Top Controls - Hidden on Print */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm">Goods Received Note (GRN)</h3>
              <p className="text-[11px] text-slate-500 font-mono">
                {grn.grnNumber} • Linked PO: {grn.poNumber}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <Printer className="w-4 h-4" />
              <span>Print Official GRN Slip</span>
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Printable Document Container */}
        <div className="space-y-6 p-2">
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b-2 border-slate-900 pb-5">
            <div>
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                {business.name || "Sri Lanka Commercial Store"}
              </h1>
              {business.address && (
                <p className="text-xs text-slate-600 mt-0.5">{business.address}</p>
              )}
              {business.phone && (
                <p className="text-xs text-slate-600">Tel: {business.phone}</p>
              )}
              {business.taxSettings?.tinNumber && (
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  TIN: {business.taxSettings.tinNumber}{" "}
                  {business.taxSettings?.vatNumber && `| VAT: ${business.taxSettings.vatNumber}`}
                </p>
              )}
            </div>

            <div className="sm:text-right">
              <div className="text-base font-black tracking-wide text-slate-900">
                GOODS RECEIVED NOTE (GRN)
              </div>
              <div className="text-xs font-mono font-bold text-slate-800 mt-0.5">
                NO: {grn.grnNumber}
              </div>
              <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-black border uppercase tracking-wider">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border ${badge.classes}`}>
                  <BadgeIcon className="w-3.5 h-3.5" />
                  {badge.label}
                </span>
              </div>
            </div>
          </div>

          {/* Reference Meta Info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Purchase Order</span>
              <span className="font-mono font-bold text-slate-900">{grn.poNumber}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Supplier / Vendor</span>
              <span className="font-bold text-slate-900">{grn.supplierName}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Supplier Invoice / DC</span>
              <span className="font-mono font-bold text-slate-900">
                {grn.supplierInvoiceNumber || "N/A"}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Receiving Dock / Branch</span>
              <span className="font-semibold text-slate-800">
                {grn.branchName || "Main Central Warehouse"}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Receipt Date</span>
              <span className="font-medium text-slate-800">
                {formatSLDateTime(grn.createdAt)}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Receiving Officer</span>
              <span className="font-medium text-slate-800">{grn.receivedBy}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">QC Inspector</span>
              <span className="font-medium text-slate-800">{grn.inspectedBy || grn.receivedBy}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Confirmation Status</span>
              <span
                className={`font-bold uppercase text-[11px] ${
                  grn.status === "CONFIRMED" ? "text-emerald-700" : "text-amber-700"
                }`}
              >
                {grn.status}
              </span>
            </div>
          </div>

          {/* Itemized Quality Inspection Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-2.5 text-center w-8">#</th>
                  <th className="p-2.5">Item Description & Tracking</th>
                  <th className="p-2.5 text-center">Ordered</th>
                  <th className="p-2.5 text-center">Received</th>
                  <th className="p-2.5 text-center text-emerald-800">Accepted</th>
                  <th className="p-2.5 text-center text-red-800">Rejected</th>
                  <th className="p-2.5 text-right">Unit Cost</th>
                  <th className="p-2.5 text-right">Net Payable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {grn.items.map((item, index) => {
                  const hasDiscrepancy = item.rejectedQuantity > 0 || item.receivedQuantity < item.orderedQuantity;
                  return (
                    <tr
                      key={index}
                      className={hasDiscrepancy ? "bg-amber-50/40" : "hover:bg-slate-50/60"}
                    >
                      <td className="p-2.5 text-center text-slate-400 font-mono">{index + 1}</td>
                      <td className="p-2.5">
                        <div className="font-bold text-slate-900">{item.name}</div>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                          {item.sku && <span className="font-mono">SKU: {item.sku}</span>}
                          {item.batchNumber && (
                            <span className="font-mono bg-slate-100 px-1.5 py-0.2 rounded text-slate-700">
                              Lot: {item.batchNumber}
                            </span>
                          )}
                          {item.expiryDate && (
                            <span className="text-amber-700 font-semibold">
                              Exp: {new Date(item.expiryDate).toLocaleDateString()}
                            </span>
                          )}
                          {item.mrp && (
                            <span className="text-slate-600">
                              MRP: Rs. {item.mrp.toLocaleString()}
                            </span>
                          )}
                        </div>
                        {item.rejectedQuantity > 0 && item.rejectionReason && (
                          <div className="mt-1 text-[10px] text-red-600 font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-red-500" />
                            <span>
                              Rejected: {item.rejectionReason.replace(/_/g, " ")}
                              {item.rejectionNotes ? ` (${item.rejectionNotes})` : ""}
                            </span>
                          </div>
                        )}
                        {item.qcInspectionNotes && (
                          <div className="mt-0.5 text-[10px] text-slate-500 italic">
                            QC Note: {item.qcInspectionNotes}
                          </div>
                        )}
                      </td>
                      <td className="p-2.5 text-center font-mono">
                        {item.orderedQuantity} {item.unit}
                      </td>
                      <td className="p-2.5 text-center font-mono font-semibold text-slate-800">
                        {item.receivedQuantity} {item.unit}
                      </td>
                      <td className="p-2.5 text-center font-mono font-bold text-emerald-700">
                        {item.acceptedQuantity} {item.unit}
                      </td>
                      <td className="p-2.5 text-center font-mono font-bold text-red-600">
                        {item.rejectedQuantity > 0 ? `${item.rejectedQuantity} ${item.unit}` : "-"}
                      </td>
                      <td className="p-2.5 text-right font-mono">
                        {formatCurrency(item.unitCost)}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(item.acceptedTotalCost)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Reconciliation & Totals Box */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs space-y-2">
              <span className="font-bold text-slate-900 text-xs block">Quality & Dock Observation</span>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                {grn.notes ||
                  "Goods checked for transit tampering, outer seal integrity, temperature excursions, and manufacturer shelf-life criteria. Accepted items transferred to active stock."}
              </p>
              <div className="pt-2 text-[10px] text-slate-500 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Verified against Sri Lanka POS Goods Inward Protocol.</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs space-y-2">
              <div className="flex justify-between items-center text-slate-600">
                <span>Total PO Ordered Value:</span>
                <span className="font-mono font-semibold">{formatCurrency(grn.totalOrderedCost)}</span>
              </div>
              <div className="flex justify-between items-center text-red-700">
                <span>Total Rejected / Deducted:</span>
                <span className="font-mono font-bold">
                  - {formatCurrency(grn.totalRejectedCost)}
                </span>
              </div>
              <div className="border-t border-slate-300 pt-2 flex justify-between items-center text-sm font-black text-slate-900">
                <span>Net Accepted (Vendor AP):</span>
                <span className="font-mono text-emerald-700">
                  {formatCurrency(grn.totalAcceptedCost)}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 text-right">
                * Credited directly to {grn.supplierName}&apos;s Accounts Payable balance.
              </p>
            </div>
          </div>

          {/* Official Signatures Footer */}
          <div className="border-t-2 border-slate-200 pt-8 mt-6">
            <div className="grid grid-cols-3 gap-6 text-center text-xs">
              <div className="space-y-12">
                <div className="border-b border-dashed border-slate-400 pb-1 font-semibold text-slate-800">
                  {grn.receivedBy || "Receiving Officer"}
                </div>
                <div className="text-[10px] uppercase font-bold text-slate-500">
                  Dock Receiving Officer
                </div>
              </div>

              <div className="space-y-12">
                <div className="border-b border-dashed border-slate-400 pb-1 font-semibold text-slate-800">
                  {grn.inspectedBy || grn.confirmedBy || "Store Manager"}
                </div>
                <div className="text-[10px] uppercase font-bold text-slate-500">
                  QC / Store Manager Approved
                </div>
              </div>

              <div className="space-y-12">
                <div className="border-b border-dashed border-slate-400 pb-1 text-slate-400">
                  &nbsp;
                </div>
                <div className="text-[10px] uppercase font-bold text-slate-500">
                  Supplier Driver / Transporter
                </div>
              </div>
            </div>
          </div>

          {/* Trilingual Footer Stamp */}
          <div className="text-center pt-2 text-[10px] text-slate-400 border-t border-slate-100">
            Official Commercial Goods Received Note • භාණ්ඩ ලැබීමේ සටහන • பொருட்கள் பெறப்பட்ட குறிப்பு
          </div>
        </div>
      </div>
    </div>
  );
}
