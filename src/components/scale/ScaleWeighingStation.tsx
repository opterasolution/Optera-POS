"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Scale,
  Cpu,
  RefreshCw,
  Printer,
  Check,
  Search,
  AlertCircle,
  Sparkles,
  Zap,
  Tag,
  Hash,
  Sliders,
  X,
  Plus,
  Minus,
  CheckCircle2,
  Layers,
} from "lucide-react";
import {
  WebSerialScaleDriver,
  ScaleReading,
  ScaleSimulator,
  ScaleModel,
} from "@/lib/hardware/serial-scale";
import {
  generateScaleBarcode,
  parseVariableWeightBarcode,
} from "@/lib/hardware/barcode-scale";
import ScaleBarcodeSticker from "@/components/labels/ScaleBarcodeSticker";
import { formatCurrency } from "@/lib/formatters";

export interface IProduceItem {
  _id: string;
  name: string;
  nameSinhala?: string;
  nameTamil?: string;
  barcode?: string;
  pluCode?: string;
  sellingPrice: number;
  costPrice?: number;
  unit: string;
  stockQuantity: number;
  isWeighable?: boolean;
  tareWeightGrams?: number;
  category?: string;
}

interface ScaleWeighingStationProps {
  products: IProduceItem[];
  businessName?: string;
  businessPhone?: string;
  currency?: string;
  onAddToCart?: (product: IProduceItem, netWeightKg: number) => void;
  onClose?: () => void;
}

