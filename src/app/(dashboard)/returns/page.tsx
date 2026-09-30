"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import AppLayout from "@/components/layout/AppLayout";
import {
  RotateCcw,
  Receipt,
  Ticket,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  X,
  FileText,
  DollarSign,
  Package,
  ShieldCheck,
  AlertTriangle,
  Ban,
  ArrowRight,
  RefreshCw,
  ShoppingBag,
  CreditCard,
  Building2,
  Trash2,
} from "lucide-react";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";
import ReturnSlipReceipt from "@/components/receipts/ReturnSlipReceipt";
import CreditNoteReceipt from "@/components/receipts/CreditNoteReceipt";

interface ReturnItem {
  productId: string;
  name: string;
  barcode?: string;
  unitPrice: number;
  quantity: number;
  condition: "RESTOCKABLE" | "DAMAGED" | "EXPIRED";
  reason: string;
  total: number;
}

interface SaleReturnData {
  _id: string;
  returnNumber: string;
  originalInvoiceNumber?: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  cashierName: string;
  registerName?: string;
  items: ReturnItem[];
  subtotal: number;
  taxRefunded: number;
  netRefundTotal: number;
  refundMethod: "CASH" | "CREDIT_NOTE" | "CUSTOMER_BALANCE";
  creditNoteNumber?: string;
  pointsDeducted?: number;
  notes?: string;
  createdAt: string;
}

interface CreditNoteData {
  _id: string;
  creditNoteNumber: string;
  returnNumber?: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  initialAmount: number;
  remainingBalance: number;
  status: "ACTIVE" | "FULLY_REDEEMED" | "EXPIRED" | "CANCELLED";
  expiryDate: string;
  issuedBy: string;
  redemptions: Array<{
    invoiceNumber?: string;
    amount: number;
    redeemedAt: string;
  }>;
  createdAt: string;
}

interface ReturnStats {
  totalReturnsCount: number;
  totalRefundAmount: number;
  cashRefundsTotal: number;
  creditNotesIssuedTotal: number;
  customerBalanceTotal: number;
  restockedItemsCount: number;
  damagedItemsCount: number;
}

interface CreditNoteStats {
  totalIssuedCount: number;
  activeCount: number;
  activeBalanceTotal: number;
  redeemedTotal: number;
  expiredCount: number;
}

