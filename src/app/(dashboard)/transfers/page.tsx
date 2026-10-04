"use client";

import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import {
  Truck,
  Building,
  Plus,
  Search,
  ArrowRight,
  Printer,
  CheckCircle2,
  Clock,
  AlertTriangle,
  X,
  Package,
  Layers,
  ChevronRight,
  RotateCcw,
  Check,
  Send,
  Boxes,
  Shield,
  Eye,
  MapPin,
  Phone,
  User,
  ClipboardList,
} from "lucide-react";
import StockTransferNoteReceipt, { StockTransferData } from "@/components/receipts/StockTransferNoteReceipt";
import WarehouseBinManager from "@/components/warehouse/WarehouseBinManager";
import PickListManager from "@/components/warehouse/PickListManager";
import { formatSLDateTime } from "@/lib/formatters";

interface Branch {
  _id: string;
  code: string;
  name: string;
  type: "WAREHOUSE" | "RETAIL_STORE" | "OUTLET";
  address?: string;
  phone?: string;
  email?: string;
  managerName?: string;
  isMainWarehouse: boolean;
  isActive: boolean;
  stockedItemsCount?: number;
  totalInventoryUnits?: number;
  activeInboundTransfers?: number;
  activeOutboundTransfers?: number;
}

interface TransferItem {
  productId: string;
  name: string;
  sku?: string;
  unit: string;
  quantitySent: number;
  quantityReceived?: number;
  unitCost?: number;
  notes?: string;
}

interface Transfer {
  _id: string;
  transferNumber: string;
  sourceBranchId: string;
  sourceBranchName: string;
  destinationBranchId: string;
  destinationBranchName: string;
  status: "DRAFT" | "IN_TRANSIT" | "COMPLETED" | "CANCELLED";
  items: TransferItem[];
  totalItemsSent: number;
  totalItemsReceived?: number;
  carrierName?: string;
  trackingReference?: string;
  dispatchedBy?: string;
  dispatchedAt?: string;
  receivedBy?: string;
  receivedAt?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  notes?: string;
  createdAt: string;
}

interface ProductOption {
  _id: string;
  name: string;
  sku?: string;
  barcode?: string;
  unit?: string;
  stockQuantity: number;
  costPrice: number;
  sellingPrice: number;
}

