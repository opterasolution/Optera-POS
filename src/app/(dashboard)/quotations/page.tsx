"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import {
  FileSpreadsheet,
  FileText,
  Plus,
  Search,
  Filter,
  Printer,
  Calendar,
  Building,
  CheckCircle2,
  Clock,
  AlertCircle,
  CreditCard,
  DollarSign,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Landmark,
  ShieldCheck,
  Eye,
  Check,
  X,
  FileCheck,
  Percent,
  Trash2,
  HelpCircle,
  Package,
} from "lucide-react";
import { formatCurrency, formatSLDateTime, amountToWords } from "@/lib/formatters";
import CommercialQuotationA4, { QuotationPrintData } from "@/components/receipts/CommercialQuotationA4";

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>({
    activeCount: 0,
    activeValue: 0,
    convertedCount: 0,
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateRange, setDateRange] = useState("all");

  // Business profile for headers & tax calculations
  const [businessProfile, setBusinessProfile] = useState<any>(null);

  // Products catalog for line items creation
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedQuoteForPrint, setSelectedQuoteForPrint] = useState<any | null>(null);
  const [quoteToConvert, setQuoteToConvert] = useState<any | null>(null);
  const [convertSuccessData, setConvertSuccessData] = useState<{
    invoiceNumber: string;
    saleId: string;
    quotationNumber: string;
  } | null>(null);

  // Form State: Create Quotation
  const [createForm, setCreateForm] = useState({
    customerId: "",
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    companyName: "",
    tin: "",
    vatNumber: "",
    address: "",
    discountTotal: 0,
    applySscl: false,
    applyVat: false,
    validityDays: 14,
    validUntil: "",
    notes: "",
  });

  const [quoteItems, setQuoteItems] = useState<
    Array<{
      productId: string;
      name: string;
      barcode?: string;
      unitPrice: number;
      costPrice: number;
      stockQuantity: number;
      unit: string;
      quantity: number;
      discount: number;
      priceTier: "RETAIL" | "WHOLESALE";
    }>
  >([]);

  const [itemSearch, setItemSearch] = useState("");
  const [submittingQuote, setSubmittingQuote] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Form State: Convert to Invoice
  const [convertForm, setConvertForm] = useState({
    paymentMethod: "BANK_TRANSFER",
    cashReceived: "",
    dueDate: "",
    paymentReference: "",
    notes: "",
  });
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);

  // Customer search autocomplete
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [customerSearchResults, setCustomerSearchResults] = useState<any[]>([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);

  // Load Initial Data
  const loadQuotations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      if (statusFilter && statusFilter !== "ALL") params.set("status", statusFilter);
      if (dateRange && dateRange !== "all") params.set("dateRange", dateRange);

      const res = await fetch(`/api/quotations?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setQuotations(data.quotations || []);
        if (data.summary) setSummary(data.summary);
      }
    } catch (err) {
      console.error("Failed to load quotations:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadMeta = async () => {
    try {
      const [bizRes, prodRes] = await Promise.all([
        fetch("/api/business"),
        fetch("/api/products?limit=300"),
      ]);
      const bizData = await bizRes.json();
      const prodData = await prodRes.json();

      if (bizData?.success && bizData.business) {
        setBusinessProfile(bizData.business);
      }
      if (prodData?.success && prodData.products) {
        setCatalogProducts(prodData.products);
      }
    } catch (err) {
      console.error("Failed to load meta for quotations:", err);
    }
  };

  useEffect(() => {
    loadQuotations();
    loadMeta();
  }, []);

  useEffect(() => {
    loadQuotations();
  }, [statusFilter, dateRange]);

  // Customer Search for quote auto-fill
  useEffect(() => {
    const q = customerSearchQuery.trim();
    if (q.length >= 3) {
      setSearchingCustomers(true);
      fetch(`/api/customers?q=${encodeURIComponent(q)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) setCustomerSearchResults(data.customers || []);
        })
        .catch(() => setCustomerSearchResults([]))
        .finally(() => setSearchingCustomers(false));
    } else {
      setCustomerSearchResults([]);
    }
  }, [customerSearchQuery]);

  // Add Item to Quotation
  const handleAddItemToQuote = (product: any) => {
    const existingIndex = quoteItems.findIndex((it) => it.productId === product._id);
    if (existingIndex > -1) {
      const updated = [...quoteItems];
      updated[existingIndex].quantity += 1;
      setQuoteItems(updated);
      return;
    }

    const defaultPrice =
      product.wholesalePrice && product.wholesalePrice > 0
        ? product.wholesalePrice
        : product.sellingPrice;

    setQuoteItems((prev) => [
      ...prev,
      {
        productId: product._id,
        name: product.name,
        barcode: product.barcode,
        unitPrice: defaultPrice,
        costPrice: product.costPrice || 0,
        stockQuantity: product.stockQuantity || 0,
        unit: product.unit || "pcs",
        quantity: 1,
        discount: 0,
        priceTier: product.wholesalePrice && product.wholesalePrice > 0 ? "WHOLESALE" : "RETAIL",
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setQuoteItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateItem = (index: number, field: string, value: any) => {
    setQuoteItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === "priceTier") {
        const prod = catalogProducts.find((p) => p._id === updated[index].productId);
        if (prod) {
          if (value === "WHOLESALE" && prod.wholesalePrice && prod.wholesalePrice > 0) {
            updated[index].unitPrice = prod.wholesalePrice;
          } else {
            updated[index].unitPrice = prod.sellingPrice;
          }
        }
      }
      return updated;
    });
  };

  // Financial Computations for Quote Creation
  const quoteSubtotal = quoteItems.reduce((sum, it) => {
    const lineSubtotal = it.unitPrice * it.quantity;
    const lineDiscount = it.discount || 0;
    return sum + Math.max(0, lineSubtotal - lineDiscount);
  }, 0);

  const quoteTaxable = Math.max(0, quoteSubtotal - (createForm.discountTotal || 0));
  const quoteSscl = createForm.applySscl
    ? Math.round(((quoteTaxable * (businessProfile?.taxSettings?.ssclRate || 2.5)) / 100) * 100) / 100
    : 0;
  const quoteVat = createForm.applyVat
    ? Math.round((((quoteTaxable + quoteSscl) * (businessProfile?.taxSettings?.rate || 18)) / 100) * 100) / 100
    : 0;
  const quoteTaxesTotal = Math.round((quoteSscl + quoteVat) * 100) / 100;
  const quoteNetTotal = Math.round((quoteTaxable + quoteTaxesTotal) * 100) / 100;

  // Submit New Quotation
  const handleCreateQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.customerName.trim()) {
      setCreateError("Customer or business recipient name is required.");
      return;
    }
    if (quoteItems.length === 0) {
      setCreateError("Please add at least one line item to this quotation.");
      return;
    }

    setSubmittingQuote(true);
    setCreateError(null);

    try {
      const validUntilDate = createForm.validUntil
        ? new Date(createForm.validUntil).toISOString()
        : new Date(Date.now() + (createForm.validityDays || 14) * 24 * 60 * 60 * 1000).toISOString();

      const payload = {
        customerId: createForm.customerId || undefined,
        customerName: createForm.customerName.trim(),
        customerPhone: createForm.customerPhone.trim() || undefined,
        customerEmail: createForm.customerEmail.trim() || undefined,
        companyName: createForm.companyName.trim() || undefined,
        tin: createForm.tin.trim() || undefined,
        vatNumber: createForm.vatNumber.trim() || undefined,
        address: createForm.address.trim() || undefined,
        items: quoteItems.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discount: it.discount,
          priceTier: it.priceTier,
        })),
        discountTotal: createForm.discountTotal || 0,
        applySscl: createForm.applySscl,
        applyVat: createForm.applyVat,
        validUntil: validUntilDate,
        notes: createForm.notes.trim() || undefined,
      };

      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setIsCreateModalOpen(false);
        setQuoteItems([]);
        setCreateForm({
          customerId: "",
          customerName: "",
          customerPhone: "",
          customerEmail: "",
          companyName: "",
          tin: "",
          vatNumber: "",
          address: "",
          discountTotal: 0,
          applySscl: false,
          applyVat: false,
          validityDays: 14,
          validUntil: "",
          notes: "",
        });
        loadQuotations();
        setSelectedQuoteForPrint(data.quotation);
      } else {
        setCreateError(data.error || "Failed to create quotation.");
      }
    } catch (err: any) {
      setCreateError(err.message || "Failed to submit quotation.");
    } finally {
      setSubmittingQuote(false);
    }
  };

  // Convert Quotation to Tax Invoice
  const handleConvertQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteToConvert) return;

    setConverting(true);
    setConvertError(null);

    try {
      const res = await fetch(`/api/quotations/${quoteToConvert._id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod: convertForm.paymentMethod,
          cashReceived:
            convertForm.paymentMethod === "CASH"
              ? parseFloat(convertForm.cashReceived) || quoteToConvert.netTotal
              : undefined,
          dueDate: convertForm.paymentMethod === "CREDIT" ? convertForm.dueDate || undefined : undefined,
          paymentReference: convertForm.paymentReference.trim() || undefined,
          notes: convertForm.notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setConvertSuccessData({
          invoiceNumber: data.invoiceNumber,
          saleId: data.sale?._id,
          quotationNumber: quoteToConvert.quotationNumber,
        });
        setQuoteToConvert(null);
        loadQuotations();
      } else {
        setConvertError(data.error || "Failed to convert quotation to tax invoice.");
      }
    } catch (err: any) {
      setConvertError(err.message || "Error converting quotation.");
    } finally {
      setConverting(false);
    }
  };

  // Fast Status Transition
  const handleStatusChange = async (quoteId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/quotations/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        loadQuotations();
      } else {
        alert(data.error || "Failed to update quotation status.");
      }
    } catch {
      alert("Error communicating with quotation service.");
    }
  };

  // Delete Quotation
  const handleDeleteQuotation = async (quoteId: string, quoteNumber: string) => {
    if (!confirm(`Are you sure you want to delete quotation "${quoteNumber}"? This cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/quotations/${quoteId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        loadQuotations();
      } else {
        alert(data.error || "Failed to delete quotation.");
      }
    } catch {
      alert("Network error deleting quotation.");
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-sm">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Commercial Quotations & Estimates
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Issue professional pro-forma estimates, negotiate B2B orders, print formal A4 quotations, and convert seamlessly to official Tax Invoices.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadQuotations}
              className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition"
              title="Refresh Quotations"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-purple-600" : ""}`} />
            </button>
            <button
              onClick={() => {
                setIsCreateModalOpen(true);
                setCreateError(null);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Create Quotation</span>
            </button>
          </div>
        </div>

        {/* 4 Financial KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Active Quotations
              </span>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {summary.activeCount || 0} Open
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Pending acceptance or conversion
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Quoted Pipeline Value
              </span>
              <div className="text-2xl font-black text-purple-700 mt-1">
                {formatCurrency(summary.activeValue || 0)}
              </div>
              <span className="text-[10px] text-purple-600 font-semibold mt-0.5 block">
                Potential wholesale revenue
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Converted to Invoices
              </span>
              <div className="text-2xl font-black text-emerald-700 mt-1">
                {summary.convertedCount || 0} Completed
              </div>
              <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 block">
                Successfully billed sales
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Conversion Rate
              </span>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {(() => {
                  const total = (summary.activeCount || 0) + (summary.convertedCount || 0);
                  if (total === 0) return "0.0%";
                  return `${(((summary.convertedCount || 0) / total) * 100).toFixed(1)}%`;
                })()}
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Quote to cash conversion
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700">
              <Percent className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Directory Card */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          {/* Filters Bar */}
          <div className="p-4 sm:p-5 border-b border-slate-100 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="relative sm:col-span-2">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search Quote #, Customer Name, Company Name, TIN, Phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") loadQuotations();
                  }}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="DRAFT">Draft</option>
                  <option value="SENT">Sent to Client</option>
                  <option value="ACCEPTED">Accepted</option>
                  <option value="CONVERTED">Converted to Invoice</option>
                  <option value="EXPIRED">Expired</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>

              <div>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">All Dates</option>
                  <option value="today">Created Today</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                </select>
              </div>
            </div>
          </div>

          {/* Quotations Table */}
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-purple-600 mb-2" />
              Loading customer quotations...
            </div>
          ) : quotations.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs space-y-2">
              <FileSpreadsheet className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-600">No quotations found.</p>
              <p className="text-[11px] text-slate-400">
                Click "Create Quotation" to draft your first estimate or adjust your search filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                    <th className="py-3 px-4">Quotation #</th>
                    <th className="py-3 px-4">Date & Validity</th>
                    <th className="py-3 px-4">Customer / Organization</th>
                    <th className="py-3 px-4">Items</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Taxable Base</th>
                    <th className="py-3 px-4 text-right">Taxes (SSCL/VAT)</th>
                    <th className="py-3 px-4 text-right">Estimated Total</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {quotations.map((qt) => {
                    const isExpired = new Date(qt.validUntil) < new Date();
                    const isConverted = qt.status === "CONVERTED";
                    const taxable = qt.taxBreakdown?.taxableAmount || qt.subtotal;
                    const taxes = (qt.taxBreakdown?.ssclAmount || 0) + (qt.taxBreakdown?.vatAmount || 0);

                    return (
                      <tr key={qt._id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {qt.quotationNumber}
                          {qt.convertedInvoiceNumber && (
                            <div className="text-[10px] text-emerald-700 font-semibold">
                              Inv: {qt.convertedInvoiceNumber}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap text-[11px]">
                          <div>
                            {new Date(qt.createdAt).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                          <div
                            className={`text-[10px] ${
                              isExpired && !isConverted ? "text-rose-600 font-bold" : "text-slate-400"
                            }`}
                          >
                            Valid:{" "}
                            {new Date(qt.validUntil).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                            })}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">
                            {qt.companyName || qt.customerName}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {qt.customerPhone || "—"}
                            {qt.tin ? ` • TIN: ${qt.tin}` : ""}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                          {qt.items?.length || 0} line(s)
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              isConverted
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : isExpired
                                ? "bg-rose-100 text-rose-800 border border-rose-300"
                                : qt.status === "ACCEPTED"
                                ? "bg-blue-100 text-blue-800 border border-blue-300"
                                : qt.status === "SENT"
                                ? "bg-indigo-100 text-indigo-800 border border-indigo-300"
                                : qt.status === "REJECTED"
                                ? "bg-slate-200 text-slate-700 border border-slate-300"
                                : "bg-purple-100 text-purple-800 border border-purple-300"
                            }`}
                          >
                            {isConverted ? "CONVERTED" : isExpired ? "EXPIRED" : qt.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600">
                          {formatCurrency(taxable)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-blue-700 font-semibold">
                          {formatCurrency(taxes)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(qt.netTotal)}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedQuoteForPrint(qt)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold transition"
                              title="Print Formal A4 Quotation"
                            >
                              <Printer className="w-3 h-3" />
                              <span>Print A4</span>
                            </button>

                            {!isConverted && (
                              <button
                                type="button"
                                onClick={() => {
                                  setQuoteToConvert(qt);
                                  setConvertForm({
                                    paymentMethod: "BANK_TRANSFER",
                                    cashReceived: "",
                                    dueDate: "",
                                    paymentReference: "",
                                    notes: "",
                                  });
                                  setConvertError(null);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition shadow-sm"
                                title="Convert to Official Tax Invoice"
                              >
                                <span>Convert</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}

                            {!isConverted && (
                              <select
                                value={qt.status}
                                onChange={(e) => handleStatusChange(qt._id, e.target.value)}
                                className="px-2 py-1 text-[11px] border border-slate-200 rounded-lg bg-white text-slate-700 font-medium"
                                title="Change Status"
                              >
                                <option value="DRAFT">Draft</option>
                                <option value="SENT">Sent</option>
                                <option value="ACCEPTED">Accepted</option>
                                <option value="REJECTED">Rejected</option>
                              </select>
                            )}

                            {!isConverted && (
                              <button
                                type="button"
                                onClick={() => handleDeleteQuotation(qt._id, qt.quotationNumber)}
                                className="p-1 text-slate-400 hover:text-rose-600 transition rounded"
                                title="Delete Quotation"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: CREATE COMMERCIAL QUOTATION                      */}
      {/* ======================================================== */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[95vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-purple-400" />
                <div>
                  <h2 className="text-base font-bold">Draft Commercial Quotation / Pro-Forma Estimate</h2>
                  <p className="text-xs text-slate-400">
                    B2B wholesale pricing, custom line items, and Sri Lanka IRD Tax itemization
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <form onSubmit={handleCreateQuotation} className="overflow-y-auto p-6 space-y-6 flex-1 text-xs">
              {createError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{createError}</span>
                </div>
              )}

              {/* 1. Customer Details Section */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Building className="w-4 h-4 text-purple-600" />
                    Customer / Recipient Organization Details
                  </span>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Lookup existing customer..."
                      value={customerSearchQuery}
                      onChange={(e) => setCustomerSearchQuery(e.target.value)}
                      className="px-2.5 py-1 text-[11px] border border-slate-300 rounded-lg bg-white w-48 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                    {customerSearchResults.length > 0 && (
                      <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-lg z-30 max-h-48 overflow-y-auto divide-y divide-slate-100">
                        {customerSearchResults.map((c) => (
                          <button
                            key={c._id}
                            type="button"
                            onClick={() => {
                              setCreateForm((prev) => ({
                                ...prev,
                                customerId: c._id,
                                customerName: c.name,
                                customerPhone: c.phone || "",
                                customerEmail: c.email || "",
                                companyName: c.companyName || "",
                                tin: c.tin || "",
                                vatNumber: c.vatNumber || "",
                                address: c.address || "",
                              }));
                              setCustomerSearchResults([]);
                              setCustomerSearchQuery("");
                            }}
                            className="w-full p-2 text-left hover:bg-purple-50 transition text-[11px]"
                          >
                            <div className="font-bold text-slate-900">{c.name}</div>
                            <div className="text-slate-500 font-mono text-[10px]">
                              {c.phone} {c.companyName ? `• ${c.companyName}` : ""}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">
                      Customer / Contact Person *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Priyantha Silva"
                      value={createForm.customerName}
                      onChange={(e) => setCreateForm({ ...createForm, customerName: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">
                      Company / Organization Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Lanka Wholesale Traders Ltd"
                      value={createForm.companyName}
                      onChange={(e) => setCreateForm({ ...createForm, companyName: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">Phone Number</label>
                    <input
                      type="text"
                      placeholder="07XXXXXXXX"
                      value={createForm.customerPhone}
                      onChange={(e) => setCreateForm({ ...createForm, customerPhone: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      placeholder="purchasing@company.lk"
                      value={createForm.customerEmail}
                      onChange={(e) => setCreateForm({ ...createForm, customerEmail: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">Customer TIN</label>
                    <input
                      type="text"
                      placeholder="1XXXXXXXX"
                      value={createForm.tin}
                      onChange={(e) => setCreateForm({ ...createForm, tin: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">Customer VAT Number</label>
                    <input
                      type="text"
                      placeholder="VXXXXXXXX"
                      value={createForm.vatNumber}
                      onChange={(e) => setCreateForm({ ...createForm, vatNumber: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div className="sm:col-span-2 md:col-span-3">
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">Delivery / Billing Address</label>
                    <input
                      type="text"
                      placeholder="e.g. 142/A, Galle Road, Colombo 03"
                      value={createForm.address}
                      onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Quoted Line Items Builder */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-purple-600" />
                    Quoted Products & Price Tiers ({quoteItems.length} items)
                  </span>

                  {/* Product Search Picker */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search product from catalog..."
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                      className="px-2.5 py-1 text-[11px] border border-slate-300 rounded-lg bg-white w-60 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                    {itemSearch.trim().length > 0 && (
                      <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-56 overflow-y-auto divide-y divide-slate-100">
                        {catalogProducts
                          .filter((p) =>
                            p.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
                            p.barcode?.toLowerCase().includes(itemSearch.toLowerCase())
                          )
                          .slice(0, 8)
                          .map((p) => (
                            <button
                              key={p._id}
                              type="button"
                              onClick={() => {
                                handleAddItemToQuote(p);
                                setItemSearch("");
                              }}
                              className="w-full p-2 text-left hover:bg-purple-50 transition text-[11px] flex items-center justify-between"
                            >
                              <div className="truncate pr-2">
                                <div className="font-bold text-slate-900 truncate">{p.name}</div>
                                <div className="text-slate-400 text-[10px] font-mono">
                                  Stock: {p.stockQuantity} {p.unit}
                                </div>
                              </div>
                              <div className="text-right font-mono font-bold text-purple-700 shrink-0">
                                {formatCurrency(p.wholesalePrice && p.wholesalePrice > 0 ? p.wholesalePrice : p.sellingPrice)}
                              </div>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                {quoteItems.length === 0 ? (
                  <div className="p-8 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-[11px]">
                    No items added yet. Use the search input above to add items from your store catalog.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                          <th className="py-2 px-3">Product Name</th>
                          <th className="py-2 px-3 text-center">Tier</th>
                          <th className="py-2 px-3 text-right">Quantity</th>
                          <th className="py-2 px-3 text-right">Unit Price (Rs.)</th>
                          <th className="py-2 px-3 text-right">Discount (Rs.)</th>
                          <th className="py-2 px-3 text-right">Line Total (Rs.)</th>
                          <th className="py-2 px-3 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {quoteItems.map((item, idx) => {
                          const lineTotal = item.unitPrice * item.quantity - (item.discount || 0);
                          return (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="py-2 px-3">
                                <div className="font-bold text-slate-900">{item.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  Current Stock: {item.stockQuantity} {item.unit}
                                  {item.stockQuantity < item.quantity && (
                                    <span className="text-amber-600 font-bold ml-1.5">
                                      (Will require backorder/restock)
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-3 text-center">
                                <select
                                  value={item.priceTier}
                                  onChange={(e) => handleUpdateItem(idx, "priceTier", e.target.value)}
                                  className="px-1.5 py-0.5 border border-slate-200 rounded text-[10px] font-bold"
                                >
                                  <option value="RETAIL">Retail</option>
                                  <option value="WHOLESALE">Wholesale</option>
                                </select>
                              </td>
                              <td className="py-2 px-3 text-right">
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    handleUpdateItem(idx, "quantity", Math.max(1, parseFloat(e.target.value) || 1))
                                  }
                                  className="w-16 px-1.5 py-1 text-right border border-slate-200 rounded font-mono font-bold"
                                />
                              </td>
                              <td className="py-2 px-3 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.unitPrice}
                                  onChange={(e) =>
                                    handleUpdateItem(idx, "unitPrice", Math.max(0, parseFloat(e.target.value) || 0))
                                  }
                                  className="w-24 px-1.5 py-1 text-right border border-slate-200 rounded font-mono font-bold text-slate-800"
                                />
                              </td>
                              <td className="py-2 px-3 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  value={item.discount || ""}
                                  onChange={(e) =>
                                    handleUpdateItem(idx, "discount", Math.max(0, parseFloat(e.target.value) || 0))
                                  }
                                  placeholder="0.00"
                                  className="w-20 px-1.5 py-1 text-right border border-slate-200 rounded font-mono text-rose-600 font-bold"
                                />
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                {formatCurrency(lineTotal)}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)}
                                  className="p-1 text-slate-400 hover:text-rose-600 transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 3. Validity & Tax Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Validity and Delivery Notes */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <span className="font-bold text-slate-900 block pb-1 border-b border-slate-200">
                    Validity Period & Commercial Terms
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">
                        Validity Duration
                      </label>
                      <select
                        value={createForm.validityDays}
                        onChange={(e) =>
                          setCreateForm({ ...createForm, validityDays: parseInt(e.target.value, 10) })
                        }
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                      >
                        <option value={7}>7 Days</option>
                        <option value={14}>14 Days (Standard)</option>
                        <option value={30}>30 Days (1 Month)</option>
                        <option value={60}>60 Days</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">
                        Specific Expiry Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={createForm.validUntil}
                        onChange={(e) => setCreateForm({ ...createForm, validUntil: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">
                      Special Delivery / Payment Terms (Notes)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Free delivery on orders exceeding 50,000 LKR. 50% advance upon order confirmation."
                      value={createForm.notes}
                      onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>

                {/* IRD Taxes & Final Computations */}
                <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2.5 font-mono text-xs">
                  <span className="font-bold text-purple-950 font-sans block pb-1 border-b border-purple-200">
                    Sri Lanka IRD Tax Options & Net Quote
                  </span>

                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal of Items:</span>
                    <span className="font-bold">{formatCurrency(quoteSubtotal)}</span>
                  </div>

                  <div className="flex justify-between items-center text-slate-600">
                    <span>Overall Quote Discount (Rs.):</span>
                    <input
                      type="number"
                      min="0"
                      value={createForm.discountTotal || ""}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          discountTotal: Math.max(0, parseFloat(e.target.value) || 0),
                        })
                      }
                      placeholder="0.00"
                      className="w-24 px-2 py-0.5 text-right border border-purple-200 rounded bg-white text-rose-600 font-bold"
                    />
                  </div>

                  <div className="pt-2 border-t border-purple-200/80 space-y-1.5">
                    <label className="flex items-center justify-between cursor-pointer select-none">
                      <span className="flex items-center gap-1.5 font-sans font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={createForm.applySscl}
                          onChange={(e) => setCreateForm({ ...createForm, applySscl: e.target.checked })}
                          className="rounded text-purple-600"
                        />
                        Social Security Contribution Levy (SSCL 2.5%)
                      </span>
                      <span className="font-bold text-slate-900">+{formatCurrency(quoteSscl)}</span>
                    </label>

                    <label className="flex items-center justify-between cursor-pointer select-none">
                      <span className="flex items-center gap-1.5 font-sans font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={createForm.applyVat}
                          onChange={(e) => setCreateForm({ ...createForm, applyVat: e.target.checked })}
                          className="rounded text-purple-600"
                        />
                        Value Added Tax (VAT 18%)
                      </span>
                      <span className="font-bold text-slate-900">+{formatCurrency(quoteVat)}</span>
                    </label>
                  </div>

                  <div className="pt-2 border-t-2 border-purple-900 flex justify-between font-black text-sm text-purple-950">
                    <span>ESTIMATED TOTAL:</span>
                    <span>{formatCurrency(quoteNetTotal)}</span>
                  </div>

                  <div className="text-[10px] text-purple-800 italic font-sans pt-1">
                    Words: {amountToWords(quoteNetTotal)}
                  </div>
                </div>
              </div>

              {/* Modal Submit Actions */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl font-bold text-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingQuote}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl font-bold transition shadow-sm flex items-center gap-1.5"
                >
                  {submittingQuote ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Creating Quote...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save & Issue Quotation</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: CONVERT QUOTATION TO TAX INVOICE                 */}
      {/* ======================================================== */}
      {quoteToConvert && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden my-auto">
            <div className="bg-emerald-700 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-emerald-200" />
                <div>
                  <h3 className="font-bold text-sm">Convert Quotation to Official Tax Invoice</h3>
                  <p className="text-[11px] text-emerald-100">
                    Quote #{quoteToConvert.quotationNumber} • {quoteToConvert.customerName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setQuoteToConvert(null)}
                className="p-1 text-emerald-200 hover:text-white rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConvertQuotation} className="p-6 space-y-4 text-xs">
              {convertError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{convertError}</span>
                </div>
              )}

              {/* Quotation Summary Card */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="flex justify-between font-bold text-slate-900">
                  <span>Payable Amount:</span>
                  <span className="text-emerald-700 font-mono text-sm">
                    {formatCurrency(quoteToConvert.netTotal)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>Items Count:</span>
                  <span>{quoteToConvert.items?.length || 0} line item(s)</span>
                </div>
                {quoteToConvert.companyName && (
                  <div className="flex justify-between text-slate-500 text-[11px]">
                    <span>Billed To:</span>
                    <span>{quoteToConvert.companyName}</span>
                  </div>
                )}
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">
                  Settlement / Payment Method *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "BANK_TRANSFER", label: "Bank Transfer" },
                    { id: "CASH", label: "Cash Settlement" },
                    { id: "CARD", label: "Debit/Credit Card" },
                    { id: "CREDIT", label: "Store Credit (Naya Potha)" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setConvertForm({ ...convertForm, paymentMethod: m.id })}
                      className={`p-2.5 rounded-xl border text-left font-bold text-xs transition ${
                        convertForm.paymentMethod === m.id
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Due Date for Credit Invoices */}
              {convertForm.paymentMethod === "CREDIT" && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 text-amber-900 font-bold">
                    <Clock className="w-4 h-4 text-amber-700" />
                    <span>Credit Terms & Repayment Due Date</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">Due Date</label>
                    <input
                      type="date"
                      value={convertForm.dueDate}
                      onChange={(e) => setConvertForm({ ...convertForm, dueDate: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <p className="text-[10px] text-amber-800">
                    * The invoice total will be charged to the customer's Naya Potha ledger.
                  </p>
                </div>
              )}

              {/* Payment Reference */}
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">
                  Payment Reference / Cheque # (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bank slip # or Purchase Order Ref"
                  value={convertForm.paymentReference}
                  onChange={(e) => setConvertForm({ ...convertForm, paymentReference: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Invoice Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="Notes appended to the generated invoice"
                  value={convertForm.notes}
                  onChange={(e) => setConvertForm({ ...convertForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              {/* Stock Verification Notice */}
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-[10px] text-blue-900 flex items-start gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
                <span>
                  Converting will verify live stock inventory, atomically decrement quantities, record an Inventory Movement, and issue a formal sequential Tax Invoice (INV-...).
                </span>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setQuoteToConvert(null)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl font-bold text-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={converting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold transition shadow-sm flex items-center gap-1.5"
                >
                  {converting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Converting...</span>
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-4 h-4" />
                      <span>Generate Tax Invoice</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: CONVERSION SUCCESS MODAL                         */}
      {/* ======================================================== */}
      {convertSuccessData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 text-center space-y-4 shadow-2xl border border-slate-200">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Tax Invoice Generated Successfully!</h3>
              <p className="text-xs text-slate-500 mt-1">
                Quotation <strong>{convertSuccessData.quotationNumber}</strong> has been converted to official Tax Invoice:
              </p>
              <div className="text-lg font-black text-emerald-700 font-mono mt-2">
                {convertSuccessData.invoiceNumber}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <Link
                href="/invoices"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition"
              >
                Go to Invoices Directory
              </Link>
              <button
                type="button"
                onClick={() => setConvertSuccessData(null)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: PRINT FORMAL COMMERCIAL A4 QUOTATION             */}
      {/* ======================================================== */}
      {selectedQuoteForPrint && (
        <CommercialQuotationA4
          quotation={selectedQuoteForPrint}
          business={
            businessProfile || {
              name: "Sri Lanka General Merchant",
              address: "Colombo, Sri Lanka",
            }
          }
          onClose={() => setSelectedQuoteForPrint(null)}
          onConvert={() => {
            const qt = selectedQuoteForPrint;
            setSelectedQuoteForPrint(null);
            setQuoteToConvert(qt);
            setConvertForm({
              paymentMethod: "BANK_TRANSFER",
              cashReceived: "",
              dueDate: "",
              paymentReference: "",
              notes: "",
            });
            setConvertError(null);
          }}
        />
      )}
    </AppLayout>
  );
}
