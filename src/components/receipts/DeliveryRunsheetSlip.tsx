"use client";

import React from "react";
import QRCodeImage from "@/components/common/QRCodeImage";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";
import { Printer } from "lucide-react";

export interface DeliveryRunsheetSlipData {
  tripNumber: string;
  storeName: string;
  storePhone?: string;
  storeAddress?: string;
  dispatchedAt?: string | Date;
  driverName: string;
  driverPhone: string;
  vehicleType: string;
  vehicleNumber: string;
  totalStops: number;
  completedStops?: number;
  totalCodExpected: number;
  totalCodCollected?: number;
  stops: Array<{
    stopSequence: number;
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    deliveryAddress: string;
    deliveryNotes?: string;
    isCod: boolean;
    codAmount: number;
    status: string;
  }>;
  notes?: string;
  driverPortalUrl?: string;
}

export default function DeliveryRunsheetSlip({
  data,
  onPrint,
}: {
  data: DeliveryRunsheetSlipData;
  onPrint?: () => void;
}) {
  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  return (
    <div className="bg-white p-6 max-w-3xl mx-auto border border-slate-200 rounded-2xl shadow-sm text-slate-800 font-sans print:p-0 print:border-none print:shadow-none print:max-w-none">
      {/* Top action bar - Hidden during print */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 print:hidden">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Delivery Runsheet & Trip Manifest</h2>
          <p className="text-xs text-slate-500">Trip #{data.tripNumber}</p>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
        >
          <Printer className="w-4 h-4" />
          <span>Print Manifest</span>
        </button>
      </div>

      {/* Manifest Printable Body */}
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b-2 border-slate-900">
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">
              {data.storeName}
            </h1>
            {data.storeAddress && (
              <p className="text-xs text-slate-600 mt-0.5">{data.storeAddress}</p>
            )}
            {data.storePhone && (
              <p className="text-xs text-slate-600 font-mono">Tel: {data.storePhone}</p>
            )}
            <div className="mt-2 inline-block px-2.5 py-1 bg-slate-900 text-white rounded font-mono font-bold text-xs uppercase">
              Trip Manifest: {data.tripNumber}
            </div>
          </div>

          <div className="text-right sm:text-right flex flex-col sm:items-end">
            <span className="text-[10px] uppercase font-bold text-slate-400">Dispatch Time</span>
            <span className="text-xs font-mono font-bold text-slate-900">
              {data.dispatchedAt ? formatSLDateTime(data.dispatchedAt) : "Pending Dispatch"}
            </span>

            {data.driverPortalUrl && (
              <div className="mt-2 flex items-center gap-2">
                <div className="text-right text-[10px] text-slate-500 hidden sm:block">
                  Driver Mobile App<br />Scan to Open
                </div>
                <QRCodeImage value={data.driverPortalUrl} size={64} className="border border-slate-200 rounded p-1" />
              </div>
            )}
          </div>
        </div>

        {/* Driver & Vehicle Meta */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Assigned Driver</span>
            <span className="font-bold text-slate-900">{data.driverName}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Driver Contact</span>
            <span className="font-mono text-slate-800">{data.driverPhone}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Vehicle</span>
            <span className="font-medium text-slate-800">
              {data.vehicleType?.replace("_", " ")} ({data.vehicleNumber})
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Expected COD</span>
            <span className="font-mono font-black text-amber-700">
              {formatCurrency(data.totalCodExpected)}
            </span>
          </div>
        </div>

        {/* Stops Sequence Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 w-12 text-center">Stop</th>
                <th className="py-2.5 px-3">Order / Customer</th>
                <th className="py-2.5 px-3">Delivery Address</th>
                <th className="py-2.5 px-3 text-right">Payment / COD</th>
                <th className="py-2.5 px-3 w-32 text-center">Customer Sig.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.stops.map((stop) => (
                <tr key={stop.stopSequence} className="align-top">
                  <td className="py-3 px-3 text-center">
                    <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold font-mono text-xs flex items-center justify-center mx-auto">
                      {stop.stopSequence}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-bold text-slate-900">{stop.orderNumber}</div>
                    <div className="font-medium text-slate-700">{stop.customerName}</div>
                    <div className="text-[11px] font-mono text-slate-500">{stop.customerPhone}</div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-medium text-slate-800">{stop.deliveryAddress}</div>
                    {stop.deliveryNotes && (
                      <div className="text-[10px] text-amber-800 italic mt-0.5">
                        Note: {stop.deliveryNotes}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right">
                    {stop.isCod ? (
                      <div>
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 font-bold text-[10px] rounded border border-amber-300">
                          COD
                        </span>
                        <div className="font-mono font-bold text-slate-900 mt-0.5">
                          {formatCurrency(stop.codAmount)}
                        </div>
                      </div>
                    ) : (
                      <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded">
                        PAID ONLINE
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <div className="h-10 border border-dashed border-slate-300 rounded bg-slate-50 flex items-end justify-center pb-1 text-[9px] text-slate-400">
                      Sign here
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-bold">
              <tr>
                <td colSpan={3} className="py-2.5 px-3 text-right">
                  Total Delivery Stops: {data.totalStops} | Total COD To Collect:
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-sm text-amber-900 font-black">
                  {formatCurrency(data.totalCodExpected)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Cash Handover & Sign-Off Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200 text-xs">
          <div className="p-3 border border-slate-200 rounded-xl space-y-3">
            <span className="font-bold text-slate-900 block uppercase tracking-wider text-[10px]">
              Driver Departure & Handover Declaration
            </span>
            <p className="text-[11px] text-slate-500">
              I acknowledge receipt of {data.totalStops} parcels and agree to collect {formatCurrency(data.totalCodExpected)} in cash on delivery.
            </p>
            <div className="pt-6 border-b border-dashed border-slate-300"></div>
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>Driver Signature</span>
              <span>Date & Time</span>
            </div>
          </div>

          <div className="p-3 border border-slate-200 rounded-xl space-y-3">
            <span className="font-bold text-slate-900 block uppercase tracking-wider text-[10px]">
              Store Cashier Return & Cash Reconciliation
            </span>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-600">Actual Cash Received:</span>
              <span className="font-mono font-bold border-b border-slate-400 min-w-[120px] text-right">
                Rs. ______________
              </span>
            </div>
            <div className="pt-6 border-b border-dashed border-slate-300"></div>
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>Cashier Signature</span>
              <span>Reconciled Date</span>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center pt-2 text-[10px] text-slate-400">
          Generated by Sri Lanka POS Commercial Delivery Fleet Logistics • Thank you for your service!
        </div>
      </div>
    </div>
  );
}