export default function TransfersPage() {
  const [activeTab, setActiveTab] = useState<
    "TRANSFERS" | "PICK_LISTS" | "WAREHOUSE_BINS" | "BRANCHES"
  >("TRANSFERS");

  // Data state
  const [branches, setBranches] = useState<Branch[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<any>(null);

  // Transfer Filters
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("");
  const [destinationFilter, setDestinationFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Transfer Metrics
  const [metrics, setMetrics] = useState({
    inTransitCount: 0,
    completedCount: 0,
    draftCount: 0,
    cancelledCount: 0,
    totalCount: 0,
  });

  // Notifications
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // New Transfer Modal State
  const [isNewTransferOpen, setIsNewTransferOpen] = useState(false);
  const [newTransferSource, setNewTransferSource] = useState("");
  const [newTransferDest, setNewTransferDest] = useState("");
  const [newTransferCarrier, setNewTransferCarrier] = useState("");
  const [newTransferTracking, setNewTransferTracking] = useState("");
  const [newTransferNotes, setNewTransferNotes] = useState("");
  const [transferLineItems, setTransferLineItems] = useState<
    Array<{ productId: string; name: string; sku?: string; unit: string; quantitySent: number; availableStock: number }>
  >([]);
  const [selectedProductToAdd, setSelectedProductToAdd] = useState("");
  const [addQty, setAddQty] = useState("1");
  const [submittingTransfer, setSubmittingTransfer] = useState(false);

  // Receive Transfer Modal State
  const [receivingTransfer, setReceivingTransfer] = useState<Transfer | null>(null);
  const [receivedQtyMap, setReceivedQtyMap] = useState<Record<string, number>>({});
  const [submittingReceive, setSubmittingReceive] = useState(false);

  // Add / Edit Branch Modal State
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [branchForm, setBranchForm] = useState({
    _id: "",
    name: "",
    code: "",
    type: "RETAIL_STORE" as "WAREHOUSE" | "RETAIL_STORE" | "OUTLET",
    address: "",
    phone: "",
    email: "",
    managerName: "",
    isMainWarehouse: false,
  });
  const [submittingBranch, setSubmittingBranch] = useState(false);

  // View Branch Stock Modal State
  const [viewingStockBranch, setViewingStockBranch] = useState<Branch | null>(null);
  const [branchStockItems, setBranchStockItems] = useState<any[]>([]);
  const [loadingBranchStock, setLoadingBranchStock] = useState(false);
  const [branchStockSearch, setBranchStockSearch] = useState("");

  // Printable STN Modal State
  const [activePrintTransfer, setActivePrintTransfer] = useState<Transfer | null>(null);

  // Initial Data Fetch
  const loadData = async () => {
    try {
      setLoading(true);
      const [branchRes, transferRes, prodRes, bizRes] = await Promise.all([
        fetch("/api/branches"),
        fetch(`/api/transfers?status=${statusFilter}${sourceFilter ? `&sourceBranchId=${sourceFilter}` : ""}${destinationFilter ? `&destinationBranchId=${destinationFilter}` : ""}${searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : ""}`),
        fetch("/api/products?limit=500"),
        fetch("/api/business"),
      ]);

      const [branchData, transferData, prodData, bizData] = await Promise.all([
        branchRes.json(),
        transferRes.json(),
        prodRes.json(),
        bizRes.json(),
      ]);

      if (branchData.success) {
        setBranches(branchData.branches);
        if (branchData.branches.length > 0 && !newTransferSource) {
          const main = branchData.branches.find((b: Branch) => b.isMainWarehouse) || branchData.branches[0];
          setNewTransferSource(main._id);
          const other = branchData.branches.find((b: Branch) => b._id !== main._id);
          if (other) setNewTransferDest(other._id);
        }
      }

      if (transferData.success) {
        setTransfers(transferData.transfers);
        if (transferData.metrics) setMetrics(transferData.metrics);
      }

      if (prodData.success) {
        setProducts(prodData.products || []);
      }

      if (bizData.success && bizData.business) {
        setBusiness(bizData.business);
      }
    } catch (err) {
      console.error("Error loading transfer hub data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, sourceFilter, destinationFilter, searchQuery]);

  // Load Branch Stock when viewing stock modal
  const handleOpenStockView = async (branch: Branch) => {
    setViewingStockBranch(branch);
    setLoadingBranchStock(true);
    try {
      const res = await fetch(`/api/branches/${branch._id}/stock?q=${encodeURIComponent(branchStockSearch)}`);
      const data = await res.json();
      if (data.success) {
        setBranchStockItems(data.items || []);
      }
    } catch (err) {
      console.error("Failed to load branch stock:", err);
    } finally {
      setLoadingBranchStock(false);
    }
  };

  useEffect(() => {
    if (viewingStockBranch) {
      handleOpenStockView(viewingStockBranch);
    }
  }, [branchStockSearch]);

  // Handle adding line item in new transfer modal
  const handleAddLineItem = () => {
    if (!selectedProductToAdd) return;
    const prod = products.find((p) => p._id === selectedProductToAdd);
    if (!prod) return;

    const qty = parseFloat(addQty) || 1;
    if (qty <= 0) return;

    if (transferLineItems.some((i) => i.productId === prod._id)) {
      alert("This product is already added to the transfer list. Adjust its quantity directly.");
      return;
    }

    setTransferLineItems([
      ...transferLineItems,
      {
        productId: prod._id,
        name: prod.name,
        sku: prod.sku,
        unit: prod.unit || "pcs",
        quantitySent: qty,
        availableStock: prod.stockQuantity,
      },
    ]);

    setSelectedProductToAdd("");
    setAddQty("1");
  };

  const handleRemoveLineItem = (productId: string) => {
    setTransferLineItems(transferLineItems.filter((i) => i.productId !== productId));
  };

  // Submit New Transfer Order
  const handleCreateTransfer = async (dispatchImmediately: boolean) => {
    if (!newTransferSource || !newTransferDest) {
      alert("Please select both source and destination branches.");
      return;
    }
    if (newTransferSource === newTransferDest) {
      alert("Source and destination cannot be the same branch.");
      return;
    }
    if (transferLineItems.length === 0) {
      alert("Please add at least one product to the transfer.");
      return;
    }

    setSubmittingTransfer(true);
    try {
      const res = await fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceBranchId: newTransferSource,
          destinationBranchId: newTransferDest,
          items: transferLineItems.map((i) => ({
            productId: i.productId,
            quantitySent: i.quantitySent,
          })),
          dispatchImmediately,
          carrierName: newTransferCarrier.trim() || undefined,
          trackingReference: newTransferTracking.trim() || undefined,
          notes: newTransferNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIsNewTransferOpen(false);
        setTransferLineItems([]);
        setNewTransferCarrier("");
        setNewTransferTracking("");
        setNewTransferNotes("");
        setStatusMessage({
          type: "success",
          text: data.message || "Stock Transfer Order created successfully.",
        });
        loadData();
      } else {
        alert(data.error || "Failed to create transfer.");
      }
    } catch (err: any) {
      alert(err.message || "Error submitting transfer order.");
    } finally {
      setSubmittingTransfer(false);
    }
  };

  // Dispatch Draft Transfer
  const handleDispatchDraft = async (transferId: string) => {
    if (!confirm("Are you sure you want to dispatch this transfer? Stock will be immediately deducted from the source warehouse.")) return;

    try {
      const res = await fetch(`/api/transfers/${transferId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DISPATCH" }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: "success", text: data.message || "Transfer marked as IN_TRANSIT." });
        loadData();
      } else {
        alert(data.error || "Failed to dispatch transfer.");
      }
    } catch (err: any) {
      alert(err.message || "Network error.");
    }
  };

  // Open Receive Modal
  const handleOpenReceiveModal = (transfer: Transfer) => {
    setReceivingTransfer(transfer);
    const initialMap: Record<string, number> = {};
    transfer.items.forEach((item) => {
      initialMap[item.productId] = item.quantitySent;
    });
    setReceivedQtyMap(initialMap);
  };

  // Confirm Inward Receipt
  const handleConfirmReceive = async () => {
    if (!receivingTransfer) return;

    setSubmittingReceive(true);
    try {
      const receivedItems = receivingTransfer.items.map((i) => ({
        productId: i.productId,
        quantityReceived: receivedQtyMap[i.productId] ?? i.quantitySent,
      }));

      const res = await fetch(`/api/transfers/${receivingTransfer._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RECEIVE",
          receivedItems,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setReceivingTransfer(null);
        setStatusMessage({
          type: "success",
          text: data.message || "Transfer received and destination inventory updated.",
        });
        loadData();
      } else {
        alert(data.error || "Failed to receive transfer.");
      }
    } catch (err: any) {
      alert(err.message || "Error processing receipt.");
    } finally {
      setSubmittingReceive(false);
    }
  };

  // Cancel Transfer
  const handleCancelTransfer = async (transferId: string) => {
    const reason = prompt("Enter a reason for cancelling this transfer:");
    if (!reason || !reason.trim()) return;

    try {
      const res = await fetch(`/api/transfers/${transferId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CANCEL",
          cancellationReason: reason.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: "success", text: data.message || "Transfer cancelled." });
        loadData();
      } else {
        alert(data.error || "Failed to cancel transfer.");
      }
    } catch (err: any) {
      alert(err.message || "Error cancelling transfer.");
    }
  };

  // Save Branch (Create / Edit)
  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchForm.name.trim() || !branchForm.code.trim()) {
      alert("Branch Name and Code are required.");
      return;
    }

    setSubmittingBranch(true);
    try {
      const isEdit = Boolean(branchForm._id);
      const url = isEdit ? `/api/branches/${branchForm._id}` : "/api/branches";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(branchForm),
      });

      const data = await res.json();
      if (data.success) {
        setIsBranchModalOpen(false);
        setStatusMessage({
          type: "success",
          text: data.message || `Branch "${branchForm.name}" saved successfully.`,
        });
        loadData();
      } else {
        alert(data.error || "Failed to save branch.");
      }
    } catch (err: any) {
      alert(err.message || "Error saving branch.");
    } finally {
      setSubmittingBranch(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Multi-Location & Stock Transfers (STN)
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                {branches.length} Locations
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Coordinate inter-branch inventory, issue Delivery Notes, and track in-transit stock across Sri Lanka
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setBranchForm({
                  _id: "",
                  name: "",
                  code: "",
                  type: "RETAIL_STORE",
                  address: "",
                  phone: "",
                  email: "",
                  managerName: "",
                  isMainWarehouse: false,
                });
                setIsBranchModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Building className="w-3.5 h-3.5" />
              <span>Add Branch</span>
            </button>

            <button
              type="button"
              onClick={() => setIsNewTransferOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-blue-500/20 transition"
            >
              <Plus className="w-4 h-4" />
              <span>New Transfer Order (STN)</span>
            </button>
          </div>
        </div>

        {/* Status Notification */}
        {statusMessage && (
          <div
            className={`p-3 rounded-xl border flex items-center justify-between text-xs animate-in fade-in ${
              statusMessage.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-rose-50 border-rose-200 text-rose-900"
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-slate-700 ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 4 Summary KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">In Transit</span>
              <div className="text-xl font-black text-slate-900 font-mono mt-0.5">
                {metrics.inTransitCount}
              </div>
            </div>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Completed</span>
              <div className="text-xl font-black text-slate-900 font-mono mt-0.5">
                {metrics.completedCount}
              </div>
            </div>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Active Locations</span>
              <div className="text-xl font-black text-slate-900 font-mono mt-0.5">
                {branches.filter((b) => b.isActive).length}
              </div>
            </div>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Draft Orders</span>
              <div className="text-xl font-black text-slate-900 font-mono mt-0.5">
                {metrics.draftCount}
              </div>
            </div>
          </div>
        </div>

        {/* Main Tab Controls */}
        <div className="flex border-b border-slate-200 gap-6">
          <button
            type="button"
            onClick={() => setActiveTab("TRANSFERS")}
            className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
              activeTab === "TRANSFERS"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Stock Transfer Orders (STN)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 font-mono text-slate-700">
              {metrics.totalCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("PICK_LISTS")}
            className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
              activeTab === "PICK_LISTS"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>Warehouse Pick-Lists (WMS Router)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("WAREHOUSE_BINS")}
            className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
              activeTab === "WAREHOUSE_BINS"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Bin Locations & Spatial Map</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("BRANCHES")}
            className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
              activeTab === "BRANCHES"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Building className="w-4 h-4" />
            <span>Branches & Central Warehouses</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 font-mono text-slate-700">
              {branches.length}
            </span>
          </button>
        </div>


        {/* ================= TAB 1: STOCK TRANSFERS ================= */}
        {activeTab === "TRANSFERS" && (
          <div className="space-y-4">
            {/* Filters Bar */}
            <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
              {/* Status Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
                {[
                  { id: "ALL", label: "All Transfers" },
                  { id: "IN_TRANSIT", label: "In Transit" },
                  { id: "DRAFT", label: "Draft" },
                  { id: "COMPLETED", label: "Completed" },
                  { id: "CANCELLED", label: "Cancelled" },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setStatusFilter(st.id)}
                    className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition ${
                      statusFilter === st.id
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {/* Search & Location Selectors */}
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search STN #, Vehicle..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none"
                >
                  <option value="">Origin: Any</option>
                  {branches.map((b) => (
                    <option key={b._id} value={b._id}>
                      From: {b.code}
                    </option>
                  ))}
                </select>

                <select
                  value={destinationFilter}
                  onChange={(e) => setDestinationFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none"
                >
                  <option value="">Dest: Any</option>
                  {branches.map((b) => (
                    <option key={b._id} value={b._id}>
                      To: {b.code}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Transfers Data Table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Transfer Number</th>
                      <th className="py-3 px-4">Route (Origin → Destination)</th>
                      <th className="py-3 px-4">Dispatched Items</th>
                      <th className="py-3 px-4">Carrier / Transport</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          Loading stock transfer notes...
                        </td>
                      </tr>
                    ) : transfers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center space-y-2">
                          <Truck className="w-8 h-8 text-slate-300 mx-auto" />
                          <p className="text-slate-500 font-semibold">No stock transfer orders found.</p>
                          <button
                            type="button"
                            onClick={() => setIsNewTransferOpen(true)}
                            className="px-3.5 py-1.5 bg-blue-600 text-white rounded-lg font-bold text-xs"
                          >
                            Create First Transfer
                          </button>
                        </td>
                      </tr>
                    ) : (
                      transfers.map((t) => (
                        <tr key={t._id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold text-slate-900 block">{t.transferNumber}</span>
                            <span className="text-[10px] text-slate-400">{formatSLDateTime(t.createdAt)}</span>
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-800">{t.sourceBranchName}</span>
                              <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="font-bold text-blue-700">{t.destinationBranchName}</span>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-800 block">
                              {t.totalItemsSent} Units ({t.items?.length || 0} SKUs)
                            </span>
                            {t.status === "COMPLETED" && typeof t.totalItemsReceived === "number" && (
                              <span className={`text-[10px] ${t.totalItemsReceived === t.totalItemsSent ? "text-emerald-700 font-semibold" : "text-rose-600 font-bold"}`}>
                                Received: {t.totalItemsReceived} Units
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-slate-600">
                            <span className="font-medium block">{t.carrierName || "In-house Vehicle"}</span>
                            {t.trackingReference && (
                              <span className="font-mono text-[10px] text-slate-400 block">Ref: {t.trackingReference}</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                t.status === "COMPLETED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : t.status === "IN_TRANSIT"
                                  ? "bg-blue-100 text-blue-800 animate-pulse"
                                  : t.status === "CANCELLED"
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {t.status === "IN_TRANSIT" && <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
                              {t.status.replace("_", " ")}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Print Challan */}
                              <button
                                type="button"
                                onClick={() => setActivePrintTransfer(t)}
                                title="Print Delivery Challan"
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>

                              {/* Dispatch Draft */}
                              {t.status === "DRAFT" && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setActiveTab("PICK_LISTS")}
                                    className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-bold transition flex items-center gap-1 border border-amber-200"
                                    title="Warehouse Pick List"
                                  >
                                    <ClipboardList className="w-3 h-3" /> Pick
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDispatchDraft(t._id)}
                                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
                                  >
                                    <Send className="w-3 h-3" /> Dispatch
                                  </button>
                                </>
                              )}


                              {/* Receive Inward Shipment */}
                              {t.status === "IN_TRANSIT" && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenReceiveModal(t)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs"
                                >
                                  <Check className="w-3 h-3" /> Receive
                                </button>
                              )}

                              {/* Cancel */}
                              {(t.status === "DRAFT" || t.status === "IN_TRANSIT") && (
                                <button
                                  type="button"
                                  onClick={() => handleCancelTransfer(t._id)}
                                  title="Cancel Transfer"
                                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: BRANCHES & WAREHOUSES ================= */}
        {activeTab === "BRANCHES" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {branches.map((b) => (
                <div
                  key={b._id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4 hover:border-slate-300 transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-slate-900 text-white">
                          {b.code}
                        </span>
                        {b.isMainWarehouse && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 flex items-center gap-1">
                            <Shield className="w-3 h-3" /> Main Hub
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            b.type === "WAREHOUSE"
                              ? "bg-purple-100 text-purple-800"
                              : b.type === "RETAIL_STORE"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {b.type.replace("_", " ")}
                        </span>
                      </div>
                      <h3 className="font-extrabold text-slate-900 text-base mt-1.5">{b.name}</h3>
                    </div>

                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        b.isActive ? "bg-emerald-500" : "bg-slate-300"
                      }`}
                    />
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600">
                    {b.address && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{b.address}</span>
                      </div>
                    )}
                    {b.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-mono">{b.phone}</span>
                      </div>
                    )}
                    {b.managerName && (
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Manager: {b.managerName}</span>
                      </div>
                    )}
                  </div>

                  {/* Stock & Transit Stats */}
                  <div className="p-3 bg-slate-50 rounded-xl grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">Items Stocked</span>
                      <span className="font-mono font-bold text-slate-800 text-sm">
                        {b.stockedItemsCount || 0} SKUs
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">Total Units</span>
                      <span className="font-mono font-bold text-slate-800 text-sm">
                        {b.totalInventoryUnits || 0}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => handleOpenStockView(b)}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> View Branch Stock
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setBranchForm({
                          _id: b._id,
                          name: b.name,
                          code: b.code,
                          type: b.type,
                          address: b.address || "",
                          phone: b.phone || "",
                          email: b.email || "",
                          managerName: b.managerName || "",
                          isMainWarehouse: b.isMainWarehouse,
                        });
                        setIsBranchModalOpen(true);
                      }}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= TAB 3: WAREHOUSE PICK-LISTS ================= */}
        {activeTab === "PICK_LISTS" && (
          <PickListManager />
        )}

        {/* ================= TAB 4: WAREHOUSE BINS & SPATIAL MAP ================= */}
        {activeTab === "WAREHOUSE_BINS" && (
          <WarehouseBinManager />
        )}

        {/* ================= MODAL: CREATE NEW TRANSFER ORDER ================= */}
        {isNewTransferOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[95vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Issue Stock Transfer Note (STN)</h3>
                    <p className="text-[11px] text-slate-500">Dispatch products between store locations</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewTransferOpen(false)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Source & Destination Selectors */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Origin (Source Branch) *
                  </label>
                  <select
                    value={newTransferSource}
                    onChange={(e) => setNewTransferSource(e.target.value)}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-semibold text-slate-800 focus:outline-none"
                  >
                    {branches.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.code}: {b.name} {b.isMainWarehouse ? "(Main Hub)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Destination Branch *
                  </label>
                  <select
                    value={newTransferDest}
                    onChange={(e) => setNewTransferDest(e.target.value)}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-semibold text-slate-800 focus:outline-none"
                  >
                    {branches.map((b) => (
                      <option key={b._id} value={b._id} disabled={b._id === newTransferSource}>
                        {b.code}: {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Add Product Line Section */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-800 block">Add Products to Transfer:</span>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedProductToAdd}
                    onChange={(e) => setSelectedProductToAdd(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">Search & Select a Product...</option>
                    {products.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} {p.sku ? `(${p.sku})` : ""} • Avail: {p.stockQuantity} {p.unit || "pcs"}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={addQty}
                    onChange={(e) => setAddQty(e.target.value)}
                    placeholder="Qty"
                    className="w-24 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-center focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />

                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shrink-0 transition"
                  >
                    Add Line
                  </button>
                </div>
              </div>

              {/* Added Line Items Table */}
              <div className="overflow-hidden border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase">
                    <tr>
                      <th className="py-2 px-3">Product Name</th>
                      <th className="py-2 px-3 w-28 text-center">Transfer Qty</th>
                      <th className="py-2 px-3 w-16 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-xs">
                    {transferLineItems.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-4 text-center text-slate-400 font-sans text-xs">
                          No items added yet. Select a product above.
                        </td>
                      </tr>
                    ) : (
                      transferLineItems.map((item) => (
                        <tr key={item.productId} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-sans font-semibold text-slate-800">
                            {item.name}
                            <span className="block text-[10px] text-slate-400 font-normal">
                              SKU: {item.sku || "—"} • Available in Store: {item.availableStock}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <input
                              type="number"
                              min="1"
                              value={item.quantitySent}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 1;
                                setTransferLineItems(
                                  transferLineItems.map((i) =>
                                    i.productId === item.productId ? { ...i, quantitySent: val } : i
                                  )
                                );
                              }}
                              className="w-16 px-1.5 py-1 text-center font-bold font-mono border border-slate-300 rounded text-xs"
                            />{" "}
                            <span className="text-[10px] text-slate-500 font-sans">{item.unit}</span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveLineItem(item.productId)}
                              className="text-rose-600 hover:text-rose-800 font-sans text-xs font-bold"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Logistics & Carrier Inputs */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Carrier / Vehicle / Driver
                  </label>
                  <input
                    type="text"
                    value={newTransferCarrier}
                    onChange={(e) => setNewTransferCarrier(e.target.value)}
                    placeholder="e.g. Store Van WP-CAB-1234"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Waybill / Tracking Reference
                  </label>
                  <input
                    type="text"
                    value={newTransferTracking}
                    onChange={(e) => setNewTransferTracking(e.target.value)}
                    placeholder="e.g. TRK-99882 or Driver Phone"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold text-xs mb-1">
                  Notes / Handling Instructions (Optional)
                </label>
                <input
                  type="text"
                  value={newTransferNotes}
                  onChange={(e) => setNewTransferNotes(e.target.value)}
                  placeholder="e.g. Fragile glass bottles, deliver before 3 PM"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewTransferOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submittingTransfer || transferLineItems.length === 0}
                  onClick={() => handleCreateTransfer(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition disabled:opacity-50"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  disabled={submittingTransfer || transferLineItems.length === 0}
                  onClick={() => handleCreateTransfer(true)}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/25 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Dispatch Now (In Transit)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= MODAL: RECEIVE INWARD SHIPMENT ================= */}
        {receivingTransfer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[95vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Receive Inward Stock Shipment</h3>
                    <p className="text-[11px] text-slate-500 font-mono">{receivingTransfer.transferNumber}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReceivingTransfer(null)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Origin Notice */}
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Origin Warehouse:</span>
                  <span className="font-bold text-slate-900">{receivingTransfer.sourceBranchName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Destination:</span>
                  <span className="font-bold text-blue-700">{receivingTransfer.destinationBranchName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Carrier / Vehicle:</span>
                  <span className="font-semibold">{receivingTransfer.carrierName || "In-house vehicle"}</span>
                </div>
              </div>

              {/* Verification Table */}
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-800 block">
                  Verify & Confirm Received Quantities:
                </span>
                <div className="overflow-hidden border border-slate-200 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Product Name</th>
                        <th className="py-2.5 px-3 w-20 text-center">Sent Qty</th>
                        <th className="py-2.5 px-3 w-28 text-center">Received Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-xs">
                      {receivingTransfer.items.map((it) => {
                        const recVal = receivedQtyMap[it.productId] ?? it.quantitySent;
                        const isShort = recVal < it.quantitySent;
                        const isOver = recVal > it.quantitySent;

                        return (
                          <tr key={it.productId} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-sans font-semibold text-slate-800">
                              {it.name}
                              <span className="block text-[10px] text-slate-400 font-normal">
                                SKU: {it.sku || "—"}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center text-slate-700">
                              {it.quantitySent} {it.unit}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <input
                                type="number"
                                min="0"
                                value={recVal}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setReceivedQtyMap({
                                    ...receivedQtyMap,
                                    [it.productId]: val,
                                  });
                                }}
                                className={`w-16 px-1.5 py-1 text-center font-bold font-mono border rounded text-xs ${
                                  isShort
                                    ? "border-rose-400 bg-rose-50 text-rose-800"
                                    : isOver
                                    ? "border-blue-400 bg-blue-50 text-blue-800"
                                    : "border-slate-300 text-slate-900"
                                }`}
                              />{" "}
                              <span className="text-[10px] text-slate-500 font-sans">{it.unit}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReceivingTransfer(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submittingReceive}
                  onClick={handleConfirmReceive}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/25 transition disabled:opacity-50"
                >
                  {submittingReceive ? "Receiving Goods..." : "Confirm & Update Branch Inventory"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= MODAL: ADD / EDIT BRANCH ================= */}
        {isBranchModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                    <Building className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      {branchForm._id ? "Edit Branch" : "Add Store Location / Branch"}
                    </h3>
                    <p className="text-[11px] text-slate-500">Warehouse or retail outlet profile</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsBranchModalOpen(false)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveBranch} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Branch Name *</label>
                  <input
                    type="text"
                    required
                    value={branchForm.name}
                    onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                    placeholder="e.g. Kandy City Center Outlet"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Branch Code *</label>
                    <input
                      type="text"
                      required
                      value={branchForm.code}
                      onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value.toUpperCase() })}
                      placeholder="e.g. BR-KND"
                      className="w-full px-3 py-2 font-mono font-bold uppercase border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Location Type *</label>
                    <select
                      value={branchForm.type}
                      onChange={(e) => setBranchForm({ ...branchForm, type: e.target.value as any })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none bg-white font-medium"
                    >
                      <option value="RETAIL_STORE">Retail Store</option>
                      <option value="WAREHOUSE">Warehouse</option>
                      <option value="OUTLET">Express Outlet</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Physical Address</label>
                  <input
                    type="text"
                    value={branchForm.address}
                    onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                    placeholder="e.g. Dalada Veediya, Kandy"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={branchForm.phone}
                      onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
                      placeholder="081XXXXXXX"
                      className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Branch Manager</label>
                    <input
                      type="text"
                      value={branchForm.managerName}
                      onChange={(e) => setBranchForm({ ...branchForm, managerName: e.target.value })}
                      placeholder="e.g. Nimal Perera"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={branchForm.isMainWarehouse}
                    onChange={(e) => setBranchForm({ ...branchForm, isMainWarehouse: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block text-xs">Set as Main Distribution Hub / Warehouse</span>
                    <span className="text-[10px] text-slate-500 block">
                      Primary receiving location for supplier Purchase Orders & central stock
                    </span>
                  </div>
                </label>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsBranchModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingBranch}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/25 transition disabled:opacity-50"
                  >
                    {submittingBranch ? "Saving..." : branchForm._id ? "Update Branch" : "Create Branch"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= MODAL: VIEW BRANCH STOCK ================= */}
        {viewingStockBranch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                    <Boxes className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      {viewingStockBranch.name} ({viewingStockBranch.code}) — Inventory
                    </h3>
                    <p className="text-[11px] text-slate-500">Live on-hand branch catalog</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingStockBranch(null)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={branchStockSearch}
                  onChange={(e) => setBranchStockSearch(e.target.value)}
                  placeholder="Search products in this branch..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none"
                />
              </div>

              {/* Stock Items Table */}
              <div className="overflow-hidden border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Product Name</th>
                      <th className="py-2.5 px-3 w-28">SKU / Barcode</th>
                      <th className="py-2.5 px-3 w-24 text-right">Branch Stock</th>
                      <th className="py-2.5 px-3 w-20 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-xs">
                    {loadingBranchStock ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-400 font-sans">
                          Loading branch stock...
                        </td>
                      </tr>
                    ) : branchStockItems.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-400 font-sans">
                          No items found for this branch.
                        </td>
                      </tr>
                    ) : (
                      branchStockItems.map((item) => (
                        <tr key={item.productId} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-sans font-semibold text-slate-800">
                            {item.name}
                          </td>
                          <td className="py-2 px-3 text-slate-500">
                            {item.sku || item.barcode || "—"}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900">
                            {item.quantity} {item.unit}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {item.quantity <= 0 ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                                Out of Stock
                              </span>
                            ) : item.isLowStock ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">
                                Low Stock
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                In Stock
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= MODAL: PRINTABLE STN DELIVERY CHALLAN ================= */}
        {activePrintTransfer && (
          <StockTransferNoteReceipt
            business={
              business || {
                name: "Sri Lanka POS",
                address: "Central Logistics Division",
              }
            }
            transfer={activePrintTransfer as any}
            onClose={() => setActivePrintTransfer(null)}
          />
        )}
      </div>
    </AppLayout>
  );
}
