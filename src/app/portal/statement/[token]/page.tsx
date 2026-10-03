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
  const [activeTab, setActiveTab] = useState<"credit" | "loyalty" | "voucher">("credit");
  const [copied, setCopied] = useState(false);
  const [txSearch, setTxSearch] = useState("");

  // Voucher Checker state
  const [voucherCodeInput, setVoucherCodeInput] = useState("");
  const [voucherData, setVoucherData] = useState<any | null>(null);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherError, setVoucherError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStatement() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/public/customer/statement?token=${token}`);
        const data = await res.json();

        if (data.success && data.statement) {
          setStatement(data.statement);
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

    if (token) {
      loadStatement();
    }
  }, [token]);

  const handlePrint = () => {
    window.print();
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
    } catch (err) {
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
          Verifying secure statement ledger...
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

  const { customer, business, transactions = [], recentInvoices = [] } = statement;
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

  return (
    <div className="min-h-screen bg-slate-100 py-4 sm:py-8 font-sans print:bg-white print:py-0">
      <div className="max-w-3xl mx-auto px-4 space-y-4">
        {/* On-Screen Action Bar */}
        <div className="no-print flex flex-wrap items-center justify-between gap-2 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {t("portal.portalTitle") || "Customer Self-Service"}
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

        {/* Store & Customer Header Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold tracking-wide uppercase border border-emerald-200 mb-2">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>Verified Merchant Ledger</span>
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

            {/* Customer ID & VIP Tier Tag */}
            <div className="sm:text-right bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-xl border sm:border-none border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Statement Account For
              </span>
              <div className="text-base font-bold text-slate-900">{customer.name}</div>
              <div className="text-xs font-mono text-slate-500">{customer.phone}</div>
              <div className="mt-1 flex sm:justify-end gap-1.5">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-amber-100 text-amber-900 border border-amber-200">
                  {customer.loyalty?.tier || "REGULAR"} VIP
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase bg-slate-200 text-slate-700">
                  {customer.customerType}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Tab Selector */}
          <div className="no-print flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold overflow-x-auto">
            <button
              onClick={() => setActiveTab("credit")}
              className={`flex-1 min-w-[120px] py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeTab === "credit"
                  ? "bg-white text-blue-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>{t("portal.creditLedger") || "Naya Potha (ණය)"}</span>
            </button>

            <button
              onClick={() => setActiveTab("loyalty")}
              className={`flex-1 min-w-[120px] py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeTab === "loyalty"
                  ? "bg-white text-blue-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Star className="w-3.5 h-3.5 text-amber-500" />
              <span>{t("portal.loyaltyRewards") || "Loyalty Points"}</span>
            </button>

            <button
              onClick={() => setActiveTab("voucher")}
              className={`flex-1 min-w-[120px] py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeTab === "voucher"
                  ? "bg-white text-blue-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Gift className="w-3.5 h-3.5 text-purple-500" />
              <span>{t("portal.giftVouchers") || "Gift Voucher Check"}</span>
            </button>
          </div>
        </div>

        {/* ================= TAB 1: NAYA POTHA CREDIT LEDGER ================= */}
        {activeTab === "credit" && (
          <div className="space-y-4">
            {/* 4 Financial KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Outstanding Balance */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {t("portal.outstandingDebt") || "Outstanding Debt"}
                </span>
                <div
                  className={`text-lg sm:text-xl font-black font-mono ${
                    customer.currentBalance > 0 ? "text-rose-600" : "text-emerald-600"
                  }`}
                >
                  {formatCurrency(customer.currentBalance)}
                </div>
                <div className="text-[10px] text-slate-500">
                  {customer.currentBalance > 0 ? "Payment Pending" : "All Dues Cleared"}
                </div>
              </div>

              {/* Credit Limit */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {t("portal.creditLimit") || "Credit Limit"}
                </span>
                <div className="text-lg sm:text-xl font-black font-mono text-slate-900">
                  {formatCurrency(customer.creditLimit)}
                </div>
                <div className="text-[10px] text-slate-500">Store Approved Limit</div>
              </div>

              {/* Available Credit */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {t("portal.availableCredit") || "Available Credit"}
                </span>
                <div className="text-lg sm:text-xl font-black font-mono text-blue-600">
                  {formatCurrency(customer.availableCredit)}
                </div>
                <div className="text-[10px] text-slate-500">Available For Purchases</div>
              </div>

              {/* Account Status Badge */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {t("portal.accountStatus") || "Account Status"}
                </span>
                <div className="pt-1">
                  {customer.accountStatus === "CLEAR" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{t("portal.statusClear") || "CLEAR"}</span>
                    </span>
                  )}
                  {customer.accountStatus === "ACTIVE" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-100 text-blue-800">
                      <Clock className="w-3.5 h-3.5" />
                      <span>IN GOOD STANDING</span>
                    </span>
                  )}
                  {customer.accountStatus === "OVER_LIMIT" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-100 text-rose-800">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>LIMIT EXCEEDED</span>
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 pt-0.5">Verified Ledger</div>
              </div>
            </div>

            {/* Direct Bank Settlement Information Box */}
            {business.bankDetails?.accountNumber && customer.currentBalance > 0 && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-blue-950 font-bold text-sm">
                    <Landmark className="w-4 h-4 text-blue-600" />
                    <span>Direct Bank Transfer Settlement Details</span>
                  </div>
                  <span className="text-[10px] font-bold bg-blue-200 text-blue-900 px-2 py-0.5 rounded">
                    BACS / CEFT
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono text-slate-700 bg-white/80 p-3 rounded-xl border border-blue-100">
                  <div>
                    <span className="text-slate-400 block text-[10px]">BANK NAME</span>
                    <span className="font-bold text-slate-900">{business.bankDetails.bankName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">BRANCH</span>
                    <span className="font-semibold">{business.bankDetails.branchName || "Main"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">ACCOUNT NUMBER</span>
                    <span className="font-bold text-blue-700 text-sm">
                      {business.bankDetails.accountNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">BENEFICIARY</span>
                    <span className="font-semibold">
                      {business.bankDetails.accountName || business.name}
                    </span>
                  </div>
                </div>

                {business.phone && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <p className="text-blue-800 text-[11px]">
                      After transferring, please share your payment receipt on WhatsApp for instant clearance.
                    </p>
                    <a
                      href={`https://wa.me/${business.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                        `Hi ${business.name}, I have transferred a debt settlement of Rs. ${customer.currentBalance} for customer ${customer.name} (${customer.phone}). Please find my deposit slip attached.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 transition"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Send Slip on WhatsApp</span>
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Itemized Naya Potha Credit Ledger Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Naya Potha Transaction Ledger (ණය ගිණුම් සටහන)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Live balance records, credit purchases, and settlement receipts
                  </p>
                </div>

                {/* Filter Search */}
                <div className="relative min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={txSearch}
                    onChange={(e) => setTxSearch(e.target.value)}
                    placeholder="Search ref or invoice..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {filteredTransactions.length === 0 ? (
                <div className="p-8 text-center space-y-2 text-slate-500">
                  <Receipt className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs font-semibold">No credit transactions recorded yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 overflow-x-auto">
                  {filteredTransactions.map((tx: any, idx: number) => {
                    const isPayment = tx.type === "PAYMENT";
                    const isCreditSale = tx.type === "CREDIT_SALE";

                    return (
                      <div
                        key={idx}
                        className="p-3.5 sm:p-4 hover:bg-slate-50/80 transition flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                              isPayment
                                ? "bg-emerald-100 text-emerald-700"
                                : isCreditSale
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {isPayment ? (
                              <ArrowDownRight className="w-4 h-4" />
                            ) : (
                              <ArrowUpRight className="w-4 h-4" />
                            )}
                          </div>

                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 font-mono">
                                {tx.transactionNumber}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                  isPayment
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-amber-50 text-amber-800 border border-amber-200"
                                }`}
                              >
                                {isPayment ? "Debt Payment" : "Credit Purchase"}
                              </span>
                            </div>

                            <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2">
                              <span>{formatSLDateTime(tx.createdAt)}</span>
                              {tx.performedBy && <span>• By {tx.performedBy}</span>}
                              {tx.paymentMethod && (
                                <span className="uppercase font-semibold">
                                  • Mode: {tx.paymentMethod}
                                </span>
                              )}
                            </div>

                            {tx.notes && (
                              <div className="text-[10px] text-slate-600 italic">
                                Note: {tx.notes}
                              </div>
                            )}

                            {tx.invoiceNumber && (
                              <div className="pt-0.5">
                                <Link
                                  href={`/receipt/${tx.invoiceNumber}`}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800"
                                >
                                  <span>View E-Receipt ({tx.invoiceNumber})</span>
                                  <ExternalLink className="w-3 h-3" />
                                </Link>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Amount & Running Balance */}
                        <div className="text-right shrink-0 font-mono">
                          <div
                            className={`text-sm font-bold ${
                              isPayment ? "text-emerald-700" : "text-slate-900"
                            }`}
                          >
                            {isPayment ? "-" : "+"}
                            {formatCurrency(tx.amount)}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Bal: {formatCurrency(tx.balanceAfter)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent Purchases & Digital Invoices Section */}
            {recentInvoices.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Recent Purchase Invoices ({recentInvoices.length})
                  </h3>
                  <span className="text-[10px] text-slate-400">Tap to inspect items</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {recentInvoices.map((inv: any, idx: number) => (
                    <Link
                      key={idx}
                      href={`/receipt/${inv._id}`}
                      className="p-3 bg-slate-50 hover:bg-blue-50/60 border border-slate-200 rounded-xl transition text-xs flex items-center justify-between gap-2"
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-900 font-mono">
                          {inv.invoiceNumber}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(inv.createdAt).toLocaleDateString()} • {inv.itemCount} items
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="font-bold text-slate-900">
                          {formatCurrency(inv.netTotal)}
                        </div>
                        <span className="text-[9px] font-bold uppercase text-blue-600">
                          View Receipt →
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: LOYALTY REWARDS CLUB ================= */}
        {activeTab === "loyalty" && (() => {
          const totalSpent = customer.totalSpent || 0;
          const currentTier = customer.loyalty?.tier || "REGULAR";
          let nextTier = "SILVER";
          let nextTierName = "Silver VIP";
          let nextTierMultiplier = 1.25;
          let threshold = 25000;
          let prevMin = 0;

          if (currentTier === "SILVER") {
            nextTier = "GOLD";
            nextTierName = "Gold VIP";
            nextTierMultiplier = 1.5;
            threshold = 75000;
            prevMin = 25000;
          } else if (currentTier === "GOLD") {
            nextTier = "PLATINUM";
            nextTierName = "Platinum Elite";
            nextTierMultiplier = 2.0;
            threshold = 150000;
            prevMin = 75000;
          } else if (currentTier === "PLATINUM") {
            nextTier = "";
            nextTierName = "Elite Achieved";
            nextTierMultiplier = 2.0;
            threshold = 150000;
            prevMin = 150000;
          }

          const amountNeeded = Math.max(0, threshold - totalSpent);
          const progressPercent = currentTier === "PLATINUM" ? 100 : Math.min(100, Math.max(0, Math.round(((totalSpent - prevMin) / (threshold - prevMin || 1)) * 100)));

          return (
            <div className="space-y-4">
              <DigitalVipCard
                customer={{
                  name: customer.name,
                  phone: customer.phone,
                  email: customer.email,
                  portalToken: token,
                  referralCode: customer.referralCode || customer.loyalty?.referralCode || "REF-VIP",
                  referralCount: customer.referralCount || customer.loyalty?.referralCount || 0,
                  referralPointsEarned: customer.referralPointsEarned || customer.loyalty?.referralPointsEarned || 0,
                  vipCardIssuedAt: customer.vipCardIssuedAt,
                }}
                loyalty={{
                  tier: currentTier,
                  points: customer.loyalty?.points || 0,
                  monetaryEquivalent: customer.loyalty?.monetaryEquivalent || customer.loyalty?.points || 0,
                  lifetimeEarned: customer.loyalty?.lifetimeEarned || 0,
                  totalSpent,
                }}
                progression={{
                  nextTier: currentTier === "PLATINUM" ? null : nextTier,
                  nextTierName,
                  nextTierMultiplier,
                  amountNeeded,
                  progressPercent,
                }}
                business={business}
                showSharing={true}
                showPrint={true}
              />

            {/* How to Redeem & Tier Benefits Guide */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Rewards Benefits & Instant Redemption</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="font-bold text-slate-900">1. Earn On Every Rupee</div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Accumulate 1 loyalty point for every Rs. 100 spent at any branch or online counter.
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="font-bold text-slate-900">2. Instant Counter Cash-Off</div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Tell the cashier your mobile number at checkout to deduct points directly from your bill.
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="font-bold text-slate-900">3. VIP Tier Upgrades</div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Reach Silver, Gold, or Platinum to unlock exclusive wholesale pricing and festive bonus days.
                  </p>
                </div>
              </div>
            </div>
            </div>
          );
        })()}

        {/* ================= TAB 3: GIFT VOUCHER BALANCE CHECKER ================= */}
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

                  {/* Redemptions History */}
                  {voucherData.redemptions && voucherData.redemptions.length > 0 && (
                    <div className="pt-2 border-t border-purple-100 space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Redemption History
                      </span>
                      <div className="space-y-1">
                        {voucherData.redemptions.map((r: any, idx: number) => (
                          <div
                            key={idx}
                            className="bg-white/90 p-2 rounded-lg text-[11px] font-mono flex justify-between"
                          >
                            <span>
                              {new Date(r.redeemedAt).toLocaleDateString()} {r.invoiceNumber && `(${r.invoiceNumber})`}
                            </span>
                            <span className="font-bold text-rose-600">
                              -{formatCurrency(r.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
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
