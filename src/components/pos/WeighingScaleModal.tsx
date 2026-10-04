"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Scale,
  X,
  Check,
  Search,
  AlertCircle,
  Cpu,
  Minus,
  Plus,
  Zap,
  Printer,
  Hash,
  CheckCircle2,
} from "lucide-react";
import {
  WebSerialScaleDriver,
  ScaleReading,
  ScaleSimulator,
  ScaleModel,
} from "@/lib/hardware/serial-scale";
import { generateScaleBarcode } from "@/lib/hardware/barcode-scale";
import ScaleBarcodeSticker from "@/components/labels/ScaleBarcodeSticker";

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
  category?: string;
}

interface WeighingScaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: IWeighableProduct[];
  onAddWeighedItem: (product: IWeighableProduct, netWeightKg: number) => void;
  initialProduct?: IWeighableProduct | null;
  currency?: string;
  businessName?: string;
}

export default function WeighingScaleModal({
  isOpen,
  onClose,
  products,
  onAddWeighedItem,
  initialProduct = null,
  currency = "LKR",
  businessName = "Corner Store Supermarket",
}: WeighingScaleModalProps) {
  const [selectedProduct, setSelectedProduct] = useState<IWeighableProduct | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [manualWeightInput, setManualWeightInput] = useState<string>("0.500");
  const [tareGrams, setTareGrams] = useState<number>(5);

  // Serial scale state
  const [isScaleConnected, setIsScaleConnected] = useState(false);
  const [scaleReading, setScaleReading] = useState<ScaleReading | null>(null);
  const [serialError, setSerialError] = useState<string | null>(null);
  const scaleDriverRef = useRef<WebSerialScaleDriver | null>(null);

  // Simulator
  const [useSimulator, setUseSimulator] = useState(false);
  const simulatorRef = useRef<ScaleSimulator | null>(null);

  // Filter weighable products
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

  // Initialize simulator
  useEffect(() => {
    const sim = new ScaleSimulator((reading) => {
      setScaleReading(reading);
    });
    simulatorRef.current = sim;

    return () => {
      if (scaleDriverRef.current) {
        scaleDriverRef.current.disconnect();
      }
    };
  }, []);

  // When opened or initialProduct changes
  useEffect(() => {
    if (initialProduct) {
      setSelectedProduct(initialProduct);
      setTareGrams(initialProduct.tareWeightGrams || 5);
    } else if (weighableProducts.length > 0 && !selectedProduct) {
      setSelectedProduct(weighableProducts[0]);
    }
  }, [initialProduct, isOpen]);

  // When a product is selected, initialize tare
  useEffect(() => {
    if (selectedProduct && selectedProduct.tareWeightGrams !== undefined) {
      setTareGrams(selectedProduct.tareWeightGrams);
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
        setUseSimulator(false);
      }
    } catch (err: any) {
      setSerialError(err.message || "Failed to connect to scale.");
    }
  };

  const handleDisconnectScale = async () => {
    if (scaleDriverRef.current) {
      await scaleDriverRef.current.disconnect();
      scaleDriverRef.current = null;
    }
    setIsScaleConnected(false);
    setScaleReading(null);
  };

  const handleToggleSimulator = () => {
    if (!useSimulator) {
      if (isScaleConnected) handleDisconnectScale();
      setUseSimulator(true);
      simulatorRef.current?.placeWeight(0.85);
    } else {
      setUseSimulator(false);
      setScaleReading(null);
    }
  };

  const handleZeroScale = async () => {
    if (isScaleConnected && scaleDriverRef.current) {
      await scaleDriverRef.current.sendZero();
    } else if (useSimulator && simulatorRef.current) {
      simulatorRef.current.zero();
    } else {
      setManualWeightInput("0.000");
    }
  };

  const handleTareScale = async () => {
    if (isScaleConnected && scaleDriverRef.current) {
      await scaleDriverRef.current.sendTare();
    } else if (useSimulator && simulatorRef.current) {
      simulatorRef.current.setTare(tareGrams);
    }
  };

  if (!isOpen) return null;

  // Active Weights
  const isLiveOrSim = (isScaleConnected || useSimulator) && scaleReading;
  const rawWeightKg = isLiveOrSim
    ? scaleReading.weightKg
    : parseFloat(manualWeightInput) || 0;

  const netWeightKg = isLiveOrSim
    ? Math.max(0, Math.round((rawWeightKg - (tareGrams / 1000)) * 1000) / 1000)
    : Math.max(0, Math.round(rawWeightKg * 1000) / 1000);

  // Line calculations
  const unitPrice = selectedProduct?.sellingPrice || 0;
  const lineTotal = Math.round(unitPrice * netWeightKg * 100) / 100;

  // Generated EAN-13
  const generatedBarcode = selectedProduct
    ? generateScaleBarcode({
        type: "WEIGHT",
        pluCode: selectedProduct.pluCode || "101",
        weightKg: netWeightKg,
      })
    : "2100000000000";

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
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-teal-500/20">
              <Scale className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Weighing Scale Station
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-400 border border-teal-500/30">
                  Live POS Integration
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Direct RS-232 / USB scale streaming with tare deduction & EAN-13 variable barcodes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleSimulator}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                useSimulator
                  ? "bg-purple-600 text-white shadow-md shadow-purple-900/30"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              {useSimulator ? "Simulator ON" : "Simulate"}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
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
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 max-h-[380px]">
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
                              PLU: #{p.pluCode}
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
                        <div className="font-bold text-teal-400 text-sm font-mono">
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
          <div className="w-full md:w-1/2 flex flex-col justify-between space-y-3">
            {/* Scale Connection status card */}
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div
                  className={`w-3 h-3 rounded-full ${
                    isScaleConnected || useSimulator
                      ? "bg-emerald-400 animate-pulse"
                      : "bg-slate-600"
                  }`}
                />
                <div>
                  <div className="text-sm font-semibold text-white">
                    {isScaleConnected
                      ? "Electronic Scale Connected"
                      : useSimulator
                      ? "Scale Simulator Running"
                      : "Scale Disconnected"}
                  </div>
                  <div className="text-xs text-slate-400">
                    {isScaleConnected
                      ? "CAS / Toledo / Avery via RS-232"
                      : useSimulator
                      ? "Interactive Platter Test Mode"
                      : "Connect USB/Serial port or enter manually"}
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
                  onClick={handleDisconnectScale}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Disconnect
                </button>
              )}
            </div>

            {serialError && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{serialError}</span>
              </div>
            )}

            {/* Big LED Scale Weight Display */}
            <div className="p-5 bg-black border-2 border-teal-500/50 rounded-2xl shadow-inner text-center relative overflow-hidden">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="uppercase tracking-widest text-teal-400">
                  {isLiveOrSim ? "Live Scale Platter" : "Net Weight (KG)"}
                </span>

                <span
                  className={`px-2 py-0.5 rounded-full text-[9px] border font-bold ${
                    isLiveOrSim && scaleReading?.isStable
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                      : isLiveOrSim
                      ? "bg-amber-500/20 text-amber-400 border-amber-500/40 animate-pulse"
                      : "bg-slate-800 text-slate-400 border-slate-700"
                  }`}
                >
                  {isLiveOrSim
                    ? scaleReading?.isStable
                      ? "STABLE"
                      : "MOTION"
                    : "MANUAL"}
                </span>
              </div>

              <div className="text-5xl font-black font-mono tracking-tight text-white my-2 flex items-center justify-center gap-2">
                <span className="tabular-nums">{netWeightKg.toFixed(3)}</span>
                <span className="text-2xl font-bold text-teal-400">kg</span>
              </div>

              {/* Sub-weights */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-900 text-center font-mono text-[10px]">
                <div>
                  <span className="text-slate-500 block uppercase">Gross</span>
                  <span className="text-slate-300 font-bold">{rawWeightKg.toFixed(3)} kg</span>
                </div>
                <div>
                  <span className="text-slate-500 block uppercase">Tare</span>
                  <span className="text-amber-400 font-bold">-{tareGrams} g</span>
                </div>
                <div>
                  <span className="text-slate-500 block uppercase">Net Wt</span>
                  <span className="text-emerald-400 font-bold">{netWeightKg.toFixed(3)} kg</span>
                </div>
              </div>
            </div>

            {/* Scale Control / Tare Presets */}
            <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex gap-1.5">
                  <button
                    onClick={handleZeroScale}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold"
                  >
                    Zero (Z)
                  </button>
                  <button
                    onClick={handleTareScale}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold"
                  >
                    Tare (T)
                  </button>
                </div>

                {/* Quick Tare Presets */}
                <div className="flex items-center gap-1 text-[10px]">
                  <span className="text-slate-500 mr-1">Tare:</span>
                  {[
                    { label: "0g", val: 0 },
                    { label: "5g Bag", val: 5 },
                    { label: "15g Tub", val: 15 },
                  ].map((t) => (
                    <button
                      key={t.val}
                      onClick={() => setTareGrams(t.val)}
                      className={`px-1.5 py-0.5 rounded font-semibold transition ${
                        tareGrams === t.val
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          : "bg-slate-900 text-slate-400 hover:text-white"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Simulator weight buttons */}
              {useSimulator && (
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-900">
                  <span className="text-purple-300 text-[10px] font-semibold">Test Platter:</span>
                  <div className="flex gap-1">
                    {[0.25, 0.5, 1.0, 2.5].map((w) => (
                      <button
                        key={w}
                        onClick={() => simulatorRef.current?.placeWeight(w)}
                        className="px-1.5 py-0.5 rounded bg-purple-900/60 hover:bg-purple-800 text-purple-200 text-[10px] font-mono font-bold"
                      >
                        {w}kg
                      </button>
                    ))}
                    <button
                      onClick={() => simulatorRef.current?.zero()}
                      className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              {/* Manual KG Input when neither live scale nor simulator */}
              {!isLiveOrSim && (
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-400">Manual Weight:</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        const cur = parseFloat(manualWeightInput) || 0;
                        setManualWeightInput(Math.max(0.05, Math.round((cur - 0.1) * 100) / 100).toFixed(3));
                      }}
                      className="p-1 rounded bg-slate-800 text-slate-300"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      step="0.05"
                      min="0.01"
                      value={manualWeightInput}
                      onChange={(e) => setManualWeightInput(e.target.value)}
                      className="w-16 px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-center font-mono text-xs text-white"
                    />
                    <button
                      onClick={() => {
                        const cur = parseFloat(manualWeightInput) || 0;
                        setManualWeightInput(Math.round((cur + 0.1) * 100 / 100).toFixed(3));
                      }}
                      className="p-1 rounded bg-slate-800 text-slate-300"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Selected Product Calculation Summary */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400">Total Calculation</span>
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
                <span className="text-[11px] text-slate-400">Item Total</span>
                <div className="text-2xl font-black font-mono text-emerald-400">
                  {currency} {lineTotal.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedProduct || netWeightKg <= 0}
                onClick={handleConfirmAdd}
                className="flex-[2] py-2.5 px-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 disabled:opacity-50 disabled:pointer-events-none transition-all"
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
