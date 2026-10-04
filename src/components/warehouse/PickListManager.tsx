"use client";

import React, { useState, useEffect } from "react";
import {
  ClipboardList,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Truck,
  Printer,
  Barcode,
  ArrowRight,
  Package,
  Layers,
  ChevronRight,
  X,
  Play,
  Check,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Building,
  User,
  RefreshCw,
  Send,
} from "lucide-react";
import { formatSLDateTime } from "@/lib/formatters";

export interface PickListItem {
  productId: string;
  productName: string;
  sku?: string;
  barcode?: string;
  unit: string;
  quantityRequested: number;
  quantityPicked: number;
  binId: string;
  binCode: string;
  zone: string;
  aisle: string;
  rack: string;
  shelf: string;
  sequenceOrder: number;
  batchNumber?: string;
  expiryDate?: string;
  itemStatus: "PENDING" | "PICKED" | "SHORTAGE" | "SUBSTITUTED";
  pickedAt?: string;
  pickerNotes?: string;
}

export interface PickListRecord {
  _id: string;
  businessId: string;
  pickListNumber: string;
  type: "STOCK_TRANSFER" | "DELIVERY_DISPATCH" | "WHOLESALE_ORDER" | "INTERNAL_REPLENISHMENT";
  sourceBranchId: string;
  sourceBranchName: string;
  destinationBranchId?: string;
  destinationBranchName?: string;
  referenceId?: string;
  referenceNumber?: string;
  status: "DRAFT" | "PENDING" | "IN_PROGRESS" | "PICKED" | "DISPATCHED" | "CANCELLED";
  priority: "NORMAL" | "HIGH" | "URGENT";
  assignedPickerName?: string;
  totalItems: number;
  totalUnits: number;
  pickedUnits: number;
  items: PickListItem[];
  notes?: string;
  createdBy: string;
  completedAt?: string;
  createdAt: string;
}

interface StockTransferOption {
  _id: string;
  transferNumber: string;
  sourceBranchName: string;
  destinationBranchName: string;
  items: any[];
  status: string;
  pickListId?: string;
  pickListNumber?: string;
}

