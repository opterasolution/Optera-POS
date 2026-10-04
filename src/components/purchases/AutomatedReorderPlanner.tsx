"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Boxes,
  Truck,
  TrendingDown,
  Building,
  RefreshCw,
  Plus,
  Send,
  Sliders,
  DollarSign,
  Package,
  Layers,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Edit2,
  X,
  FileCheck,
  Calendar,
  AlertOctagon,
  ArrowRight,
  HelpCircle,
} from "lucide-react";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";

interface ReorderItemProposal {
  productId: string;
  productName: string;
  sku: string;
  barcode: string;
  unit: string;
  supplierId: string | null;
  supplierName: string;
  supplierPhone: string;
  supplierEmail: string;
  supplierPaymentTermsDays: number;
  supplierMinOrderAmount: number;
  currentStock: number;
  inboundPoStock: number;
  avgDailySales: number;
  lookbackDays: number;
  leadTimeDays: number;
  safetyStockDays: number;
  leadTimeDemand: number;
  safetyStock: number;
  reorderPoint: number;
  effectiveStock: number;
  suggestedQuantity: number;
  packSize: number;
  unitCost: number;
  sellingPrice: number;
  estimatedTotal: number;
  urgency: "OUT_OF_STOCK" | "CRITICAL" | "LOW_STOCK" | "NORMAL";
  daysRemaining: number;
  maxStockLevel?: number;
}

interface SupplierCluster {
  supplierId: string | null;
  supplierName: string;
  supplierPhone: string;
  supplierEmail: string;
  paymentTermsDays: number;
  minOrderAmount: number;
  totalItemsCount: number;
  totalUnitsCount: number;
  totalEstimatedCost: number;
  isMinOrderMet: boolean;
  shortfallAmount: number;
  items: ReorderItemProposal[];
}

interface BranchOption {
  _id: string;
  name: string;
  code: string;
  isMainWarehouse?: boolean;
}

