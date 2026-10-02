"use client";

import React, { useRef, useState } from "react";
import { Printer, X, UtensilsCrossed, Users } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface DiningBillItem {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  course?: string;
  seatNumber?: number;
  notes?: string;
}

interface SplitShare {
  title: string;
  grandTotal: number;
  items?: DiningBillItem[];
}

interface RestaurantDiningBillProps {
  businessName?: string;
  tableNumber: string;
  tableName?: string;
  section: string;
  serverName?: string;
  customerCount?: number;
  orderNumber?: string;
  openedAt?: string | Date;
  items: DiningBillItem[];
  subtotal: number;
  serviceChargeRate?: number;
  serviceChargeAmount?: number;
  taxRate?: number;
  taxAmount?: number;
  grandTotal: number;
  splits?: SplitShare[];
  onClose?: () => void;
}

export default function RestaurantDiningBill({
  businessName = "Corner Store & Restaurant",
  tableNumber,
  tableName,
  section,
  serverName = "Staff",
  customerCount = 2,
  orderNumber = "TBL-000",
  openedAt = new Date(),
  items = [],
  subtotal,
  serviceChargeRate = 10,
  serviceChargeAmount = 0,
  taxRate = 0,
  taxAmount = 0,
  grandTotal,
  splits,
  onClose,
}: RestaurantDiningBillProps) {
  const [printWidth, setPrintWidth] = useState<"58mm" | "80mm">("80mm");
  const billRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const is80mm = printWidth === "80mm";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-700 bg-zinc-800 px-4 py-3 text-white">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-amber-400" />
            <span className="font-bold text-sm">Guest Dining Bill</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-zinc-700 bg-zinc-900 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPrintWidth("58mm")}
                className={`px-2 py-0.5 rounded-md transition ${
                  printWidth === "58mm"
                    ? "bg-amber-500 text-zinc-950 font-bold"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                58mm
              </button>
              <button
                type="button"
                onClick={() => setPrintWidth("80mm")}
                className={`px-2 py-0.5 rounded-md transition ${
                  printWidth === "80mm"
                    ? "bg-amber-500 text-zinc-950 font-bold"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                80mm
              </button>
            </div>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-700 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Printable Bill Area */}
        <div className="flex justify-center bg-zinc-950 p-4 max-h-[70vh] overflow-y-auto">
          <div
            ref={billRef}
            id="dining-bill-printable"
            style={{ width: is80mm ? "76mm" : "54mm" }}
            className="bg-white text-black font-mono text-[11px] leading-tight p-3 shadow-md rounded-xs border border-zinc-300"
          >
            {/* Store Header */}
            <div className="text-center pb-2 border-b-2 border-dashed border-black">
              <div className="font-black text-sm uppercase tracking-wider">
                {businessName}
              </div>
              <div className="text-[10px] text-zinc-600 mt-0.5">
                Dine-In Guest Check • අමුත්තන්ගේ බිල්පත
              </div>
              <div className="mt-1 inline-block bg-black text-white px-2 py-0.5 font-black text-xs uppercase">
                TABLE: {tableNumber} {tableName ? `(${tableName})` : ""}
              </div>
            </div>

            {/* Table Details */}
            <div className="py-2 border-b border-dashed border-black text-[10px] space-y-1">
              <div className="flex justify-between">
                <span className="text-zinc-600">Section:</span>
                <span className="font-bold">{section}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">Order Ref:</span>
                <span className="font-bold">{orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">Server:</span>
                <span>{serverName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">Covers / Guests:</span>
                <span className="font-bold">{customerCount} persons</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">Date & Time:</span>
                <span>{new Date(openedAt).toLocaleString()}</span>
              </div>
            </div>

            {/* Line Items Header */}
            <div className="pt-2 pb-1 flex justify-between font-black text-[11px] border-b border-black">
              <span>ITEM</span>
              <span>TOTAL (Rs.)</span>
            </div>

            {/* Items */}
            <div className="py-1 divide-y divide-zinc-200 space-y-1">
              {items.map((it, idx) => (
                <div key={idx} className="pt-1 first:pt-0">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 pr-2">
                      <div className="font-bold">
                        {it.quantity}x {it.name}
                      </div>
                      <div className="text-[9px] text-zinc-500 flex items-center gap-1">
                        {it.course && <span className="uppercase">[{it.course}]</span>}
                        {it.seatNumber && <span>Seat {it.seatNumber}</span>}
                        <span>@ {formatCurrency(it.unitPrice)}</span>
                      </div>
                      {it.notes && (
                        <div className="text-[9px] text-zinc-600 italic">
                          Note: {it.notes}
                        </div>
                      )}
                    </div>
                    <div className="font-bold text-right shrink-0">
                      {formatCurrency(it.lineTotal)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Financial Summary */}
            <div className="mt-2 pt-2 border-t-2 border-dashed border-black space-y-1 text-[11px]">
              <div className="flex justify-between text-zinc-700">
                <span>Food & Beverage Subtotal:</span>
                <span className="font-mono">{formatCurrency(subtotal)}</span>
              </div>

              {serviceChargeAmount > 0 && (
                <div className="flex justify-between font-bold text-zinc-800">
                  <span>Service Charge ({serviceChargeRate}%):</span>
                  <span className="font-mono">{formatCurrency(serviceChargeAmount)}</span>
                </div>
              )}

              {taxAmount > 0 && (
                <div className="flex justify-between text-zinc-700">
                  <span>VAT / Tax ({taxRate}%):</span>
                  <span className="font-mono">{formatCurrency(taxAmount)}</span>
                </div>
              )}

              <div className="flex justify-between font-black text-sm pt-1 border-t border-black text-black">
                <span>TOTAL DUE:</span>
                <span className="font-mono">{formatCurrency(grandTotal)}</span>
              </div>
            </div>

            {/* Optional Split Breakdown on Bill */}
            {splits && splits.length > 0 && (
              <div className="mt-2 pt-2 border-t border-dashed border-black">
                <div className="font-bold text-[10px] uppercase text-center mb-1">
                  *** SPLIT BILL BREAKDOWN ***
                </div>
                <div className="space-y-0.5 text-[10px]">
                  {splits.map((s, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>{s.title}:</span>
                      <span className="font-bold font-mono">{formatCurrency(s.grandTotal)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-3 pt-2 border-t-2 border-dashed border-black text-center space-y-0.5 text-[10px]">
              <div className="font-bold">Thank you for dining with us!</div>
              <div className="text-[9px] text-zinc-600">
                ස්තූතියි! නැවත පැමිණෙන්න • நன்றி! மீண்டும் வருக
              </div>
              <div className="text-[8px] text-zinc-500 pt-1">
                LankaPOS Multi-Tenant Restaurant Engine
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-900 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition"
          >
            Close
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-md transition"
          >
            <Printer className="w-4 h-4" />
            <span>Print Guest Bill</span>
          </button>
        </div>
      </div>
    </div>
  );
}