export default function ReturnsPage() {
  const [activeTab, setActiveTab] = useState<"returns" | "creditNotes">("returns");

  // Data states
  const [returns, setReturns] = useState<SaleReturnData[]>([]);
  const [creditNotes, setCreditNotes] = useState<CreditNoteData[]>([]);
  const [returnStats, setReturnStats] = useState<ReturnStats | null>(null);
  const [creditNoteStats, setCreditNoteStats] = useState<CreditNoteStats | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [business, setBusiness] = useState<any>(null);

  // Loading & search states
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [refundMethodFilter, setRefundMethodFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Return Processing Modal
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [returnType, setReturnType] = useState<"INVOICE" | "BLIND">("INVOICE");
  const [invoiceLookupQuery, setInvoiceLookupQuery] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [foundSale, setFoundSale] = useState<any>(null);

  // Draft return items
  const [selectedInvoiceItems, setSelectedInvoiceItems] = useState<{
    [productId: string]: {
      selected: boolean;
      quantity: number;
      maxQuantity: number;
      condition: "RESTOCKABLE" | "DAMAGED" | "EXPIRED";
      reason: string;
    };
  }>({});

  const [blindItems, setBlindItems] = useState<
    Array<{
      productId: string;
      name: string;
      barcode?: string;
      unitPrice: number;
      quantity: number;
      condition: "RESTOCKABLE" | "DAMAGED" | "EXPIRED";
      reason: string;
    }>
  >([]);

  const [selectedRefundMethod, setSelectedRefundMethod] = useState<"CASH" | "CREDIT_NOTE" | "CUSTOMER_BALANCE">("CASH");
  const [returnNotes, setReturnNotes] = useState("");
  const [customerNameInput, setCustomerNameInput] = useState("");
  const [customerPhoneInput, setCustomerPhoneInput] = useState("");
  const [submittingReturn, setSubmittingReturn] = useState(false);

  // Active print slip modal states
  const [activeReturnSlip, setActiveReturnSlip] = useState<SaleReturnData | null>(null);
  const [activeCreditNoteSlip, setActiveCreditNoteSlip] = useState<CreditNoteData | null>(null);
  const [receiptWidth, setReceiptWidth] = useState<"58mm" | "80mm">("58mm");

  // Fetch initial data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [retRes, cnRes, bizRes, prodRes] = await Promise.all([
        fetch("/api/returns"),
        fetch("/api/credit-notes"),
        fetch("/api/business"),
        fetch("/api/products?limit=200"),
      ]);

      const [retData, cnData, bizData, prodData] = await Promise.all([
        retRes.json(),
        cnRes.json(),
        bizRes.json(),
        prodRes.json(),
      ]);

      if (retData.success) {
        setReturns(retData.returns || []);
        setReturnStats(retData.stats);
      }
      if (cnData.success) {
        setCreditNotes(cnData.creditNotes || []);
        setCreditNoteStats(cnData.stats);
      }
      if (bizData.success) {
        setBusiness(bizData.business);
        if (bizData.business?.receiptSettings?.defaultWidth) {
          setReceiptWidth(bizData.business.receiptSettings.defaultWidth);
        }
      }
      if (prodData.success) {
        setProducts(prodData.products || []);
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: "Failed to load returns & credit notes data." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Lookup invoice by number
  const handleLookupInvoice = async () => {
    if (!invoiceLookupQuery.trim()) return;
    setLookupLoading(true);
    setFoundSale(null);
    setSelectedInvoiceItems({});
    try {
      const res = await fetch(`/api/sales?q=${encodeURIComponent(invoiceLookupQuery.trim())}`);
      const data = await res.json();
      if (data.success && data.sales && data.sales.length > 0) {
        // Find exact match or first sale
        const exactMatch = data.sales.find(
          (s: any) => s.invoiceNumber.toUpperCase() === invoiceLookupQuery.trim().toUpperCase()
        ) || data.sales[0];

        setFoundSale(exactMatch);
        setCustomerNameInput(exactMatch.customerName || "Customer");
        setCustomerPhoneInput(exactMatch.customerPhone || "");

        // Initialize item selection state
        const initialMap: any = {};
        for (const it of exactMatch.items) {
          const eligibleQty = it.quantity - (it.returnedQuantity || 0);
          if (eligibleQty > 0) {
            initialMap[it.productId.toString()] = {
              selected: false,
              quantity: 1,
              maxQuantity: eligibleQty,
              condition: "RESTOCKABLE",
              reason: "Defective / Customer return",
            };
          }
        }
        setSelectedInvoiceItems(initialMap);
      } else {
        alert("Invoice not found. Please verify the invoice number.");
      }
    } catch (err) {
      alert("Error looking up invoice.");
    } finally {
      setLookupLoading(false);
    }
  };

  // Add item to blind items list
  const handleAddBlindItem = (productId: string) => {
    const prod = products.find((p) => p._id === productId);
    if (!prod) return;
    setBlindItems((prev) => [
      ...prev,
      {
        productId: prod._id,
        name: prod.name,
        barcode: prod.barcode,
        unitPrice: prod.sellingPrice,
        quantity: 1,
        condition: "RESTOCKABLE",
        reason: "Customer item return",
      },
    ]);
  };

  // Calculate refund subtotal for draft
  const draftRefundSubtotal = useMemo(() => {
    if (returnType === "INVOICE" && foundSale) {
      let sum = 0;
      for (const item of foundSale.items) {
        const sel = selectedInvoiceItems[item.productId.toString()];
        if (sel && sel.selected) {
          sum += (item.unitPrice || 0) * (sel.quantity || 0);
        }
      }
      return Math.round(sum * 100) / 100;
    } else {
      let sum = 0;
      for (const item of blindItems) {
        sum += (item.unitPrice || 0) * (item.quantity || 0);
      }
      return Math.round(sum * 100) / 100;
    }
  }, [returnType, foundSale, selectedInvoiceItems, blindItems]);

  // Submit return
  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();

    const itemsToSubmit: any[] = [];
    if (returnType === "INVOICE") {
      if (!foundSale) {
        alert("Please search and select a valid invoice first.");
        return;
      }
      for (const item of foundSale.items) {
        const sel = selectedInvoiceItems[item.productId.toString()];
        if (sel && sel.selected && sel.quantity > 0) {
          itemsToSubmit.push({
            productId: item.productId.toString(),
            name: item.name,
            barcode: item.barcode,
            unitPrice: item.unitPrice,
            quantity: sel.quantity,
            condition: sel.condition,
            reason: sel.reason,
          });
        }
      }
    } else {
      for (const item of blindItems) {
        if (item.quantity > 0) {
          itemsToSubmit.push(item);
        }
      }
    }

    if (itemsToSubmit.length === 0) {
      alert("Please select at least one item to return.");
      return;
    }

    if (draftRefundSubtotal <= 0) {
      alert("Total refund amount must be greater than Rs. 0.");
      return;
    }

    setSubmittingReturn(true);
    try {
      const payload = {
        originalSaleId: returnType === "INVOICE" ? foundSale?._id : undefined,
        originalInvoiceNumber: returnType === "INVOICE" ? foundSale?.invoiceNumber : undefined,
        customerId: foundSale?.customerId || undefined,
        customerName: customerNameInput.trim() || "Walk-in Customer",
        customerPhone: customerPhoneInput.trim() || undefined,
        items: itemsToSubmit,
        refundMethod: selectedRefundMethod,
        notes: returnNotes.trim() || undefined,
      };

      const res = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success && data.saleReturn) {
        setStatusMessage({
          type: "success",
          text: `Customer return ${data.saleReturn.returnNumber} processed successfully!`,
        });
        setIsProcessModalOpen(false);
        setActiveReturnSlip(data.saleReturn);
        if (data.creditNote) {
          setActiveCreditNoteSlip(data.creditNote);
        }
        await fetchData();
      } else {
        alert(data.error || "Failed to process customer return.");
      }
    } catch (err: any) {
      alert(err.message || "Failed to communicate with returns service.");
    } finally {
      setSubmittingReturn(false);
    }
  };

  // Cancel Credit Note
  const handleCancelCreditNote = async (note: CreditNoteData) => {
    const confirmReason = prompt(
      `Are you sure you want to cancel Credit Note ${note.creditNoteNumber}? Enter cancellation reason:`
    );
    if (!confirmReason || !confirmReason.trim()) return;

    try {
      const res = await fetch(`/api/credit-notes/${note._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CANCEL", reason: confirmReason.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: "success",
          text: `Credit note ${note.creditNoteNumber} cancelled.`,
        });
        await fetchData();
      } else {
        alert(data.error || "Failed to cancel credit note.");
      }
    } catch (err: any) {
      alert(err.message || "Error cancelling credit note.");
    }
  };

  // Filtered returns
  const filteredReturns = useMemo(() => {
    return returns.filter((r) => {
      const q = searchQuery.toLowerCase();
      const matchesQuery =
        !q ||
        r.returnNumber.toLowerCase().includes(q) ||
        (r.originalInvoiceNumber && r.originalInvoiceNumber.toLowerCase().includes(q)) ||
        r.customerName.toLowerCase().includes(q) ||
        (r.customerPhone && r.customerPhone.includes(q)) ||
        (r.creditNoteNumber && r.creditNoteNumber.toLowerCase().includes(q));

      const matchesMethod =
        refundMethodFilter === "ALL" || r.refundMethod === refundMethodFilter;

      return matchesQuery && matchesMethod;
    });
  }, [returns, searchQuery, refundMethodFilter]);

  // Filtered credit notes
  const filteredCreditNotes = useMemo(() => {
    return creditNotes.filter((cn) => {
      const q = searchQuery.toLowerCase();
      const matchesQuery =
        !q ||
        cn.creditNoteNumber.toLowerCase().includes(q) ||
        cn.customerName.toLowerCase().includes(q) ||
        (cn.customerPhone && cn.customerPhone.includes(q)) ||
        (cn.returnNumber && cn.returnNumber.toLowerCase().includes(q));

      const matchesStatus = statusFilter === "ALL" || cn.status === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [creditNotes, searchQuery, statusFilter]);

  const defaultBusiness = {
    name: business?.name || "SRI LANKA RETAIL POS",
    phone: business?.phone || "011-2345678",
    address: business?.address || "Main Street, Colombo, Sri Lanka",
    receiptSettings: {
      defaultWidth: receiptWidth,
    },
  };

  return (
    <AppLayout>
      <div className="space-y-6 pb-12">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-lg">
                <RotateCcw className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
                Customer Returns & Credit Notes
              </h1>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Process invoice-linked returns, quarantine damaged stock, and manage store credit note vouchers
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2.5 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition border border-zinc-200 dark:border-zinc-700"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => {
                setReturnType("INVOICE");
                setInvoiceLookupQuery("");
                setFoundSale(null);
                setSelectedInvoiceItems({});
                setBlindItems([]);
                setCustomerNameInput("");
                setCustomerPhoneInput("");
                setSelectedRefundMethod("CASH");
                setReturnNotes("");
                setIsProcessModalOpen(true);
              }}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-sm transition active:scale-95 text-sm"
            >
              <Plus className="w-4 h-4" />
              Process Return
            </button>
          </div>
        </div>

        {/* Status Toast */}
        {statusMessage && (
          <div
            className={`p-4 rounded-xl flex items-center justify-between gap-3 text-sm font-medium ${
              statusMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                : "bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 5 KPI Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Returns</span>
              <RotateCcw className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-black text-zinc-900 dark:text-white">
              {returnStats?.totalReturnsCount ?? returns.length}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Processed vouchers</div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Refund Volume</span>
              <DollarSign className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">
              {formatCurrency(returnStats?.totalRefundAmount ?? 0)}
            </div>
            <div className="text-xs text-zinc-500 mt-1">All refund payouts</div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Cash Refunds</span>
              <Receipt className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {formatCurrency(returnStats?.cashRefundsTotal ?? 0)}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Drawer pay-outs</div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Active Vouchers</span>
              <Ticket className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400">
              {formatCurrency(creditNoteStats?.activeBalanceTotal ?? 0)}
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              {creditNoteStats?.activeCount ?? 0} unredeemed notes
            </div>
          </div>

          <div className="col-span-2 md:col-span-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Inventory Status</span>
              <Package className="w-4 h-4 text-teal-500" />
            </div>
            <div className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <span className="text-emerald-600 dark:text-emerald-400">
                +{returnStats?.restockedItemsCount ?? 0} Restocked
              </span>
            </div>
            <div className="text-xs text-rose-500 mt-1">
              {returnStats?.damagedItemsCount ?? 0} Quarantined (Loss)
            </div>
          </div>
        </div>

        {/* Tab Selector & Filter Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-white dark:bg-zinc-900 p-2 rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800/60 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("returns")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs sm:text-sm transition ${
                activeTab === "returns"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              Returns History ({returns.length})
            </button>
            <button
              onClick={() => setActiveTab("creditNotes")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs sm:text-sm transition ${
                activeTab === "creditNotes"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
              }`}
            >
              <Ticket className="w-4 h-4" />
              Credit Notes ({creditNotes.length})
            </button>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 px-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === "returns"
                    ? "Search return #, inv #, name..."
                    : "Search voucher code, customer..."
                }
                className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            {activeTab === "returns" ? (
              <select
                value={refundMethodFilter}
                onChange={(e) => setRefundMethodFilter(e.target.value)}
                className="px-3 py-1.5 text-xs sm:text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="ALL">All Methods</option>
                <option value="CASH">Cash Refund</option>
                <option value="CREDIT_NOTE">Credit Note Voucher</option>
                <option value="CUSTOMER_BALANCE">Naya Potha Credit</option>
              </select>
            ) : (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs sm:text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="FULLY_REDEEMED">Fully Redeemed</option>
                <option value="EXPIRED">Expired</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            )}
          </div>
        </div>

        {/* Tab 1: Returns History Table */}
        {activeTab === "returns" && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800/70 text-zinc-500 dark:text-zinc-400 text-xs uppercase font-semibold border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-4 py-3">Return Slip</th>
                    <th className="px-4 py-3">Original Invoice</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Items & Disposition</th>
                    <th className="px-4 py-3">Refund Method</th>
                    <th className="px-4 py-3 text-right">Refund Total</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-rose-500" />
                        Loading returns records...
                      </td>
                    </tr>
                  ) : filteredReturns.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                        <RotateCcw className="w-8 h-8 mx-auto mb-2 text-zinc-400 stroke-1" />
                        No customer returns found matching your query.
                      </td>
                    </tr>
                  ) : (
                    filteredReturns.map((ret) => (
                      <tr key={ret._id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition">
                        <td className="px-4 py-3">
                          <div className="font-bold text-zinc-900 dark:text-white">
                            {ret.returnNumber}
                          </div>
                          <div className="text-[11px] text-zinc-500">
                            {formatSLDateTime(ret.createdAt)}
                          </div>
                          <div className="text-[10px] text-zinc-400">By {ret.cashierName}</div>
                        </td>

                        <td className="px-4 py-3">
                          {ret.originalInvoiceNumber ? (
                            <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded">
                              {ret.originalInvoiceNumber}
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-400 italic">Blind Return</span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <div className="font-medium text-zinc-900 dark:text-white">
                            {ret.customerName}
                          </div>
                          {ret.customerPhone && (
                            <div className="text-[11px] text-zinc-500">{ret.customerPhone}</div>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <div className="text-xs font-semibold">
                            {ret.items.length} item(s) (
                            {ret.items.reduce((acc, i) => acc + i.quantity, 0)} units)
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {ret.items.some((i) => i.condition === "RESTOCKABLE") && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded">
                                Restocked
                              </span>
                            )}
                            {ret.items.some((i) => i.condition === "DAMAGED") && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 rounded">
                                Damaged
                              </span>
                            )}
                            {ret.items.some((i) => i.condition === "EXPIRED") && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 rounded">
                                Expired
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          {ret.refundMethod === "CASH" && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-800">
                              <Receipt className="w-3 h-3" /> Cash
                            </span>
                          )}
                          {ret.refundMethod === "CREDIT_NOTE" && (
                            <div>
                              <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 rounded-lg border border-indigo-200 dark:border-indigo-800">
                                <Ticket className="w-3 h-3" /> Credit Note
                              </span>
                              {ret.creditNoteNumber && (
                                <div className="font-mono text-[10px] text-zinc-500 mt-0.5">
                                  {ret.creditNoteNumber}
                                </div>
                              )}
                            </div>
                          )}
                          {ret.refundMethod === "CUSTOMER_BALANCE" && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 rounded-lg border border-sky-200 dark:border-sky-800">
                              <Building2 className="w-3 h-3" /> Naya Potha
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <div className="font-black text-rose-600 dark:text-rose-400 text-sm">
                            {formatCurrency(ret.netRefundTotal)}
                          </div>
                          {ret.pointsDeducted && ret.pointsDeducted > 0 ? (
                            <div className="text-[10px] text-amber-600">
                              -{ret.pointsDeducted} pts reversed
                            </div>
                          ) : null}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setActiveReturnSlip(ret)}
                            className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg transition"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Slip
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Store Credit Vouchers Table */}
        {activeTab === "creditNotes" && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800/70 text-zinc-500 dark:text-zinc-400 text-xs uppercase font-semibold border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-4 py-3">Voucher Code</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Issued From</th>
                    <th className="px-4 py-3 text-right">Initial Value</th>
                    <th className="px-4 py-3 text-right">Remaining Balance</th>
                    <th className="px-4 py-3">Validity & Status</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                        Loading credit note vouchers...
                      </td>
                    </tr>
                  ) : filteredCreditNotes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                        <Ticket className="w-8 h-8 mx-auto mb-2 text-zinc-400 stroke-1" />
                        No store credit vouchers found.
                      </td>
                    </tr>
                  ) : (
                    filteredCreditNotes.map((cn) => {
                      const isExpired =
                        cn.status === "EXPIRED" || new Date(cn.expiryDate) < new Date();
                      return (
                        <tr
                          key={cn._id}
                          className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition"
                        >
                          <td className="px-4 py-3">
                            <div className="font-mono font-bold text-sm text-indigo-600 dark:text-indigo-400">
                              {cn.creditNoteNumber}
                            </div>
                            <div className="text-[11px] text-zinc-500">
                              Issued: {formatSLDateTime(cn.createdAt)}
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <div className="font-medium text-zinc-900 dark:text-white">
                              {cn.customerName}
                            </div>
                            {cn.customerPhone && (
                              <div className="text-[11px] text-zinc-500">{cn.customerPhone}</div>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {cn.returnNumber ? (
                              <span className="font-mono text-xs px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded">
                                {cn.returnNumber}
                              </span>
                            ) : (
                              <span className="text-xs text-zinc-400 italic">Direct Issue</span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right font-medium">
                            {formatCurrency(cn.initialAmount)}
                          </td>

                          <td className="px-4 py-3 text-right">
                            <div className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(cn.remainingBalance)}
                            </div>
                            {cn.redemptions && cn.redemptions.length > 0 && (
                              <div className="text-[10px] text-zinc-500">
                                {cn.redemptions.length} redemption(s)
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <div>
                              {cn.status === "ACTIVE" && !isExpired && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded-full">
                                  <CheckCircle2 className="w-3 h-3" /> ACTIVE
                                </span>
                              )}
                              {cn.status === "FULLY_REDEEMED" && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-full">
                                  REDEEMED
                                </span>
                              )}
                              {(cn.status === "EXPIRED" || isExpired) &&
                                cn.status !== "FULLY_REDEEMED" &&
                                cn.status !== "CANCELLED" && (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 rounded-full">
                                    <Clock className="w-3 h-3" /> EXPIRED
                                  </span>
                                )}
                              {cn.status === "CANCELLED" && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 rounded-full">
                                  <Ban className="w-3 h-3" /> CANCELLED
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-zinc-400 mt-1">
                              Valid until {new Date(cn.expiryDate).toLocaleDateString()}
                            </div>
                          </td>

                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setActiveCreditNoteSlip(cn)}
                                className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg transition"
                                title="Print Voucher Slip"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              {cn.status === "ACTIVE" && cn.remainingBalance > 0 && (
                                <button
                                  onClick={() => handleCancelCreditNote(cn)}
                                  className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 rounded-lg transition"
                                  title="Cancel Voucher"
                                >
                                  <Ban className="w-3.5 h-3.5" />
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
        )}

        {/* Process Return Modal */}
        {isProcessModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-3xl my-8 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-rose-100 dark:bg-rose-950/40 text-rose-600 rounded-lg">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                      Process Customer Return
                    </h2>
                    <p className="text-xs text-zinc-500">
                      Issue refunds, restock or quarantine items, and generate credit vouchers
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsProcessModalOpen(false)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleSubmitReturn} className="p-5 overflow-y-auto space-y-5 flex-1">
                {/* Return Type Selector */}
                <div className="grid grid-cols-2 gap-2 bg-zinc-100 dark:bg-zinc-800/60 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setReturnType("INVOICE")}
                    className={`py-2 text-xs sm:text-sm font-bold rounded-lg transition ${
                      returnType === "INVOICE"
                        ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm"
                        : "text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    1. Invoice-Linked Return (Recommended)
                  </button>
                  <button
                    type="button"
                    onClick={() => setReturnType("BLIND")}
                    className={`py-2 text-xs sm:text-sm font-bold rounded-lg transition ${
                      returnType === "BLIND"
                        ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm"
                        : "text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    2. Blind / Manual Return
                  </button>
                </div>

                {/* Step 1: Invoice Lookup (if INVOICE mode) */}
                {returnType === "INVOICE" ? (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={invoiceLookupQuery}
                          onChange={(e) => setInvoiceLookupQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleLookupInvoice();
                            }
                          }}
                          placeholder="Enter invoice number, e.g. INV-2026-00001"
                          className="w-full pl-9 pr-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:ring-2 focus:ring-rose-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleLookupInvoice}
                        disabled={lookupLoading}
                        className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white font-bold rounded-xl text-xs transition"
                      >
                        {lookupLoading ? "Searching..." : "Lookup Invoice"}
                      </button>
                    </div>

                    {foundSale && (
                      <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs space-y-1">
                        <div className="flex justify-between font-bold text-zinc-900 dark:text-white">
                          <span>Invoice: {foundSale.invoiceNumber}</span>
                          <span className="text-emerald-600">
                            Total Paid: {formatCurrency(foundSale.netTotal)}
                          </span>
                        </div>
                        <div className="flex justify-between text-zinc-500">
                          <span>Customer: {foundSale.customerName}</span>
                          <span>Date: {formatSLDateTime(foundSale.createdAt)}</span>
                        </div>
                        {foundSale.returnStatus && foundSale.returnStatus !== "NONE" && (
                          <div className="text-amber-600 font-semibold pt-1">
                            Status: {foundSale.returnStatus} (Already returned:{" "}
                            {formatCurrency(foundSale.returnedTotal || 0)})
                          </div>
                        )}
                      </div>
                    )}

                    {/* Invoice items to return */}
                    {foundSale && (
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                          Select Items To Return
                        </label>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                          {foundSale.items.map((item: any) => {
                            const pid = item.productId.toString();
                            const sel = selectedInvoiceItems[pid];
                            const eligibleQty = item.quantity - (item.returnedQuantity || 0);

                            if (eligibleQty <= 0) {
                              return (
                                <div
                                  key={pid}
                                  className="p-2.5 bg-zinc-100 dark:bg-zinc-800/30 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-400 flex justify-between items-center"
                                >
                                  <span>{item.name}</span>
                                  <span className="italic">Fully Returned</span>
                                </div>
                              );
                            }

                            return (
                              <div
                                key={pid}
                                className={`p-3 rounded-xl border transition ${
                                  sel?.selected
                                    ? "bg-rose-50/40 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800"
                                    : "bg-white dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={sel?.selected || false}
                                      onChange={(e) => {
                                        setSelectedInvoiceItems((prev) => ({
                                          ...prev,
                                          [pid]: {
                                            ...prev[pid],
                                            selected: e.target.checked,
                                          },
                                        }));
                                      }}
                                      className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                                    />
                                    <div>
                                      <span className="font-bold text-xs text-zinc-900 dark:text-white">
                                        {item.name}
                                      </span>
                                      <span className="text-[11px] text-zinc-500 ml-2">
                                        ({formatCurrency(item.unitPrice)} each)
                                      </span>
                                    </div>
                                  </label>

                                  <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                                    Available: {eligibleQty}
                                  </span>
                                </div>

                                {sel?.selected && (
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 pt-2 border-t border-dashed border-zinc-200 dark:border-zinc-700 text-xs">
                                    <div>
                                      <span className="text-[10px] text-zinc-500 block mb-1">
                                        Quantity to Return
                                      </span>
                                      <input
                                        type="number"
                                        min={1}
                                        max={eligibleQty}
                                        value={sel.quantity}
                                        onChange={(e) => {
                                          const val = Math.min(
                                            eligibleQty,
                                            Math.max(1, parseInt(e.target.value, 10) || 1)
                                          );
                                          setSelectedInvoiceItems((prev) => ({
                                            ...prev,
                                            [pid]: { ...prev[pid], quantity: val },
                                          }));
                                        }}
                                        className="w-full px-2 py-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded-lg text-xs"
                                      />
                                    </div>

                                    <div>
                                      <span className="text-[10px] text-zinc-500 block mb-1">
                                        Item Condition
                                      </span>
                                      <select
                                        value={sel.condition}
                                        onChange={(e) => {
                                          setSelectedInvoiceItems((prev) => ({
                                            ...prev,
                                            [pid]: {
                                              ...prev[pid],
                                              condition: e.target.value as any,
                                            },
                                          }));
                                        }}
                                        className="w-full px-2 py-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded-lg text-xs"
                                      >
                                        <option value="RESTOCKABLE">Restockable (Put Back)</option>
                                        <option value="DAMAGED">Damaged (Quarantine Loss)</option>
                                        <option value="EXPIRED">Expired (Quarantine Loss)</option>
                                      </select>
                                    </div>

                                    <div>
                                      <span className="text-[10px] text-zinc-500 block mb-1">
                                        Reason
                                      </span>
                                      <input
                                        type="text"
                                        value={sel.reason}
                                        onChange={(e) => {
                                          setSelectedInvoiceItems((prev) => ({
                                            ...prev,
                                            [pid]: { ...prev[pid], reason: e.target.value },
                                          }));
                                        }}
                                        placeholder="e.g. Wrong item / Defective"
                                        className="w-full px-2 py-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded-lg text-xs"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Step 1: Blind Return Catalog Picker */
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAddBlindItem(e.target.value);
                            e.target.value = "";
                          }
                        }}
                        className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:ring-2 focus:ring-rose-500"
                      >
                        <option value="">+ Add Product from Store Inventory...</option>
                        {products.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.name} ({p.barcode || "No Barcode"}) - {formatCurrency(p.sellingPrice)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {blindItems.length === 0 ? (
                        <div className="p-4 text-center text-xs text-zinc-400 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl">
                          Select a product from the dropdown above to add to this return.
                        </div>
                      ) : (
                        blindItems.map((item, idx) => (
                          <div
                            key={idx}
                            className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-2 text-xs"
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-zinc-900 dark:text-white">
                                {item.name}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setBlindItems((prev) => prev.filter((_, i) => i !== idx))
                                }
                                className="text-rose-500 hover:text-rose-700"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              <div>
                                <span className="text-[10px] text-zinc-500 block mb-1">Unit Price</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={item.unitPrice}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setBlindItems((prev) =>
                                      prev.map((it, i) => (i === idx ? { ...it, unitPrice: val } : it))
                                    );
                                  }}
                                  className="w-full px-2 py-1 bg-white dark:bg-zinc-900 border rounded-lg text-xs"
                                />
                              </div>
                              <div>
                                <span className="text-[10px] text-zinc-500 block mb-1">Quantity</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={item.quantity}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10) || 1;
                                    setBlindItems((prev) =>
                                      prev.map((it, i) => (i === idx ? { ...it, quantity: val } : it))
                                    );
                                  }}
                                  className="w-full px-2 py-1 bg-white dark:bg-zinc-900 border rounded-lg text-xs"
                                />
                              </div>
                              <div>
                                <span className="text-[10px] text-zinc-500 block mb-1">Condition</span>
                                <select
                                  value={item.condition}
                                  onChange={(e) => {
                                    const val = e.target.value as any;
                                    setBlindItems((prev) =>
                                      prev.map((it, i) => (i === idx ? { ...it, condition: val } : it))
                                    );
                                  }}
                                  className="w-full px-2 py-1 bg-white dark:bg-zinc-900 border rounded-lg text-xs"
                                >
                                  <option value="RESTOCKABLE">Restockable</option>
                                  <option value="DAMAGED">Damaged</option>
                                  <option value="EXPIRED">Expired</option>
                                </select>
                              </div>
                              <div>
                                <span className="text-[10px] text-zinc-500 block mb-1">Reason</span>
                                <input
                                  type="text"
                                  value={item.reason}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setBlindItems((prev) =>
                                      prev.map((it, i) => (i === idx ? { ...it, reason: val } : it))
                                    );
                                  }}
                                  className="w-full px-2 py-1 bg-white dark:bg-zinc-900 border rounded-lg text-xs"
                                />
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Step 2: Customer Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                  <div>
                    <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 block mb-1">
                      Customer Name
                    </label>
                    <input
                      type="text"
                      value={customerNameInput}
                      onChange={(e) => setCustomerNameInput(e.target.value)}
                      placeholder="Walk-in Customer"
                      className="w-full px-3 py-1.5 text-xs sm:text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 block mb-1">
                      Customer Phone (Sri Lanka)
                    </label>
                    <input
                      type="text"
                      value={customerPhoneInput}
                      onChange={(e) => setCustomerPhoneInput(e.target.value)}
                      placeholder="07X XXXXXXX"
                      className="w-full px-3 py-1.5 text-xs sm:text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl"
                    />
                  </div>
                </div>

                {/* Step 3: Refund Method Selection */}
                <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                    Select Refund Method
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedRefundMethod("CASH")}
                      className={`p-3 rounded-xl border text-left transition ${
                        selectedRefundMethod === "CASH"
                          ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-300 ring-2 ring-emerald-500/20"
                          : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-xs mb-1">
                        <Receipt className="w-4 h-4 text-emerald-600" /> Cash Refund
                      </div>
                      <p className="text-[11px] text-zinc-500">
                        Deducted from active drawer float as a Pay-Out
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedRefundMethod("CREDIT_NOTE")}
                      className={`p-3 rounded-xl border text-left transition ${
                        selectedRefundMethod === "CREDIT_NOTE"
                          ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-900 dark:text-indigo-300 ring-2 ring-indigo-500/20"
                          : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-xs mb-1">
                        <Ticket className="w-4 h-4 text-indigo-600" /> Store Credit Voucher
                      </div>
                      <p className="text-[11px] text-zinc-500">
                        Generates a 30-day voucher code (CN-...) redeemable at POS
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedRefundMethod("CUSTOMER_BALANCE")}
                      className={`p-3 rounded-xl border text-left transition ${
                        selectedRefundMethod === "CUSTOMER_BALANCE"
                          ? "bg-sky-50 dark:bg-sky-950/40 border-sky-500 text-sky-900 dark:text-sky-300 ring-2 ring-sky-500/20"
                          : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-xs mb-1">
                        <Building2 className="w-4 h-4 text-sky-600" /> Naya Potha Credit
                      </div>
                      <p className="text-[11px] text-zinc-500">
                        Credits customer account directly (reduces credit due)
                      </p>
                    </button>
                  </div>
                </div>

                {/* Return Notes */}
                <div>
                  <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 block mb-1">
                    Return Notes / Reason Summary
                  </label>
                  <input
                    type="text"
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    placeholder="e.g. Approved by Store Manager / Packaging intact"
                    className="w-full px-3 py-1.5 text-xs sm:text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl"
                  />
                </div>

                {/* Refund Total Summary Banner */}
                <div className="p-4 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-zinc-500 uppercase">
                      Total Refund Payable
                    </span>
                    <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
                      {formatCurrency(draftRefundSubtotal)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsProcessModalOpen(false)}
                      className="px-4 py-2 text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingReturn || draftRefundSubtotal <= 0}
                      className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition active:scale-95 flex items-center gap-2"
                    >
                      {submittingReturn ? "Processing..." : "Confirm & Issue Return"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Printable Return Slip Receipt */}
        {activeReturnSlip && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md my-8 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2 font-bold text-sm text-zinc-900 dark:text-white">
                  <Printer className="w-4 h-4 text-rose-600" />
                  Thermal Return Slip ({receiptWidth})
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={receiptWidth}
                    onChange={(e) => setReceiptWidth(e.target.value as any)}
                    className="text-xs px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700"
                  >
                    <option value="58mm">58mm</option>
                    <option value="80mm">80mm</option>
                  </select>
                  <button
                    onClick={() => setActiveReturnSlip(null)}
                    className="p-1 text-zinc-400 hover:text-zinc-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-4 overflow-y-auto bg-zinc-100 dark:bg-zinc-950 flex-1">
                <ReturnSlipReceipt
                  business={defaultBusiness}
                  saleReturn={activeReturnSlip}
                  width={receiptWidth}
                />
              </div>

              <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-2 bg-white dark:bg-zinc-900">
                <button
                  onClick={() => setActiveReturnSlip(null)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"
                >
                  Close
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Return Slip
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Printable Store Credit Note Receipt */}
        {activeCreditNoteSlip && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md my-8 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2 font-bold text-sm text-zinc-900 dark:text-white">
                  <Ticket className="w-4 h-4 text-indigo-600" />
                  Store Credit Voucher Slip ({receiptWidth})
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={receiptWidth}
                    onChange={(e) => setReceiptWidth(e.target.value as any)}
                    className="text-xs px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700"
                  >
                    <option value="58mm">58mm</option>
                    <option value="80mm">80mm</option>
                  </select>
                  <button
                    onClick={() => setActiveCreditNoteSlip(null)}
                    className="p-1 text-zinc-400 hover:text-zinc-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-4 overflow-y-auto bg-zinc-100 dark:bg-zinc-950 flex-1">
                <CreditNoteReceipt
                  business={defaultBusiness}
                  creditNote={activeCreditNoteSlip}
                  width={receiptWidth}
                />
              </div>

              <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-2 bg-white dark:bg-zinc-900">
                <button
                  onClick={() => setActiveCreditNoteSlip(null)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"
                >
                  Close
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Voucher
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
