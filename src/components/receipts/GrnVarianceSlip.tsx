"use client";

import React, { useState } from "react";
import QRCodeImage from "@/components/common/QRCodeImage";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";
import {
  Printer,
  CheckCircle2,
  AlertTriangle,
  Package,
  Building2,
  Calendar,
  Layers,
  FileCheck,
  User,
  Truck,
  ShieldCheck,
} from "lucide-react";

export interface GrnVarianceItem {
  productId: string;
  name: string;
  sku?: string;
  barcode?: string;
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
}

export interface GrnVarianceSlipData {
  grnNumber: string;
  poNumber: string;
  storeName: string;
  storePhone?: string;
  storeAddress?: string;
  supplierName: string;
  supplierPhone?: string;
  supplierInvoiceNumber?: string;
  supplierInvoiceDate?: string | Date;
  branchName?: string;
  status: "DRAFT" | "CONFIRMED" | "CANCELLED";
  inspectionStatus: "PASSED" | "PARTIALLY_ACCEPTED" | "REJECTED";
  receivedBy: string;
  receivedAt: string | Date;
  items: GrnVarianceItem[];
  totalOrderedCost: number;
  totalAcceptedCost: number;
  totalRejectedCost: number;
  notes?: string;
}

export default function GrnVarianceSlip({
  data,
  onPrint,
}: {
  data: GrnVarianceSlipData;
  onPrint?: () => void;
}) {
  const [formatMode, setFormatMode] = useState<"A4" | "THERMAL">("A4");

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  const totalOrderedUnits = data.items.reduce((acc, it) => acc + it.orderedQuantity, 0);
  const totalReceivedUnits = data.items.reduce((acc, it) => acc + it.receivedQuantity, 0);
  const totalAcceptedUnits = data.items.reduce((acc, it) => acc + it.acceptedQuantity, 0);
  const totalRejectedUnits = data.items.reduce((acc, it) => acc + it.rejectedQuantity, 0);

  const shortDeliveredCount = data.items.filter((it) => it.acceptedQuantity < it.orderedQuantity).length;
  const excessDeliveredCount = data.items.filter((it) => it.acceptedQuantity > it.orderedQuantity).length;
  const rejectedCount = data.items.filter((it) => it.rejectedQuantity > 0).length;

  return (
    <div
      className={`bg-white mx-auto text-slate-800 font-sans print:p-0 print:border-none print:shadow-none print:max-w-none ${
        formatMode === "A4"
          ? "p-8 max-w-4xl border border-slate-200 rounded-2xl shadow-sm"
          : "p-4 max-w-[340px] border border-slate-300 rounded-lg text-xs"
      }`}
    >
      {/* Top action bar - Hidden during print */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 print:hidden">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <FileCheck className="w-4 h-4 text-emerald-600" />
            <span>Goods Received Note (GRN) & Variance Manifest</span>
          </h2>
          <p className="text-xs text-slate-500">GRN #{data.grnNumber}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-slate-100 p-0.5 rounded-lg flex text-xs font-semibold">
            <button
              type="button"
              onClick={() => setFormatMode("A4")}
              className={`px-2.5 py-1 rounded-md transition ${
                formatMode === "A4" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              A4 Manifest
            </button>
            <button
              type="button"
              onClick={() => setFormatMode("THERMAL")}
              className={`px-2.5 py-1 rounded-md transition ${
                formatMode === "THERMAL" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              80mm Thermal
            </button>
          </div>
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>Print GRN Slip</span>
          </button>
        </div>
      </div>

      {/* Manifest Printable Content */}
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b-2 border-slate-900">
          <div>
            <h1
              className={`font-black text-slate-900 tracking-tight uppercase ${
                formatMode === "A4" ? "text-2xl" : "text-base text-center"
              }`}
            >
              {data.storeName}
            </h1>
            {data.storeAddress && (
              <p
                className={`text-slate-600 mt-0.5 ${
                  formatMode === "A4" ? "text-xs" : "text-[10px] text-center"
                }`}
              >
                {data.storeAddress}
              </p>
            )}
            {data.storePhone && (
              <p
                className={`text-slate-600 ${
                  formatMode === "A4" ? "text-xs" : "text-[10px] text-center"
                }`}
              >
                Tel: {data.storePhone}
              </p>
            )}
            <div className={`mt-2 ${formatMode === "THERMAL" ? "text-center" : ""}`}>
              <span className="inline-block px-2.5 py-1 bg-emerald-800 text-white text-[11px] font-black rounded uppercase tracking-wider">
                OFFICIAL GOODS RECEIVED NOTE (GRN) & INTAKE MANIFEST
              </span>
            </div>
          </div>

          <div
            className={`flex flex-col sm:items-end ${
              formatMode === "THERMAL" ? "items-center text-center mt-2" : ""
            }`}
          >
            <div className="text-right">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                GRN Number
              </span>
              <div className="font-mono font-black text-slate-900 text-base">{data.grnNumber}</div>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                  data.inspectionStatus === "PASSED"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                    : data.inspectionStatus === "PARTIALLY_ACCEPTED"
                    ? "bg-amber-50 text-amber-800 border-amber-300"
                    : "bg-rose-50 text-rose-800 border-rose-300"
                }`}
              >
                {data.inspectionStatus === "PASSED"
                  ? "QC Passed (100% Accepted)"
                  : data.inspectionStatus === "PARTIALLY_ACCEPTED"
                  ? "Partially Accepted (Variance Detected)"
                  : "Rejected"}
              </span>
            </div>
          </div>
        </div>

        {/* PO & Supplier Details */}
        <div
          className={`grid gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 ${
            formatMode === "A4" ? "grid-cols-4 text-xs" : "grid-cols-2 text-[11px]"
          }`}
        >
          <div>
            <span className="text-slate-400 font-semibold uppercase text-[9px] block">Supplier</span>
            <span className="font-bold text-slate-900">{data.supplierName}</span>
            {data.supplierPhone && (
              <span className="text-slate-500 text-[10px] block">{data.supplierPhone}</span>
            )}
          </div>
          <div>
            <span className="text-slate-400 font-semibold uppercase text-[9px] block">Purchase Order</span>
            <span className="font-mono font-bold text-slate-900">{data.poNumber}</span>
            {data.branchName && (
              <span className="text-slate-500 text-[10px] block">Dock: {data.branchName}</span>
            )}
          </div>
          <div>
            <span className="text-slate-400 font-semibold uppercase text-[9px] block">Supplier Invoice</span>
            <span className="font-bold text-slate-900">
              {data.supplierInvoiceNumber || "N/A"}
            </span>
            {data.supplierInvoiceDate && (
              <span className="text-slate-500 text-[10px] block">
                Date: {formatSLDateTime(data.supplierInvoiceDate)}
              </span>
            )}
          </div>
          <div>
            <span className="text-slate-400 font-semibold uppercase text-[9px] block">Received By</span>
            <span className="font-bold text-slate-900">{data.receivedBy}</span>
            <span className="text-slate-500 text-[10px] block">{formatSLDateTime(data.receivedAt)}</span>
          </div>
        </div>

        {/* Line Items & Variance Table */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span>Received Items & Discrepancy Breakdown</span>
            </h3>
            <span className="text-[11px] text-slate-500">{data.items.length} Product SKUs</span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[10px] uppercase">
                <tr>
                  <th className="py-2 px-2.5">#</th>
                  <th className="py-2 px-2">Product Description</th>
                  <th className="py-2 px-2 text-right">Ordered</th>
                  <th className="py-2 px-2 text-right">Received</th>
                  <th className="py-2 px-2 text-right">Accepted</th>
                  <th className="py-2 px-2 text-right">Rejected</th>
                  <th className="py-2 px-2 text-right">Unit Cost</th>
                  <th className="py-2 px-2 text-right">Accepted Value</th>
                  <th className="py-2 px-2 text-right">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px]">
                {data.items.map((it, idx) => {
                  const variance = it.acceptedQuantity - it.orderedQuantity;
                  const isUnder = variance < 0;
                  const isOver = variance > 0;
                  const hasDamage = it.rejectedQuantity > 0;

                  return (
                    <tr
                      key={idx}
                      className={
                        hasDamage
                          ? "bg-rose-50/50"
                          : isUnder
                          ? "bg-amber-50/30"
                          : idx % 2 === 0
                          ? "bg-white"
                          : "bg-slate-50/40"
                      }
                    >
                      <td className="py-2 px-2.5 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                      <td className="py-2 px-2">
                        <div className="font-bold text-slate-900">{it.name}</div>
                        <div className="text-[10px] text-slate-500 flex flex-wrap gap-2">
                          {it.barcode && <span>Barcode: {it.barcode}</span>}
                          {it.batchNumber && <span className="font-mono text-blue-700">Lot: {it.batchNumber}</span>}
                          {it.expiryDate && (
                            <span className="text-amber-700">
                              Exp: {new Date(it.expiryDate).toLocaleDateString("en-LK")}
                            </span>
                          )}
                        </div>
                        {hasDamage && it.rejectionReason && (
                          <div className="text-[9px] text-rose-700 font-bold mt-0.5">
                            Rejected: {it.rejectionReason.replace(/_/g, " ")} {it.rejectionNotes ? `(${it.rejectionNotes})` : ""}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-slate-600">
                        {it.orderedQuantity} <span className="text-[9px] text-slate-400">{it.unit}</span>
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-slate-800">
                        {it.receivedQuantity}
                      </td>
                      <td className="py-2 px-2 text-right font-mono font-bold text-emerald-700">
                        {it.acceptedQuantity}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-rose-600 font-bold">
                        {it.rejectedQuantity || "-"}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-slate-700">
                        Rs. {it.unitCost.toFixed(2)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">
                        Rs. {it.acceptedTotalCost.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-2 text-right font-mono font-bold text-[10px]">
                        {variance === 0 ? (
                          <span className="text-emerald-600">Exact (0)</span>
                        ) : isUnder ? (
                          <span className="text-rose-600">Short ({variance})</span>
                        ) : (
                          <span className="text-amber-600">Excess (+{variance})</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-100 font-bold border-t border-slate-300 text-[11px] text-slate-900">
                <tr>
                  <td colSpan={2} className="py-2 px-2.5 uppercase tracking-wider text-[10px]">
                    Total Quantities & Value
                  </td>
                  <td className="py-2 px-2 text-right">{totalOrderedUnits}</td>
                  <td className="py-2 px-2 text-right">{totalReceivedUnits}</td>
                  <td className="py-2 px-2 text-right text-emerald-700">{totalAcceptedUnits}</td>
                  <td className="py-2 px-2 text-right text-rose-700">{totalRejectedUnits}</td>
                  <td className="py-2 px-2 text-right">-</td>
                  <td className="py-2 px-2 text-right font-mono">
                    Rs. {data.totalAcceptedCost.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-[10px]">
                    {totalAcceptedUnits - totalOrderedUnits === 0
                      ? "Balanced"
                      : totalAcceptedUnits - totalOrderedUnits > 0
                      ? `+${totalAcceptedUnits - totalOrderedUnits}`
                      : `${totalAcceptedUnits - totalOrderedUnits}`}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Financial & QC Alert Summary Cards */}
        <div className={`grid gap-4 ${formatMode === "A4" ? "grid-cols-2" : "grid-cols-1"}`}>
          {/* Financials */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1.5">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-emerald-600" />
              <span>Receiving Financial Impact</span>
            </h4>
            <div className="flex justify-between py-1 border-b border-slate-200">
              <span className="text-slate-600">Total Purchase Order Value</span>
              <span className="font-mono text-slate-900">
                Rs. {data.totalOrderedCost.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200">
              <span className="text-slate-600">Total Rejected / Damaged Value</span>
              <span className="font-mono text-rose-600">
                - Rs. {data.totalRejectedCost.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between py-1 font-bold text-slate-900 text-sm">
              <span>Accepted Stock Value (Added to Inventory)</span>
              <span className="font-mono text-emerald-700">
                Rs. {data.totalAcceptedCost.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
              </span>
            </div>
            {data.notes && (
              <div className="mt-2 text-[10px] bg-white p-2 rounded border border-slate-200 text-slate-600 italic">
                Notes: {data.notes}
              </div>
            )}
          </div>

          {/* Variance & Discrepancies Alerts */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>Dock Audit Discrepancies</span>
            </h4>
            <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="text-slate-500 block">Short Delivered</span>
                <span className={`font-bold ${shortDeliveredCount > 0 ? "text-rose-600" : "text-slate-800"}`}>
                  {shortDeliveredCount} SKUs
                </span>
              </div>
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="text-slate-500 block">Excess Delivered</span>
                <span className={`font-bold ${excessDeliveredCount > 0 ? "text-amber-600" : "text-slate-800"}`}>
                  {excessDeliveredCount} SKUs
                </span>
              </div>
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="text-slate-500 block">Damaged / Rejected</span>
                <span className={`font-bold ${rejectedCount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {rejectedCount} SKUs
                </span>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              Supplier Accounts Payable has been credited with the Net Accepted Value. Shortages and damaged goods must be adjusted on the monthly credit note.
            </p>
          </div>
        </div>

        {/* Signature & Verification Blocks */}
        <div className="pt-4 border-t-2 border-slate-900 grid grid-cols-1 sm:grid-cols-2 gap-8 items-end">
          <div className="space-y-6">
            <div className="border-b border-slate-400 pb-1">
              <span className="text-[9px] text-slate-400 uppercase font-bold block">
                Warehouse Receiving Officer
              </span>
            </div>
            <div className="text-[10px] text-slate-600 flex justify-between">
              <span>Signature: _______________________</span>
              <span>Name: {data.receivedBy}</span>
            </div>
          </div>

          <div className="space-y-6">
            <div className="border-b border-slate-400 pb-1">
              <span className="text-[9px] text-slate-400 uppercase font-bold block">
                Supplier Delivery Representative / Driver
              </span>
            </div>
            <div className="text-[10px] text-slate-600 flex justify-between">
              <span>Signature: _______________________</span>
              <span>Vehicle No: _________________</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pt-2 text-[9px] text-slate-400">
          Generated via Corner Store POS &bull; Goods Receiving & Procurement Engine &bull; {formatSLDateTime(new Date())}
        </div>
      </div>
    </div>
  );
}
