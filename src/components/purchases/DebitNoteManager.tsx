"use client";

import React, { useState, useEffect } from "react";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";
import {
  RotateCcw,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  X,
  Printer,
  Eye,
  Truck,
  Building2,
  Calendar,
  Check,
  Package,
  Layers,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  FileText,
  DollarSign,
  Undo2,
} from "lucide-react";
import SupplierDebitNoteReceipt, {
  SupplierDebitNoteData,
} from "@/components/receipts/SupplierDebitNoteReceipt";

interface Supplier {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  currentBalance: number;
}

interface Branch {
  _id: string;
  name: string;
}

interface ProductOption {
  _id: string;
  name: string;
  sku?: string;
  unit?: string;
  costPrice: number;
  stockQuantity: number;
}

interface DebitNoteItemInput {
  productId: string;
  name: string;
  sku?: string;
  unit: string;
  quantity: number | string;
  unitCost: number | string;
  reason: string;
  batchNumber?: string;
  expiryDate?: string;
  deductInventory: boolean;
  notes?: string;
}

interface DebitNoteManagerProps {
  suppliers: Supplier[];
  branches: Branch[];
  products: ProductOption[];
  business: any;
  preselectedGrnId?: string | null;
  onClearPreselectedGrn?: () => void;
  onRefreshData?: () => void;
  setStatusMessage: (msg: { type: "success" | "error"; text: string } | null) => void;
}

