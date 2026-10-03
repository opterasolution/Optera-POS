"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  FileText,
  ShoppingBag,
  DollarSign,
  Truck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Send,
  Calendar,
  Phone,
  Mail,
  MapPin,
  FileCheck,
  ChevronDown,
  ChevronUp,
  X,
  Printer,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Package,
  Layers,
  Award,
  CreditCard,
  User,
  Hash,
} from "lucide-react";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";
import PurchaseOrderReceipt from "@/components/receipts/PurchaseOrderReceipt";

interface SupplierInfo {
  _id: string;
  name: string;
  code?: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  address?: string;
  taxNumber?: string;
  paymentTermsDays: number;
  creditLimit: number;
  currentBalance: number;
  portalToken?: string;
}

interface BusinessInfo {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  taxNumber?: string;
  currency: string;
  logo?: string;
}

interface PurchaseOrder {
  _id: string;
  poNumber: string;
  supplierName: string;
  branchName?: string;
  status: "DRAFT" | "SENT" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";
  items: Array<{
    productId: string;
    name: string;
    sku?: string;
    unit: string;
    quantityOrdered: number;
    quantityReceived: number;
    unitCost: number;
    total: number;
    notes?: string;
  }>;
  subtotal: number;
  taxTotal: number;
  netTotal: number;
  expectedDeliveryDate?: string;
  supplierInvoiceNumber?: string;
  vendorAcknowledgement?: {
    status: "PENDING" | "ACKNOWLEDGED" | "REJECTED";
    acknowledgedAt?: string;
    estimatedDeliveryDate?: string;
    dispatchInvoiceNumber?: string;
    driverName?: string;
    driverPhone?: string;
    notes?: string;
  };
  createdAt: string;
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

interface VendorRfq {
  _id: string;
  rfqNumber: string;
  title: string;
  description?: string;
  requiredByDate: string;
  deadlineDate: string;
  status: "DRAFT" | "OPEN" | "EVALUATING" | "AWARDED" | "CLOSED" | "CANCELLED";
  items: RfqItem[];
  myInvitationStatus: "INVITED" | "SUBMITTED" | "DECLINED" | "AWARDED";
  myBidToken: string;
  myBid: {
    subtotal: number;
    taxAmount?: number;
    netTotal: number;
    validUntil?: string;
    deliveryTerms?: string;
    paymentTerms?: string;
    notes?: string;
    status: "PENDING" | "ACCEPTED" | "REJECTED";
    items?: Array<{
      productId: string;
      productName: string;
      offeredQty: number;
      unitCost: number;
      discountPercent?: number;
      netUnitCost: number;
      totalCost: number;
      leadTimeDays: number;
      notes?: string;
    }>;
  } | null;
  awardedToMe: boolean;
  awardedPoNumber?: string;
  createdAt: string;
}

interface GrnRecord {
  _id: string;
  grnNumber: string;
  poNumber: string;
  inspectionStatus: "PASSED" | "PARTIALLY_ACCEPTED" | "REJECTED";
  totalAcceptedCost: number;
  totalRejectedCost: number;
  items?: Array<{
    productName: string;
    orderedQuantity: number;
    receivedQuantity: number;
    acceptedQuantity: number;
    rejectedQuantity: number;
    rejectionReason?: string;
    batchNumber?: string;
    expiryDate?: string;
  }>;
  createdAt: string;
}

interface PaymentVoucher {
  _id: string;
  voucherNumber: string;
  amount: number;
  paymentMethod: string;
  chequeNumber?: string;
  bankName?: string;
  referenceNumber?: string;
  paymentDate: string;
  status: string;
}

export default function SupplierVendorPortalPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = (params?.token as string) || "";
  const tabFromQuery = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState<"orders" | "rfqs" | "grns" | "ledger">(
    tabFromQuery === "rfq" ? "rfqs" : tabFromQuery === "grn" ? "grns" : tabFromQuery === "ledger" ? "ledger" : "orders"
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Portal Data
  const [supplier, setSupplier] = useState<SupplierInfo | null>(null);
  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [rfqs, setRfqs] = useState<VendorRfq[]>([]);
  const [grns, setGrns] = useState<GrnRecord[]>([]);
  const [vouchers, setVouchers] = useState<PaymentVoucher[]>([]);

  // Expanded PO cards
  const [expandedPoId, setExpandedPoId] = useState<string | null>(null);

  // PO Acknowledgement Modal
  const [acknowledgingPo, setAcknowledgingPo] = useState<PurchaseOrder | null>(null);
  const [ackDeliveryDate, setAckDeliveryDate] = useState("");
  const [ackInvoiceNumber, setAckInvoiceNumber] = useState("");
  const [ackDriverName, setAckDriverName] = useState("");
  const [ackDriverPhone, setAckDriverPhone] = useState("");
  const [ackNotes, setAckNotes] = useState("");
  const [submittingAck, setSubmittingAck] = useState(false);

  // RFQ Bidding Modal
  const [biddingRfq, setBiddingRfq] = useState<VendorRfq | null>(null);
  const [bidItems, setBidItems] = useState<
    Array<{
      productId: string;
      productName: string;
      requestedQty: number;
      offeredQty: number;
      unitCost: string;
      discountPercent: string;
      leadTimeDays: string;
      notes: string;
    }>
  >([]);
  const [bidDeliveryTerms, setBidDeliveryTerms] = useState("Free Store Delivery");
  const [bidPaymentTerms, setBidPaymentTerms] = useState("30 Days Credit");
  const [bidValidUntil, setBidValidUntil] = useState("");
  const [bidGeneralNotes, setBidGeneralNotes] = useState("");
  const [submittingBid, setSubmittingBid] = useState(false);

  // Printable PO View
  const [printPo, setPrintPo] = useState<PurchaseOrder | null>(null);

  // Fetch Vendor Portal Data
  const fetchPortalData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/public/vendor/portal?token=${encodeURIComponent(token)}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load supplier portal");
      }

