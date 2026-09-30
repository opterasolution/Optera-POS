"use client";

import React from "react";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";
import { Printer, X, FileText, Building2, Calendar, MapPin, Phone } from "lucide-react";

export interface PurchaseOrderData {
  _id: string;
  poNumber: string;
  supplierName: string;
  supplierDetails?: {
    contactPerson?: string;
    phone?: string;
    email?: string;
    address?: string;
    taxNumber?: string;
    paymentTermsDays?: number;
  };
  branchName?: string;
  status: "DRAFT" | "SENT" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";
  items: Array<{
    productId: string;
    name: string;
    sku?: string;
    unit: string;
    quantityOrdered: number;
    quantityReceived?: number;
    unitCost: number;
    total: number;
    notes?: string;
  }>;
  subtotal: number;
  taxTotal: number;
  netTotal: number;
  expectedDeliveryDate?: string | Date;
  supplierInvoiceNumber?: string;
  receivedAt?: string | Date;
  notes?: string;
  createdBy: string;
  createdAt: string | Date;
}

export interface PurchaseOrderReceiptProps {
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
  purchaseOrder: PurchaseOrderData;
  onClose?: () => void;
}

export default function PurchaseOrderReceipt({
  business,
  purchaseOrder,
  onClose,
}: PurchaseOrderReceiptProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 my-8 print:p-0 print:border-none print:shadow-none print:max-w-none print:m-0 print:w-full">
        {/* Modal Controls (Hidden in Print) */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Purchase Order (PO) Document</h3>
              <p className="text-[11px] text-slate-500 font-mono">{purchaseOrder.poNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Official PO</span>
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

        {/* ================= PRINTABLE PO DOCUMENT ================= */}
        <div
          id="printable-po"
          className="p-8 bg-white border border-slate-200 rounded-xl space-y-6 print:p-6 print:border-none text-slate-800 font-sans"
        >
          {/* Header */}
          <div className="flex items-start justify-between pb-5 border-b-2 border-slate-900">
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                {business?.name || "SRI LANKA COMMERCIAL ENTERPRISES"}
              </h1>
              <p className="text-xs text-slate-600 mt-1 max-w-sm leading-relaxed">
                {business?.address || "Headquarters & Procurement Division, Colombo"}
                {business?.phone && ` • Tel: ${business.phone}`}
              </p>
              {business?.taxSettings?.enabled && (
                <div className="text-[11px] text-slate-500 font-mono mt-1 font-semibold">
                  {business.taxSettings.vatNumber && `VAT No: ${business.taxSettings.vatNumber}`}
                  {business.taxSettings.tinNumber && ` • TIN: ${business.taxSettings.tinNumber}`}
                </div>
              )}
            </div>

            <div className="text-right">
              <span className="inline-block px-3 py-1 rounded bg-slate-900 text-white text-xs font-mono font-bold tracking-wider uppercase mb-1">
                PURCHASE ORDER
              </span>
              <div className="text-lg font-black font-mono text-slate-900">{purchaseOrder.poNumber}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Date: {new Date(purchaseOrder.createdAt).toLocaleDateString()}
              </div>
              <div className="mt-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                  Status: {purchaseOrder.status.replace("_", " ")}
                </span>
              </div>
            </div>
          </div>

          {/* Vendor and Delivery Destination Grid */}
          <div className="grid grid-cols-2 gap-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            {/* Vendor Box */}
            <div className="space-y-1.5">
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] block">
                Vendor / Supplier Information:
              </span>
              <h3 className="font-extrabold text-slate-900 text-sm">{purchaseOrder.supplierName}</h3>
              {purchaseOrder.supplierDetails?.contactPerson && (
                <p className="text-slate-600">Attn: {purchaseOrder.supplierDetails.contactPerson}</p>
              )}
              {purchaseOrder.supplierDetails?.phone && (
                <p className="text-slate-600 font-mono">Tel: {purchaseOrder.supplierDetails.phone}</p>
              )}
              {purchaseOrder.supplierDetails?.address && (
                <p className="text-slate-600">{purchaseOrder.supplierDetails.address}</p>
              )}
              {purchaseOrder.supplierDetails?.paymentTermsDays !== undefined && (
                <p className="font-semibold text-blue-700 pt-1">
                  Payment Terms: {purchaseOrder.supplierDetails.paymentTermsDays === 0 ? "Cash on Delivery (COD)" : `${purchaseOrder.supplierDetails.paymentTermsDays} Days Credit`}
                </p>
              )}
            </div>

            {/* Delivery Destination Box */}
            <div className="space-y-1.5">
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] block">
                Deliver Goods To:
              </span>
              <h3 className="font-extrabold text-slate-900 text-sm">
                {purchaseOrder.branchName || "Main Central Warehouse (HQ-01)"}
              </h3>
              <p className="text-slate-600">{business?.address || "Store Receiving Counter"}</p>
              {purchaseOrder.expectedDeliveryDate && (
                <div className="pt-2 text-slate-700 flex items-center gap-1 font-semibold">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>Expected By: {new Date(purchaseOrder.expectedDeliveryDate).toLocaleDateString()}</span>
                </div>
              )}
              {purchaseOrder.supplierInvoiceNumber && (
                <p className="text-slate-700 font-mono text-[11px]">
                  Supplier Invoice Ref: <strong>{purchaseOrder.supplierInvoiceNumber}</strong>
                </p>
              )}
            </div>
          </div>

          {/* Line Items Table */}
          <div className="overflow-hidden rounded-xl border border-slate-300">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 border-b border-slate-300 text-[11px] font-bold text-slate-700 uppercase">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">Item Description</th>
                  <th className="py-2.5 px-3 w-28">SKU</th>
                  <th className="py-2.5 px-3 w-24 text-right">Qty</th>
                  <th className="py-2.5 px-3 w-28 text-right">Unit Cost (Rs.)</th>
                  <th className="py-2.5 px-3 w-32 text-right">Line Total (Rs.)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono text-xs">
                {purchaseOrder.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 text-center text-slate-400 font-sans">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-sans font-semibold text-slate-900">
                      {item.name}
                      {item.notes && <span className="block text-[10px] text-slate-500 font-normal italic">{item.notes}</span>}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">{item.sku || "—"}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono">
                      {item.quantityOrdered} {item.unit}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-700">
                      {formatCurrency(item.unitCost)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                      {formatCurrency(item.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-300 text-xs font-semibold">
                <tr>
                  <td colSpan={4} className="py-2 px-3 text-slate-500"></td>
                  <td className="py-2 px-3 text-right text-slate-600 font-sans uppercase text-[11px]">Subtotal:</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                    {formatCurrency(purchaseOrder.subtotal)}
                  </td>
                </tr>
                {purchaseOrder.taxTotal > 0 && (
                  <tr>
                    <td colSpan={4} className="py-1 px-3"></td>
                    <td className="py-1 px-3 text-right text-slate-600 font-sans uppercase text-[11px]">VAT / Taxes:</td>
                    <td className="py-1 px-3 text-right font-mono font-bold text-slate-800">
                      +{formatCurrency(purchaseOrder.taxTotal)}
                    </td>
                  </tr>
                )}
                <tr className="border-t border-slate-200">
                  <td colSpan={4} className="py-2.5 px-3"></td>
                  <td className="py-2.5 px-3 text-right font-black text-slate-900 uppercase font-sans text-xs">
                    TOTAL PO VALUE:
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-black text-base text-slate-900">
                    {formatCurrency(purchaseOrder.netTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Notes */}
          {purchaseOrder.notes && (
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-950">
              <span className="font-bold">Order Instructions: </span>
              <span>{purchaseOrder.notes}</span>
            </div>
          )}

          {/* Sign-off Blocks */}
          <div className="pt-8 grid grid-cols-2 gap-12 text-center text-xs">
            <div className="border-t border-slate-400 pt-2 space-y-1">
              <div className="font-bold text-slate-800">Authorized Signature & Seal</div>
              <div className="text-[10px] text-slate-500">{business?.name || "Purchaser"}</div>
              <div className="text-[9px] text-slate-400 italic">Prepared by: {purchaseOrder.createdBy}</div>
            </div>

            <div className="border-t border-slate-400 pt-2 space-y-1">
              <div className="font-bold text-slate-800">Supplier Acknowledgment</div>
              <div className="text-[10px] text-slate-500">{purchaseOrder.supplierName}</div>
              <div className="text-[9px] text-slate-400 italic">Sign, Date & Confirm Delivery Schedule</div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="border-t border-dashed border-slate-200 pt-3 text-center text-[10px] text-slate-400">
            Please include this PO number on all delivery invoices and delivery challans. Thank you for your partnership!
          </div>
        </div>
      </div>
    </div>
  );
}
