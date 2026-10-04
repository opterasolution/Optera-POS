"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import QRCodeImage from "@/components/common/QRCodeImage";
import DigitalVipCard from "@/components/loyalty/DigitalVipCard";
import {
  Receipt,
  CreditCard,
  Star,
  Gift,
  Building,
  Phone,
  Mail,
  MapPin,
  Landmark,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Printer,
  Share2,
  Check,
  MessageSquare,
  Search,
  ExternalLink,
  Info,
  Calendar,
  Clock,
  Sparkles,
  HelpCircle,
  Package,
  ShoppingBag,
  Upload,
  FileText,
  Trash2,
  Plus,
  Minus,
  Truck,
  CheckCheck,
  AlertCircle,
  X,
  Copy,
  Tag,
} from "lucide-react";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";
import LanguageSwitcher from "@/components/common/LanguageSwitcher";
import { useLanguage, useTranslation } from "@/lib/i18n/LanguageContext";

export default function CustomerStatementPortalPage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;
  const { language } = useLanguage();
  const { t } = useTranslation();

  const [statement, setStatement] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "credit" | "ordering" | "orders" | "payment" | "loyalty" | "voucher"
  >("credit");
  const [copied, setCopied] = useState(false);
  const [copiedAcc, setCopiedAcc] = useState(false);
  const [txSearch, setTxSearch] = useState("");

  // B2B Wholesale Ordering State
  const [wholesaleProducts, setWholesaleProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [cart, setCart] = useState<Array<{ product: any; quantity: number }>>([]);
  const [poNumber, setPoNumber] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderSuccessMsg, setOrderSuccessMsg] = useState<string | null>(null);
  const [orderErrorMsg, setOrderErrorMsg] = useState<string | null>(null);

  // Bank Deposit Slip Submission State
  const [slipAmount, setSlipAmount] = useState("");
  const [slipBank, setSlipBank] = useState("");
  const [slipAccount, setSlipAccount] = useState("");
  const [slipRef, setSlipRef] = useState("");
  const [slipDate, setSlipDate] = useState(new Date().toISOString().slice(0, 10));
  const [slipImage, setSlipImage] = useState("");
  const [slipNotes, setSlipNotes] = useState("");
  const [submittingSlip, setSubmittingSlip] = useState(false);
  const [slipSuccessMsg, setSlipSuccessMsg] = useState<string | null>(null);
  const [slipErrorMsg, setSlipErrorMsg] = useState<string | null>(null);

  // Voucher Checker state
  const [voucherCodeInput, setVoucherCodeInput] = useState("");
  const [voucherData, setVoucherData] = useState<any | null>(null);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherError, setVoucherError] = useState<string | null>(null);

  async function loadStatement() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/public/customer/statement?token=${token}`);
      const data = await res.json();

      if (data.success && data.statement) {
        setStatement(data.statement);
        if (data.statement.customer?.deliveryAddress) {
          setDeliveryAddress(data.statement.customer.deliveryAddress);
        }
        if (data.statement.business?.bankDetails?.bankName) {
          setSlipBank(data.statement.business.bankDetails.bankName);
        }
        if (data.statement.business?.bankDetails?.accountNumber) {
          setSlipAccount(data.statement.business.bankDetails.accountNumber);
        }
      } else {
        setError(data.error || "Failed to load statement");
      }
    } catch (err: any) {
      console.error("Statement fetch error:", err);
      setError("Unable to connect to the store portal.");
    } finally {
      setLoading(false);
    }
  }

  async function loadWholesaleCatalog() {
    if (!token) return;
    try {
      setLoadingProducts(true);
      const res = await fetch(`/api/public/customer/products?token=${token}`);
      const data = await res.json();
      if (data.success && data.products) {
        setWholesaleProducts(data.products);
      }
    } catch (err) {
      console.error("Failed to load catalog", err);
    } finally {
      setLoadingProducts(false);
    }
  }

  useEffect(() => {
    if (token) {
      loadStatement();
      loadWholesaleCatalog();
    }
  }, [token]);

  const handlePrint = () => {
    window.print();
  };

  const handleAddToCart = (product: any, delta = 1) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product._id === product._id);
      const minQty = product.wholesaleMinQty || 1;
      if (existing) {
        const newQty = existing.quantity + delta;
        if (newQty <= 0) {
          return prev.filter((item) => item.product._id !== product._id);
        }
        return prev.map((item) =>
          item.product._id === product._id ? { ...item, quantity: newQty } : item
        );
      } else {
        if (delta <= 0) return prev;
        return [...prev, { product, quantity: minQty }];
      }
    });
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product._id !== productId));
  };

  const handleUpdateCartQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      handleRemoveFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.product._id === productId ? { ...item, quantity: qty } : item))
    );
  };

  const cartSubtotal = cart.reduce(
    (sum, item) => sum + (item.product.wholesalePrice || item.product.sellingPrice) * item.quantity,
    0
  );

  const handleSubmitB2BOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    setSubmittingOrder(true);
    setOrderSuccessMsg(null);
    setOrderErrorMsg(null);

    try {
      const payload = {
        items: cart.map((item) => ({
          productId: item.product._id,
          name: item.product.name,
          unitPrice: item.product.wholesalePrice || item.product.sellingPrice,
          quantity: item.quantity,
        })),
        customerPoNumber: poNumber.trim(),
        requestedDeliveryDate: deliveryDate || undefined,
        deliveryAddress: deliveryAddress.trim() || statement?.customer?.deliveryAddress || "Store Pickup",
        notes: orderNotes.trim(),
      };

      const res = await fetch(`/api/public/customer/order?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        setOrderSuccessMsg(data.message || "B2B Purchase Order submitted successfully!");
        setCart([]);
        setPoNumber("");
        setDeliveryDate("");
        setOrderNotes("");
        // Refresh statement to display new order in tracking tab
        loadStatement();
      } else {
        setOrderErrorMsg(data.error || "Failed to submit purchase order.");
      }
    } catch {
      setOrderErrorMsg("Network error submitting purchase order.");
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleSubmitSlip = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingSlip(true);
    setSlipSuccessMsg(null);
    setSlipErrorMsg(null);

    try {
      const payload = {
        amount: parseFloat(slipAmount),
        depositBank: slipBank,
        depositAccount: slipAccount,
        transactionReference: slipRef.trim(),
        paymentDate: slipDate,
        slipImageUrl: slipImage.trim(),
        notes: slipNotes.trim(),
      };

      const res = await fetch(`/api/public/customer/payment-slip?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        setSlipSuccessMsg(data.message || "Payment slip notification sent successfully!");
        setSlipAmount("");
        setSlipRef("");
        setSlipImage("");
        setSlipNotes("");
        loadStatement();
      } else {
        setSlipErrorMsg(data.error || "Failed to submit payment slip.");
      }
    } catch {
      setSlipErrorMsg("Network error submitting payment slip.");
    } finally {
      setSubmittingSlip(false);
    }
  };

  const handleLookupVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voucherCodeInput.trim()) return;

    try {
      setVoucherLoading(true);
      setVoucherError(null);
      setVoucherData(null);
      const res = await fetch(
        `/api/public/voucher/lookup?code=${encodeURIComponent(voucherCodeInput.trim())}`
      );
      const data = await res.json();

      if (data.success && data.voucher) {
        setVoucherData(data.voucher);
      } else {
        setVoucherError(data.error || "Gift voucher could not be found.");
      }
    } catch {
      setVoucherError("Failed to check gift voucher balance.");
    } finally {
      setVoucherLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-slate-600 font-sans space-y-3">
        <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="font-semibold text-xs tracking-wide">
          Verifying secure B2B statement ledger...
        </p>
      </div>
    );
  }

  if (error || !statement) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-center space-y-4 font-sans">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-800">Statement Not Available</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {error || "The requested link is invalid or your customer session has expired."}
          </p>
        </div>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition"
        >
          Return to Store Home
        </button>
      </div>
    );
  }

  const {
    customer,
    business,
    aging = { current: 0, days30: 0, days60: 0, days90Plus: 0, totalOverdue: 0 },
    transactions = [],
    recentInvoices = [],
    creditNotes = [],
    b2bOrders = [],
    paymentSlips = [],
  } = statement;

  const currentUrl = typeof window !== "undefined" ? window.location.href : "";

  // Filter transactions
  const filteredTransactions = transactions.filter((tx: any) => {
    if (!txSearch.trim()) return true;
    const term = txSearch.toLowerCase();
    return (
      tx.transactionNumber?.toLowerCase().includes(term) ||
      tx.invoiceNumber?.toLowerCase().includes(term) ||
      tx.paymentReference?.toLowerCase().includes(term) ||
      tx.notes?.toLowerCase().includes(term)
    );
  });

  // Filter wholesale products
  const categoriesList = ["ALL", ...Array.from(new Set(wholesaleProducts.map((p) => p.categoryName || "General Goods")))];
  const filteredProducts = wholesaleProducts.filter((p) => {
    const matchesSearch =
      !productSearch.trim() ||
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku?.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.nameSinhala?.includes(productSearch);
    const matchesCategory = selectedCategory === "ALL" || p.categoryName === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-slate-100 py-4 sm:py-8 font-sans print:bg-white print:py-0">
      <div className="max-w-4xl mx-auto px-4 space-y-4">
        {/* On-Screen Action Bar */}
        <div className="no-print flex flex-wrap items-center justify-between gap-2 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Building className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                B2B Wholesale Portal & Account Statements
              </span>
              <span className="text-xs font-bold text-slate-800">
                {business.name || "Sri Lanka Retail POS"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />

            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{t("common.print") || "Print Statement"}</span>
            </button>

            <button
              onClick={() => {
                if (typeof window !== "undefined") {
                  navigator.clipboard.writeText(currentUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }
              }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-bold">{t("common.copied") || "Copied!"}</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>{t("common.copyLink") || "Share"}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Store & Customer Corporate Header Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold tracking-wide uppercase border border-blue-200 mb-2">
                <ShieldCheck className="w-3 h-3 text-blue-600" />
                <span>Verified Corporate B2B Account</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {business.name}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
                {business.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>{business.phone}</span>
                  </span>
                )}
                {business.address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span>{business.address}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Corporate Customer Profile Header */}
            <div className="sm:text-right bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-xl border sm:border-none border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Corporate Account
              </span>
              <div className="text-base font-bold text-slate-900">
                {customer.companyName || customer.name}
              </div>
              {customer.companyName && (
                <div className="text-xs text-slate-600">Attn: {customer.contactPerson || customer.name}</div>
              )}
              <div className="text-xs font-mono text-slate-500">{customer.phone}</div>
              {(customer.tin || customer.vatNumber) && (
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                  {customer.tin && <span>TIN: {customer.tin} </span>}
                  {customer.vatNumber && <span>VAT: {customer.vatNumber}</span>}
                </div>
              )}
              <div className="mt-2 flex sm:justify-end gap-1.5 flex-wrap">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-indigo-100 text-indigo-900 border border-indigo-200">
                  {customer.customerType || "WHOLESALE"}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-amber-100 text-amber-900 border border-amber-200">
                  Terms: Net {customer.paymentTermsDays || 30} Days
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-emerald-100 text-emerald-900 border border-emerald-200">
                  Tier: {customer.wholesaleTier || "TIER_1"}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Tab Selector */}
          <div className="no-print flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold overflow-x-auto">
            <button
              onClick={() => setActiveTab("credit")}
              className={`flex-1 min-w-[130px] py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                activeTab === "credit"
                  ? "bg-white text-blue-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Statement & Aging (ණය)</span>
            </button>

            <button
              onClick={() => setActiveTab("ordering")}
              className={`flex-1 min-w-[140px] py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                activeTab === "ordering"
                  ? "bg-white text-emerald-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
              <span>Order Wholesale {cart.length > 0 && `(${cart.length})`}</span>
            </button>

            <button
              onClick={() => setActiveTab("orders")}
              className={`flex-1 min-w-[120px] py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                activeTab === "orders"
                  ? "bg-white text-blue-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Truck className="w-3.5 h-3.5 text-indigo-600" />
              <span>My Orders ({b2bOrders.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("payment")}
              className={`flex-1 min-w-[130px] py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                activeTab === "payment"
                  ? "bg-white text-blue-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Landmark className="w-3.5 h-3.5 text-teal-600" />
              <span>Notify Bank Deposit</span>
            </button>

            <button
              onClick={() => setActiveTab("loyalty")}
              className={`flex-1 min-w-[110px] py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                activeTab === "loyalty"
                  ? "bg-white text-blue-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Star className="w-3.5 h-3.5 text-amber-500" />
              <span>VIP & Points</span>
            </button>

            <button
              onClick={() => setActiveTab("voucher")}
              className={`flex-1 min-w-[110px] py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                activeTab === "voucher"
                  ? "bg-white text-blue-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Gift className="w-3.5 h-3.5 text-purple-500" />
              <span>Gift Voucher</span>
            </button>
          </div>
        </div>

        {/* ================= TAB 1: CORPORATE STATEMENT & AGING LEDGER ================= */}
        {activeTab === "credit" && (
          <div className="space-y-4">
            {/* 4 Financial KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Outstanding Balance */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Outstanding Balance
                </span>
                <div
                  className={`text-lg sm:text-xl font-black font-mono ${
                    customer.currentBalance > 0 ? "text-rose-600" : "text-emerald-600"
                  }`}
                >
                  {formatCurrency(customer.currentBalance)}
                </div>
                <div className="text-[10px] text-slate-500">
                  {customer.currentBalance > 0 ? "Payment Due" : "All Dues Cleared"}
                </div>
              </div>

              {/* Credit Limit */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Approved Credit Limit
                </span>
                <div className="text-lg sm:text-xl font-black font-mono text-slate-900">
                  {formatCurrency(customer.creditLimit)}
                </div>
                <div className="text-[10px] text-slate-500">Approved Credit Ceiling</div>
              </div>

              {/* Available Credit */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Available Purchasing Power
                </span>
                <div className="text-lg sm:text-xl font-black font-mono text-blue-600">
                  {formatCurrency(customer.availableCredit)}
                </div>
                <div className="text-[10px] text-slate-500">Available For Re-orders</div>
              </div>

              {/* Account Status Badge */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Credit Account Status
                </span>
                <div className="pt-1">
                  {customer.accountStatus === "CLEAR" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>CLEAR (Rs. 0 Due)</span>
                    </span>
                  )}
                  {customer.accountStatus === "ACTIVE" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-100 text-blue-800">
                      <Clock className="w-3.5 h-3.5" />
                      <span>ACTIVE (Good Standing)</span>
                    </span>
                  )}
                  {customer.accountStatus === "OVER_LIMIT" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-100 text-rose-800">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>LIMIT EXCEEDED</span>
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 pt-0.5 font-mono">Net {customer.paymentTermsDays || 30} Days</div>
              </div>
            </div>

            {/* 30 / 60 / 90+ Aging Buckets Analysis Dashboard */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Accounts Receivable Aging Analysis
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Aging buckets based on your {customer.paymentTermsDays || 30}-day credit grace period
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Overdue</span>
                  <span className={`text-xs font-mono font-bold ${aging.totalOverdue > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                    {formatCurrency(aging.totalOverdue)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* Current (0-30 Days) */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Current (Within Terms)
                    </span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  </div>
                  <div className="text-base font-bold font-mono text-slate-900">
                    {formatCurrency(aging.current)}
                  </div>
                  <div className="text-[10px] text-emerald-700 font-semibold">Not Overdue</div>
                </div>

                {/* 1-30 Days Overdue */}
                <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                      1 – 30 Days Overdue
                    </span>
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  </div>
                  <div className="text-base font-bold font-mono text-amber-950">
                    {formatCurrency(aging.days30)}
                  </div>
                  <div className="text-[10px] text-amber-700 font-medium">Due for settlement</div>
                </div>

                {/* 31-60 Days Overdue */}
                <div className="p-3 rounded-xl bg-orange-50/60 border border-orange-200/80 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-orange-800 uppercase tracking-wider">
                      31 – 60 Days Overdue
                    </span>
                    <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                  </div>
                  <div className="text-base font-bold font-mono text-orange-950">
                    {formatCurrency(aging.days60)}
                  </div>
                  <div className="text-[10px] text-orange-700 font-medium">Overdue Notice</div>
                </div>

                {/* 60+ Days Overdue */}
                <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-200/80 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">
                      60+ Days Critical
                    </span>
                    <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse"></span>
                  </div>
                  <div className="text-base font-bold font-mono text-rose-950">
                    {formatCurrency(aging.days90Plus)}
                  </div>
                  <div className="text-[10px] text-rose-700 font-semibold">Critical Account Hold</div>
                </div>
              </div>
            </div>

            {/* Active Credit Notes (Store Credits) */}
            {creditNotes.length > 0 && (
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-emerald-600" />
                    Available Credit Notes / Return Credits ({creditNotes.length})
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-800">
                    Total Credit: {formatCurrency(creditNotes.reduce((s: number, c: any) => s + (c.remainingBalance || 0), 0))}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {creditNotes.map((cn: any) => (
                    <div key={cn._id} className="bg-white p-2.5 rounded-xl border border-emerald-200/70 text-xs flex justify-between items-center font-mono">
                      <div>
                        <span className="font-bold text-slate-800 block">{cn.creditNoteNumber}</span>
                        <span className="text-[10px] text-slate-500">Issued: {new Date(cn.createdAt).toLocaleDateString()}</span>
                      </div>
                      <span className="font-black text-emerald-700">{formatCurrency(cn.remainingBalance)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Direct Bank Settlement Information Box */}
            {business.bankDetails?.accountNumber && customer.currentBalance > 0 && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-blue-950 font-bold text-sm">
                    <Landmark className="w-4 h-4 text-blue-600" />
                    <span>Direct Bank Transfer Settlement Details</span>
                  </div>
                  <span className="text-[10px] font-bold bg-blue-200 text-blue-900 px-2 py-0.5 rounded">
                    CEFT / SLIPS / LankaPay
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono text-slate-700 bg-white/80 p-3 rounded-xl border border-blue-100">
                  <div>
                    <span className="text-slate-400 block text-[10px] font-sans">BENEFICIARY BANK</span>
                    <span className="font-bold text-slate-900">{business.bankDetails.bankName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-sans">BRANCH</span>
                    <span className="font-semibold">{business.bankDetails.branchName || "Main"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-sans">ACCOUNT NUMBER</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-blue-700 text-sm">
                        {business.bankDetails.accountNumber}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(business.bankDetails.accountNumber);
                          setCopiedAcc(true);
                          setTimeout(() => setCopiedAcc(false), 2000);
                        }}
                        className="text-[10px] text-blue-600 hover:text-blue-800 underline font-sans flex items-center gap-0.5"
                      >
                        {copiedAcc ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedAcc ? "Copied" : "Copy"}</span>
                      </button>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-sans">ACCOUNT NAME</span>
                    <span className="font-semibold text-slate-800">
                      {business.bankDetails.accountName || business.name}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-600 text-[11px]">
                    After transferring, please upload proof in the{" "}
                    <button
                      onClick={() => setActiveTab("payment")}
                      className="font-bold text-blue-600 hover:underline"
                    >
                      "Notify Bank Deposit"
                    </button>{" "}
                    tab.
                  </span>
                  <button
                    onClick={() => setActiveTab("payment")}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
                  >
                    Upload Slip &rarr;
                  </button>
                </div>
              </div>
            )}

            {/* Naya Potha Running Ledger Statement Table */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-blue-600" />
                    <span>Statement of Account (Running Ledger)</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Chronological audit ledger of all invoices, payments, and credit adjustments
                  </p>
                </div>

                <div className="no-print relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={txSearch}
                    onChange={(e) => setTxSearch(e.target.value)}
                    placeholder="Search invoice or ref..."
                    className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {filteredTransactions.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  No credit transactions recorded for this account.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Ref # / Invoice</th>
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3 text-right">Debit (+)</th>
                        <th className="py-2.5 px-3 text-right">Credit (-)</th>
                        <th className="py-2.5 px-3 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {filteredTransactions.map((tx: any) => {
                        const isDebit = tx.type === "CREDIT_SALE";
                        return (
                          <tr key={tx._id} className="hover:bg-slate-50 transition">
                            <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                              {new Date(tx.createdAt).toLocaleDateString("en-GB")}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-800 whitespace-nowrap">
                              {tx.invoiceNumber ? (
                                <Link
                                  href={`/receipt/${tx.invoiceNumber}`}
                                  className="text-blue-600 hover:underline flex items-center gap-1"
                                >
                                  <span>{tx.invoiceNumber}</span>
                                  <ExternalLink className="w-2.5 h-2.5 no-print" />
                                </Link>
                              ) : (
                                tx.transactionNumber
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 font-sans text-xs">
                              <span className="font-semibold block text-slate-800">
                                {tx.type === "CREDIT_SALE" && "Wholesale Purchase (Credit Invoice)"}
                                {tx.type === "PAYMENT" && `Payment: ${tx.paymentMethod || "Bank Transfer"}`}
                                {tx.type === "ADJUSTMENT" && "Ledger Adjustment"}
                              </span>
                              {tx.notes && <span className="text-[11px] text-slate-500">{tx.notes}</span>}
                              {tx.paymentReference && (
                                <span className="text-[10px] text-blue-600 block">Ref: {tx.paymentReference}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-rose-600 whitespace-nowrap">
                              {isDebit ? formatCurrency(tx.amount) : "—"}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-600 whitespace-nowrap">
                              {!isDebit ? formatCurrency(tx.amount) : "—"}
                            </td>
                            <td className="py-2.5 px-3 text-right font-black text-slate-900 whitespace-nowrap">
                              {formatCurrency(tx.balanceAfter)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Printable Authorized Signoff Box */}
              <div className="hidden print:grid grid-cols-2 gap-8 pt-8 border-t border-slate-300 text-xs">
                <div>
                  <div className="border-b border-slate-400 pb-12"></div>
                  <span className="text-[10px] uppercase font-bold text-slate-600 block pt-1">
                    Customer Acceptance / Authorized Signatory
                  </span>
                </div>
                <div>
                  <div className="border-b border-slate-400 pb-12"></div>
                  <span className="text-[10px] uppercase font-bold text-slate-600 block pt-1">
                    For {business.name} (Accountant / Manager)
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: B2B WHOLESALE ORDERING & CART ================= */}
        {activeTab === "ordering" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold tracking-wide uppercase border border-emerald-200 mb-1">
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    <span>Wholesale Tier {customer.wholesaleTier || "TIER_1"} Active</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    B2B Wholesale Ordering Catalog
                  </h3>
                  <p className="text-xs text-slate-500">
                    Select bulk items, cartons, and wholesale bags. Minimum order quantities apply.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Search wholesale goods..."
                      className="pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {categoriesList.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                      selectedCategory === cat
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Products Grid & Sticky Cart Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
                {/* Catalog List */}
                <div className="lg:col-span-2 space-y-3">
                  {loadingProducts ? (
                    <div className="p-8 text-center text-xs text-slate-400">Loading catalog...</div>
                  ) : filteredProducts.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                      No wholesale products found matching your search.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {filteredProducts.map((p) => {
                        const inCart = cart.find((it) => it.product._id === p._id);
                        const effectivePrice = p.wholesalePrice || p.sellingPrice;
                        const minQty = p.wholesaleMinQty || 1;
                        return (
                          <div
                            key={p._id}
                            className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs hover:border-emerald-300 transition space-y-3 flex flex-col justify-between"
                          >
                            <div className="space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-[10px] font-bold uppercase text-slate-400">
                                  {p.categoryName}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    p.isAvailable
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-rose-50 text-rose-700"
                                  }`}
                                >
                                  {p.isAvailable ? `In Stock (${p.stockQuantity} ${p.unit})` : "Out of Stock"}
                                </span>
                              </div>
                              <h4 className="text-xs font-bold text-slate-900 leading-snug">
                                {p.name}
                              </h4>
                              {p.nameSinhala && (
                                <p className="text-[11px] text-slate-500 font-sinhala">
                                  {p.nameSinhala}
                                </p>
                              )}
                              <span className="text-[10px] text-slate-400 font-mono block">
                                SKU: {p.sku || "N/A"}
                              </span>
                            </div>

                            <div className="pt-2 border-t border-slate-100 flex items-end justify-between">
                              <div>
                                <span className="text-sm font-black font-mono text-emerald-700 block">
                                  {formatCurrency(effectivePrice)}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  Per {p.unit} (Min: {minQty})
                                </span>
                              </div>

                              {inCart ? (
                                <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-xl p-1">
                                  <button
                                    type="button"
                                    onClick={() => handleAddToCart(p, -1)}
                                    className="w-6 h-6 rounded-lg bg-white text-emerald-800 flex items-center justify-center font-bold hover:bg-emerald-100 text-xs shadow-2xs"
                                  >
                                    -
                                  </button>
                                  <span className="font-mono text-xs font-bold px-1 text-emerald-950">
                                    {inCart.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleAddToCart(p, 1)}
                                    className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold hover:bg-emerald-700 text-xs shadow-2xs"
                                  >
                                    +
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  disabled={!p.isAvailable}
                                  onClick={() => handleAddToCart(p, minQty)}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Add ({minQty})</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Wholesale Order Cart & PO Submission Drawer */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 h-fit sticky top-6">
                  <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-emerald-600" />
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Wholesale Cart ({cart.length})
                      </h4>
                    </div>
                    {cart.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setCart([])}
                        className="text-[10px] text-rose-600 hover:underline"
                      >
                        Clear All
                      </button>
                    )}
                  </div>

                  {orderSuccessMsg && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{orderSuccessMsg}</span>
                    </div>
                  )}

                  {orderErrorMsg && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>{orderErrorMsg}</span>
                    </div>
                  )}

                  {cart.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      Your wholesale cart is empty. Add products from the catalog to place an order.
                    </div>
                  ) : (
                    <form onSubmit={handleSubmitB2BOrder} className="space-y-4">
                      {/* Cart Items List */}
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {cart.map((item) => {
                          const price = item.product.wholesalePrice || item.product.sellingPrice;
                          const lineTotal = price * item.quantity;
                          return (
                            <div
                              key={item.product._id}
                              className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs flex items-center justify-between gap-2"
                            >
                              <div className="flex-1 min-w-0">
                                <span className="font-bold text-slate-900 truncate block">
                                  {item.product.name}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {formatCurrency(price)} × {item.quantity} {item.product.unit}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="font-bold font-mono text-slate-900 block">
                                  {formatCurrency(lineTotal)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFromCart(item.product._id)}
                                  className="text-[10px] text-rose-500 hover:text-rose-700"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Subtotal */}
                      <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700">Estimated Order Total:</span>
                        <span className="text-base font-black font-mono text-emerald-700">
                          {formatCurrency(cartSubtotal)}
                        </span>
                      </div>

                      {/* PO Details */}
                      <div className="space-y-2 pt-1">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                            Your PO / Ref Number (Optional)
                          </label>
                          <input
                            type="text"
                            value={poNumber}
                            onChange={(e) => setPoNumber(e.target.value)}
                            placeholder="e.g. PO-HILTON-2026-99"
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                            Requested Delivery Date
                          </label>
                          <input
                            type="date"
                            value={deliveryDate}
                            onChange={(e) => setDeliveryDate(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                            Delivery Address *
                          </label>
                          <textarea
                            rows={2}
                            required
                            value={deliveryAddress}
                            onChange={(e) => setDeliveryAddress(e.target.value)}
                            placeholder="Delivery address / warehouse gate..."
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                            Dispatch Notes / Instructions
                          </label>
                          <input
                            type="text"
                            value={orderNotes}
                            onChange={(e) => setOrderNotes(e.target.value)}
                            placeholder="e.g. Deliver before 10 AM, unload at rear entrance"
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={submittingOrder}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center justify-center gap-1.5"
                      >
                        {submittingOrder ? (
                          <span>Submitting Order...</span>
                        ) : (
                          <>
                            <CheckCheck className="w-4 h-4" />
                            <span>Submit B2B Purchase Order</span>
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: MY B2B ORDERS & FULFILLMENT ================= */}
        {activeTab === "orders" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-indigo-600" />
                    <span>My Placed B2B Wholesale Orders ({b2bOrders.length})</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Track processing, dispatch status, and official sales invoices for your orders
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("ordering")}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Order</span>
                </button>
              </div>

              {b2bOrders.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  You have not placed any B2B online orders yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {b2bOrders.map((ord: any) => {
                    const statusColors: Record<string, string> = {
                      PENDING: "bg-amber-100 text-amber-800 border-amber-200",
                      APPROVED: "bg-blue-100 text-blue-800 border-blue-200",
                      PROCESSING: "bg-purple-100 text-purple-800 border-purple-200",
                      DISPATCHED: "bg-indigo-100 text-indigo-800 border-indigo-200",
                      DELIVERED: "bg-emerald-100 text-emerald-800 border-emerald-200",
                      CANCELLED: "bg-rose-100 text-rose-800 border-rose-200",
                    };
                    return (
                      <div
                        key={ord._id}
                        className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900 text-sm">
                              {ord.orderNumber}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                statusColors[ord.status] || "bg-slate-200 text-slate-700"
                              }`}
                            >
                              {ord.status}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 font-mono">
                            Placed: {new Date(ord.createdAt).toLocaleDateString("en-GB")}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">
                              Your PO Reference
                            </span>
                            <span className="font-mono font-semibold text-slate-800">
                              {ord.customerPoNumber || "N/A"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">
                              Delivery Target
                            </span>
                            <span className="font-mono text-slate-800">
                              {ord.requestedDeliveryDate
                                ? new Date(ord.requestedDeliveryDate).toLocaleDateString("en-GB")
                                : "Standard Dispatch"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">
                              Total Order Value
                            </span>
                            <span className="font-mono font-black text-emerald-700 text-sm">
                              {formatCurrency(ord.netTotal)}
                            </span>
                          </div>
                        </div>

                        {ord.items && ord.items.length > 0 && (
                          <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-1.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              Line Items ({ord.items.length})
                            </span>
                            <div className="divide-y divide-slate-100 text-xs">
                              {ord.items.map((it: any, idx: number) => (
                                <div key={idx} className="py-1 flex items-center justify-between">
                                  <span className="font-medium text-slate-800">
                                    {it.name} × {it.quantity} {it.unit || "pcs"}
                                  </span>
                                  <span className="font-mono font-bold text-slate-700">
                                    {formatCurrency(it.subtotal || it.unitPrice * it.quantity)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {ord.convertedInvoiceNumber && (
                          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs flex items-center justify-between text-emerald-900">
                            <span className="font-semibold">
                              Invoiced via POS: <span className="font-mono font-bold">{ord.convertedInvoiceNumber}</span>
                            </span>
                            <Link
                              href={`/receipt/${ord.convertedInvoiceNumber}`}
                              className="font-bold underline flex items-center gap-1"
                            >
                              <span>View Invoice</span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 4: NOTIFY BANK DEPOSIT & PAYMENT SLIP ================= */}
        {activeTab === "payment" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-5 shadow-2xs">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-teal-600" />
                  <span>Notify Direct Bank Transfer / Deposit</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Notify the store accounts department about your bank deposit (BOC, Commercial Bank, Sampath, HNB) for immediate ledger clearance
                </p>
              </div>

              {/* Bank Transfer Form */}
              <form onSubmit={handleSubmitSlip} className="space-y-4">
                {slipSuccessMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{slipSuccessMsg}</span>
                  </div>
                )}

                {slipErrorMsg && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{slipErrorMsg}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Amount Paid (LKR / Rs.) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={slipAmount}
                      onChange={(e) => setSlipAmount(e.target.value)}
                      placeholder="e.g. 25000.00"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Deposit Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={slipDate}
                      onChange={(e) => setSlipDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Store Beneficiary Bank *
                    </label>
                    <select
                      value={slipBank}
                      onChange={(e) => setSlipBank(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="Bank of Ceylon (BOC)">Bank of Ceylon (BOC)</option>
                      <option value="Commercial Bank of Ceylon">Commercial Bank of Ceylon</option>
                      <option value="Hatton National Bank (HNB)">Hatton National Bank (HNB)</option>
                      <option value="Sampath Bank">Sampath Bank</option>
                      <option value="Seylan Bank">Seylan Bank</option>
                      <option value="Nations Trust Bank">Nations Trust Bank</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Transaction Reference / Cheque # *
                    </label>
                    <input
                      type="text"
                      required
                      value={slipRef}
                      onChange={(e) => setSlipRef(e.target.value)}
                      placeholder="e.g. BOC-TXN-998124 or Cheque # 482104"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Deposit Slip Image URL / Receipt Proof
                  </label>
                  <input
                    type="text"
                    value={slipImage}
                    onChange={(e) => setSlipImage(e.target.value)}
                    placeholder="e.g. https://... or leave blank if reference number is provided"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Additional Settlement Remarks (Optional)
                  </label>
                  <input
                    type="text"
                    value={slipNotes}
                    onChange={(e) => setSlipNotes(e.target.value)}
                    placeholder="e.g. Payment towards INV-2026-0104 and INV-2026-0091"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingSlip}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5"
                >
                  <Upload className="w-4 h-4" />
                  <span>{submittingSlip ? "Submitting Proof..." : "Submit Payment Slip for Verification"}</span>
                </button>
              </form>

              {/* History of Submitted Slips */}
              {paymentSlips.length > 0 && (
                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Recent Submitted Payment Slips ({paymentSlips.length})
                  </h4>

                  <div className="space-y-2">
                    {paymentSlips.map((slip: any) => (
                      <div
                        key={slip._id}
                        className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900">{slip.slipNumber}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                slip.status === "APPROVED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : slip.status === "PENDING"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {slip.status === "APPROVED"
                                ? "VERIFIED & CREDITED"
                                : slip.status === "PENDING"
                                ? "PENDING REVIEW"
                                : "REJECTED"}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            {slip.depositBank} • Ref #{slip.transactionReference} • {new Date(slip.paymentDate).toLocaleDateString("en-GB")}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="font-mono font-black text-slate-900 block">
                            {formatCurrency(slip.amount)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 5: VIP LOYALTY & REWARDS ================= */}
        {activeTab === "loyalty" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-6">
              {/* Digital VIP Membership Card */}
              <DigitalVipCard
                business={{
                  name: business.name,
                  phone: business.phone,
                  address: business.address,
                }}
                customer={{
                  _id: customer._id,
                  name: customer.name,
                  phone: customer.phone,
                  portalToken: token,
                  referralCode: customer.referralCode,
                }}
                loyalty={{
                  tier: customer.loyalty?.tier || "REGULAR",
                  points: customer.loyalty?.points || 0,
                  totalSpent: customer.totalSpent || 0,
                }}
                showSharing={true}
                showPrint={true}
              />

              {/* Referral Scheme Box */}
              {customer.referralCode && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                        VIP Corporate Referral Scheme
                      </h4>
                    </div>
                    <span className="text-xs font-mono font-bold text-amber-900 bg-amber-200 px-2 py-0.5 rounded">
                      Earn Points
                    </span>
                  </div>
                  <p className="text-xs text-amber-900">
                    Share your unique referral code with other corporate clients and earn bonus rewards on every wholesale order they place.
                  </p>
                  <div className="p-3 bg-white/90 rounded-xl border border-amber-200/80 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-mono">YOUR REFERRAL CODE</span>
                      <span className="text-base font-black font-mono text-slate-900 tracking-wider">
                        {customer.referralCode}
                      </span>
                    </div>
                    <div className="text-right font-mono text-xs">
                      <span className="text-slate-500 block text-[10px]">SUCCESSFUL REFERRALS</span>
                      <span className="font-bold text-amber-700">{customer.referralCount || 0} Clients</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 6: GIFT VOUCHER VERIFICATION ================= */}
        {activeTab === "voucher" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Gift className="w-4 h-4 text-purple-600" />
                  <span>Digital Gift Voucher Balance Enquiry</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Enter your Gift Voucher Code (e.g. GV-20261001-XXXX) to check remaining balance and expiry.
                </p>
              </div>

              {/* Voucher Code Form */}
              <form onSubmit={handleLookupVoucher} className="flex gap-2">
                <input
                  type="text"
                  value={voucherCodeInput}
                  onChange={(e) => setVoucherCodeInput(e.target.value)}
                  placeholder="e.g. GV-20261001-4921"
                  className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold tracking-wider uppercase focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  type="submit"
                  disabled={voucherLoading || !voucherCodeInput.trim()}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-sm"
                >
                  {voucherLoading ? "Checking..." : "Verify Voucher"}
                </button>
              </form>

              {voucherError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{voucherError}</span>
                </div>
              )}

              {/* Verified Voucher Card */}
              {voucherData && (
                <div className="mt-4 p-5 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl space-y-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-purple-100 pb-3">
                    <div>
                      <span className="text-[10px] font-bold text-purple-700 uppercase tracking-widest block">
                        Verified Digital Voucher
                      </span>
                      <span className="text-base font-black font-mono text-purple-950">
                        {voucherData.code}
                      </span>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-black uppercase ${
                        voucherData.status === "ACTIVE"
                          ? "bg-emerald-100 text-emerald-800"
                          : voucherData.status === "REDEEMED"
                          ? "bg-slate-200 text-slate-700"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {voucherData.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                    <div className="bg-white p-3 rounded-xl border border-purple-100">
                      <span className="text-[10px] text-slate-400 block font-sans">
                        REMAINING BALANCE
                      </span>
                      <span className="text-lg font-black text-purple-700">
                        {formatCurrency(voucherData.currentBalance)}
                      </span>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-purple-100">
                      <span className="text-[10px] text-slate-400 block font-sans">
                        ORIGINAL FACE VALUE
                      </span>
                      <span className="text-lg font-bold text-slate-800">
                        {formatCurrency(voucherData.initialAmount)}
                      </span>
                    </div>
                  </div>

                  {voucherData.expiryDate && (
                    <div className="text-xs text-purple-900 font-semibold flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-purple-600" />
                      <span>
                        Valid Until: {new Date(voucherData.expiryDate).toLocaleDateString("en-GB")}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Audit Stamp */}
        <div className="text-center text-[10px] text-slate-400 space-y-1 pt-4 pb-8">
          <p>Official Digital Statement • Sri Lanka POS Multi-Tenant SaaS Platform</p>
          <p className="font-mono">Security Token: {token.slice(0, 16)}...</p>
        </div>
      </div>
    </div>
  );
}
