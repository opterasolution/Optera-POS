"use client";

import React from "react";
import BarcodeSvg from "./BarcodeSvg";

export interface A4LabelItem {
  name: string;
  sellingPrice: number;
  barcode?: string;
  sku?: string;
  unit?: string;
}

export interface A4LabelSheetProps {
  items: A4LabelItem[];
  businessName?: string;
  showStoreName?: boolean;
  showDate?: boolean;
  printDate?: string;
  className?: string;
}

export default function A4LabelSheet({
  items,
  businessName = "SRI LANKA RETAIL",
  showStoreName = true,
  showDate = true,
  printDate,
  className = "",
}: A4LabelSheetProps) {
  const formattedDate = printDate || new Date().toISOString().slice(0, 10);
  const LABELS_PER_PAGE = 24; // 3 cols x 8 rows

  // Chunk items into pages of 24
  const pages: A4LabelItem[][] = [];
  for (let i = 0; i < items.length; i += LABELS_PER_PAGE) {
    pages.push(items.slice(i, i + LABELS_PER_PAGE));
  }

  return (
    <div className={`a4-label-container ${className}`}>
      {pages.map((pageItems, pageIdx) => (
        <div
          key={pageIdx}
          className="a4-sheet bg-white p-4 mx-auto shadow-md print:shadow-none print:p-2 mb-8 print:mb-0 border border-zinc-200 print:border-none"
          style={{
            width: "210mm",
            minHeight: "297mm",
            pageBreakAfter: pageIdx < pages.length - 1 ? "always" : "auto",
            boxSizing: "border-box",
          }}
        >
          <div className="grid grid-cols-3 gap-2.5">
            {pageItems.map((prod, idx) => {
              const barcodeValue = prod.barcode || prod.sku || "00000000";
              return (
                <div
                  key={idx}
                  className="label-cell border border-zinc-300 print:border-zinc-400 p-2 rounded flex flex-col justify-between h-[34mm] overflow-hidden bg-white"
                  style={{ boxSizing: "border-box" }}
                >
                  <div className="flex justify-between items-start leading-tight">
                    <div className="truncate max-w-[120px]">
                      {showStoreName && (
                        <span className="text-[7.5px] uppercase font-bold text-zinc-500 block truncate">
                          {businessName}
                        </span>
                      )}
                      <span className="font-bold text-[10px] text-black truncate block">
                        {prod.name}
                      </span>
                    </div>
                    <span className="font-black text-xs text-black shrink-0">
                      Rs. {prod.sellingPrice.toFixed(2)}
                    </span>
                  </div>

                  <div className="my-1 flex justify-center">
                    <div className="w-[95%]">
                      <BarcodeSvg
                        value={barcodeValue}
                        height={24}
                        moduleWidth={1.2}
                        includeText={true}
                        fontSize={8}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[7.5px] text-zinc-500 font-mono border-t border-zinc-200 pt-0.5">
                    <span>{prod.sku ? `SKU: ${prod.sku}` : prod.unit || ""}</span>
                    {showDate && <span>{formattedDate}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
