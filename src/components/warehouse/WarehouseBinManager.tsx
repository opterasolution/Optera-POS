"use client";

import React, { useState, useEffect } from "react";
import {
  Boxes,
  Plus,
  Search,
  Filter,
  Layers,
  MapPin,
  Building,
  Thermometer,
  AlertTriangle,
  CheckCircle2,
  Printer,
  ArrowRightLeft,
  RefreshCw,
  Eye,
  Sliders,
  X,
  Sparkles,
  Barcode,
  Package,
  ChevronRight,
  ShieldAlert,
  Snowflake,
  Trash2,
  Edit2,
} from "lucide-react";

interface BinCapacity {
  maxUnits: number;
  maxWeightKg?: number;
}

interface BinOccupancy {
  totalUnits: number;
  utilizationPercent: number;
}

export interface WarehouseBinItem {
  _id: string;
  businessId: string;
  branchId: string;
  branchName: string;
  zone: string;
  zoneName: string;
  aisle: string;
  rack: string;
  shelf: string;
  binCode: string;
  barcode: string;
  binType: "PRIMARY_PICK" | "BULK_OVERSTOCK" | "QUARANTINE" | "COLD_STORAGE" | "STAGING";
  capacity: BinCapacity;
  currentOccupancy: BinOccupancy;
  sequenceOrder: number;
  temperatureZone: "AMBIENT" | "CHILLED" | "FROZEN" | "SECURE_CAGE";
  status: "AVAILABLE" | "NEAR_FULL" | "FULL" | "MAINTENANCE" | "INACTIVE";
  notes?: string;
  isActive: boolean;
  createdAt: string;
}

interface BinStockRecord {
  _id: string;
  binId: string;
  binCode: string;
  productId: string;
  productName: string;
  sku?: string;
  barcode?: string;
  unit: string;
  batchNumber?: string;
  expiryDate?: string;
  quantity: number;
  reservedQuantity: number;
  isPrimaryPick: boolean;
}

interface BranchOption {
  _id: string;
  name: string;
  code: string;
  type?: string;
}

