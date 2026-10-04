"use client";

import React, { useMemo } from "react";
import { generateEan13Svg } from "@/lib/hardware/barcode-scale";

export interface ScaleBarcodeSvgProps {
  value: string;
  height?: number;
  moduleWidth?: number;
  includeText?: boolean;
  fontSize?: number;
  className?: string;
}

export default function ScaleBarcodeSvg({
  value,
  height = 52,
  moduleWidth = 1.9,
  includeText = true,
  fontSize = 11,
  className = "",
}: ScaleBarcodeSvgProps) {
  const { svgMarkup } = useMemo(() => {
    return generateEan13Svg({
      barcode: value || "2100000000000",
      height,
      moduleWidth,
      includeText,
      fontSize,
    });
  }, [value, height, moduleWidth, includeText, fontSize]);

  return (
    <div
      className={`inline-block select-none ${className}`}
      dangerouslySetInnerHTML={{ __html: svgMarkup }}
    />
  );
}