export default function DebitNoteManager({
  suppliers,
  branches,
  products,
  business,
  preselectedGrnId,
  onClearPreselectedGrn,
  onRefreshData,
  setStatusMessage,
}: DebitNoteManagerProps) {
  // Ledger state
  const [debitNotes, setDebitNotes] = useState<SupplierDebitNoteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [metrics, setMetrics] = useState({
    totalDebitNotesCount: 0,
    pendingClaimsCount: 0,
    pendingClaimsTotal: 0,
    appliedCreditsTotal: 0,
    replacementsPendingCount: 0,
  });

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [viewingDebitNote, setViewingDebitNote] = useState<SupplierDebitNoteData | null>(null);
  const [activePrintDebitNote, setActivePrintDebitNote] = useState<SupplierDebitNoteData | null>(null);

  // Action Modals
  const [issuingDebitNote, setIssuingDebitNote] = useState<SupplierDebitNoteData | null>(null);
  const [issueVanNumber, setIssueVanNumber] = useState("");
  const [issueRepName, setIssueRepName] = useState("");
  const [submittingIssue, setSubmittingIssue] = useState(false);

  const [applyingCreditDebitNote, setApplyingCreditDebitNote] = useState<SupplierDebitNoteData | null>(null);
  const [vendorCreditNoteRef, setVendorCreditNoteRef] = useState("");
  const [submittingCredit, setSubmittingCredit] = useState(false);

  const [replacingDebitNote, setReplacingDebitNote] = useState<SupplierDebitNoteData | null>(null);
  const [restockReplacementStock, setRestockReplacementStock] = useState(true);
  const [submittingReplacement, setSubmittingReplacement] = useState(false);

  // Form State for New Debit Note
  const [formSupplierId, setFormSupplierId] = useState("");
  const [formBranchId, setFormBranchId] = useState("");
  const [formSettlementType, setFormSettlementType] = useState<"AP_CREDIT_OFFSET" | "REPLACEMENT" | "REFUND">("AP_CREDIT_OFFSET");
  const [formRepName, setFormRepName] = useState("");
  const [formVanNumber, setFormVanNumber] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formTaxRate, setFormTaxRate] = useState("0");
  const [formItems, setFormItems] = useState<DebitNoteItemInput[]>([]);

  // Item Add State
  const [selectedProductId, setSelectedProductId] = useState("");
  const [addItemQty, setAddItemQty] = useState("1");
  const [addItemCost, setAddItemCost] = useState("");
  const [addItemReason, setAddItemReason] = useState("DAMAGED_IN_TRANSIT");
  const [addItemBatch, setAddItemBatch] = useState("");
  const [addItemExpiry, setAddItemExpiry] = useState("");
  const [addItemDeductStock, setAddItemDeductStock] = useState(true);

  // Fetch Debit Notes
  const loadDebitNotes = async () => {
    try {
      setLoading(true);
      const url = `/api/purchases/debit-notes?status=${statusFilter}${
        supplierFilter ? `&supplierId=${supplierFilter}` : ""
      }${searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setDebitNotes(data.debitNotes || []);
        if (data.metrics) setMetrics(data.metrics);
      }
    } catch (err) {
      console.error("Error loading debit notes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDebitNotes();
  }, [statusFilter, supplierFilter, searchQuery]);

  // Handle preselected GRN from dock inspection
  useEffect(() => {
    if (preselectedGrnId) {
      handleCreateFromGrn(preselectedGrnId);
      if (onClearPreselectedGrn) onClearPreselectedGrn();
    }
  }, [preselectedGrnId]);

  const handleCreateFromGrn = async (grnId: string) => {
    try {
      setLoading(true);
      const res = await fetch("/api/purchases/debit-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromGrnId: grnId, status: "DRAFT" }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: "success",
          text: `Debit Note ${data.debitNote.debitNoteNumber} generated from dock rejections!`,
        });
        loadDebitNotes();
        setViewingDebitNote(data.debitNote);
      } else {
        setStatusMessage({ type: "error", text: data.error || "Failed to create debit note from GRN" });
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Network error" });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormSupplierId(suppliers[0]?._id || "");
    setFormBranchId(branches[0]?._id || "");
    setFormSettlementType("AP_CREDIT_OFFSET");
    setFormRepName("");
    setFormVanNumber("");
    setFormNotes("");
    setFormTaxRate("0");
    setFormItems([]);
    setSelectedProductId("");
    setAddItemQty("1");
    setAddItemCost("");
    setAddItemReason("DAMAGED_IN_TRANSIT");
    setAddItemBatch("");
    setAddItemExpiry("");
    setAddItemDeductStock(true);
  };

  const handleOpenCreateModal = () => {
    resetForm();
    setIsCreateModalOpen(true);
  };

  const handleAddItemToForm = () => {
    if (!selectedProductId) return;
    const prod = products.find((p) => p._id === selectedProductId);
    if (!prod) return;

    const qty = Math.max(0.001, parseFloat(addItemQty) || 1);
    const cost = Math.max(0, parseFloat(addItemCost) || prod.costPrice || 0);

    setFormItems([
      ...formItems,
      {
        productId: prod._id,
        name: prod.name,
        sku: prod.sku,
        unit: prod.unit || "pcs",
        quantity: qty,
        unitCost: cost,
        reason: addItemReason,
        batchNumber: addItemBatch || undefined,
        expiryDate: addItemExpiry || undefined,
        deductInventory: addItemDeductStock,
      },
    ]);

    setSelectedProductId("");
    setAddItemQty("1");
    setAddItemCost("");
    setAddItemBatch("");
    setAddItemExpiry("");
  };

  const handleRemoveItemFromForm = (idx: number) => {
    setFormItems(formItems.filter((_, i) => i !== idx));
  };

  const handleSaveDebitNote = async (issueNow: boolean) => {
    if (!formSupplierId) {
      setStatusMessage({ type: "error", text: "Please select a supplier." });
      return;
    }
    if (formItems.length === 0) {
      setStatusMessage({ type: "error", text: "Please add at least one item to return." });
      return;
    }

    try {
      setSubmittingCreate(true);
      const res = await fetch("/api/purchases/debit-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: formSupplierId,
          branchId: formBranchId || undefined,
          settlementType: formSettlementType,
          taxRate: parseFloat(formTaxRate) || 0,
          distributorRepName: formRepName || undefined,
          distributorVehicleNumber: formVanNumber || undefined,
          notes: formNotes || undefined,
          status: issueNow ? "ISSUED" : "DRAFT",
          items: formItems,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: "success",
          text: `Debit Note ${data.debitNote.debitNoteNumber} ${
            issueNow ? "issued and stock deducted" : "saved as draft"
          }!`,
        });
        setIsCreateModalOpen(false);
        loadDebitNotes();
        if (onRefreshData) onRefreshData();
      } else {
        setStatusMessage({ type: "error", text: data.error || "Failed to create debit note" });
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Network error" });
    } finally {
      setSubmittingCreate(false);
    }
  };

  const handleIssueDebitNote = async () => {
    if (!issuingDebitNote) return;
    try {
      setSubmittingIssue(true);
      const res = await fetch(`/api/purchases/debit-notes/${issuingDebitNote._id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ISSUE",
          distributorVehicleNumber: issueVanNumber || undefined,
          distributorRepName: issueRepName || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: "success",
          text: `Debit Note ${data.debitNote.debitNoteNumber} issued and inventory deducted.`,
        });
        setIssuingDebitNote(null);
        loadDebitNotes();
        if (onRefreshData) onRefreshData();
      } else {
        setStatusMessage({ type: "error", text: data.error || "Failed to issue debit note" });
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Network error" });
    } finally {
      setSubmittingIssue(false);
    }
  };

  const handleApplyCredit = async () => {
    if (!applyingCreditDebitNote) return;
    try {
      setSubmittingCredit(true);
      const res = await fetch(`/api/purchases/debit-notes/${applyingCreditDebitNote._id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "APPLY_CREDIT",
          distributorCreditNoteNumber: vendorCreditNoteRef || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: "success",
          text: data.message || "Credit offset applied to accounts payable debt!",
        });
        setApplyingCreditDebitNote(null);
        loadDebitNotes();
        if (onRefreshData) onRefreshData();
      } else {
        setStatusMessage({ type: "error", text: data.error || "Failed to apply credit offset" });
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Network error" });
    } finally {
      setSubmittingCredit(false);
    }
  };

  const handleConfirmReplacement = async () => {
    if (!replacingDebitNote) return;
    try {
      setSubmittingReplacement(true);
      const res = await fetch(`/api/purchases/debit-notes/${replacingDebitNote._id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CONFIRM_REPLACEMENT",
          restockReplacement: restockReplacementStock,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: "success",
          text: `Replacement stock recorded and settled for ${replacingDebitNote.debitNoteNumber}!`,
        });
        setReplacingDebitNote(null);
        loadDebitNotes();
        if (onRefreshData) onRefreshData();
      } else {
        setStatusMessage({ type: "error", text: data.error || "Failed to confirm replacement" });
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Network error" });
    } finally {
      setSubmittingReplacement(false);
    }
  };

  const handleCancelDebitNote = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this Debit Note? Any deducted inventory will be restored.")) {
      return;
    }
    try {
      const res = await fetch(`/api/purchases/debit-notes/${id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CANCEL" }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: "success", text: "Debit Note cancelled." });
        loadDebitNotes();
        if (onRefreshData) onRefreshData();
      } else {
        setStatusMessage({ type: "error", text: data.error || "Failed to cancel debit note" });
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Network error" });
    }
  };

  const formSubtotal = formItems.reduce(
    (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unitCost) || 0),
    0
  );
  const formTax = (formSubtotal * (parseFloat(formTaxRate) || 0)) / 100;
  const formNet = formSubtotal + formTax;

  return (
    <div className="space-y-4">
      {/* ================= 4 EXECUTIVE KPI CARDS ================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-rose-800">
            <span>Pending Claims</span>
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
          </div>
          <div className="mt-2">
            <span className="text-xl font-black font-mono text-rose-950 block">
              {formatCurrency(metrics.pendingClaimsTotal)}
            </span>
            <span className="text-[10px] text-rose-700 font-semibold">
              {metrics.pendingClaimsCount} claims awaiting credit
            </span>
          </div>
        </div>

        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-emerald-800">
            <span>Applied AP Credits</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-black font-mono text-emerald-950 block">
              {formatCurrency(metrics.appliedCreditsTotal)}
            </span>
            <span className="text-[10px] text-emerald-700 font-semibold">
              Deducted from supplier payables
            </span>
          </div>
        </div>

        <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-indigo-800">
            <span>Replacements Due</span>
            <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-black font-mono text-indigo-950 block">
              {metrics.replacementsPendingCount}
            </span>
            <span className="text-[10px] text-indigo-700 font-semibold">
              Fresh stock replacement expected
            </span>
          </div>
        </div>

        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-600">
            <span>Total Debit Notes</span>
            <FileText className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-black font-mono text-slate-900 block">
              {metrics.totalDebitNotesCount}
            </span>
            <span className="text-[10px] text-slate-500 font-semibold">
              All time damaged / expiry returns
            </span>
          </div>
        </div>
      </div>

      {/* ================= FILTER & ACTION TOOLBAR ================= */}
      <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            { id: "ALL", label: "All Returns" },
            { id: "DRAFT", label: "Draft" },
            { id: "ISSUED", label: "Issued (Handed Over)" },
            { id: "APPLIED", label: "Settled / Credited" },
            { id: "REJECTED", label: "Rejected" },
          ].map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => setStatusFilter(st.id)}
              className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition ${
                statusFilter === st.id
                  ? "bg-rose-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-100 border-none rounded-xl text-slate-700 font-medium focus:ring-1 focus:ring-rose-500 max-w-[160px] truncate"
          >
            <option value="">All Suppliers</option>
            {suppliers.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>

          <div className="relative flex-1 md:w-48">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search DN #, van, rep..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-100 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
          </div>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-xs transition whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Debit Note</span>
          </button>
        </div>
      </div>

      {/* ================= DEBIT NOTES TABLE ================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-100">
              <tr>
                <th className="py-3 px-3.5">Debit Note Ref</th>
                <th className="py-3 px-3.5">Supplier & Logistics</th>
                <th className="py-3 px-3.5 text-center">Items & Reason</th>
                <th className="py-3 px-3.5 text-right">Claim Amount</th>
                <th className="py-3 px-3.5 text-center">Settlement</th>
                <th className="py-3 px-3.5 text-center">Status</th>
                <th className="py-3 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Sparkles className="w-6 h-6 animate-spin mx-auto mb-2 text-rose-600" />
                    <span>Loading debit notes & return claims...</span>
                  </td>
                </tr>
              ) : debitNotes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RotateCcw className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">No Debit Notes Found</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Create a debit note to claim supplier credit for damaged or expired items.
                    </p>
                  </td>
                </tr>
              ) : (
                debitNotes.map((dn) => {
                  const primaryReason = dn.items[0]?.reason || "DAMAGED_IN_TRANSIT";
                  return (
                    <tr key={dn._id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3.5">
                        <div className="font-mono font-bold text-slate-900">{dn.debitNoteNumber}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {formatSLDateTime(dn.createdAt)}
                        </div>
                        {dn.grnNumber && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-mono text-[9px] border border-emerald-200">
                            GRN: {dn.grnNumber}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3.5">
                        <div className="font-bold text-slate-900">{dn.supplierName}</div>
                        <div className="text-[10px] text-slate-500">
                          {dn.branchName || "Main Central Warehouse"}
                        </div>
                        {(dn.distributorVehicleNumber || dn.distributorRepName) && (
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono mt-0.5">
                            <Truck className="w-3 h-3" />
                            <span>
                              {dn.distributorVehicleNumber || "Van"}
                              {dn.distributorRepName ? ` (${dn.distributorRepName})` : ""}
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3.5 text-center">
                        <span className="font-bold text-slate-800">{dn.items.length} items</span>
                        <div className="text-[10px] text-rose-700 font-medium">
                          {primaryReason.replace(/_/g, " ")}
                        </div>
                      </td>

                      <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(dn.netTotal)}
                      </td>

                      <td className="py-3 px-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            dn.settlementType === "AP_CREDIT_OFFSET"
                              ? "bg-emerald-100 text-emerald-800"
                              : dn.settlementType === "REPLACEMENT"
                              ? "bg-blue-100 text-blue-800"
                              : dn.settlementType === "REFUND"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {dn.settlementType.replace(/_/g, " ")}
                        </span>
                        {dn.distributorCreditNoteNumber && (
                          <div className="text-[9px] font-mono text-emerald-700 mt-0.5">
                            CN: {dn.distributorCreditNoteNumber}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            dn.status === "APPLIED"
                              ? "bg-emerald-100 text-emerald-800"
                              : dn.status === "ISSUED"
                              ? "bg-amber-100 text-amber-800"
                              : dn.status === "REJECTED"
                              ? "bg-rose-100 text-rose-800"
                              : dn.status === "CANCELLED"
                              ? "bg-slate-100 text-slate-500"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {dn.status}
                        </span>
                      </td>

                      <td className="py-3 px-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View */}
                          <button
                            type="button"
                            onClick={() => setViewingDebitNote(dn)}
                            title="View Debit Note Details"
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Print */}
                          <button
                            type="button"
                            onClick={() => setActivePrintDebitNote(dn)}
                            title="Print Debit Note / Gate Pass"
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* Action: If DRAFT -> Handover & Issue */}
                          {dn.status === "DRAFT" && (
                            <button
                              type="button"
                              onClick={() => {
                                setIssuingDebitNote(dn);
                                setIssueVanNumber(dn.distributorVehicleNumber || "");
                                setIssueRepName(dn.distributorRepName || "");
                              }}
                              className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 shadow-xs"
                              title="Handover goods to distributor & deduct inventory"
                            >
                              <Truck className="w-3 h-3" />
                              <span>Handover</span>
                            </button>
                          )}

                          {/* Action: If ISSUED -> Settle credit offset or replacement */}
                          {dn.status === "ISSUED" && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setApplyingCreditDebitNote(dn);
                                  setVendorCreditNoteRef("");
                                }}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 shadow-xs"
                                title="Offset against Accounts Payable debt"
                              >
                                <DollarSign className="w-3 h-3" />
                                <span>Apply Credit</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setReplacingDebitNote(dn);
                                  setRestockReplacementStock(true);
                                }}
                                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 shadow-xs"
                                title="Confirm replacement goods delivered"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Replaced</span>
                              </button>
                            </>
                          )}

                          {/* Cancel if DRAFT or ISSUED */}
                          {(dn.status === "DRAFT" || dn.status === "ISSUED") && (
                            <button
                              type="button"
                              onClick={() => handleCancelDebitNote(dn._id)}
                              title="Cancel Debit Note"
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                            >
                              <Undo2 className="w-3.5 h-3.5" />
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
      </div>

      {/* ================= MODAL: CREATE DEBIT NOTE ================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Create Supplier Debit Note</h3>
                  <p className="text-[11px] text-slate-500">Return damaged, expired, or defective inventory</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Header Form */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Supplier / Distributor *</label>
                <select
                  value={formSupplierId}
                  onChange={(e) => setFormSupplierId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500 font-medium"
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} (Bal: {formatCurrency(s.currentBalance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Dispatching Facility</label>
                <select
                  value={formBranchId}
                  onChange={(e) => setFormBranchId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500 font-medium"
                >
                  {branches.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Expected Settlement Type</label>
                <select
                  value={formSettlementType}
                  onChange={(e) => setFormSettlementType(e.target.value as any)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500 font-medium"
                >
                  <option value="AP_CREDIT_OFFSET">AP Credit Offset (Deduct Debt)</option>
                  <option value="REPLACEMENT">Replacement Stock</option>
                  <option value="REFUND">Cash / Cheque Refund</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Van / Delivery Vehicle #</label>
                <input
                  type="text"
                  value={formVanNumber}
                  onChange={(e) => setFormVanNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. WP-CAB-4921"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Distributor Rep / Driver</label>
                <input
                  type="text"
                  value={formRepName}
                  onChange={(e) => setFormRepName(e.target.value)}
                  placeholder="e.g. Kamal (Sales Rep)"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">VAT / Tax Rate (%)</label>
                <input
                  type="number"
                  min="0"
                  value={formTaxRate}
                  onChange={(e) => setFormTaxRate(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>
            </div>

            {/* Line Item Adder */}
            <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-3">
              <div className="font-bold text-xs text-slate-800 flex items-center justify-between">
                <span>Add Damaged / Expired Item</span>
                <span className="text-[11px] text-slate-400 font-normal">
                  Items marked "deduct stock" will decrease live shelf count.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                    Select Product *
                  </label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => {
                      setSelectedProductId(e.target.value);
                      const p = products.find((pr) => pr._id === e.target.value);
                      if (p) setAddItemCost(p.costPrice.toString());
                    }}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="">Search / Choose Product</option>
                    {products.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} (Stock: {p.stockQuantity} {p.unit || "pcs"})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                    Return Qty *
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={addItemQty}
                    onChange={(e) => setAddItemQty(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                    Unit Cost (Rs.) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={addItemCost}
                    onChange={(e) => setAddItemCost(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                    Return Reason *
                  </label>
                  <select
                    value={addItemReason}
                    onChange={(e) => setAddItemReason(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="DAMAGED_IN_TRANSIT">Damaged in Transit</option>
                    <option value="EXPIRED">Expired Stock</option>
                    <option value="NEAR_EXPIRY">Near Expiry</option>
                    <option value="FACTORY_DEFECT">Factory / Quality Defect</option>
                    <option value="WRONG_ITEM">Wrong Item</option>
                    <option value="DOCK_REJECTED">Dock Inspection Rejected</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                    Batch #
                  </label>
                  <input
                    type="text"
                    value={addItemBatch}
                    onChange={(e) => setAddItemBatch(e.target.value)}
                    placeholder="e.g. B-991"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={addItemExpiry}
                    onChange={(e) => setAddItemExpiry(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div className="flex items-end justify-between gap-2">
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-700 font-semibold cursor-pointer pb-2">
                    <input
                      type="checkbox"
                      checked={addItemDeductStock}
                      onChange={(e) => setAddItemDeductStock(e.target.checked)}
                      className="rounded text-rose-600 focus:ring-rose-500"
                    />
                    <span>Deduct Stock</span>
                  </label>

                  <button
                    type="button"
                    onClick={handleAddItemToForm}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs transition"
                  >
                    + Add Item
                  </button>
                </div>
              </div>
            </div>

            {/* Added Items List */}
            <div className="overflow-hidden border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase">
                  <tr>
                    <th className="py-2 px-3">Item Description</th>
                    <th className="py-2 px-3">Reason</th>
                    <th className="py-2 px-3 text-right">Qty</th>
                    <th className="py-2 px-3 text-right">Cost</th>
                    <th className="py-2 px-3 text-right">Total</th>
                    <th className="py-2 px-3 text-center">Deduct Stock</th>
                    <th className="py-2 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs">
                  {formItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-400 font-sans">
                        No items added yet. Choose a product and click "+ Add Item".
                      </td>
                    </tr>
                  ) : (
                    formItems.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-sans font-semibold text-slate-800">
                          {it.name}
                          {it.batchNumber && (
                            <span className="block text-[10px] text-slate-400 font-mono">
                              Batch: {it.batchNumber}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-sans">
                          <span className="px-1.5 py-0.2 rounded bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-bold">
                            {it.reason.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right text-slate-900 font-bold">
                          {it.quantity} {it.unit}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-700">
                          {formatCurrency(Number(it.unitCost) || 0)}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">
                          {formatCurrency((Number(it.quantity) || 0) * (Number(it.unitCost) || 0))}
                        </td>
                        <td className="py-2 px-3 text-center font-sans">
                          {it.deductInventory ? (
                            <span className="text-emerald-700 font-bold text-[10px]">Yes</span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">No</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveItemFromForm(idx)}
                            className="text-rose-500 hover:text-rose-700 p-1"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {formItems.length > 0 && (
                  <tfoot className="bg-slate-50 border-t border-slate-200 text-xs font-bold font-sans">
                    <tr>
                      <td colSpan={4} className="py-2 px-3 text-right text-slate-600 uppercase text-[10px]">
                        Net Claim Total:
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-rose-900 text-sm font-black">
                        {formatCurrency(formNet)}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            <div>
              <label className="block text-slate-600 text-xs font-semibold mb-1">Return Notes / Reason Details</label>
              <textarea
                rows={2}
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Details of delivery van driver handover, damage cause, distributor credit reference..."
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={submittingCreate || formItems.length === 0}
                  onClick={() => handleSaveDebitNote(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition disabled:opacity-50"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  disabled={submittingCreate || formItems.length === 0}
                  onClick={() => handleSaveDebitNote(true)}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/25 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Issue Handover & Deduct Stock</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: ISSUE / HANDOVER TO VAN DRIVER ================= */}
      {issuingDebitNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Distributor Handover Gate Pass</h3>
                  <p className="text-[11px] text-slate-500 font-mono">{issuingDebitNote.debitNoteNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIssuingDebitNote(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Confirming handover will transition this claim to <b>ISSUED</b> and automatically deduct physical stock from store inventory for tracked items.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Delivery Van / Lorry Number *</label>
                <input
                  type="text"
                  required
                  value={issueVanNumber}
                  onChange={(e) => setIssueVanNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. WP-CAB-4921"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Distributor Rep / Driver Name</label>
                <input
                  type="text"
                  value={issueRepName}
                  onChange={(e) => setIssueRepName(e.target.value)}
                  placeholder="e.g. Kamal Perera (Driver)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIssuingDebitNote(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingIssue}
                onClick={handleIssueDebitNote}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Confirm & Deduct Stock</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: APPLY AP CREDIT OFFSET ================= */}
      {applyingCreditDebitNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Offset Accounts Payable Debt</h3>
                  <p className="text-[11px] text-slate-500 font-mono">{applyingCreditDebitNote.debitNoteNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setApplyingCreditDebitNote(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-emerald-800">Supplier:</span>
                <span className="font-bold text-emerald-950">{applyingCreditDebitNote.supplierName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-800">Debit Note Net Value:</span>
                <span className="font-mono font-bold text-emerald-950">
                  {formatCurrency(applyingCreditDebitNote.netTotal)}
                </span>
              </div>
              <p className="text-[11px] text-emerald-700 pt-1 border-t border-emerald-200">
                This will automatically reduce the supplier's outstanding AP balance by{" "}
                <b>{formatCurrency(applyingCreditDebitNote.netTotal)}</b> and record a credit deduction on their statement.
              </p>
            </div>

            <div className="text-xs">
              <label className="block text-slate-700 font-semibold mb-1">
                Distributor Official Credit Note (CN) #
              </label>
              <input
                type="text"
                value={vendorCreditNoteRef}
                onChange={(e) => setVendorCreditNoteRef(e.target.value.toUpperCase())}
                placeholder="e.g. CN-UNI-88219"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setApplyingCreditDebitNote(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingCredit}
                onClick={handleApplyCredit}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/25 transition flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Confirm Credit Offset</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: CONFIRM REPLACEMENT GOODS ================= */}
      {replacingDebitNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Confirm Replacement Received</h3>
                  <p className="text-[11px] text-slate-500 font-mono">{replacingDebitNote.debitNoteNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReplacingDebitNote(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Distributor delivered fresh replacement stock to replace returned damaged/expired items.
            </p>

            <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={restockReplacementStock}
                onChange={(e) => setRestockReplacementStock(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-semibold text-slate-800">
                Automatically add replacement quantities back into live store inventory (RESTOCK)
              </span>
            </label>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReplacingDebitNote(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingReplacement}
                onClick={handleConfirmReplacement}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Confirm Replacement</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: VIEW DEBIT NOTE DETAILS ================= */}
      {viewingDebitNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Debit Note: {viewingDebitNote.debitNoteNumber}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Created {formatSLDateTime(viewingDebitNote.createdAt)} by {viewingDebitNote.createdBy}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingDebitNote(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block">Supplier:</span>
                <span className="font-bold text-slate-900 text-sm">{viewingDebitNote.supplierName}</span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  Facility: {viewingDebitNote.branchName || "Main Central Warehouse"}
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 block">Status:</span>
                <span className="font-bold uppercase text-rose-700">{viewingDebitNote.status}</span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  Settlement: {viewingDebitNote.settlementType.replace(/_/g, " ")}
                </span>
              </div>
            </div>

            {/* Items Table */}
            <div className="overflow-hidden border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Item Description</th>
                    <th className="py-2.5 px-3">Reason</th>
                    <th className="py-2.5 px-3 text-right">Qty</th>
                    <th className="py-2.5 px-3 text-right">Unit Cost</th>
                    <th className="py-2.5 px-3 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs">
                  {viewingDebitNote.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 px-3 font-sans font-semibold text-slate-800">
                        {it.name}
                        {it.batchNumber && (
                          <span className="block text-[10px] text-slate-400 font-mono">
                            Batch: {it.batchNumber}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <span className="px-1.5 py-0.2 rounded bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-bold">
                          {it.reason.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                        {it.quantity} {it.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-700">
                        {formatCurrency(it.unitCost)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                        {formatCurrency(it.totalCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200 text-xs font-bold font-sans">
                  <tr>
                    <td colSpan={4} className="py-2.5 px-3 text-right text-slate-600 uppercase text-[10px]">
                      Net Claim Amount:
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-rose-900 text-sm font-black">
                      {formatCurrency(viewingDebitNote.netTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {viewingDebitNote.notes && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                <span className="font-bold">Notes: </span>
                <span>{viewingDebitNote.notes}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setActivePrintDebitNote(viewingDebitNote);
                  setViewingDebitNote(null);
                }}
                className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Debit Note / Gate Pass</span>
              </button>
              <button
                type="button"
                onClick={() => setViewingDebitNote(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= PRINTABLE SLIP ================= */}
      {activePrintDebitNote && (
        <SupplierDebitNoteReceipt
          business={business || { name: "Our Store" }}
          supplier={suppliers.find((s) => s._id === activePrintDebitNote.supplierId)}
          debitNote={activePrintDebitNote}
          onClose={() => setActivePrintDebitNote(null)}
        />
      )}
    </div>
  );
}
