import Link from "next/link";
import { Store, ShoppingCart, ShieldCheck, BarChart3 } from "lucide-react";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 text-blue-600 mb-6">
          <Store className="w-8 h-8" />
        </div>

        <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full uppercase tracking-wider mb-3">
          🇱🇰 Sri Lanka POS v1.0 (LKR)
        </span>

        <h1 className="text-3xl font-extrabold text-slate-900 mb-2">
          Small Business POS
        </h1>
        <p className="text-slate-600 text-sm mb-8 leading-relaxed">
          Fast, simple, and reliable Point of Sale designed specifically for Sri Lankan retail counters, grocery shops, and supermarkets.
        </p>

        <div className="grid grid-cols-2 gap-4 mb-8 text-left">
          <div className="p-4 rounded-xl border border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2 font-semibold text-slate-800 text-sm mb-1">
              <ShoppingCart className="w-4 h-4 text-blue-600" /> High-Speed POS
            </div>
            <p className="text-xs text-slate-500">Fast 2-column checkout with barcode scanner support.</p>
          </div>

          <div className="p-4 rounded-xl border border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2 font-semibold text-slate-800 text-sm mb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Multi-Tenant
            </div>
            <p className="text-xs text-slate-500">100% isolated store data and role-based permissions.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/login"
            className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm transition-colors shadow-sm"
          >
            Go to Login
          </Link>
          <Link
            href="/pos"
            className="w-full sm:w-auto px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-sm transition-colors"
          >
            Launch POS Counter
          </Link>
        </div>
      </div>
    </main>
  );
}
