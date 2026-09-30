"use client";

import React from "react";
import BarcodeSvg from "./BarcodeSvg";
import { formatCurrency } from "@/lib/formatters";

export interface ProductBarcodeStickerProps {
  product: {
    name: string;
    sellingPrice: number;
    barcode?: string;
    sku?: string;
    unit?: string;
  };
  businessName?: string;
  showStoreName?: boolean;
  showDate?: boolean;
  packedDate?: string;
  className?: string;
}

export default function ProductBarcodeSticker({
  product,
  businessName = "SRI LANKA RETAIL",
  showStoreName = true,
  showDate = true,
  packedDate,
  className = "",
}: ProductBarcodeStickerProps) {
  const barcodeValue = product.barcode || product.sku || "00000000";
  const formattedDate = packedDate || new Date().toISOString().slice(0, 10);

  return (
    <div
      className={`product-barcode-sticker bg-white text-black p-1.5 font-sans border border-black rounded w-[50mm] h-[25mm] max-w-[200px] flex flex-col justify-between overflow-hidden shadow-sm print:shadow-none print:border-none print:p-1 ${className}`}
      style={{ boxSizing: "border-box" }}
    >
      {/* Top Header: Store & Product Title */}
      <div className="leading-tight">
        {showStoreName && (
          <div className="text-[7.5px] uppercase font-bold text-zinc-600 truncate text-center">
            {businessName}
          </div>
        )}
        <div className="font-bold text-[10px] truncate text-black leading-snug">
          {product.name}
        </div>
      </div>

      {/* Barcode in Center */}
      <div className="my-0.5 flex justify-center">
        <div className="w-[95%]">
          <BarcodeSvg
            value={barcodeValue}
            height={24}
            moduleWidth={1.2}
            includeText={true}
            fontSize={7.5}
          />
        </div>
      </div>

      {/* Bottom Footer: Price & Date/Unit */}
      <div className="flex justify-between items-baseline text-[8px] border-t border-zinc-300 pt-0.5 font-mono">
        <div className="text-zinc-600 truncate max-w-[90px]">
          {showDate ? `PKD: ${formattedDate}` : product.unit || ""}
        </div>
        <div className="font-extrabold text-[10.5px] text-black">
          Rs. {product.sellingPrice.toFixed(2)}
        </div>
      </div>
    </div>
  );
}
