"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { QrCode as QrIcon } from "lucide-react";

interface QRCodeImageProps {
  value: string;
  size?: number;
  className?: string;
  alt?: string;
  margin?: number;
  darkColor?: string;
  lightColor?: string;
}

export default function QRCodeImage({
  value,
  size = 128,
  className = "",
  alt = "QR Code",
  margin = 1,
  darkColor = "#000000",
  lightColor = "#ffffff",
}: QRCodeImageProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    if (!value) {
      setDataUrl(null);
      return;
    }

    QRCode.toDataURL(value, {
      width: size * 2, // 2x for sharp retina/thermal print resolution
      margin,
      color: {
        dark: darkColor,
        light: lightColor,
      },
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (isMounted) {
          setDataUrl(url);
          setError(false);
        }
      })
      .catch((err) => {
        console.error("Failed to render QR Code:", err);
        if (isMounted) setError(true);
      });

    return () => {
      isMounted = false;
    };
  }, [value, size, margin, darkColor, lightColor]);

  if (error || !value) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-100 border border-slate-200 text-slate-400 rounded ${className}`}
        style={{ width: size, height: size }}
      >
        <QrIcon className="w-6 h-6 opacity-40" />
      </div>
    );
  }

  if (!dataUrl) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-50 border border-dashed border-slate-200 animate-pulse rounded ${className}`}
        style={{ width: size, height: size }}
      >
        <QrIcon className="w-5 h-5 text-slate-300" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      alt={alt}
      width={size}
      height={size}
      className={`inline-block ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
