"use client";

import React, { useState } from "react";
import QRCodeImage from "@/components/common/QRCodeImage";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";
import { Printer, CheckCircle2, AlertTriangle, Truck, User, Calendar, DollarSign, Layers } from "lucide-react";

export interface VanLoadedItemSlip {
  productName: string;
  unit: string;
  loadedQty: number;
  soldQty: number;
  returnedQty: number;
  damagedQty: number;
  remainingQty: number;
  unitPrice: number;
  wholesalePrice?: number;
}

export interface VanLoadingSheetSlipData {
  sessionNumber: string;
  storeName: string;
  storePhone?: string;
  storeAddress?: string;
  driverName: string;
  driverPhone: string;
  vehicleType: string;
  vehicleNumber: string;
  routeZone?: string;
  notes?: string;
  status: "LOADED" | "ON_ROUTE" | "COMPLETED" | "RECONCILED";
  loadedAt: string | Date;
  startedAt?: string | Date;
  completedAt?: string | Date;
  reconciledAt?: string | Date;
  items: VanLoadedItemSlip[];
  salesSummary: {
    totalSalesCount: number;
    grossSalesTotal: number;
    discountsTotal: number;
    netSalesTotal: number;
    cashCollected: number;
    lankaQrCollected: number;
    creditCollected: number;
    otherCollected: number;
  };
  cashierReconciliation?: {
    status: "PENDING" | "RECONCILED" | "DISCREPANCY";
    reconciledBy?: string;
    reconciledAt?: string | Date;
    physicalCashSubmitted: number;
    cashShortageOrOverage: number;
    stockDiscrepancyNotes?: string;
    cashierNotes?: string;
  };
  vanPosUrl?: string;
}