export default function PickListManager() {
  const [pickLists, setPickLists] = useState<PickListRecord[]>([]);
  const [counts, setCounts] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    picked: 0,
    dispatched: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Create Pick List Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [transfers, setTransfers] = useState<StockTransferOption[]>([]);
  const [selectedTransferId, setSelectedTransferId] = useState("");
  const [pickerNameInput, setPickerNameInput] = useState("");
  const [priorityInput, setPriorityInput] = useState<"NORMAL" | "HIGH" | "URGENT">("NORMAL");
  const [creatingPickList, setCreatingPickList] = useState(false);

  // Active Interactive Picking Screen (Drawer/Modal)
  const [activePickingList, setActivePickingList] = useState<PickListRecord | null>(null);
  const [scannedBarcode, setScannedBarcode] = useState("");
  const [scanMessage, setScanMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [submittingPick, setSubmittingPick] = useState(false);

  // Printable Pick Slip Modal
  const [slipToPrint, setSlipToPrint] = useState<PickListRecord | null>(null);

  // Toast
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchPickLists();
  }, [statusFilter, searchQuery]);

  const fetchPickLists = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (searchQuery.trim()) params.append("q", searchQuery.trim());

      const res = await fetch(`/api/warehouse/pick-lists?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setPickLists(data.pickLists || []);
        if (data.counts) setCounts(data.counts);
      }
    } catch (err) {
      console.error("Failed to fetch pick lists", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = async () => {
    setIsCreateModalOpen(true);
    setSelectedTransferId("");
    try {
      const res = await fetch("/api/transfers?status=DRAFT");
      const data = await res.json();
      if (data.success && Array.isArray(data.transfers)) {
        // Filter transfers that don't already have an active pick list
        setTransfers(data.transfers.filter((t: any) => !t.pickListId));
      }
    } catch (err) {
      console.error("Failed to load transfers for pick list", err);
    }
  };

  const handleCreatePickList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTransferId) {
      alert("Please select a pending stock transfer.");
      return;
    }

    setCreatingPickList(true);
    try {
      const res = await fetch("/api/warehouse/pick-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "STOCK_TRANSFER",
          transferId: selectedTransferId,
          assignedPickerName: pickerNameInput.trim() || undefined,
          priority: priorityInput,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setToastMsg({
          type: "success",
          text: `Generated Pick-List ${data.pickList.pickListNumber} with walking path sequence!`,
        });
        setIsCreateModalOpen(false);
        fetchPickLists();
      } else {
        alert(data.error || "Failed to generate pick list.");
      }
    } catch (err: any) {
      alert(err.message || "Failed to generate pick list.");
    } finally {
      setCreatingPickList(false);
    }
  };

  const handlePickItem = async (itemIndex: number, qtyToAdd = 1, barcodeScanned?: string) => {
    if (!activePickingList) return;
    setSubmittingPick(true);
    setScanMessage(null);

    try {
      const res = await fetch(`/api/warehouse/pick-lists/${activePickingList._id}/pick-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemIndex,
          quantityPicked: qtyToAdd,
          barcodeScanned: barcodeScanned || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setActivePickingList(data.pickList);
        setScannedBarcode("");
        if (data.barcodeMatched === false) {
          setScanMessage({
            type: "error",
            text: "Warning: Barcode did not match, but pick was logged.",
          });
        } else {
          setScanMessage({
            type: "success",
            text: `Verified & picked item: ${data.updatedItem?.productName}`,
          });
        }
        fetchPickLists();
      } else {
        alert(data.error || "Failed to pick item.");
      }
    } catch (err: any) {
      alert(err.message || "Error picking item.");
    } finally {
      setSubmittingPick(false);
    }
  };

  const handleBarcodeScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePickingList || !scannedBarcode.trim()) return;

    const scan = scannedBarcode.trim().toUpperCase();
    // Find first unpicked item matching barcode or binCode
    const itemIdx = activePickingList.items.findIndex(
      (it) =>
        it.quantityPicked < it.quantityRequested &&
        (it.barcode?.toUpperCase() === scan ||
          it.sku?.toUpperCase() === scan ||
          it.binCode?.toUpperCase() === scan ||
          it.binCode?.replace(/-/g, "").toUpperCase() === scan)
    );

    if (itemIdx >= 0) {
      handlePickItem(itemIdx, 1, scan);
    } else {
      setScanMessage({
        type: "error",
        text: `No pending items found matching barcode/bin "${scan}".`,
      });
    }
  };

  const handleCompletePickList = async (pickListId: string, dispatchImmediately = false) => {
    if (!confirm(dispatchImmediately ? "Complete and dispatch this transfer now?" : "Mark this pick list as fully picked?")) {
      return;
    }

    try {
      const res = await fetch(`/api/warehouse/pick-lists/${pickListId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dispatchImmediately }),
      });

      const data = await res.json();
      if (data.success) {
        setToastMsg({ type: "success", text: data.message });
        if (activePickingList?._id === pickListId) {
          setActivePickingList(null);
        }
        fetchPickLists();
      } else {
        alert(data.error || "Failed to complete pick list.");
      }
    } catch (err: any) {
      alert(err.message || "Error completing pick list.");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-amber-50 text-amber-800 border-amber-200";
      case "IN_PROGRESS":
        return "bg-blue-50 text-blue-800 border-blue-200";
      case "PICKED":
        return "bg-emerald-50 text-emerald-800 border-emerald-200";
      case "DISPATCHED":
        return "bg-purple-50 text-purple-800 border-purple-200";
      case "CANCELLED":
        return "bg-rose-50 text-rose-800 border-rose-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
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
          <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Pending Picking
            </span>
            <div className="text-xl font-black text-slate-900 font-mono mt-0.5">
              {counts.pending}
            </div>
            <span className="text-[10px] text-slate-400">Awaiting warehouse walk</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <Play className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              In Progress
            </span>
            <div className="text-xl font-black text-slate-900 font-mono mt-0.5">
              {counts.inProgress}
            </div>
            <span className="text-[10px] text-slate-400">Active picker on floor</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Picked & Staged
            </span>
            <div className="text-xl font-black text-slate-900 font-mono mt-0.5">
              {counts.picked}
            </div>
            <span className="text-[10px] text-slate-400">Ready at loading dock</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Dispatched
            </span>
            <div className="text-xl font-black text-slate-900 font-mono mt-0.5">
              {counts.dispatched}
            </div>
            <span className="text-[10px] text-slate-400">Loaded on carrier vehicle</span>
          </div>
        </div>
      </div>

      {/* Control Toolbar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Statuses ({counts.total})</option>
            <option value="PENDING">Pending ({counts.pending})</option>
            <option value="IN_PROGRESS">In Progress ({counts.inProgress})</option>
            <option value="PICKED">Picked & Ready ({counts.picked})</option>
            <option value="DISPATCHED">Dispatched ({counts.dispatched})</option>
          </select>

          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search pick-list #, STN #, picker..."
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs w-56 lg:w-64 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs shadow-blue-500/20 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Generate Pick-List from Transfer</span>
        </button>
      </div>

      {/* Pick Lists Table */}
      <div className="overflow-hidden border border-slate-200 rounded-2xl bg-white shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-600 border-b border-slate-200">
            <tr>
              <th className="py-3 px-3.5">Pick-List # & Date</th>
              <th className="py-3 px-3.5">Reference Document</th>
              <th className="py-3 px-3.5">Source &rarr; Destination</th>
              <th className="py-3 px-3.5">Assigned Picker</th>
              <th className="py-3 px-3.5">Picking Progress</th>
              <th className="py-3 px-3.5 text-center">Status</th>
              <th className="py-3 px-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                  Loading warehouse pick lists...
                </td>
              </tr>
            ) : pickLists.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  <ClipboardList className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <div className="font-bold text-slate-700">No Pick Lists Found</div>
                  <p className="text-xs text-slate-400 mt-1">
                    Generate an optimized pick-list for any approved Stock Transfer order.
                  </p>
                </td>
              </tr>
            ) : (
              pickLists.map((p) => {
                const pct = p.totalUnits > 0 ? Math.round((p.pickedUnits / p.totalUnits) * 100) : 0;
                return (
                  <tr key={p._id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3.5">
                      <div className="font-mono font-bold text-slate-900">{p.pickListNumber}</div>
                      <div className="text-[10px] text-slate-400">{formatSLDateTime(p.createdAt)}</div>
                    </td>

                    <td className="py-3 px-3.5 font-mono text-slate-700 font-semibold">
                      {p.referenceNumber || "Manual Order"}
                    </td>

                    <td className="py-3 px-3.5">
                      <div className="font-bold text-slate-800">{p.sourceBranchName}</div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1">
                        &rarr; {p.destinationBranchName || "Internal Restock"}
                      </div>
                    </td>

                    <td className="py-3 px-3.5 text-slate-700 font-medium">
                      {p.assignedPickerName ? (
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{p.assignedPickerName}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </td>

                    <td className="py-3 px-3.5">
                      <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                        <span className="font-mono text-slate-700">
                          {p.pickedUnits} / {p.totalUnits} Units
                        </span>
                        <span className="text-slate-500 font-mono text-[10px]">{pct}%</span>
                      </div>
                      <div className="w-32 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full ${
                            pct === 100 ? "bg-emerald-500" : "bg-blue-600"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-slate-400 mt-0.5 block">
                        {p.items.length} Aisle Stops (Route Optimized)
                      </span>
                    </td>

                    <td className="py-3 px-3.5 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(
                          p.status
                        )}`}
                      >
                        {p.status}
                      </span>
                    </td>

                    <td className="py-3 px-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSlipToPrint(p)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition"
                          title="Print Warehouse Pick-Slip"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>

                        {p.status !== "DISPATCHED" && p.status !== "CANCELLED" && (
                          <button
                            type="button"
                            onClick={() => {
                              setActivePickingList(p);
                              setScanMessage(null);
                            }}
                            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[11px] font-bold flex items-center gap-1 transition"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>{p.status === "PENDING" ? "Start Picking" : "Resume"}</span>
                          </button>
                        )}

                        {p.status === "PICKED" && (
                          <button
                            type="button"
                            onClick={() => handleCompletePickList(p._id, true)}
                            className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-[11px] font-bold flex items-center gap-1 transition"
                            title="Dispatch and load onto transport"
                          >
                            <Send className="w-3 h-3" />
                            <span>Dispatch</span>
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

      {/* Generate Pick List Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <ClipboardList className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Generate Warehouse Pick-List
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Auto-routes walking sequence across warehouse aisles
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePickList} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1">
                  Select Stock Transfer Order (STN)
                </label>
                {transfers.length === 0 ? (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px]">
                    No open pending Stock Transfers found. Create a new transfer in the Transfers tab first.
                  </div>
                ) : (
                  <select
                    value={selectedTransferId}
                    onChange={(e) => setSelectedTransferId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                    required
                  >
                    <option value="">Select Transfer Order...</option>
                    {transfers.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.transferNumber} — From {t.sourceBranchName} to {t.destinationBranchName} ({t.items?.length || 0} items)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">
                    Assign Warehouse Picker
                  </label>
                  <input
                    type="text"
                    value={pickerNameInput}
                    onChange={(e) => setPickerNameInput(e.target.value)}
                    placeholder="e.g. Kasun Fernando"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Priority</label>
                  <select
                    value={priorityInput}
                    onChange={(e) => setPriorityInput(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  >
                    <option value="NORMAL">Normal Priority</option>
                    <option value="HIGH">High Priority</option>
                    <option value="URGENT">Urgent Rush</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl space-y-1 text-blue-900">
                <span className="font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  WMS Single-Pass Route Optimizer
                </span>
                <p className="text-[11px] text-blue-700 leading-relaxed">
                  Items will be automatically sorted ascending by <code>sequenceOrder</code>{" "}
                  (Zone &rarr; Aisle &rarr; Rack &rarr; Shelf) to eliminate backtracking and zigzags across aisles.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingPickList || transfers.length === 0}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs transition flex items-center gap-1.5"
                >
                  {creatingPickList ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Optimizing Route...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Generate Pick-List</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Interactive Picker Screen (Tablet / Mobile friendly WMS view) */}
      {activePickingList && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xl font-black text-slate-900">
                    {activePickingList.pickListNumber}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(
                      activePickingList.status
                    )}`}
                  >
                    {activePickingList.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Walking sequence order &bull; From: {activePickingList.sourceBranchName} &bull; Ref:{" "}
                  {activePickingList.referenceNumber || "Direct"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActivePickingList(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Barcode Scanner Bar */}
            <form onSubmit={handleBarcodeScanSubmit} className="my-3 flex items-center gap-2">
              <div className="relative flex-1">
                <Barcode className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={scannedBarcode}
                  onChange={(e) => setScannedBarcode(e.target.value)}
                  placeholder="Scan Product Barcode, SKU, or Bin Code..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shrink-0"
              >
                Verify & Pick
              </button>
            </form>

            {/* Scan Message Alert */}
            {scanMessage && (
              <div
                className={`p-2.5 rounded-xl border text-xs font-semibold mb-3 flex items-center gap-2 ${
                  scanMessage.type === "success"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-rose-50 border-rose-200 text-rose-800"
                }`}
              >
                {scanMessage.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{scanMessage.text}</span>
              </div>
            )}

            {/* Overall Progress */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 mb-3 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase">
                  Picker Progress
                </span>
                <div className="font-mono text-base font-black text-slate-900">
                  {activePickingList.pickedUnits} / {activePickingList.totalUnits} Units (
                  {activePickingList.items.filter((it) => it.quantityPicked >= it.quantityRequested).length} /{" "}
                  {activePickingList.items.length} Stops)
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-blue-600">
                  {activePickingList.totalUnits > 0
                    ? Math.round(
                        (activePickingList.pickedUnits / activePickingList.totalUnits) * 100
                      )
                    : 0}
                  % Complete
                </span>
              </div>
            </div>

            {/* Pick Items List (Sorted Ascending by sequenceOrder) */}
            <div className="flex-1 overflow-y-auto space-y-2.5">
              {activePickingList.items.map((item, idx) => {
                const isComplete = item.quantityPicked >= item.quantityRequested;
                return (
                  <div
                    key={`${item.productId}-${idx}`}
                    className={`p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 ${
                      isComplete
                        ? "bg-emerald-50/70 border-emerald-200"
                        : "bg-white border-slate-200 hover:border-blue-300"
                    }`}
                  >
                    {/* Route Stop Indicator */}
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                        isComplete
                          ? "bg-emerald-200 text-emerald-800"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {idx + 1}
                    </div>

                    {/* Spatial Location & Item Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-mono text-[11px] font-black border border-blue-200">
                          {item.binCode}
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold">
                          Aisle {item.aisle} &bull; Rack {item.rack} &bull; Shelf {item.shelf}
                        </span>
                      </div>

                      <div className="font-bold text-slate-900 text-sm truncate">
                        {item.productName}
                      </div>

                      <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono mt-0.5">
                        {item.sku && <span>SKU: {item.sku}</span>}
                        {item.barcode && <span>Barcode: {item.barcode}</span>}
                        {item.batchNumber && (
                          <span className="font-bold text-slate-700">Lot: {item.batchNumber}</span>
                        )}
                      </div>
                    </div>

                    {/* Quantity Picker Actions */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="font-mono font-black text-sm text-slate-900">
                          {item.quantityPicked} / {item.quantityRequested} {item.unit}
                        </div>
                        {isComplete ? (
                          <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1 justify-end">
                            <Check className="w-3 h-3" /> Picked
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-600 font-bold">Pending</span>
                        )}
                      </div>

                      {!isComplete && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handlePickItem(idx, 1)}
                            disabled={submittingPick}
                            className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl border border-blue-200 transition"
                          >
                            +1
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handlePickItem(idx, item.quantityRequested - item.quantityPicked)
                            }
                            disabled={submittingPick}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
                          >
                            Pick All
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSlipToPrint(activePickingList)}
                className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Pick Slip</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActivePickingList(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => handleCompletePickList(activePickingList._id, false)}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Finalize Pick List</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Printable Warehouse Pick Slip Sheet Modal */}
      {slipToPrint && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-8 shadow-2xl border border-slate-200 animate-in zoom-in-95 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4 print:hidden">
              <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                Print Preview: Warehouse Pick-Slip
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Slip</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSlipToPrint(null)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Official Warehouse Slip Content */}
            <div className="flex-1 overflow-y-auto space-y-4 print:p-0">
              {/* Slip Header */}
              <div className="border-b-2 border-slate-900 pb-3 flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                    WAREHOUSE PICK-SLIP
                  </h2>
                  <div className="font-mono text-sm font-bold text-slate-700">
                    {slipToPrint.pickListNumber}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Route: Single-Pass Minimal Walking Path
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-xs font-bold text-slate-900">
                    Ref: {slipToPrint.referenceNumber || "Direct Order"}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Date: {formatSLDateTime(slipToPrint.createdAt)}
                  </div>
                  <div className="text-[11px] text-slate-600 font-semibold mt-1">
                    Picker: {slipToPrint.assignedPickerName || "Staff"}
                  </div>
                </div>
              </div>

              {/* Source & Destination */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="font-bold text-slate-500 uppercase text-[10px] block">
                    Origin Warehouse
                  </span>
                  <div className="font-bold text-slate-900">{slipToPrint.sourceBranchName}</div>
                </div>
                <div>
                  <span className="font-bold text-slate-500 uppercase text-[10px] block">
                    Destination Branch
                  </span>
                  <div className="font-bold text-slate-900">
                    {slipToPrint.destinationBranchName || "Internal Restock"}
                  </div>
                </div>
              </div>

              {/* Items Table with check boxes */}
              <div className="border border-slate-300 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 font-bold text-[10px] uppercase text-slate-700 border-b border-slate-300">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">Done</th>
                      <th className="py-2.5 px-3">Bin Location</th>
                      <th className="py-2.5 px-3">Item Description</th>
                      <th className="py-2.5 px-3">Batch / Expiry</th>
                      <th className="py-2.5 px-3 text-right">Qty Req</th>
                      <th className="py-2.5 px-3 text-right">Qty Picked</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium">
                    {slipToPrint.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={it.quantityPicked >= it.quantityRequested}
                            readOnly
                            className="rounded border-slate-300"
                          />
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-900">
                          {it.binCode}
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-bold text-slate-900">{it.productName}</div>
                          {it.sku && (
                            <span className="text-[10px] text-slate-500 font-mono">
                              SKU: {it.sku}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-[11px] font-mono text-slate-600">
                          {it.batchNumber || "—"}{" "}
                          {it.expiryDate && (
                            <span className="text-[10px] text-slate-400 block">
                              Exp: {new Date(it.expiryDate).toLocaleDateString()}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          {it.quantityRequested} {it.unit}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                          {it.quantityPicked} {it.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Sign-off box */}
              <div className="grid grid-cols-2 gap-8 pt-6 mt-6 border-t border-slate-200 text-xs">
                <div>
                  <div className="border-b border-slate-400 pb-8 text-slate-400 text-center italic">
                    Signature
                  </div>
                  <span className="block text-center text-slate-600 font-bold mt-1">
                    Warehouse Picker Sign-off
                  </span>
                </div>
                <div>
                  <div className="border-b border-slate-400 pb-8 text-slate-400 text-center italic">
                    Signature
                  </div>
                  <span className="block text-center text-slate-600 font-bold mt-1">
                    QC Dispatch Officer Sign-off
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
