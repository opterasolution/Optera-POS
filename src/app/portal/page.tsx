"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Receipt,
  Search,
  Gift,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Phone,
  KeyRound,
  AlertCircle,
} from "lucide-react";

export default function CustomerPortalLandingPage() {
  const router = useRouter();
  const [tokenInput, setTokenInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = tokenInput.trim();
    if (!clean) {
      setError("Please enter your statement link token or invoice number.");
      return;
    }

    if (clean.toUpperCase().startsWith("INV-")) {
      router.push(`/receipt/${encodeURIComponent(clean)}`);
    } else {
      router.push(`/portal/statement/${encodeURIComponent(clean)}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto shadow-md shadow-blue-600/30">
          <Receipt className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
          Customer Self-Service Portal
        </h2>
        <p className="text-xs text-slate-500">
          Access your Naya Potha Credit Ledger, E-Receipts, and Loyalty Rewards
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl border border-slate-200 space-y-6">
          <form onSubmit={handleLookup} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Statement Token or Invoice Number
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={tokenInput}
                  onChange={(e) => {
                    setTokenInput(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="e.g. your portal token or INV-2026-0034"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Found on your SMS payment notification or printed receipt QR code.
              </p>
            </div>

            {error && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-600/20 flex items-center justify-center gap-1.5"
            >
              <span>Access Statement</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Demo Preview link */}
          <div className="pt-4 border-t border-slate-100 text-center space-y-2">
            <span className="text-[11px] text-slate-400 block">Trying out customer features?</span>
            <Link
              href="/portal/statement/demo_portal_token_sunil"
              className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Launch Demo Naya Potha Statement →</span>
            </Link>
          </div>
        </div>

        {/* Security Assurance */}
        <div className="mt-6 text-center text-[10px] text-slate-400 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Encrypted Zero-Login Token Verification • Sri Lanka Small Business POS</span>
        </div>
      </div>
    </div>
  );
}