export default function ScaleWeighingStation({
  products,
  businessName = "Corner Store Supermarket",
  businessPhone,
  currency = "LKR",
  onAddToCart,
  onClose,
}: ScaleWeighingStationProps) {
  // Selection & Search
  const [selectedProduct, setSelectedProduct] = useState<IProduceItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("ALL");
  const [pluInput, setPluInput] = useState("");

  // Scale Hardware & Serial State
  const [scaleModel, setScaleModel] = useState<ScaleModel>("CAS_PD_II");
  const [baudRate, setBaudRate] = useState<number>(9600);
  const [isScaleConnected, setIsScaleConnected] = useState(false);
  const [scaleReading, setScaleReading] = useState<ScaleReading | null>(null);
  const [serialError, setSerialError] = useState<string | null>(null);
  const scaleDriverRef = useRef<WebSerialScaleDriver | null>(null);

  // Scale Simulator State
  const [useSimulator, setUseSimulator] = useState(false);
  const simulatorRef = useRef<ScaleSimulator | null>(null);

  // Tare & Weight State
  const [tareGrams, setTareGrams] = useState<number>(5); // default 5g poly bag
  const [manualWeightInput, setManualWeightInput] = useState<string>("1.000");

  // Print Queue / History
  const [recentStickers, setRecentStickers] = useState<Array<{
    id: string;
    productName: string;
    netWeightKg: number;
    totalPrice: number;
    barcode: string;
    timestamp: string;
  }>>([]);

  // Filter weighable products
  const weighableProducts = useMemo(() => {
    return products.filter((p) => {
      const isWeight =
        p.isWeighable ||
        p.unit?.toLowerCase().includes("kg") ||
        p.unit?.toLowerCase().includes("g") ||
        Boolean(p.pluCode);

      if (!isWeight) return false;

      // Department filter
      if (selectedDepartment !== "ALL") {
        const cat = (p.category || "").toUpperCase();
        if (!cat.includes(selectedDepartment)) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          p.name.toLowerCase().includes(q) ||
          p.nameSinhala?.toLowerCase().includes(q) ||
          p.nameTamil?.toLowerCase().includes(q) ||
          p.pluCode?.includes(q) ||
          p.barcode?.includes(q)
        );
      }

      return true;
    });
  }, [products, searchQuery, selectedDepartment]);

  // When a product is selected, initialize tare
  useEffect(() => {
    if (selectedProduct && selectedProduct.tareWeightGrams !== undefined) {
      setTareGrams(selectedProduct.tareWeightGrams);
    }
  }, [selectedProduct]);

  // Initialize Simulator on Mount if needed
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

  // Connect Physical Serial Scale
  const handleConnectScale = async () => {
    setSerialError(null);
    try {
      if (!WebSerialScaleDriver.isSupported()) {
        setSerialError("Web Serial API is not supported in this browser. Please use Google Chrome or MS Edge.");
        return;
      }

      const driver = new WebSerialScaleDriver();
      const success = await driver.connect(
        { scaleModel, baudRate },
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

  // Toggle Simulator Mode
  const handleToggleSimulator = () => {
    if (!useSimulator) {
      if (isScaleConnected) handleDisconnectScale();
      setUseSimulator(true);
      simulatorRef.current?.placeWeight(1.25);
    } else {
      setUseSimulator(false);
      setScaleReading(null);
    }
  };

  // Zero & Tare Handlers
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

  // Quick PLU lookup from numpad
  const handlePluSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pluInput.trim()) return;
    const clean = pluInput.trim();
    const match = products.find(
      (p) =>
        p.pluCode === clean ||
        p.pluCode === clean.padStart(5, "0") ||
        p.barcode === clean
    );
    if (match) {
      setSelectedProduct(match);
      setPluInput("");
    } else {
      alert(`No weighable item found with PLU code "${clean}".`);
    }
  };

  // Weight Calculation
  const isHardwareOrSim = (isScaleConnected || useSimulator) && scaleReading;
  const rawWeightKg = isHardwareOrSim
    ? scaleReading.weightKg
    : parseFloat(manualWeightInput) || 0;

  // Final Net Weight
  const netWeightKg = isHardwareOrSim
    ? Math.max(0, Math.round((rawWeightKg - (tareGrams / 1000)) * 1000) / 1000)
    : Math.max(0, Math.round(rawWeightKg * 1000) / 1000);

  const unitPrice = selectedProduct?.sellingPrice || 0;
  const lineTotal = Math.round(unitPrice * netWeightKg * 100) / 100;

  // Generated EAN-13 Barcode
  const generatedBarcode = useMemo(() => {
    if (!selectedProduct) return "2100000000000";
    return generateScaleBarcode({
      type: "WEIGHT",
      pluCode: selectedProduct.pluCode || "101",
      weightKg: netWeightKg,
      prefix: "21",
    });
  }, [selectedProduct, netWeightKg]);

  // Print Sticker Handler
  const handlePrintSticker = () => {
    if (!selectedProduct || netWeightKg <= 0) return;

    // Log to history
    setRecentStickers((prev) => [
      {
        id: Math.random().toString(),
        productName: selectedProduct.name,
        netWeightKg,
        totalPrice: lineTotal,
        barcode: generatedBarcode,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
      ...prev.slice(0, 9),
    ]);

    // Trigger Print
    window.print();
  };

  // Add to POS Cart Handler
  const handleConfirmAddToCart = () => {
    if (!selectedProduct || netWeightKg <= 0) return;
    if (onAddToCart) {
      onAddToCart(selectedProduct, netWeightKg);
    }
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full flex flex-col shadow-2xl overflow-hidden text-slate-100">
      {/* Top Header */}
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-teal-500/20">
            <Scale className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              Supermarket Produce & Scale Station
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-400 border border-teal-500/30">
                EAN-13 Scale Barcode Engine
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Live Web Serial scale integration, tare deduction, and price-embedded barcode generator
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Hardware Scale Button */}
          {!isScaleConnected ? (
            <button
              onClick={handleConnectScale}
              className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-teal-900/30 transition-all"
            >
              <Cpu className="w-3.5 h-3.5" /> Connect Scale Port
            </button>
          ) : (
            <button
              onClick={handleDisconnectScale}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> COM Port Connected
            </button>
          )}

          {/* Simulator Toggle */}
          <button
            onClick={handleToggleSimulator}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              useSimulator
                ? "bg-purple-600 text-white shadow-md shadow-purple-900/30"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            {useSimulator ? "Simulator Active" : "Simulate Scale"}
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {serialError && (
        <div className="mx-6 mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{serialError}</span>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="flex-1 flex flex-col lg:flex-row p-6 gap-6 overflow-hidden">
        {/* Left Column: Produce PLU Catalog */}
        <div className="w-full lg:w-7/12 flex flex-col space-y-4">
          {/* Search & Department Filters */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search produce, butcher, seafood or type PLU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
            </div>

            {/* Quick PLU Entry Form */}
            <form onSubmit={handlePluSubmit} className="flex gap-1.5 shrink-0">
              <div className="relative w-28">
                <Hash className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="PLU #"
                  value={pluInput}
                  onChange={(e) => setPluInput(e.target.value)}
                  className="w-full pl-8 pr-2 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-teal-300 focus:outline-none focus:border-teal-500"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold"
              >
                Go
              </button>
            </form>
          </div>

          {/* Department Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {["ALL", "VEG", "FRUIT", "MEAT", "FISH", "DELI", "BAKERY"].map((dept) => (
              <button
                key={dept}
                onClick={() => setSelectedDepartment(dept)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap ${
                  selectedDepartment === dept
                    ? "bg-teal-500/20 text-teal-400 border border-teal-500/40"
                    : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
                }`}
              >
                {dept}
              </button>
            ))}
          </div>

          {/* Touch-Friendly Produce PLU Cards Grid */}
          <div className="flex-1 overflow-y-auto max-h-[460px] grid grid-cols-2 sm:grid-cols-3 gap-2.5 pr-1">
            {weighableProducts.length === 0 ? (
              <div className="col-span-full py-16 text-center text-slate-500 text-sm">
                No weighable produce items found. Mark products as "isWeighable" or assign a PLU code.
              </div>
            ) : (
              weighableProducts.map((p) => {
                const isSelected = selectedProduct?._id === p._id;
                return (
                  <button
                    key={p._id}
                    onClick={() => setSelectedProduct(p)}
                    className={`p-3 rounded-2xl flex flex-col justify-between text-left transition-all relative border ${
                      isSelected
                        ? "bg-teal-500/20 border-teal-500 text-white shadow-lg shadow-teal-900/30"
                        : "bg-slate-950/80 hover:bg-slate-900 border-slate-800 text-slate-300"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-bold text-sm leading-tight line-clamp-2">
                          {p.name}
                        </span>
                        {p.pluCode && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-teal-400 border border-teal-500/30 shrink-0">
                            #{p.pluCode}
                          </span>
                        )}
                      </div>

                      {(p.nameSinhala || p.nameTamil) && (
                        <div className="text-[11px] text-slate-400 mt-1 truncate">
                          {p.nameSinhala || p.nameTamil}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-xs font-bold text-teal-400 font-mono">
                        {currency} {p.sellingPrice.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-500">per {p.unit || "kg"}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Digital Scale Platter, LED Weight Readout & Label Print Preview */}
        <div className="w-full lg:w-5/12 flex flex-col space-y-4">
          {/* Luminous LED Digital Weight Meter */}
          <div className="p-5 bg-black border-2 border-teal-500/50 rounded-2xl shadow-inner relative overflow-hidden">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-teal-400 uppercase tracking-widest flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-teal-400" />
                {isScaleConnected
                  ? "Hardware Scale (Live)"
                  : useSimulator
                  ? "Scale Simulator (Active)"
                  : "Manual Platter Mode"}
              </span>

              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                  isHardwareOrSim
                    ? scaleReading?.isStable
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                      : "bg-amber-500/20 text-amber-400 border-amber-500/40 animate-pulse"
                    : "bg-slate-800 text-slate-400 border-slate-700"
                }`}
              >
                {isHardwareOrSim
                  ? scaleReading?.isStable
                    ? "STABLE"
                    : "MOTION / SETTLING"
                  : "MANUAL"}
              </span>
            </div>

            {/* Glowing Big Weight Digits */}
            <div className="text-6xl font-black font-mono tracking-tight text-white my-3 flex items-center justify-center gap-2">
              <span className="tabular-nums">{netWeightKg.toFixed(3)}</span>
              <span className="text-2xl font-bold text-teal-400">kg</span>
            </div>

            {/* Gross, Tare, Net Sub-Indicators */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-900 text-center font-mono text-[11px]">
              <div>
                <span className="text-slate-500 block text-[9px] uppercase">Gross</span>
                <span className="text-slate-300 font-bold">{rawWeightKg.toFixed(3)} kg</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] uppercase">Tare</span>
                <span className="text-amber-400 font-bold">-{tareGrams} g</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] uppercase">Net Wt</span>
                <span className="text-emerald-400 font-extrabold">{netWeightKg.toFixed(3)} kg</span>
              </div>
            </div>
          </div>

          {/* Scale Control Bar: Zero, Tare, Preset Packaging Containers */}
          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleZeroScale}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
                >
                  Zero (Z)
                </button>
                <button
                  type="button"
                  onClick={handleTareScale}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold"
                >
                  Tare (T)
                </button>
              </div>

              {/* Preset Packaging Tare Buttons */}
              <div className="flex items-center gap-1 text-[10px]">
                <span className="text-slate-500 mr-1">Tare:</span>
                {[
                  { label: "0g", val: 0 },
                  { label: "5g Bag", val: 5 },
                  { label: "15g Tub", val: 15 },
                  { label: "25g Tray", val: 25 },
                ].map((t) => (
                  <button
                    key={t.val}
                    type="button"
                    onClick={() => setTareGrams(t.val)}
                    className={`px-2 py-1 rounded font-semibold transition ${
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

            {/* Simulator Quick Weight Test Keys (When in simulator mode) */}
            {useSimulator && (
              <div className="p-2 bg-purple-950/30 border border-purple-800/40 rounded-xl flex items-center justify-between text-xs">
                <span className="text-purple-300 font-semibold flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Test Platter:
                </span>
                <div className="flex gap-1.5">
                  {[0.25, 0.5, 1.0, 2.5, 5.0].map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => simulatorRef.current?.placeWeight(w)}
                      className="px-2 py-0.5 rounded bg-purple-900/60 hover:bg-purple-800 text-purple-200 text-[10px] font-mono font-bold"
                    >
                      {w}kg
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => simulatorRef.current?.zero()}
                    className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {/* Manual Weight Adjustment fallback when neither hardware nor simulator */}
            {!isHardwareOrSim && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Manual Weight Input:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      const cur = parseFloat(manualWeightInput) || 0;
                      setManualWeightInput(Math.max(0.05, Math.round((cur - 0.1) * 100) / 100).toFixed(3));
                    }}
                    className="p-1 rounded bg-slate-800 text-slate-300"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    step="0.05"
                    min="0.01"
                    value={manualWeightInput}
                    onChange={(e) => setManualWeightInput(e.target.value)}
                    className="w-20 px-2 py-1 bg-slate-900 border border-slate-800 rounded text-center font-mono text-sm text-white focus:outline-none"
                  />
                  <button
                    onClick={() => {
                      const cur = parseFloat(manualWeightInput) || 0;
                      setManualWeightInput(Math.round((cur + 0.1) * 100 / 100).toFixed(3));
                    }}
                    className="p-1 rounded bg-slate-800 text-slate-300"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Scale Label Preview Card */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col items-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 self-start flex items-center gap-1.5">
              <Printer className="w-3.5 h-3.5 text-teal-400" />
              Thermal Scale Sticker Preview (58mm × 40mm)
            </span>

            {selectedProduct ? (
              <div className="w-full flex justify-center py-2 bg-slate-900/60 rounded-xl border border-slate-800">
                <ScaleBarcodeSticker
                  storeName={businessName}
                  storePhone={businessPhone}
                  productName={selectedProduct.name}
                  productNameSinhala={selectedProduct.nameSinhala}
                  productNameTamil={selectedProduct.nameTamil}
                  pluCode={selectedProduct.pluCode}
                  unitPrice={selectedProduct.sellingPrice}
                  netWeightKg={netWeightKg}
                  tareGrams={tareGrams}
                  totalPrice={lineTotal}
                  barcode={generatedBarcode}
                  currency={currency === "LKR" ? "Rs." : currency}
                />
              </div>
            ) : (
              <div className="w-full py-12 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                Select a produce or meat item to generate barcode sticker
              </div>
            )}
          </div>

          {/* Action Buttons: Print Sticker & Add to Cart */}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!selectedProduct || netWeightKg <= 0}
              onClick={handlePrintSticker}
              className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <Printer className="w-4 h-4 text-teal-400" />
              Print Scale Sticker
            </button>

            {onAddToCart && (
              <button
                type="button"
                disabled={!selectedProduct || netWeightKg <= 0}
                onClick={handleConfirmAddToCart}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 transition-all disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                Add to Cart ({currency} {lineTotal.toFixed(2)})
              </button>
            )}
          </div>

          {/* Recently Printed Stickers History */}
          {recentStickers.length > 0 && (
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Recently Weighed & Labeled
              </span>
              <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                {recentStickers.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-1.5 rounded bg-slate-900 border border-slate-800/80 font-mono text-[11px]"
                  >
                    <span className="truncate max-w-[120px] text-slate-300">
                      {item.productName}
                    </span>
                    <span className="text-teal-400">{item.netWeightKg.toFixed(3)} kg</span>
                    <span className="text-emerald-400 font-bold">
                      {currency} {item.totalPrice.toFixed(2)}
                    </span>
                    <span className="text-[9px] text-slate-500">{item.timestamp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
