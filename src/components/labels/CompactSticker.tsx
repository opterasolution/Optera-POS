"use client";

import React from "react";
import BarcodeSvg from "./BarcodeSvg";

export interface CompactStickerProps {
  product: {
    name: string;
    sellingPrice: number;
    barcode?: string;
    sku?: string;
  };
  className?: string;
}

export default function CompactSticker({
  product,
  className = "",
}: CompactStickerProps) {
  const barcodeValue = product.barcode || product.sku || "00000000";

  return (
    <div
      className={`compact-sticker bg-white text-black p-1 font-sans border border-black rounded w-[38mm] h-[20mm] max-w-[160px] flex flex-col justify-between overflow-hidden shadow-sm print:shadow-none print:border-none print:p-0.5 ${className}`}
      style={{ boxSizing: "border-box" }}
    >
      <div className="flex justify-between items-baseline text-[8px] leading-tight">
        <span className="font-bold truncate max-w-[90px]">{product.name}</span>
        <span className="font-extrabold text-[9px] shrink-0">
          Rs. {Math.round(product.sellingPrice)}
        </span>
      </div>

      <div className="my-0.5 flex justify-center">
        <div className="w-[98%]">
          <BarcodeSvg
            value={barcodeValue}
            height={20}
            moduleWidth={1.0}
            includeText={true}
            fontSize={7}
          />
        </div>
      </div>
    </div>
  );
}
