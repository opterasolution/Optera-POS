"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Store,
  Printer,
  Receipt,
  Users,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Percent,
  RefreshCw,
  ShoppingCart,
  LayoutDashboard,
  ShieldCheck,
  Building,
  Phone,
  MapPin,
  Lock,
  User,
} from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session } = useSession();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [businessData, setBusinessData] = useState({
    name: "",
    businessType: "Grocery & Retail",
    phone: "",
    address: "",
    catalogPreset: "GROCERY",
    productCount: 0,
    categoryCount: 0,
    taxSettings: {
      enabled: false,
      name: "VAT",
      rate: 0,
      type: "INCLUSIVE" as "INCLUSIVE" | "EXCLUSIVE",
    },
    receiptSettings: {
      headerMessage: "Thank you for shopping with us!",
      footerMessage: "Goods returnable within 3 days with receipt. Please come again!",
      defaultWidth: "58mm" as "58mm" | "80mm",
      showLogo: false,
    },
    firstCashier: {
      name: "",
      username: "",
      password: "",
      phone: "",
    },
  });

  useEffect(() => {
    async function loadOnboardingData() {
      try {
        const res = await fetch("/api/business/onboarding");
        const data = await res.json();
        if (data.success && data.business) {
          const b = data.business;
          setBusinessData((prev) => ({
            ...prev,
            name: b.name || "",
            businessType: b.businessType || "Grocery & Retail",
            phone: b.phone || "",
            address: b.address || "",
            catalogPreset: b.catalogPreset || "GROCERY",
            productCount: b.productCount || 0,
            categoryCount: b.categoryCount || 0,
            taxSettings: {
              enabled: b.taxSettings?.enabled || false,
              name: b.taxSettings?.name || "VAT",
              rate: b.taxSettings?.rate || 0,
              type: b.taxSettings?.type || "INCLUSIVE",
            },
            receiptSettings: {
              headerMessage: b.receiptSettings?.headerMessage || `Thank you for shopping at ${b.name}!`,
              footerMessage: b.receiptSettings?.footerMessage || "Please come again!",
              defaultWidth: b.receiptSettings?.defaultWidth || "58mm",
              showLogo: false,
            },
          }));
        }
      } catch (err) {
        console.error("Failed to load onboarding data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadOnboardingData();
  }, []);

  const handleSaveProgress = async (finalComplete: boolean = false) => {
    setSaving(true);
    setErrorMessage("");

    try {
      const payload: any = {
        name: businessData.name,
        businessType: businessData.businessType,
        phone: businessData.phone,
        address: businessData.address,
        taxSettings: businessData.taxSettings,
        receiptSettings: businessData.receiptSettings,
        onboardingStep: step + 1,
        onboardingCompleted: finalComplete,
      };

      if (
        businessData.firstCashier.name.trim() &&
        businessData.firstCashier.username.trim() &&
        businessData.firstCashier.password.trim()
      ) {
        payload.firstCashier = businessData.firstCashier;
      }

      const res = await fetch("/api/business/onboarding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || "Failed to save setup step.");
        setSaving(false);
        return false;
      }

      setSaving(false);
      return true;
    } catch {
      setErrorMessage("Network error saving setup progress.");
      setSaving(false);
      return false;
    }
  };

  const handleNext = async () => {
    if (step === 1 && !businessData.name.trim()) {
      setErrorMessage("Store name is required.");
      return;
    }

    const success = await handleSaveProgress(false);
    if (success) {
      setStep((prev) => Math.min(prev + 1, 4));
    }
  };

  const handleFinish = async (redirectTo: string) => {
    const success = await handleSaveProgress(true);
    if (success) {
      router.push(redirectTo);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
          <p className="text-xs text-slate-400">Loading your store onboarding wizard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.15),rgba(2,6,23,0))]">
      <div className="max-w-3xl mx-auto w-full">
        {/* Header Branding */}
        <div className="flex items-center justify-between pb-6 mb-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/30">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white">Store Setup Wizard</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-400/30 uppercase">
                  14-Day Free Trial
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {businessData.name || session?.user?.businessName || "Your New Store"}
              </p>
            </div>
          </div>

          <Link
            href="/pos"
            className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 transition"
          >
            Skip to POS →
          </Link>
        </div>

        {/* Step Progress Bar */}
        <div className="mb-8">
          <div className="grid grid-cols-4 gap-2 mb-2">
            {[
              { num: 1, label: "Store & Printer" },
              { num: 2, label: "Taxes & Receipts" },
              { num: 3, label: "Counter Staff" },
              { num: 4, label: "Launch Store" },
            ].map((s) => (
              <div
                key={s.num}
                className={`text-center pb-2 border-b-2 transition-all ${
                  step >= s.num
                    ? "border-blue-500 text-blue-400 font-bold"
                    : "border-slate-800 text-slate-600 font-medium"
                }`}
              >
                <div className="text-[11px] uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ================= STEP 1: STORE & PRINTER ================= */}
        {step === 1 && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl backdrop-blur">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Store className="w-4 h-4 text-blue-400" />
                <span>Step 1: Store Profile & Receipt Printer</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Customize your store name, contact info, and select your thermal receipt printer width.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Store / Business Name *</label>
                <div className="relative">
                  <Building className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={businessData.name}
                    onChange={(e) => setBusinessData({ ...businessData, name: e.target.value })}
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Business Category / Type</label>
                <input
                  type="text"
                  value={businessData.businessType}
                  onChange={(e) => setBusinessData({ ...businessData, businessType: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Counter Telephone (SL)</label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={businessData.phone}
                    onChange={(e) => setBusinessData({ ...businessData, phone: e.target.value })}
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Address / City</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={businessData.address}
                    onChange={(e) => setBusinessData({ ...businessData, address: e.target.value })}
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Thermal Printer Selection */}
            <div className="pt-4 border-t border-slate-800">
              <label className="block text-xs font-bold text-slate-300 mb-2 flex items-center gap-2">
                <Printer className="w-4 h-4 text-emerald-400" />
                <span>Default Thermal Receipt Printer Width</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() =>
                    setBusinessData({
                      ...businessData,
                      receiptSettings: { ...businessData.receiptSettings, defaultWidth: "58mm" },
                    })
                  }
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    businessData.receiptSettings.defaultWidth === "58mm"
                      ? "bg-blue-600/20 border-blue-500 ring-2 ring-blue-500/30 text-white"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-white">58mm (2-Inch Thermal)</span>
                    {businessData.receiptSettings.defaultWidth === "58mm" && (
                      <CheckCircle2 className="w-4 h-4 text-blue-400" />
                    )}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Most popular standard in Sri Lanka. Compact rolls for POS USB, Bluetooth & desktop printers.
                  </p>
                </div>

                <div
                  onClick={() =>
                    setBusinessData({
                      ...businessData,
                      receiptSettings: { ...businessData.receiptSettings, defaultWidth: "80mm" },
                    })
                  }
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    businessData.receiptSettings.defaultWidth === "80mm"
                      ? "bg-blue-600/20 border-blue-500 ring-2 ring-blue-500/30 text-white"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-white">80mm (3-Inch Thermal)</span>
                    {businessData.receiptSettings.defaultWidth === "80mm" && (
                      <CheckCircle2 className="w-4 h-4 text-blue-400" />
                    )}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Wider format ideal for supermarkets and wholesale counters printing longer item descriptions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 2: TAXES & RECEIPTS ================= */}
        {step === 2 && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl backdrop-blur">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-blue-400" />
                <span>Step 2: Sri Lankan Tax Engine & Receipt Customization</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Configure whether your store charges VAT/SSCL and set your customer receipt messages.
              </p>
            </div>

            {/* Sri Lanka VAT Toggle */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    <Percent className="w-4 h-4 text-amber-400" />
                    <span>Sri Lankan VAT / SSCL Tax Calculation</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Leave disabled if your business is below the Sri Lanka Inland Revenue Department (IRD) VAT threshold.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={businessData.taxSettings.enabled}
                  onChange={(e) =>
                    setBusinessData({
                      ...businessData,
                      taxSettings: { ...businessData.taxSettings, enabled: e.target.checked },
                    })
                  }
                  className="w-5 h-5 rounded accent-blue-600 cursor-pointer"
                />
              </div>

              {businessData.taxSettings.enabled && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-800/80">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Tax Label</label>
                    <input
                      type="text"
                      value={businessData.taxSettings.name}
                      onChange={(e) =>
                        setBusinessData({
                          ...businessData,
                          taxSettings: { ...businessData.taxSettings, name: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Rate (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={businessData.taxSettings.rate}
                      onChange={(e) =>
                        setBusinessData({
                          ...businessData,
                          taxSettings: { ...businessData.taxSettings, rate: parseFloat(e.target.value) || 0 },
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Pricing Mode</label>
                    <select
                      value={businessData.taxSettings.type}
                      onChange={(e) =>
                        setBusinessData({
                          ...businessData,
                          taxSettings: { ...businessData.taxSettings, type: e.target.value as any },
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="INCLUSIVE">Tax Inclusive (Included in Price)</option>
                      <option value="EXCLUSIVE">Tax Exclusive (Added on Checkout)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Receipt Header & Footer */}
            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Receipt Welcome Header
                </label>
                <input
                  type="text"
                  value={businessData.receiptSettings.headerMessage}
                  onChange={(e) =>
                    setBusinessData({
                      ...businessData,
                      receiptSettings: { ...businessData.receiptSettings, headerMessage: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Welcome to our store!"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Receipt Return Policy / Footer Message
                </label>
                <input
                  type="text"
                  value={businessData.receiptSettings.footerMessage}
                  onChange={(e) =>
                    setBusinessData({
                      ...businessData,
                      receiptSettings: { ...businessData.receiptSettings, footerMessage: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Goods exchangeable within 3 days with bill"
                />
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 3: STAFF ACCOUNT ================= */}
        {step === 3 && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl backdrop-blur">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                <span>Step 3: Add Counter Cashier (Optional)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                You can create a cashier login for your counter employee now, or add more staff later in Settings.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-blue-950/30 border border-blue-800/40 text-xs text-slate-300 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <span>
                <strong>Role Isolation</strong>: Cashiers can only access the POS sales counter and complete customer checkout. They cannot view your sensitive profit margins or alter platform settings.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Cashier Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="e.g. Nimal Perera"
                    value={businessData.firstCashier.name}
                    onChange={(e) =>
                      setBusinessData({
                        ...businessData,
                        firstCashier: { ...businessData.firstCashier, name: e.target.value },
                      })
                    }
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Counter Login Username</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="e.g. nimal_pos"
                    value={businessData.firstCashier.username}
                    onChange={(e) =>
                      setBusinessData({
                        ...businessData,
                        firstCashier: {
                          ...businessData.firstCashier,
                          username: e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ""),
                        },
                      })
                    }
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Password / Cashier PIN</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    placeholder="e.g. 1234 or password"
                    value={businessData.firstCashier.password}
                    onChange={(e) =>
                      setBusinessData({
                        ...businessData,
                        firstCashier: { ...businessData.firstCashier, password: e.target.value },
                      })
                    }
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Cashier Phone (SL)</label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="0771234567"
                    value={businessData.firstCashier.phone}
                    onChange={(e) =>
                      setBusinessData({
                        ...businessData,
                        firstCashier: { ...businessData.firstCashier, phone: e.target.value },
                      })
                    }
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              Leave these fields blank if you prefer to operate the counter yourself as the store owner.
            </p>
          </div>
        )}

        {/* ================= STEP 4: CELEBRATION LAUNCH ================= */}
        {step === 4 && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-10 space-y-8 shadow-2xl backdrop-blur text-center">
            <div>
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/25 mb-4">
                <Sparkles className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">
                {businessData.name || "Your Store"} is Ready to Sell!
              </h2>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-2">
                Your Sri Lanka POS Cloud account is configured and primed with your industry starter inventory.
              </p>
            </div>

            {/* Store Setup Summary Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
                <div className="text-[10px] text-slate-500 font-bold uppercase">Store Status</div>
                <div className="text-sm font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 14-Day Trial
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
                <div className="text-[10px] text-slate-500 font-bold uppercase">Starter Inventory</div>
                <div className="text-sm font-bold text-blue-400 mt-1">
                  {businessData.productCount} Products ({businessData.categoryCount} Categories)
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
                <div className="text-[10px] text-slate-500 font-bold uppercase">Printer Width</div>
                <div className="text-sm font-bold text-white mt-1">
                  {businessData.receiptSettings.defaultWidth} Thermal
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
                <div className="text-[10px] text-slate-500 font-bold uppercase">Tax Engine</div>
                <div className="text-sm font-bold text-amber-400 mt-1">
                  {businessData.taxSettings.enabled ? `${businessData.taxSettings.rate}% VAT` : "Exempt / Off"}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <button
                type="button"
                onClick={() => handleFinish("/pos")}
                disabled={saving}
                className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Launch POS Counter (Start Selling)</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => handleFinish("/dashboard")}
                disabled={saving}
                className="w-full sm:w-auto px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <LayoutDashboard className="w-4 h-4 text-slate-400" />
                <span>Go to Store Dashboard</span>
              </button>
            </div>
          </div>
        )}

        {/* Wizard Controls Footer */}
        {step < 4 && (
          <div className="flex items-center justify-between mt-6">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((prev) => prev - 1)}
                className="px-5 py-2.5 rounded-xl border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-white text-xs font-semibold flex items-center gap-2 transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            ) : (
              <div />
            )}

            <button
              type="button"
              onClick={handleNext}
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/20 flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <span>Save & Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
