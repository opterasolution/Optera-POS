"use client";

import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import {
  Boxes,
  AlertTriangle,
  PackageX,
  History,
  Search,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  ArrowRight,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { formatSLDateTime } from "@/lib/formatters";

interface ProductItem {
  _id: string;
  name: string;
  barcode?: string;
  sku?: string;
  stockQuantity: number;
  lowStockThreshold: number;
  unit: string;
  sellingPrice: number;
  categoryId?: { name: string };
}

interface MovementLog {
  _id: string;
  type: "RESTOCK" | "SALE" | "DAMAGE" | "ADJUSTMENT" | "RETURN";
  quantityChange: number;
  previousStock: number;
  newStock: number;
  reason?: string;
  createdAt: string;
  productId?: { name: string; unit: string; barcode?: string };
  createdBy?: { name: string; username: string };
}

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<"stock" | "history">("stock");
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [movements, setMovements] = useState<MovementLog[]>([]);
  const [summary, setSummary] = useState({
    totalProducts: 0,
    totalUnits: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<"all" | "low" | "out">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Adjustment Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<"RESTOCK" | "DAMAGE" | "ADJUSTMENT">("RESTOCK");
  const [adjustmentQty, setAdjustmentQty] = useState(10);
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadStock = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/inventory?status=${filterStatus}&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data.success) {
        setProducts(data.products || []);
        if (data.summary) setSummary(data.summary);
      }
    } catch {
      setStatusMessage({ type: "error", text: "Failed to load inventory stock." });
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/inventory/history");
      const data = await res.json();
      if (data.success) {
        setMovements(data.movements || []);
      }
    } catch {
      setStatusMessage({ type: "error", text: "Failed to load stock movement history." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "stock") {
      loadStock();
    } else {
      loadHistory();
    }
  }, [activeTab, filterStatus, searchQuery]);

  const openAdjustmentModal = (p: ProductItem, type: "RESTOCK" | "DAMAGE" | "ADJUSTMENT" = "RESTOCK") => {
    setSelectedProduct(p);
    setAdjustmentType(type);
    setAdjustmentQty(type === "RESTOCK" ? 10 : 1);
    setAdjustmentReason("");
    setIsModalOpen(true);
  };

  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    setSubmitting(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProduct._id,
          type: adjustmentType,
          quantity: adjustmentQty,
          reason: adjustmentReason.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setStatusMessage({ type: "success", text: data.message });
        setIsModalOpen(false);
        loadStock();
      } else {
        setStatusMessage({ type: "error", text: data.error || "Failed to update stock." });
      }
    } catch {
      setStatusMessage({ type: "error", text: "Error connecting to server." });
    } finally {
      setSubmitting(false);
    }
  };

  // Preview target stock
  const currentStock = selectedProduct?.stockQuantity || 0;
  const previewStock =
    adjustmentType === "RESTOCK"
      ? currentStock + adjustmentQty
      : adjustmentType === "DAMAGE"
      ? Math.max(0, currentStock - adjustmentQty)
      : adjustmentQty;

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Boxes className="w-6 h-6 text-blue-600" /> Inventory & Stock
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Track retail stock, record supplier restocks, log damaged goods, and audit inventory movements.
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("stock")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "stock"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Current Stock
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === "history"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Stock History Log</span>
            </button>
          </div>
        </div>

        {/* Status Alert */}
        {statusMessage && (
          <div
            className={`p-4 rounded-xl text-xs flex items-center justify-between ${
              statusMessage.type === "success"
                ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                : "bg-rose-50 border border-rose-200 text-rose-800"
            }`}
          >
            <div className="flex items-center gap-2.5 font-medium">
              {statusMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-slate-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
              <span>Total Units on Shelves</span>
              <Boxes className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">
              {summary.totalUnits} <span className="text-sm font-normal text-slate-500">units</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Across {summary.totalProducts} catalog products</p>
          </div>

          <button
            onClick={() => {
              setActiveTab("stock");
              setFilterStatus("low");
            }}
            className={`p-5 rounded-2xl border text-left transition-all shadow-sm ${
              filterStatus === "low"
                ? "bg-amber-50 border-amber-300 ring-2 ring-amber-400/30"
                : "bg-white border-slate-200 hover:border-amber-200"
            }`}
          >
            <div className="flex items-center justify-between text-amber-700 text-xs font-medium mb-1">
              <span>Low-Stock Alerts</span>
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-amber-700">
              {summary.lowStockCount}{" "}
              <span className="text-sm font-normal text-amber-600">items</span>
            </div>
            <p className="text-[11px] text-amber-600/80 mt-1">Stock under minimum safety threshold</p>
          </button>

          <button
            onClick={() => {
              setActiveTab("stock");
              setFilterStatus("out");
            }}
            className={`p-5 rounded-2xl border text-left transition-all shadow-sm ${
              filterStatus === "out"
                ? "bg-rose-50 border-rose-300 ring-2 ring-rose-400/30"
                : "bg-white border-slate-200 hover:border-rose-200"
            }`}
          >
            <div className="flex items-center justify-between text-rose-700 text-xs font-medium mb-1">
              <span>Out-of-Stock</span>
              <PackageX className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-black text-rose-700">
              {summary.outOfStockCount}{" "}
              <span className="text-sm font-normal text-rose-600">items</span>
            </div>
            <p className="text-[11px] text-rose-600/80 mt-1">Items at 0 quantity on shelves</p>
          </button>
        </div>

        {/* TAB 1: CURRENT STOCK */}
        {activeTab === "stock" && (
          <div className="space-y-4">
            {/* Search and Filters Toolbar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search item or barcode..."
                  className="w-full pl-10 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto text-xs">
                <button
                  onClick={() => setFilterStatus("all")}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    filterStatus === "all"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  All Items
                </button>
                <button
                  onClick={() => setFilterStatus("low")}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    filterStatus === "low"
                      ? "bg-amber-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Low Stock
                </button>
                <button
                  onClick={() => setFilterStatus("out")}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    filterStatus === "out"
                      ? "bg-rose-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Out of Stock
                </button>
              </div>
            </div>

            {/* Inventory Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                    <tr>
                      <th className="py-3 px-4">Product Name</th>
                      <th className="py-3 px-4">Barcode / SKU</th>
                      <th className="py-3 px-4 text-center">Current Stock</th>
                      <th className="py-3 px-4 text-center">Safety Limit</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Stock Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          Loading inventory stock...
                        </td>
                      </tr>
                    ) : products.length > 0 ? (
                      products.map((p) => {
                        const isOut = p.stockQuantity <= 0;
                        const isLow = p.stockQuantity <= p.lowStockThreshold && !isOut;

                        return (
                          <tr key={p._id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-900">{p.name}</div>
                              <div className="text-[10px] text-slate-400 capitalize">Unit: {p.unit}</div>
                            </td>
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                              {p.barcode || p.sku || "—"}
                            </td>
                            <td className="py-3 px-4 text-center font-bold text-sm text-slate-900 font-mono">
                              {p.stockQuantity}{" "}
                              <span className="text-[10px] font-normal text-slate-500">{p.unit}</span>
                            </td>
                            <td className="py-3 px-4 text-center text-slate-500 font-mono">
                              {p.lowStockThreshold} {p.unit}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  isOut
                                    ? "bg-rose-100 text-rose-800"
                                    : isLow
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-emerald-100 text-emerald-800"
                                }`}
                              >
                                {isOut ? "Out of Stock" : isLow ? "Low Stock" : "In Stock"}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => openAdjustmentModal(p, "RESTOCK")}
                                  className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium rounded-lg text-[11px] transition-colors flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Restock</span>
                                </button>
                                <button
                                  onClick={() => openAdjustmentModal(p, "DAMAGE")}
                                  className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium rounded-lg text-[11px] transition-colors flex items-center gap-1"
                                >
                                  <Minus className="w-3 h-3" />
                                  <span>Damage</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          No matching inventory items found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: STOCK MOVEMENT HISTORY */}
        {activeTab === "history" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                <History className="w-4 h-4 text-blue-600" /> Chronological Stock Audit Trail
              </h3>
              <button
                onClick={loadHistory}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                title="Refresh History"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4 text-center">Change</th>
                    <th className="py-3 px-4 text-center">Before & After</th>
                    <th className="py-3 px-4">Reason / Notes</th>
                    <th className="py-3 px-4 text-right">Staff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        Loading movement history...
                      </td>
                    </tr>
                  ) : movements.length > 0 ? (
                    movements.map((m) => {
                      const isPositive = m.quantityChange > 0;

                      return (
                        <tr key={m._id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                            {formatSLDateTime(m.createdAt)}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {m.productId?.name || "Product"}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                m.type === "RESTOCK"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : m.type === "SALE"
                                  ? "bg-blue-100 text-blue-800"
                                  : m.type === "DAMAGE"
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {m.type}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold">
                            <span
                              className={`inline-flex items-center gap-0.5 ${
                                isPositive ? "text-emerald-600" : "text-rose-600"
                              }`}
                            >
                              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {isPositive ? `+${m.quantityChange}` : m.quantityChange}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-600">
                            {m.previousStock} → <span className="font-bold text-slate-900">{m.newStock}</span>
                          </td>
                          <td className="py-3 px-4 text-slate-600 italic">
                            {m.reason || "—"}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-600">
                            {m.createdBy?.name || m.createdBy?.username || "Admin"}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No stock movement logs recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal: Quick Stock Adjustment */}
        {isModalOpen && selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-sm">Adjust Stock: {selectedProduct.name}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAdjustmentSubmit} className="space-y-4">
                {/* Action Type Toggle */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Adjustment Action</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAdjustmentType("RESTOCK")}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                        adjustmentType === "RESTOCK"
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                          : "border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      + Add Stock (Restock)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustmentType("DAMAGE")}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                        adjustmentType === "DAMAGE"
                          ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                          : "border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      - Deduct (Damage / Expired)
                    </button>
                  </div>
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Units to {adjustmentType === "RESTOCK" ? "Add" : "Remove"} ({selectedProduct.unit})
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={adjustmentQty}
                    onChange={(e) => setAdjustmentQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Reason / Note (Optional)</label>
                  <input
                    type="text"
                    value={adjustmentReason}
                    onChange={(e) => setAdjustmentReason(e.target.value)}
                    placeholder={
                      adjustmentType === "RESTOCK"
                        ? "e.g. Received weekly supplier shipment"
                        : "e.g. Expired date / damaged package"
                    }
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                {/* Before / After Preview */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs font-medium">
                  <div className="text-slate-600">
                    <span>Current Stock: </span>
                    <span className="font-bold text-slate-900">{currentStock}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                  <div className="text-slate-600">
                    <span>New Stock: </span>
                    <span className="font-black text-blue-600 text-sm">
                      {previewStock} {selectedProduct.unit}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm disabled:opacity-50"
                  >
                    {submitting ? "Saving..." : "Confirm Stock Adjustment"}
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
