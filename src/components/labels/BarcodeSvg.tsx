"use client";

import React, { useMemo } from "react";
import { encodeCode128 } from "@/lib/barcode";

export interface BarcodeSvgProps {
  value: string;
  height?: number;
  moduleWidth?: number;
  includeText?: boolean;
  fontSize?: number;
  className?: string;
}

export default function BarcodeSvg({
  value,
  height = 42,
  moduleWidth = 1.8,
  includeText = true,
  fontSize = 10,
  className = "",
}: BarcodeSvgProps) {
  const { bars, totalWidth } = useMemo(() => {
    return encodeCode128(value || "000000", moduleWidth);
  }, [value, moduleWidth]);

  const barHeight = includeText ? Math.max(16, height - fontSize - 4) : height;

  return (
    <div className={`inline-block ${className}`}>
      <svg
        viewBox={`0 0 ${totalWidth} ${height}`}
        className="w-full h-auto max-w-full block"
        style={{ maxHeight: `${height}px` }}
        shapeRendering="crispEdges"
      >
        {/* Background white */}
        <rect width={totalWidth} height={height} fill="#ffffff" />

        {/* Black bars */}
        {bars.map((bar, idx) => (
          <rect
            key={idx}
            x={bar.x}
            y={0}
            width={bar.width}
            height={barHeight}
            fill="#000000"
          />
        ))}

        {/* Human readable value below bars */}
        {includeText && (
          <text
            x={totalWidth / 2}
            y={height - 2}
            textAnchor="middle"
            fontFamily="monospace, monospace"
            fontSize={fontSize}
            fontWeight="bold"
            fill="#000000"
          >
            {value}
          </text>
        )}
      </svg>
    </div>
  );
}
