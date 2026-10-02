"use client";

import React from "react";
import QRCodeImage from "@/components/common/QRCodeImage";
import { formatCurrency } from "@/lib/formatters";

export interface DeliveryDispatchSlipData {
  orderId: string;
  externalOrderId: string;
  platform: "PICKME_FOOD" | "PICKME_FLASH" | "UBER_EATS" | "DIRECT_STORE";
  storeName: string;
  storePhone?: string;
  storeAddress?: string;
  createdAt: string | Date;
  prepTimeMinutes: number;
  scheduledPrepEnd?: string | Date;
  customer: {
    name: string;
    phone: string;
    deliveryAddress: string;
    deliveryNotes?: string;
  };
  items: Array<{
    name: string;
    nameSinhala?: string;
    nameTamil?: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    unit?: string;
    specialInstructions?: string;
  }>;
  financials: {
    subtotal: number;
    platformDiscount?: number;
    merchantDiscount?: number;
    platformCommissionPercent: number;
    platformCommissionAmount: number;
    estimatedNetPayout: number;
    deliveryFee?: number;
    totalBill: number;
  };
  rider?: {
    name?: string;
    phone?: string;
    vehicleNumber?: string;
    vehicleType?: string;
    pickupPin: string;
  };
  paperWidth?: "58mm" | "80mm";
}

