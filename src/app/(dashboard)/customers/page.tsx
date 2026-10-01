"use client";

import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  Calendar,
  History,
  Edit2,
  X,
  CheckCircle2,
  AlertCircle,
  Receipt,
  ArrowRight,
  TrendingUp,
  BookOpen,
  CreditCard,
  ArrowDownRight,
  ArrowUpRight,
  FileText,
  Printer,
  Wallet,
  ShieldCheck,
  AlertTriangle,
  MessageSquare,
  Send,
  Check,
  Copy,
  Award,
  Gift,
  Crown,
  Sparkles,
  Star,
  Cake,
  Tag,
} from "lucide-react";
import { formatCurrency, formatSLDateTime, isValidSLPhone } from "@/lib/formatters";
import CreditSettlementReceipt, { CreditSettlementData } from "@/components/receipts/CreditSettlementReceipt";
import GiftVoucherReceipt from "@/components/receipts/GiftVoucherReceipt";
import { buildWhatsAppUrl } from "@/lib/notifications";

interface CustomerRecord {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  totalSpent: number;
  visitCount: number;
  lastVisit?: string;
  notes?: string;
  creditAllowed?: boolean;
  creditLimit?: number;
  currentBalance?: number;
  nicNumber?: string;
  lastReminderSentAt?: string;
  reminderCount?: number;
  loyaltyTier?: "REGULAR" | "SILVER" | "GOLD" | "PLATINUM";
  loyaltyPoints?: number;
  lifetimePointsEarned?: number;
  lifetimePointsRedeemed?: number;
  dateOfBirth?: string;
}

interface SummaryData {
  totalCustomers: number;
  totalRevenue: number;
  averageSpend: number;
  totalOutstandingCredit?: number;
  creditCustomersCount?: number;
  debtorsCount?: number;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [summary, setSummary] = useState<SummaryData>({
    totalCustomers: 0,
    totalRevenue: 0,
    averageSpend: 0,
    totalOutstandingCredit: 0,
    creditCustomersCount: 0,
    debtorsCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"DIRECTORY" | "NAYA_POTHA" | "LOYALTY" | "GIFT_VOUCHERS">("DIRECTORY");
  const [creditFilter, setCreditFilter] = useState<"ALL" | "DEBTORS_ONLY" | "NEAR_LIMIT">("ALL");

  // Modals State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRecord | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
    creditAllowed: false,
    creditLimit: "10000",
    nicNumber: "",
    dateOfBirth: "",
    loyaltyTier: "REGULAR" as "REGULAR" | "SILVER" | "GOLD" | "PLATINUM",
  });

  // Loyalty Management State
  const [isAdjustPointsModalOpen, setIsAdjustPointsModalOpen] = useState(false);
  const [adjustCustomer, setAdjustCustomer] = useState<CustomerRecord | null>(null);
  const [adjustPoints, setAdjustPoints] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [submittingPoints, setSubmittingPoints] = useState(false);

  const [isPointsLedgerModalOpen, setIsPointsLedgerModalOpen] = useState(false);
  const [pointsLedgerCustomer, setPointsLedgerCustomer] = useState<CustomerRecord | null>(null);
  const [pointsTransactions, setPointsTransactions] = useState<any[]>([]);
  const [loadingPointsLedger, setLoadingPointsLedger] = useState(false);

  // Gift Vouchers State
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [voucherStats, setVoucherStats] = useState<any>({
    totalIssuedCount: 0,
    activeCount: 0,
    activeBalanceTotal: 0,
    redeemedTotal: 0,
    expiredCount: 0,
  });
  const [loadingVouchers, setLoadingVouchers] = useState(false);
  const [voucherSearch, setVoucherSearch] = useState("");
  const [voucherStatusFilter, setVoucherStatusFilter] = useState("ALL");

  const [isIssueVoucherModalOpen, setIsIssueVoucherModalOpen] = useState(false);
  const [issueVoucherForm, setIssueVoucherForm] = useState({
    initialAmount: "1000",
    recipientName: "",
    recipientPhone: "",
    customerId: "",
    expiryDate: "",
    notes: "",
  });
  const [submittingVoucher, setSubmittingVoucher] = useState(false);
  const [activePrintedVoucher, setActivePrintedVoucher] = useState<any | null>(null);
  const [selectedVoucherHistory, setSelectedVoucherHistory] = useState<any | null>(null);

