"use client";

import React from "react";
import ScaleBarcodeSvg from "./ScaleBarcodeSvg";
import { formatCurrency } from "@/lib/formatters";

export interface ScaleBarcodeStickerProps {
  storeName?: string;
  storePhone?: string;
  productName: string;
  productNameSinhala?: string;
  productNameTamil?: string;
  pluCode?: string;
  unitPrice: number;
  netWeightKg: number;
  tareGrams?: number;
  totalPrice: number;
  barcode: string;
  packedDate?: string;
  useByDate?: string;
  currency?: string;
  widthMm?: number; // default 58mm
  heightMm?: number; // default 40mm
  className?: string;
}

export default function ScaleBarcodeSticker({
  storeName = "CORNER STORE SUPER",
  storePhone,
  productName,
  productNameSinhala,
  productNameTamil,
  pluCode,
  unitPrice,
  netWeightKg,
  tareGrams = 5,
  totalPrice,
  barcode,
  packedDate,
  useByDate,
  currency = "Rs.",
  widthMm = 58,
  heightMm = 40,
  className = "",
}: ScaleBarcodeStickerProps) {
  const now = new Date();
  const formattedPackedDate =
    packedDate ||
    now.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }) +
      " " +
      now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const formattedUseBy =
    useByDate ||
    threeDaysLater.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  return (
    <div
      className={`bg-white text-black font-sans border border-slate-300 rounded p-2 flex flex-col justify-between select-none shadow-sm print:shadow-none print:border-none ${className}`}
      style={{
        width: `${widthMm}mm`,
        minHeight: `${heightMm}mm`,
        boxSizing: "border-box",
      }}
    >
      {/* Top Header: Store Name & Phone */}
      <div className="border-b border-black pb-0.5 mb-1 flex items-center justify-between text-[9px] uppercase tracking-wider font-extrabold">
        <span className="truncate max-w-[70%]">{storeName}</span>
        {storePhone && <span className="text-[8px] font-mono">{storePhone}</span>}
      </div>

      {/* Product Title & Translations */}
      <div className="leading-tight mb-1">
        <div className="font-black text-xs uppercase flex items-center justify-between">
          <span className="truncate">{productName}</span>
          {pluCode && (
            <span className="text-[9px] font-mono bg-black text-white px-1 py-0.2 rounded shrink-0">
              PLU {pluCode}
            </span>
          )}
        </div>
        {(productNameSinhala || productNameTamil) && (
          <div className="text-[9px] text-slate-700 font-medium truncate mt-0.5">
            {productNameSinhala} {productNameTamil ? `• ${productNameTamil}` : ""}
          </div>
        )}
      </div>

      {/* Grid: Unit Price, Net Weight, Tare, Dates */}
      <div className="grid grid-cols-2 gap-1 text-[9px] bg-slate-50 border border-slate-200 rounded p-1 mb-1 font-mono">
        <div>
          <span className="text-slate-500 block text-[7px] uppercase">Unit Price</span>
          <span className="font-bold">
            {currency} {unitPrice.toFixed(2)}/kg
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[7px] uppercase">Net Weight</span>
          <span className="font-extrabold text-[11px] text-black">
            {netWeightKg.toFixed(3)} kg
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[7px] uppercase">Tare / Pkd</span>
          <span className="text-[8px]">
            {tareGrams}g | {formattedPackedDate.split(" ")[0]}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[7px] uppercase">Best Before</span>
          <span className="text-[8px] font-bold">{formattedUseBy}</span>
        </div>
      </div>

      {/* Big Total Price Highlight */}
      <div className="flex items-center justify-between border-t border-b border-black py-0.5 my-0.5">
        <span className="text-[10px] font-black uppercase tracking-tight">TOTAL AMOUNT:</span>
        <span className="text-sm font-black font-mono tracking-tight">
          {currency} {totalPrice.toFixed(2)}
        </span>
      </div>

      {/* EAN-13 Scannable Barcode */}
      <div className="pt-0.5 flex flex-col items-center justify-center">
        <ScaleBarcodeSvg
          value={barcode}
          height={40}
          moduleWidth={1.4}
          includeText={true}
          fontSize={8}
          className="w-full flex justify-center"
        />
      </div>
    </div>
  );
}
