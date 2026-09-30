"use client";

import React from "react";
import BarcodeSvg from "./BarcodeSvg";
import { formatCurrency } from "@/lib/formatters";

export interface ShelfEdgeLabelProps {
  product: {
    name: string;
    sellingPrice: number;
    barcode?: string;
    sku?: string;
    category?: string;
    unit?: string;
  };
  businessName?: string;
  showStoreName?: boolean;
  showDate?: boolean;
  printDate?: string;
  className?: string;
}

export default function ShelfEdgeLabel({
  product,
  businessName = "SRI LANKA RETAIL",
  showStoreName = true,
  showDate = true,
  printDate,
  className = "",
}: ShelfEdgeLabelProps) {
  const barcodeValue = product.barcode || product.sku || "00000000";
  const formattedDate = printDate || new Date().toISOString().slice(0, 10);

  return (
    <div
      className={`shelf-edge-label bg-white text-black p-2.5 font-sans border-2 border-black rounded-lg w-[76mm] h-[48mm] max-w-[300px] flex flex-col justify-between overflow-hidden shadow-sm print:shadow-none print:border-black print:rounded-none ${className}`}
      style={{ boxSizing: "border-box" }}
    >
      {/* Top Banner: Store Name & Category */}
      <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-tight border-b border-black pb-1">
        {showStoreName && <span className="truncate max-w-[170px]">{businessName}</span>}
        <span className="text-zinc-600 text-[9px] truncate ml-auto">
          {product.category || "General"}
        </span>
      </div>

      {/* Middle Section: Product Name & Prominent Price */}
      <div className="my-1 flex-1 flex flex-col justify-between">
        <h3 className="font-extrabold text-sm leading-tight line-clamp-2 text-black tracking-tight">
          {product.name}
        </h3>

        <div className="flex items-baseline justify-between mt-1 pt-1 border-t border-dashed border-zinc-400">
          <div className="text-[10px] font-semibold text-zinc-600">
            {product.unit ? `Unit: ${product.unit}` : "Retail Price"}
          </div>

          <div className="text-right">
            <span className="text-xs font-bold text-black mr-0.5">Rs.</span>
            <span className="text-2xl font-black tracking-tight text-black">
              {product.sellingPrice.toLocaleString("en-LK", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Section: Barcode & Metadata */}
      <div className="pt-1 border-t border-black flex items-center justify-between gap-1">
        <div className="w-[145px] shrink-0">
          <BarcodeSvg
            value={barcodeValue}
            height={28}
            moduleWidth={1.3}
            includeText={true}
            fontSize={8}
          />
        </div>

        <div className="text-right text-[8.5px] font-mono leading-tight text-zinc-600">
          {product.sku && <div className="font-bold text-black truncate">SKU: {product.sku}</div>}
          {showDate && <div>{formattedDate}</div>}
        </div>
      </div>
    </div>
  );
}
