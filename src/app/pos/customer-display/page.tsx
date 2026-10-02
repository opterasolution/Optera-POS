"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Store,
  Clock,
  Sparkles,
  ShoppingBag,
  Scale,
  CheckCircle2,
  Maximize2,
  Minimize2,
  QrCode,
  Tag,
  ArrowRight,
} from "lucide-react";
import QRCodeImage from "@/components/common/QRCodeImage";
import {
  CFD_CHANNEL_NAME,
  ICFDState,
  CFDMessage,
} from "@/lib/hardware/cfd-channel";

const INITIAL_STATE: ICFDState = {
  status: "IDLE",
  businessName: "Corner Store POS",
  welcomeMessage: "Welcome! ආයුබෝවන්! வணக்கம்!",
  promotionalMessage: "Fresh Produce • Daily Essentials • Best Prices Guaranteed",
  registerName: "Register 01",
  items: [],
  subtotal: 0,
  discountTotal: 0,
  taxTotal: 0,
  grandTotal: 0,
  currency: "LKR",
  lastUpdated: Date.now(),
};

export default function CustomerDisplayPage() {
  const [state, setState] = useState<ICFDState>(INITIAL_STATE);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentDate, setCurrentDate] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const itemsEndRef = useRef<HTMLDivElement>(null);

  // Live Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-LK", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
      setCurrentDate(
        now.toLocaleDateString("en-LK", {
          weekday: "long",
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      );
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // BroadcastChannel listener
  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
      return;
    }

    const channel = new BroadcastChannel(CFD_CHANNEL_NAME);

    // Request initial state from POS if active
    channel.postMessage({ type: "SYNC_REQUEST" });

    channel.onmessage = (event: MessageEvent<CFDMessage>) => {
      const msg = event.data;
      if (!msg) return;

      if (msg.type === "SYNC_STATE") {
        setState(msg.state);
      } else if (msg.type === "CART_UPDATE") {
        setState((prev) => ({
          ...prev,
          ...msg.state,
          lastUpdated: Date.now(),
        }));
      } else if (msg.type === "SALE_COMPLETED") {
        setState((prev) => ({
          ...prev,
          status: "COMPLETED",
          paymentMethod: msg.payment.method,
          amountTendered: msg.payment.tendered,
          changeDue: msg.payment.change,
          receiptNumber: msg.payment.receiptNumber,
          receiptUrl: msg.payment.receiptUrl,
          lastUpdated: Date.now(),
        }));
      } else if (msg.type === "RESET_IDLE") {
        setState((prev) => ({
          ...prev,
          status: "IDLE",
          items: [],
          subtotal: 0,
          discountTotal: 0,
          taxTotal: 0,
          grandTotal: 0,
          paymentMethod: undefined,
          amountTendered: undefined,
          changeDue: undefined,
          receiptNumber: undefined,
          receiptUrl: undefined,
          lastUpdated: Date.now(),
        }));
      }
    };

    return () => {
      channel.close();
    };
  }, []);

  // Auto-scroll to latest scanned item
  useEffect(() => {
    if (state.items.length > 0) {
      itemsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [state.items.length]);

  // Auto revert to IDLE after 25s if completed
  useEffect(() => {
    if (state.status === "COMPLETED") {
      const timeout = setTimeout(() => {
        setState((prev) => ({
          ...prev,
          status: "IDLE",
          items: [],
          subtotal: 0,
          discountTotal: 0,
          taxTotal: 0,
          grandTotal: 0,
          receiptNumber: undefined,
          receiptUrl: undefined,
        }));
      }, 25000);
      return () => clearTimeout(timeout);
    }
  }, [state.status]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const formatCurrency = (amount: number) => {
    return `${state.currency} ${amount.toLocaleString("en-LK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const isCartActive = (state.status === "SCANNING" || state.status === "CHECKOUT") && state.items.length > 0;
  const isCompleted = state.status === "COMPLETED";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-hidden">
      {/* Top Header Bar */}
      <header className="bg-slate-900/90 border-b border-slate-800 px-6 py-4 flex items-center justify-between backdrop-blur-md shadow-lg">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-900/40">
            <Store className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              {state.businessName}
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Customer Display
              </span>
            </h1>
            <p className="text-xs text-slate-400 flex items-center gap-2 font-medium">
              <span>{state.registerName || "Register 01"}</span>
              {state.cashierName && (
                <>
                  <span>•</span>
                  <span>Cashier: {state.cashierName}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Live Clock & Controls */}
        <div className="flex items-center space-x-6">
          <div className="text-right">
            <div className="text-xl font-bold font-mono text-emerald-400 tracking-wider">
              {currentTime}
            </div>
            <div className="text-xs text-slate-400">{currentDate}</div>
          </div>
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Go Fullscreen (F11)"}
            className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700 shadow-sm"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 flex overflow-hidden p-6 gap-6">
        {/* If Idle Screen */}
        {!isCartActive && !isCompleted && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-gradient-to-b from-slate-900/60 to-slate-950 border border-slate-800/80 rounded-3xl shadow-2xl relative overflow-hidden">
            {/* Background ambient glow */}
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="w-28 h-28 rounded-full bg-slate-800/80 border-2 border-emerald-500/30 flex items-center justify-center mb-8 shadow-2xl shadow-emerald-950/50">
              <ShoppingBag className="w-14 h-14 text-emerald-400 animate-pulse" />
            </div>

            <h2 className="text-5xl font-black text-white tracking-tight mb-3">
              {state.welcomeMessage || "Welcome! ආයුබෝවන්! வணக்கம்!"}
            </h2>

            <p className="text-xl text-emerald-400/90 font-medium max-w-2xl mb-8">
              {state.promotionalMessage || "Fresh Produce • Islandwide Quality • Value for Money"}
            </p>

            <div className="grid grid-cols-3 gap-6 max-w-4xl w-full">
              <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl flex flex-col items-center">
                <Scale className="w-8 h-8 text-teal-400 mb-2" />
                <span className="font-bold text-white text-base">Certified Weighing</span>
                <span className="text-xs text-slate-400 mt-1">Accurate gram-level electronic precision</span>
              </div>
              <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl flex flex-col items-center">
                <QrCode className="w-8 h-8 text-emerald-400 mb-2" />
                <span className="font-bold text-white text-base">LankaQR & Cards</span>
                <span className="text-xs text-slate-400 mt-1">Instant cashless payments supported</span>
              </div>
              <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl flex flex-col items-center">
                <Sparkles className="w-8 h-8 text-amber-400 mb-2" />
                <span className="font-bold text-white text-base">Loyalty Points</span>
                <span className="text-xs text-slate-400 mt-1">Earn rewards on every transaction</span>
              </div>
            </div>

            <div className="mt-12 text-sm text-slate-500 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span>Cashier ready to scan your items...</span>
            </div>
          </div>
        )}

        {/* If Active Cart Scanning */}
        {isCartActive && (
          <div className="flex-1 flex gap-6 overflow-hidden">
            {/* Left 65%: Scanned Items List */}
            <div className="flex-[3] flex flex-col bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
              <div className="px-6 py-4 bg-slate-800/60 border-b border-slate-700/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-emerald-400" />
                  <span className="font-bold text-lg text-white">Your Cart</span>
                  <span className="ml-2 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {state.items.reduce((sum, item) => sum + (item.isWeighable ? 1 : item.quantity), 0)} items
                  </span>
                </div>
                <span className="text-xs text-slate-400">Live Itemized Bill</span>
              </div>

              {/* Items Table / Cards */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {state.items.map((item, idx) => (
                  <div
                    key={`${item.id}-${idx}`}
                    className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 flex items-center justify-between transition-all"
                  >
                    <div className="flex-1 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg text-white tracking-wide">
                          {item.name}
                        </span>
                        {item.isWeighable && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-teal-500/20 text-teal-300 border border-teal-500/30">
                            <Scale className="w-3 h-3" /> Weighable
                          </span>
                        )}
                      </div>

                      {/* Multilingual sub-title if available */}
                      {(item.nameSi || item.nameTa) && (
                        <div className="text-xs text-slate-400 mt-0.5">
                          {item.nameSi && <span>{item.nameSi}</span>}
                          {item.nameSi && item.nameTa && <span className="mx-1">•</span>}
                          {item.nameTa && <span>{item.nameTa}</span>}
                        </div>
                      )}

                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                        {item.isWeighable ? (
                          <span>
                            {item.quantity.toFixed(3)} kg @ {formatCurrency(item.price)}/kg
                            {item.tareWeightGrams ? ` (Tare: ${item.tareWeightGrams}g)` : ""}
                          </span>
                        ) : (
                          <span>
                            {item.quantity} {item.unit || "unit"} × {formatCurrency(item.price)}
                          </span>
                        )}

                        {item.discountAmount && item.discountAmount > 0 ? (
                          <span className="text-amber-400 font-medium">
                            (Disc: -{formatCurrency(item.discountAmount)})
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xl font-bold font-mono text-emerald-400">
                        {formatCurrency(item.lineTotal)}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={itemsEndRef} />
              </div>
            </div>

            {/* Right 35%: Bill Totals Card */}
            <div className="flex-[2] flex flex-col justify-between bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl">
              <div>
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                  <Tag className="w-5 h-5 text-emerald-400" />
                  Order Summary
                </h3>

                <div className="space-y-4 text-base">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal</span>
                    <span className="font-mono text-slate-200">{formatCurrency(state.subtotal)}</span>
                  </div>

                  {state.discountTotal > 0 && (
                    <div className="flex justify-between text-amber-400 font-medium">
                      <span>Total Savings</span>
                      <span className="font-mono">-{formatCurrency(state.discountTotal)}</span>
                    </div>
                  )}

                  {state.taxTotal > 0 && (
                    <div className="flex justify-between text-slate-400">
                      <span>Taxes (VAT / SSCL)</span>
                      <span className="font-mono text-slate-200">+{formatCurrency(state.taxTotal)}</span>
                    </div>
                  )}

                  <div className="h-px bg-slate-800 my-4" />
                </div>
              </div>

              {/* Grand Total Box */}
              <div className="bg-gradient-to-tr from-emerald-950/60 to-slate-900 border-2 border-emerald-500/50 p-6 rounded-2xl shadow-xl shadow-emerald-950/30 text-center">
                <span className="text-xs uppercase tracking-widest text-emerald-400 font-bold">
                  Total Payable
                </span>
                <div className="text-5xl font-black font-mono text-emerald-300 mt-2 tracking-tight">
                  {formatCurrency(state.grandTotal)}
                </div>
                <p className="text-xs text-slate-400 mt-3 flex items-center justify-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Please tender cash or choose cashless QR
                </p>
              </div>
            </div>
          </div>
        )}

        {/* If Completed Screen (Receipt & Payment) */}
        {isCompleted && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl text-center relative overflow-hidden">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center mb-6 shadow-xl shadow-emerald-900/40">
              <CheckCircle2 className="w-12 h-12 text-emerald-400" />
            </div>

            <h2 className="text-4xl font-black text-white tracking-tight">
              Payment Successful!
            </h2>
            <p className="text-lg text-emerald-400 font-semibold mt-1">
              ස්තූතියි! நன்றி! Thank You!
            </p>

            {/* Payment & Change Cards */}
            <div className="grid grid-cols-3 gap-6 max-w-3xl w-full my-8">
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
                <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Method</span>
                <div className="text-2xl font-bold text-white mt-1">
                  {state.paymentMethod || "CASH"}
                </div>
              </div>
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
                <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Paid</span>
                <div className="text-2xl font-bold font-mono text-slate-200 mt-1">
                  {formatCurrency(state.amountTendered || state.grandTotal)}
                </div>
              </div>
              <div className="bg-emerald-950/60 p-5 rounded-2xl border-2 border-emerald-500/60">
                <span className="text-xs text-emerald-400 uppercase font-bold tracking-wider">Change Due</span>
                <div className="text-2xl font-black font-mono text-emerald-300 mt-1">
                  {formatCurrency(state.changeDue || 0)}
                </div>
              </div>
            </div>

            {/* Digital Receipt QR Code */}
            {state.receiptNumber && (
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl flex items-center gap-6 max-w-md shadow-lg">
                <div className="bg-white p-2 rounded-xl shadow-inner">
                  <QRCodeImage
                    value={
                      state.receiptUrl ||
                      `https://receipt.pos.lk/r/${state.receiptNumber}`
                    }
                    size={100}
                    className="w-24 h-24"
                  />
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    Digital e-Receipt
                  </span>
                  <div className="text-base font-bold text-white mt-0.5">
                    #{state.receiptNumber}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Scan with your mobile camera to view or save your receipt!
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer ticker */}
      <footer className="bg-slate-950 border-t border-slate-800/80 px-6 py-2.5 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Connected to Main POS Terminal</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Sri Lanka Standard Barcode & Weighing Verified</span>
          <span>•</span>
          <span className="text-slate-500">Dual Display v2.8</span>
        </div>
      </footer>
    </div>
  );
}
