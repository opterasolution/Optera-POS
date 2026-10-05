"use client";

import React, { useState } from "react";
import { formatCurrency, formatSLDateTime, amountToWords } from "@/lib/formatters";
import {
  Printer,
  X,
  Truck,
  Building2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  User,
  ShieldCheck,
  FileText,
  Barcode,
  Clock,
  Phone,
} from "lucide-react";

export interface StockTransferManifestItem {
  productId: string;
  name: string;
  sku: string;
  barcode?: string;
  unit: string;
  quantitySent: number;
  quantityReceived?: number;
  quantityDamagedInTransit?: number;
  unitCost?: number;
  totalSentCost?: number;
  totalReceivedCost?: number;
  discrepancyReason?: string;
  discrepancyAction?: string;
  discrepancyNotes?: string;
  batchNumber?: string;
  expiryDate?: string | Date;
  notes?: string;
}

export interface StockTransferManifestData {
  _id: string;
  transferNumber: string;
  manifestToken?: string;
  sourceBranchName: string;
  destinationBranchName: string;
  status: "DRAFT" | "IN_TRANSIT" | "COMPLETED" | "CANCELLED";
  items: StockTransferManifestItem[];
  totalItemsSent: number;
  totalItemsReceived?: number;
  totalTransitValue?: number;
  totalReceivedValue?: number;
  totalDiscrepancyValue?: number;
  discrepancyStatus?: "NO_DISCREPANCY" | "SHORTAGE" | "OVERAGE" | "DAMAGED";
  discrepancyResolved?: boolean;
  discrepancyResolutionNotes?: string;
  discrepancyResolvedBy?: string;
  discrepancyResolvedAt?: string | Date;
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
  gatePassOutTime?: string | Date;
  estimatedArrival?: string | Date;
  carrierName?: string;
  trackingReference?: string;
  dispatchedBy?: string;
  dispatchedAt?: string | Date;
  receivedBy?: string;
  receivedAt?: string | Date;
  notes?: string;
  createdAt: string | Date;
}

export interface StockTransferManifestReceiptProps {
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
  transfer: StockTransferManifestData;
  onClose: () => void;
}