      setSupplier(data.data.supplier);
      setBusiness(data.data.business);
      setPurchaseOrders(data.data.purchaseOrders || []);
      setRfqs(data.data.rfqs || []);
      setGrns(data.data.grns || []);
      setVouchers(data.data.vouchers || []);

      if (data.data.targetRfqId) {
        setActiveTab("rfqs");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error connecting to supplier portal";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortalData();
  }, [token]);

  // Handle PO Acknowledgement Submit
  const handleAcknowledgePo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acknowledgingPo) return;

    try {
      setSubmittingAck(true);
      const res = await fetch(`/api/public/vendor/po/acknowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poId: acknowledgingPo._id,
          token,
          action: "ACKNOWLEDGE",
          estimatedDeliveryDate: ackDeliveryDate || undefined,
          dispatchInvoiceNumber: ackInvoiceNumber.trim() || undefined,
          driverName: ackDriverName.trim() || undefined,
          driverPhone: ackDriverPhone.trim() || undefined,
          notes: ackNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to acknowledge PO");
      }

      setStatusMessage({ type: "success", text: data.message || "Purchase order acknowledged successfully!" });
      setAcknowledgingPo(null);
      await fetchPortalData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to acknowledge PO";
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setSubmittingAck(false);
    }
  };

  // Open Bidding Modal for an RFQ
  const handleOpenBidModal = (rfq: VendorRfq) => {
    setBiddingRfq(rfq);
    const existingBid = rfq.myBid;

    const initialItems = rfq.items.map((item) => {
      const matched = existingBid?.items?.find((bItem) => bItem.productId === item.productId);
      return {
        productId: item.productId,
        productName: item.productName,
        requestedQty: item.requestedQty,
        offeredQty: matched?.offeredQty || item.requestedQty,
        unitCost: matched ? String(matched.unitCost) : item.targetPrice ? String(item.targetPrice) : "",
        discountPercent: matched ? String(matched.discountPercent || 0) : "0",
        leadTimeDays: matched ? String(matched.leadTimeDays || 2) : "2",
        notes: matched?.notes || "",
      };
    });

    setBidItems(initialItems);
    setBidDeliveryTerms(existingBid?.deliveryTerms || "Free Store Delivery");
    setBidPaymentTerms(existingBid?.paymentTerms || `${supplier?.paymentTermsDays || 30} Days Credit`);
    setBidValidUntil(existingBid?.validUntil ? new Date(existingBid.validUntil).toISOString().slice(0, 10) : "");
    setBidGeneralNotes(existingBid?.notes || "");
  };

  // Calculate live bid totals
  const bidSubtotal = bidItems.reduce((sum, item) => {
    const cost = parseFloat(item.unitCost) || 0;
    const qty = Number(item.offeredQty) || 0;
    const disc = parseFloat(item.discountPercent) || 0;
    const net = cost * (1 - disc / 100);
    return sum + net * qty;
  }, 0);

  // Handle RFQ Bid Submit
  const handleSubmitBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!biddingRfq) return;

    // Validate that every item has a unit cost
    const invalidItem = bidItems.find((it) => !it.unitCost || parseFloat(it.unitCost) <= 0);
    if (invalidItem) {
      setStatusMessage({ type: "error", text: `Please enter a valid unit cost for "${invalidItem.productName}".` });
      return;
    }

    try {
      setSubmittingBid(true);
      const res = await fetch(`/api/public/vendor/rfq/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rfqId: biddingRfq._id,
          token: biddingRfq.myBidToken || token,
          items: bidItems.map((it) => ({
            productId: it.productId,
            productName: it.productName,
            offeredQty: Number(it.offeredQty),
            unitCost: parseFloat(it.unitCost),
            discountPercent: parseFloat(it.discountPercent) || 0,
            leadTimeDays: parseInt(it.leadTimeDays) || 2,
            notes: it.notes.trim() || undefined,
          })),
          validUntil: bidValidUntil || undefined,
          deliveryTerms: bidDeliveryTerms.trim() || undefined,
          paymentTerms: bidPaymentTerms.trim() || undefined,
          notes: bidGeneralNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit quotation bid");
      }

      setStatusMessage({ type: "success", text: data.message || "Quotation bid submitted successfully!" });
      setBiddingRfq(null);
      await fetchPortalData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit quotation";
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setSubmittingBid(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 text-center space-y-3 max-w-sm w-full">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-slate-800">Connecting to Vendor Portal...</p>
          <p className="text-xs text-slate-400">Verifying secure supplier access credentials</p>
        </div>
      </div>
    );
  }

  if (error || !supplier) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-rose-200 text-center space-y-4 max-w-md w-full">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">Portal Access Denied</h2>
            <p className="text-xs text-slate-500 mt-1">{error || "Invalid vendor token provided."}</p>
          </div>
          <div className="pt-2">
            <Link
              href="/portal"
              className="inline-block px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
            >
              Return to Portal Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const openPosCount = purchaseOrders.filter((p) => p.status === "SENT" || p.status === "PARTIALLY_RECEIVED").length;
  const pendingRfqsCount = rfqs.filter((r) => r.status === "OPEN" && r.myInvitationStatus !== "SUBMITTED").length;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans pb-16">
      {/* ================= TOP NAVIGATION / BRAND HEADER ================= */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-indigo-600/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-900">{business?.name || "Store POS"}</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 uppercase">
                  B2B Vendor Portal
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Partner: <span className="font-semibold text-slate-700">{supplier.name}</span>
                {supplier.code && ` (${supplier.code})`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="hidden sm:flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <div className="text-right">
              <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">AP Balance Owed</span>
              <span className="text-xs font-black text-rose-600 font-mono">
                {formatCurrency(supplier.currentBalance)}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ================= HERO OVERVIEW & SUMMARY METRICS ================= */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        {/* Status Alert Notification */}
        {statusMessage && (
          <div
            className={`mb-4 p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between transition ${
              statusMessage.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            <span>{statusMessage.text}</span>
            <button onClick={() => setStatusMessage(null)} className="opacity-70 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-2xl p-6 text-white shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-indigo-300 border border-white/10 uppercase tracking-wider inline-block mb-1.5">
                Official Supplier Account
              </span>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">{supplier.name}</h1>
              <p className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-3">
                {supplier.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3 text-indigo-400" />
                    <span>{supplier.phone}</span>
                  </span>
                )}
                {supplier.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3 text-indigo-400" />
                    <span>{supplier.email}</span>
                  </span>
                )}
                {supplier.taxNumber && (
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-indigo-400" />
                    <span>TIN/VAT: {supplier.taxNumber}</span>
                  </span>
                )}
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm border border-white/15 p-4 rounded-xl text-right shrink-0">
              <span className="text-[10px] uppercase font-bold text-slate-300 block tracking-wider">
                Store Debt Balance (Accounts Payable)
              </span>
              <span className="text-2xl font-black font-mono text-emerald-400 block mt-0.5">
                {formatCurrency(supplier.currentBalance)}
              </span>
              <span className="text-[10px] text-slate-300 block mt-1">
                Terms: <span className="font-bold text-white">{supplier.paymentTermsDays || 30} Days Credit</span>
              </span>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/10 text-xs">
            <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
              <span className="text-[10px] text-slate-300 block">Open Purchase Orders</span>
              <span className="text-base font-black font-mono text-amber-400">{openPosCount}</span>
            </div>
            <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
              <span className="text-[10px] text-slate-300 block">RFQs Needing Quotes</span>
              <span className="text-base font-black font-mono text-indigo-300">{pendingRfqsCount}</span>
            </div>
            <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
              <span className="text-[10px] text-slate-300 block">Dock Received Notes (GRN)</span>
              <span className="text-base font-black font-mono text-white">{grns.length}</span>
            </div>
            <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
              <span className="text-[10px] text-slate-300 block">Payment Vouchers</span>
              <span className="text-base font-black font-mono text-white">{vouchers.length}</span>
            </div>
          </div>
        </div>

        {/* ================= TAB NAVIGATION ================= */}
        <div className="mt-6 flex border-b border-slate-200 space-x-1 sm:space-x-3 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("orders")}
            className={`px-4 py-3 text-xs font-bold rounded-t-xl transition flex items-center gap-2 shrink-0 ${
              activeTab === "orders"
                ? "bg-white border-t-2 border-x border-slate-200 text-indigo-600 shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Purchase Orders</span>
            {openPosCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-mono">
                {openPosCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("rfqs")}
            className={`px-4 py-3 text-xs font-bold rounded-t-xl transition flex items-center gap-2 shrink-0 ${
              activeTab === "rfqs"
                ? "bg-white border-t-2 border-x border-slate-200 text-indigo-600 shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span>Quotation Requests (RFQs & Bids)</span>
            {pendingRfqsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-purple-600 text-white font-mono">
                {pendingRfqsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("grns")}
            className={`px-4 py-3 text-xs font-bold rounded-t-xl transition flex items-center gap-2 shrink-0 ${
              activeTab === "grns"
                ? "bg-white border-t-2 border-x border-slate-200 text-indigo-600 shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Dock Receipts (GRN)</span>
          </button>

          <button
            onClick={() => setActiveTab("ledger")}
            className={`px-4 py-3 text-xs font-bold rounded-t-xl transition flex items-center gap-2 shrink-0 ${
              activeTab === "ledger"
                ? "bg-white border-t-2 border-x border-slate-200 text-indigo-600 shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>AP Ledger & Payments</span>
          </button>
        </div>

        {/* ================= TAB 1: PURCHASE ORDERS ================= */}
        {activeTab === "orders" && (
          <div className="bg-white border-x border-b border-slate-200 rounded-b-2xl p-4 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Store Purchase Orders</h3>
                <p className="text-xs text-slate-500">
                  Review issued purchase orders, acknowledge dispatch dates, and track delivery status.
                </p>
              </div>
            </div>

            {purchaseOrders.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <ShoppingBag className="w-8 h-8 mx-auto opacity-50" />
                <p className="text-xs font-medium">No purchase orders found for this vendor.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {purchaseOrders.map((po) => {
                  const isExpanded = expandedPoId === po._id;
                  const ackStatus = po.vendorAcknowledgement?.status || "PENDING";

                  return (
                    <div
                      key={po._id}
                      className="border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition"
                    >
                      {/* PO Card Header */}
                      <div className="p-4 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-sm text-slate-900">{po.poNumber}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                po.status === "RECEIVED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : po.status === "PARTIALLY_RECEIVED"
                                  ? "bg-amber-100 text-amber-800"
                                  : po.status === "SENT"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-slate-200 text-slate-700"
                              }`}
                            >
                              {po.status}
                            </span>

                            {/* Vendor Acknowledgement status */}
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                                ackStatus === "ACKNOWLEDGED"
                                  ? "bg-teal-50 text-teal-700 border border-teal-200"
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}
                            >
                              {ackStatus === "ACKNOWLEDGED" ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-teal-600" />
                                  <span>Acknowledged</span>
                                </>
                              ) : (
                                <>
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  <span>Action Required: Acknowledge</span>
                                </>
                              )}
                            </span>
                          </div>

                          <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3">
                            <span>Issued: {new Date(po.createdAt).toLocaleDateString()}</span>
                            {po.expectedDeliveryDate && (
                              <span>Expected: {new Date(po.expectedDeliveryDate).toLocaleDateString()}</span>
                            )}
                            {po.branchName && <span>Destination: {po.branchName}</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-center">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Order Value</span>
                            <span className="font-mono font-black text-sm text-slate-900">
                              {formatCurrency(po.netTotal)}
                            </span>
                          </div>

                          {ackStatus !== "ACKNOWLEDGED" && po.status !== "RECEIVED" && (
                            <button
                              onClick={() => {
                                setAcknowledgingPo(po);
                                setAckDeliveryDate(
                                  po.expectedDeliveryDate
                                    ? new Date(po.expectedDeliveryDate).toISOString().slice(0, 10)
                                    : new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
                                );
                                setAckInvoiceNumber(po.supplierInvoiceNumber || "");
                              }}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-sm flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Acknowledge</span>
                            </button>
                          )}

                          <button
                            onClick={() => setExpandedPoId(isExpanded ? null : po._id)}
                            className="p-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Expandable PO Line Items */}
                      {isExpanded && (
                        <div className="p-4 bg-white border-t border-slate-200 space-y-3">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                                <tr>
                                  <th className="py-2 px-3">Item Description</th>
                                  <th className="py-2 px-3 text-right">Qty Ordered</th>
                                  <th className="py-2 px-3 text-right">Qty Received</th>
                                  <th className="py-2 px-3 text-right">Agreed Unit Cost</th>
                                  <th className="py-2 px-3 text-right">Line Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {po.items.map((line, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50/50">
                                    <td className="py-2.5 px-3">
                                      <div className="font-bold text-slate-900">{line.name}</div>
                                      {line.sku && <span className="text-[10px] text-slate-400 font-mono">{line.sku}</span>}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                                      {line.quantityOrdered} {line.unit}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                                      {line.quantityReceived} {line.unit}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                                      {formatCurrency(line.unitCost)}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                      {formatCurrency(line.total)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Acknowledgement dispatch notes if submitted */}
                          {po.vendorAcknowledgement?.dispatchInvoiceNumber && (
                            <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs space-y-1">
                              <div className="font-bold text-teal-900 flex items-center gap-1.5">
                                <Truck className="w-3.5 h-3.5 text-teal-600" />
                                <span>Logged Dispatch Information</span>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-teal-800">
                                <div>
                                  <span className="text-teal-600 block">Challan / Invoice:</span>
                                  <span className="font-mono font-bold">{po.vendorAcknowledgement.dispatchInvoiceNumber}</span>
                                </div>
                                {po.vendorAcknowledgement.driverName && (
                                  <div>
                                    <span className="text-teal-600 block">Driver:</span>
                                    <span>{po.vendorAcknowledgement.driverName}</span>
                                  </div>
                                )}
                                {po.vendorAcknowledgement.driverPhone && (
                                  <div>
                                    <span className="text-teal-600 block">Driver Phone:</span>
                                    <span>{po.vendorAcknowledgement.driverPhone}</span>
                                  </div>
                                )}
                                {po.vendorAcknowledgement.estimatedDeliveryDate && (
                                  <div>
                                    <span className="text-teal-600 block">Target Delivery:</span>
                                    <span>{new Date(po.vendorAcknowledgement.estimatedDeliveryDate).toLocaleDateString()}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: QUOTATIONS & E-BIDDING (RFQs) ================= */}
        {activeTab === "rfqs" && (
          <div className="bg-white border-x border-b border-slate-200 rounded-b-2xl p-4 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span>Quotation Requests (RFQs & e-Bidding)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Submit competitive wholesale rates and delivery terms on active store procurement tenders.
                </p>
              </div>
            </div>

            {rfqs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <FileCheck className="w-8 h-8 mx-auto opacity-50" />
                <p className="text-xs font-medium">No quotation inquiries assigned to your supplier account.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {rfqs.map((rfq) => {
                  const isSubmitted = rfq.myInvitationStatus === "SUBMITTED";
                  const isAwardedToMe = rfq.awardedToMe;
                  const isClosed = rfq.status === "CLOSED" || rfq.status === "AWARDED";
                  const deadlinePassed = new Date() > new Date(rfq.deadlineDate);

                  return (
                    <div
                      key={rfq._id}
                      className={`border rounded-2xl p-5 space-y-4 transition ${
                        isAwardedToMe
                          ? "border-emerald-300 bg-emerald-50/20"
                          : isSubmitted
                          ? "border-indigo-200 bg-white"
                          : "border-slate-200 bg-white shadow-sm"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-sm text-slate-900">{rfq.rfqNumber}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isAwardedToMe
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                  : rfq.status === "OPEN"
                                  ? "bg-purple-100 text-purple-800"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {isAwardedToMe ? "AWARDED TO YOU 🎉" : rfq.status}
                            </span>

                            {isSubmitted && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-indigo-600" />
                                <span>Quotation Submitted</span>
                              </span>
                            )}
                          </div>

                          <h4 className="text-sm font-bold text-slate-900">{rfq.title}</h4>
                          {rfq.description && <p className="text-xs text-slate-600">{rfq.description}</p>}

                          <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3 pt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span>Required By: {new Date(rfq.requiredByDate).toLocaleDateString()}</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-rose-500" />
                              <span className={deadlinePassed ? "text-rose-600 font-bold" : ""}>
                                Deadline: {new Date(rfq.deadlineDate).toLocaleDateString()}
                              </span>
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 shrink-0">
                          {rfq.myBid && (
                            <div className="text-right">
                              <span className="text-[10px] text-slate-400 uppercase font-bold block">Your Quoted Bid</span>
                              <span className="font-mono font-black text-sm text-slate-900">
                                {formatCurrency(rfq.myBid.netTotal)}
                              </span>
                            </div>
                          )}

                          {!isClosed && !deadlinePassed && (
                            <button
                              onClick={() => handleOpenBidModal(rfq)}
                              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm ${
                                isSubmitted
                                  ? "bg-slate-100 hover:bg-slate-200 text-slate-800"
                                  : "bg-purple-600 hover:bg-purple-700 text-white"
                              }`}
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>{isSubmitted ? "Revise Quotation" : "Submit Quotation Now"}</span>
                            </button>
                          )}

                          {isAwardedToMe && rfq.awardedPoNumber && (
                            <div className="text-[11px] font-bold text-emerald-700 bg-emerald-100/60 px-3 py-1 rounded-lg">
                              Generated PO: {rfq.awardedPoNumber}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Items requested summary */}
                      <div className="border-t border-slate-100 pt-3">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                          Requested Line Items ({rfq.items.length})
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {rfq.items.map((item, idx) => (
                            <div key={idx} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                              <div className="font-bold text-slate-800">{item.productName}</div>
                              <div className="text-[11px] text-slate-500 flex justify-between mt-1">
                                <span>
                                  Qty: <strong className="text-slate-700">{item.requestedQty} {item.unit}</strong>
                                </span>
                                {item.targetPrice && (
                                  <span>
                                    Target: <strong className="text-slate-700">{formatCurrency(item.targetPrice)}</strong>
                                  </span>
                                )}
                              </div>
                              {item.specifications && (
                                <p className="text-[10px] text-slate-400 mt-1 italic leading-tight">
                                  {item.specifications}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 3: DOCK RECEIPTS & GRNS ================= */}
        {activeTab === "grns" && (
          <div className="bg-white border-x border-b border-slate-200 rounded-b-2xl p-4 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Dock Receiving Reports (GRN)</h3>
                <p className="text-xs text-slate-500">
                  Transparent warehouse inspection records showing delivered, accepted, and quarantined items.
                </p>
              </div>
            </div>

            {grns.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <Truck className="w-8 h-8 mx-auto opacity-50" />
                <p className="text-xs font-medium">No dock inspection records logged yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {grns.map((grn) => (
                  <div key={grn._id} className="p-4 hover:bg-slate-50/50 transition space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-xs text-slate-900">{grn.grnNumber}</span>
                          <span className="text-xs text-slate-400 font-mono">PO: {grn.poNumber}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              grn.inspectionStatus === "PASSED"
                                ? "bg-emerald-100 text-emerald-800"
                                : grn.inspectionStatus === "PARTIALLY_ACCEPTED"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {grn.inspectionStatus}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          Inspected: {new Date(grn.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-4">
                        <div>
                          <span className="text-[9px] uppercase font-bold text-slate-400 block">Accepted (Credited)</span>
                          <span className="font-mono font-bold text-xs text-emerald-600">
                            {formatCurrency(grn.totalAcceptedCost)}
                          </span>
                        </div>
                        {grn.totalRejectedCost > 0 && (
                          <div>
                            <span className="text-[9px] uppercase font-bold text-slate-400 block">Quarantined</span>
                            <span className="font-mono font-bold text-xs text-rose-600">
                              {formatCurrency(grn.totalRejectedCost)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* GRN Items snippet */}
                    {grn.items && grn.items.length > 0 && (
                      <div className="pt-2 text-[11px] text-slate-600 space-y-1">
                        {grn.items.map((it, idx) => (
                          <div key={idx} className="flex justify-between py-0.5 border-t border-slate-50">
                            <span>{it.productName}</span>
                            <span className="font-mono">
                              Accepted: <strong className="text-emerald-700">{it.acceptedQuantity}</strong> / Delivered: {it.receivedQuantity}
                              {it.rejectedQuantity > 0 && (
                                <span className="text-rose-600 ml-2">({it.rejectedQuantity} Quarantined: {it.rejectionReason})</span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 4: AP LEDGER & PAYMENT VOUCHERS ================= */}
        {activeTab === "ledger" && (
          <div className="bg-white border-x border-b border-slate-200 rounded-b-2xl p-4 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Accounts Payable Payment Ledger</h3>
                <p className="text-xs text-slate-500">
                  Track settlements, issued cheques, and direct bank transfers recorded by store accounts.
                </p>
              </div>
            </div>

            {vouchers.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <DollarSign className="w-8 h-8 mx-auto opacity-50" />
                <p className="text-xs font-medium">No payment settlements logged for this vendor account yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Voucher #</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Method</th>
                      <th className="py-2.5 px-3">Reference / Cheque</th>
                      <th className="py-2.5 px-3 text-right">Amount Settled</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {vouchers.map((v) => (
                      <tr key={v._id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{v.voucherNumber}</td>
                        <td className="py-2.5 px-3 text-slate-600">{new Date(v.paymentDate).toLocaleDateString()}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-700">{v.paymentMethod}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">
                          {v.chequeNumber ? `CHQ: ${v.chequeNumber}` : v.referenceNumber || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-600">
                          {formatCurrency(v.amount)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">
                            {v.status}
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
      </div>

      {/* ================= MODAL: ACKNOWLEDGE PO & DISPATCH NOTICE ================= */}
      {acknowledgingPo && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Acknowledge Purchase Order</h3>
                  <p className="text-[11px] text-slate-400 font-mono">{acknowledgingPo.poNumber}</p>
                </div>
              </div>
              <button
                onClick={() => setAcknowledgingPo(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAcknowledgePo} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Estimated Delivery Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={ackDeliveryDate}
                  onChange={(e) => setAckDeliveryDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Supplier Delivery Challan / Invoice #
                </label>
                <input
                  type="text"
                  placeholder="e.g. INV-2026-9812 or CHAL-4921"
                  value={ackInvoiceNumber}
                  onChange={(e) => setAckInvoiceNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Delivery Driver Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sunil Shantha"
                    value={ackDriverName}
                    onChange={(e) => setAckDriverName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Driver Phone #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 0771234567"
                    value={ackDriverPhone}
                    onChange={(e) => setAckDriverPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Dispatch Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Partial shipment 20 cartons today, remainder tomorrow morning."
                  value={ackNotes}
                  onChange={(e) => setAckNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAcknowledgingPo(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAck}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition"
                >
                  {submittingAck ? "Submitting..." : "Confirm & Send Dispatch Notice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: SUBMIT RFQ QUOTATION BID ================= */}
      {biddingRfq && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Submit Quotation Tender</h3>
                  <p className="text-[11px] text-slate-400 font-mono">{biddingRfq.rfqNumber} • {biddingRfq.title}</p>
                </div>
              </div>
              <button
                onClick={() => setBiddingRfq(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitBid} className="space-y-4 text-xs">
              {/* Item Pricing Matrix */}
              <div className="space-y-2">
                <label className="block font-bold text-slate-800 uppercase tracking-wider">
                  Itemized Rate Bids
                </label>
                <div className="space-y-3">
                  {bidItems.map((item, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="flex justify-between font-bold text-slate-900">
                        <span>{item.productName}</span>
                        <span className="text-slate-500 font-mono">
                          Requested: {item.requestedQty} pcs
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-500 font-bold block">Offered Qty</label>
                          <input
                            type="number"
                            min="1"
                            value={item.offeredQty}
                            onChange={(e) => {
                              const updated = [...bidItems];
                              updated[idx].offeredQty = Number(e.target.value);
                              setBidItems(updated);
                            }}
                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 font-bold block">Unit Price (Rs.) *</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            required
                            value={item.unitCost}
                            onChange={(e) => {
                              const updated = [...bidItems];
                              updated[idx].unitCost = e.target.value;
                              setBidItems(updated);
                            }}
                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-purple-700"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 font-bold block">Discount %</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={item.discountPercent}
                            onChange={(e) => {
                              const updated = [...bidItems];
                              updated[idx].discountPercent = e.target.value;
                              setBidItems(updated);
                            }}
                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 font-bold block">Lead Time (Days)</label>
                          <input
                            type="number"
                            min="0"
                            value={item.leadTimeDays}
                            onChange={(e) => {
                              const updated = [...bidItems];
                              updated[idx].leadTimeDays = e.target.value;
                              setBidItems(updated);
                            }}
                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Terms and conditions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Delivery Terms
                  </label>
                  <input
                    type="text"
                    value={bidDeliveryTerms}
                    onChange={(e) => setBidDeliveryTerms(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Payment Terms
                  </label>
                  <input
                    type="text"
                    value={bidPaymentTerms}
                    onChange={(e) => setBidPaymentTerms(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Quote Validity Date
                  </label>
                  <input
                    type="date"
                    value={bidValidUntil}
                    onChange={(e) => setBidValidUntil(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    General Supplier Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Free branded display racks included."
                    value={bidGeneralNotes}
                    onChange={(e) => setBidGeneralNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              {/* Total Bid Summary Card */}
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-purple-700 block">Total Quotation Value</span>
                  <span className="text-xs text-purple-600">Calculated net of all item discounts</span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black font-mono text-purple-900">
                    {formatCurrency(bidSubtotal)}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBiddingRfq(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBid || bidSubtotal <= 0}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition"
                >
                  {submittingBid ? "Submitting Bid..." : "Submit Quotation Bid"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer Audit Stamp */}
      <footer className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-6 text-center text-[10px] text-slate-400 space-y-1">
        <p>Official Supplier Self-Service Portal • Sri Lanka Small Business POS SaaS</p>
        <p className="font-mono">Secure Access Token: {token.slice(0, 16)}...</p>
      </footer>
    </div>
  );
}
