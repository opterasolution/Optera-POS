"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import {
  Store,
  Coffee,
  ShieldPlus,
  Shirt,
  Wrench,
  FolderPlus,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  WifiOff,
  Printer,
  Phone,
  Lock,
  User,
  MapPin,
  Building,
} from "lucide-react";
import { CATALOG_PRESETS } from "@/lib/catalog-presets";

const PRESET_ICONS: Record<string, any> = {
  GROCERY: Store,
  BAKERY: Coffee,
  PHARMACY: ShieldPlus,
  APPAREL: Shirt,
  HARDWARE: Wrench,
  BLANK: FolderPlus,
};

export default function RegisterPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    businessName: "",
    businessType: "Grocery & Retail",
    catalogPreset: "GROCERY" as "GROCERY" | "BAKERY" | "PHARMACY" | "APPAREL" | "HARDWARE" | "BLANK",
    ownerName: "",
    phone: "",
    email: "",
    address: "",
    username: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handlePresetSelect = (presetKey: any) => {
    const preset = CATALOG_PRESETS[presetKey];
    setFormData((prev) => ({
      ...prev,
      catalogPreset: presetKey,
      businessType: preset ? preset.title : "Retail Shop",
    }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || "Failed to create store. Please check your inputs.");
        setLoading(false);
        return;
      }

      setSuccessMessage("Store provisioned successfully! Signing in to your setup wizard...");

      // Automatically authenticate the newly created store owner
      const signInResult = await signIn("credentials", {
        redirect: false,
        username: formData.username.trim().toLowerCase(),
        password: formData.password,
      });

      if (signInResult?.error) {
        // If auto-signin fails for any reason, redirect to login page
        router.push("/login");
      } else {
        // Redirect directly to the interactive onboarding wizard
        router.push("/onboarding");
        router.refresh();
      }
    } catch {
      setErrorMessage("Network error connecting to registration server. Please check your internet connection.");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.18),rgba(2,6,23,0))]">
      <div className="max-w-5xl mx-auto w-full">
        {/* Top Header Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-xl shadow-blue-500/25 mb-3 ring-1 ring-blue-400/30">
            <Store className="w-7 h-7" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-semibold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" /> 14-Day Free Commercial Trial
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl">
            Start Your Sri Lanka POS Cloud Store
          </h1>
          <p className="text-slate-400 text-sm max-w-xl mx-auto mt-2">
            Multi-tenant retail POS built specifically for Sri Lankan grocery stores, bakeries, pharmacies, boutiques, and hardware shops.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Feature Highlights */}
          <div className="lg:col-span-5 space-y-6 bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 sm:p-8 backdrop-blur">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-400" />
              <span>Everything You Need to Sell</span>
            </h2>

            <div className="space-y-4 text-xs">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Pre-Loaded Sri Lankan Products</h3>
                  <p className="text-slate-400 mt-0.5 leading-relaxed">
                    Select your business vertical below to automatically populate familiar Sri Lankan brands and items in LKR.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                  <WifiOff className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Offline Counter Resilience</h3>
                  <p className="text-slate-400 mt-0.5 leading-relaxed">
                    Keep selling and printing receipts even when your Dialog, Mobitel, or SLT fiber connection drops.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Printer className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Instant 58mm & 80mm Receipts</h3>
                  <p className="text-slate-400 mt-0.5 leading-relaxed">
                    Direct thermal printer support for standard USB, Bluetooth, and network receipt printers.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Colombo Support Hotline</h3>
                  <p className="text-slate-400 mt-0.5 leading-relaxed">
                    Dedicated local onboarding assistance, WhatsApp support, and hardware setup guidance.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-900/40 to-indigo-900/20 border border-blue-500/30">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Zero Risk • No Credit Card Required</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Your 14-day trial includes 500 products, 3 staff accounts, and unlimited counter sales. Pay only when you are ready to continue.
              </p>
            </div>

            <div className="text-center pt-2">
              <span className="text-xs text-slate-400">Already registered? </span>
              <Link href="/login" className="text-xs font-bold text-blue-400 hover:text-blue-300 transition">
                Sign In to Your Counter →
              </Link>
            </div>
          </div>

          {/* Right Column: Registration Form */}
          <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur">
            <h2 className="text-lg font-bold text-white mb-1">Create Your Store Account</h2>
            <p className="text-xs text-slate-400 mb-6">
              Complete the details below to initialize your cloud store.
            </p>

            {errorMessage && (
              <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-6">
              {/* 1. Industry Preset Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">
                  1. Select Your Business Type & Starter Catalog *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {Object.values(CATALOG_PRESETS).map((preset) => {
                    const Icon = PRESET_ICONS[preset.key] || Store;
                    const isSelected = formData.catalogPreset === preset.key;

                    return (
                      <button
                        key={preset.key}
                        type="button"
                        onClick={() => handlePresetSelect(preset.key)}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? "bg-blue-600/20 border-blue-500 ring-2 ring-blue-500/30 text-white"
                            : "bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300 hover:bg-slate-800/40"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-2">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                              isSelected ? "bg-blue-500 text-white" : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-400" />}
                        </div>
                        <div>
                          <div className="text-xs font-bold leading-tight">{preset.title}</div>
                          <div className="text-[10px] text-slate-400 mt-1 line-clamp-2">
                            {preset.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Business Details */}
              <div className="space-y-4 pt-2 border-t border-slate-800/60">
                <div className="text-xs font-bold text-slate-300">2. Store Information</div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      Store / Business Name *
                    </label>
                    <div className="relative">
                      <Building className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. Nelum Super City"
                        value={formData.businessName}
                        onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      City / District in Sri Lanka
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        placeholder="e.g. Galle Road, Colombo 03"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Owner Credentials */}
              <div className="space-y-4 pt-2 border-t border-slate-800/60">
                <div className="text-xs font-bold text-slate-300">3. Owner Account & Counter Login</div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      Owner Full Name *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. Kasun Bandara"
                        value={formData.ownerName}
                        onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      Mobile / WhatsApp Phone (SL) *
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="tel"
                        required
                        placeholder="0771234567"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      Login Username *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. kasun_pos"
                        value={formData.username}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            username: e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ""),
                          })
                        }
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-white text-xs font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">This will be your primary login ID</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      Password or Counter PIN *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="password"
                        required
                        placeholder="Minimum 4 characters"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Creating Store & Launching Onboarding...</span>
                    </>
                  ) : (
                    <>
                      <span>Create Store & Start 14-Day Free Trial</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
                <p className="text-[11px] text-slate-500 text-center mt-3">
                  By registering, your account will be activated with 14 days of full platform access in Asia/Colombo timezone.
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