export default function StockTransferManifestReceipt({
  business,
  transfer,
  onClose,
}: StockTransferManifestReceiptProps) {
  const [printFormat, setPrintFormat] = useState<"A4" | "THERMAL">("A4");

  const handlePrint = () => {
    window.print();
  };

  const reasonLabels: Record<string, string> = {
    NONE: "None / Clear",
    SHORTAGE_IN_TRANSIT: "Shortage in Transit",
    DAMAGED_IN_TRANSIT: "Damaged in Transit",
    WRONG_ITEM: "Wrong Item / Mismatch",
    OVER_DELIVERED: "Excess / Over-delivered",
  };

  const actionLabels: Record<string, string> = {
    NONE: "Pending Action",
    ACCEPT_SHORTAGE: "Accepted as Transit Shrinkage",
    CLAIM_DRIVER: "Claimed against Driver / Carrier",
    RETURN_TO_SENDER: "Returned to Source Branch",
    RECONCILED: "Reconciled & Cleared",
  };

  const totalTransitVal =
    transfer.totalTransitValue ||
    transfer.items.reduce(
      (sum, it) => sum + (it.totalSentCost || it.quantitySent * (it.unitCost || 0)),
      0
    );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 my-8 max-h-[92vh] overflow-y-auto print:max-h-none print:max-w-none print:w-full print:border-none print:p-0 print:shadow-none print:my-0">
        {/* Controls - Hidden during print */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Transfer Dispatch Manifest & Gate Pass</h3>
              <p className="text-[11px] text-slate-500 font-mono">{transfer.transferNumber}</p>
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
                A4 Goods Manifest
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
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
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

        {/* ================= FORMAT 1: A4 FORMAL TRANSFER MANIFEST ================= */}
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
                <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-900 font-black text-xs uppercase tracking-wider rounded-md mb-1.5">
                  Inter-Branch Goods Manifest & Challan
                </span>
                <div className="text-base sm:text-lg font-black font-mono text-slate-900">
                  {transfer.transferNumber}
                </div>
                {transfer.manifestToken && (
                  <div className="text-[11px] font-mono text-indigo-700 font-semibold mt-0.5 flex items-center sm:justify-end gap-1">
                    <Barcode className="w-3.5 h-3.5" />
                    <span>Token: {transfer.manifestToken}</span>
                  </div>
                )}
                <div className="text-xs text-slate-600 mt-0.5 font-mono">
                  Date: {formatSLDateTime(transfer.dispatchedAt || transfer.createdAt)}
                </div>
                <div className="text-xs font-bold text-slate-700 mt-1">
                  Status: <span className="uppercase text-indigo-700">{transfer.status}</span>
                </div>
              </div>
            </div>

            {/* Routing & Transport Logistics Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 rounded-xl p-4 border border-slate-200">
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Inter-Branch Routing
                </h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-500 w-28">Source Location:</span>
                    <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {transfer.sourceBranchName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-500 w-28">Destination Store:</span>
                    <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {transfer.destinationBranchName}
                    </span>
                  </div>
                  {transfer.dispatchedBy && (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-500 w-28">Dispatched By:</span>
                      <span className="font-medium text-slate-800">{transfer.dispatchedBy}</span>
                    </div>
                  )}
                  {transfer.receivedBy && (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-500 w-28">Received By:</span>
                      <span className="font-medium text-slate-800">
                        {transfer.receivedBy}{transfer.receivedAt ? ` (${formatSLDateTime(transfer.receivedAt)})` : ""}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Transport & Gate Security Details
                </h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-500 w-32">Vehicle / Lorry No:</span>
                    <span className="font-black text-slate-900 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                      {transfer.vehicleNumber || transfer.carrierName || "Internal Van"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-500 w-32">Assigned Driver:</span>
                    <span className="font-bold text-slate-800">
                      {transfer.driverName || "Store Driver"}
                    </span>
                  </div>
                  {transfer.driverPhone && (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-500 w-32">Driver Phone:</span>
                      <span className="font-mono text-slate-800">{transfer.driverPhone}</span>
                    </div>
                  )}
                  {transfer.gatePassOutTime && (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-500 w-32">Gate Pass Out:</span>
                      <span className="font-mono text-slate-700">
                        {formatSLDateTime(transfer.gatePassOutTime)}
                      </span>
                    </div>
                  )}
                  {transfer.estimatedArrival && (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-500 w-32">Est. Delivery:</span>
                      <span className="font-mono text-slate-700">
                        {formatSLDateTime(transfer.estimatedArrival)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Discrepancy Alert Banner (if applicable) */}
            {transfer.discrepancyStatus && transfer.discrepancyStatus !== "NO_DISCREPANCY" && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-bold text-amber-900 uppercase">
                    Receiving Discrepancy Logged: {transfer.discrepancyStatus}
                  </span>
                  <p className="text-amber-800 mt-0.5">
                    Variance Value: {formatCurrency(transfer.totalDiscrepancyValue || 0)} | Status:{" "}
                    {transfer.discrepancyResolved ? "Resolved & Settled" : "Pending Reconciliation"}
                  </p>
                  {transfer.discrepancyResolutionNotes && (
                    <p className="text-amber-700 mt-1 italic">
                      Resolution Notes: {transfer.discrepancyResolutionNotes}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Items Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-2.5 text-center w-10">#</th>
                    <th className="p-2.5">Item Description & Barcode</th>
                    <th className="p-2.5 text-center">Batch / Expiry</th>
                    <th className="p-2.5 text-right">Sent Qty</th>
                    <th className="p-2.5 text-right">Unit Cost</th>
                    <th className="p-2.5 text-right">Transit Value</th>
                    <th className="p-2.5 text-right">Rec. Qty</th>
                    <th className="p-2.5 text-center">Discrepancy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transfer.items.map((item, idx) => {
                    const lineSentCost =
                      item.totalSentCost || item.quantitySent * (item.unitCost || 0);
                    const isVariance =
                      typeof item.quantityReceived === "number" &&
                      (item.quantityReceived !== item.quantitySent ||
                        (item.quantityDamagedInTransit && item.quantityDamagedInTransit > 0));

                    return (
                      <tr key={idx} className={isVariance ? "bg-amber-50/50" : ""}>
                        <td className="p-2.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-2.5">
                          <div className="font-bold text-slate-900">{item.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2">
                            <span>SKU: {item.sku}</span>
                            {item.barcode && <span>• Barcode: {item.barcode}</span>}
                          </div>
                        </td>
                        <td className="p-2.5 text-center font-mono text-[11px] text-slate-600">
                          {item.batchNumber ? (
                            <div>
                              <div>{item.batchNumber}</div>
                              {item.expiryDate && (
                                <div className="text-[10px] text-slate-400">
                                  Exp: {new Date(item.expiryDate).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="p-2.5 text-right font-black font-mono text-slate-900">
                          {item.quantitySent} {item.unit}
                        </td>
                        <td className="p-2.5 text-right font-mono text-slate-700">
                          {formatCurrency(item.unitCost || 0)}
                        </td>
                        <td className="p-2.5 text-right font-bold font-mono text-slate-900">
                          {formatCurrency(lineSentCost)}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold">
                          {typeof item.quantityReceived === "number" ? (
                            <span
                              className={
                                item.quantityReceived === item.quantitySent
                                  ? "text-emerald-700"
                                  : "text-amber-700"
                              }
                            >
                              {item.quantityReceived} {item.unit}
                            </span>
                          ) : (
                            <span className="text-slate-400">Pending</span>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          {item.quantityDamagedInTransit && item.quantityDamagedInTransit > 0 ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                              {item.quantityDamagedInTransit} Damaged
                            </span>
                          ) : item.discrepancyReason && item.discrepancyReason !== "NONE" ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                              {reasonLabels[item.discrepancyReason] || item.discrepancyReason}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">OK</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Financial Valuation & Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  In-Transit Inventory Valuation (In Words)
                </span>
                <p className="font-bold text-slate-900 italic text-xs leading-relaxed">
                  {amountToWords(totalTransitVal)}
                </p>
                {transfer.notes && (
                  <p className="text-xs text-slate-600 mt-2">
                    <span className="font-semibold">Dispatch Remarks:</span> {transfer.notes}
                  </p>
                )}
              </div>

              <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-4 text-xs space-y-2">
                <div className="flex justify-between items-center text-slate-700">
                  <span>Total Items Dispatched:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {transfer.totalItemsSent} Units
                  </span>
                </div>
                {typeof transfer.totalItemsReceived === "number" && (
                  <div className="flex justify-between items-center text-slate-700">
                    <span>Total Items Received:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {transfer.totalItemsReceived} Units
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-indigo-200 text-slate-900">
                  <span className="font-bold text-sm">Total Transit Valuation:</span>
                  <span className="font-mono font-black text-base text-indigo-900">
                    {formatCurrency(totalTransitVal)}
                  </span>
                </div>
                {typeof transfer.totalDiscrepancyValue === "number" &&
                  transfer.totalDiscrepancyValue > 0 && (
                    <div className="flex justify-between items-center text-rose-700 font-semibold pt-1 border-t border-rose-200">
                      <span>Transit Discrepancy Value:</span>
                      <span className="font-mono font-bold">
                        {formatCurrency(transfer.totalDiscrepancyValue)}
                      </span>
                    </div>
                  )}
              </div>
            </div>

            {/* Tripartite Sign-off Blocks */}
            <div className="pt-8 border-t border-slate-200 grid grid-cols-3 gap-6 text-center text-xs">
              <div className="space-y-12">
                <div className="border-b border-slate-400 pb-1">
                  <span className="text-slate-400 font-mono text-[10px]">Sign & Stamp</span>
                </div>
                <div>
                  <p className="font-bold text-slate-800">Dispatch Storekeeper</p>
                  <p className="text-[10px] text-slate-500">Source: {transfer.sourceBranchName}</p>
                </div>
              </div>

              <div className="space-y-12">
                <div className="border-b border-slate-400 pb-1">
                  <span className="text-slate-400 font-mono text-[10px]">Sign & Date</span>
                </div>
                <div>
                  <p className="font-bold text-slate-800">Van Driver / Carrier</p>
                  <p className="text-[10px] text-slate-500">
                    Vehicle: {transfer.vehicleNumber || "Assigned Carrier"}
                  </p>
                </div>
              </div>

              <div className="space-y-12">
                <div className="border-b border-slate-400 pb-1">
                  <span className="text-slate-400 font-mono text-[10px]">Sign & Stamp</span>
                </div>
                <div>
                  <p className="font-bold text-slate-800">Receiving Storekeeper</p>
                  <p className="text-[10px] text-slate-500">
                    Dest: {transfer.destinationBranchName}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= FORMAT 2: 80MM THERMAL GATE PASS ================= */}
        {printFormat === "THERMAL" && (
          <div className="max-w-[340px] mx-auto p-4 bg-white text-slate-900 font-mono text-xs space-y-3 border border-slate-200 rounded-xl shadow-xs print:border-none print:shadow-none print:p-0">
            {/* Header */}
            <div className="text-center space-y-1 border-b border-dashed border-slate-400 pb-2">
              <p className="font-black text-sm uppercase">{business.name}</p>
              <p className="text-[10px]">{business.phone ? `Tel: ${business.phone}` : ""}</p>
              <div className="pt-1">
                <span className="inline-block px-2 py-0.5 bg-slate-900 text-white font-black text-[10px] uppercase">
                  *** VEHICLE GATE PASS ***
                </span>
              </div>
              <p className="font-black text-xs mt-1">{transfer.transferNumber}</p>
              {transfer.manifestToken && (
                <p className="text-[10px] text-indigo-700 font-bold">
                  TOKEN: {transfer.manifestToken}
                </p>
              )}
              <p className="text-[10px] text-slate-600">
                Out: {formatSLDateTime(transfer.gatePassOutTime || transfer.createdAt)}
              </p>
            </div>

            {/* Transit Route */}
            <div className="border-b border-dashed border-slate-400 pb-2 text-[11px] space-y-1">
              <div>
                <span className="text-slate-500">FROM: </span>
                <span className="font-bold">{transfer.sourceBranchName}</span>
              </div>
              <div>
                <span className="text-slate-500">TO: </span>
                <span className="font-bold">{transfer.destinationBranchName}</span>
              </div>
              <div>
                <span className="text-slate-500">VAN/VEHICLE: </span>
                <span className="font-black">{transfer.vehicleNumber || "STORE VAN"}</span>
              </div>
              <div>
                <span className="text-slate-500">DRIVER: </span>
                <span className="font-bold">{transfer.driverName || "STORE DRIVER"}</span>
              </div>
              {transfer.driverPhone && (
                <div>
                  <span className="text-slate-500">PHONE: </span>
                  <span>{transfer.driverPhone}</span>
                </div>
              )}
            </div>

            {/* Itemized List */}
            <div className="border-b border-dashed border-slate-400 pb-2">
              <div className="flex justify-between font-bold text-[10px] pb-1 border-b border-slate-300">
                <span>ITEM</span>
                <span>QTY</span>
              </div>
              <div className="space-y-1.5 pt-1.5 text-[11px]">
                {transfer.items.map((it, i) => (
                  <div key={i} className="flex justify-between items-start">
                    <div className="pr-2 leading-tight">
                      <div className="font-bold">{it.name}</div>
                      <div className="text-[9px] text-slate-500">
                        {it.sku} {it.barcode ? `| ${it.barcode}` : ""}
                      </div>
                    </div>
                    <div className="font-black shrink-0">
                      {it.quantitySent} {it.unit}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="border-b border-dashed border-slate-400 pb-2 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span>TOTAL ITEMS:</span>
                <span className="font-black">{transfer.totalItemsSent} Units</span>
              </div>
              <div className="flex justify-between font-bold text-xs pt-1 border-t border-slate-200">
                <span>TRANSIT VALUE:</span>
                <span>{formatCurrency(totalTransitVal)}</span>
              </div>
            </div>

            {/* Security Signatures */}
            <div className="pt-2 text-[10px] space-y-6 text-center">
              <div className="border-t border-slate-400 pt-1 flex justify-between px-2">
                <span>Security Gate Out</span>
                <span>Driver Signature</span>
              </div>
              <p className="text-[9px] text-slate-400 italic">
                Valid for authorized inter-branch stock movement only.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
