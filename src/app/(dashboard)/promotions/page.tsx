"use client";

import { useEffect, useState, useMemo } from "react";
import AppLayout from "@/components/layout/AppLayout";
import {
  Tag,
  Gift,
  Award,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Coins,
  Copy,
  Check,
  Trash2,
  Power,
  Sparkles,
  ShoppingBag,
  Users,
  Info,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface PromotionItem {
  _id: string;
  name: string;
  code?: string;
  description?: string;
  type: "BILL_THRESHOLD" | "BUY_X_GET_Y" | "CATEGORY_DISCOUNT" | "PRODUCT_DISCOUNT";
  discountType: "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_ITEM";
  discountValue: number;
  minSpend?: number;
  buyProductId?: string;
  buyQuantity?: number;
  getProductId?: string;
  getQuantity?: number;
  applicableCategories?: string[];
  applicableProducts?: string[];
  startDate: string;
  endDate: string;
  isActive: boolean;
  usageCount: number;
  usageLimit?: number;
}

interface LoyaltySettings {
  enabled: boolean;
  pointsPerSpend: number;
  redemptionRate: number;
  minPointsToRedeem: number;
}

interface StatsData {
  activePromotionsCount: number;
  totalPromotionsCount: number;
  totalUsageCount: number;
  pointsInCirculation: number;
}

interface ProductOption {
  _id: string;
  name: string;
  sellingPrice: number;
}

interface CategoryOption {
  _id: string;
  name: string;
}

interface CustomerLoyaltyRow {
  _id: string;
  name: string;
  phone: string;
  totalSpent: number;
  loyaltyPoints?: number;
  lifetimePointsEarned?: number;
  lifetimePointsRedeemed?: number;
}

export default function PromotionsPage() {
  const [activeTab, setActiveTab] = useState<"PROMOTIONS" | "LOYALTY">("PROMOTIONS");
  const [promotions, setPromotions] = useState<PromotionItem[]>([]);
  const [stats, setStats] = useState<StatsData>({
    activePromotionsCount: 0,
    totalPromotionsCount: 0,
    totalUsageCount: 0,
    pointsInCirculation: 0,
  });
  const [loyaltySettings, setLoyaltySettings] = useState<LoyaltySettings>({
    enabled: true,
    pointsPerSpend: 100,
    redemptionRate: 1,
    minPointsToRedeem: 50,
  });
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [customers, setCustomers] = useState<CustomerLoyaltyRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [savingPromo, setSavingPromo] = useState(false);
  const [savingLoyalty, setSavingLoyalty] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Form State for New Promo
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    type: "BILL_THRESHOLD" as PromotionItem["type"],
    discountType: "PERCENTAGE" as PromotionItem["discountType"],
    discountValue: 5,
    minSpend: 0,
    buyProductId: "",
    buyQuantity: 1,
    getProductId: "",
    getQuantity: 1,
    applicableCategoryId: "",
    applicableProductId: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    isActive: true,
    usageLimit: "",
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [promoRes, prodRes, catRes, custRes] = await Promise.all([
        fetch("/api/promotions"),
        fetch("/api/products"),
        fetch("/api/categories"),
        fetch("/api/customers"),
      ]);

      const promoJson = await promoRes.json();
      if (promoJson.success) {
        setPromotions(promoJson.promotions || []);
        if (promoJson.stats) setStats(promoJson.stats);
        if (promoJson.loyaltySettings) setLoyaltySettings(promoJson.loyaltySettings);
      }

      const prodJson = await prodRes.json();
      if (prodJson.success) {
        setProducts(prodJson.products || []);
      }

      const catJson = await catRes.json();
      if (catJson.success) {
        setCategories(catJson.categories || []);
      }

      const custJson = await custRes.json();
      if (custJson.success) {
        setCustomers(custJson.customers || []);
      }
    } catch (err) {
      console.error("Failed to load promotion data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleTogglePromoStatus = async (promo: PromotionItem) => {
    try {
      const res = await fetch(`/api/promotions/${promo._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !promo.isActive }),
      });
      const data = await res.json();
      if (data.success) {
        setPromotions((prev) =>
          prev.map((p) => (p._id === promo._id ? { ...p, isActive: !p.isActive } : p))
        );
        setFeedback({
          type: "success",
          message: `Promotion "${promo.name}" is now ${!promo.isActive ? "ACTIVE" : "INACTIVE"}.`,
        });
      } else {
        setFeedback({ type: "error", message: data.error || "Failed to update promotion" });
      }
    } catch {
      setFeedback({ type: "error", message: "Network error updating promotion" });
    }
  };

  const handleDeletePromo = async (promo: PromotionItem) => {
    if (!confirm(`Are you sure you want to remove promotion "${promo.name}"?`)) return;

    try {
      const res = await fetch(`/api/promotions/${promo._id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setPromotions((prev) => prev.filter((p) => p._id !== promo._id));
        setFeedback({ type: "success", message: `Promotion "${promo.name}" removed.` });
      } else {
        setFeedback({ type: "error", message: data.error || "Failed to delete promotion" });
      }
    } catch {
      setFeedback({ type: "error", message: "Network error deleting promotion" });
    }
  };

  const handleCreatePromoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPromo(true);
    setFeedback(null);

    try {
      const payload: Record<string, unknown> = {
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase() || undefined,
        description: formData.description.trim() || undefined,
        type: formData.type,
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue),
        minSpend: Number(formData.minSpend) || 0,
        startDate: formData.startDate,
        endDate: formData.endDate,
        isActive: formData.isActive,
        usageLimit: formData.usageLimit ? Number(formData.usageLimit) : undefined,
      };

      if (formData.type === "BUY_X_GET_Y") {
        payload.buyProductId = formData.buyProductId || undefined;
        payload.buyQuantity = Number(formData.buyQuantity) || 1;
        payload.getProductId = formData.getProductId || formData.buyProductId || undefined;
        payload.getQuantity = Number(formData.getQuantity) || 1;
      } else if (formData.type === "CATEGORY_DISCOUNT") {
        payload.applicableCategories = formData.applicableCategoryId ? [formData.applicableCategoryId] : [];
      } else if (formData.type === "PRODUCT_DISCOUNT") {
        payload.applicableProducts = formData.applicableProductId ? [formData.applicableProductId] : [];
      }

      const res = await fetch("/api/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setShowCreateModal(false);
        setFeedback({ type: "success", message: `Promotion "${formData.name}" created successfully!` });
        // Reset form
        setFormData({
          name: "",
          code: "",
          description: "",
          type: "BILL_THRESHOLD",
          discountType: "PERCENTAGE",
          discountValue: 5,
          minSpend: 0,
          buyProductId: "",
          buyQuantity: 1,
          getProductId: "",
          getQuantity: 1,
          applicableCategoryId: "",
          applicableProductId: "",
          startDate: new Date().toISOString().slice(0, 10),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          isActive: true,
          usageLimit: "",
        });
        fetchData();
      } else {
        setFeedback({ type: "error", message: data.error || "Failed to create promotion" });
      }
    } catch {
      setFeedback({ type: "error", message: "Network error creating promotion" });
    } finally {
      setSavingPromo(false);
    }
  };

  const handleSaveLoyaltySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingLoyalty(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/business", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loyaltySettings: {
            enabled: loyaltySettings.enabled,
            pointsPerSpend: Number(loyaltySettings.pointsPerSpend),
            redemptionRate: Number(loyaltySettings.redemptionRate),
            minPointsToRedeem: Number(loyaltySettings.minPointsToRedeem),
          },
        }),
      });

      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", message: "Loyalty program settings updated successfully!" });
      } else {
        setFeedback({ type: "error", message: data.error || "Failed to update loyalty settings" });
      }
    } catch {
      setFeedback({ type: "error", message: "Network error saving settings" });
    } finally {
      setSavingLoyalty(false);
    }
  };

  const filteredPromotions = useMemo(() => {
    return promotions.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.code && p.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      const now = new Date();
      const isExpired = new Date(p.endDate) < now;

      if (statusFilter === "ACTIVE") {
        return p.isActive && !isExpired;
      }
      if (statusFilter === "INACTIVE") {
        return !p.isActive || isExpired;
      }
      return true;
    });
  }, [promotions, searchQuery, statusFilter]);

  const sortedCustomers = useMemo(() => {
    return [...customers].sort((a, b) => (b.loyaltyPoints || 0) - (a.loyaltyPoints || 0));
  }, [customers]);

  return (
    <AppLayout>
      <div className="space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
              <Tag className="w-6 h-6 text-emerald-600" />
              Promotions & Customer Loyalty Program
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Configure bill threshold discounts, BOGO bundle deals, coupon codes, and Keells/Cargills-style customer points rewards.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Promotion
            </button>
          </div>
        </div>

        {/* Global Feedback Alert */}
        {feedback && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between ${
              feedback.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              )}
              <span className="text-sm font-medium">{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-xs underline hover:no-underline font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Active Deals</p>
              <h3 className="text-2xl font-black text-zinc-900 mt-1">{stats.activePromotionsCount}</h3>
              <p className="text-xs text-zinc-500 mt-0.5">of {stats.totalPromotionsCount} total rules</p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
              <Gift className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Total Redemptions</p>
              <h3 className="text-2xl font-black text-zinc-900 mt-1">{stats.totalUsageCount}</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Applied across all sales</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
              <ShoppingBag className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Points In Circulation</p>
              <h3 className="text-2xl font-black text-purple-700 mt-1">
                {(stats.pointsInCirculation || 0).toLocaleString()} <span className="text-sm font-normal text-zinc-500">pts</span>
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Worth {formatCurrency((stats.pointsInCirculation || 0) * (loyaltySettings.redemptionRate || 1))} in store credit
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600">
              <Award className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Loyalty Program</p>
              <div className="mt-1">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    loyaltySettings.enabled
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {loyaltySettings.enabled ? "ACTIVE (Accruing)" : "DISABLED"}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                1 pt / Rs. {loyaltySettings.pointsPerSpend} spent
              </p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
              <Coins className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="border-b border-zinc-200">
          <nav className="flex space-x-6">
            <button
              onClick={() => setActiveTab("PROMOTIONS")}
              className={`pb-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === "PROMOTIONS"
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
              }`}
            >
              <Tag className="w-4 h-4" />
              Promotions & Discount Rules
              <span className="ml-1.5 px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded-full text-xs font-bold">
                {promotions.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("LOYALTY")}
              className={`pb-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === "LOYALTY"
                  ? "border-purple-600 text-purple-700"
                  : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
              }`}
            >
              <Award className="w-4 h-4" />
              Customer Loyalty Program & Rewards
              <span className="ml-1.5 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-bold">
                {customers.filter((c) => (c.loyaltyPoints || 0) > 0).length} Members
              </span>
            </button>
          </nav>
        </div>

        {/* TAB 1: PROMOTIONS */}
        {activeTab === "PROMOTIONS" && (
          <div className="space-y-4">
            {/* Filter and Search Bar */}
            <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search by promo name or coupon code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => setStatusFilter("ALL")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    statusFilter === "ALL"
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  All Rules
                </button>
                <button
                  onClick={() => setStatusFilter("ACTIVE")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    statusFilter === "ACTIVE"
                      ? "bg-emerald-600 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  Active Only
                </button>
                <button
                  onClick={() => setStatusFilter("INACTIVE")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    statusFilter === "INACTIVE"
                      ? "bg-zinc-600 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  Inactive / Expired
                </button>
              </div>
            </div>

            {/* Promotions Grid */}
            {loading ? (
              <div className="bg-white p-12 text-center text-zinc-500 border border-zinc-200 rounded-xl">
                Loading store promotions...
              </div>
            ) : filteredPromotions.length === 0 ? (
              <div className="bg-white p-12 text-center border border-zinc-200 rounded-xl space-y-3">
                <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-400">
                  <Tag className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-zinc-800">No promotions found</h3>
                <p className="text-sm text-zinc-500 max-w-md mx-auto">
                  {searchQuery
                    ? `No promotions match your search "${searchQuery}".`
                    : "Create your first bill discount or BOGO bundle promotion to incentivize higher cart spend."}
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create Promotion
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPromotions.map((promo) => {
                  const now = new Date();
                  const isExpired = new Date(promo.endDate) < now;
                  const isScheduled = new Date(promo.startDate) > now;
                  const isLive = promo.isActive && !isExpired && !isScheduled;

                  return (
                    <div
                      key={promo._id}
                      className={`bg-white rounded-xl border p-5 shadow-sm transition-all hover:shadow-md flex flex-col justify-between ${
                        isLive ? "border-emerald-200" : "border-zinc-200 opacity-80"
                      }`}
                    >
                      <div>
                        {/* Status Badges Header */}
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                              promo.type === "BILL_THRESHOLD"
                                ? "bg-blue-100 text-blue-800"
                                : promo.type === "BUY_X_GET_Y"
                                ? "bg-amber-100 text-amber-800"
                                : promo.type === "CATEGORY_DISCOUNT"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {promo.type.replace(/_/g, " ")}
                          </span>

                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              isLive
                                ? "bg-emerald-100 text-emerald-800"
                                : isScheduled
                                ? "bg-blue-50 text-blue-700"
                                : "bg-zinc-100 text-zinc-600"
                            }`}
                          >
                            {isLive ? "● LIVE" : isScheduled ? "SCHEDULED" : "EXPIRED / OFF"}
                          </span>
                        </div>

                        {/* Title & Description */}
                        <h3 className="font-bold text-base text-zinc-900 leading-snug">{promo.name}</h3>
                        {promo.description && (
                          <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{promo.description}</p>
                        )}

                        {/* Discount Highlight */}
                        <div className="mt-3 p-3 bg-zinc-50 rounded-lg border border-zinc-100 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-zinc-600 font-medium">Reward Discount:</span>
                            <span className="font-black text-emerald-700 text-sm">
                              {promo.discountType === "PERCENTAGE"
                                ? `${promo.discountValue}% OFF`
                                : promo.discountType === "FIXED_AMOUNT"
                                ? `Rs. ${promo.discountValue.toLocaleString()} OFF`
                                : "FREE ITEM (100% OFF)"}
                            </span>
                          </div>

                          {promo.minSpend && promo.minSpend > 0 ? (
                            <div className="flex items-center justify-between text-xs text-zinc-600">
                              <span>Minimum Subtotal:</span>
                              <span className="font-semibold">{formatCurrency(promo.minSpend)}</span>
                            </div>
                          ) : null}

                          {promo.type === "BUY_X_GET_Y" && (
                            <div className="flex items-center justify-between text-xs text-zinc-600">
                              <span>Bundle Rule:</span>
                              <span className="font-semibold">
                                Buy {promo.buyQuantity || 1} Get {promo.getQuantity || 1} Free
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Coupon Code section */}
                        <div className="mt-3 flex items-center justify-between py-1.5 border-t border-zinc-100 text-xs">
                          <span className="text-zinc-500">Trigger:</span>
                          {promo.code ? (
                            <button
                              onClick={() => handleCopyCode(promo.code!)}
                              title="Click to copy coupon code"
                              className="inline-flex items-center gap-1 font-mono font-bold bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded hover:bg-amber-100 transition-colors"
                            >
                              <span>{promo.code}</span>
                              {copiedCode === promo.code ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3 text-amber-700" />
                              )}
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                              <Sparkles className="w-3 h-3" /> Auto-applied at Cart
                            </span>
                          )}
                        </div>

                        {/* Schedule & Usages */}
                        <div className="mt-2 space-y-1 text-xs text-zinc-500">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-zinc-400" /> Valid Until:
                            </span>
                            <span className="font-medium text-zinc-700">
                              {new Date(promo.endDate).toLocaleDateString()}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span>Redeemed:</span>
                            <span className="font-semibold text-zinc-800">
                              {promo.usageCount || 0} times
                              {promo.usageLimit ? ` (max ${promo.usageLimit})` : " (Unlimited)"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Card Actions Footer */}
                      <div className="mt-5 pt-3 border-t border-zinc-100 flex items-center justify-between">
                        <button
                          onClick={() => handleTogglePromoStatus(promo)}
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
                            promo.isActive
                              ? "bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100"
                              : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                          }`}
                        >
                          <Power className="w-3.5 h-3.5" />
                          {promo.isActive ? "Deactivate" : "Activate"}
                        </button>

                        <button
                          onClick={() => handleDeletePromo(promo)}
                          className="text-zinc-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                          title="Delete Promotion"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: LOYALTY PROGRAM & REWARDS */}
        {activeTab === "LOYALTY" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Loyalty Program Configuration (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm">
                <div className="flex items-center justify-between pb-4 border-b border-zinc-100 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                      <Award className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-zinc-900">Program Rules</h3>
                      <p className="text-xs text-zinc-500">Configure spend-to-points & redemption rate</p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSaveLoyaltySettings} className="space-y-4">
                  {/* Enable / Disable Switch */}
                  <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                    <div>
                      <label className="text-sm font-bold text-zinc-900">Customer Loyalty System</label>
                      <p className="text-xs text-zinc-500">Accrue and redeem points during POS checkout</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={loyaltySettings.enabled}
                        onChange={(e) =>
                          setLoyaltySettings((prev) => ({ ...prev, enabled: e.target.checked }))
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>

                  {/* Spend Per Point */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
                      Spend Threshold (LKR per 1 Point)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-zinc-400 font-bold">Rs.</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={loyaltySettings.pointsPerSpend}
                        onChange={(e) =>
                          setLoyaltySettings((prev) => ({
                            ...prev,
                            pointsPerSpend: Number(e.target.value),
                          }))
                        }
                        required
                        className="w-full pl-9 pr-3 py-2 border border-zinc-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1">
                      E.g. If set to 100, customer earns 1 point for every Rs. 100 spent.
                    </p>
                  </div>

                  {/* Redemption Rate */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
                      Point Value in LKR (Cash Redemption)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-zinc-400 font-bold">Rs.</span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={loyaltySettings.redemptionRate}
                        onChange={(e) =>
                          setLoyaltySettings((prev) => ({
                            ...prev,
                            redemptionRate: Number(e.target.value),
                          }))
                        }
                        required
                        className="w-full pl-9 pr-3 py-2 border border-zinc-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1">
                      E.g. If set to 1.00, redeeming 100 points knocks Rs. 100.00 off the bill.
                    </p>
                  </div>

                  {/* Minimum Points to Redeem */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
                      Minimum Redemption Floor
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={loyaltySettings.minPointsToRedeem}
                        onChange={(e) =>
                          setLoyaltySettings((prev) => ({
                            ...prev,
                            minPointsToRedeem: Number(e.target.value),
                          }))
                        }
                        required
                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-zinc-400 font-bold">Points</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1">
                      Minimum points customer must have accumulated before redemption is unlocked.
                    </p>
                  </div>

                  {/* Program Example Box */}
                  <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl space-y-1 text-xs text-purple-900">
                    <p className="font-bold flex items-center gap-1">
                      <Info className="w-3.5 h-3.5 text-purple-700" /> Example Scenario:
                    </p>
                    <p className="text-[11px] leading-relaxed text-purple-800">
                      Customer buys Rs. 5,000 in groceries $\rightarrow$ Earns{" "}
                      <strong>{Math.floor(5000 / (loyaltySettings.pointsPerSpend || 100))} points</strong>.
                      Once they hit {loyaltySettings.minPointsToRedeem} points, they can apply them at checkout
                      to reduce their bill by{" "}
                      <strong>
                        {formatCurrency(loyaltySettings.minPointsToRedeem * (loyaltySettings.redemptionRate || 1))}
                      </strong>
                      .
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={savingLoyalty}
                    className="w-full py-2.5 bg-purple-600 text-white text-sm font-bold rounded-lg hover:bg-purple-700 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {savingLoyalty ? "Saving Rules..." : "Save Loyalty Settings"}
                  </button>
                </form>
              </div>
            </div>

            {/* Right Column: Customer Loyalty Leaderboard (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm">
                <div className="flex items-center justify-between pb-4 border-b border-zinc-100 mb-4">
                  <div>
                    <h3 className="font-bold text-zinc-900 flex items-center gap-2">
                      <Users className="w-5 h-5 text-purple-600" />
                      Member Points Leaderboard
                    </h3>
                    <p className="text-xs text-zinc-500">Registered store shoppers and their current rewards balance</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                        <th className="pb-3">Customer</th>
                        <th className="pb-3 text-right">Total Spent</th>
                        <th className="pb-3 text-right">Points Balance</th>
                        <th className="pb-3 text-right">Cash Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {sortedCustomers.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-zinc-500 text-xs">
                            No registered customers yet. Enter customer phone numbers at POS checkout to auto-enroll them into rewards.
                          </td>
                        </tr>
                      ) : (
                        sortedCustomers.map((cust) => {
                          const pts = cust.loyaltyPoints || 0;
                          const val = pts * (loyaltySettings.redemptionRate || 1);

                          return (
                            <tr key={cust._id} className="hover:bg-zinc-50 transition-colors">
                              <td className="py-3">
                                <div className="font-bold text-zinc-900">{cust.name}</div>
                                <div className="text-xs text-zinc-500 font-mono">{cust.phone}</div>
                              </td>
                              <td className="py-3 text-right font-medium text-zinc-700">
                                {formatCurrency(cust.totalSpent || 0)}
                              </td>
                              <td className="py-3 text-right">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                                    pts >= loyaltySettings.minPointsToRedeem
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-purple-100 text-purple-800"
                                  }`}
                                >
                                  {pts.toLocaleString()} pts
                                </span>
                              </td>
                              <td className="py-3 text-right font-bold text-emerald-700">
                                {formatCurrency(val)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CREATE PROMOTION MODAL */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Tag className="w-5 h-5" />
                  </div>
                  <h2 className="text-lg font-bold text-zinc-900">Create New Promotion</h2>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-zinc-400 hover:text-zinc-600 text-lg font-bold p-1"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreatePromoSubmit} className="space-y-4">
                {/* Promo Name */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
                    Promotion Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Weekend Mega Saver 5% Off"
                    value={formData.name}
                    onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Coupon Code & Auto-Apply */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
                      Coupon Code (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. MEGA5"
                      value={formData.code}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, code: e.target.value.toUpperCase() }))
                      }
                      className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                    <p className="text-[11px] text-zinc-500 mt-1">Leave blank to auto-apply at POS</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
                      Promotion Type *
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => {
                        const newType = e.target.value as PromotionItem["type"];
                        setFormData((p) => ({
                          ...p,
                          type: newType,
                          discountType: newType === "BUY_X_GET_Y" ? "FREE_ITEM" : "PERCENTAGE",
                        }));
                      }}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="BILL_THRESHOLD">Bill Threshold (Over Rs. X)</option>
                      <option value="BUY_X_GET_Y">Buy X Get Y (BOGO / Free Item)</option>
                      <option value="CATEGORY_DISCOUNT">Category Discount</option>
                      <option value="PRODUCT_DISCOUNT">Product Specific Discount</option>
                    </select>
                  </div>
                </div>

                {/* Dynamic Configuration based on Type */}
                {formData.type === "BILL_THRESHOLD" && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
                        Discount Type
                      </label>
                      <select
                        value={formData.discountType}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            discountType: e.target.value as PromotionItem["discountType"],
                          }))
                        }
                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs font-medium"
                      >
                        <option value="PERCENTAGE">Percentage (%)</option>
                        <option value="FIXED_AMOUNT">Fixed Rupee (Rs.)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
                        Discount Value *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        required
                        value={formData.discountValue}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, discountValue: Number(e.target.value) }))
                        }
                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
                        Min Bill Subtotal
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.minSpend}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, minSpend: Number(e.target.value) }))
                        }
                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs font-semibold"
                        placeholder="e.g. 5000"
                      />
                    </div>
                  </div>
                )}

                {formData.type === "BUY_X_GET_Y" && (
                  <div className="space-y-3 p-3 bg-amber-50/50 rounded-xl border border-amber-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
                          Buy Product *
                        </label>
                        <select
                          required
                          value={formData.buyProductId}
                          onChange={(e) =>
                            setFormData((p) => ({ ...p, buyProductId: e.target.value }))
                          }
                          className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs font-medium"
                        >
                          <option value="">-- Choose Qualifying Item --</option>
                          {products.map((prod) => (
                            <option key={prod._id} value={prod._id}>
                              {prod.name} ({formatCurrency(prod.sellingPrice)})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
                          Buy Quantity Required *
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={formData.buyQuantity}
                          onChange={(e) =>
                            setFormData((p) => ({ ...p, buyQuantity: Number(e.target.value) }))
                          }
                          className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs font-bold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
                          Get Reward Product (or same)
                        </label>
                        <select
                          value={formData.getProductId}
                          onChange={(e) =>
                            setFormData((p) => ({ ...p, getProductId: e.target.value }))
                          }
                          className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs font-medium"
                        >
                          <option value="">-- Same as Buy Product --</option>
                          {products.map((prod) => (
                            <option key={prod._id} value={prod._id}>
                              {prod.name} ({formatCurrency(prod.sellingPrice)})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
                          Reward Free Quantity *
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={formData.getQuantity}
                          onChange={(e) =>
                            setFormData((p) => ({ ...p, getQuantity: Number(e.target.value) }))
                          }
                          className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs font-bold"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {formData.type === "CATEGORY_DISCOUNT" && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-purple-50/50 rounded-xl border border-purple-200">
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
                        Category *
                      </label>
                      <select
                        required
                        value={formData.applicableCategoryId}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, applicableCategoryId: e.target.value }))
                        }
                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs font-medium"
                      >
                        <option value="">-- Choose Category --</option>
                        {categories.map((cat) => (
                          <option key={cat._id} value={cat._id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
                        Discount Type
                      </label>
                      <select
                        value={formData.discountType}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            discountType: e.target.value as PromotionItem["discountType"],
                          }))
                        }
                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs font-medium"
                      >
                        <option value="PERCENTAGE">Percentage (%)</option>
                        <option value="FIXED_AMOUNT">Fixed Rupee (Rs.)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
                        Discount Value *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        required
                        value={formData.discountValue}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, discountValue: Number(e.target.value) }))
                        }
                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs font-bold"
                      />
                    </div>
                  </div>
                )}

                {formData.type === "PRODUCT_DISCOUNT" && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-emerald-50/50 rounded-xl border border-emerald-200">
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
                        Product *
                      </label>
                      <select
                        required
                        value={formData.applicableProductId}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, applicableProductId: e.target.value }))
                        }
                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs font-medium"
                      >
                        <option value="">-- Choose Product --</option>
                        {products.map((prod) => (
                          <option key={prod._id} value={prod._id}>
                            {prod.name} ({formatCurrency(prod.sellingPrice)})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
                        Discount Type
                      </label>
                      <select
                        value={formData.discountType}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            discountType: e.target.value as PromotionItem["discountType"],
                          }))
                        }
                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs font-medium"
                      >
                        <option value="PERCENTAGE">Percentage (%)</option>
                        <option value="FIXED_AMOUNT">Fixed Rupee (Rs.)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
                        Discount Value *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        required
                        value={formData.discountValue}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, discountValue: Number(e.target.value) }))
                        }
                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs font-bold"
                      />
                    </div>
                  </div>
                )}

                {/* Date Scheduling */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.startDate}
                      onChange={(e) => setFormData((p) => ({ ...p, startDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
                      End Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.endDate}
                      onChange={(e) => setFormData((p) => ({ ...p, endDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Optional Limits & Description */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
                      Total Usage Limit (Optional)
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 100 times"
                      value={formData.usageLimit}
                      onChange={(e) => setFormData((p) => ({ ...p, usageLimit: e.target.value }))}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
                      Description / Terms
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Valid on all weekend grocery purchases"
                      value={formData.description}
                      onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="pt-4 border-t border-zinc-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 border border-zinc-300 text-zinc-700 text-sm font-semibold rounded-lg hover:bg-zinc-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingPromo}
                    className="px-5 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {savingPromo ? "Creating Promotion..." : "Save & Activate"}
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