export default function AutomatedReorderPlanner({
  onViewPO,
}: {
  onViewPO?: (poId: string) => void;
}) {
  const [lookbackDays, setLookbackDays] = useState<number>(14);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("ALL");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("REORDER_ONLY");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"SUPPLIER_CLUSTERS" | "FLAT_TABLE" | "HISTORY">("SUPPLIER_CLUSTERS");

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ReorderItemProposal[]>([]);
  const [supplierClusters, setSupplierClusters] = useState<SupplierCluster[]>([]);
  const [metrics, setMetrics] = useState({
    totalProductsEvaluated: 0,
    reorderRequiredCount: 0,
    outOfStockCount: 0,
    criticalCount: 0,
    lowStockCount: 0,
    totalProcurementSpend: 0,
    activeSuppliersWithOrders: 0,
  });

  // User quantity modifications map: { [productId]: number }
  const [customQuantities, setCustomQuantities] = useState<Record<string, number>>({});
  // Selected items set for PO generation: Set of productIds
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

  // Quick edit product config modal
  const [editingProduct, setEditingProduct] = useState<ReorderItemProposal | null>(null);
  const [editForm, setEditForm] = useState({
    leadTimeDays: 3,
    safetyStockDays: 5,
    minOrderQuantity: 1,
    orderPackSize: 1,
    maxStockLevel: 0,
    lowStockThreshold: 5,
  });
  const [submittingConfig, setSubmittingConfig] = useState(false);

  // PO Generation state
  const [generatingPoSupplierId, setGeneratingPoSupplierId] = useState<string | null>(null);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [generatedPoResult, setGeneratedPoResult] = useState<any[] | null>(null);

  // Reorder history
  const [historyPlans, setHistoryPlans] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    fetchSuggestions();
  }, [lookbackDays, selectedBranchId, urgencyFilter, searchQuery]);

  useEffect(() => {
    if (viewMode === "HISTORY") {
      fetchHistory();
    }
  }, [viewMode]);

  const fetchBranches = async () => {
    try {
      const res = await fetch("/api/branches");
      const data = await res.json();
      if (data.success && Array.isArray(data.branches)) {
        setBranches(data.branches);
      }
    } catch (err) {
      console.error("Failed to load branches", err);
    }
  };

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("lookbackDays", String(lookbackDays));
      if (selectedBranchId !== "ALL") params.append("branchId", selectedBranchId);
      if (urgencyFilter !== "ALL") params.append("urgency", urgencyFilter);
      if (searchQuery.trim()) params.append("q", searchQuery.trim());

      const res = await fetch(`/api/procurement/reorder/suggestions?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setItems(data.items || []);
        setSupplierClusters(data.supplierClusters || []);
        if (data.metrics) setMetrics(data.metrics);

        // Pre-select all proposed reorder items
        const selected = new Set<string>();
        const qtyMap: Record<string, number> = {};
        (data.items || []).forEach((it: ReorderItemProposal) => {
          if (it.urgency !== "NORMAL" && it.suggestedQuantity > 0) {
            selected.add(it.productId);
            qtyMap[it.productId] = it.suggestedQuantity;
          }
        });
        setSelectedProductIds(selected);
        setCustomQuantities(qtyMap);
      }
    } catch (err) {
      console.error("Failed to load suggestions", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/procurement/reorder/plans");
      const data = await res.json();
      if (data.success) {
        setHistoryPlans(data.plans || []);
      }
    } catch (err) {
      console.error("Failed to fetch history plans", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleQuantityChange = (productId: string, val: number, packSize = 1) => {
    const rounded = Math.max(0, Math.round(val));
    setCustomQuantities((prev) => ({
      ...prev,
      [productId]: rounded,
    }));
  };

  const toggleProductSelect = (productId: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const toggleSupplierSelectAll = (cluster: SupplierCluster) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      const allClusterSelected = cluster.items.every((it) => next.has(it.productId));

      cluster.items.forEach((it) => {
        if (allClusterSelected) {
          next.delete(it.productId);
        } else {
          next.add(it.productId);
        }
      });
      return next;
    });
  };

  // Generate PO for single supplier
  const handleGenerateSingleSupplierPO = async (cluster: SupplierCluster) => {
    const clusterItems = cluster.items.filter((it) => selectedProductIds.has(it.productId));
    if (clusterItems.length === 0) {
      alert(`No items selected for ${cluster.supplierName}. Please check at least one item.`);
      return;
    }

    if (!cluster.supplierId) {
      alert("This supplier is unassigned. Please assign a supplier to these products first.");
      return;
    }

    setGeneratingPoSupplierId(cluster.supplierId);
    try {
      const supplierOrder = {
        supplierId: cluster.supplierId,
        items: clusterItems.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          sku: it.sku,
          unit: it.unit,
          quantity: customQuantities[it.productId] ?? it.suggestedQuantity,
          unitCost: it.unitCost,
          avgDailySales: it.avgDailySales,
          leadTimeDays: it.leadTimeDays,
          safetyStockDays: it.safetyStockDays,
          reorderPoint: it.reorderPoint,
          urgency: it.urgency,
        })),
        notes: `Generated via Reorder Engine (Lookback: ${lookbackDays} days)`,
      };

      const res = await fetch("/api/procurement/reorder/generate-pos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: selectedBranchId !== "ALL" ? selectedBranchId : undefined,
          supplierOrders: [supplierOrder],
          lookbackDays,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setGeneratedPoResult(data.purchaseOrders || []);
        setToastMsg({
          type: "success",
          text: `Generated PO ${data.purchaseOrders?.[0]?.poNumber} for ${cluster.supplierName}!`,
        });
        fetchSuggestions();
      } else {
        alert(data.error || "Failed to generate PO.");
      }
    } catch (err: any) {
      alert(err.message || "Failed to generate PO.");
    } finally {
      setGeneratingPoSupplierId(null);
    }
  };

  // Batch generate POs for all suppliers
  const handleBatchGenerateAllPOs = async () => {
    const ordersToSubmit = [];

    for (const cluster of supplierClusters) {
      if (!cluster.supplierId) continue;
      const validItems = cluster.items.filter((it) => selectedProductIds.has(it.productId));
      if (validItems.length > 0) {
        ordersToSubmit.push({
          supplierId: cluster.supplierId,
          items: validItems.map((it) => ({
            productId: it.productId,
            productName: it.productName,
            sku: it.sku,
            unit: it.unit,
            quantity: customQuantities[it.productId] ?? it.suggestedQuantity,
            unitCost: it.unitCost,
            avgDailySales: it.avgDailySales,
            leadTimeDays: it.leadTimeDays,
            safetyStockDays: it.safetyStockDays,
            reorderPoint: it.reorderPoint,
            urgency: it.urgency,
          })),
          notes: `Batch auto-reorder replenishment (Lookback: ${lookbackDays} days)`,
        });
      }
    }

    if (ordersToSubmit.length === 0) {
      alert("No items selected across suppliers. Please check items to order.");
      return;
    }

    if (
      !confirm(
        `Batch generate ${ordersToSubmit.length} separate Purchase Orders for selected vendors?`
      )
    ) {
      return;
    }

    setBatchGenerating(true);
    try {
      const res = await fetch("/api/procurement/reorder/generate-pos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: selectedBranchId !== "ALL" ? selectedBranchId : undefined,
          supplierOrders: ordersToSubmit,
          lookbackDays,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setGeneratedPoResult(data.purchaseOrders || []);
        setToastMsg({
          type: "success",
          text: `Successfully created ${data.purchaseOrders?.length} Purchase Orders!`,
        });
        fetchSuggestions();
      } else {
        alert(data.error || "Failed to batch generate POs.");
      }
    } catch (err: any) {
      alert(err.message || "Error generating POs.");
    } finally {
      setBatchGenerating(false);
    }
  };

  const handleOpenConfigModal = (item: ReorderItemProposal) => {
    setEditingProduct(item);
    setEditForm({
      leadTimeDays: item.leadTimeDays,
      safetyStockDays: item.safetyStockDays,
      minOrderQuantity: 1,
      orderPackSize: item.packSize,
      maxStockLevel: item.maxStockLevel || 0,
      lowStockThreshold: item.safetyStock,
    });
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setSubmittingConfig(true);
    try {
      const res = await fetch("/api/procurement/reorder/product-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: editingProduct.productId,
          ...editForm,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setToastMsg({ type: "success", text: data.message });
        setEditingProduct(null);
        fetchSuggestions();
      } else {
        alert(data.error || "Failed to save reorder configuration.");
      }
    } catch (err: any) {
      alert(err.message || "Error updating settings.");
    } finally {
      setSubmittingConfig(false);
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "OUT_OF_STOCK":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "CRITICAL":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "LOW_STOCK":
        return "bg-blue-50 text-blue-700 border-blue-200";
      default:
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
  };

  const formatUrgencyLabel = (urgency: string) => {
    switch (urgency) {
      case "OUT_OF_STOCK":
        return "Stockout (0 Stock)";
      case "CRITICAL":
        return "Critical (< Lead Time)";
      case "LOW_STOCK":
        return "Low Stock (< ROP)";
      default:
        return "Healthy Stock";
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {toastMsg && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs animate-in fade-in ${
            toastMsg.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-rose-50 border-rose-200 text-rose-900"
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{toastMsg.text}</span>
          </div>
          <button onClick={() => setToastMsg(null)} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
            <AlertOctagon className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Immediate Stockouts
            </span>
            <div className="text-xl font-black text-slate-900 font-mono mt-0.5">
              {metrics.outOfStockCount} SKUs
            </div>
            <span className="text-[10px] text-rose-600 font-bold">0 units available</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Critical Depletion
            </span>
            <div className="text-xl font-black text-slate-900 font-mono mt-0.5">
              {metrics.criticalCount} SKUs
            </div>
            <span className="text-[10px] text-amber-600 font-bold">Runs out before lead time</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Estimated Spend (LKR)
            </span>
            <div className="text-lg font-black text-slate-900 font-mono mt-0.5">
              {formatCurrency(metrics.totalProcurementSpend)}
            </div>
            <span className="text-[10px] text-slate-400">Optimal replenishment cost</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Vendors with Orders
            </span>
            <div className="text-xl font-black text-slate-900 font-mono mt-0.5">
              {metrics.activeSuppliersWithOrders} Suppliers
            </div>
            <span className="text-[10px] text-slate-400">Grouped into draft POs</span>
          </div>
        </div>
      </div>

      {/* Control Toolbar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Lookback Window Switcher */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">
            <span className="px-2 text-[10px] text-slate-400 uppercase tracking-wider">Velocity:</span>
            {[
              { days: 7, label: "7 Days (Fast)" },
              { days: 14, label: "14 Days (Balanced)" },
              { days: 30, label: "30 Days (Monthly)" },
            ].map((opt) => (
              <button
                key={opt.days}
                type="button"
                onClick={() => setLookbackDays(opt.days)}
                className={`px-2.5 py-1 rounded-lg transition ${
                  lookbackDays === opt.days
                    ? "bg-white text-blue-600 shadow-2xs font-black"
                    : "hover:text-slate-900"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Branch filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-bold">
            <Building className="w-4 h-4 text-slate-400" />
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">Entire Business (All Facilities)</option>
              {branches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          {/* Urgency filter */}
          <select
            value={urgencyFilter}
            onChange={(e) => setUrgencyFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="REORDER_ONLY">Reorder Needed ({metrics.reorderRequiredCount})</option>
            <option value="OUT_OF_STOCK">Out of Stock ({metrics.outOfStockCount})</option>
            <option value="CRITICAL">Critical Lead-Time ({metrics.criticalCount})</option>
            <option value="LOW_STOCK">Low Stock ({metrics.lowStockCount})</option>
            <option value="ALL">All Active Products ({metrics.totalProductsEvaluated})</option>
          </select>

          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search product, SKU, barcode..."
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs w-52 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* View mode toggle & Batch Actions */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
            <button
              type="button"
              onClick={() => setViewMode("SUPPLIER_CLUSTERS")}
              className={`px-3 py-1 rounded-lg transition ${
                viewMode === "SUPPLIER_CLUSTERS"
                  ? "bg-white text-blue-600 shadow-2xs font-black"
                  : "hover:text-slate-900"
              }`}
            >
              Vendor PO Clusters
            </button>
            <button
              type="button"
              onClick={() => setViewMode("FLAT_TABLE")}
              className={`px-3 py-1 rounded-lg transition ${
                viewMode === "FLAT_TABLE"
                  ? "bg-white text-blue-600 shadow-2xs font-black"
                  : "hover:text-slate-900"
              }`}
            >
              All Items Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode("HISTORY")}
              className={`px-3 py-1 rounded-lg transition ${
                viewMode === "HISTORY"
                  ? "bg-white text-blue-600 shadow-2xs font-black"
                  : "hover:text-slate-900"
              }`}
            >
              Planning Cycles
            </button>
          </div>

          {viewMode === "SUPPLIER_CLUSTERS" && supplierClusters.length > 0 && (
            <button
              type="button"
              onClick={handleBatchGenerateAllPOs}
              disabled={batchGenerating}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
            >
              {batchGenerating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating POs...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Batch Generate All POs</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          <Sparkles className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
          <span className="text-xs font-semibold">
            Analyzing transaction run-rates, safety buffers, and vendor lead times...
          </span>
        </div>
      ) : viewMode === "SUPPLIER_CLUSTERS" ? (
        /* ================= VIEW 1: SUPPLIER PO CLUSTERS ================= */
        <div className="space-y-4">
          {supplierClusters.length === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500" />
              <div className="font-bold text-slate-800 text-sm">
                All Product Inventories Are Well Stocked!
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                No products are currently below their dynamic reorder threshold based on sales velocity over the past {lookbackDays} days.
              </p>
            </div>
          ) : (
            supplierClusters.map((cluster) => {
              const clusterSelectedCount = cluster.items.filter((it) =>
                selectedProductIds.has(it.productId)
              ).length;
              const isAllClusterSelected = clusterSelectedCount === cluster.items.length;

              // Calculate dynamic total from custom quantities
              const currentTotalCost = cluster.items
                .filter((it) => selectedProductIds.has(it.productId))
                .reduce((sum, it) => {
                  const qty = customQuantities[it.productId] ?? it.suggestedQuantity;
                  return sum + qty * it.unitCost;
                }, 0);

              const currentTotalUnits = cluster.items
                .filter((it) => selectedProductIds.has(it.productId))
                .reduce((sum, it) => sum + (customQuantities[it.productId] ?? it.suggestedQuantity), 0);

              const isMinMet = cluster.minOrderAmount === 0 || currentTotalCost >= cluster.minOrderAmount;

              return (
                <div
                  key={cluster.supplierId || "unassigned"}
                  className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden"
                >
                  {/* Supplier Card Header */}
                  <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isAllClusterSelected}
                        onChange={() => toggleSupplierSelectAll(cluster)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 text-sm">
                            {cluster.supplierName}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                            {cluster.paymentTermsDays}d Payment Terms
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          {cluster.supplierPhone && <span>Phone: {cluster.supplierPhone}</span>}
                          {cluster.supplierEmail && <span>&bull; {cluster.supplierEmail}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Minimum Order Value (MOV) & Estimated Total Strip */}
                    <div className="flex items-center gap-4">
                      {cluster.minOrderAmount > 0 && (
                        <div
                          className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border flex items-center gap-1 ${
                            isMinMet
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : "bg-amber-50 text-amber-800 border-amber-200"
                          }`}
                        >
                          {isMinMet ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Vendor MOV Met (Min: {formatCurrency(cluster.minOrderAmount)})</span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                              <span>
                                Shortfall: {formatCurrency(cluster.minOrderAmount - currentTotalCost)} to meet Min ({formatCurrency(cluster.minOrderAmount)})
                              </span>
                            </>
                          )}
                        </div>
                      )}

                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">
                          PO Proposal Value
                        </span>
                        <div className="text-base font-black font-mono text-emerald-700">
                          {formatCurrency(currentTotalCost)}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {currentTotalUnits} units &bull; {clusterSelectedCount} of {cluster.items.length} items
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleGenerateSingleSupplierPO(cluster)}
                        disabled={generatingPoSupplierId === cluster.supplierId || clusterSelectedCount === 0}
                        className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 shrink-0"
                      >
                        {generatingPoSupplierId === cluster.supplierId ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Creating PO...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>Generate PO</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Items Table for this Supplier */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-white text-[10px] uppercase font-bold text-slate-500 border-b border-slate-100">
                        <tr>
                          <th className="py-2.5 px-3 w-8"></th>
                          <th className="py-2.5 px-3">Product Description</th>
                          <th className="py-2.5 px-3 text-right">Current Stock</th>
                          <th className="py-2.5 px-3 text-right">Inbound POs</th>
                          <th className="py-2.5 px-3 text-center">Daily Velocity</th>
                          <th className="py-2.5 px-3 text-center">Stock Runout</th>
                          <th className="py-2.5 px-3 text-right">Reorder Point (ROP)</th>
                          <th className="py-2.5 px-3 text-center">Suggested Qty</th>
                          <th className="py-2.5 px-3 text-right">Unit Cost</th>
                          <th className="py-2.5 px-3 text-right">Line Total</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                          <th className="py-2.5 px-3 text-right">Config</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {cluster.items.map((item) => {
                          const isChecked = selectedProductIds.has(item.productId);
                          const qty = customQuantities[item.productId] ?? item.suggestedQuantity;
                          const lineTotal = qty * item.unitCost;

                          return (
                            <tr
                              key={item.productId}
                              className={`hover:bg-slate-50/70 transition ${
                                !isChecked ? "opacity-50" : ""
                              }`}
                            >
                              <td className="py-2.5 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleProductSelect(item.productId)}
                                  className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600"
                                />
                              </td>

                              <td className="py-2.5 px-3">
                                <div className="font-bold text-slate-900">{item.productName}</div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  {item.sku && <span>SKU: {item.sku}</span>}
                                  {item.packSize > 1 && (
                                    <span className="ml-1.5 px-1 bg-slate-100 rounded text-slate-600">
                                      Pack of {item.packSize}
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                {item.currentStock} {item.unit}
                              </td>

                              <td className="py-2.5 px-3 text-right font-mono text-blue-600 font-semibold">
                                {item.inboundPoStock > 0 ? `+${item.inboundPoStock}` : "—"}
                              </td>

                              <td className="py-2.5 px-3 text-center font-mono">
                                <span className="font-bold text-slate-700">{item.avgDailySales}</span>
                                <span className="text-[10px] text-slate-400 block">units/day</span>
                              </td>

                              <td className="py-2.5 px-3 text-center">
                                {item.daysRemaining <= 3 ? (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                    {item.daysRemaining} days left
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-mono text-slate-600">
                                    {item.daysRemaining} days
                                  </span>
                                )}
                              </td>

                              <td className="py-2.5 px-3 text-right font-mono text-slate-700 font-semibold">
                                {item.reorderPoint} {item.unit}
                              </td>

                              {/* Interactive Quantity Input */}
                              <td className="py-2.5 px-3 text-center">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleQuantityChange(
                                        item.productId,
                                        Math.max(item.packSize, qty - item.packSize),
                                        item.packSize
                                      )
                                    }
                                    className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 font-bold text-xs text-slate-700 flex items-center justify-center"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min="0"
                                    step={item.packSize}
                                    value={qty}
                                    onChange={(e) =>
                                      handleQuantityChange(
                                        item.productId,
                                        Number(e.target.value),
                                        item.packSize
                                      )
                                    }
                                    className="w-16 px-1.5 py-1 text-center font-mono font-black text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleQuantityChange(
                                        item.productId,
                                        qty + item.packSize,
                                        item.packSize
                                      )
                                    }
                                    className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 font-bold text-xs text-slate-700 flex items-center justify-center"
                                  >
                                    +
                                  </button>
                                </div>
                              </td>

                              <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                                {formatCurrency(item.unitCost)}
                              </td>

                              <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                                {formatCurrency(lineTotal)}
                              </td>

                              <td className="py-2.5 px-3 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${getUrgencyBadge(
                                    item.urgency
                                  )}`}
                                >
                                  {formatUrgencyLabel(item.urgency)}
                                </span>
                              </td>

                              <td className="py-2.5 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleOpenConfigModal(item)}
                                  className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition"
                                  title="Edit Lead Time & Buffers"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : viewMode === "FLAT_TABLE" ? (
        /* ================= VIEW 2: ALL ITEMS FLAT TABLE ================= */
        <div className="overflow-hidden border border-slate-200 rounded-2xl bg-white shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-3 px-3.5">Product & SKU</th>
                <th className="py-3 px-3.5">Supplier / Vendor</th>
                <th className="py-3 px-3.5 text-right">Current Stock</th>
                <th className="py-3 px-3.5 text-right">Inbound POs</th>
                <th className="py-3 px-3.5 text-center">Daily ADS</th>
                <th className="py-3 px-3.5 text-center">Lead Time</th>
                <th className="py-3 px-3.5 text-right">Reorder Point</th>
                <th className="py-3 px-3.5 text-right">Suggested Qty</th>
                <th className="py-3 px-3.5 text-right">Line Total</th>
                <th className="py-3 px-3.5 text-center">Urgency</th>
                <th className="py-3 px-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {items.map((item) => (
                <tr key={item.productId} className="hover:bg-slate-50/70 transition">
                  <td className="py-2.5 px-3.5">
                    <div className="font-bold text-slate-900">{item.productName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {item.sku || "No SKU"} &bull; Unit: {item.unit}
                    </div>
                  </td>

                  <td className="py-2.5 px-3.5 text-slate-700">
                    <span className="font-bold block">{item.supplierName}</span>
                    <span className="text-[10px] text-slate-400">
                      {item.supplierPaymentTermsDays}d credit
                    </span>
                  </td>

                  <td className="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900">
                    {item.currentStock}
                  </td>

                  <td className="py-2.5 px-3.5 text-right font-mono text-blue-600 font-semibold">
                    {item.inboundPoStock > 0 ? `+${item.inboundPoStock}` : "—"}
                  </td>

                  <td className="py-2.5 px-3.5 text-center font-mono">
                    <span className="font-bold text-slate-800">{item.avgDailySales}</span>
                    <span className="text-[10px] text-slate-400 block">units/day</span>
                  </td>

                  <td className="py-2.5 px-3.5 text-center font-mono text-slate-600">
                    {item.leadTimeDays} days
                  </td>

                  <td className="py-2.5 px-3.5 text-right font-mono font-bold text-slate-800">
                    {item.reorderPoint}
                  </td>

                  <td className="py-2.5 px-3.5 text-right font-mono font-black text-blue-700">
                    {item.suggestedQuantity}
                  </td>

                  <td className="py-2.5 px-3.5 text-right font-mono font-bold text-emerald-700">
                    {formatCurrency(item.estimatedTotal)}
                  </td>

                  <td className="py-2.5 px-3.5 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${getUrgencyBadge(
                        item.urgency
                      )}`}
                    >
                      {formatUrgencyLabel(item.urgency)}
                    </span>
                  </td>

                  <td className="py-2.5 px-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => handleOpenConfigModal(item)}
                      className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition inline-flex items-center gap-1"
                    >
                      <Sliders className="w-3 h-3" /> Config
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* ================= VIEW 3: PLANNING HISTORY ================= */
        <div className="space-y-4">
          {loadingHistory ? (
            <div className="py-12 text-center text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1 text-blue-600" />
              <span>Loading reorder history...</span>
            </div>
          ) : historyPlans.length === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
              <FileCheck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <div className="font-bold text-slate-700 text-sm">No Reorder Cycles Recorded</div>
              <p className="text-xs text-slate-400 mt-1">
                Batch generated purchase orders will be logged here with tracking keys.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden border border-slate-200 rounded-2xl bg-white shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3.5">Plan # & Date</th>
                    <th className="py-3 px-3.5">Facility</th>
                    <th className="py-3 px-3.5 text-center">Velocity Window</th>
                    <th className="py-3 px-3.5 text-right">Items Reordered</th>
                    <th className="py-3 px-3.5 text-right">Total Plan Value</th>
                    <th className="py-3 px-3.5">Generated POs</th>
                    <th className="py-3 px-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {historyPlans.map((plan) => (
                    <tr key={plan._id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-3.5">
                        <div className="font-mono font-bold text-slate-900">{plan.planNumber}</div>
                        <div className="text-[10px] text-slate-400">
                          {formatSLDateTime(plan.createdAt)} &bull; {plan.createdBy}
                        </div>
                      </td>

                      <td className="py-3 px-3.5 font-bold text-slate-800">
                        {plan.branchName || "Main Central Warehouse"}
                      </td>

                      <td className="py-3 px-3.5 text-center font-mono">
                        {plan.lookbackDays} Days Lookback
                      </td>

                      <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-900">
                        {plan.reorderRequiredCount} SKUs
                      </td>

                      <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-700">
                        {formatCurrency(plan.estimatedTotalCost)}
                      </td>

                      <td className="py-3 px-3.5 font-mono text-[11px] text-blue-700">
                        <div className="flex flex-wrap gap-1">
                          {plan.generatedPoNumbers?.map((poNo: string) => (
                            <span
                              key={poNo}
                              className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 font-bold"
                            >
                              {poNo}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="py-3 px-3.5 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {plan.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Quick Edit Reorder Config Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Reorder Parameters</h3>
                  <p className="text-[11px] text-slate-500 truncate max-w-[260px]">
                    {editingProduct.productName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">
                    Supplier Lead Time (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={editForm.leadTimeDays}
                    onChange={(e) =>
                      setEditForm({ ...editForm, leadTimeDays: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                    required
                  />
                  <span className="text-[10px] text-slate-400">Delivery turnaround time</span>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">
                    Safety Stock Buffer (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={editForm.safetyStockDays}
                    onChange={(e) =>
                      setEditForm({ ...editForm, safetyStockDays: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                    required
                  />
                  <span className="text-[10px] text-slate-400">Buffer against spikes</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">
                    Order Pack Size (Multiples)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editForm.orderPackSize}
                    onChange={(e) =>
                      setEditForm({ ...editForm, orderPackSize: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                    required
                  />
                  <span className="text-[10px] text-slate-400">e.g. 12 or 24 per carton</span>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">
                    Max Target Ceiling (Units)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.maxStockLevel}
                    onChange={(e) =>
                      setEditForm({ ...editForm, maxStockLevel: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                  />
                  <span className="text-[10px] text-slate-400">Optional upper limit</span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingConfig}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs transition"
                >
                  {submittingConfig ? "Saving..." : "Save Configuration"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PO Generation Success Modal */}
      {generatedPoResult && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-slate-900">
              Purchase Orders Generated Successfully!
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              The following draft Purchase Orders have been registered in the procurement system:
            </p>

            <div className="my-4 divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden text-left text-xs">
              {generatedPoResult.map((po) => (
                <div key={po.poNumber} className="p-3 bg-slate-50/70 flex items-center justify-between">
                  <div>
                    <span className="font-mono font-black text-blue-700 text-sm">
                      {po.poNumber}
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      Vendor: {po.supplierName} &bull; {po.itemCount} SKUs
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-slate-900">
                      {formatCurrency(po.netTotal)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setGeneratedPoResult(null)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