export default function VanLoadingSheetSlip({
  data,
  onPrint,
}: {
  data: VanLoadingSheetSlipData;
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

  const totalLoadedItems = data.items.reduce((acc, it) => acc + it.loadedQty, 0);
  const totalSoldItems = data.items.reduce((acc, it) => acc + it.soldQty, 0);
  const totalReturnedItems = data.items.reduce((acc, it) => acc + it.returnedQty, 0);
  const totalDamagedItems = data.items.reduce((acc, it) => acc + it.damagedQty, 0);

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
            <Truck className="w-4 h-4 text-blue-600" />
            <span>Van Loading Sheet & Return Manifest</span>
          </h2>
          <p className="text-xs text-slate-500">Session #{data.sessionNumber}</p>
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
              A4 Sheet
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
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>Print Manifest</span>
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
              <span className="inline-block px-2.5 py-1 bg-slate-900 text-white text-[11px] font-black rounded uppercase tracking-wider">
                VAN STOCK LOADING & SETTLEMENT MANIFEST
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
                Session Number
              </span>
              <div className="font-mono font-black text-slate-900 text-base">{data.sessionNumber}</div>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                  data.status === "RECONCILED"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                    : data.status === "ON_ROUTE"
                    ? "bg-blue-50 text-blue-700 border-blue-300"
                    : data.status === "COMPLETED"
                    ? "bg-amber-50 text-amber-700 border-amber-300"
                    : "bg-slate-100 text-slate-700 border-slate-300"
                }`}
              >
                {data.status}
              </span>
            </div>
          </div>
        </div>

        {/* Route, Driver & Vehicle Info */}
        <div
          className={`grid gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 ${
            formatMode === "A4" ? "grid-cols-4 text-xs" : "grid-cols-2 text-[11px]"
          }`}
        >
          <div>
            <span className="text-slate-400 font-semibold uppercase text-[9px] block">Driver</span>
            <span className="font-bold text-slate-900">{data.driverName}</span>
            <span className="text-slate-500 text-[10px] block">{data.driverPhone}</span>
          </div>
          <div>
            <span className="text-slate-400 font-semibold uppercase text-[9px] block">Vehicle</span>
            <span className="font-bold text-slate-900">{data.vehicleNumber}</span>
            <span className="text-slate-500 text-[10px] block">{data.vehicleType}</span>
          </div>
          <div>
            <span className="text-slate-400 font-semibold uppercase text-[9px] block">Loaded At</span>
            <span className="font-bold text-slate-900">{formatSLDateTime(data.loadedAt)}</span>
            {data.routeZone && (
              <span className="text-blue-600 text-[10px] font-semibold block">
                Zone: {data.routeZone}
              </span>
            )}
          </div>
          <div>
            <span className="text-slate-400 font-semibold uppercase text-[9px] block">Settlement Status</span>
            <span className="font-bold text-slate-900">
              {data.cashierReconciliation?.status || "PENDING"}
            </span>
            {data.reconciledAt && (
              <span className="text-slate-500 text-[10px] block">
                {formatSLDateTime(data.reconciledAt)}
              </span>
            )}
          </div>
        </div>

        {/* Inventory Item Breakdown Table */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span>Loaded Stock & Returns Ledger</span>
            </h3>
            <span className="text-[11px] text-slate-500">{data.items.length} Product SKUs</span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[10px] uppercase">
                <tr>
                  <th className="py-2 px-2.5">#</th>
                  <th className="py-2 px-2">Product Description</th>
                  <th className="py-2 px-2 text-right">Loaded</th>
                  <th className="py-2 px-2 text-right">Sold</th>
                  <th className="py-2 px-2 text-right">Returned</th>
                  <th className="py-2 px-2 text-right">Damaged</th>
                  <th className="py-2 px-2 text-right">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px]">
                {data.items.map((it, idx) => {
                  const accountedQty = it.soldQty + it.returnedQty + it.damagedQty;
                  const variance = Number((it.loadedQty - accountedQty).toFixed(3));
                  const hasDiscrepancy = data.status === "RECONCILED" && variance !== 0;

                  return (
                    <tr
                      key={idx}
                      className={hasDiscrepancy ? "bg-rose-50/50" : idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}
                    >
                      <td className="py-2 px-2.5 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                      <td className="py-2 px-2">
                        <div className="font-bold text-slate-900">{it.productName}</div>
                        <div className="text-[10px] text-slate-500">
                          Rs. {it.unitPrice.toFixed(2)} / {it.unit}
                          {it.wholesalePrice ? ` (WS: Rs. ${it.wholesalePrice.toFixed(2)})` : ""}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right font-bold text-slate-900">
                        {it.loadedQty} <span className="text-[9px] font-normal text-slate-500">{it.unit}</span>
                      </td>
                      <td className="py-2 px-2 text-right font-semibold text-emerald-700">
                        {it.soldQty}
                      </td>
                      <td className="py-2 px-2 text-right font-medium text-slate-700">
                        {it.returnedQty}
                      </td>
                      <td className="py-2 px-2 text-right font-medium text-amber-700">
                        {it.damagedQty || "-"}
                      </td>
                      <td className="py-2 px-2 text-right font-bold">
                        {data.status === "RECONCILED" ? (
                          variance === 0 ? (
                            <span className="text-emerald-600">0</span>
                          ) : variance > 0 ? (
                            <span className="text-rose-600">-{variance}</span>
                          ) : (
                            <span className="text-blue-600">+{Math.abs(variance)}</span>
                          )
                        ) : (
                          <span className="text-slate-500 font-mono">{it.remainingQty} left</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-100 font-bold border-t border-slate-300 text-[11px] text-slate-900">
                <tr>
                  <td colSpan={2} className="py-2 px-2.5 uppercase tracking-wider text-[10px]">
                    Total Units
                  </td>
                  <td className="py-2 px-2 text-right">{totalLoadedItems.toFixed(2)}</td>
                  <td className="py-2 px-2 text-right text-emerald-700">{totalSoldItems.toFixed(2)}</td>
                  <td className="py-2 px-2 text-right">{totalReturnedItems.toFixed(2)}</td>
                  <td className="py-2 px-2 text-right text-amber-700">{totalDamagedItems.toFixed(2)}</td>
                  <td className="py-2 px-2 text-right font-mono">
                    {data.status === "RECONCILED" ? "Audited" : "In-Transit"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Financial Summary & Cash Collection Box */}
        <div
          className={`grid gap-4 ${
            formatMode === "A4" ? "grid-cols-2" : "grid-cols-1"
          }`}
        >
          {/* Sales Performance */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
              <span>Route Sales Collection Breakdown</span>
            </h4>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-600">Total Spot Invoices</span>
                <span className="font-bold text-slate-900">{data.salesSummary.totalSalesCount} sales</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-600">Gross Sales Value</span>
                <span className="font-mono text-slate-800">
                  Rs. {data.salesSummary.grossSalesTotal.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-600">Discounts Allowed</span>
                <span className="font-mono text-amber-700">
                  - Rs. {data.salesSummary.discountsTotal.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between py-1 font-bold text-slate-900 text-sm">
                <span>Net Route Revenue</span>
                <span className="font-mono text-emerald-700">
                  Rs. {data.salesSummary.netSalesTotal.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 grid grid-cols-3 gap-2 text-[10px]">
                <div className="bg-white p-1.5 rounded border border-slate-200 text-center">
                  <span className="text-slate-500 block">Cash</span>
                  <span className="font-bold text-slate-900">
                    Rs. {data.salesSummary.cashCollected.toFixed(2)}
                  </span>
                </div>
                <div className="bg-white p-1.5 rounded border border-slate-200 text-center">
                  <span className="text-slate-500 block">LankaQR</span>
                  <span className="font-bold text-blue-700">
                    Rs. {data.salesSummary.lankaQrCollected.toFixed(2)}
                  </span>
                </div>
                <div className="bg-white p-1.5 rounded border border-slate-200 text-center">
                  <span className="text-slate-500 block">Credit Book</span>
                  <span className="font-bold text-purple-700">
                    Rs. {data.salesSummary.creditCollected.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Settlement / Physical Cash Counting */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Cashier Return Reconciliation</span>
            </h4>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-600">Expected Physical Cash</span>
                <span className="font-mono font-bold text-slate-900">
                  Rs. {data.salesSummary.cashCollected.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-600">Physical Cash Handed Over</span>
                <span className="font-mono font-bold text-blue-700">
                  Rs.{" "}
                  {(data.cashierReconciliation?.physicalCashSubmitted || 0).toLocaleString(
                    "en-LK",
                    { minimumFractionDigits: 2 }
                  )}
                </span>
              </div>
              <div className="flex justify-between py-1 font-bold">
                <span className="text-slate-700">Cash Variance (Short/Over)</span>
                <span
                  className={`font-mono text-sm ${
                    (data.cashierReconciliation?.cashShortageOrOverage || 0) === 0
                      ? "text-emerald-700"
                      : (data.cashierReconciliation?.cashShortageOrOverage || 0) < 0
                      ? "text-rose-700"
                      : "text-blue-700"
                  }`}
                >
                  {(data.cashierReconciliation?.cashShortageOrOverage || 0) >= 0 ? "+" : ""}
                  Rs.{" "}
                  {(data.cashierReconciliation?.cashShortageOrOverage || 0).toLocaleString(
                    "en-LK",
                    { minimumFractionDigits: 2 }
                  )}
                </span>
              </div>
              {data.cashierReconciliation?.cashierNotes && (
                <div className="mt-2 text-[10px] bg-white p-2 rounded border border-slate-200 text-slate-600 italic">
                  Note: {data.cashierReconciliation.cashierNotes}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Driver Link QR & Signature Blocks */}
        <div className="pt-4 border-t-2 border-slate-900 grid grid-cols-1 sm:grid-cols-3 gap-6 items-end">
          {/* Driver Van POS Portal QR */}
          {data.vanPosUrl && (
            <div className="flex items-center gap-3">
              <QRCodeImage value={data.vanPosUrl} size={64} className="border border-slate-300 p-0.5 rounded" />
              <div>
                <span className="text-[10px] font-bold text-slate-900 uppercase block">Driver Mobile POS</span>
                <span className="text-[9px] text-slate-500 block leading-tight">
                  Scan to resume spot sales & instant invoice printing on route
                </span>
              </div>
            </div>
          )}

          {/* Departure Signature */}
          <div className="space-y-6">
            <div className="border-b border-slate-400 pb-1">
              <span className="text-[9px] text-slate-400 uppercase font-bold block">1. Loading Verification</span>
            </div>
            <div className="text-[10px] text-slate-600 flex justify-between">
              <span>Dispatcher Sign</span>
              <span>Driver Sign</span>
            </div>
          </div>

          {/* Return & Reconciliation Signature */}
          <div className="space-y-6">
            <div className="border-b border-slate-400 pb-1">
              <span className="text-[9px] text-slate-400 uppercase font-bold block">2. Return & Cash Audit</span>
            </div>
            <div className="text-[10px] text-slate-600 flex justify-between">
              <span>Driver Sign</span>
              <span>Cashier Sign</span>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center pt-2 text-[9px] text-slate-400">
          Generated via Corner Store POS &bull; Van Sales & Fleet Logistics Engine &bull; {formatSLDateTime(new Date())}
        </div>
      </div>
    </div>
  );
}
