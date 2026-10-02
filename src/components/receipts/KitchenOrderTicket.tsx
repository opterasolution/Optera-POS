"use client";

import React, { useRef } from "react";
import { Printer, X, Clock, AlertTriangle, ChefHat } from "lucide-react";
import { IKitchenTicket } from "@/models/KitchenTicket";

interface KitchenOrderTicketProps {
  ticket: IKitchenTicket | any;
  businessName?: string;
  stationName?: string;
  onClose?: () => void;
}

export default function KitchenOrderTicket({
  ticket,
  businessName = "Corner Store & Restaurant",
  stationName,
  onClose,
}: KitchenOrderTicketProps) {
  const [printWidth, setPrintWidth] = React.useState<"58mm" | "80mm">("80mm");
  const ticketRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const is80mm = printWidth === "80mm";
  const effectiveStation = stationName || ticket.station || "ALL STATIONS";

  const totalPortions = (ticket.items || []).reduce(
    (sum: number, it: any) => sum + (Number(it.quantity) || 0),
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl overflow-hidden my-8">
        {/* Modal Controls Header */}
        <div className="flex items-center justify-between border-b border-zinc-700/80 bg-zinc-800/90 px-4 py-3 text-white">
          <div className="flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-amber-400" />
            <span className="font-bold text-sm tracking-wide">
              Kitchen Order Ticket (KOT)
            </span>
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
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-700 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Printable Ticket Area */}
        <div className="flex justify-center bg-zinc-950/70 p-4 max-h-[70vh] overflow-y-auto">
          <div
            ref={ticketRef}
            id="kot-printable-area"
            style={{ width: is80mm ? "76mm" : "54mm" }}
            className="bg-white text-black font-mono text-[11px] leading-tight p-3 shadow-md rounded-xs border border-zinc-300"
          >
            {/* Header */}
            <div className="text-center pb-2 border-b-2 border-dashed border-black">
              <div className="font-extrabold text-sm uppercase tracking-wider">
                *** KITCHEN ORDER TICKET ***
              </div>
              <div className="text-[12px] font-bold mt-0.5">{businessName}</div>
              <div className="mt-1 inline-block bg-black text-white px-2 py-0.5 font-black text-xs uppercase rounded-xs">
                STATION: {effectiveStation}
              </div>
            </div>

            {/* Ticket Info Box */}
            <div className="py-2 border-b border-dashed border-black space-y-1">
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] text-zinc-600 uppercase font-bold">Ticket:</span>
                <span className="font-black text-base">{ticket.ticketNumber || "KOT-001"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] text-zinc-600 uppercase font-bold">Order Ref:</span>
                <span className="font-bold">{ticket.orderNumber || "INV-000"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] text-zinc-600 uppercase font-bold">Type / Table:</span>
                <span className="font-extrabold uppercase bg-zinc-200 px-1">
                  {ticket.orderType} • {ticket.tableOrCustomer}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] text-zinc-600 uppercase font-bold">Server / Cashier:</span>
                <span>{ticket.serverName || "Staff"}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-zinc-600 uppercase font-bold">Time In:</span>
                <span>{new Date(ticket.createdAt || Date.now()).toLocaleTimeString()}</span>
              </div>
              {ticket.priority === "RUSH" && (
                <div className="bg-black text-white text-center font-black py-0.5 text-xs animate-pulse">
                  🔥 !!! RUSH ORDER - PRIORITY !!! 🔥
                </div>
              )}
            </div>

            {/* Items Header */}
            <div className="pt-2 pb-1 flex justify-between font-black text-[11px] border-b border-black">
              <span>QTY & ITEM DESCRIPTION</span>
            </div>

            {/* Item List */}
            <div className="py-1 divide-y divide-zinc-200 space-y-1.5">
              {(ticket.items || []).map((item: any, idx: number) => (
                <div key={idx} className="pt-1.5 first:pt-0">
                  <div className="flex items-start gap-1.5">
                    <span className="font-black text-sm min-w-[28px] text-black">
                      [{item.quantity}x]
                    </span>
                    <div className="flex-1 font-bold text-xs">
                      <div>{item.name}</div>
                      {item.nameSi && (
                        <div className="text-[10px] text-zinc-700">{item.nameSi}</div>
                      )}
                      {item.nameTa && (
                        <div className="text-[10px] text-zinc-700">{item.nameTa}</div>
                      )}
                    </div>
                  </div>

                  {item.notes && (
                    <div className="mt-1 pl-7 font-black text-[10px] text-black bg-zinc-100 p-0.5 border-l-2 border-black">
                      NOTE: {item.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* General Ticket Notes */}
            {ticket.notes && (
              <div className="mt-2 p-1 border border-black bg-zinc-50 font-bold text-[10px]">
                ORDER NOTE: {ticket.notes}
              </div>
            )}

            {/* Footer */}
            <div className="mt-3 pt-2 border-t-2 border-dashed border-black text-center space-y-1">
              <div className="flex justify-between font-black text-xs">
                <span>TOTAL ITEMS / PORTIONS:</span>
                <span>{totalPortions}</span>
              </div>
              <div className="text-[10px] text-zinc-600">
                Target Prep: {ticket.targetPrepMinutes || 15} mins • Fast Order Turnaround
              </div>
              <div className="font-extrabold text-[10px] tracking-wider pt-1">
                *** END OF KOT ***
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-900/90 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            Close
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-md transition"
          >
            <Printer className="w-4 h-4" />
            <span>Print KOT</span>
          </button>
        </div>
      </div>
    </div>
  );
}
