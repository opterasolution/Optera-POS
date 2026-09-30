"use client";

import React, { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import {
  FileText,
  FileSpreadsheet,
  Receipt,
  Plus,
  Search,
  Filter,
  Download,
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
  Layers,
  Percent,
} from "lucide-react";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";
import CommercialTaxInvoiceA4, { TaxInvoiceData } from "@/components/receipts/CommercialTaxInvoiceA4";
import CommercialQuotationA4, { QuotationPrintData } from "@/components/receipts/CommercialQuotationA4";

export default function InvoicesPage() {
  const [activeTab, setActiveTab] = useState<"invoices" | "quotations" | "ramis">("invoices");

  // Invoices state
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [invoicesSummary, setInvoicesSummary] = useState<any>({
    totalInvoiced: 0,
    totalTaxable: 0,
    outputVatTotal: 0,
    ssclTotal: 0,
    totalUnpaid: 0,
    totalPaid: 0,
    taxInvoiceCount: 0,
  });
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceType, setInvoiceType] = useState("ALL");
  const [invoicePaymentStatus, setInvoicePaymentStatus] = useState("ALL");
  const [invoiceDateRange, setInvoiceDateRange] = useState("all");

  // Quotations state
  const [quotations, setQuotations] = useState<any[]>([]);
  const [quotationsLoading, setQuotationsLoading] = useState(false);
  const [quotationsSummary, setQuotationsSummary] = useState<any>({
    activeCount: 0,
    activeValue: 0,
    convertedCount: 0,
  });
  const [quoteSearch, setQuoteSearch] = useState("");
  const [quoteStatus, setQuoteStatus] = useState("ALL");
  const [quoteDateRange, setQuoteDateRange] = useState("all");

  // Business profile for headers & tax settings
  const [businessProfile, setBusinessProfile] = useState<any>(null);

  // Modals state
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<TaxInvoiceData | null>(null);
  const [selectedQuoteForPrint, setSelectedQuoteForPrint] = useState<QuotationPrintData | null>(null);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<any | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paymentMethod: "CASH",
    paymentReference: "",
    notes: "",
  });
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Create Quotation Modal state
  const [isCreateQuoteOpen, setIsCreateQuoteOpen] = useState(false);
  const [quoteForm, setQuoteForm] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    companyName: "",
    tin: "",
    vatNumber: "",
    address: "",
    validDays: 14,
    applySscl: false,
    applyVat: false,
    notes: "",
  });
  const [quoteItems, setQuoteItems] = useState<
    Array<{
      productId: string;
      name: string;
      barcode?: string;
      sellingPrice: number;
      wholesalePrice?: number;
      wholesaleMinQty?: number;
      unitPrice: number;
      quantity: number;
      discount: number;
      priceTier: "RETAIL" | "WHOLESALE";
      total: number;
    }>
  >([]);
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [createQuoteLoading, setCreateQuoteLoading] = useState(false);

  // Convert Quote Confirmation Modal
  const [quoteToConvert, setQuoteToConvert] = useState<any | null>(null);
  const [convertForm, setConvertForm] = useState({
    paymentMethod: "BANK_TRANSFER",
    dueDate: "",
    paymentReference: "",
    notes: "",
  });
  const [convertLoading, setConvertLoading] = useState(false);

  // Load Invoices
  const loadInvoices = async () => {
    setInvoicesLoading(true);
    try {
      const params = new URLSearchParams();
      if (invoiceSearch.trim()) params.append("q", invoiceSearch.trim());
      if (invoiceType !== "ALL") params.append("type", invoiceType);
      if (invoicePaymentStatus !== "ALL") params.append("paymentStatus", invoicePaymentStatus);
      if (invoiceDateRange !== "all") params.append("dateRange", invoiceDateRange);

      const res = await fetch(`/api/invoices?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setInvoices(data.invoices || []);
        if (data.summary) setInvoicesSummary(data.summary);
        if (data.business) setBusinessProfile(data.business);
      }
    } catch (err) {
      console.error("Failed to load invoices:", err);
    } finally {
      setInvoicesLoading(false);
    }
  };

  // Load Quotations
  const loadQuotations = async () => {
    setQuotationsLoading(true);
    try {
      const params = new URLSearchParams();
      if (quoteSearch.trim()) params.append("q", quoteSearch.trim());
      if (quoteStatus !== "ALL") params.append("status", quoteStatus);
      if (quoteDateRange !== "all") params.append("dateRange", quoteDateRange);

      const res = await fetch(`/api/quotations?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setQuotations(data.quotations || []);
        if (data.summary) setQuotationsSummary(data.summary);
      }
    } catch (err) {
      console.error("Failed to load quotations:", err);
    } finally {
      setQuotationsLoading(false);
    }
  };

  // Load catalog for quotation builder
  const loadProducts = async () => {
    try {
      const res = await fetch("/api/products?limit=100");
      const data = await res.json();
      if (data.success && data.products) {
        setAvailableProducts(data.products);
      }
    } catch (err) {
      console.error("Failed to load products for quote builder", err);
    }
  };

  useEffect(() => {
    loadInvoices();
    loadProducts();
  }, []);

  useEffect(() => {
    if (activeTab === "quotations") {
      loadQuotations();
    } else if (activeTab === "invoices" || activeTab === "ramis") {
      loadInvoices();
    }
  }, [activeTab]);

  // Payment Recording
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentInvoice) return;
    setPaymentLoading(true);
    try {
      const res = await fetch(`/api/invoices/${paymentInvoice._id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentForm),
      });
      const data = await res.json();
      if (data.success) {
        setIsRecordPaymentOpen(false);
        setPaymentInvoice(null);
        setPaymentForm({ amount: "", paymentMethod: "CASH", paymentReference: "", notes: "" });
        loadInvoices();
      } else {
        alert(data.error || "Failed to record payment");
      }
    } catch {
      alert("Network error recording payment");
    } finally {
      setPaymentLoading(false);
    }
  };

  // Add Item to Quotation
  const handleAddItemToQuote = (product: any) => {
    const existing = quoteItems.find((i) => i.productId === product._id);
    const defaultTier =
      product.wholesalePrice && product.wholesalePrice > 0 ? "WHOLESALE" : "RETAIL";
    const defaultPrice =
      defaultTier === "WHOLESALE" && product.wholesalePrice
        ? product.wholesalePrice
        : product.sellingPrice;

    if (existing) {
      const newQty = existing.quantity + 1;
      const newTotal = newQty * existing.unitPrice - existing.discount;
      setQuoteItems(
        quoteItems.map((i) =>
          i.productId === product._id ? { ...i, quantity: newQty, total: Math.max(0, newTotal) } : i
        )
      );
    } else {
      setQuoteItems([
        ...quoteItems,
        {
          productId: product._id,
          name: product.name,
          barcode: product.barcode,
          sellingPrice: product.sellingPrice,
          wholesalePrice: product.wholesalePrice,
          wholesaleMinQty: product.wholesaleMinQty,
          unitPrice: defaultPrice,
          quantity: 1,
          discount: 0,
          priceTier: defaultTier,
          total: defaultPrice,
        },
      ]);
    }
  };

  // Toggle Price Tier in Quote Builder
  const handleToggleTier = (index: number) => {
    const item = quoteItems[index];
    const newTier = item.priceTier === "RETAIL" ? "WHOLESALE" : "RETAIL";
    const newUnitPrice =
      newTier === "WHOLESALE" && item.wholesalePrice && item.wholesalePrice > 0
        ? item.wholesalePrice
        : item.sellingPrice;
    const newTotal = item.quantity * newUnitPrice - item.discount;

    const updated = [...quoteItems];
    updated[index] = {
      ...item,
      priceTier: newTier,
      unitPrice: newUnitPrice,
      total: Math.max(0, newTotal),
    };
    setQuoteItems(updated);
  };

  // Update item quantity in quote
  const handleUpdateItemQty = (index: number, qty: number) => {
    const item = quoteItems[index];
    const quantity = Math.max(0.01, qty);
    const newTotal = quantity * item.unitPrice - item.discount;
    const updated = [...quoteItems];
    updated[index] = { ...item, quantity, total: Math.max(0, newTotal) };
    setQuoteItems(updated);
  };

  // Remove item from quote
  const handleRemoveQuoteItem = (index: number) => {
    setQuoteItems(quoteItems.filter((_, i) => i !== index));
  };

  // Calculate live quotation totals
  const quoteSubtotal = quoteItems.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0);
  const quoteDiscountTotal = quoteItems.reduce((acc, it) => acc + (it.discount || 0), 0);
  const quoteTaxable = Math.max(0, quoteSubtotal - quoteDiscountTotal);
  const quoteSscl = quoteForm.applySscl
    ? Math.round(((quoteTaxable * (businessProfile?.taxSettings?.ssclRate || 2.5)) / 100) * 100) / 100
    : 0;
  const quoteVat = quoteForm.applyVat
    ? Math.round((((quoteTaxable + quoteSscl) * (businessProfile?.taxSettings?.rate || 18)) / 100) * 100) / 100
    : 0;
  const quoteNetTotal = quoteTaxable + quoteSscl + quoteVat;

  // Submit create quotation
  const handleCreateQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quoteItems.length === 0) {
      alert("Please add at least one product to the quotation.");
      return;
    }
    setCreateQuoteLoading(true);
    try {
      const validUntilDate = new Date(Date.now() + quoteForm.validDays * 24 * 60 * 60 * 1000).toISOString();
      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: quoteForm.customerName,
          customerPhone: quoteForm.customerPhone,
          customerEmail: quoteForm.customerEmail,
          companyName: quoteForm.companyName,
          tin: quoteForm.tin,
          vatNumber: quoteForm.vatNumber,
          address: quoteForm.address,
          items: quoteItems.map((it) => ({
            productId: it.productId,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            discount: it.discount,
            priceTier: it.priceTier,
          })),
          discountTotal: quoteDiscountTotal,
          applySscl: quoteForm.applySscl,
          applyVat: quoteForm.applyVat,
          validUntil: validUntilDate,
          notes: quoteForm.notes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsCreateQuoteOpen(false);
        setQuoteItems([]);
        setQuoteForm({
          customerName: "",
          customerPhone: "",
          customerEmail: "",
          companyName: "",
          tin: "",
          vatNumber: "",
          address: "",
          validDays: 14,
          applySscl: false,
          applyVat: false,
          notes: "",
        });
        loadQuotations();
      } else {
        alert(data.error || "Failed to create quotation");
      }
    } catch {
      alert("Network error creating quotation");
    } finally {
      setCreateQuoteLoading(false);
    }
  };

  // Convert Quote to Tax Invoice
  const handleConvertQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteToConvert) return;
    setConvertLoading(true);
    try {
      const res = await fetch(`/api/quotations/${quoteToConvert._id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(convertForm),
      });
      const data = await res.json();
      if (data.success) {
        setQuoteToConvert(null);
        setConvertForm({ paymentMethod: "BANK_TRANSFER", dueDate: "", paymentReference: "", notes: "" });
        loadQuotations();
        loadInvoices();
        alert(`Quotation converted successfully! Tax Invoice #${data.invoiceNumber} created.`);
      } else {
        alert(data.error || "Failed to convert quotation");
      }
    } catch {
      alert("Network error converting quotation");
    } finally {
      setConvertLoading(false);
    }
  };

  // Export Tax Invoice RAMIS Schedule to CSV
  const handleExportRamisCsv = () => {
    if (!invoices.length) return;
    const rows = [
      [
        "Invoice Number",
        "Invoice Date",
        "Customer / Entity Name",
        "Buyer TIN",
        "Buyer VAT Reg",
        "Taxable Amount (LKR)",
        "SSCL Rate",
        "SSCL Amount (LKR)",
        "VAT Rate",
        "Output VAT (LKR)",
        "Total Invoice (LKR)",
        "Payment Status",
      ],
      ...invoices.map((inv) => {
        const taxable = inv.taxBreakdown?.taxableAmount || inv.subtotal;
        const sscl = inv.taxBreakdown?.ssclAmount || 0;
        const vat = inv.taxBreakdown?.vatAmount || 0;
        return [
          inv.invoiceNumber,
          new Date(inv.createdAt).toLocaleDateString("en-LK"),
          inv.buyerDetails?.companyName || inv.customerName || "Walk-in Customer",
          inv.buyerDetails?.tin || "-",
          inv.buyerDetails?.vatNumber || "-",
          taxable.toFixed(2),
          (inv.taxBreakdown?.ssclRate || 2.5) + "%",
          sscl.toFixed(2),
          (inv.taxBreakdown?.vatRate || 18) + "%",
          vat.toFixed(2),
          inv.netTotal.toFixed(2),
          inv.paymentStatus || (inv.paymentMethod === "CREDIT" ? "UNPAID" : "PAID"),
        ];
      }),
    ];

    const csvContent =
      "data:text/csv;charset=utf-8," +
      rows.map((e) => e.map((x) => `"${(x + "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `IRD_RAMIS_Tax_Schedule_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-blue-600" />
              B2B Invoicing & IRD Tax Invoices
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Manage commercial tax invoices, wholesale billing, formal customer quotations, and Sri Lanka IRD VAT/SSCL filings.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === "quotations" ? (
              <button
                type="button"
                onClick={() => setIsCreateQuoteOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                <span>Create Quotation</span>
              </button>
            ) : activeTab === "ramis" ? (
              <button
                type="button"
                onClick={handleExportRamisCsv}
                disabled={invoices.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>Export IRD RAMIS CSV</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsCreateQuoteOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                <span>New Quotation / Invoice</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (activeTab === "quotations") loadQuotations();
                else loadInvoices();
              }}
              className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition shadow-sm"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${invoicesLoading || quotationsLoading ? "animate-spin text-blue-600" : ""}`} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("invoices")}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === "invoices"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Commercial & Tax Invoices</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600">
              {invoices.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("quotations")}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === "quotations"
                ? "border-purple-600 text-purple-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Customer Quotations & Estimates</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-purple-100 text-purple-700 font-bold">
              {quotations.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ramis")}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === "ramis"
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Sri Lanka IRD RAMIS & Tax Filing Assistant</span>
          </button>
        </div>

        {/* ======================================================== */}
        {/* TAB 1: COMMERCIAL & TAX INVOICES                          */}
        {/* ======================================================== */}
        {activeTab === "invoices" && (
          <div className="space-y-6">
            {/* 4 Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Total Invoiced
                  </span>
                  <div className="text-xl font-black text-slate-900 mt-1">
                    {formatCurrency(invoicesSummary.totalInvoiced)}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    {invoicesSummary.taxInvoiceCount || 0} IRD Tax Invoices
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                  <Receipt className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Output VAT (18%) Collected
                  </span>
                  <div className="text-xl font-black text-blue-700 mt-1">
                    {formatCurrency(invoicesSummary.outputVatTotal)}
                  </div>
                  <span className="text-[10px] text-blue-600 font-semibold mt-0.5 block">
                    Payable to IRD
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                  <Percent className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    SSCL (2.5%) Collected
                  </span>
                  <div className="text-xl font-black text-purple-700 mt-1">
                    {formatCurrency(invoicesSummary.ssclTotal)}
                  </div>
                  <span className="text-[10px] text-purple-600 font-semibold mt-0.5 block">
                    Social Security Levy
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Outstanding Receivables
                  </span>
                  <div className="text-xl font-black text-rose-700 mt-1">
                    {formatCurrency(invoicesSummary.totalUnpaid)}
                  </div>
                  <span className="text-[10px] text-rose-600 font-semibold mt-0.5 block">
                    Credit / Unpaid Invoices
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Invoices Directory Table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              {/* Filter Bar */}
              <div className="p-4 sm:p-6 border-b border-slate-100 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="relative sm:col-span-2">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search Invoice #, Customer, Company Name, TIN..."
                      value={invoiceSearch}
                      onChange={(e) => setInvoiceSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") loadInvoices();
                      }}
                      className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <select
                      value={invoiceType}
                      onChange={(e) => {
                        setInvoiceType(e.target.value);
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="ALL">All Document Types</option>
                      <option value="TAX_INVOICE">IRD Tax Invoices (VAT/SSCL)</option>
                      <option value="RETAIL">Standard Retail Bills</option>
                      <option value="CREDIT">Credit Invoices</option>
                    </select>
                  </div>

                  <div>
                    <select
                      value={invoicePaymentStatus}
                      onChange={(e) => {
                        setInvoicePaymentStatus(e.target.value);
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="ALL">All Payment Statuses</option>
                      <option value="PAID">Fully Paid</option>
                      <option value="PARTIAL">Partially Paid</option>
                      <option value="UNPAID">Unpaid / Credit</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-[11px]">Period:</span>
                    {["all", "today", "7d", "30d", "month", "last_month"].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          setInvoiceDateRange(r);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                          invoiceDateRange === r
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {r === "all"
                          ? "All Time"
                          : r === "today"
                          ? "Today"
                          : r === "7d"
                          ? "7 Days"
                          : r === "30d"
                          ? "30 Days"
                          : r === "month"
                          ? "This Month"
                          : "Last Month"}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={loadInvoices}
                    className="text-blue-600 hover:text-blue-700 font-semibold text-xs inline-flex items-center gap-1"
                  >
                    <span>Apply Filters</span>
                  </button>
                </div>
              </div>

              {/* Table */}
              {invoicesLoading ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-blue-500 mb-2" />
                  Loading commercial invoices...
                </div>
              ) : invoices.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  No invoices matched your filter criteria.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                        <th className="py-3 px-4">Invoice #</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Customer / Buyer</th>
                        <th className="py-3 px-4">Invoice Type</th>
                        <th className="py-3 px-4">Payment Channel</th>
                        <th className="py-3 px-4">Payment Status</th>
                        <th className="py-3 px-4 text-right">Taxable</th>
                        <th className="py-3 px-4 text-right">VAT + SSCL</th>
                        <th className="py-3 px-4 text-right">Net Total</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoices.map((inv) => {
                        const isTax = inv.isTaxInvoice;
                        const isPaid =
                          inv.paymentStatus === "PAID" ||
                          (!inv.paymentStatus && inv.paymentMethod !== "CREDIT");
                        const isUnpaid =
                          inv.paymentStatus === "UNPAID" || inv.paymentMethod === "CREDIT";

                        const taxable = inv.taxBreakdown?.taxableAmount || inv.subtotal;
                        const totalTaxes =
                          (inv.taxBreakdown?.ssclAmount || 0) + (inv.taxBreakdown?.vatAmount || 0);

                        return (
                          <tr key={inv._id} className="hover:bg-slate-50/60 transition">
                            <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                              {inv.invoiceNumber}
                              {inv.quotationNumber && (
                                <div className="text-[10px] text-purple-600 font-normal">
                                  Ref: {inv.quotationNumber}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-600 whitespace-nowrap text-[11px]">
                              {new Date(inv.createdAt).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                              {inv.dueDate && (
                                <div className="text-[10px] text-rose-600 font-semibold">
                                  Due: {new Date(inv.dueDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-900">
                                {inv.buyerDetails?.companyName || inv.customerName || "Walk-in Customer"}
                              </div>
                              {inv.buyerDetails?.tin ? (
                                <div className="text-[10px] font-mono text-slate-400">
                                  TIN: {inv.buyerDetails.tin}
                                </div>
                              ) : inv.customerPhone ? (
                                <div className="text-[10px] font-mono text-slate-400">
                                  {inv.customerPhone}
                                </div>
                              ) : null}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              {isTax ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-200">
                                  <ShieldCheck className="w-2.5 h-2.5" />
                                  TAX INVOICE
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                  RETAIL BILL
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                              {inv.paymentMethod.replace("_", " ")}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  isPaid
                                    ? "bg-emerald-100 text-emerald-800"
                                    : isUnpaid
                                    ? "bg-rose-100 text-rose-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {inv.paymentStatus || (inv.paymentMethod === "CREDIT" ? "UNPAID" : "PAID")}
                              </span>
                              {inv.balanceDue > 0 && (
                                <div className="text-[10px] text-rose-600 font-mono font-bold mt-0.5">
                                  Due: {formatCurrency(inv.balanceDue)}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-slate-600">
                              {formatCurrency(taxable)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-blue-700 font-semibold">
                              {formatCurrency(totalTaxes)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                              {formatCurrency(inv.netTotal)}
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSelectedInvoiceForPrint(inv)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition"
                                  title="Print Official A4 Tax Invoice"
                                >
                                  <Printer className="w-3 h-3" />
                                  <span>Print A4</span>
                                </button>

                                {inv.balanceDue > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPaymentInvoice(inv);
                                      setPaymentForm({
                                        amount: String(inv.balanceDue),
                                        paymentMethod: "CASH",
                                        paymentReference: "",
                                        notes: "",
                                      });
                                      setIsRecordPaymentOpen(true);
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold transition"
                                    title="Record payment against invoice"
                                  >
                                    <CreditCard className="w-3 h-3" />
                                    <span>Pay</span>
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
        )}

        {/* ======================================================== */}
        {/* TAB 2: CUSTOMER QUOTATIONS & ESTIMATES                   */}
        {/* ======================================================== */}
        {activeTab === "quotations" && (
          <div className="space-y-6">
            {/* 3 Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Active Quotations
                  </span>
                  <div className="text-xl font-black text-slate-900 mt-1">
                    {quotationsSummary.activeCount || 0} Open
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Pending acceptance
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Active Quoted Pipeline Value
                  </span>
                  <div className="text-xl font-black text-purple-700 mt-1">
                    {formatCurrency(quotationsSummary.activeValue || 0)}
                  </div>
                  <span className="text-[10px] text-purple-600 font-semibold mt-0.5 block">
                    Potential wholesale revenue
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Converted to Tax Invoices
                  </span>
                  <div className="text-xl font-black text-emerald-700 mt-1">
                    {quotationsSummary.convertedCount || 0} Completed
                  </div>
                  <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 block">
                    Successfully billed sales
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Quotations Directory Table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-4 sm:p-6 border-b border-slate-100 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="relative sm:col-span-2">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search Quote #, Customer, Company Name, TIN..."
                      value={quoteSearch}
                      onChange={(e) => setQuoteSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") loadQuotations();
                      }}
                      className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <select
                      value={quoteStatus}
                      onChange={(e) => {
                        setQuoteStatus(e.target.value);
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="ALL">All Quotation Statuses</option>
                      <option value="DRAFT">Draft</option>
                      <option value="SENT">Sent</option>
                      <option value="ACCEPTED">Accepted</option>
                      <option value="CONVERTED">Converted to Invoice</option>
                      <option value="EXPIRED">Expired</option>
                      <option value="REJECTED">Rejected</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Table */}
              {quotationsLoading ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-purple-600 mb-2" />
                  Loading customer quotations...
                </div>
              ) : quotations.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  No quotations found. Click "Create Quotation" to draft your first estimate.
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
                        <th className="py-3 px-4 text-right">Taxable</th>
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
                              <div>{new Date(qt.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div>
                              <div className={`text-[10px] ${isExpired && !isConverted ? "text-rose-600 font-bold" : "text-slate-400"}`}>
                                Valid: {new Date(qt.validUntil).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-900">
                                {qt.companyName || qt.customerName}
                              </div>
                              {qt.tin && (
                                <div className="text-[10px] font-mono text-slate-400">
                                  TIN: {qt.tin}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                              {qt.items?.length || 0} lines
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
                                        dueDate: "",
                                        paymentReference: "",
                                        notes: "",
                                      });
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition shadow-sm"
                                    title="Convert to Tax Invoice"
                                  >
                                    <span>Convert</span>
                                    <ArrowRight className="w-3 h-3" />
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
        )}

        {/* ======================================================== */}
        {/* TAB 3: SRI LANKA IRD RAMIS & TAX FILING ASSISTANT       */}
        {/* ======================================================== */}
        {activeTab === "ramis" && (
          <div className="space-y-6">
            {/* Guide Card */}
            <div className="bg-gradient-to-r from-blue-900 to-slate-900 text-white p-6 rounded-2xl shadow-md space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold">
                      Sri Lanka Inland Revenue Department (IRD) Tax Compliance Engine
                    </h2>
                    <p className="text-xs text-blue-200 mt-1 max-w-2xl leading-relaxed">
                      Assists with monthly and quarterly tax return filings for Value Added Tax (VAT @ 18%) and Social Security Contribution Levy (SSCL @ 2.5% under Act No. 25 of 2022). Export your verified tax schedule directly for submission on the IRD RAMIS online portal.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleExportRamisCsv}
                  disabled={invoices.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow transition shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Schedule CSV</span>
                </button>
              </div>

              {/* Business IRD Profile Tag */}
              <div className="pt-2 border-t border-white/10 flex flex-wrap items-center gap-4 text-xs font-mono text-blue-200">
                <span>Seller Name: <strong className="text-white">{businessProfile?.name}</strong></span>
                <span>TIN: <strong className="text-white">{businessProfile?.taxSettings?.tin || "Not Configured in Settings"}</strong></span>
                <span>VAT Reg: <strong className="text-white">{businessProfile?.taxSettings?.vatNumber || "Not Configured"}</strong></span>
                <span>SSCL Status: <strong className="text-emerald-400">{businessProfile?.taxSettings?.ssclEnabled ? "Active (2.5%)" : "Disabled"}</strong></span>
              </div>
            </div>

            {/* RAMIS Formal Return Computation Grid */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    RAMIS Formal Indirect Tax Computation Sheet
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Aggregated across {invoices.length} commercial transactions in the selected period.
                  </p>
                </div>
                <div className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg">
                  Currency: Sri Lankan Rupees (LKR)
                </div>
              </div>

              <div className="space-y-3 max-w-3xl">
                {/* 1. Taxable Turnover */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      1. Liable / Taxable Commercial Turnover (Excl. Tax)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Total invoiced value before SSCL and Value Added Tax
                    </span>
                  </div>
                  <span className="font-mono text-base font-bold text-slate-900">
                    {formatCurrency(invoicesSummary.totalTaxable)}
                  </span>
                </div>

                {/* 2. SSCL Calculation */}
                <div className="p-4 bg-purple-50/60 rounded-xl border border-purple-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-purple-950 block">
                      2. Social Security Contribution Levy (SSCL @ 2.50%)
                    </span>
                    <span className="text-[11px] text-purple-700">
                      Turnover liable under Social Security Contribution Levy Act No. 25 of 2022
                    </span>
                  </div>
                  <span className="font-mono text-base font-bold text-purple-900">
                    {formatCurrency(invoicesSummary.ssclTotal)}
                  </span>
                </div>

                {/* 3. VAT Base Value */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      3. Statutory VAT Base Value (Turnover + SSCL)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Under IRD rules, VAT is applied on the compounded value including SSCL
                    </span>
                  </div>
                  <span className="font-mono text-base font-bold text-slate-900">
                    {formatCurrency(invoicesSummary.totalTaxable + invoicesSummary.ssclTotal)}
                  </span>
                </div>

                {/* 4. Output VAT Collected */}
                <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-blue-950 block">
                      4. Output Value Added Tax (VAT @ 18.00%)
                    </span>
                    <span className="text-[11px] text-blue-700">
                      Output VAT collected from B2B buyers and retail clients
                    </span>
                  </div>
                  <span className="font-mono text-base font-bold text-blue-900">
                    {formatCurrency(invoicesSummary.outputVatTotal)}
                  </span>
                </div>

                {/* 5. Total Indirect Taxes Payable */}
                <div className="p-5 bg-slate-900 text-white rounded-xl shadow-md flex items-center justify-between">
                  <div>
                    <span className="text-sm font-bold block">
                      TOTAL INDIRECT TAXES PAYABLE TO INLAND REVENUE (SSCL + VAT)
                    </span>
                    <span className="text-xs text-slate-400">
                      Payable to IRD General Treasury accounts via RAMIS e-payment
                    </span>
                  </div>
                  <span className="font-mono text-xl font-black text-emerald-400">
                    {formatCurrency(invoicesSummary.ssclTotal + invoicesSummary.outputVatTotal)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL 1: CREATE QUOTATION BUILDER                         */}
        {/* ======================================================== */}
        {isCreateQuoteOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-4xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 my-auto max-h-[92vh] flex flex-col">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Draft Customer Quotation / Estimate</h3>
                    <p className="text-[11px] text-slate-500">Configure B2B wholesale pricing, customer TIN, and IRD taxes</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCreateQuoteOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateQuotation} className="p-6 space-y-6 overflow-y-auto">
                {/* 1. Customer & Company Info */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-purple-600" />
                    Customer & Buyer Information
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">Company / Business Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Perera Caterers Pvt Ltd"
                        value={quoteForm.companyName}
                        onChange={(e) => setQuoteForm({ ...quoteForm, companyName: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">Contact Person *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Nimal Perera"
                        value={quoteForm.customerName}
                        onChange={(e) => setQuoteForm({ ...quoteForm, customerName: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">Phone Number (SL)</label>
                      <input
                        type="text"
                        placeholder="0771234567"
                        value={quoteForm.customerPhone}
                        onChange={(e) => setQuoteForm({ ...quoteForm, customerPhone: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">Buyer TIN (Tax Number)</label>
                      <input
                        type="text"
                        placeholder="e.g. 102938475"
                        value={quoteForm.tin}
                        onChange={(e) => setQuoteForm({ ...quoteForm, tin: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">Buyer VAT Reg #</label>
                      <input
                        type="text"
                        placeholder="e.g. 102938475-7000"
                        value={quoteForm.vatNumber}
                        onChange={(e) => setQuoteForm({ ...quoteForm, vatNumber: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">Validity (Days)</label>
                      <select
                        value={quoteForm.validDays}
                        onChange={(e) => setQuoteForm({ ...quoteForm, validDays: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value={7}>7 Days</option>
                        <option value={14}>14 Days (Standard)</option>
                        <option value={30}>30 Days (Monthly)</option>
                        <option value={60}>60 Days</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2 lg:col-span-3">
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">Delivery Address</label>
                      <input
                        type="text"
                        placeholder="e.g. No. 45, Temple Road, Colombo 03"
                        value={quoteForm.address}
                        onChange={(e) => setQuoteForm({ ...quoteForm, address: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Product Selection & Quotation Line Items */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-purple-600" />
                      Add Products to Estimate
                    </h4>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {quoteItems.length} product(s) added
                    </span>
                  </div>

                  {/* Product Search Picker */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Type product name or barcode to add to quotation..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />

                    {productSearch.trim() && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto divide-y divide-slate-100">
                        {availableProducts
                          .filter((p) =>
                            p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                            (p.barcode && p.barcode.includes(productSearch))
                          )
                          .map((prod) => (
                            <button
                              key={prod._id}
                              type="button"
                              onClick={() => {
                                handleAddItemToQuote(prod);
                                setProductSearch("");
                              }}
                              className="w-full p-2.5 text-left text-xs hover:bg-purple-50 flex items-center justify-between transition"
                            >
                              <div>
                                <span className="font-semibold text-slate-900 block">{prod.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  Stock: {prod.stockQuantity} {prod.unit}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="font-bold text-slate-900 block font-mono">
                                  {formatCurrency(prod.sellingPrice)}
                                </span>
                                {prod.wholesalePrice && (
                                  <span className="text-[10px] text-amber-700 font-bold block font-mono">
                                    Wholesale: {formatCurrency(prod.wholesalePrice)}
                                  </span>
                                )}
                              </div>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Added Items Table */}
                  {quoteItems.length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                            <th className="py-2 px-3">Item Description</th>
                            <th className="py-2 px-3 text-center">Price Tier</th>
                            <th className="py-2 px-3 text-right">Unit Price</th>
                            <th className="py-2 px-3 text-right w-24">Quantity</th>
                            <th className="py-2 px-3 text-right w-24">Discount</th>
                            <th className="py-2 px-3 text-right">Total (LKR)</th>
                            <th className="py-2 px-3 text-right"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {quoteItems.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="py-2 px-3 font-semibold text-slate-900">
                                {item.name}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleTier(idx)}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                                    item.priceTier === "WHOLESALE"
                                      ? "bg-amber-100 text-amber-900 border border-amber-300"
                                      : "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200"
                                  }`}
                                  title="Click to toggle Retail / Wholesale price"
                                >
                                  {item.priceTier} ⇄
                                </button>
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-semibold text-slate-800">
                                {formatCurrency(item.unitPrice)}
                              </td>
                              <td className="py-2 px-3 text-right">
                                <input
                                  type="number"
                                  min={0.01}
                                  step="any"
                                  value={item.quantity}
                                  onChange={(e) => handleUpdateItemQty(idx, Number(e.target.value))}
                                  className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-right font-mono text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                />
                              </td>
                              <td className="py-2 px-3 text-right">
                                <input
                                  type="number"
                                  min={0}
                                  value={item.discount}
                                  onChange={(e) => {
                                    const disc = Math.max(0, Number(e.target.value));
                                    const updated = [...quoteItems];
                                    updated[idx] = {
                                      ...item,
                                      discount: disc,
                                      total: Math.max(0, item.quantity * item.unitPrice - disc),
                                    };
                                    setQuoteItems(updated);
                                  }}
                                  className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-right font-mono text-xs text-rose-600 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                />
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                {formatCurrency(item.total)}
                              </td>
                              <td className="py-2 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveQuoteItem(idx)}
                                  className="p-1 text-slate-400 hover:text-rose-600 transition"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* 3. Tax Settings & Live Totals */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                  <div className="space-y-3">
                    <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider block">
                      Tax & Invoicing Options
                    </span>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={quoteForm.applySscl}
                          onChange={(e) => setQuoteForm({ ...quoteForm, applySscl: e.target.checked })}
                          className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span>Apply Social Security Contribution Levy (SSCL @ 2.5%)</span>
                      </label>

                      <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={quoteForm.applyVat}
                          onChange={(e) => setQuoteForm({ ...quoteForm, applyVat: e.target.checked })}
                          className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span>Apply Value Added Tax (VAT @ 18%)</span>
                      </label>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">Notes / Terms</label>
                      <textarea
                        rows={2}
                        placeholder="e.g. Free delivery within 3 days. Payment 50% advance."
                        value={quoteForm.notes}
                        onChange={(e) => setQuoteForm({ ...quoteForm, notes: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  {/* Summary Box */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 font-mono text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal (Excl. Tax):</span>
                      <span className="font-semibold">{formatCurrency(quoteSubtotal)}</span>
                    </div>

                    {quoteDiscountTotal > 0 && (
                      <div className="flex justify-between text-rose-600">
                        <span>Total Discounts:</span>
                        <span>-{formatCurrency(quoteDiscountTotal)}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-slate-700 font-semibold border-t border-slate-200 pt-1">
                      <span>Taxable Value:</span>
                      <span>{formatCurrency(quoteTaxable)}</span>
                    </div>

                    {quoteForm.applySscl && (
                      <div className="flex justify-between text-purple-800">
                        <span>SSCL (2.5%):</span>
                        <span className="font-semibold">{formatCurrency(quoteSscl)}</span>
                      </div>
                    )}

                    {quoteForm.applyVat && (
                      <div className="flex justify-between text-blue-800">
                        <span>VAT (18%):</span>
                        <span className="font-semibold">{formatCurrency(quoteVat)}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-base font-black text-slate-900 border-t-2 border-slate-900 pt-2">
                      <span>ESTIMATED TOTAL:</span>
                      <span>{formatCurrency(quoteNetTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsCreateQuoteOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createQuoteLoading || quoteItems.length === 0}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50"
                  >
                    {createQuoteLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Save Quotation</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL 2: CONVERT QUOTATION TO TAX INVOICE                */}
        {/* ======================================================== */}
        {quoteToConvert && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50/50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Convert to Official Tax Invoice</h3>
                    <p className="text-[11px] text-slate-500 font-mono">Quote #{quoteToConvert.quotationNumber}</p>
                  </div>
                </div>
                <button
                  onClick={() => setQuoteToConvert(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleConvertQuotation} className="p-6 space-y-4">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="text-xs font-semibold text-slate-800">
                    {quoteToConvert.companyName || quoteToConvert.customerName}
                  </div>
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-slate-500">Invoice Total:</span>
                    <span className="font-bold text-emerald-700 text-sm">
                      {formatCurrency(quoteToConvert.netTotal)}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Stock will be deducted from inventory and an IRD Tax Invoice will be generated.
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Payment Method *</label>
                  <select
                    value={convertForm.paymentMethod}
                    onChange={(e) => setConvertForm({ ...convertForm, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="BANK_TRANSFER">Direct Bank Deposit / Transfer</option>
                    <option value="CREDIT">30-Day B2B Credit Invoice</option>
                    <option value="CASH">Cash Settlement</option>
                    <option value="CARD">Card POS Terminal</option>
                    <option value="QR">LankaQR</option>
                    <option value="OTHER">Cheque / Other</option>
                  </select>
                </div>

                {convertForm.paymentMethod === "CREDIT" && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Payment Due Date</label>
                    <input
                      type="date"
                      value={convertForm.dueDate}
                      onChange={(e) => setConvertForm({ ...convertForm, dueDate: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Payment / Purchase Order Ref</label>
                  <input
                    type="text"
                    placeholder="e.g. PO-2026-9901 / Cheque #58190"
                    value={convertForm.paymentReference}
                    onChange={(e) => setConvertForm({ ...convertForm, paymentReference: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setQuoteToConvert(null)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={convertLoading}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50"
                  >
                    {convertLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Converting...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
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
        {/* MODAL 3: RECORD PAYMENT ON INVOICE                       */}
        {/* ======================================================== */}
        {isRecordPaymentOpen && paymentInvoice && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-blue-50/50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Record Invoice Settlement</h3>
                    <p className="text-[11px] text-slate-500 font-mono">Invoice #{paymentInvoice.invoiceNumber}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsRecordPaymentOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Total Invoice:</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(paymentInvoice.netTotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Already Received:</span>
                    <span className="font-semibold text-emerald-700">{formatCurrency(paymentInvoice.amountPaid || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-t border-slate-200 pt-1 font-mono">
                    <span className="text-slate-700 font-bold">Remaining Balance Due:</span>
                    <span className="font-bold text-rose-700 text-sm">
                      {formatCurrency(paymentInvoice.balanceDue || paymentInvoice.netTotal)}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Settlement Amount (LKR) *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    min={0.01}
                    max={paymentInvoice.balanceDue || paymentInvoice.netTotal}
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Payment Method *</label>
                  <select
                    value={paymentForm.paymentMethod}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Direct Bank Deposit / Transfer</option>
                    <option value="CARD">Card Terminal</option>
                    <option value="QR">LankaQR</option>
                    <option value="OTHER">Cheque / Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Reference / Cheque Number</label>
                  <input
                    type="text"
                    placeholder="e.g. Bank Ref #89214"
                    value={paymentForm.paymentReference}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentReference: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsRecordPaymentOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={paymentLoading || !paymentForm.amount}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50"
                  >
                    {paymentLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Recording...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Confirm Payment</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* A4 TAX INVOICE PRINTABLE MODAL                           */}
        {/* ======================================================== */}
        {selectedInvoiceForPrint && (
          <CommercialTaxInvoiceA4
            invoice={selectedInvoiceForPrint}
            business={
              businessProfile || {
                name: "Sri Lanka General Merchant",
              }
            }
            onClose={() => setSelectedInvoiceForPrint(null)}
          />
        )}

        {/* ======================================================== */}
        {/* A4 QUOTATION PRINTABLE MODAL                             */}
        {/* ======================================================== */}
        {selectedQuoteForPrint && (
          <CommercialQuotationA4
            quotation={selectedQuoteForPrint}
            business={
              businessProfile || {
                name: "Sri Lanka General Merchant",
              }
            }
            onClose={() => setSelectedQuoteForPrint(null)}
            onConvert={() => {
              const q = selectedQuoteForPrint;
              setSelectedQuoteForPrint(null);
              setQuoteToConvert(q);
              setConvertForm({ paymentMethod: "BANK_TRANSFER", dueDate: "", paymentReference: "", notes: "" });
            }}
          />
        )}
      </div>
    </AppLayout>
  );
}