export default function WarehouseBinManager() {
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("ALL");
  const [bins, setBins] = useState<WarehouseBinItem[]>([]);
  const [stats, setStats] = useState({
    totalBins: 0,
    totalCapacityUnits: 0,
    totalOccupiedUnits: 0,
    overallUtilization: 0,
    primaryPickCount: 0,
    bulkOverstockCount: 0,
    quarantineCount: 0,
    coldStorageCount: 0,
  });
  const [zonesList, setZonesList] = useState<Array<{ zone: string; zoneName: string }>>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedZone, setSelectedZone] = useState("ALL");
  const [selectedType, setSelectedType] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"GRID" | "TABLE">("GRID");

  // Selected bin detail drawer
  const [selectedBin, setSelectedBin] = useState<WarehouseBinItem | null>(null);
  const [binStockItems, setBinStockItems] = useState<BinStockRecord[]>([]);
  const [loadingBinStock, setLoadingBinStock] = useState(false);

  // Batch Generator Modal
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchForm, setBatchForm] = useState({
    branchId: "",
    zone: "ZA",
    zoneName: "Zone A - Fast Moving Groceries",
    aislePrefix: "A",
    aisleStart: 1,
    aisleEnd: 2,
    rackStart: 1,
    rackEnd: 2,
    shelfStart: 1,
    shelfEnd: 3,
    binType: "PRIMARY_PICK",
    maxUnits: 150,
    temperatureZone: "AMBIENT",
  });
  const [submittingBatch, setSubmittingBatch] = useState(false);

  // Single Bin Modal
  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
  const [singleForm, setSingleForm] = useState({
    branchId: "",
    zone: "ZA",
    zoneName: "Zone A - Ambient Storage",
    aisle: "A01",
    rack: "R01",
    shelf: "S01",
    binType: "PRIMARY_PICK",
    temperatureZone: "AMBIENT",
    maxUnits: 100,
    notes: "",
  });
  const [submittingSingle, setSubmittingSingle] = useState(false);

  // Replenish / Internal Transfer Modal
  const [isReplenishModalOpen, setIsReplenishModalOpen] = useState(false);
  const [replenishSourceBin, setReplenishSourceBin] = useState<WarehouseBinItem | null>(null);
  const [replenishTargetBinId, setReplenishTargetBinId] = useState("");
  const [replenishSelectedStock, setReplenishSelectedStock] = useState<BinStockRecord | null>(null);
  const [replenishQty, setReplenishQty] = useState("1");
  const [submittingReplenish, setSubmittingReplenish] = useState(false);

  // Printable Shelf Barcodes Modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Notification feedback
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    fetchBins();
  }, [selectedBranchId, selectedZone, selectedType, selectedStatus, searchQuery]);

  const fetchBranches = async () => {
    try {
      const res = await fetch("/api/branches");
      const data = await res.json();
      if (data.success && Array.isArray(data.branches)) {
        setBranches(data.branches);
        if (data.branches.length > 0 && selectedBranchId === "ALL") {
          // Select main warehouse if available
          const main = data.branches.find((b: any) => b.isMainWarehouse);
          if (main) {
            setSelectedBranchId(main._id);
            setBatchForm((prev) => ({ ...prev, branchId: main._id }));
            setSingleForm((prev) => ({ ...prev, branchId: main._id }));
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch branches", err);
    }
  };

  const fetchBins = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedBranchId && selectedBranchId !== "ALL") params.append("branchId", selectedBranchId);
      if (selectedZone && selectedZone !== "ALL") params.append("zone", selectedZone);
      if (selectedType && selectedType !== "ALL") params.append("binType", selectedType);
      if (selectedStatus && selectedStatus !== "ALL") params.append("status", selectedStatus);
      if (searchQuery.trim()) params.append("q", searchQuery.trim());

      const res = await fetch(`/api/warehouse/bins?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setBins(data.bins || []);
        if (data.stats) setStats(data.stats);
        if (data.zones) setZonesList(data.zones);
      }
    } catch (err) {
      console.error("Failed to fetch warehouse bins", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenBinDetail = async (bin: WarehouseBinItem) => {
    setSelectedBin(bin);
    setLoadingBinStock(true);
    try {
      const res = await fetch(`/api/warehouse/bins/${bin._id}`);
      const data = await res.json();
      if (data.success) {
        setBinStockItems(data.stockItems || []);
      }
    } catch (err) {
      console.error("Failed to fetch bin stock", err);
    } finally {
      setLoadingBinStock(false);
    }
  };

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchForm.branchId) {
      alert("Please select a branch.");
      return;
    }
    setSubmittingBatch(true);
    try {
      const res = await fetch("/api/warehouse/bins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: batchForm.branchId,
          batchMode: true,
          batchConfig: batchForm,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setToastMsg({ type: "success", text: data.message || `Created ${data.count} bins!` });
        setIsBatchModalOpen(false);
        fetchBins();
      } else {
        alert(data.error || "Batch generation failed.");
      }
    } catch (err: any) {
      alert(err.message || "Failed to generate bins.");
    } finally {
      setSubmittingBatch(false);
    }
  };

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingSingle(true);
    try {
      const res = await fetch("/api/warehouse/bins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(singleForm),
      });
      const data = await res.json();
      if (data.success) {
        setToastMsg({ type: "success", text: `Bin ${data.bin.binCode} created!` });
        setIsSingleModalOpen(false);
        fetchBins();
      } else {
        alert(data.error || "Failed to create bin.");
      }
    } catch (err: any) {
      alert(err.message || "Failed to create bin.");
    } finally {
      setSubmittingSingle(false);
    }
  };

  const handleReplenishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replenishSourceBin || !replenishSelectedStock || !replenishTargetBinId) {
      alert("Please select source stock and target bin.");
      return;
    }
    const qty = Number(replenishQty);
    if (!qty || qty <= 0 || qty > replenishSelectedStock.quantity) {
      alert(`Invalid transfer quantity. Available: ${replenishSelectedStock.quantity}`);
      return;
    }

    setSubmittingReplenish(true);
    try {
      const res = await fetch("/api/warehouse/replenish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: replenishSourceBin.branchId,
          productId: replenishSelectedStock.productId,
          sourceBinId: replenishSourceBin._id,
          targetBinId: replenishTargetBinId,
          quantity: qty,
          batchNumber: replenishSelectedStock.batchNumber,
          notes: "Manual replenishment transfer",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setToastMsg({ type: "success", text: data.message });
        setIsReplenishModalOpen(false);
        if (selectedBin) handleOpenBinDetail(selectedBin);
        fetchBins();
      } else {
        alert(data.error || "Replenishment failed.");
      }
    } catch (err: any) {
      alert(err.message || "Error processing replenishment.");
    } finally {
      setSubmittingReplenish(false);
    }
  };

  const getUtilizationBadge = (pct: number) => {
    if (pct >= 85) return "bg-rose-50 text-rose-700 border-rose-200";
    if (pct >= 60) return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  };

  const getBinTypeBadge = (type: string) => {
    switch (type) {
      case "PRIMARY_PICK":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "BULK_OVERSTOCK":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "QUARANTINE":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "COLD_STORAGE":
        return "bg-cyan-50 text-cyan-700 border-cyan-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const formatBinTypeLabel = (type: string) => {
    switch (type) {
      case "PRIMARY_PICK":
        return "Pick Face (Ground)";
      case "BULK_OVERSTOCK":
        return "Pallet Overstock";
      case "QUARANTINE":
        return "Quarantine Dock";
      case "COLD_STORAGE":
        return "Cold Chain";
      default:
        return type;
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Total Storage Bins
            </span>
            <div className="text-xl font-black text-slate-900 font-mono mt-0.5">
              {stats.totalBins}
            </div>
            <span className="text-[10px] text-slate-400">
              {stats.primaryPickCount} Pick Faces &bull; {stats.bulkOverstockCount} Bulk
            </span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Live Bin Stock Units
            </span>
            <div className="text-xl font-black text-slate-900 font-mono mt-0.5">
              {stats.totalOccupiedUnits.toLocaleString()}
            </div>
            <span className="text-[10px] text-slate-400">
              of {stats.totalCapacityUnits.toLocaleString()} capacity
            </span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Spatial Utilization
            </span>
            <div className="text-xl font-black text-slate-900 font-mono mt-0.5">
              {stats.overallUtilization}%
            </div>
            <div className="w-24 bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
              <div
                className={`h-full ${
                  stats.overallUtilization >= 85
                    ? "bg-rose-500"
                    : stats.overallUtilization >= 60
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(100, stats.overallUtilization)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Specialized Zones
            </span>
            <div className="text-xl font-black text-slate-900 font-mono mt-0.5">
              {stats.quarantineCount + stats.coldStorageCount} Bins
            </div>
            <span className="text-[10px] text-slate-400">
              {stats.quarantineCount} Quarantine &bull; {stats.coldStorageCount} Cold Chain
            </span>
          </div>
        </div>
      </div>

      {/* Control Toolbar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Branch filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-bold">
            <Building className="w-4 h-4 text-slate-400" />
            <select
              value={selectedBranchId}
              onChange={(e) => {
                setSelectedBranchId(e.target.value);
                setBatchForm((p) => ({ ...p, branchId: e.target.value }));
                setSingleForm((p) => ({ ...p, branchId: e.target.value }));
              }}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Branches & Facilities</option>
              {branches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          {/* Zone filter */}
          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Warehouse Zones</option>
            {zonesList.map((z) => (
              <option key={z.zone} value={z.zone}>
                {z.zoneName} ({z.zone})
              </option>
            ))}
          </select>

          {/* Type filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Bin Types</option>
            <option value="PRIMARY_PICK">Primary Pick Face</option>
            <option value="BULK_OVERSTOCK">Bulk Overstock Pallets</option>
            <option value="COLD_STORAGE">Cold Chain Storage</option>
            <option value="QUARANTINE">Quarantine Defect Dock</option>
          </select>

          {/* Status filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Occupancy Statuses</option>
            <option value="AVAILABLE">Available Space</option>
            <option value="NEAR_FULL">Near Full (&gt;85%)</option>
            <option value="FULL">100% Full</option>
          </select>

          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search bin code, barcode, aisle..."
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs w-48 lg:w-56 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPrintModalOpen(true)}
            className="px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Shelf Labels</span>
          </button>

          <button
            type="button"
            onClick={() => setIsBatchModalOpen(true)}
            className="px-3 py-1.5 rounded-xl border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Batch Bin Generator</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSingleModalOpen(true)}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs shadow-blue-500/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Single Bin</span>
          </button>
        </div>
      </div>

      {/* Warehouse Spatial Grid View */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
          <span className="text-xs font-semibold">Loading warehouse spatial map & bin inventory...</span>
        </div>
      ) : bins.length === 0 ? (
        <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          <Boxes className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <div className="font-bold text-slate-700 text-sm">No Warehouse Bins Found</div>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Generate your first warehouse aisle layout using the Batch Bin Generator to map zones, aisles, racks, and shelf pick-faces.
          </p>
          <button
            type="button"
            onClick={() => setIsBatchModalOpen(true)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Launch Batch Bin Generator
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
          {bins.map((bin) => {
            const occupancy = bin.currentOccupancy?.totalUnits || 0;
            const maxUnits = bin.capacity?.maxUnits || 1;
            const pct = bin.currentOccupancy?.utilizationPercent || 0;

            return (
              <div
                key={bin._id}
                onClick={() => handleOpenBinDetail(bin)}
                className="group p-4 bg-white hover:bg-slate-50/80 rounded-2xl border border-slate-200 hover:border-blue-400 shadow-2xs hover:shadow-md transition cursor-pointer flex flex-col justify-between"
              >
                <div>
                  {/* Header: Bin Code & Type */}
                  <div className="flex items-start justify-between gap-1.5 mb-2">
                    <div>
                      <div className="font-mono text-sm font-black text-slate-900 group-hover:text-blue-600 transition tracking-tight">
                        {bin.binCode}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        Aisle {bin.aisle} &bull; Rack {bin.rack} &bull; Shelf {bin.shelf}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[9px] font-bold border ${getBinTypeBadge(
                        bin.binType
                      )}`}
                    >
                      {formatBinTypeLabel(bin.binType)}
                    </span>
                  </div>

                  {/* Zone & Temperature */}
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-3">
                    <span className="font-bold text-slate-700">{bin.zone}</span>
                    <span>&bull;</span>
                    <span className="truncate max-w-[130px]">{bin.zoneName}</span>
                    {bin.temperatureZone === "CHILLED" && (
                      <span className="ml-auto inline-flex items-center gap-0.5 text-cyan-700 font-bold">
                        <Snowflake className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>

                {/* Utilization Progress Bar */}
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                    <span className="text-slate-500">
                      Occupancy:{" "}
                      <span className="font-mono text-slate-900">
                        {occupancy} / {maxUnits}
                      </span>
                    </span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-mono border ${getUtilizationBadge(
                        pct
                      )}`}
                    >
                      {pct}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        pct >= 85
                          ? "bg-rose-500"
                          : pct >= 60
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>

                  {/* Sequence Order */}
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2">
                    <span className="font-mono">Route Seq #{bin.sequenceOrder}</span>
                    <span className="group-hover:translate-x-0.5 text-blue-600 font-semibold inline-flex items-center gap-0.5 transition">
                      Stock Details <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Bin Stock Inventory Drawer Modal */}
      {selectedBin && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xl font-black text-slate-900">
                    {selectedBin.binCode}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getBinTypeBadge(
                      selectedBin.binType
                    )}`}
                  >
                    {formatBinTypeLabel(selectedBin.binType)}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {selectedBin.zoneName} &bull; Aisle {selectedBin.aisle}, Rack {selectedBin.rack}, Shelf{" "}
                  {selectedBin.shelf} &bull; Facility: {selectedBin.branchName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBin(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Bin Metrics Strip */}
            <div className="grid grid-cols-3 gap-3 my-4">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Current Occupancy
                </span>
                <div className="text-lg font-black text-slate-900 font-mono mt-0.5">
                  {selectedBin.currentOccupancy.totalUnits} / {selectedBin.capacity.maxUnits} units
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Capacity Utilization
                </span>
                <div className="text-lg font-black font-mono mt-0.5 text-slate-900">
                  {selectedBin.currentOccupancy.utilizationPercent}%
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Barcode Identifier
                </span>
                <div className="text-sm font-black font-mono mt-1 text-slate-700">
                  {selectedBin.barcode}
                </div>
              </div>
            </div>

            {/* Inventory in Bin */}
            <div className="flex-1 overflow-y-auto space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Physical Inventory inside this Bin ({binStockItems.length} SKUs)
                </h4>
              </div>

              {loadingBinStock ? (
                <div className="py-8 text-center text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1 text-blue-600" />
                  <span className="text-xs">Loading items...</span>
                </div>
              ) : binStockItems.length === 0 ? (
                <div className="py-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Package className="w-8 h-8 mx-auto mb-1 text-slate-300" />
                  <div className="text-xs font-bold text-slate-600">Bin is Currently Empty</div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    No active stock records mapped to this location. Use Putaway receiving or internal replenishment.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                  {binStockItems.map((stock) => (
                    <div
                      key={stock._id}
                      className="p-3 hover:bg-slate-50/70 transition flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex-1">
                        <div className="font-bold text-slate-900">{stock.productName}</div>
                        <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                          {stock.sku && <span>SKU: {stock.sku}</span>}
                          {stock.batchNumber && (
                            <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-semibold">
                              Batch: {stock.batchNumber}
                            </span>
                          )}
                          {stock.expiryDate && (
                            <span className="text-amber-700">
                              Exp: {new Date(stock.expiryDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-mono font-black text-slate-900 text-sm">
                          {stock.quantity} {stock.unit}
                        </div>
                        {stock.reservedQuantity > 0 && (
                          <div className="text-[10px] text-amber-600 font-semibold">
                            ({stock.reservedQuantity} reserved for pick-lists)
                          </div>
                        )}
                      </div>

                      {/* Replenish Transfer Action */}
                      <button
                        type="button"
                        onClick={() => {
                          setReplenishSourceBin(selectedBin);
                          setReplenishSelectedStock(stock);
                          setReplenishQty(String(stock.quantity));
                          setIsReplenishModalOpen(true);
                        }}
                        className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-[11px] flex items-center gap-1 transition shrink-0"
                        title="Transfer / Replenish to another bin"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span>Move</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-mono">
                Sequence Order: {selectedBin.sequenceOrder}
              </span>
              <button
                type="button"
                onClick={() => setSelectedBin(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Bin Generator Modal */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Batch Warehouse Bin Generator</h3>
                  <p className="text-[11px] text-slate-500">Auto-create multi-aisle spatial bins & racks</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBatchSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1">Target Facility / Warehouse</label>
                <select
                  value={batchForm.branchId}
                  onChange={(e) => setBatchForm({ ...batchForm, branchId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  required
                >
                  <option value="">Select Branch / Facility...</option>
                  {branches.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Zone Code (e.g. ZA)</label>
                  <input
                    type="text"
                    value={batchForm.zone}
                    onChange={(e) => setBatchForm({ ...batchForm, zone: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Zone Description</label>
                  <input
                    type="text"
                    value={batchForm.zoneName}
                    onChange={(e) => setBatchForm({ ...batchForm, zoneName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                <span className="font-bold text-slate-700 block">Spatial Layout Bounds</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Aisles (Start - End)</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="1"
                        value={batchForm.aisleStart}
                        onChange={(e) => setBatchForm({ ...batchForm, aisleStart: Number(e.target.value) })}
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-center font-mono font-bold"
                      />
                      <span>-</span>
                      <input
                        type="number"
                        min="1"
                        value={batchForm.aisleEnd}
                        onChange={(e) => setBatchForm({ ...batchForm, aisleEnd: Number(e.target.value) })}
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-center font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Racks (Start - End)</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="1"
                        value={batchForm.rackStart}
                        onChange={(e) => setBatchForm({ ...batchForm, rackStart: Number(e.target.value) })}
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-center font-mono font-bold"
                      />
                      <span>-</span>
                      <input
                        type="number"
                        min="1"
                        value={batchForm.rackEnd}
                        onChange={(e) => setBatchForm({ ...batchForm, rackEnd: Number(e.target.value) })}
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-center font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Shelves (Start - End)</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="1"
                        value={batchForm.shelfStart}
                        onChange={(e) => setBatchForm({ ...batchForm, shelfStart: Number(e.target.value) })}
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-center font-mono font-bold"
                      />
                      <span>-</span>
                      <input
                        type="number"
                        min="1"
                        value={batchForm.shelfEnd}
                        onChange={(e) => setBatchForm({ ...batchForm, shelfEnd: Number(e.target.value) })}
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-center font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Default Bin Type</label>
                  <select
                    value={batchForm.binType}
                    onChange={(e) => setBatchForm({ ...batchForm, binType: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  >
                    <option value="PRIMARY_PICK">Primary Pick Face (Shelf 1) / Overstock</option>
                    <option value="BULK_OVERSTOCK">Bulk Overstock Pallets</option>
                    <option value="COLD_STORAGE">Cold Storage</option>
                    <option value="QUARANTINE">Quarantine Zone</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Max Units Capacity per Bin</label>
                  <input
                    type="number"
                    min="10"
                    value={batchForm.maxUnits}
                    onChange={(e) => setBatchForm({ ...batchForm, maxUnits: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                    required
                  />
                </div>
              </div>

              {/* Calculated Count Banner */}
              {(() => {
                const totalBinsToMake =
                  Math.max(1, batchForm.aisleEnd - batchForm.aisleStart + 1) *
                  Math.max(1, batchForm.rackEnd - batchForm.rackStart + 1) *
                  Math.max(1, batchForm.shelfEnd - batchForm.shelfStart + 1);

                return (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-between text-blue-900">
                    <div>
                      <span className="font-bold block">Grid Calculation:</span>
                      <span className="text-[11px] text-blue-700">
                        Will generate {totalBinsToMake} unique warehouse bins with sequence keys.
                      </span>
                    </div>
                    <span className="text-base font-black font-mono">{totalBinsToMake} Bins</span>
                  </div>
                );
              })()}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBatch}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs transition flex items-center gap-1.5"
                >
                  {submittingBatch ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating Bins...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Generate Bins</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Single Bin Modal */}
      {isSingleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-black text-slate-900">Add Single Warehouse Bin</h3>
              <button
                type="button"
                onClick={() => setIsSingleModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSingleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1">Target Facility / Warehouse</label>
                <select
                  value={singleForm.branchId}
                  onChange={(e) => setSingleForm({ ...singleForm, branchId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  required
                >
                  <option value="">Select Branch...</option>
                  {branches.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 font-bold mb-0.5">Zone</label>
                  <input
                    type="text"
                    value={singleForm.zone}
                    onChange={(e) => setSingleForm({ ...singleForm, zone: e.target.value.toUpperCase() })}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase text-center font-bold"
                    placeholder="ZA"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 font-bold mb-0.5">Aisle</label>
                  <input
                    type="text"
                    value={singleForm.aisle}
                    onChange={(e) => setSingleForm({ ...singleForm, aisle: e.target.value.toUpperCase() })}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase text-center font-bold"
                    placeholder="A01"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 font-bold mb-0.5">Rack</label>
                  <input
                    type="text"
                    value={singleForm.rack}
                    onChange={(e) => setSingleForm({ ...singleForm, rack: e.target.value.toUpperCase() })}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase text-center font-bold"
                    placeholder="R01"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 font-bold mb-0.5">Shelf</label>
                  <input
                    type="text"
                    value={singleForm.shelf}
                    onChange={(e) => setSingleForm({ ...singleForm, shelf: e.target.value.toUpperCase() })}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase text-center font-bold"
                    placeholder="S01"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Zone Name / Description</label>
                <input
                  type="text"
                  value={singleForm.zoneName}
                  onChange={(e) => setSingleForm({ ...singleForm, zoneName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Bin Type</label>
                  <select
                    value={singleForm.binType}
                    onChange={(e) => setSingleForm({ ...singleForm, binType: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  >
                    <option value="PRIMARY_PICK">Primary Pick Face</option>
                    <option value="BULK_OVERSTOCK">Bulk Overstock Pallet</option>
                    <option value="QUARANTINE">Quarantine Zone</option>
                    <option value="COLD_STORAGE">Cold Storage</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Max Units Capacity</label>
                  <input
                    type="number"
                    min="1"
                    value={singleForm.maxUnits}
                    onChange={(e) => setSingleForm({ ...singleForm, maxUnits: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSingleModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSingle}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs transition"
                >
                  {submittingSingle ? "Saving..." : "Create Bin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Replenishment Transfer Modal */}
      {isReplenishModalOpen && replenishSourceBin && replenishSelectedStock && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Internal Bin Replenishment</h3>
                  <p className="text-[11px] text-slate-500">Move stock from overstock to pick face</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReplenishModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReplenishSubmit} className="space-y-3.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Source Bin & Product
                </span>
                <div className="font-bold text-slate-900">{replenishSelectedStock.productName}</div>
                <div className="flex items-center justify-between text-[11px] text-slate-600 font-mono">
                  <span>From: {replenishSourceBin.binCode}</span>
                  <span>Available: {replenishSelectedStock.quantity} {replenishSelectedStock.unit}</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Target Destination Bin</label>
                <select
                  value={replenishTargetBinId}
                  onChange={(e) => setReplenishTargetBinId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  required
                >
                  <option value="">Select target bin in same facility...</option>
                  {bins
                    .filter((b) => b._id !== replenishSourceBin._id)
                    .map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.binCode} ({formatBinTypeLabel(b.binType)}) — Occ: {b.currentOccupancy.totalUnits}/{b.capacity.maxUnits}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Transfer Units</label>
                <input
                  type="number"
                  min="1"
                  max={replenishSelectedStock.quantity}
                  value={replenishQty}
                  onChange={(e) => setReplenishQty(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsReplenishModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReplenish}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs transition flex items-center gap-1.5"
                >
                  {submittingReplenish ? "Transferring..." : "Confirm Replenishment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Shelf Barcode Labels Modal */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4 print:hidden">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Printer className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Shelf Barcode Labels Sheet</h3>
                  <p className="text-[11px] text-slate-500">
                    Print adhesive rack stickers for warehouse picking and putaway
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Sheet</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Label Grid */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 rounded-2xl border border-slate-200 print:bg-white print:border-none print:p-0">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {bins.slice(0, 24).map((bin) => (
                  <div
                    key={bin._id}
                    className="p-3 bg-white rounded-xl border border-slate-300 flex flex-col items-center justify-center text-center shadow-2xs"
                  >
                    <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">
                      {bin.branchName}
                    </span>
                    <div className="font-mono text-base font-black text-slate-900 mt-0.5">
                      {bin.binCode}
                    </div>
                    {/* Barcode representation */}
                    <div className="my-1.5 p-1 bg-slate-100 rounded flex flex-col items-center">
                      <Barcode className="w-24 h-7 text-slate-800" />
                      <span className="font-mono text-[9px] font-bold text-slate-600 tracking-widest">
                        {bin.barcode}
                      </span>
                    </div>
                    <span className="text-[9px] text-slate-500">
                      Zone {bin.zone} &bull; {formatBinTypeLabel(bin.binType)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
