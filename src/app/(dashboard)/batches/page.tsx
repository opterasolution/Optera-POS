"use client";

import { useEffect, useState, useMemo } from "react";
import AppLayout from "@/components/layout/AppLayout";
import {
  Boxes,
  Calendar,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Coins,
  RefreshCw,
  Search,
  Plus,
  Printer,
  ChevronRight,
  Filter,
  Check,
  Edit2,
  Lock,
  Unlock,
  Package,
  Layers,
  Sparkles,
  TrendingDown,
  CalendarClock,
  Building2,
  FileText,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { getDaysUntilExpiry, getExpiryBadgeInfo } from "@/lib/fefo";

interface BatchItem {
  _id: string;
  productId: string;
  productName: string;
  productBarcode?: string;
  productSku?: string;
  batchNumber: string;
  manufacturingDate?: string;
  expiryDate: string;
  costPrice: number;
  sellingPrice: number;
  mrp?: number;
  initialQuantity: number;
  quantityAvailable: number;
  quantitySold: number;
  quantityDamaged: number;
  status: "ACTIVE" | "NEAR_EXPIRY" | "EXPIRED" | "DEPLETED" | "QUARANTINED";
  supplierName?: string;
  poNumber?: string;
  quarantineReason?: string;
  quarantinedAt?: string;
  quarantinedBy?: string;
  notes?: string;
  createdAt: string;
}

interface ProductOption {
  _id: string;
  name: string;
  barcode?: string;
  sku?: string;
  costPrice: number;
  sellingPrice: number;
  stockQuantity: number;
  unit: string;
}

export default function BatchesPage() {
  const [activeTab, setActiveTab] = useState<"all" | "near_expiry" | "quarantined" | "report">("all");
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Stats
  const [stats, setStats] = useState({
    totalBatches: 0,
    activeCount: 0,
    nearExpiryCount: 0,
    expiredCount: 0,
    quarantinedCount: 0,
    totalStockUnits: 0,
    totalInventoryValue: 0,
    atRiskValue: 0,
  });

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [expiringDaysFilter, setExpiringDaysFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [intakeForm, setIntakeForm] = useState({
    productId: "",
    batchNumber: "",
    manufacturingDate: "",
    expiryDate: "",
    costPrice: 0,
    sellingPrice: 0,
    mrp: "",
    quantity: 10,
    supplierName: "",
    poNumber: "",
    notes: "",
  });
  const [submittingIntake, setSubmittingIntake] = useState(false);

  // Quarantine Modal
  const [quarantineTarget, setQuarantineTarget] = useState<BatchItem | null>(null);
  const [quarantineReason, setQuarantineReason] = useState("");
  const [submittingQuarantine, setSubmittingQuarantine] = useState(false);

  // Edit Modal
  const [editTarget, setEditTarget] = useState<BatchItem | null>(null);
  const [editForm, setEditForm] = useState({
    sellingPrice: 0,
    mrp: "",
    expiryDate: "",
    notes: "",
  });
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Fetch batches
  const fetchBatches = async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "25",
        q: searchQuery,
      });

      if (activeTab === "near_expiry") {
        params.set("expiringDays", "60");
      } else if (activeTab === "quarantined") {
        params.set("status", "QUARANTINED");
      } else {
        if (statusFilter !== "ALL") params.set("status", statusFilter);
        if (expiringDaysFilter !== "ALL") params.set("expiringDays", expiringDaysFilter);
      }

      const res = await fetch(`/api/batches?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setBatches(data.batches || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotalCount(data.pagination?.total || 0);
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (err) {
      console.error("Failed to fetch batches:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch product catalog for intake selector
  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/products?limit=200");
      const data = await res.json();
      if (data.success) {
        setProducts(data.products || []);
      }
    } catch (err) {
      console.error("Failed to fetch products:", err);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    fetchBatches();
  }, [page, activeTab, statusFilter, expiringDaysFilter, searchQuery]);

  // Handle Product Selection in Intake Form
  const handleSelectProduct = (productId: string) => {
    const prod = products.find((p) => p._id === productId);
    if (prod) {
      setIntakeForm((prev) => ({
        ...prev,
        productId,
        costPrice: prod.costPrice || 0,
        sellingPrice: prod.sellingPrice || 0,
      }));
    } else {
      setIntakeForm((prev) => ({ ...prev, productId }));
    }
  };

  // Handle Intake Form Submit
  const handleIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intakeForm.productId || !intakeForm.batchNumber.trim() || !intakeForm.expiryDate) {
      setFeedback({ type: "error", message: "Please fill in Product, Batch Number, and Expiry Date." });
      return;
    }

    setSubmittingIntake(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...intakeForm,
          mrp: intakeForm.mrp ? Number(intakeForm.mrp) : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", message: data.message || "Batch successfully created!" });
        setShowIntakeModal(false);
        // Reset
        setIntakeForm({
          productId: "",
          batchNumber: "",
          manufacturingDate: "",
          expiryDate: "",
          costPrice: 0,
          sellingPrice: 0,
          mrp: "",
          quantity: 10,
          supplierName: "",
          poNumber: "",
          notes: "",
        });
        fetchBatches();
      } else {
        setFeedback({ type: "error", message: data.error || "Failed to intake batch." });
      }
    } catch {
      setFeedback({ type: "error", message: "Network error creating batch." });
    } finally {
      setSubmittingIntake(false);
    }
  };

  // Handle Quarantine Action
  const handleQuarantineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quarantineTarget) return;

    setSubmittingQuarantine(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/batches/${quarantineTarget._id}/quarantine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "QUARANTINE",
          quarantineReason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", message: data.message });
        setQuarantineTarget(null);
        setQuarantineReason("");
        fetchBatches();
      } else {
        setFeedback({ type: "error", message: data.error || "Failed to quarantine batch." });
      }
    } catch {
      setFeedback({ type: "error", message: "Network error quarantining batch." });
    } finally {
      setSubmittingQuarantine(false);
    }
  };

  // Handle Release from Quarantine
  const handleReleaseFromQuarantine = async (batchItem: BatchItem) => {
    if (!confirm(`Release batch ${batchItem.batchNumber} back to active inventory?`)) return;

    try {
      const res = await fetch(`/api/batches/${batchItem._id}/quarantine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RELEASE" }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", message: data.message });
        fetchBatches();
      } else {
        setFeedback({ type: "error", message: data.error || "Failed to release batch." });
      }
    } catch {
      setFeedback({ type: "error", message: "Network error releasing batch." });
    }
  };

  // Handle Edit Batch Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;

    setSubmittingEdit(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/batches/${editTarget._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellingPrice: Number(editForm.sellingPrice),
          mrp: editForm.mrp ? Number(editForm.mrp) : undefined,
          expiryDate: editForm.expiryDate || undefined,
          notes: editForm.notes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", message: data.message });
        setEditTarget(null);
        fetchBatches();
      } else {
        setFeedback({ type: "error", message: data.error || "Failed to update batch." });
      }
    } catch {
      setFeedback({ type: "error", message: "Network error updating batch." });
    } finally {
      setSubmittingEdit(false);
    }
  };

  const openEditModal = (batch: BatchItem) => {
    setEditTarget(batch);
    setEditForm({
      sellingPrice: batch.sellingPrice,
      mrp: batch.mrp ? batch.mrp.toString() : "",
      expiryDate: batch.expiryDate ? new Date(batch.expiryDate).toISOString().slice(0, 10) : "",
      notes: batch.notes || "",
    });
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                <Boxes className="w-6 h-6" />
              </span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Batch Expiry & FEFO Dispensing Hub
                </h1>
                <p className="text-sm text-slate-500">
                  Sri Lanka pharmacy & retail lot tracking: First-Expired-First-Out dispensing, shelf-life alerts & quarantine
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                fetchBatches();
                setFeedback({ type: "success", message: "Shelf-life telemetry refreshed." });
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 shadow-sm transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={() => setActiveTab("report")}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 shadow-sm transition-colors"
            >
              <Printer className="w-4 h-4" />
              Expiry Audit Slip
            </button>
            <button
              onClick={() => setShowIntakeModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Intake New Batch
            </button>
          </div>
        </div>

        {/* Global Feedback Alert */}
        {feedback && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between animate-in fade-in duration-200 ${
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

        {/* Financial & Shelf-Life KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Batches</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">
                {stats.activeCount.toLocaleString()}{" "}
                <span className="text-xs font-normal text-slate-500">/ {stats.totalBatches} total</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {stats.totalStockUnits.toLocaleString()} total units on shelves
              </p>
            </div>
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
              <Layers className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Critical / Near Expiry</p>
              <h3 className="text-2xl font-black text-amber-600 mt-1">
                {stats.nearExpiryCount.toLocaleString()}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Expiring within 30 to 60 days</p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
              <CalendarClock className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Expired & Quarantined</p>
              <h3 className="text-2xl font-black text-red-600 mt-1">
                {(stats.expiredCount + stats.quarantinedCount).toLocaleString()}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {stats.expiredCount} expired · {stats.quarantinedCount} quarantined
              </p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-red-600">
              <ShieldAlert className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">At-Risk Stock Value</p>
              <h3 className="text-2xl font-black text-purple-700 mt-1">
                {formatCurrency(stats.atRiskValue)}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {stats.totalInventoryValue > 0
                  ? `${((stats.atRiskValue / stats.totalInventoryValue) * 100).toFixed(1)}% of inventory value`
                  : "Rs. 0 at risk"}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600">
              <Coins className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-slate-200">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab("all")}
              className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                activeTab === "all"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              <Boxes className="w-4 h-4" />
              All Batches & Shelf-Life Monitor
              <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 font-semibold">
                {totalCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("near_expiry")}
              className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                activeTab === "near_expiry"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              <CalendarClock className="w-4 h-4" />
              Near-Expiry Clearance Queue
              {stats.nearExpiryCount > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800 font-semibold">
                  {stats.nearExpiryCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("quarantined")}
              className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                activeTab === "quarantined"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              Quarantined & Recalled Lots
              {stats.quarantinedCount > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-800 font-semibold">
                  {stats.quarantinedCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("report")}
              className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                activeTab === "report"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              <FileText className="w-4 h-4" />
              Expiry & Disposal Audit Report
            </button>
          </nav>
        </div>

        {/* TAB 1: ALL BATCHES & SHELF-LIFE MONITOR */}
        {(activeTab === "all" || activeTab === "near_expiry" || activeTab === "quarantined") && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="relative w-full md:w-96">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search batch number, product name, barcode..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {activeTab === "all" && (
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="ALL">All Batch Statuses</option>
                    <option value="ACTIVE">Active (Sellable)</option>
                    <option value="NEAR_EXPIRY">Near Expiry (&le; 60 Days)</option>
                    <option value="EXPIRED">Expired (Disposal)</option>
                    <option value="DEPLETED">Depleted (0 Stock)</option>
                    <option value="QUARANTINED">Quarantined / Recalled</option>
                  </select>

                  <select
                    value={expiringDaysFilter}
                    onChange={(e) => {
                      setExpiringDaysFilter(e.target.value);
                      setPage(1);
                    }}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="ALL">All Expiry Windows</option>
                    <option value="30">&le; 30 Days (Critical)</option>
                    <option value="60">&le; 60 Days (Near Expiry)</option>
                    <option value="90">&le; 90 Days (Warning)</option>
                  </select>
                </div>
              )}
            </div>

            {/* Batches Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="py-3 px-4">Batch Number / Lot</th>
                      <th className="py-3 px-4">Product Name</th>
                      <th className="py-3 px-4">Expiry Date</th>
                      <th className="py-3 px-4">Shelf-Life Status</th>
                      <th className="py-3 px-4 text-right">Available Stock</th>
                      <th className="py-3 px-4 text-right">Cost / Selling (Rs.)</th>
                      <th className="py-3 px-4 text-right">Batch Value</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-500">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
                          Loading batch expiry telemetry...
                        </td>
                      </tr>
                    ) : batches.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-500">
                          <Boxes className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                          No batches found matching your filters.
                        </td>
                      </tr>
                    ) : (
                      batches.map((b) => {
                        const badgeInfo = getExpiryBadgeInfo(b.expiryDate, b.status);
                        const batchValue = (b.quantityAvailable || 0) * (b.costPrice || 0);

                        return (
                          <tr key={b._id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4">
                              <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                {b.batchNumber}
                              </span>
                              {b.mrp && (
                                <p className="text-[11px] text-slate-500 mt-1 font-mono">
                                  MRP: Rs. {b.mrp.toLocaleString()}
                                </p>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-semibold text-slate-900 leading-tight">{b.productName}</p>
                              {b.productBarcode && (
                                <p className="text-xs font-mono text-slate-400 mt-0.5">{b.productBarcode}</p>
                              )}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <p className="font-medium text-slate-800">
                                {new Date(b.expiryDate).toLocaleDateString("en-LK", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </p>
                              {b.manufacturingDate && (
                                <p className="text-[11px] text-slate-400">
                                  Mfg: {new Date(b.manufacturingDate).toLocaleDateString("en-LK", { month: "short", year: "numeric" })}
                                </p>
                              )}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${badgeInfo.badgeColor}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${badgeInfo.indicatorColor}`} />
                                {badgeInfo.label}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <p className="font-bold text-slate-900 font-mono">
                                {b.quantityAvailable.toLocaleString()}
                              </p>
                              <p className="text-[11px] text-slate-400">
                                of {b.initialQuantity.toLocaleString()} inward
                              </p>
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap font-mono text-xs">
                              <p className="text-slate-900 font-semibold">Rs. {b.sellingPrice.toLocaleString()}</p>
                              <p className="text-slate-400 text-[11px]">Cost: Rs. {b.costPrice.toLocaleString()}</p>
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-xs font-semibold text-purple-700 whitespace-nowrap">
                              {formatCurrency(batchValue)}
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              {b.status === "QUARANTINED" ? (
                                <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-800">
                                  QUARANTINED
                                </span>
                              ) : b.status === "EXPIRED" ? (
                                <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800">
                                  EXPIRED
                                </span>
                              ) : b.status === "DEPLETED" ? (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                                  DEPLETED
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
                                  ACTIVE
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => openEditModal(b)}
                                  title="Edit batch pricing / notes"
                                  className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                {b.status === "QUARANTINED" ? (
                                  <button
                                    onClick={() => handleReleaseFromQuarantine(b)}
                                    title="Release back to active sales"
                                    className="p-1.5 text-purple-700 hover:bg-purple-100 rounded transition-colors"
                                  >
                                    <Unlock className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setQuarantineTarget(b);
                                      setQuarantineReason("");
                                    }}
                                    title="Quarantine batch"
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  >
                                    <Lock className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="p-4 border-t border-slate-200 flex items-center justify-between text-sm text-slate-500">
                  <span>
                    Showing page {page} of {totalPages} ({totalCount} total batches)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 border border-slate-300 rounded-md disabled:opacity-50 hover:bg-slate-50"
                    >
                      Previous
                    </button>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="px-3 py-1.5 border border-slate-300 rounded-md disabled:opacity-50 hover:bg-slate-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: BATCH DISPOSAL & EXPIRY AUDIT REPORT */}
        {activeTab === "report" && (
          <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm max-w-4xl mx-auto space-y-6 print:p-0 print:border-none print:shadow-none">
            {/* Action Bar */}
            <div className="flex items-center justify-between border-b pb-4 print:hidden">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Batch Expiry & Disposal Audit Statement</h2>
                <p className="text-xs text-slate-500">
                  Certified document for NMRA regulatory compliance, tax write-offs, and stock disposal auditing
                </p>
              </div>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 shadow-sm transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print Statement
              </button>
            </div>

            {/* Document Header */}
            <div className="border-b pb-6">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-900 uppercase">
                    Batch Expiry & Shelf-Life Audit Report
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    Generated on: {new Date().toLocaleDateString("en-LK", { dateStyle: "full" })}
                  </p>
                  <p className="text-xs text-slate-500 font-mono">
                    Report Ref: EXP-AUDIT-{new Date().toISOString().slice(0, 10).replace(/-/g, "")}
                  </p>
                </div>
                <div className="text-right">
                  <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full uppercase">
                    Audit Certificate
                  </span>
                </div>
              </div>
            </div>

            {/* Report Summary Cards */}
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-500">Total Expired Lots:</span>
                <p className="text-lg font-bold text-red-600 mt-0.5">{stats.expiredCount}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-500">Near Expiry (&le; 60d):</span>
                <p className="text-lg font-bold text-amber-600 mt-0.5">{stats.nearExpiryCount}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-500">Total At-Risk Inventory Value:</span>
                <p className="text-lg font-bold text-purple-700 mt-0.5">{formatCurrency(stats.atRiskValue)}</p>
              </div>
            </div>

            {/* Itemized Table of Expired / Quarantined Lots */}
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                Itemized Schedule of At-Risk / Expired Inventory
              </h3>
              <table className="w-full text-xs text-left border border-slate-200 divide-y divide-slate-200">
                <thead className="bg-slate-100 text-slate-700 font-semibold">
                  <tr>
                    <th className="p-2">Batch #</th>
                    <th className="p-2">Product Description</th>
                    <th className="p-2">Expiry Date</th>
                    <th className="p-2 text-right">Units</th>
                    <th className="p-2 text-right">Cost (Rs.)</th>
                    <th className="p-2 text-right">Loss / Write-off (Rs.)</th>
                    <th className="p-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {batches
                    .filter((b) => b.status === "EXPIRED" || b.status === "QUARANTINED" || getDaysUntilExpiry(b.expiryDate) <= 60)
                    .map((b) => (
                      <tr key={b._id}>
                        <td className="p-2 font-mono font-semibold">{b.batchNumber}</td>
                        <td className="p-2">{b.productName}</td>
                        <td className="p-2 font-mono">{new Date(b.expiryDate).toLocaleDateString("en-LK")}</td>
                        <td className="p-2 text-right font-mono">{b.quantityAvailable}</td>
                        <td className="p-2 text-right font-mono">{b.costPrice.toFixed(2)}</td>
                        <td className="p-2 text-right font-mono font-bold text-red-700">
                          {(b.quantityAvailable * b.costPrice).toFixed(2)}
                        </td>
                        <td className="p-2 text-center">
                          <span className="font-semibold">{b.status}</span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Auditor & Pharmacist Sign-Off Blocks */}
            <div className="grid grid-cols-2 gap-8 pt-12 text-xs text-slate-600">
              <div className="border-t border-slate-400 pt-2 text-center">
                <p className="font-semibold text-slate-800">Inventory Officer / Pharmacist in Charge</p>
                <p className="text-[11px] text-slate-400 mt-1">Signature & Date</p>
              </div>
              <div className="border-t border-slate-400 pt-2 text-center">
                <p className="font-semibold text-slate-800">Authorized Store Manager / Owner</p>
                <p className="text-[11px] text-slate-400 mt-1">Verification & Write-Off Sign-Off</p>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 1: INTAKE NEW BATCH */}
        {showIntakeModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                    <Plus className="w-4 h-4" />
                  </span>
                  <h3 className="font-bold text-slate-900">Inward Batch Stock Intake</h3>
                </div>
                <button
                  onClick={() => setShowIntakeModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleIntakeSubmit} className="space-y-4">
                {/* Select Product */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Select Product *</label>
                  <select
                    required
                    value={intakeForm.productId}
                    onChange={(e) => handleSelectProduct(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">-- Choose Product from Catalog --</option>
                    {products.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} ({p.barcode || "No Barcode"}) - Current Stock: {p.stockQuantity} {p.unit}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Batch Number */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Batch / Lot Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. BN-202610-001 or LOT-8812"
                      value={intakeForm.batchNumber}
                      onChange={(e) => setIntakeForm({ ...intakeForm, batchNumber: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none uppercase"
                    />
                  </div>

                  {/* Quantity Inward */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Inward Quantity *</label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={intakeForm.quantity}
                      onChange={(e) => setIntakeForm({ ...intakeForm, quantity: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Manufacturing Date */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Manufacturing Date</label>
                    <input
                      type="date"
                      value={intakeForm.manufacturingDate}
                      onChange={(e) => setIntakeForm({ ...intakeForm, manufacturingDate: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  {/* Expiry Date */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Expiry Date * (FEFO Key)</label>
                    <input
                      type="date"
                      required
                      value={intakeForm.expiryDate}
                      onChange={(e) => setIntakeForm({ ...intakeForm, expiryDate: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {/* Cost Price */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Cost Price (Rs.)</label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={intakeForm.costPrice}
                      onChange={(e) => setIntakeForm({ ...intakeForm, costPrice: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  {/* Selling Price */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Selling Price (Rs.)</label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={intakeForm.sellingPrice}
                      onChange={(e) => setIntakeForm({ ...intakeForm, sellingPrice: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  {/* MRP */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">MRP (Max Retail)</label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      placeholder="Optional"
                      value={intakeForm.mrp}
                      onChange={(e) => setIntakeForm({ ...intakeForm, mrp: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Supplier Name */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Supplier Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Hemas Pharmaceuticals"
                      value={intakeForm.supplierName}
                      onChange={(e) => setIntakeForm({ ...intakeForm, supplierName: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  {/* PO Number */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">PO / GRN Number</label>
                    <input
                      type="text"
                      placeholder="e.g. PO-20261001-001"
                      value={intakeForm.poNumber}
                      onChange={(e) => setIntakeForm({ ...intakeForm, poNumber: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none uppercase"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Intake Notes</label>
                  <textarea
                    rows={2}
                    placeholder="Shelf rack location, packaging condition, delivery memo..."
                    value={intakeForm.notes}
                    onChange={(e) => setIntakeForm({ ...intakeForm, notes: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t">
                  <button
                    type="button"
                    onClick={() => setShowIntakeModal(false)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingIntake}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {submittingIntake ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Confirm Batch Intake
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: QUARANTINE BATCH */}
        {quarantineTarget && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <span className="p-2 bg-red-100 text-red-600 rounded-xl">
                  <ShieldAlert className="w-6 h-6" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900">Quarantine Batch Stock</h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Batch: {quarantineTarget.batchNumber} ({quarantineTarget.productName})
                  </p>
                </div>
              </div>

              <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-xs text-red-800 space-y-1">
                <p className="font-semibold">Immediate Dispensing Lockdown</p>
                <p>
                  Quarantining this batch will immediately prevent it from being allocated or sold at POS counters.
                  Total {quarantineTarget.quantityAvailable} units will be isolated from sellable stock.
                </p>
              </div>

              <form onSubmit={handleQuarantineSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Reason for Quarantine *</label>
                  <select
                    required
                    value={quarantineReason}
                    onChange={(e) => setQuarantineReason(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-red-500 focus:outline-none"
                  >
                    <option value="">-- Select Quarantine Reason --</option>
                    <option value="NMRA regulatory safety recall">NMRA regulatory safety recall</option>
                    <option value="Supplier quality / manufacturing defect recall">Supplier quality / manufacturing defect recall</option>
                    <option value="Damaged seal / broken packaging">Damaged seal / broken packaging</option>
                    <option value="Cold-chain temperature excursion">Cold-chain temperature excursion</option>
                    <option value="Expired past shelf-life on retail floor">Expired past shelf-life on retail floor</option>
                    <option value="Customer complaint under investigation">Customer complaint under investigation</option>
                  </select>
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t">
                  <button
                    type="button"
                    onClick={() => setQuarantineTarget(null)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingQuarantine || !quarantineReason}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {submittingQuarantine ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                    Lock & Quarantine Lot
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 3: EDIT BATCH PRICING & DETAILS */}
        {editTarget && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                    <Edit2 className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="font-bold text-slate-900">Edit Batch Details</h3>
                    <p className="text-xs text-slate-500 font-mono">Lot: {editTarget.batchNumber}</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditTarget(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Selling Price (Rs.)</label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={editForm.sellingPrice}
                      onChange={(e) => setEditForm({ ...editForm, sellingPrice: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">MRP (Max Retail)</label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      placeholder="Optional"
                      value={editForm.mrp}
                      onChange={(e) => setEditForm({ ...editForm, mrp: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Expiry Date</label>
                  <input
                    type="date"
                    value={editForm.expiryDate}
                    onChange={(e) => setEditForm({ ...editForm, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Notes / Audit Remarks</label>
                  <textarea
                    rows={2}
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t">
                  <button
                    type="button"
                    onClick={() => setEditTarget(null)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingEdit}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {submittingEdit ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Save Changes
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
