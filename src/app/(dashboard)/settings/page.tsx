"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import AppLayout from "@/components/layout/AppLayout";
import {
  Store,
  Receipt,
  Percent,
  Coins,
  Save,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
} from "lucide-react";
import { formatCurrency, isValidSLPhone } from "@/lib/formatters";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    businessType: "Grocery & Retail",
    ownerName: "",
    phone: "",
    email: "",
    address: "",
    currency: "LKR",
    taxSettings: {
      enabled: false,
      name: "VAT",
      rate: 0,
      type: "INCLUSIVE" as "INCLUSIVE" | "EXCLUSIVE",
    },
    receiptSettings: {
      headerMessage: "Thank you for shopping with us!",
      footerMessage: "Goods returnable within 3 days with receipt. Please come again!",
      showLogo: false,
      defaultWidth: "58mm" as "58mm" | "80mm",
    },
  });

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/business");
        const data = await res.json();
        if (data.success && data.business) {
          setFormData({
            name: data.business.name || "",
            businessType: data.business.businessType || "Grocery & Retail",
            ownerName: data.business.ownerName || "",
            phone: data.business.phone || "",
            email: data.business.email || "",
            address: data.business.address || "",
            currency: data.business.currency || "LKR",
            taxSettings: {
              enabled: data.business.taxSettings?.enabled || false,
              name: data.business.taxSettings?.name || "VAT",
              rate: data.business.taxSettings?.rate || 0,
              type: data.business.taxSettings?.type || "INCLUSIVE",
            },
            receiptSettings: {
              headerMessage: data.business.receiptSettings?.headerMessage || "Thank you for shopping with us!",
              footerMessage: data.business.receiptSettings?.footerMessage || "Please come again!",
              showLogo: data.business.receiptSettings?.showLogo || false,
              defaultWidth: data.business.receiptSettings?.defaultWidth || "58mm",
            },
          });
        }
      } catch {
        setStatusMessage({ type: "error", text: "Failed to load store settings." });
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const isPhoneValid = !formData.phone || isValidSLPhone(formData.phone);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPhoneValid) {
      setStatusMessage({ type: "error", text: "Please enter a valid Sri Lankan phone number." });
      return;
    }

    setSaving(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/business", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (data.success) {
        setStatusMessage({ type: "success", text: "Store settings updated successfully!" });
      } else {
        setStatusMessage({ type: "error", text: data.error || "Failed to update settings." });
      }
    } catch {
      setStatusMessage({ type: "error", text: "Network error saving settings." });
    } finally {
      setSaving(false);
    }
  };

  if (session?.user?.role === "CASHIER") {
    return (
      <AppLayout>
        <div className="p-8 max-w-lg mx-auto text-center mt-12">
          <div className="inline-flex p-4 rounded-full bg-amber-100 text-amber-600 mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Access Restricted</h2>
          <p className="text-sm text-slate-600 mb-6">
            Store configuration and tax settings are only accessible by the Store Owner.
          </p>
          <a
            href="/pos"
            className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700"
          >
            Return to POS Counter
          </a>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-5xl mx-auto">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Store Settings</h1>
            <p className="text-xs text-slate-500 mt-1">
              Configure store identity, Sri Lankan tax rules, LKR currency, and thermal receipts.
            </p>
          </div>

          <button
            onClick={handleSubmit}
            disabled={saving || loading}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm disabled:opacity-50"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" /> Save Settings
              </>
            )}
          </button>
        </div>

        {statusMessage && (
          <div
            className={`mb-6 p-4 rounded-xl text-xs flex items-center gap-3 ${
              statusMessage.type === "success"
                ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                : "bg-rose-50 border border-rose-200 text-rose-800"
            }`}
          >
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{statusMessage.text}</span>
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading settings...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Columns: Settings Forms */}
              <div className="lg:col-span-2 space-y-6">
                {/* 1. Store Profile */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-slate-100 font-semibold text-slate-900 text-sm">
                    <Store className="w-4 h-4 text-blue-600" /> Store Profile
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Business / Store Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. Kandy Super Grocers"
                        className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Business Category
                      </label>
                      <select
                        value={formData.businessType}
                        onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="Grocery & Retail">Grocery & Retail</option>
                        <option value="Mini Supermarket">Mini Supermarket</option>
                        <option value="Clothing & Textile">Clothing & Textile</option>
                        <option value="Mobile & Electronics">Mobile & Electronics</option>
                        <option value="Hardware & Tools">Hardware & Tools</option>
                        <option value="Stationery & Books">Stationery & Books</option>
                        <option value="Cosmetics & Care">Cosmetics & Care</option>
                        <option value="Bakery & Cafe">Bakery & Cafe</option>
                        <option value="Other Retail">Other Retail</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Owner / Contact Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.ownerName}
                        onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                        placeholder="e.g. Sunil Perera"
                        className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Sri Lankan Phone Number *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="0771234567 or +94771234567"
                        className={`w-full px-3.5 py-2 text-sm border rounded-xl focus:ring-2 focus:outline-none ${
                          !isPhoneValid
                            ? "border-rose-300 focus:ring-rose-500 bg-rose-50/30"
                            : "border-slate-200 focus:ring-blue-500"
                        }`}
                      />
                      {!isPhoneValid && (
                        <p className="text-[11px] text-rose-500 mt-1">
                          Format: 07XXXXXXXX or +947XXXXXXXX
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Email Address (Optional)
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="shop@example.lk"
                        className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Shop Address (Printed on Receipts)
                      </label>
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        placeholder="e.g. No. 45, Peradeniya Road, Kandy"
                        className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Tax Settings */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2.5 font-semibold text-slate-900 text-sm">
                      <Percent className="w-4 h-4 text-blue-600" /> Sri Lankan Tax Engine
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.taxSettings.enabled}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            taxSettings: { ...formData.taxSettings, enabled: e.target.checked },
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      <span className="ml-2 text-xs font-medium text-slate-700">
                        {formData.taxSettings.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </label>
                  </div>

                  {formData.taxSettings.enabled ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Tax Name
                        </label>
                        <input
                          type="text"
                          value={formData.taxSettings.name}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              taxSettings: { ...formData.taxSettings, name: e.target.value },
                            })
                          }
                          placeholder="e.g. VAT or SSCL"
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Tax Percentage (%)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={formData.taxSettings.rate}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              taxSettings: {
                                ...formData.taxSettings,
                                rate: parseFloat(e.target.value) || 0,
                              },
                            })
                          }
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Price Calculation
                        </label>
                        <select
                          value={formData.taxSettings.type}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              taxSettings: {
                                ...formData.taxSettings,
                                type: e.target.value as "INCLUSIVE" | "EXCLUSIVE",
                              },
                            })
                          }
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        >
                          <option value="INCLUSIVE">Tax Inclusive (Included in Price)</option>
                          <option value="EXCLUSIVE">Tax Exclusive (Added at Checkout)</option>
                        </select>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl">
                      Tax calculation is currently turned off. Sales will be recorded without tax. Ideal for small retail businesses under the VAT/SSCL registration threshold.
                    </p>
                  )}
                </div>

                {/* 3. Thermal Receipt Customizer */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-slate-100 font-semibold text-slate-900 text-sm">
                    <Receipt className="w-4 h-4 text-blue-600" /> Thermal Receipt Settings
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Receipt Roll Width
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <label
                          className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer text-xs ${
                            formData.receiptSettings.defaultWidth === "58mm"
                              ? "border-blue-500 bg-blue-50/50 text-blue-900 font-semibold"
                              : "border-slate-200 text-slate-700"
                          }`}
                        >
                          <span>58mm (Small Compact Roll)</span>
                          <input
                            type="radio"
                            name="receiptWidth"
                            value="58mm"
                            checked={formData.receiptSettings.defaultWidth === "58mm"}
                            onChange={() =>
                              setFormData({
                                ...formData,
                                receiptSettings: {
                                  ...formData.receiptSettings,
                                  defaultWidth: "58mm",
                                },
                              })
                            }
                            className="text-blue-600"
                          />
                        </label>

                        <label
                          className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer text-xs ${
                            formData.receiptSettings.defaultWidth === "80mm"
                              ? "border-blue-500 bg-blue-50/50 text-blue-900 font-semibold"
                              : "border-slate-200 text-slate-700"
                          }`}
                        >
                          <span>80mm (Supermarket Standard)</span>
                          <input
                            type="radio"
                            name="receiptWidth"
                            value="80mm"
                            checked={formData.receiptSettings.defaultWidth === "80mm"}
                            onChange={() =>
                              setFormData({
                                ...formData,
                                receiptSettings: {
                                  ...formData.receiptSettings,
                                  defaultWidth: "80mm",
                                },
                              })
                            }
                            className="text-blue-600"
                          />
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Header Message
                      </label>
                      <input
                        type="text"
                        value={formData.receiptSettings.headerMessage}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            receiptSettings: {
                              ...formData.receiptSettings,
                              headerMessage: e.target.value,
                            },
                          })
                        }
                        placeholder="Thank you for shopping with us!"
                        className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Footer Notice / Return Policy
                      </label>
                      <input
                        type="text"
                        value={formData.receiptSettings.footerMessage}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            receiptSettings: {
                              ...formData.receiptSettings,
                              footerMessage: e.target.value,
                            },
                          })
                        }
                        placeholder="Goods returnable within 3 days with receipt."
                        className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right 1 Column: Live Receipt Preview */}
              <div className="space-y-6">
                {/* Currency Card */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <div className="flex items-center gap-2 font-semibold text-slate-900 text-xs mb-3">
                    <Coins className="w-4 h-4 text-emerald-600" /> Currency Standard
                  </div>
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-100">
                    <div className="text-[11px] text-emerald-700 font-medium">Default Currency</div>
                    <div className="text-xl font-extrabold text-emerald-900 mt-0.5">
                      {formatCurrency(1250)}
                    </div>
                    <p className="text-[10px] text-emerald-600 mt-1">
                      Sri Lankan Rupees (LKR) formatted with standard two-decimal precision.
                    </p>
                  </div>
                </div>

                {/* Thermal Preview Card */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <div className="text-xs font-semibold text-slate-900 mb-3 flex items-center justify-between">
                    <span>Receipt Preview</span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                      {formData.receiptSettings.defaultWidth}
                    </span>
                  </div>

                  <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl font-mono text-[11px] text-slate-800 space-y-2 shadow-inner">
                    <div className="text-center font-bold text-xs uppercase">
                      {formData.name || "YOUR STORE NAME"}
                    </div>
                    <div className="text-center text-[10px] text-slate-600">
                      {formData.address || "Shop Address Line"}
                      <br />
                      Tel: {formData.phone || "07XXXXXXXX"}
                    </div>
                    <div className="text-center text-[10px] text-slate-500 italic">
                      {formData.receiptSettings.headerMessage}
                    </div>

                    <div className="border-t border-dashed border-slate-300 pt-1.5 space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span>INV-2026-0001</span>
                        <span>06/09/2026</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span>Cashier: Admin</span>
                        <span>Cash</span>
                      </div>
                    </div>

                    <div className="border-t border-slate-300 pt-1.5 space-y-1">
                      <div className="flex justify-between">
                        <span>Munchee Super Cream Cracker</span>
                        <span>Rs. 320.00</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 pl-2">
                        <span>1 x Rs. 320.00</span>
                      </div>

                      <div className="flex justify-between">
                        <span>Kotmale Fresh Milk 1L</span>
                        <span>Rs. 580.00</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 pl-2">
                        <span>1 x Rs. 580.00</span>
                      </div>
                    </div>

                    <div className="border-t border-dashed border-slate-300 pt-1.5 space-y-0.5 text-right font-medium">
                      <div className="flex justify-between text-slate-600">
                        <span>Subtotal:</span>
                        <span>Rs. 900.00</span>
                      </div>
                      {formData.taxSettings.enabled && (
                        <div className="flex justify-between text-slate-600 text-[10px]">
                          <span>
                            {formData.taxSettings.name} ({formData.taxSettings.rate}%):
                          </span>
                          <span>
                            Rs. {((900 * formData.taxSettings.rate) / 100).toFixed(2)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-xs font-bold text-slate-900 pt-1 border-t border-slate-200">
                        <span>TOTAL:</span>
                        <span>
                          Rs.{" "}
                          {(
                            900 +
                            (formData.taxSettings.enabled && formData.taxSettings.type === "EXCLUSIVE"
                              ? (900 * formData.taxSettings.rate) / 100
                              : 0)
                          ).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-600">
                        <span>Cash Tendered:</span>
                        <span>Rs. 1,000.00</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-bold text-emerald-700">
                        <span>Change Due:</span>
                        <span>
                          Rs.{" "}
                          {(
                            1000 -
                            (900 +
                              (formData.taxSettings.enabled && formData.taxSettings.type === "EXCLUSIVE"
                                ? (900 * formData.taxSettings.rate) / 100
                                : 0))
                          ).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-dashed border-slate-300 pt-2 text-center text-[10px] text-slate-500">
                      {formData.receiptSettings.footerMessage}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>
        )}
      </div>
    </AppLayout>
  );
}
