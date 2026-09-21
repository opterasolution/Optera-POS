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
  Users,
  UserPlus,
  CreditCard,
  Shield,
  Clock,
  Check,
  RefreshCw,
  Phone,
  Package,
  X,
} from "lucide-react";
import { formatCurrency, isValidSLPhone } from "@/lib/formatters";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Tab State: profile | staff | subscription
  const [activeTab, setActiveTab] = useState<"profile" | "staff" | "subscription">("profile");

  // Staff State
  const [staffList, setStaffList] = useState<Array<{
    _id: string;
    name: string;
    username: string;
    role: "OWNER" | "MANAGER" | "CASHIER";
    phone?: string;
    isActive: boolean;
    createdAt: string;
  }>>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [newStaff, setNewStaff] = useState({
    name: "",
    username: "",
    password: "",
    role: "CASHIER" as "MANAGER" | "CASHIER",
    phone: "",
  });
  const [addStaffLoading, setAddStaffLoading] = useState(false);
  const [addStaffError, setAddStaffError] = useState("");

  // Subscription State
  const [subscriptionData, setSubscriptionData] = useState<{
    plan: "TRIAL" | "BASIC" | "PROFESSIONAL" | "ENTERPRISE";
    status: "TRIAL" | "ACTIVE" | "EXPIRED" | "SUSPENDED" | "CANCELLED";
    startDate?: string;
    expiryDate?: string;
    maxProducts?: number;
    maxUsers?: number;
    productCount?: number;
  } | null>(null);

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
          if (data.business.subscription) {
            setSubscriptionData({
              ...data.business.subscription,
              productCount: data.business.productCount || 0,
            });
          }
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

    async function loadStaff() {
      setStaffLoading(true);
      try {
        const res = await fetch("/api/staff");
        const data = await res.json();
        if (data.success && data.staff) {
          setStaffList(data.staff);
        }
      } catch {
        console.error("Failed to load staff list");
      } finally {
        setStaffLoading(false);
      }
    }

    loadSettings();
    loadStaff();
  }, []);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddStaffLoading(true);
    setAddStaffError("");

    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newStaff),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setAddStaffError(data.error || "Failed to create staff member");
        setAddStaffLoading(false);
        return;
      }

      setIsAddStaffOpen(false);
      setNewStaff({
        name: "",
        username: "",
        password: "",
        role: "CASHIER",
        phone: "",
      });
      // Refresh staff list
      const staffRes = await fetch("/api/staff");
      const staffJson = await staffRes.json();
      if (staffJson.success) setStaffList(staffJson.staff);

      setStatusMessage({
        type: "success",
        text: `Staff member "${data.user?.name || newStaff.name}" created successfully!`,
      });
    } catch {
      setAddStaffError("Network error creating staff member.");
    } finally {
      setAddStaffLoading(false);
    }
  };

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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Store Settings</h1>
            <p className="text-xs text-slate-500 mt-1">
              Configure store identity, Sri Lankan tax rules, staff accounts, and license limits.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === "profile" && (
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
            )}

            {activeTab === "staff" && (
              <button
                onClick={() => setIsAddStaffOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
              >
                <UserPlus className="w-4 h-4" /> Add Staff Member
              </button>
            )}

            {activeTab === "subscription" && (
              <a
                href="tel:0771234567"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
              >
                <Phone className="w-3.5 h-3.5 text-blue-400" /> Platform Support
              </a>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "profile"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Store className="w-4 h-4" /> Store & Tax Profile
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("staff")}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "staff"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Users className="w-4 h-4" /> Staff & Cashiers ({staffList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("subscription")}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "subscription"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <CreditCard className="w-4 h-4" /> Subscription & License
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
          <>
            {activeTab === "profile" && (
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

        {/* 2. Staff & Cashiers Tab */}
        {activeTab === "staff" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Staff & Cashier Directory</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Manage store employees, login IDs, and counter checkout permissions.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddStaffOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
                >
                  <UserPlus className="w-4 h-4" /> Add Staff Member
                </button>
              </div>

              {staffLoading ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-blue-500 mb-2" />
                  Loading store staff members...
                </div>
              ) : staffList.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  No staff members registered yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                        <th className="py-3 px-4">Staff Member</th>
                        <th className="py-3 px-4">Login Username</th>
                        <th className="py-3 px-4">Role & Access</th>
                        <th className="py-3 px-4">Contact Phone</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Joined Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {staffList.map((member) => (
                        <tr key={member._id} className="hover:bg-slate-50/60 transition">
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {member.name}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600">
                            @{member.username}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                member.role === "OWNER"
                                  ? "bg-purple-100 text-purple-800 border border-purple-200"
                                  : member.role === "MANAGER"
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                  : "bg-amber-100 text-amber-800 border border-amber-200"
                              }`}
                            >
                              <Shield className="w-2.5 h-2.5" />
                              {member.role}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600">
                            {member.phone || "—"}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              Active
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500">
                            {new Date(member.createdAt).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. Subscription & License Tab */}
        {activeTab === "subscription" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Plan & Status Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="text-xs font-semibold text-slate-500">Subscription Plan</span>
                  <span
                    className={`px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                      subscriptionData?.plan === "ENTERPRISE"
                        ? "bg-purple-100 text-purple-800 border border-purple-200"
                        : subscriptionData?.plan === "PROFESSIONAL"
                        ? "bg-indigo-100 text-indigo-800 border border-indigo-200"
                        : subscriptionData?.plan === "BASIC"
                        ? "bg-blue-100 text-blue-800 border border-blue-200"
                        : "bg-amber-100 text-amber-800 border border-amber-200"
                    }`}
                  >
                    {subscriptionData?.plan || "BASIC"}
                  </span>
                </div>

                <div>
                  <div className="text-xs text-slate-500">License Status</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        subscriptionData?.status === "ACTIVE"
                          ? "bg-emerald-100 text-emerald-800"
                          : subscriptionData?.status === "TRIAL"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {subscriptionData?.status || "ACTIVE"}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500">License Expiry Date</div>
                  <div className="text-sm font-bold text-slate-900 font-mono mt-0.5">
                    {subscriptionData?.expiryDate
                      ? new Date(subscriptionData.expiryDate).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "Lifetime License"}
                  </div>
                  {subscriptionData?.expiryDate && (
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {Math.ceil(
                        (new Date(subscriptionData.expiryDate).getTime() - Date.now()) /
                          (1000 * 60 * 60 * 24)
                      )}{" "}
                      days remaining
                    </div>
                  )}
                </div>
              </div>

              {/* Quota & Capacity Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="text-xs font-semibold text-slate-500">Store Capacity</span>
                  <Package className="w-4 h-4 text-slate-400" />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-700 mb-1">
                    <span>Product Catalog Usage</span>
                    <span className="font-bold">
                      {subscriptionData?.productCount || 0} /{" "}
                      {subscriptionData?.maxProducts || 1000}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          (((subscriptionData?.productCount || 0) /
                            (subscriptionData?.maxProducts || 1000)) *
                            100)
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-700 mb-1">
                    <span>Staff Accounts</span>
                    <span className="font-bold">
                      {staffList.length} / {subscriptionData?.maxUsers || 5}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          ((staffList.length / (subscriptionData?.maxUsers || 5)) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="pt-2 text-[11px] text-slate-500">
                  Unlimited transactions & thermal invoice receipts.
                </div>
              </div>

              {/* Platform Billing & Support Hotline */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] font-bold uppercase tracking-wider mb-3">
                    Sri Lanka POS Cloud
                  </div>
                  <h4 className="text-sm font-bold text-white">Need to Upgrade or Extend?</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Contact your dedicated POS SaaS platform representative to renew your license, order thermal paper rolls, or upgrade plan capacity.
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <a
                    href="tel:0771234567"
                    className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Hotline: 077 123 4567</span>
                  </a>
                  <p className="text-[10px] text-slate-400 text-center">
                    Available Mon–Sat: 8:00 AM – 8:00 PM (Asia/Colombo)
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    )}

    {/* Add Staff Modal */}
    {isAddStaffOpen && (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                <UserPlus className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Add Staff Member</h3>
                <p className="text-[11px] text-slate-500">Grant counter or manager access</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsAddStaffOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleAddStaff} className="p-6 space-y-4">
            {addStaffError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{addStaffError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Nimal Perera"
                value={newStaff.name}
                onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Login Username *</label>
              <input
                type="text"
                required
                placeholder="e.g. nimal_pos"
                value={newStaff.username}
                onChange={(e) =>
                  setNewStaff({
                    ...newStaff,
                    username: e.target.value.toLowerCase().replace(/\s+/g, ""),
                  })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Password / PIN *</label>
              <input
                type="password"
                required
                placeholder="Minimum 4 characters"
                value={newStaff.password}
                onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Role *</label>
                <select
                  value={newStaff.role}
                  onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="CASHIER">CASHIER (POS Only)</option>
                  <option value="MANAGER">MANAGER (Stock & Reports)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Phone (SL)</label>
                <input
                  type="text"
                  placeholder="0771234567"
                  value={newStaff.phone}
                  onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsAddStaffOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addStaffLoading}
                className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50"
              >
                {addStaffLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Create Account</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
      </div>
    </AppLayout>
  );
}
