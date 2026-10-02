"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Scale,
  X,
  RefreshCw,
  Check,
  Search,
  AlertCircle,
  Cpu,
  Minus,
  Plus,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { WebSerialScaleDriver, ScaleReading } from "@/lib/hardware/serial-scale";

export interface IWeighableProduct {
  _id: string;
  name: string;
  nameSinhala?: string;
  nameTamil?: string;
  barcode?: string;
  pluCode?: string;
  sellingPrice: number;
  costPrice: number;
  unit: string;
  stockQuantity: number;
  isWeighable?: boolean;
  tareWeightGrams?: number;
}

interface WeighingScaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: IWeighableProduct[];
  onAddWeighedItem: (product: IWeighableProduct, netWeightKg: number) => void;
  currency?: string;
}

export default function WeighingScaleModal({
  isOpen,
  onClose,
  products,
  onAddWeighedItem,
  currency = "LKR",
}: WeighingScaleModalProps) {
  const [selectedProduct, setSelectedProduct] = useState<IWeighableProduct | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [manualWeightInput, setManualWeightInput] = useState<string>("0.500");
  const [tareGrams, setTareGrams] = useState<number>(0);

  // Serial scale state
  const [isScaleConnected, setIsScaleConnected] = useState(false);
  const [scaleReading, setScaleReading] = useState<ScaleReading | null>(null);
  const [serialError, setSerialError] = useState<string | null>(null);
  const scaleDriverRef = useRef<WebSerialScaleDriver | null>(null);

  // Filter weighable products or general produce
  const weighableProducts = products.filter((p) => {
    const isWeightItem =
      p.isWeighable ||
      p.unit.toLowerCase().includes("kg") ||
      p.unit.toLowerCase().includes("g") ||
      Boolean(p.pluCode);

    if (!searchQuery.trim()) return isWeightItem;
    const q = searchQuery.toLowerCase().trim();
    return (
      isWeightItem &&
      (p.name.toLowerCase().includes(q) ||
        p.nameSinhala?.toLowerCase().includes(q) ||
        p.nameTamil?.toLowerCase().includes(q) ||
        p.pluCode?.includes(q) ||
        p.barcode?.includes(q))
    );
  });

  // When a product is selected, initialize tare from product if present
  useEffect(() => {
    if (selectedProduct) {
      setTareGrams(selectedProduct.tareWeightGrams || 0);
    }
  }, [selectedProduct]);

  // Connect Serial Scale
  const handleConnectScale = async () => {
    setSerialError(null);
    try {
      if (!WebSerialScaleDriver.isSupported()) {
        setSerialError("Web Serial API is not supported in this browser. Please use Google Chrome or MS Edge.");
        return;
      }

      const driver = new WebSerialScaleDriver();
      const success = await driver.connect(
        { baudRate: 9600 },
        (reading) => {
          setScaleReading(reading);
        },
        (err) => {
          setSerialError(err.message);
        }
      );

      if (success) {
        scaleDriverRef.current = driver;
        setIsScaleConnected(true);
      } else {
        setSerialError("Scale connection cancelled or port already in use.");
      }
    } catch (err: any) {
      setSerialError(err.message || "Failed to connect to scale.");
    }
  };

  // Disconnect scale on unmount
  useEffect(() => {
    return () => {
      if (scaleDriverRef.current) {
        scaleDriverRef.current.disconnect();
      }
    };
  }, []);

  if (!isOpen) return null;

  // Compute Active Net Weight
  const rawWeightKg = isScaleConnected && scaleReading
    ? scaleReading.weightKg
    : parseFloat(manualWeightInput) || 0;

  // Subtract container/packaging tare
  const netWeightKg = Math.max(0, Math.round((rawWeightKg - (tareGrams / 1000)) * 1000) / 1000);

  // Compute Total
  const unitPrice = selectedProduct?.sellingPrice || 0;
  const lineTotal = Math.round(unitPrice * netWeightKg * 100) / 100;

  const handleConfirmAdd = () => {
    if (!selectedProduct) return;
    if (netWeightKg <= 0) {
      alert("Net weight must be greater than 0 kg.");
      return;
    }
    onAddWeighedItem(selectedProduct, netWeightKg);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-800/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-teal-500/20">
              <Scale className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Weighing Scale Station
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-400 border border-teal-500/30">
                  CAS / Toledo / Avery
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Live RS-232 / USB scale streaming & produce weighing engine
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden p-6 gap-6">
          {/* Left: Product Selection */}
          <div className="w-full md:w-1/2 flex flex-col border border-slate-800 bg-slate-950/60 rounded-2xl overflow-hidden">
            <div className="p-3 border-b border-slate-800 bg-slate-900/80">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search produce by name, PLU or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {weighableProducts.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-sm">
                  No weighable products found. Check product "isWeighable" or unit="kg".
                </div>
              ) : (
                weighableProducts.map((p) => {
                  const isSelected = selectedProduct?._id === p._id;
                  return (
                    <button
                      key={p._id}
                      onClick={() => setSelectedProduct(p)}
                      className={`w-full p-3 rounded-xl flex items-center justify-between text-left transition-all ${
                        isSelected
                          ? "bg-teal-500/20 border-2 border-teal-500 text-white"
                          : "bg-slate-900/60 hover:bg-slate-800 border border-slate-800 text-slate-300"
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-sm flex items-center gap-1.5">
                          <span>{p.name}</span>
                          {p.pluCode && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-teal-300 border border-teal-500/30">
                              PLU: {p.pluCode}
                            </span>
                          )}
                        </div>
                        {(p.nameSinhala || p.nameTamil) && (
                          <div className="text-xs text-slate-400 mt-0.5">
                            {p.nameSinhala} {p.nameTamil ? `• ${p.nameTamil}` : ""}
                          </div>
                        )}
                        <div className="text-xs text-slate-500 mt-1">
                          Stock: {p.stockQuantity} {p.unit}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-bold text-teal-400 text-sm">
                          {currency} {p.sellingPrice.toFixed(2)}
                        </div>
                        <div className="text-[11px] text-slate-500">per {p.unit || "kg"}</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Scale & Weight Meter */}
          <div className="w-full md:w-1/2 flex flex-col justify-between space-y-4">
            {/* Scale Connection status card */}
            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div
                  className={`w-3 h-3 rounded-full ${
                    isScaleConnected ? "bg-emerald-400 animate-pulse" : "bg-slate-600"
                  }`}
                />
                <div>
                  <div className="text-sm font-semibold text-white">
                    {isScaleConnected ? "Electronic Scale Live" : "Serial Scale Disconnected"}
                  </div>
                  <div className="text-xs text-slate-400">
                    {isScaleConnected
                      ? "CAS / Toledo / Avery @ 9600 baud"
                      : "Use live USB/Serial or manual net entry"}
                  </div>
                </div>
              </div>

              {!isScaleConnected ? (
                <button
                  onClick={handleConnectScale}
                  className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-teal-900/30 transition-all"
                >
                  <Cpu className="w-3.5 h-3.5" /> Connect Scale
                </button>
              ) : (
                <button
                  onClick={() => {
                    scaleDriverRef.current?.disconnect();
                    setIsScaleConnected(false);
                    setScaleReading(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Disconnect
                </button>
              )}
            </div>

            {serialError && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{serialError}</span>
              </div>
            )}

            {/* Big LED Scale Weight Display */}
            <div className="p-6 bg-slate-950 border-2 border-teal-500/40 rounded-2xl shadow-inner text-center relative overflow-hidden">
              <span className="text-[11px] font-bold uppercase tracking-widest text-teal-400">
                {isScaleConnected ? "Live Scale Reading" : "Net Weight (KG)"}
              </span>

              <div className="text-6xl font-black font-mono tracking-tight text-white my-2 flex items-center justify-center gap-2">
                <span>{netWeightKg.toFixed(3)}</span>
                <span className="text-2xl font-bold text-teal-400">kg</span>
              </div>

              {/* Status / Stable pill */}
              <div className="flex items-center justify-center gap-4 text-xs mt-2">
                {isScaleConnected && scaleReading ? (
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-semibold border ${
                      scaleReading.isStable
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                    }`}
                  >
                    {scaleReading.isStable ? "STABLE" : "MOTION / WEIGHING"}
                  </span>
                ) : (
                  <span className="text-slate-500">Manual Entry Mode</span>
                )}

                {tareGrams > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                    Tare: -{tareGrams}g
                  </span>
                )}
              </div>
            </div>

            {/* Manual Weight / Tare Adjustment Controls */}
            <div className="grid grid-cols-2 gap-3">
              {/* Tare Box */}
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                <label className="text-[11px] font-medium text-slate-400 block mb-1">
                  Packaging Tare (Grams)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={tareGrams}
                    onChange={(e) => setTareGrams(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-sm font-mono text-white focus:outline-none focus:border-teal-500"
                  />
                  <button
                    onClick={() => setTareGrams(0)}
                    className="text-xs text-slate-400 hover:text-white px-2 py-1.5 rounded bg-slate-800"
                  >
                    Zero
                  </button>
                </div>
              </div>

              {/* Manual KG Input (when scale not connected) */}
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                <label className="text-[11px] font-medium text-slate-400 block mb-1">
                  Manual Weight (KG)
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      const cur = parseFloat(manualWeightInput) || 0;
                      setManualWeightInput(Math.max(0.05, Math.round((cur - 0.1) * 100) / 100).toFixed(3));
                    }}
                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    step="0.05"
                    min="0.01"
                    disabled={isScaleConnected}
                    value={manualWeightInput}
                    onChange={(e) => setManualWeightInput(e.target.value)}
                    className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-sm font-mono text-white text-center focus:outline-none focus:border-teal-500 disabled:opacity-50"
                  />
                  <button
                    onClick={() => {
                      const cur = parseFloat(manualWeightInput) || 0;
                      setManualWeightInput(Math.round((cur + 0.1) * 100 / 100).toFixed(3));
                    }}
                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Selected Product Calculation Summary */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400">Total Calculation</span>
                <div className="text-sm font-semibold text-white mt-0.5">
                  {selectedProduct ? selectedProduct.name : "Select a product"}
                </div>
                {selectedProduct && (
                  <div className="text-xs text-teal-400 font-mono mt-0.5">
                    {netWeightKg.toFixed(3)} kg × {currency} {unitPrice.toFixed(2)}
                  </div>
                )}
              </div>

              <div className="text-right">
                <span className="text-xs text-slate-400">Item Total</span>
                <div className="text-2xl font-black font-mono text-emerald-400">
                  {currency} {lineTotal.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedProduct || netWeightKg <= 0}
                onClick={handleConfirmAdd}
                className="flex-[2] py-3 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 disabled:opacity-50 disabled:pointer-events-none transition-all"
              >
                <Check className="w-4 h-4" /> Add Weighed Item to Cart
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
