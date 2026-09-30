"use client";

import React from "react";
import { formatSLDateTime } from "@/lib/formatters";
import { Printer, X, Truck, Building, ArrowRight, ShieldCheck } from "lucide-react";

export interface StockTransferData {
  _id: string;
  transferNumber: string;
  sourceBranchName: string;
  destinationBranchName: string;
  status: "DRAFT" | "IN_TRANSIT" | "COMPLETED" | "CANCELLED";
  items: Array<{
    productId: string;
    name: string;
    sku?: string;
    unit: string;
    quantitySent: number;
    quantityReceived?: number;
    notes?: string;
  }>;
  totalItemsSent: number;
  totalItemsReceived?: number;
  carrierName?: string;
  trackingReference?: string;
  dispatchedBy?: string;
  dispatchedAt?: string | Date;
  receivedBy?: string;
  receivedAt?: string | Date;
  cancelledBy?: string;
  cancelledAt?: string | Date;
  cancellationReason?: string;
  notes?: string;
  createdAt: string | Date;
}

export interface StockTransferNoteReceiptProps {
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
  transfer: StockTransferData;
  onClose?: () => void;
}

export default function StockTransferNoteReceipt({
  business,
  transfer,
  onClose,
}: StockTransferNoteReceiptProps) {
  const handlePrint = () => {
    window.print();
  };

  const isCompleted = transfer.status === "COMPLETED";
  const hasDiscrepancy =
    isCompleted &&
    typeof transfer.totalItemsReceived === "number" &&
    transfer.totalItemsReceived !== transfer.totalItemsSent;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 my-8 print:p-0 print:border-none print:shadow-none print:max-w-none print:m-0 print:w-full">
        {/* Modal Controls (Hidden in Print) */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Stock Transfer Delivery Note (STN)</h3>
              <p className="text-[11px] text-slate-500 font-mono">{transfer.transferNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Delivery Challan</span>
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* ================= PRINTABLE DELIVERY CHALLAN ================= */}
        <div id="printable-stn" className="p-6 bg-slate-50/50 border border-slate-200 rounded-xl space-y-4 print:p-4 print:bg-white print:border-none text-slate-800 font-sans">
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b-2 border-slate-800">
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                {business?.name || "SRI LANKA STORE NETWORK"}
              </h1>
              <p className="text-xs text-slate-600 mt-0.5 leading-tight">
                {business?.address || "Headquarters & Logistics Division"}
                {business?.phone && ` • Tel: ${business.phone}`}
              </p>
              {business?.taxSettings?.enabled && (
                <div className="text-[10px] text-slate-500 font-mono mt-1">
                  {business.taxSettings.vatNumber && `VAT Reg: ${business.taxSettings.vatNumber}`}
                  {business.taxSettings.tinNumber && ` • TIN: ${business.taxSettings.tinNumber}`}
                </div>
              )}
            </div>

            <div className="text-right">
              <span className="inline-block px-2.5 py-1 rounded bg-slate-900 text-white text-[10px] font-mono font-bold tracking-wider uppercase mb-1">
                DELIVERY CHALLAN
              </span>
              <div className="text-base font-black font-mono text-slate-900">{transfer.transferNumber}</div>
              <div className="text-[10px] text-slate-500">
                Created: {formatSLDateTime(transfer.createdAt)}
              </div>
            </div>
          </div>

          {/* Location Routing & Logistics Details */}
          <div className="grid grid-cols-2 gap-4 p-3.5 bg-white rounded-xl border border-slate-200 text-xs">
            {/* Origin & Destination */}
            <div className="space-y-2 border-r border-slate-100 pr-2">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 text-[11px] uppercase tracking-wider text-slate-500">
                <span>Routing Plan</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
                  <Building className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Origin (From)</span>
                  <span className="font-bold text-slate-800">{transfer.sourceBranchName}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 pl-3">
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                  <Building className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Destination (To)</span>
                  <span className="font-bold text-slate-800">{transfer.destinationBranchName}</span>
                </div>
              </div>
            </div>

            {/* Carrier & Tracking */}
            <div className="space-y-2 pl-2">
              <div className="font-bold text-slate-900 text-[11px] uppercase tracking-wider text-slate-500">
                Logistics & Transport
              </div>
              <div className="space-y-1 text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-500">Carrier / Vehicle:</span>
                  <span className="font-semibold text-slate-800">{transfer.carrierName || "In-house Store Vehicle"}</span>
                </div>
                {transfer.trackingReference && (
                  <div className="flex justify-between font-mono">
                    <span className="text-slate-500">Waybill / Ref:</span>
                    <span className="font-bold">{transfer.trackingReference}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Status:</span>
                  <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] uppercase ${
                    transfer.status === "COMPLETED"
                      ? "bg-emerald-100 text-emerald-800"
                      : transfer.status === "IN_TRANSIT"
                      ? "bg-blue-100 text-blue-800"
                      : transfer.status === "CANCELLED"
                      ? "bg-rose-100 text-rose-800"
                      : "bg-slate-100 text-slate-800"
                  }`}>
                    {transfer.status.replace("_", " ")}
                  </span>
                </div>
                {transfer.dispatchedAt && (
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">Dispatched:</span>
                    <span>{formatSLDateTime(transfer.dispatchedAt)}</span>
                  </div>
                )}
                {transfer.receivedAt && (
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">Received:</span>
                    <span>{formatSLDateTime(transfer.receivedAt)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">Item Description</th>
                  <th className="py-2.5 px-3 w-24">SKU</th>
                  <th className="py-2.5 px-3 w-24 text-right">Qty Sent</th>
                  <th className="py-2.5 px-3 w-28 text-right">Qty Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {transfer.items.map((item, idx) => {
                  const qtyRec = typeof item.quantityReceived === "number" ? item.quantityReceived : null;
                  const itemDiff = qtyRec !== null ? qtyRec - item.quantitySent : null;

                  return (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 text-center text-slate-400">{idx + 1}</td>
                      <td className="py-2 px-3 font-sans font-semibold text-slate-800">
                        {item.name}
                        {item.notes && <span className="block text-[10px] text-slate-400 font-normal italic">{item.notes}</span>}
                      </td>
                      <td className="py-2 px-3 text-slate-500">{item.sku || "—"}</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">
                        {item.quantitySent} {item.unit}
                      </td>
                      <td className="py-2 px-3 text-right font-bold">
                        {qtyRec !== null ? (
                          <span className={itemDiff !== 0 ? "text-rose-600" : "text-emerald-700"}>
                            {qtyRec} {item.unit}
                            {itemDiff !== 0 && itemDiff !== null && (
                              <span className="block text-[9px] font-normal text-rose-500">
                                ({itemDiff > 0 ? `+${itemDiff}` : itemDiff})
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-sans italic">Pending</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 font-bold border-t border-slate-200 text-xs">
                <tr>
                  <td colSpan={3} className="py-2.5 px-3 text-slate-600 uppercase text-[10px]">
                    Total Dispatched Volume:
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-900 font-mono">
                    {transfer.totalItemsSent} Units
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {typeof transfer.totalItemsReceived === "number" ? (
                      <span className={hasDiscrepancy ? "text-rose-600" : "text-emerald-700"}>
                        {transfer.totalItemsReceived} Units
                      </span>
                    ) : (
                      <span className="text-slate-400 italic font-sans font-normal">—</span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Discrepancy Alert */}
          {hasDiscrepancy && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center justify-between">
              <span className="font-bold">⚠️ Transit Discrepancy Flagged:</span>
              <span className="font-mono">
                Shortage / Damage of {Math.abs((transfer.totalItemsSent || 0) - (transfer.totalItemsReceived || 0))} units
              </span>
            </div>
          )}

          {/* Notes */}
          {transfer.notes && (
            <div className="p-2.5 bg-amber-50/60 border border-amber-200 rounded-lg text-xs text-amber-950">
              <span className="font-bold">Dispatch Notes: </span>
              <span>{transfer.notes}</span>
            </div>
          )}

          {/* Triple Sign-off Blocks */}
          <div className="pt-6 grid grid-cols-3 gap-4 text-center text-xs">
            <div className="border-t border-slate-400 pt-2 space-y-1">
              <div className="font-bold text-slate-800">Dispatched By</div>
              <div className="text-[10px] text-slate-500">{transfer.dispatchedBy || "Warehouse Supervisor"}</div>
              <div className="text-[9px] text-slate-400 italic">Sign & Date</div>
            </div>

            <div className="border-t border-slate-400 pt-2 space-y-1">
              <div className="font-bold text-slate-800">Transported By</div>
              <div className="text-[10px] text-slate-500">{transfer.carrierName || "Driver / Transport Agent"}</div>
              <div className="text-[9px] text-slate-400 italic">Sign & Vehicle ID</div>
            </div>

            <div className="border-t border-slate-400 pt-2 space-y-1">
              <div className="font-bold text-slate-800">Received By</div>
              <div className="text-[10px] text-slate-500">{transfer.receivedBy || "Destination Branch Mgr"}</div>
              <div className="text-[9px] text-slate-400 italic">Sign & Date</div>
            </div>
          </div>

          {/* Footer Notice */}
          <div className="border-t border-dashed border-slate-200 pt-2 text-center text-[10px] text-slate-400">
            This Stock Transfer Delivery Challan is an official goods movement record for Sri Lanka inter-store operations.
          </div>
        </div>
      </div>
    </div>
  );
}