  // History Modal State
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const [customerPurchases, setCustomerPurchases] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Credit Payment / Debt Settlement Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentCustomer, setPaymentCustomer] = useState<CustomerRecord | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "QR" | "BANK_TRANSFER">("CASH");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Passbook Statement / Ledger Modal State
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [ledgerCustomer, setLedgerCustomer] = useState<CustomerRecord | null>(null);
  const [ledgerTransactions, setLedgerTransactions] = useState<any[]>([]);
  const [ledgerSummary, setLedgerSummary] = useState<any>(null);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Thermal Slip Modal State
  const [activeSettlementSlip, setActiveSettlementSlip] = useState<CreditSettlementData | null>(null);

  // WhatsApp Debt Reminder Modal State
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [reminderCustomer, setReminderCustomer] = useState<CustomerRecord | null>(null);
  const [reminderMessage, setReminderMessage] = useState("");
  const [reminderUrl, setReminderUrl] = useState("");
  const [loadingReminder, setLoadingReminder] = useState(false);
  const [copiedReminder, setCopiedReminder] = useState(false);

  // Feedback Toast
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const openReminderModal = async (customer: CustomerRecord) => {
    setReminderCustomer(customer);
    setIsReminderModalOpen(true);
    setLoadingReminder(true);
    setCopiedReminder(false);
    try {
      const res = await fetch(`/api/customers/${customer._id}/remind`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setReminderMessage(data.messageText);
        setReminderUrl(data.whatsappUrl);
        setCustomers((prev) =>
          prev.map((c) =>
            c._id === customer._id
              ? {
                  ...c,
                  lastReminderSentAt: data.customer.lastReminderSentAt,
                  reminderCount: data.customer.reminderCount,
                }
              : c
          )
        );
      } else {
        alert(data.error || "Failed to generate reminder.");
        setIsReminderModalOpen(false);
      }
    } catch {
      alert("Failed to communicate with reminder service.");
      setIsReminderModalOpen(false);
    } finally {
      setLoadingReminder(false);
    }
  };

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/customers?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data.success) {
        setCustomers(data.customers || []);
        if (data.summary) setSummary(data.summary);
      }
    } catch {
      console.error("Failed to load customers.");
    } finally {
      setLoading(false);
    }
  };

  const loadVouchers = async () => {
    try {
      setLoadingVouchers(true);
      const res = await fetch(`/api/gift-vouchers?q=${encodeURIComponent(voucherSearch)}&status=${voucherStatusFilter}`);
      const data = await res.json();
      if (data.success) {
        setVouchers(data.vouchers || []);
        if (data.stats) setVoucherStats(data.stats);
      }
    } catch {
      console.error("Failed to load gift vouchers.");
    } finally {
      setLoadingVouchers(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [searchQuery]);

  useEffect(() => {
    if (activeTab === "GIFT_VOUCHERS") {
      loadVouchers();
    }
  }, [activeTab, voucherSearch, voucherStatusFilter]);

  const openNewModal = () => {
    setEditingCustomer(null);
    setFormData({
      name: "",
      phone: "",
      email: "",
      address: "",
      notes: "",
      creditAllowed: false,
      creditLimit: "10000",
      nicNumber: "",
      dateOfBirth: "",
      loyaltyTier: "REGULAR",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (c: CustomerRecord) => {
    setEditingCustomer(c);
    setFormData({
      name: c.name,
      phone: c.phone,
      email: c.email || "",
      address: c.address || "",
      notes: c.notes || "",
      creditAllowed: Boolean(c.creditAllowed),
      creditLimit: (c.creditLimit || 0).toString(),
      nicNumber: c.nicNumber || "",
      dateOfBirth: c.dateOfBirth ? new Date(c.dateOfBirth).toISOString().slice(0, 10) : "",
      loyaltyTier: c.loyaltyTier || "REGULAR",
    });
    setIsModalOpen(true);
  };

  const openAdjustPointsModal = (c: CustomerRecord) => {
    setAdjustCustomer(c);
    setAdjustPoints("");
    setAdjustReason("");
    setIsAdjustPointsModalOpen(true);
  };

  const handleAdjustPointsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustCustomer) return;
    const pts = parseInt(adjustPoints, 10);
    if (isNaN(pts) || pts === 0) {
      alert("Please enter a valid non-zero points adjustment (e.g. 50 or -20).");
      return;
    }

    setSubmittingPoints(true);
    try {
      const res = await fetch("/api/loyalty/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: adjustCustomer._id,
          points: pts,
          notes: adjustReason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: "success",
          text: data.message || `Successfully adjusted points for ${adjustCustomer.name}.`,
        });
        setIsAdjustPointsModalOpen(false);
        loadCustomers();
      } else {
        alert(data.error || "Failed to adjust points.");
      }
    } catch {
      alert("Network error adjusting points.");
    } finally {
      setSubmittingPoints(false);
    }
  };

  const openPointsLedgerModal = async (c: CustomerRecord) => {
    setPointsLedgerCustomer(c);
    setIsPointsLedgerModalOpen(true);
    setLoadingPointsLedger(true);
    try {
      const res = await fetch(`/api/loyalty/transactions?customerId=${c._id}`);
      const data = await res.json();
      if (data.success) {
        setPointsTransactions(data.transactions || []);
      }
    } catch {
      console.error("Failed to load points ledger.");
    } finally {
      setLoadingPointsLedger(false);
    }
  };

  const handleIssueVoucherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(issueVoucherForm.initialAmount);
    if (isNaN(amt) || amt <= 0) {
      alert("Please enter a valid voucher amount greater than 0.");
      return;
    }

    setSubmittingVoucher(true);
    try {
      const res = await fetch("/api/gift-vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initialAmount: amt,
          recipientName: issueVoucherForm.recipientName.trim() || undefined,
          recipientPhone: issueVoucherForm.recipientPhone.trim() || undefined,
          customerId: issueVoucherForm.customerId || undefined,
          expiryDate: issueVoucherForm.expiryDate || undefined,
          notes: issueVoucherForm.notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: "success",
          text: data.message || `Gift voucher ${data.voucher?.code} created successfully.`,
        });
        setIsIssueVoucherModalOpen(false);
        setIssueVoucherForm({
          initialAmount: "1000",
          recipientName: "",
          recipientPhone: "",
          customerId: "",
          expiryDate: "",
          notes: "",
        });
        loadVouchers();
        // Offer instant print
        if (data.voucher) {
          setActivePrintedVoucher(data.voucher);
        }
      } else {
        alert(data.error || "Failed to create gift voucher.");
      }
    } catch {
      alert("Network error creating gift voucher.");
    } finally {
      setSubmittingVoucher(false);
    }
  };

  const handleCancelVoucher = async (code: string) => {
    if (!confirm(`Are you sure you want to cancel Gift Voucher "${code}"? This will disable any remaining balance.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/gift-vouchers/${code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CANCEL", notes: "Cancelled by store manager" }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: "success", text: `Gift voucher ${code} has been cancelled.` });
        loadVouchers();
      } else {
        alert(data.error || "Failed to cancel voucher.");
      }
    } catch {
      alert("Network error cancelling voucher.");
    }
  };

  const openHistoryModal = async (c: CustomerRecord) => {
    setSelectedCustomer(c);
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/customers/${c._id}`);
      const data = await res.json();
      if (data.success) {
        setCustomerPurchases(data.purchases || []);
      }
    } catch {
      console.error("Failed to load history.");
    } finally {
      setLoadingHistory(false);
    }
  };

  const openPaymentModal = (c: CustomerRecord) => {
    setPaymentCustomer(c);
    setPaymentAmount(c.currentBalance && c.currentBalance > 0 ? c.currentBalance.toString() : "");
    setPaymentMethod("CASH");
    setPaymentRef("");
    setPaymentNotes("");
    setIsPaymentModalOpen(true);
  };

  const openLedgerModal = async (c: CustomerRecord) => {
    setLedgerCustomer(c);
    setIsLedgerModalOpen(true);
    setLoadingLedger(true);
    try {
      const res = await fetch(`/api/customers/${c._id}/credit`);
      const data = await res.json();
      if (data.success) {
        setLedgerTransactions(data.transactions || []);
        setLedgerSummary(data.summary || null);
      }
    } catch {
      console.error("Failed to load customer passbook ledger.");
    } finally {
      setLoadingLedger(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValidSLPhone(formData.phone)) {
      setStatusMessage({
        type: "error",
        text: "Please enter a valid Sri Lankan phone number (e.g. 0771234567 or +94771234567).",
      });
      return;
    }

    setSubmitting(true);
    setStatusMessage(null);

    try {
      const url = editingCustomer ? `/api/customers/${editingCustomer._id}` : "/api/customers";
      const method = editingCustomer ? "PUT" : "POST";

      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || undefined,
        address: formData.address.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        creditAllowed: formData.creditAllowed,
        creditLimit: parseFloat(formData.creditLimit) || 0,
        nicNumber: formData.nicNumber.trim() || undefined,
        dateOfBirth: formData.dateOfBirth ? formData.dateOfBirth : undefined,
        loyaltyTier: formData.loyaltyTier,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        setStatusMessage({
          type: "success",
          text: editingCustomer ? "Customer updated successfully." : "Customer profile created.",
        });
        setIsModalOpen(false);
        loadCustomers();
      } else {
        setStatusMessage({ type: "error", text: data.error || "Failed to save customer." });
      }
    } catch {
      setStatusMessage({ type: "error", text: "Network error saving customer." });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentCustomer) return;

    const amt = parseFloat(paymentAmount) || 0;
    if (amt <= 0) {
      alert("Payment amount must be greater than zero.");
      return;
    }

    setSubmittingPayment(true);
    try {
      const res = await fetch(`/api/customers/${paymentCustomer._id}/credit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amt,
          paymentMethod,
          paymentReference: paymentRef.trim() || undefined,
          notes: paymentNotes.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setIsPaymentModalOpen(false);
        setStatusMessage({
          type: "success",
          text: `Payment of ${formatCurrency(amt)} recorded for ${paymentCustomer.name}.`,
        });

        // Prepare thermal settlement slip
        const slip: CreditSettlementData = {
          transactionNumber: data.transaction?.transactionNumber || `CR-PAY-${Date.now()}`,
          customerName: paymentCustomer.name,
          customerPhone: paymentCustomer.phone,
          customerNic: paymentCustomer.nicNumber,
          previousBalance: data.customer?.previousBalance ?? paymentCustomer.currentBalance ?? 0,
          amountPaid: amt,
          remainingBalance: data.customer?.currentBalance ?? Math.max(0, (paymentCustomer.currentBalance || 0) - amt),
          paymentMethod,
          paymentReference: paymentRef.trim() || undefined,
          notes: paymentNotes.trim() || undefined,
          cashierName: "Store Cashier",
          createdAt: new Date(),
        };

        setActiveSettlementSlip(slip);
        loadCustomers();
      } else {
        alert(data.error || "Failed to process payment.");
      }
    } catch (err: any) {
      alert(err.message || "Network error processing debt payment.");
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Filtered lists
  const creditAccounts = customers.filter((c) => c.creditAllowed);
  const displayedCreditAccounts = creditAccounts.filter((c) => {
    const bal = c.currentBalance || 0;
    const limit = c.creditLimit || 0;
    if (creditFilter === "DEBTORS_ONLY") return bal > 0;
    if (creditFilter === "NEAR_LIMIT") return limit > 0 && bal / limit >= 0.8;
    return true;
  });

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Top Header & Tab Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                {activeTab === "NAYA_POTHA" ? (
                  <BookOpen className="w-6 h-6 text-amber-600" />
                ) : activeTab === "LOYALTY" ? (
                  <Crown className="w-6 h-6 text-purple-600" />
                ) : activeTab === "GIFT_VOUCHERS" ? (
                  <Gift className="w-6 h-6 text-emerald-600" />
                ) : (
                  <Users className="w-6 h-6 text-blue-600" />
                )}
                {activeTab === "NAYA_POTHA"
                  ? "Naya Potha (Credit Accounts)"
                  : activeTab === "LOYALTY"
                  ? "Loyalty Rewards & VIP Tiers"
                  : activeTab === "GIFT_VOUCHERS"
                  ? "Digital Gift Vouchers Hub"
                  : "Customer Directory"}
              </h1>
              {activeTab === "NAYA_POTHA" && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  ණය පොත
                </span>
              )}
              {activeTab === "LOYALTY" && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-900 border border-purple-300">
                  Nexus / Cargills Style
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {activeTab === "NAYA_POTHA"
                ? "Traditional digital credit book for neighborhood stores. Track customer limits, credit sales, and debt settlements."
                : activeTab === "LOYALTY"
                ? "Track customer reward points, tiered spend multipliers (Regular, Silver, Gold, Platinum), and Birthday bonuses."
                : activeTab === "GIFT_VOUCHERS"
                ? "Issue and manage digital gift vouchers (GV-YYYYMMDD-XXXX), track balances, reprint slips, and manage counter redemptions."
                : "Manage Sri Lankan customer contact details, purchase frequency, and loyalty records."}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap sm:flex-nowrap">
            {/* View Switcher Tabs */}
            <div className="flex p-1 bg-slate-100 rounded-xl text-xs font-semibold overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab("DIRECTORY")}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  activeTab === "DIRECTORY"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span>Customers</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("NAYA_POTHA")}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition relative ${
                  activeTab === "NAYA_POTHA"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Naya Potha</span>
                {(summary.totalOutstandingCredit || 0) > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold ${
                      activeTab === "NAYA_POTHA" ? "bg-amber-800 text-amber-100" : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    Rs. {Math.round((summary.totalOutstandingCredit || 0) / 1000)}k
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("LOYALTY")}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  activeTab === "LOYALTY"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Crown className="w-3.5 h-3.5" />
                <span>Loyalty & VIP</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("GIFT_VOUCHERS")}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  activeTab === "GIFT_VOUCHERS"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Gift className="w-3.5 h-3.5" />
                <span>Gift Vouchers</span>
                {voucherStats?.activeCount > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold ${
                      activeTab === "GIFT_VOUCHERS"
                        ? "bg-emerald-800 text-emerald-100"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {voucherStats.activeCount}
                  </span>
                )}
              </button>
            </div>

            {activeTab === "GIFT_VOUCHERS" ? (
              <button
                onClick={() => setIsIssueVoucherModalOpen(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Issue Gift Voucher</span>
              </button>
            ) : (
              <button
                onClick={openNewModal}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Customer</span>
              </button>
            )}
          </div>
        </div>

        {/* Feedback Alert */}
        {statusMessage && (
          <div
            className={`p-4 rounded-xl text-xs flex items-center justify-between ${
              statusMessage.type === "success"
                ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                : "bg-rose-50 border border-rose-200 text-rose-800"
            }`}
          >
            <div className="flex items-center gap-2.5 font-medium">
              {statusMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button onClick={() => setStatusMessage(null)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ================= TAB 1: ALL CUSTOMERS DIRECTORY ================= */}
        {activeTab === "DIRECTORY" && (
          <div className="space-y-6">
            {/* 3 Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-slate-500 text-xs font-medium block">Total Customers</span>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {summary.totalCustomers} <span className="text-sm font-normal text-slate-500">profiles</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Registered in store directory</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-slate-500 text-xs font-medium block">Total Customer Revenue</span>
                <div className="text-2xl font-black text-blue-950 font-mono mt-1">
                  {formatCurrency(summary.totalRevenue)}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Cumulative spend across all visits</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-slate-500 text-xs font-medium block">Average Spend per Customer</span>
                <div className="text-2xl font-black text-emerald-700 font-mono mt-1">
                  {formatCurrency(summary.averageSpend)}
                </div>
                <p className="text-[11px] text-emerald-600 mt-1">Average basket value per shopper</p>
              </div>
            </div>

            {/* Search Toolbar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="relative max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search customer by name, Sri Lankan phone, or email..."
                  className="w-full pl-10 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Customers Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                    <tr>
                      <th className="py-3 px-4">Customer Name</th>
                      <th className="py-3 px-4">Phone Number</th>
                      <th className="py-3 px-4">Credit Status</th>
                      <th className="py-3 px-4 text-center">Visits</th>
                      <th className="py-3 px-4 text-right">Lifetime Spend</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          Loading customer directory...
                        </td>
                      </tr>
                    ) : customers.length > 0 ? (
                      customers.map((c) => (
                        <tr key={c._id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">{c.name}</div>
                            {c.address && <div className="text-[10px] text-slate-400">{c.address}</div>}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-700">
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{c.phone}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {c.creditAllowed ? (
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                                  Naya: {formatCurrency(c.currentBalance || 0)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Cash Only</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-slate-900 font-mono">
                            {c.visitCount}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900 font-mono">
                            {formatCurrency(c.totalSpent)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {c.creditAllowed && (
                                <button
                                  onClick={() => openLedgerModal(c)}
                                  title="Credit Statement"
                                  className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold rounded-lg text-[10px] transition-colors flex items-center gap-1 border border-amber-200"
                                >
                                  <BookOpen className="w-3 h-3 text-amber-600" />
                                  <span>Ledger</span>
                                </button>
                              )}
                              <button
                                onClick={() => openHistoryModal(c)}
                                title="Purchase History"
                                className="px-2 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 font-medium rounded-lg text-[10px] transition-colors flex items-center gap-1"
                              >
                                <History className="w-3 h-3" />
                                <span>History</span>
                              </button>
                              <button
                                onClick={() => openEditModal(c)}
                                title="Edit Customer"
                                className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          No customer profiles found. Add customers to track lifetime loyalty!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: NAYA POTHA (CREDIT ACCOUNTS) ================= */}
        {activeTab === "NAYA_POTHA" && (
          <div className="space-y-6">
            {/* Credit KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-amber-950 text-white p-5 rounded-2xl shadow-inner space-y-1">
                <span className="text-amber-300 text-xs font-semibold uppercase tracking-wider block">
                  Total Outstanding Debt (ණය ශේෂය)
                </span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-amber-400">
                  {formatCurrency(summary.totalOutstandingCredit || 0)}
                </div>
                <p className="text-[11px] text-amber-200/80">
                  Sum of uncollected customer credit balances across the store
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-slate-500 text-xs font-medium block">Active Debtors</span>
                <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
                  {summary.debtorsCount || 0}
                  <span className="text-sm font-normal text-slate-500 ml-1">
                    of {summary.creditCustomersCount || 0} credit accounts
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Patrons carrying an unpaid balance</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-slate-500 text-xs font-medium block">Credit Limit Headroom</span>
                <div className="text-2xl font-black text-emerald-700 font-mono mt-1">
                  {formatCurrency(
                    creditAccounts.reduce((sum, c) => sum + (c.creditLimit || 0), 0) -
                      (summary.totalOutstandingCredit || 0)
                  )}
                </div>
                <p className="text-[11px] text-emerald-600 mt-1">Remaining authorized store credit</p>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Filter:</span>
                <button
                  type="button"
                  onClick={() => setCreditFilter("ALL")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    creditFilter === "ALL"
                      ? "bg-slate-900 text-white shadow-2xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  All Accounts ({creditAccounts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCreditFilter("DEBTORS_ONLY")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    creditFilter === "DEBTORS_ONLY"
                      ? "bg-rose-600 text-white shadow-2xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Active Debtors ({creditAccounts.filter((c) => (c.currentBalance || 0) > 0).length})
                </button>
                <button
                  type="button"
                  onClick={() => setCreditFilter("NEAR_LIMIT")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    creditFilter === "NEAR_LIMIT"
                      ? "bg-amber-600 text-white shadow-2xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Near / Over Limit (&ge;80%)
                </button>
              </div>

              <div className="relative max-w-xs w-full">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search debtor name or phone..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Naya Potha Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                    <tr>
                      <th className="py-3 px-4">Patron Name & Contact</th>
                      <th className="py-3 px-4">NIC Number</th>
                      <th className="py-3 px-4 text-right">Credit Limit</th>
                      <th className="py-3 px-4 text-right">Current Debt (හිඟ මුදල)</th>
                      <th className="py-3 px-4 min-w-[140px]">Utilization</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedCreditAccounts.length > 0 ? (
                      displayedCreditAccounts.map((c) => {
                        const bal = c.currentBalance || 0;
                        const limit = c.creditLimit || 0;
                        const pct = limit > 0 ? Math.min(100, Math.round((bal / limit) * 100)) : 0;
                        const isHigh = pct >= 80;
                        const isFull = pct >= 100;

                        return (
                          <tr key={c._id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-slate-900">{c.name}</div>
                              <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span>{c.phone}</span>
                              </div>
                              {c.lastReminderSentAt && (
                                <div className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
                                  <MessageSquare className="w-2.5 h-2.5 text-emerald-500" />
                                  <span>Reminded {formatSLDateTime(c.lastReminderSentAt).split(",")[0]} ({c.reminderCount || 1}x)</span>
                                </div>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-[11px]">
                              {c.nicNumber ? (
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                                  {c.nicNumber}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-700">
                              {formatCurrency(limit)}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <span
                                className={`font-mono font-black text-sm px-2 py-0.5 rounded ${
                                  bal > 0
                                    ? isHigh
                                      ? "bg-rose-100 text-rose-900"
                                      : "bg-amber-100 text-amber-900"
                                    : "bg-emerald-50 text-emerald-800"
                                }`}
                              >
                                {formatCurrency(bal)}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="space-y-1">
                                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                                  <span>{pct}%</span>
                                  <span>Avail: {formatCurrency(Math.max(0, limit - bal))}</span>
                                </div>
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                  <div
                                    style={{ width: `${pct}%` }}
                                    className={`h-full transition-all rounded-full ${
                                      isFull ? "bg-rose-600" : isHigh ? "bg-amber-500" : "bg-emerald-500"
                                    }`}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {bal > 0 && (
                                  <>
                                    <button
                                      onClick={() => openReminderModal(c)}
                                      title="Send WhatsApp Debt Reminder"
                                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg text-[10px] transition-colors flex items-center gap-1 border border-emerald-200"
                                    >
                                      <MessageSquare className="w-3 h-3 text-emerald-600" />
                                      <span>Remind</span>
                                    </button>
                                    <button
                                      onClick={() => openPaymentModal(c)}
                                      title="Receive Payment (Naya Berima)"
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] transition-colors flex items-center gap-1 shadow-2xs"
                                    >
                                      <Wallet className="w-3 h-3" />
                                      <span>Settle Debt</span>
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => openLedgerModal(c)}
                                  title="View Passbook Ledger"
                                  className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-lg text-[10px] transition-colors flex items-center gap-1 border border-blue-200"
                                >
                                  <BookOpen className="w-3 h-3 text-blue-600" />
                                  <span>Passbook</span>
                                </button>
                                <button
                                  onClick={() => openEditModal(c)}
                                  title="Edit Credit Limit"
                                  className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          {creditAccounts.length === 0
                            ? "No credit accounts enabled. Edit a customer to activate Store Credit (Naya Potha)!"
                            : "No credit accounts match the selected filter."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: LOYALTY REWARDS & VIP TIERS ================= */}
        {activeTab === "LOYALTY" && (
          <div className="space-y-6">
            {/* Loyalty Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-xs font-medium">Store Loyalty Points</span>
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-purple-950 font-mono mt-2">
                  {customers.reduce((sum, c) => sum + (c.loyaltyPoints || 0), 0).toLocaleString()} <span className="text-sm font-normal text-slate-500">pts</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Available for customer redemptions</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-xs font-medium">Lifetime Points Earned</span>
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-blue-950 font-mono mt-2">
                  {customers.reduce((sum, c) => sum + (c.lifetimePointsEarned || 0), 0).toLocaleString()} <span className="text-sm font-normal text-slate-500">pts</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Accrued on Rs. 100 spend blocks</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-xs font-medium">Total Rewards Redeemed</span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Award className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-emerald-700 font-mono mt-2">
                  {formatCurrency(customers.reduce((sum, c) => sum + (c.lifetimePointsRedeemed || 0), 0))}
                </div>
                <p className="text-[11px] text-emerald-600 mt-1">Saved by shoppers via points discount</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-xs font-medium">VIP Tier Members</span>
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <Crown className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-amber-950 mt-2">
                  {customers.filter((c) => c.loyaltyTier && c.loyaltyTier !== "REGULAR").length}{" "}
                  <span className="text-sm font-normal text-slate-500">VIP shoppers</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Silver, Gold & Platinum members</p>
              </div>
            </div>

            {/* Loyalty Tier Rules Banner */}
            <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white p-5 rounded-2xl shadow-sm border border-purple-800/40">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-amber-400" />
                    <h3 className="font-extrabold text-sm sm:text-base tracking-tight">
                      Sri Lanka Tiered Loyalty Program Rules
                    </h3>
                  </div>
                  <p className="text-xs text-purple-200">
                    Nexus / Cargills style loyalty: Customers earn 1 base point per Rs. 100 spent (1 point = Rs. 1 discount at counter checkout).
                  </p>
                </div>
                <div className="flex items-center gap-2 bg-purple-950/60 px-3 py-2 rounded-xl border border-purple-700/50 text-xs">
                  <Cake className="w-4 h-4 text-pink-400 shrink-0" />
                  <span>
                    <strong className="text-amber-300">Birthday Month:</strong> 2.0x Double Points Multiplier!
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-purple-800/60 text-xs">
                <div className="bg-white/10 p-3 rounded-xl backdrop-blur-xs">
                  <div className="font-bold text-slate-300 flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-slate-300" />
                    <span>REGULAR</span>
                  </div>
                  <div className="text-base font-black mt-1">1.0x Points</div>
                  <div className="text-[10px] text-purple-200">Default enrollment</div>
                </div>

                <div className="bg-white/10 p-3 rounded-xl backdrop-blur-xs">
                  <div className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-slate-300" />
                    <span>SILVER</span>
                  </div>
                  <div className="text-base font-black mt-1">1.25x Points</div>
                  <div className="text-[10px] text-purple-200">Cumulative spend &gt; Rs. 25,000</div>
                </div>

                <div className="bg-white/10 p-3 rounded-xl backdrop-blur-xs">
                  <div className="font-bold text-amber-300 flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5 text-amber-300" />
                    <span>GOLD</span>
                  </div>
                  <div className="text-base font-black text-amber-200 mt-1">1.5x Points</div>
                  <div className="text-[10px] text-purple-200">Cumulative spend &gt; Rs. 75,000</div>
                </div>

                <div className="bg-white/10 p-3 rounded-xl backdrop-blur-xs border border-purple-400/30">
                  <div className="font-bold text-purple-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                    <span>PLATINUM</span>
                  </div>
                  <div className="text-base font-black text-purple-200 mt-1">2.0x Points</div>
                  <div className="text-[10px] text-purple-200">Cumulative spend &gt; Rs. 150,000</div>
                </div>
              </div>
            </div>

            {/* Customers Loyalty Ledger Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative max-w-sm w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search loyalty member by name or phone..."
                    className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div className="text-xs text-slate-500">
                  Showing <span className="font-bold text-slate-800">{customers.length}</span> loyalty accounts
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/75 text-slate-500 font-semibold">
                      <th className="py-3 px-4">Customer Details</th>
                      <th className="py-3 px-4">VIP Tier</th>
                      <th className="py-3 px-4 text-right">Available Points</th>
                      <th className="py-3 px-4 text-right">Points Earned / Redeemed</th>
                      <th className="py-3 px-4">Birthday Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {customers.length > 0 ? (
                      customers.map((c) => {
                        const tier = c.loyaltyTier || "REGULAR";
                        const pts = c.loyaltyPoints || 0;
                        const birthMonth = c.dateOfBirth ? new Date(c.dateOfBirth).getUTCMonth() : -1;
                        const isBdayMonth = birthMonth === new Date().getUTCMonth();

                        return (
                          <tr key={c._id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900">{c.name}</div>
                              <div className="text-slate-500 font-mono text-[11px] flex items-center gap-1.5 mt-0.5">
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span>{c.phone}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-[10px] tracking-wider uppercase ${
                                  tier === "PLATINUM"
                                    ? "bg-purple-100 text-purple-900 border border-purple-300"
                                    : tier === "GOLD"
                                    ? "bg-amber-100 text-amber-900 border border-amber-300"
                                    : tier === "SILVER"
                                    ? "bg-slate-200 text-slate-900 border border-slate-300"
                                    : "bg-blue-50 text-blue-800 border border-blue-200"
                                }`}
                              >
                                {tier === "PLATINUM" ? (
                                  <Sparkles className="w-3 h-3 text-purple-600" />
                                ) : tier === "GOLD" ? (
                                  <Crown className="w-3 h-3 text-amber-600" />
                                ) : (
                                  <Star className="w-3 h-3 text-slate-600" />
                                )}
                                <span>{tier}</span>
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono">
                              <span className="text-sm font-black text-purple-950 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200">
                                {pts.toLocaleString()} pts
                              </span>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                ≈ {formatCurrency(pts)} discount
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-[11px]">
                              <span className="text-emerald-700 font-semibold">
                                +{(c.lifetimePointsEarned || 0).toLocaleString()}
                              </span>{" "}
                              /{" "}
                              <span className="text-slate-500">
                                -{(c.lifetimePointsRedeemed || 0).toLocaleString()}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {c.dateOfBirth ? (
                                <div className="space-y-0.5">
                                  <div className="text-[11px] text-slate-700">
                                    {new Date(c.dateOfBirth).toLocaleDateString("en-LK", {
                                      month: "short",
                                      day: "numeric",
                                    })}
                                  </div>
                                  {isBdayMonth ? (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-pink-100 text-pink-800 rounded font-bold text-[9px]">
                                      <Cake className="w-2.5 h-2.5 text-pink-600" />
                                      <span>Birthday Month (2x Points)</span>
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-400">Regular</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">Not set</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => openAdjustPointsModal(c)}
                                  title="Adjust Points Balance"
                                  className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-800 font-semibold rounded-lg text-[10px] transition-colors flex items-center gap-1 border border-purple-200"
                                >
                                  <Edit2 className="w-3 h-3 text-purple-600" />
                                  <span>Adjust</span>
                                </button>
                                <button
                                  onClick={() => openPointsLedgerModal(c)}
                                  title="View Points Statement"
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg text-[10px] transition-colors flex items-center gap-1"
                                >
                                  <FileText className="w-3 h-3 text-slate-600" />
                                  <span>Statement</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          No customer loyalty accounts found matching your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 4: DIGITAL GIFT VOUCHERS HUB ================= */}
        {activeTab === "GIFT_VOUCHERS" && (
          <div className="space-y-6">
            {/* Voucher Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-xs font-medium">Active Gift Vouchers</span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Gift className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-emerald-950 font-mono mt-2">
                  {voucherStats?.activeCount || 0} <span className="text-sm font-normal text-slate-500">vouchers</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Ready for counter redemption</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-xs font-medium">Outstanding Liability</span>
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <Wallet className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-amber-950 font-mono mt-2">
                  {formatCurrency(voucherStats?.activeBalanceTotal || 0)}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Unredeemed balance across active vouchers</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-xs font-medium">Total Value Redeemed</span>
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                    <Receipt className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-blue-950 font-mono mt-2">
                  {formatCurrency(voucherStats?.redeemedTotal || 0)}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Completed purchases using vouchers</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-xs font-medium">Total Vouchers Issued</span>
                  <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                    <Tag className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-900 font-mono mt-2">
                  {voucherStats?.totalIssuedCount || 0}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Expired: {voucherStats?.expiredCount || 0} vouchers
                </p>
              </div>
            </div>

            {/* Vouchers Toolbar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
                <div className="relative max-w-sm w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={voucherSearch}
                    onChange={(e) => setVoucherSearch(e.target.value)}
                    placeholder="Search by code (GV-...), recipient, or purchaser..."
                    className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold overflow-x-auto">
                  {["ALL", "ACTIVE", "REDEEMED", "EXPIRED", "CANCELLED"].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setVoucherStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        voucherStatusFilter === st
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setIsIssueVoucherModalOpen(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center justify-center gap-1.5 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Issue New Gift Voucher</span>
              </button>
            </div>

            {/* Vouchers List Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/75 text-slate-500 font-semibold">
                      <th className="py-3 px-4">Voucher Code</th>
                      <th className="py-3 px-4">Recipient</th>
                      <th className="py-3 px-4">Purchaser</th>
                      <th className="py-3 px-4 text-right">Remaining Balance</th>
                      <th className="py-3 px-4 text-right">Initial Value</th>
                      <th className="py-3 px-4">Expiry Date</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingVouchers ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          Loading gift vouchers...
                        </td>
                      </tr>
                    ) : vouchers.length > 0 ? (
                      vouchers.map((v) => {
                        const isExpired = v.status === "EXPIRED" || (v.expiryDate && new Date(v.expiryDate) < new Date());
                        const isZero = v.currentBalance <= 0;

                        return (
                          <tr key={v._id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-4">
                              <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                {v.code}
                              </span>
                              <div className="text-[10px] text-slate-400 mt-1">
                                Issued {formatSLDateTime(v.createdAt)}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-900">
                                {v.recipientName || "Walk-in Recipient"}
                              </div>
                              {v.recipientPhone && (
                                <div className="text-[10px] text-slate-500 font-mono">{v.recipientPhone}</div>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <div className="text-slate-800">{v.customerName || "Store Direct"}</div>
                              {v.customerPhone && (
                                <div className="text-[10px] text-slate-500 font-mono">{v.customerPhone}</div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-mono">
                              <span
                                className={`text-sm font-black ${
                                  v.currentBalance > 0 ? "text-emerald-700" : "text-slate-400"
                                }`}
                              >
                                {formatCurrency(v.currentBalance)}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-slate-600">
                              {formatCurrency(v.initialAmount)}
                            </td>
                            <td className="py-3 px-4 text-[11px]">
                              {v.expiryDate ? (
                                <span className={isExpired ? "text-rose-600 font-bold" : "text-slate-700"}>
                                  {new Date(v.expiryDate).toLocaleDateString("en-LK", {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                              ) : (
                                <span className="text-slate-400">No expiry</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wide ${
                                  v.status === "ACTIVE"
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                    : v.status === "REDEEMED" || isZero
                                    ? "bg-slate-100 text-slate-700 border border-slate-200"
                                    : v.status === "EXPIRED" || isExpired
                                    ? "bg-amber-100 text-amber-800 border border-amber-300"
                                    : "bg-rose-100 text-rose-800 border border-rose-200"
                                }`}
                              >
                                {v.status === "ACTIVE" && !isExpired && !isZero ? "ACTIVE" : v.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setActivePrintedVoucher(v)}
                                  title="Print Gift Voucher Thermal Slip"
                                  className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold rounded-lg text-[10px] transition-colors flex items-center gap-1 border border-amber-200"
                                >
                                  <Printer className="w-3 h-3 text-amber-600" />
                                  <span>Print</span>
                                </button>
                                {v.redemptionHistory && v.redemptionHistory.length > 0 && (
                                  <button
                                    onClick={() => setSelectedVoucherHistory(v)}
                                    title="View Redemption History"
                                    className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-lg text-[10px] transition-colors flex items-center gap-1 border border-blue-200"
                                  >
                                    <History className="w-3 h-3 text-blue-600" />
                                    <span>{v.redemptionHistory.length}</span>
                                  </button>
                                )}
                                {v.status === "ACTIVE" && (
                                  <button
                                    onClick={() => handleCancelVoucher(v.code)}
                                    title="Cancel Unused Voucher"
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          No gift vouchers found. Click "Issue New Gift Voucher" to create one!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= MODAL 1: ADD / EDIT CUSTOMER PROFILE ================= */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[95vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-base">
                  {editingCustomer ? "Edit Customer Profile" : "Add New Customer Profile"}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Customer Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Sunil Perera"
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sri Lankan Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="0771234567 or +94771234567"
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Supports local 07X and international +94 formats</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    National Identity Card (NIC) (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.nicNumber}
                    onChange={(e) => setFormData({ ...formData, nicNumber: e.target.value })}
                    placeholder="e.g. 198512345678 or 851234567V"
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="customer@example.lk"
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Address / Area (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="e.g. Peradeniya Road, Kandy"
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                {/* Loyalty Tier & Birthday Month */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-purple-50/50 border border-purple-200/70 rounded-xl">
                  <div>
                    <label className="block text-xs font-semibold text-purple-950 mb-1 flex items-center gap-1">
                      <Cake className="w-3.5 h-3.5 text-pink-500" />
                      <span>Birth Date (Birthday 2x)</span>
                    </label>
                    <input
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                    <p className="text-[9px] text-purple-700 mt-0.5">2x Points Multiplier in Birthday Month</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-purple-950 mb-1 flex items-center gap-1">
                      <Crown className="w-3.5 h-3.5 text-amber-500" />
                      <span>Loyalty Tier</span>
                    </label>
                    <select
                      value={formData.loyaltyTier}
                      onChange={(e) => setFormData({ ...formData, loyaltyTier: e.target.value as any })}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-purple-200 rounded-lg font-bold text-purple-950 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    >
                      <option value="REGULAR">REGULAR (1.0x)</option>
                      <option value="SILVER">SILVER (1.25x)</option>
                      <option value="GOLD">GOLD (1.5x)</option>
                      <option value="PLATINUM">PLATINUM (2.0x)</option>
                    </select>
                    <p className="text-[9px] text-purple-700 mt-0.5">Auto-advances based on spend</p>
                  </div>
                </div>

                {/* Store Credit (Naya Potha) Toggle Section */}
                <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-amber-950 block flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-amber-700" />
                        Enable Store Credit (Naya Potha)
                      </span>
                      <span className="text-[10px] text-amber-800">
                        Allows customer to buy items on credit at the POS
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.creditAllowed}
                        onChange={(e) => setFormData({ ...formData, creditAllowed: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                    </label>
                  </div>

                  {formData.creditAllowed && (
                    <div className="pt-2 border-t border-amber-200/80">
                      <label className="block text-[11px] font-semibold text-amber-950 mb-1">
                        Credit Ceiling / Limit (LKR)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                          Rs.
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          required={formData.creditAllowed}
                          value={formData.creditLimit}
                          onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                          placeholder="10000"
                          className="w-full pl-10 pr-3 py-1.5 text-xs font-mono font-bold bg-white border border-amber-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {[5000, 10000, 20000, 50000].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setFormData({ ...formData, creditLimit: preset.toString() })}
                            className="px-1.5 py-0.5 bg-white border border-amber-200 text-amber-900 rounded text-[10px] font-semibold hover:bg-amber-100"
                          >
                            Rs. {preset.toLocaleString()}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Notes / Preferences (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="e.g. Regular wholesale buyer"
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm disabled:opacity-50"
                  >
                    {submitting ? "Saving..." : editingCustomer ? "Save Changes" : "Create Profile"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= MODAL 2: RECEIVE DEBT SETTLEMENT (NAYA BERIMA) ================= */}
        {isPaymentModalOpen && paymentCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                      Settle Debt (ණය බේරීම)
                    </h3>
                    <p className="text-xs text-slate-500">{paymentCustomer.name}</p>
                  </div>
                </div>
                <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Debt Snapshot */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-amber-800 uppercase tracking-wider block font-medium">
                    Current Outstanding Balance
                  </span>
                  <span className="text-lg font-black font-mono text-amber-950">
                    {formatCurrency(paymentCustomer.currentBalance || 0)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPaymentAmount((paymentCustomer.currentBalance || 0).toString())}
                  className="px-2.5 py-1 bg-amber-200/80 hover:bg-amber-300 text-amber-900 text-[10px] font-bold rounded-lg transition"
                >
                  Pay Full Balance
                </button>
              </div>

              <form onSubmit={handlePaymentSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Amount to Pay (LKR) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      Rs.
                    </span>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      required
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="e.g. 5000"
                      className="w-full pl-10 pr-3 py-2 text-sm font-bold font-mono border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Remaining calculation preview */}
                {paymentAmount !== "" && !isNaN(parseFloat(paymentAmount)) && (
                  <div className="flex justify-between text-xs p-2 bg-slate-50 rounded-xl font-medium">
                    <span className="text-slate-500">Remaining Debt after payment:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {formatCurrency(Math.max(0, (paymentCustomer.currentBalance || 0) - parseFloat(paymentAmount)))}
                    </span>
                  </div>
                )}

                {/* Payment Channel */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: "CASH", label: "Cash" },
                      { id: "CARD", label: "Card" },
                      { id: "QR", label: "LankaQR" },
                      { id: "BANK_TRANSFER", label: "Bank" },
                    ].map((pm) => (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => setPaymentMethod(pm.id as any)}
                        className={`py-1.5 text-xs font-bold rounded-lg border transition ${
                          paymentMethod === pm.id
                            ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {pm.label}
                      </button>
                    ))}
                  </div>
                  {paymentMethod === "CASH" && (
                    <p className="text-[10px] text-emerald-700 mt-1">
                      Cash payments automatically sync into the active cash drawer shift as a Pay-In.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Reference / Slip No. (Optional)
                  </label>
                  <input
                    type="text"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    placeholder="e.g. Bank slip # or LankaQR Ref"
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Notes / Comments (Optional)
                  </label>
                  <input
                    type="text"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="e.g. Month-end salary payment"
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsPaymentModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingPayment || !paymentAmount}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/25 transition disabled:opacity-50"
                  >
                    {submittingPayment ? "Processing..." : "Confirm & Print Receipt"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= MODAL 3: PASSBOOK STATEMENT (NAYA POTHA LEDGER) ================= */}
        {isLedgerModalOpen && ledgerCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">{ledgerCustomer.name}</h3>
                    <p className="text-xs text-slate-500 font-mono">
                      {ledgerCustomer.phone} {ledgerCustomer.nicNumber ? `• NIC: ${ledgerCustomer.nicNumber}` : ""}
                    </p>
                  </div>
                </div>
                <button onClick={() => setIsLedgerModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Passbook KPI Highlights */}
              <div className="grid grid-cols-3 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <div>
                  <span className="text-slate-500 text-[10px] block">Credit Limit</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatCurrency(ledgerSummary?.creditLimit ?? ledgerCustomer.creditLimit ?? 0)}
                  </span>
                </div>
                <div className="border-x border-slate-200 px-3">
                  <span className="text-slate-500 text-[10px] block">Current Balance (Owed)</span>
                  <span className="font-mono font-black text-rose-700">
                    {formatCurrency(ledgerSummary?.currentBalance ?? ledgerCustomer.currentBalance ?? 0)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Available Headroom</span>
                  <span className="font-mono font-bold text-emerald-700">
                    {formatCurrency(ledgerSummary?.availableCredit ?? 0)}
                  </span>
                </div>
              </div>

              {/* Chronological Passbook Transactions */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Passbook Statement (ගිණුම් විස්තරය)
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {ledgerTransactions.length} entries
                  </span>
                </div>

                {loadingLedger ? (
                  <div className="py-12 text-center text-xs text-slate-400">Loading passbook entries...</div>
                ) : ledgerTransactions.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                        <tr>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Ref No.</th>
                          <th className="py-2.5 px-3">Description</th>
                          <th className="py-2.5 px-3 text-right">Debit (+)</th>
                          <th className="py-2.5 px-3 text-right">Credit (-)</th>
                          <th className="py-2.5 px-3 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                        {ledgerTransactions.map((tx) => {
                          const isCreditSale = tx.type === "CREDIT_SALE";
                          return (
                            <tr key={tx._id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 text-slate-600 font-sans text-[10px]">
                                {new Date(tx.createdAt).toLocaleDateString()}
                              </td>
                              <td className="py-2 px-3 text-slate-800 font-bold">
                                {tx.invoiceNumber || tx.transactionNumber}
                              </td>
                              <td className="py-2 px-3 font-sans text-slate-600 text-[10px] truncate max-w-[120px]">
                                {tx.notes || (isCreditSale ? "Credit purchase" : "Settlement")}
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-rose-700">
                                {isCreditSale ? `+${formatCurrency(tx.amount)}` : "—"}
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-emerald-700">
                                {!isCreditSale ? `-${formatCurrency(tx.amount)}` : "—"}
                              </td>
                              <td className="py-2 px-3 text-right font-black text-slate-900">
                                {formatCurrency(tx.balanceAfter)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                    No credit transactions recorded yet for this customer.
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => openPaymentModal(ledgerCustomer)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  <span>Receive Payment</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsLedgerModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= MODAL 4: CUSTOMER PURCHASE HISTORY ================= */}
        {selectedCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{selectedCustomer.name}</h3>
                  <p className="text-xs text-slate-500 font-mono">Tel: {selectedCustomer.phone}</p>
                </div>
                <button onClick={() => setSelectedCustomer(null)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Customer Stats Highlight */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <div>
                  <span className="text-slate-400 text-[10px]">Lifetime Spend:</span>
                  <div className="text-sm font-bold text-slate-900 font-mono">
                    {formatCurrency(selectedCustomer.totalSpent)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px]">Total Visits:</span>
                  <div className="text-sm font-bold text-slate-900 font-mono">
                    {selectedCustomer.visitCount} visits
                  </div>
                </div>
              </div>

              {/* Invoices List */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-700">Purchase History</h4>
                {loadingHistory ? (
                  <div className="py-8 text-center text-slate-400 text-xs">Loading purchases...</div>
                ) : customerPurchases.length > 0 ? (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {customerPurchases.map((p) => (
                      <div key={p._id} className="p-3 bg-white flex items-center justify-between text-xs">
                        <div>
                          <div className="font-mono font-semibold text-slate-900">{p.invoiceNumber}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {formatSLDateTime(p.createdAt)} • {p.paymentMethod}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-900 font-mono">{formatCurrency(p.netTotal)}</span>
                          <span className="block text-[10px] text-slate-400">
                            {p.items?.length || 1} items
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl">
                    No past purchases recorded for this customer yet.
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= MODAL 6: WHATSAPP DEBT REMINDER MODAL ================= */}
        {isReminderModalOpen && reminderCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Send WhatsApp Debt Reminder</h3>
                    <p className="text-[11px] text-slate-500">Naya Potha polite credit collection notice</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsReminderModalOpen(false)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Debtor Profile Bar */}
              <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Customer:</span>
                  <span className="font-bold text-slate-900">{reminderCustomer.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Destination Mobile (WhatsApp):</span>
                  <span className="font-mono font-bold text-emerald-800 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-emerald-600" />
                    {reminderCustomer.phone}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-amber-200/60 font-bold">
                  <span className="text-amber-900">Current Outstanding Balance:</span>
                  <span className="font-mono text-rose-600 text-sm">
                    {formatCurrency(reminderCustomer.currentBalance || 0)}
                  </span>
                </div>
              </div>

              {/* Message Preview & Edit */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    Message Preview (Editable before sending)
                  </label>
                  <span className="text-[10px] text-slate-400">Includes bank deposit details</span>
                </div>

                {loadingReminder ? (
                  <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl">
                    Generating polite reminder message with store bank details...
                  </div>
                ) : (
                  <textarea
                    rows={8}
                    value={reminderMessage}
                    onChange={(e) => setReminderMessage(e.target.value)}
                    className="w-full p-3 font-mono text-xs text-slate-800 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(reminderMessage);
                    setCopiedReminder(true);
                    setTimeout(() => setCopiedReminder(false), 2000);
                  }}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  {copiedReminder ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-bold">Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Copy Text</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsReminderModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>

                  <a
                    href={buildWhatsAppUrl(reminderCustomer.phone, reminderMessage)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      setStatusMessage({
                        type: "success",
                        text: `WhatsApp reminder launched for ${reminderCustomer.name} (${reminderCustomer.phone}).`,
                      });
                      setIsReminderModalOpen(false);
                    }}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/25 flex items-center gap-1.5 transition"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Open in WhatsApp</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= MODAL 5: THERMAL DEBT SETTLEMENT SLIP ================= */}
        {activeSettlementSlip && (
          <CreditSettlementReceipt
            business={{
              name: "Sri Lanka Retail POS",
              receiptSettings: { defaultWidth: "58mm" },
            }}
            settlement={activeSettlementSlip}
            onClose={() => setActiveSettlementSlip(null)}
          />
        )}

        {/* ================= MODAL 6: ADJUST LOYALTY POINTS ================= */}
        {isAdjustPointsModalOpen && adjustCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Adjust Loyalty Points</h3>
                    <p className="text-xs text-slate-500">{adjustCustomer.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAdjustPointsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Points Summary Badge */}
              <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-purple-800 uppercase tracking-wider block font-semibold">
                    Current Balance
                  </span>
                  <span className="text-lg font-black font-mono text-purple-950">
                    {(adjustCustomer.loyaltyPoints || 0).toLocaleString()} pts
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-200 text-purple-900">
                  {adjustCustomer.loyaltyTier || "REGULAR"}
                </span>
              </div>

              <form onSubmit={handleAdjustPointsSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Points to Adjust (+ to credit, - to deduct) *
                  </label>
                  <input
                    type="number"
                    step="1"
                    required
                    value={adjustPoints}
                    onChange={(e) => setAdjustPoints(e.target.value)}
                    placeholder="e.g. 50 or -20"
                    className="w-full px-3.5 py-2 text-sm font-bold font-mono border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                  <div className="flex items-center gap-1.5 mt-2">
                    {[50, 100, 200, -50, -100].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setAdjustPoints(val.toString())}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition border ${
                          val > 0
                            ? "bg-purple-50 hover:bg-purple-100 text-purple-800 border-purple-200"
                            : "bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200"
                        }`}
                      >
                        {val > 0 ? `+${val}` : val}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Reason / Description *
                  </label>
                  <input
                    type="text"
                    required
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder="e.g. Courtesy bonus, promotional adjustment"
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAdjustPointsModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingPoints}
                    className="px-5 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-sm disabled:opacity-50"
                  >
                    {submittingPoints ? "Updating..." : "Confirm Adjustment"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= MODAL 7: LOYALTY POINTS STATEMENT / LEDGER ================= */}
        {isPointsLedgerModalOpen && pointsLedgerCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Points Statement & Audit Trail</h3>
                    <p className="text-xs text-slate-500">{pointsLedgerCustomer.name} ({pointsLedgerCustomer.phone})</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsPointsLedgerModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Customer Points Summary Strip */}
              <div className="grid grid-cols-3 gap-2.5 p-3 bg-purple-50/50 border border-purple-200/60 rounded-xl text-center">
                <div>
                  <span className="text-[10px] text-purple-800 uppercase font-semibold block">Available</span>
                  <span className="text-base font-black font-mono text-purple-950">
                    {(pointsLedgerCustomer.loyaltyPoints || 0).toLocaleString()} pts
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-purple-800 uppercase font-semibold block">VIP Tier</span>
                  <span className="text-sm font-bold text-amber-700 uppercase">
                    {pointsLedgerCustomer.loyaltyTier || "REGULAR"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-purple-800 uppercase font-semibold block">Lifetime Earned</span>
                  <span className="text-base font-black font-mono text-emerald-800">
                    +{(pointsLedgerCustomer.lifetimePointsEarned || 0).toLocaleString()} pts
                  </span>
                </div>
              </div>

              {/* Transactions Ledger Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Recent Points History
                </h4>
                {loadingPointsLedger ? (
                  <div className="p-8 text-center text-slate-400 text-xs">Loading points history...</div>
                ) : pointsTransactions.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                        <tr>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Activity</th>
                          <th className="py-2.5 px-3">Description</th>
                          <th className="py-2.5 px-3 text-right">Points</th>
                          <th className="py-2.5 px-3 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {pointsTransactions.map((tx: any) => (
                          <tr key={tx._id} className="hover:bg-slate-50/70">
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                              {formatSLDateTime(tx.createdAt)}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                  tx.type === "EARN"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : tx.type === "BIRTHDAY_BONUS"
                                    ? "bg-pink-100 text-pink-800"
                                    : tx.type === "REDEEM"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-purple-100 text-purple-800"
                                }`}
                              >
                                {tx.type === "BIRTHDAY_BONUS" ? "BIRTHDAY 2X" : tx.type}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-700">
                              <div>{tx.description}</div>
                              {tx.invoiceNumber && (
                                <span className="font-mono text-[10px] text-slate-400">
                                  Invoice: {tx.invoiceNumber}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold">
                              <span className={tx.points > 0 ? "text-emerald-700" : "text-rose-600"}>
                                {tx.points > 0 ? `+${tx.points}` : tx.points}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                              {tx.pointsAfter}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                    No loyalty transactions recorded yet for this customer.
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPointsLedgerModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= MODAL 8: ISSUE NEW GIFT VOUCHER ================= */}
        {isIssueVoucherModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Gift className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Issue Digital Gift Voucher</h3>
                    <p className="text-xs text-slate-500">Auto-generates sequential code GV-YYYYMMDD-XXXX</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsIssueVoucherModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleIssueVoucherSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Voucher Value (LKR) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      Rs.
                    </span>
                    <input
                      type="number"
                      min="100"
                      step="any"
                      required
                      value={issueVoucherForm.initialAmount}
                      onChange={(e) => setIssueVoucherForm({ ...issueVoucherForm, initialAmount: e.target.value })}
                      placeholder="e.g. 1000"
                      className="w-full pl-10 pr-3 py-2 text-sm font-bold font-mono border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {[500, 1000, 2000, 5000, 10000].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setIssueVoucherForm({ ...issueVoucherForm, initialAmount: val.toString() })}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition"
                      >
                        Rs. {val.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Recipient Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={issueVoucherForm.recipientName}
                      onChange={(e) => setIssueVoucherForm({ ...issueVoucherForm, recipientName: e.target.value })}
                      placeholder="e.g. Nimalka Fernando"
                      className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Recipient Phone (Optional)
                    </label>
                    <input
                      type="text"
                      value={issueVoucherForm.recipientPhone}
                      onChange={(e) => setIssueVoucherForm({ ...issueVoucherForm, recipientPhone: e.target.value })}
                      placeholder="07XXXXXXXX"
                      className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Purchasing Customer (Optional)
                  </label>
                  <select
                    value={issueVoucherForm.customerId}
                    onChange={(e) => setIssueVoucherForm({ ...issueVoucherForm, customerId: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="">-- Direct Store Purchase (Walk-in) --</option>
                    {customers.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name} ({c.phone})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Expiry Date (Defaults to 1 Year)
                  </label>
                  <input
                    type="date"
                    value={issueVoucherForm.expiryDate}
                    onChange={(e) => setIssueVoucherForm({ ...issueVoucherForm, expiryDate: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Notes / Occasion (Optional)
                  </label>
                  <input
                    type="text"
                    value={issueVoucherForm.notes}
                    onChange={(e) => setIssueVoucherForm({ ...issueVoucherForm, notes: e.target.value })}
                    placeholder="e.g. Birthday Gift, Corporate Incentive, Avurudu Special"
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsIssueVoucherModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingVoucher}
                    className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Gift className="w-3.5 h-3.5" />
                    <span>{submittingVoucher ? "Issuing..." : "Issue & Print Slip"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= MODAL 9: GIFT VOUCHER REDEMPTION HISTORY ================= */}
        {selectedVoucherHistory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                    <History className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Voucher Redemption History</h3>
                    <p className="text-xs font-mono text-slate-500">{selectedVoucherHistory.code}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedVoucherHistory(null)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl flex justify-between items-center text-xs">
                <div>
                  <span className="text-slate-500 block">Initial Value:</span>
                  <span className="font-bold font-mono text-slate-900">
                    {formatCurrency(selectedVoucherHistory.initialAmount)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Current Balance:</span>
                  <span className="font-bold font-mono text-emerald-700 text-sm">
                    {formatCurrency(selectedVoucherHistory.currentBalance)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Status:</span>
                  <span className="font-bold text-slate-900">{selectedVoucherHistory.status}</span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Counter Redemptions
                </h4>
                {selectedVoucherHistory.redemptionHistory && selectedVoucherHistory.redemptionHistory.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                        <tr>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Invoice</th>
                          <th className="py-2 px-3 text-right">Deducted</th>
                          <th className="py-2 px-3 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedVoucherHistory.redemptionHistory.map((red: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50/70">
                            <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">
                              {formatSLDateTime(red.redeemedAt)}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-800 font-semibold">
                              {red.invoiceNumber || "N/A"}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-rose-600">
                              -{formatCurrency(red.amount)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                              {formatCurrency(red.balanceAfter)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                    No redemptions made yet. Full balance available.
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedVoucherHistory(null)}
                  className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= MODAL 10: PRINTABLE GIFT VOUCHER SLIP ================= */}
        {activePrintedVoucher && (
          <GiftVoucherReceipt
            business={{
              name: "Sri Lanka Retail POS",
              phone: "011-2345678",
              address: "Colombo, Sri Lanka",
            }}
            voucher={activePrintedVoucher}
            onClose={() => setActivePrintedVoucher(null)}
          />
        )}
      </div>
    </AppLayout>
  );
}