export default function DeliveryDispatchSlip({
  data,
  paperWidth = "80mm",
}: {
  data: DeliveryDispatchSlipData;
  paperWidth?: "58mm" | "80mm";
}) {
  const is58mm = paperWidth === "58mm";
  const createdDate = new Date(data.createdAt);
  const formattedTime = createdDate.toLocaleTimeString("en-LK", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const formattedDate = createdDate.toLocaleDateString("en-LK", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const targetTime = data.scheduledPrepEnd
    ? new Date(data.scheduledPrepEnd).toLocaleTimeString("en-LK", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : null;

  const platformTitle =
    data.platform === "PICKME_FOOD"
      ? "PICKME FOOD DELIVERY"
      : data.platform === "PICKME_FLASH"
      ? "PICKME FLASH ON-DEMAND"
      : data.platform === "UBER_EATS"
      ? "UBER EATS SRI LANKA"
      : "DIRECT STORE DELIVERY";

  return (
    <div
      className={`bg-white text-black font-mono text-xs p-3 leading-tight mx-auto border border-dashed border-slate-300 print:border-none print:p-0 ${
        is58mm ? "w-[58mm] max-w-[58mm]" : "w-[80mm] max-w-[80mm]"
      }`}
    >
      {/* Header Banner */}
      <div className="text-center pb-2 border-b border-black">
        <div className="text-[11px] font-black uppercase tracking-wider bg-black text-white px-2 py-0.5 rounded-sm inline-block mb-1">
          {platformTitle}
        </div>
        <div className="font-extrabold text-sm">{data.storeName}</div>
        {data.storeAddress && <div className="text-[10px] text-gray-700">{data.storeAddress}</div>}
        {data.storePhone && <div className="text-[10px]">Tel: {data.storePhone}</div>}
      </div>

      {/* Big Order ID & Rider Pickup PIN */}
      <div className="text-center py-2.5 border-b-2 border-black">
        <div className="text-[10px] uppercase font-bold tracking-widest text-gray-600">
          Order Identifier
        </div>
        <div className="text-xl font-black tracking-tight">{data.externalOrderId}</div>

        {/* Rider Pickup Verification Box */}
        {data.rider?.pickupPin && (
          <div className="mt-2 border-2 border-black bg-gray-50 py-1.5 px-2 rounded text-center">
            <div className="text-[9px] uppercase font-black tracking-wider text-gray-700">
              RIDER PICKUP PIN
            </div>
            <div className="text-2xl font-black tracking-widest text-black">
              {data.rider.pickupPin}
            </div>
            <div className="text-[8px] text-gray-500 uppercase mt-0.5">
              Verify PIN with delivery partner before handover
            </div>
          </div>
        )}
      </div>

      {/* Timestamp & Prep Target */}
      <div className="py-2 border-b border-gray-400 text-[10px] space-y-0.5">
        <div className="flex justify-between">
          <span>Placed:</span>
          <span className="font-bold">
            {formattedDate} {formattedTime}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Est. Prep Time:</span>
          <span className="font-bold">{data.prepTimeMinutes} mins</span>
        </div>
        {targetTime && (
          <div className="flex justify-between text-black font-extrabold">
            <span>Ready by:</span>
            <span>{targetTime}</span>
          </div>
        )}
        {data.rider?.vehicleNumber && (
          <div className="flex justify-between">
            <span>Rider Vehicle:</span>
            <span className="font-bold">
              {data.rider.vehicleNumber} ({data.rider.vehicleType || "BIKE"})
            </span>
          </div>
        )}
      </div>

      {/* Customer Delivery Details */}
      <div className="py-2 border-b border-gray-400">
        <div className="text-[10px] font-bold uppercase text-gray-700">Deliver To:</div>
        <div className="font-bold text-[11px]">{data.customer.name}</div>
        <div className="text-[10px]">{data.customer.phone}</div>
        <div className="text-[10px] whitespace-pre-wrap mt-0.5 font-sans">
          {data.customer.deliveryAddress}
        </div>
        {data.customer.deliveryNotes && (
          <div className="mt-1 p-1 bg-gray-100 border border-gray-300 rounded text-[9px] font-sans">
            <strong>Customer Note:</strong> {data.customer.deliveryNotes}
          </div>
        )}
      </div>

      {/* Itemized Kitchen Prep List */}
      <div className="py-2 border-b-2 border-black">
        <div className="text-[10px] font-black uppercase tracking-wider mb-1.5 flex justify-between">
          <span>ITEMS TO PACK</span>
          <span>QTY</span>
        </div>

        <div className="divide-y divide-gray-200">
          {data.items.map((item, idx) => (
            <div key={idx} className="py-1.5">
              <div className="flex items-start justify-between">
                <div className="flex-1 pr-2">
                  <span className="font-bold text-xs">{item.name}</span>
                  {(item.nameSinhala || item.nameTamil) && (
                    <div className="text-[9px] text-gray-600 font-sans">
                      {[item.nameSinhala, item.nameTamil].filter(Boolean).join(" • ")}
                    </div>
                  )}
                  {item.specialInstructions && (
                    <div className="text-[9px] text-red-700 font-bold italic mt-0.5">
                      ⚠️ Note: {item.specialInstructions}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <span className="font-black text-sm px-1.5 py-0.5 bg-black text-white rounded">
                    {item.quantity}
                  </span>
                </div>
              </div>
              <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
                <span>@{formatCurrency(item.unitPrice)}</span>
                <span>{formatCurrency(item.lineTotal)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Financials & Platform Commission Breakdown */}
      <div className="py-2 border-b border-black text-[10px] space-y-1">
        <div className="flex justify-between">
          <span>Order Subtotal:</span>
          <span className="font-bold">{formatCurrency(data.financials.subtotal)}</span>
        </div>

        {data.financials.platformDiscount && data.financials.platformDiscount > 0 ? (
          <div className="flex justify-between text-gray-700">
            <span>Platform Discount:</span>
            <span>-{formatCurrency(data.financials.platformDiscount)}</span>
          </div>
        ) : null}

        <div className="flex justify-between text-gray-600">
          <span>Commission ({data.financials.platformCommissionPercent}%):</span>
          <span>-{formatCurrency(data.financials.platformCommissionAmount)}</span>
        </div>

        <div className="h-px bg-gray-300 my-1" />

        <div className="flex justify-between text-xs font-black">
          <span>EST. NET PAYOUT:</span>
          <span>{formatCurrency(data.financials.estimatedNetPayout)}</span>
        </div>
      </div>

      {/* QR Code and Footer */}
      <div className="text-center pt-3 flex flex-col items-center">
        <QRCodeImage value={data.externalOrderId} size={64} className="w-16 h-16" />
        <div className="text-[8px] text-gray-500 uppercase tracking-widest mt-1">
          Scan to verify order in POS
        </div>
        <div className="text-[8px] text-gray-400 mt-0.5">
          Corner Store POS • Sri Lanka Delivery Hub
        </div>
      </div>
    </div>
  );
}
