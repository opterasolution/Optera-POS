"use client";

import React, { useState, useEffect } from "react";
import { ShieldAlert, X, Check, Delete, KeyRound, AlertTriangle } from "lucide-react";

export interface SupervisorOverrideProps {
  isOpen: boolean;
  onClose: () => void;
  onApproved: (supervisor: { name: string; role: string }) => void;
  action: "VOID_CART" | "ITEM_VOID" | "HIGH_DISCOUNT" | "PRICE_OVERRIDE" | "NO_SALE_DRAWER" | "EXPENSE_DELETE";
  actionDescription: string;
  details?: Record<string, unknown>;
}

export default function SupervisorOverrideModal({
  isOpen,
  onClose,
  onApproved,
  action,
  actionDescription,
  details,
}: SupervisorOverrideProps) {
  const [pin, setPin] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sri Lankan retail common reason presets
  const presets = [
    "Customer Changed Mind",
    "Damaged Goods / Packaging",
    "Price Discrepancy at Shelf",
    "Cashier Scanning Error",
    "Special Courtesy Discount",
    "Exchange / Return Void",
  ];

  useEffect(() => {
    if (isOpen) {
      setPin("");
      setReason("");
      setError(null);
    }
  }, [isOpen]);

  // Physical keyboard support
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        if (pin.length < 6) {
          setPin((prev) => prev + e.key);
          setError(null);
        }
      } else if (e.key === "Backspace") {
        setPin((prev) => prev.slice(0, -1));
        setError(null);
      } else if (e.key === "Escape") {
        onClose();
      } else if (e.key === "Enter" && pin.length >= 4) {
        handleSubmit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, pin, reason]);

  if (!isOpen) return null;

  const handleKeyClick = (val: string) => {
    setError(null);
    if (val === "CLEAR") {
      setPin("");
    } else if (val === "BACK") {
      setPin((prev) => prev.slice(0, -1));
    } else {
      if (pin.length < 6) {
        setPin((prev) => prev + val);
      }
    }
  };

  const handleSubmit = async () => {
    if (pin.length < 4) {
      setError("Please enter a 4-6 digit supervisor PIN.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/auth/supervisor-override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin,
          action,
          reason: reason || "Supervisor authorized",
          details,
        }),
      });

      const json = await res.json();

      if (json.success && json.authorized) {
        onApproved(json.supervisor);
        onClose();
      } else {
        setError(json.error || "Invalid PIN. Access denied.");
        setPin("");
      }
    } catch (err) {
      setError("Failed to connect to verification service.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 flex flex-col items-center">
        {/* Top Header */}
        <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-amber-600">
            <ShieldAlert className="w-5 h-5" />
            <h3 className="font-bold text-slate-900 text-sm">Supervisor Approval</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Details */}
        <div className="w-full my-3 p-3 bg-amber-50/70 border border-amber-200 rounded-2xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
            Restricted Action
          </span>
          <p className="text-xs font-semibold text-slate-800 mt-0.5">{actionDescription}</p>
        </div>

        {/* Reason Selector */}
        <div className="w-full mb-3">
          <span className="text-[11px] font-medium text-slate-500 block mb-1">Select Reason:</span>
          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pr-1">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setReason(p)}
                className={`text-[10px] px-2 py-1 rounded-lg transition-all ${
                  reason === p
                    ? "bg-amber-600 text-white font-bold"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* PIN Dots Display */}
        <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 flex flex-col items-center justify-center mb-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
            <KeyRound className="w-3 h-3" /> Enter Supervisor PIN
          </span>
          <div className="flex items-center gap-2 h-7">
            {[0, 1, 2, 3, 4, 5].map((idx) => (
              <div
                key={idx}
                className={`w-3.5 h-3.5 rounded-full transition-all ${
                  idx < pin.length
                    ? "bg-amber-600 scale-110 shadow-sm shadow-amber-500/50"
                    : "bg-slate-200 border border-slate-300"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="w-full mb-3 p-2 bg-rose-50 border border-rose-200 rounded-xl text-center text-rose-700 text-xs font-semibold flex items-center justify-center gap-1.5 animate-shake">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Touch Keypad */}
        <div className="w-full grid grid-cols-3 gap-2 mb-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeyClick(num.toString())}
              disabled={loading}
              className="h-12 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-900 font-bold text-lg rounded-2xl transition-all flex items-center justify-center"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleKeyClick("CLEAR")}
            disabled={loading}
            className="h-12 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 font-bold text-xs rounded-2xl transition-all flex items-center justify-center"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => handleKeyClick("0")}
            disabled={loading}
            className="h-12 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-900 font-bold text-lg rounded-2xl transition-all flex items-center justify-center"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => handleKeyClick("BACK")}
            disabled={loading}
            className="h-12 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-2xl transition-all flex items-center justify-center"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Action Button */}
        <div className="w-full flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="w-1/3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pin.length < 4 || loading}
            className="w-2/3 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-amber-600/30"
          >
            {loading ? (
              <span className="inline-block animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <>
                <Check className="w-4 h-4" />
                Authorize Action
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
