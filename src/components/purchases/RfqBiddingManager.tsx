"use client";

import { useEffect, useState } from "react";
import {
  Sparkles,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  X,
  Send,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  TrendingDown,
  Eye,
  Award,
  Trash2,
  ShoppingBag,
  ExternalLink,
  MessageSquare,
  Check,
  Truck,
  DollarSign,
  Package,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface ProductOption {
  _id: string;
  name: string;
  sku?: string;
  costPrice: number;
  unit?: string;
}

interface SupplierOption {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  contactPerson?: string;
  portalToken?: string;
  isActive: boolean;
}

interface BranchOption {
  _id: string;
  name: string;
  code: string;
  isMainWarehouse?: boolean;
}

interface RfqItem {
  productId: string;
  productName: string;
  sku?: string;
  requestedQty: number;
  unit: string;
  targetPrice?: number;
  specifications?: string;
}

interface InvitedSupplier {
  supplierId: string;
  supplierName: string;
  phone: string;
  email?: string;
  token: string;
  status: "INVITED" | "SUBMITTED" | "DECLINED" | "AWARDED";
  invitedAt: string;
  submittedAt?: string;
}

interface SupplierBidItem {
  productId: string;
  productName: string;
  offeredQty: number;
  unitCost: number;
  discountPercent?: number;
  netUnitCost: number;
  totalCost: number;
  leadTimeDays: number;
  notes?: string;
}

interface SupplierBid {
  supplierId: string;
  supplierName: string;
  token: string;
  submittedAt: string;
  items: SupplierBidItem[];
  subtotal: number;
  taxAmount?: number;
  netTotal: number;
  validUntil?: string;
  deliveryTerms?: string;
  paymentTerms?: string;
  notes?: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
}

interface RfqRecord {
  _id: string;
  rfqNumber: string;
  title: string;
  description?: string;
  requiredByDate: string;
  deadlineDate: string;
  status: "DRAFT" | "OPEN" | "EVALUATING" | "AWARDED" | "CLOSED" | "CANCELLED";
  items: RfqItem[];
  invitedSuppliers: InvitedSupplier[];
  bids: SupplierBid[];
  awardedSupplierId?: string;
  awardedSupplierName?: string;
  awardedPoId?: string;
  awardedPoNumber?: string;
  awardedAt?: string;
  awardedNotes?: string;
  createdBy: string;
  createdAt: string;
}

interface RfqBiddingManagerProps {
  products: ProductOption[];
  suppliers: SupplierOption[];
  branches: BranchOption[];
  onPoCreated?: () => void;
  setStatusMessage: (msg: { type: "success" | "error"; text: string } | null) => void;
}

export default function RfqBiddingManager({
  products,
  suppliers,
  branches,
  onPoCreated,
  setStatusMessage,
}: RfqBiddingManagerProps) {
  const [rfqs, setRfqs] = useState<RfqRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Create RFQ Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newRequiredDate, setNewRequiredDate] = useState("");
  const [newDeadlineDate, setNewDeadlineDate] = useState("");
  const [newItems, setNewItems] = useState<
    Array<{ productId: string; productName: string; sku?: string; requestedQty: number; unit: string; targetPrice: string; specifications: string }>
  >([]);
  const [selectedProductToAdd, setSelectedProductToAdd] = useState("");
  const [itemQty, setItemQty] = useState("50");
  const [itemTargetPrice, setItemTargetPrice] = useState("");
  const [itemSpecs, setItemSpecs] = useState("");
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [sendSmsAlerts, setSendSmsAlerts] = useState(true);
  const [submittingCreate, setSubmittingCreate] = useState(false);

  // Compare & Award Modal State
  const [comparingRfq, setComparingRfq] = useState<RfqRecord | null>(null);
  const [awardingSupplier, setAwardingSupplier] = useState<{ supplierId: string; supplierName: string; bidTotal: number } | null>(null);
  const [awardBranchId, setAwardBranchId] = useState("");
  const [awardNotes, setAwardNotes] = useState("");
  const [submittingAward, setSubmittingAward] = useState(false);

  // Load RFQs
  const loadRfqs = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/rfq?status=${statusFilter}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ""}`);
      const data = await res.json();
      if (data.success) {
        setRfqs(data.rfqs || []);
      }
    } catch (err) {
      console.error("Failed to load RFQs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRfqs();
  }, [statusFilter, searchQuery]);

  // Handle adding line item to new RFQ
  const handleAddItem = () => {
    if (!selectedProductToAdd) return;
    const prod = products.find((p) => p._id === selectedProductToAdd);
    if (!prod) return;

    if (newItems.some((it) => it.productId === prod._id)) {
      alert("This product has already been added to the tender.");
      return;
    }

    setNewItems([
      ...newItems,
      {
        productId: prod._id,
        productName: prod.name,
        sku: prod.sku,
        requestedQty: parseInt(itemQty) || 1,
        unit: prod.unit || "pcs",
        targetPrice: itemTargetPrice || String(prod.costPrice || ""),
        specifications: itemSpecs.trim(),
      },
    ]);

    setSelectedProductToAdd("");
    setItemQty("50");
    setItemTargetPrice("");
    setItemSpecs("");
  };

  // Handle Create RFQ Submit
  const handleCreateRfq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      alert("Please enter a tender title.");
      return;
    }
    if (!newRequiredDate || !newDeadlineDate) {
      alert("Please set both the required delivery date and submission deadline.");
      return;
    }
    if (newItems.length === 0) {
      alert("Please add at least one line item to the RFQ tender.");
      return;
    }
    if (selectedSupplierIds.length === 0) {
      alert("Please select at least one supplier to invite to bid.");
      return;
    }

    try {
      setSubmittingCreate(true);
      const res = await fetch("/api/rfq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim(),
          requiredByDate: newRequiredDate,
          deadlineDate: newDeadlineDate,
          items: newItems.map((it) => ({
            productId: it.productId,
            name: it.productName,
            sku: it.sku,
            requestedQty: it.requestedQty,
            unit: it.unit,
            targetPrice: it.targetPrice ? parseFloat(it.targetPrice) : undefined,
            specifications: it.specifications,
          })),
          supplierIds: selectedSupplierIds,
          sendSmsAlerts,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create RFQ tender");
      }

      setStatusMessage({ type: "success", text: data.message || "Quotation tender issued successfully!" });
      setIsCreateModalOpen(false);
      // Reset form
      setNewTitle("");
      setNewDescription("");
      setNewRequiredDate("");
      setNewDeadlineDate("");
      setNewItems([]);
      setSelectedSupplierIds([]);
      await loadRfqs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error creating RFQ";
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setSubmittingCreate(false);
    }
  };

  // Handle Confirm Award to Supplier
  const handleConfirmAward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comparingRfq || !awardingSupplier) return;

    try {
      setSubmittingAward(true);
      const res = await fetch(`/api/rfq/${comparingRfq._id}/award`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: awardingSupplier.supplierId,
          branchId: awardBranchId || undefined,
          notes: awardNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to award RFQ");
      }

      setStatusMessage({
        type: "success",
        text: data.message || `RFQ awarded to ${awardingSupplier.supplierName}! Purchase Order created.`,
      });

      setAwardingSupplier(null);
      setComparingRfq(null);
      await loadRfqs();
      if (onPoCreated) onPoCreated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error awarding RFQ";
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setSubmittingAward(false);
    }
  };

  // Filter metrics
  const openCount = rfqs.filter((r) => r.status === "OPEN").length;
  const evalCount = rfqs.filter((r) => r.status === "EVALUATING").length;
  const awardedCount = rfqs.filter((r) => r.status === "AWARDED").length;
  const totalInvitedCount = rfqs.reduce((acc, r) => acc + (r.invitedSuppliers?.length || 0), 0);

  return (
    <div className="space-y-4">
      {/* 4 Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Active Tenders (Open)
            </span>
            <div className="text-xl font-black text-purple-700 font-mono mt-0.5">{openCount}</div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Evaluating Quotes
            </span>
            <div className="text-xl font-black text-slate-900 font-mono mt-0.5">{evalCount}</div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Awarded to POs
            </span>
            <div className="text-xl font-black text-emerald-800 font-mono mt-0.5">{awardedCount}</div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Total Bidders Invited
            </span>
            <div className="text-xl font-black text-slate-900 font-mono mt-0.5">{totalInvitedCount}</div>
          </div>
        </div>
      </div>

      {/* Filter and Action Bar */}
      <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            { id: "ALL", label: "All Tenders" },
            { id: "OPEN", label: "Open for Bids" },
            { id: "EVALUATING", label: "Evaluating" },
            { id: "AWARDED", label: "Awarded" },
            { id: "CLOSED", label: "Closed" },
          ].map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => setStatusFilter(st.id)}
              className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition ${
                statusFilter === st.id
                  ? "bg-purple-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search RFQ #, Product, Title..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setIsCreateModalOpen(true);
              setNewRequiredDate(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
              setNewDeadlineDate(new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10));
              setSelectedSupplierIds(suppliers.filter((s) => s.isActive).map((s) => s._id));
            }}
            className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold flex items-center gap-1.5 transition shrink-0 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Create RFQ Tender</span>
          </button>
        </div>
      </div>

      {/* RFQ List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">RFQ Number & Title</th>
                <th className="py-3 px-4">Required Delivery</th>
                <th className="py-3 px-4">Submission Deadline</th>
                <th className="py-3 px-4 text-center">Invited Suppliers</th>
                <th className="py-3 px-4 text-center">Quotes Received</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading quotation tenders...
                  </td>
                </tr>
              ) : rfqs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No quotation requests found matching filter criteria.
                  </td>
                </tr>
              ) : (
                rfqs.map((rfq) => {
                  const deadlineDate = new Date(rfq.deadlineDate);
                  const isExpired = new Date() > deadlineDate;
                  const bidsCount = rfq.bids?.length || 0;
                  const invitedCount = rfq.invitedSuppliers?.length || 0;

                  return (
                    <tr key={rfq._id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">{rfq.rfqNumber}</span>
                          <span className="text-[10px] text-slate-400">({rfq.items?.length || 0} items)</span>
                        </div>
                        <div className="font-medium text-slate-700 text-xs mt-0.5 line-clamp-1">{rfq.title}</div>
                      </td>

                      <td className="py-3 px-4 text-slate-600">
                        {new Date(rfq.requiredByDate).toLocaleDateString()}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`font-medium ${
                            isExpired && rfq.status === "OPEN" ? "text-rose-600 font-bold" : "text-slate-600"
                          }`}
                        >
                          {deadlineDate.toLocaleDateString()}
                          {isExpired && rfq.status === "OPEN" && " (Expired)"}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">
                        {invitedCount}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                            bidsCount > 0 ? "bg-purple-100 text-purple-800" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {bidsCount} / {invitedCount}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            rfq.status === "AWARDED"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              : rfq.status === "OPEN"
                              ? "bg-purple-100 text-purple-800"
                              : rfq.status === "EVALUATING"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {rfq.status === "AWARDED" && rfq.awardedPoNumber
                            ? `AWARDED: ${rfq.awardedPoNumber}`
                            : rfq.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setComparingRfq(rfq)}
                            className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{bidsCount > 0 ? "Compare & Award" : "View Specs"}</span>
                          </button>
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

      {/* ================= MODAL: CREATE RFQ TENDER ================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Issue Quotation Request (RFQ) Tender</h3>
                  <p className="text-[11px] text-slate-400">Competitive e-Bidding for Store Stock Replenishment</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRfq} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Tender Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Q4 High-Demand Ceylon Tea & Spices Replenishment"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Procurement Description / Tender Scope
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Detailed requirements, delivery location, quality specifications..."
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Required Delivery Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={newRequiredDate}
                    onChange={(e) => setNewRequiredDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Quote Submission Deadline <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={newDeadlineDate}
                    onChange={(e) => setNewDeadlineDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 font-mono"
                  />
                </div>
              </div>

              {/* Items Table Builder */}
              <div className="border-t border-slate-200 pt-3 space-y-3">
                <label className="block font-bold text-slate-800 uppercase tracking-wider">
                  Product Line Items ({newItems.length})
                </label>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <div className="sm:col-span-2">
                      <label className="text-[10px] text-slate-500 font-bold block mb-0.5">Select Product Catalog SKU</label>
                      <select
                        value={selectedProductToAdd}
                        onChange={(e) => {
                          setSelectedProductToAdd(e.target.value);
                          const p = products.find((prod) => prod._id === e.target.value);
                          if (p) setItemTargetPrice(String(p.costPrice || ""));
                        }}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="">-- Choose Product --</option>
                        {products.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.name} {p.sku ? `(${p.sku})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 font-bold block mb-0.5">Target Qty</label>
                      <input
                        type="number"
                        min="1"
                        value={itemQty}
                        onChange={(e) => setItemQty(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 font-bold block mb-0.5">Target Max Price (Rs.)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Optional"
                        value={itemTargetPrice}
                        onChange={(e) => setItemTargetPrice(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Line Item specifications (e.g. Export foil pack, min 18 months shelf life)"
                      value={itemSpecs}
                      onChange={(e) => setItemSpecs(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleAddItem}
                      disabled={!selectedProductToAdd}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg font-bold shrink-0"
                    >
                      Add Item
                    </button>
                  </div>
                </div>

                {/* List of Added Items */}
                {newItems.length > 0 && (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {newItems.map((item, idx) => (
                      <div key={idx} className="p-2.5 bg-white flex items-center justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-900">{item.productName}</div>
                          <div className="text-[11px] text-slate-500 flex gap-3">
                            <span>Qty: <strong className="text-slate-800 font-mono">{item.requestedQty} {item.unit}</strong></span>
                            {item.targetPrice && (
                              <span>Target: <strong className="text-slate-800 font-mono">Rs. {item.targetPrice}</strong></span>
                            )}
                            {item.specifications && <span className="italic">"{item.specifications}"</span>}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setNewItems(newItems.filter((_, i) => i !== idx))}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Invited Suppliers Selector */}
              <div className="border-t border-slate-200 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-800 uppercase tracking-wider">
                    Invite Suppliers to e-Bidding ({selectedSupplierIds.length} selected)
                  </label>
                  <div className="space-x-2">
                    <button
                      type="button"
                      onClick={() => setSelectedSupplierIds(suppliers.filter((s) => s.isActive).map((s) => s._id))}
                      className="text-[11px] text-purple-600 font-bold hover:underline"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedSupplierIds([])}
                      className="text-[11px] text-slate-400 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                  {suppliers.filter((s) => s.isActive).map((s) => {
                    const isChecked = selectedSupplierIds.includes(s._id);
                    return (
                      <label
                        key={s._id}
                        className={`p-2 rounded-xl border text-xs flex items-center gap-2 cursor-pointer transition ${
                          isChecked ? "bg-purple-50/70 border-purple-300 text-purple-900" : "bg-white border-slate-200"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSupplierIds([...selectedSupplierIds, s._id]);
                            } else {
                              setSelectedSupplierIds(selectedSupplierIds.filter((id) => id !== s._id));
                            }
                          }}
                          className="rounded text-purple-600 focus:ring-purple-500"
                        />
                        <div className="truncate">
                          <span className="font-bold block truncate">{s.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{s.phone}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>

                <label className="flex items-center gap-2 pt-2 cursor-pointer text-slate-700">
                  <input
                    type="checkbox"
                    checked={sendSmsAlerts}
                    onChange={(e) => setSendSmsAlerts(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span>Dispatch instant SMS invitations with unique bidding links to supplier phones</span>
                </label>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCreate || newItems.length === 0 || selectedSupplierIds.length === 0}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition"
                >
                  {submittingCreate ? "Issuing Tender..." : "Issue RFQ Tender"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: COMPARE BIDS & AWARD ================= */}
      {comparingRfq && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900">{comparingRfq.rfqNumber}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        comparingRfq.status === "AWARDED"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-purple-100 text-purple-800"
                      }`}
                    >
                      {comparingRfq.status}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 mt-0.5">{comparingRfq.title}</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setComparingRfq(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Bids Overview */}
            <div className="space-y-4 text-xs">
              {comparingRfq.bids.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-2 bg-slate-50 rounded-2xl">
                  <Clock className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="font-bold text-slate-700">Awaiting Supplier Quotes</p>
                  <p className="text-[11px] text-slate-500">
                    {comparingRfq.invitedSuppliers.length} supplier(s) invited. Quotation deadline is{" "}
                    {new Date(comparingRfq.deadlineDate).toLocaleDateString()}.
                  </p>
                </div>
              ) : (
                <>
                  {/* Side-by-Side Comparison Matrix */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                        Side-by-Side Line Item Price Matrix
                      </span>
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        🏆 Highlights lowest quoted net rate
                      </span>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">Item Description</th>
                            <th className="py-2.5 px-3 text-right">Target Qty</th>
                            {comparingRfq.bids.map((b, idx) => (
                              <th key={idx} className="py-2.5 px-3 text-right font-mono text-purple-900">
                                {b.supplierName}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {comparingRfq.items.map((item, itemIdx) => {
                            // Find minimum unit price for this product across all bids
                            const linePrices = comparingRfq.bids
                              .map((b) => b.items?.find((bi) => bi.productId === item.productId)?.netUnitCost || 0)
                              .filter((p) => p > 0);
                            const minPrice = linePrices.length > 0 ? Math.min(...linePrices) : 0;

                            return (
                              <tr key={itemIdx} className="hover:bg-slate-50/50">
                                <td className="py-2.5 px-3">
                                  <div className="font-bold text-slate-900">{item.productName}</div>
                                  {item.targetPrice && (
                                    <span className="text-[10px] text-slate-400">
                                      Target: {formatCurrency(item.targetPrice)}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">
                                  {item.requestedQty} {item.unit}
                                </td>
                                {comparingRfq.bids.map((b, bidIdx) => {
                                  const line = b.items?.find((bi) => bi.productId === item.productId);
                                  if (!line) {
                                    return (
                                      <td key={bidIdx} className="py-2.5 px-3 text-right text-slate-400 italic">
                                        No quote
                                      </td>
                                    );
                                  }

                                  const isLowest = line.netUnitCost === minPrice;

                                  return (
                                    <td key={bidIdx} className="py-2.5 px-3 text-right font-mono">
                                      <div
                                        className={`font-black ${
                                          isLowest
                                            ? "text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-block"
                                            : "text-slate-800"
                                        }`}
                                      >
                                        {formatCurrency(line.netUnitCost)}
                                      </div>
                                      <div className="text-[10px] text-slate-400">
                                        Total: {formatCurrency(line.totalCost)}
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Supplier Bid Total Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                    {comparingRfq.bids.map((b, idx) => {
                      const isWinning = comparingRfq.awardedSupplierId === b.supplierId;
                      const maxLeadTime = Math.max(...(b.items?.map((it) => it.leadTimeDays || 2) || [2]));

                      return (
                        <div
                          key={idx}
                          className={`p-4 rounded-xl border space-y-2 flex flex-col justify-between ${
                            isWinning
                              ? "bg-emerald-50/70 border-emerald-300 shadow-sm"
                              : "bg-white border-slate-200 shadow-2xs"
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex justify-between items-start">
                              <h4 className="font-bold text-slate-900 text-sm">{b.supplierName}</h4>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isWinning
                                    ? "bg-emerald-200 text-emerald-900"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {isWinning ? "AWARDED" : b.status}
                              </span>
                            </div>

                            <div className="pt-1">
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Quoted Cost</span>
                              <span className="text-lg font-black font-mono text-purple-900">
                                {formatCurrency(b.netTotal)}
                              </span>
                            </div>

                            <div className="text-[11px] text-slate-600 space-y-0.5 pt-1">
                              <div>Delivery Terms: <strong className="text-slate-800">{b.deliveryTerms || "Standard"}</strong></div>
                              <div>Lead Time: <strong className="text-slate-800">{maxLeadTime} Days</strong></div>
                              <div>Payment Terms: <strong className="text-slate-800">{b.paymentTerms || "30 Days Credit"}</strong></div>
                              {b.notes && <div className="text-slate-500 italic mt-1">"{b.notes}"</div>}
                            </div>
                          </div>

                          {comparingRfq.status !== "AWARDED" && (
                            <button
                              type="button"
                              onClick={() => {
                                setAwardingSupplier({
                                  supplierId: b.supplierId,
                                  supplierName: b.supplierName,
                                  bidTotal: b.netTotal,
                                });
                                const main = branches.find((br) => br.isMainWarehouse) || branches[0];
                                setAwardBranchId(main?._id || "");
                              }}
                              className="w-full mt-2 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
                            >
                              <Award className="w-3.5 h-3.5" />
                              <span>Award RFQ to This Supplier</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: AWARD CONFIRMATION ================= */}
      {awardingSupplier && comparingRfq && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Award Tender & Create PO</h3>
                  <p className="text-[11px] text-slate-500">{comparingRfq.rfqNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAwardingSupplier(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmAward} className="space-y-3.5 text-xs">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                <div className="font-bold text-emerald-900 text-sm">{awardingSupplier.supplierName}</div>
                <div className="flex justify-between text-emerald-800">
                  <span>Award Total Value:</span>
                  <span className="font-mono font-black">{formatCurrency(awardingSupplier.bidTotal)}</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Receiving Destination Branch
                </label>
                <select
                  value={awardBranchId}
                  onChange={(e) => setAwardBranchId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                >
                  {branches.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name} {b.isMainWarehouse ? "(Main Warehouse)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Procurement Notes for PO
                </label>
                <input
                  type="text"
                  placeholder="e.g. Awarded per e-Bidding lowest quote."
                  value={awardNotes}
                  onChange={(e) => setAwardNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAwardingSupplier(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAward}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition"
                >
                  {submittingAward ? "Creating PO..." : "Confirm Award & Issue PO"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
