"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import {
  Shield,
  Store,
  Users,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  Plus,
  ArrowRight,
  TrendingUp,
  Package,
  Phone,
  MapPin,
  Calendar,
  LogOut,
  RefreshCw,
  X,
  Lock,
  Building2,
  Check,
  AlertCircle,
  ExternalLink,
  Eye,
  Key,
  Activity,
  ChevronDown,
  ChevronUp,
  Receipt,
  FileText,
  DollarSign,
  BadgePercent,
} from "lucide-react";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";
import SubscriptionInvoiceReceipt, {
  SubscriptionInvoiceData,
} from "@/components/receipts/SubscriptionInvoiceReceipt";

interface BusinessSubscription {
  plan: "TRIAL" | "BASIC" | "PROFESSIONAL" | "ENTERPRISE";
  status: "TRIAL" | "ACTIVE" | "EXPIRED" | "SUSPENDED" | "CANCELLED";
  startDate: string;
  expiryDate: string;
  maxProducts?: number;
  maxUsers?: number;
}

interface ClientBusiness {
  _id: string;
  name: string;
  businessType: string;
  ownerName: string;
  phone: string;
  email?: string;
  address?: string;
  currency: string;
  subscription: BusinessSubscription;
  owner?: {
    name: string;
    username: string;
    phone: string;
  };
  isActive: boolean;
  userCount?: number;
  productCount?: number;
  totalSalesVolume?: number;
  totalTransactions?: number;
  createdAt: string;
}

interface PlatformStats {
  totalBusinesses: number;
  activeSubscriptions: number;
  trialBusinesses: number;
  expiredOrSuspended: number;
  totalProducts: number;
  totalGMV: number;
  totalTransactions: number;
  estimatedMRR: number;
}

export default function SuperAdminDashboard() {
  const { data: session, status } = useSession();
  const [businesses, setBusinesses] = useState<ClientBusiness[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [planFilter, setPlanFilter] = useState<string>("ALL");

  // Tab Navigation: "STORES" | "BILLING" | "ACTIVITIES"
  const [activeTab, setActiveTab] = useState<"STORES" | "BILLING" | "ACTIVITIES">("STORES");

  // Billing & Invoices state
  const [invoices, setInvoices] = useState<SubscriptionInvoiceData[]>([]);
  const [billingSummary, setBillingSummary] = useState<{
    totalCollected: number;
    totalInvoicesCount: number;
    thisMonthCollected: number;
    thisMonthCount: number;
    activePayingShops: number;
    upcomingExpirations: Array<{
      _id: string;
      name: string;
      ownerName: string;
      phone: string;
      subscription: {
        plan: string;
        status: string;
        expiryDate: string;
      };
    }>;
    methodStats: Array<{ _id: string; total: number; count: number }>;
  } | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingSearchQuery, setBillingSearchQuery] = useState("");
  const [billingStatusFilter, setBillingStatusFilter] = useState("ALL");

  // Record Subscription Payment Modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    businessId: "",
    plan: "BASIC" as "BASIC" | "PROFESSIONAL" | "ENTERPRISE",
    billingCycle: "MONTHLY" as "MONTHLY" | "QUARTERLY" | "BI_ANNUAL" | "ANNUAL",
    durationMonths: 1,
    amount: 3500,
    discountAmount: 0,
    paymentMethod: "BANK_TRANSFER" as "BANK_TRANSFER" | "CASH" | "ONLINE_CARD" | "CHEQUE" | "OTHER",
    bankName: "Commercial Bank of Ceylon",
    paymentReference: "",
    paymentDate: new Date().toISOString().split("T")[0],
    notes: "",
    autoExtendLicense: true,
  });
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentFeedback, setPaymentFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Selected Invoice for Official Receipt Modal
  const [selectedReceiptInvoice, setSelectedReceiptInvoice] = useState<SubscriptionInvoiceData | null>(null);

  // Modal states
  const [isOnboardOpen, setIsOnboardOpen] = useState(false);
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<ClientBusiness | null>(null);

  // Inspect Store & Staff modal
  const [isInspectModalOpen, setIsInspectModalOpen] = useState(false);
  const [inspectBiz, setInspectBiz] = useState<ClientBusiness | null>(null);
  const [inspectUsers, setInspectUsers] = useState<Array<{
    _id: string;
    name: string;
    username: string;
    role: string;
    phone?: string;
    isActive: boolean;
    createdAt: string;
  }>>([]);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetFeedback, setResetFeedback] = useState("");

  // Platform Activities
  const [activities, setActivities] = useState<Array<{
    _id: string;
    businessName: string;
    userName: string;
    action: string;
    entityType: string;
    details?: any;
    createdAt: string;
  }>>([]);
  const [showActivityStream, setShowActivityStream] = useState(true);

  // Onboard form state
  const [newBiz, setNewBiz] = useState({
    name: "",
    businessType: "Grocery & Retail",
    ownerName: "",
    ownerUsername: "",
    ownerPassword: "",
    phone: "",
    email: "",
    address: "",
    plan: "TRIAL" as "TRIAL" | "BASIC" | "PROFESSIONAL" | "ENTERPRISE",
    durationDays: 14,
  });
  const [onboardLoading, setOnboardLoading] = useState(false);
  const [onboardError, setOnboardError] = useState("");
  const [onboardSuccess, setOnboardSuccess] = useState("");

  // License edit form state
  const [licenseEdit, setLicenseEdit] = useState({
    plan: "BASIC" as "TRIAL" | "BASIC" | "PROFESSIONAL" | "ENTERPRISE",
    status: "ACTIVE" as "TRIAL" | "ACTIVE" | "EXPIRED" | "SUSPENDED" | "CANCELLED",
    expiryDate: "",
  });
  const [licenseSaving, setLicenseSaving] = useState(false);
  const [licenseMessage, setLicenseMessage] = useState("");

  async function loadData() {
    setLoading(true);
    try {
      const [bizRes, statsRes, actRes, billRes] = await Promise.all([
        fetch("/api/admin/businesses"),
        fetch("/api/admin/stats"),
        fetch("/api/admin/activity"),
        fetch("/api/admin/billing"),
      ]);

      const bizData = await bizRes.json();
      const statsData = await statsRes.json();
      const actData = await actRes.json();
      const billData = await billRes.json();

      if (bizData.success) {
        setBusinesses(bizData.businesses);
      }
      if (statsData.success) {
        setStats(statsData.stats);
      }
      if (actData.success) {
        setActivities(actData.activities);
      }
      if (billData.success) {
        setInvoices(billData.invoices || []);
        setBillingSummary(billData.summary || null);
      }
    } catch (err) {
      console.error("Failed to load super admin data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Filtered businesses
  const filteredBusinesses = useMemo(() => {
    return businesses.filter((biz) => {
      const q = searchQuery.toLowerCase();
      const matchesQuery =
        !searchQuery ||
        biz.name.toLowerCase().includes(q) ||
        biz.ownerName.toLowerCase().includes(q) ||
        (biz.owner?.username || "").toLowerCase().includes(q) ||
        biz.phone.includes(q) ||
        (biz.address || "").toLowerCase().includes(q) ||
        biz.businessType.toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "ALL" || biz.subscription?.status === statusFilter;

      const matchesPlan =
        planFilter === "ALL" || biz.subscription?.plan === planFilter;

      return matchesQuery && matchesStatus && matchesPlan;
    });
  }, [businesses, searchQuery, statusFilter, planFilter]);

  // Handle Onboarding Submit
  async function handleOnboardSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOnboardLoading(true);
    setOnboardError("");
    setOnboardSuccess("");

    try {
      const res = await fetch("/api/admin/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBiz),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setOnboardError(data.error || "Failed to onboard client business");
        setOnboardLoading(false);
        return;
      }

      setOnboardSuccess(data.message || "Business successfully created!");
      setTimeout(() => {
        setIsOnboardOpen(false);
        setOnboardSuccess("");
        setNewBiz({
          name: "",
          businessType: "Grocery & Retail",
          ownerName: "",
          ownerUsername: "",
          ownerPassword: "",
          phone: "",
          email: "",
          address: "",
          plan: "TRIAL",
          durationDays: 14,
        });
        loadData();
      }, 1200);
    } catch {
      setOnboardError("Network error. Please try again.");
    } finally {
      setOnboardLoading(false);
    }
  }

  // Open License Manager Modal
  function openLicenseManager(biz: ClientBusiness) {
    setSelectedBusiness(biz);
    const expDate = biz.subscription?.expiryDate
      ? new Date(biz.subscription.expiryDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

    setLicenseEdit({
      plan: biz.subscription?.plan || "BASIC",
      status: biz.subscription?.status || "ACTIVE",
      expiryDate: expDate,
    });
    setLicenseMessage("");
    setIsLicenseModalOpen(true);
  }

  // Extend Expiry by Days
  function extendExpiry(days: number) {
    const current = licenseEdit.expiryDate
      ? new Date(licenseEdit.expiryDate)
      : new Date();
    current.setDate(current.getDate() + days);
    setLicenseEdit({
      ...licenseEdit,
      expiryDate: current.toISOString().split("T")[0],
      status: "ACTIVE",
    });
  }

  // Save License Updates
  async function handleSaveLicense(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBusiness) return;

    setLicenseSaving(true);
    setLicenseMessage("");

    try {
      const res = await fetch(`/api/admin/businesses/${selectedBusiness._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: licenseEdit.plan,
          status: licenseEdit.status,
          expiryDate: new Date(licenseEdit.expiryDate).toISOString(),
          isActive: licenseEdit.status === "ACTIVE" || licenseEdit.status === "TRIAL",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setLicenseMessage(data.error || "Failed to update license");
        setLicenseSaving(false);
        return;
      }

      setLicenseMessage("License updated successfully!");
      setTimeout(() => {
        setIsLicenseModalOpen(false);
        loadData();
      }, 900);
    } catch {
      setLicenseMessage("Network error updating license");
    } finally {
      setLicenseSaving(false);
    }
  }

  // Quick Toggle Suspend/Activate
  async function toggleQuickStatus(biz: ClientBusiness) {
    const newStatus = biz.subscription?.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
    try {
      await fetch(`/api/admin/businesses/${biz._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          isActive: newStatus === "ACTIVE",
        }),
      });
      loadData();
    } catch (err) {
      console.error("Failed to toggle status:", err);
    }
  }

  // Open Store Inspection & Staff Modal
  async function openInspectModal(biz: ClientBusiness) {
    setInspectBiz(biz);
    setIsInspectModalOpen(true);
    setInspectLoading(true);
    setResettingUserId(null);
    setNewPasswordInput("");
    setResetFeedback("");

    try {
      const res = await fetch(`/api/admin/businesses/${biz._id}/users`);
      const data = await res.json();
      if (data.success && data.users) {
        setInspectUsers(data.users);
      }
    } catch (err) {
      console.error("Failed to load store users:", err);
    } finally {
      setInspectLoading(false);
    }
  }

  // Handle Owner/Staff Password Reset by Super Admin
  async function handleResetPassword(userId: string) {
    if (!inspectBiz || !newPasswordInput || newPasswordInput.length < 4) {
      setResetFeedback("Password must be at least 4 characters.");
      return;
    }

    setResetLoading(true);
    setResetFeedback("");

    try {
      const res = await fetch(`/api/admin/businesses/${inspectBiz._id}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RESET_PASSWORD",
          userId,
          newPassword: newPasswordInput,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setResetFeedback(data.error || "Failed to reset password.");
        return;
      }

      setResetFeedback("Password successfully updated!");
      setResettingUserId(null);
      setNewPasswordInput("");
    } catch {
      setResetFeedback("Network error resetting password.");
    } finally {
      setResetLoading(false);
    }
  }

  // Pricing calculation helper
  function calculateSubscriptionPricing(plan: string, cycle: string) {
    const rates: Record<string, number> = {
      BASIC: 3500,
      PROFESSIONAL: 7500,
      ENTERPRISE: 15000,
      TRIAL: 0,
    };
    const monthlyRate = rates[plan] || 3500;
    let months = 1;
    let discount = 0;

    if (cycle === "QUARTERLY") months = 3;
    else if (cycle === "BI_ANNUAL") months = 6;
    else if (cycle === "ANNUAL") {
      months = 12;
      discount = monthlyRate * 2; // 2 months free prepay incentive
    }

    const totalBeforeDiscount = monthlyRate * months;
    const finalAmount = Math.max(0, totalBeforeDiscount - discount);

    return { durationMonths: months, amount: finalAmount, discountAmount: discount };
  }

  // Open Record Payment Modal for a business
  function openRecordPaymentForStore(biz?: ClientBusiness | { _id: string; name: string; subscription?: any }) {
    const targetBizId = biz?._id || (businesses[0]?._id || "");
    const foundBiz = businesses.find((b) => b._id === targetBizId);
    const plan = (foundBiz?.subscription?.plan === "TRIAL" ? "BASIC" : foundBiz?.subscription?.plan) || "BASIC";
    const pricing = calculateSubscriptionPricing(plan, "MONTHLY");

    setPaymentForm({
      businessId: targetBizId,
      plan: plan as any,
      billingCycle: "MONTHLY",
      durationMonths: pricing.durationMonths,
      amount: pricing.amount,
      discountAmount: pricing.discountAmount,
      paymentMethod: "BANK_TRANSFER",
      bankName: "Commercial Bank of Ceylon",
      paymentReference: "",
      paymentDate: new Date().toISOString().split("T")[0],
      notes: foundBiz ? `Subscription renewal for ${foundBiz.name}` : "",
      autoExtendLicense: true,
    });
    setPaymentFeedback(null);
    setIsPaymentModalOpen(true);
  }

  // Handle plan or cycle change in payment form
  function handlePaymentPlanOrCycleChange(newPlan: string, newCycle: string) {
    const pricing = calculateSubscriptionPricing(newPlan, newCycle);
    setPaymentForm((prev) => ({
      ...prev,
      plan: newPlan as any,
      billingCycle: newCycle as any,
      durationMonths: pricing.durationMonths,
      amount: pricing.amount,
      discountAmount: pricing.discountAmount,
    }));
  }

  // Submit recorded subscription payment
  async function handleRecordPaymentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!paymentForm.businessId) {
      setPaymentFeedback({ type: "error", text: "Please select a client store." });
      return;
    }

    setPaymentSubmitting(true);
    setPaymentFeedback(null);

    try {
      const res = await fetch("/api/admin/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentForm),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setPaymentFeedback({ type: "error", text: data.error || "Failed to record payment." });
        return;
      }

      setPaymentFeedback({ type: "success", text: data.message || "Payment recorded successfully!" });
      loadData();

      setTimeout(() => {
        setIsPaymentModalOpen(false);
        if (data.invoice) {
          setSelectedReceiptInvoice(data.invoice);
        }
      }, 1000);
    } catch {
      setPaymentFeedback({ type: "error", text: "Network error recording payment." });
    } finally {
      setPaymentSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Super Admin Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-blue-400/30">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-white">
                  Sri Lanka POS Cloud
                </h1>
                <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 tracking-wider">
                  Super Admin
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Commercial SaaS Multi-Store Management Portal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/pos"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title="Test Counter POS View"
            >
              <Store className="w-3.5 h-3.5 text-blue-400" />
              <span>Launch Demo POS</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </Link>

            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800/80 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border border-slate-700/80 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 space-y-8">
        {/* KPI Platform Overview Cards */}
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Total Stores</span>
              <Building2 className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {stats?.totalBusinesses ?? businesses.length}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Client businesses</p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Active Licenses</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400">
              {stats?.activeSubscriptions ?? 0}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Paying subscribers</p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Free Trials</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-400">
              {stats?.trialBusinesses ?? 0}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">14-day trials</p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Attention Needed</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-rose-400">
              {stats?.expiredOrSuspended ?? 0}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Expired / Suspended</p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Est. Monthly MRR</span>
              <CreditCard className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-lg font-bold text-indigo-300 truncate">
              {formatCurrency(stats?.estimatedMRR || 0)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Recurring SaaS rev</p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Platform GMV</span>
              <TrendingUp className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-lg font-bold text-cyan-300 truncate">
              {formatCurrency(stats?.totalGMV || 0)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Client sales volume</p>
          </div>
        </section>

        {/* Navigation Tabs: Stores | Billing & Revenue | Activity */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab("STORES")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
              activeTab === "STORES"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                : "bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Client Stores ({businesses.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("BILLING")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
              activeTab === "BILLING"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                : "bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Billing & Revenue</span>
            {billingSummary?.upcomingExpirations && billingSummary.upcomingExpirations.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-extrabold text-[10px]">
                {billingSummary.upcomingExpirations.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("ACTIVITIES")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
              activeTab === "ACTIVITIES"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                : "bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Platform Activity ({activities.length})</span>
          </button>
        </div>

        {/* ================= TAB 1: CLIENT STORES ================= */}
        {activeTab === "STORES" && (
          <div className="space-y-4">
            <section className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span>Client Store Directory</span>
                <span className="text-xs font-normal text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                  {filteredBusinesses.length} {filteredBusinesses.length === 1 ? "store" : "stores"}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Manage SaaS subscriptions, license extensions, and onboard new retail shops.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={loadData}
                disabled={loading}
                className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-xl transition"
                title="Refresh List"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>

              <button
                onClick={() => setIsOnboardOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Onboard New Client Store</span>
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by store name, owner, city, phone (e.g. 077)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {["ALL", "ACTIVE", "TRIAL", "EXPIRED", "SUSPENDED"].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    statusFilter === st
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800"
                  }`}
                >
                  {st === "ALL" ? "All Status" : st}
                </button>
              ))}
            </div>

            {/* Plan Filter */}
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              <option value="ALL">All Plans</option>
              <option value="TRIAL">Trial</option>
              <option value="BASIC">Basic (Rs. 3,500)</option>
              <option value="PROFESSIONAL">Professional (Rs. 7,500)</option>
              <option value="ENTERPRISE">Enterprise (Rs. 15,000)</option>
            </select>
          </div>
        </section>

        {/* Client Businesses Table */}
        <section className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="py-16 text-center text-slate-400 space-y-3">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500" />
              <p className="text-xs">Loading client businesses from database...</p>
            </div>
          ) : filteredBusinesses.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-3">
              <Store className="w-10 h-10 mx-auto text-slate-600" />
              <p className="text-sm font-medium text-slate-300">No client stores found</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No businesses match your active search or filters. Clear your filter or onboard your first client.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                    <th className="py-3 px-4">Client Store</th>
                    <th className="py-3 px-4">Owner & Contact</th>
                    <th className="py-3 px-4">Subscription Plan</th>
                    <th className="py-3 px-4">License Status</th>
                    <th className="py-3 px-4">Expiry Date</th>
                    <th className="py-3 px-4">Store Scale</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {filteredBusinesses.map((biz) => {
                    const sub = biz.subscription || {
                      plan: "TRIAL",
                      status: "TRIAL",
                      expiryDate: new Date().toISOString(),
                    };
                    const expiry = new Date(sub.expiryDate);
                    const now = new Date();
                    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    const isExpiringSoon = diffDays > 0 && diffDays <= 5;
                    const isExpired = diffDays <= 0 || sub.status === "EXPIRED";

                    return (
                      <tr
                        key={biz._id}
                        className="hover:bg-slate-800/40 transition-colors group"
                      >
                        {/* Store Info */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-white flex items-center gap-2">
                            <span>{biz.name}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span className="text-blue-400 font-medium">{biz.businessType}</span>
                            {biz.address && (
                              <span className="text-slate-500 truncate max-w-[180px]">
                                • {biz.address}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Owner & Contact */}
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-200">
                            {biz.owner?.name || biz.ownerName}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span className="text-slate-300 font-mono">@{biz.owner?.username || "owner"}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1 font-mono text-slate-300">
                              <Phone className="w-2.5 h-2.5 text-slate-400" />
                              {biz.phone}
                            </span>
                          </div>
                        </td>

                        {/* Subscription Plan */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${
                              sub.plan === "ENTERPRISE"
                                ? "bg-purple-950/80 text-purple-300 border border-purple-800/60"
                                : sub.plan === "PROFESSIONAL"
                                ? "bg-indigo-950/80 text-indigo-300 border border-indigo-800/60"
                                : sub.plan === "BASIC"
                                ? "bg-blue-950/80 text-blue-300 border border-blue-800/60"
                                : "bg-amber-950/80 text-amber-300 border border-amber-800/60"
                            }`}
                          >
                            {sub.plan}
                          </span>
                          <div className="text-[10px] text-slate-400 mt-1">
                            {sub.plan === "TRIAL"
                              ? "Free Trial"
                              : sub.plan === "BASIC"
                              ? "Rs. 3,500/mo"
                              : sub.plan === "PROFESSIONAL"
                              ? "Rs. 7,500/mo"
                              : "Rs. 15,000/mo"}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                              sub.status === "ACTIVE"
                                ? "bg-emerald-950 text-emerald-300 border border-emerald-800/60"
                                : sub.status === "TRIAL"
                                ? "bg-amber-950 text-amber-300 border border-amber-800/60"
                                : sub.status === "SUSPENDED"
                                ? "bg-rose-950 text-rose-300 border border-rose-800/60"
                                : "bg-red-950 text-red-300 border border-red-800/60"
                            }`}
                          >
                            {sub.status === "ACTIVE" && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                            {sub.status === "TRIAL" && <Clock className="w-3 h-3 text-amber-400" />}
                            {sub.status === "SUSPENDED" && <Shield className="w-3 h-3 text-rose-400" />}
                            {sub.status === "EXPIRED" && <AlertCircle className="w-3 h-3 text-red-400" />}
                            <span>{sub.status}</span>
                          </span>
                        </td>

                        {/* Expiry Date */}
                        <td className="py-3.5 px-4">
                          <div className="font-mono text-slate-200">
                            {expiry.toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                          <div
                            className={`text-[10px] font-medium mt-0.5 ${
                              isExpired
                                ? "text-rose-400"
                                : isExpiringSoon
                                ? "text-amber-400"
                                : "text-slate-400"
                            }`}
                          >
                            {isExpired
                              ? `Expired ${Math.abs(diffDays)}d ago`
                              : `${diffDays} days remaining`}
                          </div>
                        </td>

                        {/* Scale */}
                        <td className="py-3.5 px-4 text-slate-400">
                          <div className="text-[11px] text-slate-300 flex items-center gap-1">
                            <Package className="w-3 h-3 text-slate-400" />
                            <span>{biz.productCount || 0} Products</span>
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Users className="w-3 h-3 text-slate-500" />
                            <span>{biz.userCount || 1} Staff</span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => openRecordPaymentForStore(biz)}
                              className="px-2 py-1 text-xs font-semibold rounded-lg bg-emerald-950/40 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-800/60 transition inline-flex items-center gap-1"
                              title="Record Subscription Payment"
                            >
                              <CreditCard className="w-3 h-3 text-emerald-400" />
                              <span>+ Payment</span>
                            </button>

                            <button
                              onClick={() => openInspectModal(biz)}
                              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition inline-flex items-center gap-1"
                              title="Inspect Store Staff & Details"
                            >
                              <Eye className="w-3 h-3 text-slate-400" />
                              <span>Inspect</span>
                            </button>

                            <button
                              onClick={() => openLicenseManager(biz)}
                              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 transition"
                            >
                              Manage License
                            </button>

                            <button
                              onClick={() => toggleQuickStatus(biz)}
                              className={`px-2 py-1 text-xs font-medium rounded-lg transition border ${
                                sub.status === "SUSPENDED"
                                  ? "bg-emerald-950/40 text-emerald-300 hover:bg-emerald-600 hover:text-white border-emerald-800/60"
                                  : "bg-slate-800 text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 border-slate-700"
                              }`}
                              title={sub.status === "SUSPENDED" ? "Activate Store" : "Suspend Store"}
                            >
                              {sub.status === "SUSPENDED" ? "Activate" : "Suspend"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    )}

        {/* ================= TAB 2: BILLING & REVENUE HUB ================= */}
        {activeTab === "BILLING" && (
          <div className="space-y-6">
            {/* Top Bar: Title & + Record Payment Button */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-blue-400" />
                  <span>SaaS Subscription Billing & Invoices</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Record client payments, track recurring revenue, and issue official SaaS expense receipts.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={loadData}
                  disabled={loading}
                  className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-xl transition"
                  title="Refresh Billing Data"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </button>

                <button
                  type="button"
                  onClick={() => openRecordPaymentForStore()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Record Subscription Payment</span>
                </button>
              </div>
            </div>

            {/* Billing Revenue KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Total Collected</span>
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-emerald-400 font-mono">
                  {formatCurrency(billingSummary?.totalCollected || 0)}
                </div>
                <p className="text-[11px] text-slate-500">
                  {billingSummary?.totalInvoicesCount || invoices.length} total invoice payment(s)
                </p>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>This Month Collected</span>
                  <Calendar className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-2xl font-black text-blue-400 font-mono">
                  {formatCurrency(billingSummary?.thisMonthCollected || 0)}
                </div>
                <p className="text-[11px] text-slate-500">
                  {billingSummary?.thisMonthCount || 0} payment(s) in current calendar month
                </p>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Monthly Recurring Rev (MRR)</span>
                  <TrendingUp className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-2xl font-black text-indigo-300 font-mono">
                  {formatCurrency(stats?.estimatedMRR || 0)}
                </div>
                <p className="text-[11px] text-slate-500">
                  From {billingSummary?.activePayingShops || stats?.activeSubscriptions || 0} active paying shops
                </p>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Renewals Due (14 Days)</span>
                  <Clock className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-black text-amber-400 font-mono">
                  {billingSummary?.upcomingExpirations?.length || 0}
                </div>
                <p className="text-[11px] text-slate-500">
                  Stores requiring license extension
                </p>
              </div>
            </div>

            {/* Upcoming Expirations Action Banner */}
            {billingSummary?.upcomingExpirations && billingSummary.upcomingExpirations.length > 0 && (
              <div className="bg-amber-950/30 border border-amber-800/60 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wider">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>Upcoming Store License Expirations (Next 14 Days)</span>
                  </div>
                  <span className="text-[11px] text-amber-400/80">
                    Reach out to owners to collect renewal fees
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {billingSummary.upcomingExpirations.map((exp) => {
                    const daysLeft = Math.ceil(
                      (new Date(exp.subscription.expiryDate).getTime() - Date.now()) /
                        (1000 * 60 * 60 * 24)
                    );
                    return (
                      <div
                        key={exp._id}
                        className="bg-slate-900/90 border border-amber-800/40 rounded-xl p-3.5 flex flex-col justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-bold text-white text-xs truncate">{exp.name}</h4>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase shrink-0 ${
                                daysLeft <= 3
                                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                                  : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                              }`}
                            >
                              {daysLeft <= 0 ? "Expired" : `${daysLeft}d left`}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1">
                            Owner: <span className="text-slate-300 font-medium">{exp.ownerName}</span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Current Plan: <span className="text-blue-400 font-mono">{exp.subscription.plan}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                          <button
                            type="button"
                            onClick={() => openRecordPaymentForStore(exp)}
                            className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Record Renewal</span>
                          </button>
                          <a
                            href={`tel:${exp.phone}`}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition"
                            title={`Call ${exp.phone}`}
                          >
                            <Phone className="w-3.5 h-3.5 text-blue-400" />
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Invoices Search and Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search invoices by number, store name, reference code..."
                  value={billingSearchQuery}
                  onChange={(e) => setBillingSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>

              <div className="flex items-center gap-1.5">
                {["ALL", "PAID", "PENDING"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setBillingStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                      billingStatusFilter === st
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800"
                    }`}
                  >
                    {st === "ALL" ? "All Invoices" : st}
                  </button>
                ))}
              </div>
            </div>

            {/* Subscription Invoices Table */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="p-3.5 pl-5">Invoice #</th>
                      <th className="p-3.5">Client Store</th>
                      <th className="p-3.5">Plan & Billing Cycle</th>
                      <th className="p-3.5">Coverage Period</th>
                      <th className="p-3.5 text-right">Amount (LKR)</th>
                      <th className="p-3.5">Payment Method</th>
                      <th className="p-3.5 text-center">Status</th>
                      <th className="p-3.5 pr-5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {invoices.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-500 text-xs">
                          No subscription invoices recorded yet. Click "+ Record Subscription Payment" above.
                        </td>
                      </tr>
                    ) : (
                      invoices
                        .filter((inv) => {
                          const q = billingSearchQuery.toLowerCase();
                          const matches =
                            !q ||
                            inv.invoiceNumber.toLowerCase().includes(q) ||
                            inv.businessName.toLowerCase().includes(q) ||
                            inv.ownerName.toLowerCase().includes(q) ||
                            (inv.paymentReference || "").toLowerCase().includes(q);
                          const matchesStatus =
                            billingStatusFilter === "ALL" || inv.status === billingStatusFilter;
                          return matches && matchesStatus;
                        })
                        .map((inv) => (
                          <tr key={inv._id || inv.invoiceNumber} className="hover:bg-slate-800/40 transition">
                            <td className="p-3.5 pl-5 font-mono font-bold text-blue-400">
                              {inv.invoiceNumber}
                            </td>
                            <td className="p-3.5">
                              <div className="font-semibold text-white">{inv.businessName}</div>
                              <div className="text-[11px] text-slate-400">{inv.ownerName} • {inv.phone}</div>
                            </td>
                            <td className="p-3.5">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-950 text-blue-300 border border-blue-800/60">
                                {inv.plan}
                              </span>
                              <span className="text-[11px] text-slate-400 ml-1.5 capitalize">
                                {inv.billingCycle.toLowerCase().replace(/_/g, " ")} ({inv.durationMonths}m)
                              </span>
                            </td>
                            <td className="p-3.5 font-mono text-[11px] text-slate-400">
                              {new Date(inv.periodStart).toLocaleDateString("en-GB")} –{" "}
                              {new Date(inv.periodEnd).toLocaleDateString("en-GB")}
                            </td>
                            <td className="p-3.5 text-right font-mono font-bold text-white text-xs">
                              {formatCurrency(inv.amount)}
                            </td>
                            <td className="p-3.5">
                              <span className="capitalize text-slate-300 font-medium">
                                {inv.paymentMethod.replace(/_/g, " ").toLowerCase()}
                              </span>
                              {inv.paymentReference && (
                                <div className="text-[10px] font-mono text-slate-500">
                                  Ref: {inv.paymentReference}
                                </div>
                              )}
                            </td>
                            <td className="p-3.5 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  inv.status === "PAID"
                                    ? "bg-emerald-950 text-emerald-300 border border-emerald-800/60"
                                    : "bg-amber-950 text-amber-300 border border-amber-800/60"
                                }`}
                              >
                                {inv.status}
                              </span>
                            </td>
                            <td className="p-3.5 pr-5 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedReceiptInvoice(inv)}
                                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                                <span>View Receipt</span>
                              </button>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: PLATFORM LIVE ACTIVITY FEED ================= */}
        {activeTab === "ACTIVITIES" && (
          <section className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div
              onClick={() => setShowActivityStream(!showActivityStream)}
              className="p-4 bg-slate-900 border-b border-slate-800/80 flex items-center justify-between cursor-pointer hover:bg-slate-800/50 transition"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white flex items-center gap-2">
                    <span>Live Platform Activity Stream</span>
                    <span className="text-[10px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-800 px-1.5 py-0.5 rounded">
                      Audit Log
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Real-time SaaS events across all Sri Lankan client stores
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>{activities.length} recent events</span>
                {showActivityStream ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </div>

            {showActivityStream && (
              <div className="divide-y divide-slate-800/60 text-xs">
                {activities.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    No recent activity logged.
                  </div>
                ) : (
                  activities.slice(0, 15).map((act) => (
                    <div
                      key={act._id}
                      className="p-3.5 px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-800/30 transition"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                            act.action.includes("ONBOARD")
                              ? "bg-blue-950 text-blue-300 border border-blue-800/60"
                              : act.action.includes("PAYMENT") || act.action.includes("EXTEND") || act.action.includes("RENEW")
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-800/60"
                              : act.action.includes("SUSPEND")
                              ? "bg-rose-950 text-rose-300 border border-rose-800/60"
                              : "bg-slate-800 text-slate-300 border border-slate-700"
                          }`}
                        >
                          {act.action.replace(/_/g, " ")}
                        </span>
                        <div>
                          <span className="font-semibold text-white">
                            {act.businessName}
                          </span>
                          <span className="text-slate-400 text-[11px] ml-2">
                            by {act.userName}
                          </span>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-500 font-mono">
                        {formatSLDateTime(act.createdAt)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>
        )}
      </main>

      {/* MODAL 1: Onboard New Client Business */}
      {isOnboardOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Onboard New Client Store
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Provisions independent multi-tenant instance & owner login
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOnboardOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleOnboardSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {onboardError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{onboardError}</span>
                </div>
              )}

              {onboardSuccess && (
                <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{onboardSuccess}</span>
                </div>
              )}

              {/* Store Details */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1">
                  1. Store Details
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Business Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ABC Super City"
                      value={newBiz.name}
                      onChange={(e) => setNewBiz({ ...newBiz, name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Business Category
                    </label>
                    <select
                      value={newBiz.businessType}
                      onChange={(e) => setNewBiz({ ...newBiz, businessType: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      <option value="Grocery & Retail">Grocery & Retail</option>
                      <option value="Supermarket">Supermarket</option>
                      <option value="Hardware Mart">Hardware & Electricals</option>
                      <option value="Stationery & Books">Stationery & Bookshop</option>
                      <option value="Pharmacy & Wellness">Pharmacy & Wellness</option>
                      <option value="Bakery & Cafe">Bakery & Cafe</option>
                      <option value="Clothing & Boutique">Clothing & Boutique</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Phone Number (SL) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="0771234567 or +9477..."
                      value={newBiz.phone}
                      onChange={(e) => setNewBiz({ ...newBiz, phone: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Store Address / City
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 120 Galle Road, Colombo"
                      value={newBiz.address}
                      onChange={(e) => setNewBiz({ ...newBiz, address: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                </div>
              </div>

              {/* Owner Account Details */}
              <div className="space-y-3 pt-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1">
                  2. Store Owner Login Credentials
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Owner Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sunil Perera"
                      value={newBiz.ownerName}
                      onChange={(e) => setNewBiz({ ...newBiz, ownerName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Email Address (Optional)
                    </label>
                    <input
                      type="email"
                      placeholder="owner@example.lk"
                      value={newBiz.email}
                      onChange={(e) => setNewBiz({ ...newBiz, email: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Login Username *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. perera_admin"
                      value={newBiz.ownerUsername}
                      onChange={(e) =>
                        setNewBiz({
                          ...newBiz,
                          ownerUsername: e.target.value.toLowerCase().replace(/\s+/g, ""),
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Initial Password or PIN *
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Minimum 4 characters"
                      value={newBiz.ownerPassword}
                      onChange={(e) => setNewBiz({ ...newBiz, ownerPassword: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                </div>
              </div>

              {/* Subscription Plan & Duration */}
              <div className="space-y-3 pt-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1">
                  3. SaaS Subscription & License
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Initial Plan Tier
                    </label>
                    <select
                      value={newBiz.plan}
                      onChange={(e) =>
                        setNewBiz({
                          ...newBiz,
                          plan: e.target.value as any,
                          durationDays: e.target.value === "TRIAL" ? 14 : 30,
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      <option value="TRIAL">TRIAL — 14 Days Free</option>
                      <option value="BASIC">BASIC — Rs. 3,500/mo (1,000 Products)</option>
                      <option value="PROFESSIONAL">PROFESSIONAL — Rs. 7,500/mo (5,000 Products)</option>
                      <option value="ENTERPRISE">ENTERPRISE — Rs. 15,000/mo (Unlimited)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Duration (Days)
                    </label>
                    <select
                      value={newBiz.durationDays}
                      onChange={(e) => setNewBiz({ ...newBiz, durationDays: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      <option value={14}>14 Days (Standard Trial)</option>
                      <option value={30}>30 Days (1 Month)</option>
                      <option value={90}>90 Days (Quarterly)</option>
                      <option value={180}>180 Days (Half Year)</option>
                      <option value={365}>365 Days (1 Year License)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsOnboardOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={onboardLoading}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition disabled:opacity-50"
                >
                  {onboardLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Provisioning Store...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Provision Client Store</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Manage License & Subscription */}
      {isLicenseModalOpen && selectedBusiness && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Manage Store License
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate max-w-[240px]">
                    {selectedBusiness.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsLicenseModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveLicense} className="p-6 space-y-4">
              {licenseMessage && (
                <div className="p-3 rounded-xl bg-blue-950/60 border border-blue-800 text-blue-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{licenseMessage}</span>
                </div>
              )}

              {/* Status */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  License Status
                </label>
                <select
                  value={licenseEdit.status}
                  onChange={(e) =>
                    setLicenseEdit({ ...licenseEdit, status: e.target.value as any })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="ACTIVE">ACTIVE (Full POS Access)</option>
                  <option value="TRIAL">TRIAL (Free Evaluation Period)</option>
                  <option value="SUSPENDED">SUSPENDED (Temporary Billing Block)</option>
                  <option value="EXPIRED">EXPIRED (License Expired)</option>
                </select>
              </div>

              {/* Plan Tier */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Subscription Tier
                </label>
                <select
                  value={licenseEdit.plan}
                  onChange={(e) =>
                    setLicenseEdit({ ...licenseEdit, plan: e.target.value as any })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="TRIAL">TRIAL — Free 14-day evaluation</option>
                  <option value="BASIC">BASIC — Rs. 3,500 / month</option>
                  <option value="PROFESSIONAL">PROFESSIONAL — Rs. 7,500 / month</option>
                  <option value="ENTERPRISE">ENTERPRISE — Rs. 15,000 / month</option>
                </select>
              </div>

              {/* Expiry Date */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  License Expiration Date
                </label>
                <input
                  type="date"
                  required
                  value={licenseEdit.expiryDate}
                  onChange={(e) =>
                    setLicenseEdit({ ...licenseEdit, expiryDate: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>

              {/* Quick Extend Buttons */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Quick Extend License
                </label>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => extendExpiry(14)}
                    className="px-2 py-1.5 text-[11px] font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                  >
                    +14 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => extendExpiry(30)}
                    className="px-2 py-1.5 text-[11px] font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                  >
                    +30 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => extendExpiry(90)}
                    className="px-2 py-1.5 text-[11px] font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                  >
                    +90 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => extendExpiry(365)}
                    className="px-2 py-1.5 text-[11px] font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                  >
                    +1 Year
                  </button>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsLicenseModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={licenseSaving}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-500/20 transition disabled:opacity-50"
                >
                  {licenseSaving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Inspect Store & Staff Accounts */}
      {isInspectModalOpen && inspectBiz && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>{inspectBiz.name}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {inspectBiz.subscription?.plan}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Store details, registered staff members, and credentials support
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsInspectModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
              {resetFeedback && (
                <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{resetFeedback}</span>
                </div>
              )}

              {/* Store Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Store Owner</span>
                  <span className="font-semibold text-white mt-0.5 block">{inspectBiz.ownerName}</span>
                  <span className="text-slate-400 font-mono text-[11px]">{inspectBiz.phone}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Category</span>
                  <span className="font-semibold text-blue-400 mt-0.5 block">{inspectBiz.businessType}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Total Sales</span>
                  <span className="font-semibold text-emerald-400 mt-0.5 block">
                    {formatCurrency(inspectBiz.totalSalesVolume || 0)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Catalog Size</span>
                  <span className="font-semibold text-slate-200 mt-0.5 block">
                    {inspectBiz.productCount || 0} Products
                  </span>
                </div>
              </div>

              {/* Staff Accounts Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                    <span>Registered Staff Accounts ({inspectUsers.length})</span>
                  </h4>
                </div>

                {inspectLoading ? (
                  <div className="p-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-blue-500 mb-2" />
                    Loading staff members...
                  </div>
                ) : (
                  <div className="bg-slate-950/40 rounded-xl border border-slate-800 overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900/60 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                          <th className="py-2.5 px-3">Name</th>
                          <th className="py-2.5 px-3">Login ID</th>
                          <th className="py-2.5 px-3">Role</th>
                          <th className="py-2.5 px-3">Phone</th>
                          <th className="py-2.5 px-3 text-right">Support Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {inspectUsers.map((user) => (
                          <tr key={user._id} className="hover:bg-slate-800/30 transition">
                            <td className="py-2.5 px-3 font-medium text-white">{user.name}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-300">@{user.username}</td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  user.role === "OWNER"
                                    ? "bg-purple-950 text-purple-300 border border-purple-800/60"
                                    : user.role === "MANAGER"
                                    ? "bg-emerald-950 text-emerald-300 border border-emerald-800/60"
                                    : "bg-amber-950 text-amber-300 border border-amber-800/60"
                                }`}
                              >
                                {user.role}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-400">{user.phone || "—"}</td>
                            <td className="py-2.5 px-3 text-right">
                              {resettingUserId === user._id ? (
                                <div className="inline-flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    placeholder="New Password"
                                    value={newPasswordInput}
                                    onChange={(e) => setNewPasswordInput(e.target.value)}
                                    className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white placeholder-slate-500 w-28 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                  <button
                                    onClick={() => handleResetPassword(user._id)}
                                    disabled={resetLoading}
                                    className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-semibold transition disabled:opacity-50"
                                  >
                                    {resetLoading ? "Saving..." : "Save"}
                                  </button>
                                  <button
                                    onClick={() => setResettingUserId(null)}
                                    className="p-1 text-slate-400 hover:text-white"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setResettingUserId(user._id);
                                    setNewPasswordInput("");
                                    setResetFeedback("");
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] transition"
                                  title="Reset password for client support"
                                >
                                  <Key className="w-3 h-3 text-amber-400" />
                                  <span>Reset PIN</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/40">
              <span className="text-[11px] text-slate-500">
                Created on {new Date(inspectBiz.createdAt).toLocaleDateString("en-GB")}
              </span>
              <button
                onClick={() => setIsInspectModalOpen(false)}
                className="px-4 py-2 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 4: RECORD SUBSCRIPTION PAYMENT ================= */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Record Subscription Payment</h3>
                  <p className="text-[11px] text-slate-400">
                    Issues official SaaS expense invoice & extends shop license
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleRecordPaymentSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              {paymentFeedback && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    paymentFeedback.type === "success"
                      ? "bg-emerald-950/60 border-emerald-800 text-emerald-300"
                      : "bg-rose-950/60 border-rose-800 text-rose-300"
                  }`}
                >
                  {paymentFeedback.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{paymentFeedback.text}</span>
                </div>
              )}

              {/* Client Store Selection */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Select Client Store *
                </label>
                <select
                  required
                  value={paymentForm.businessId}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    const b = businesses.find((x) => x._id === selectedId);
                    const plan = (b?.subscription?.plan === "TRIAL" ? "BASIC" : b?.subscription?.plan) || "BASIC";
                    handlePaymentPlanOrCycleChange(plan, paymentForm.billingCycle);
                    setPaymentForm((prev) => ({
                      ...prev,
                      businessId: selectedId,
                      notes: b ? `Subscription renewal for ${b.name}` : prev.notes,
                    }));
                  }}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="">-- Choose a store --</option>
                  {businesses.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name} ({b.ownerName} • {b.subscription?.plan || "BASIC"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Plan Selection */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Subscription Plan Tier *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "BASIC", label: "Basic", price: "Rs. 3,500/mo" },
                    { id: "PROFESSIONAL", label: "Professional", price: "Rs. 7,500/mo" },
                    { id: "ENTERPRISE", label: "Enterprise", price: "Rs. 15,000/mo" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handlePaymentPlanOrCycleChange(p.id, paymentForm.billingCycle)}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        paymentForm.plan === p.id
                          ? "bg-blue-600/20 border-blue-500 text-white"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <div className="font-bold text-xs">{p.label}</div>
                      <div className="text-[10px] text-blue-400 mt-0.5">{p.price}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Billing Cycle */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Billing Cycle & Prepayment *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "MONTHLY", label: "1 Month", badge: null },
                    { id: "QUARTERLY", label: "3 Months", badge: null },
                    { id: "BI_ANNUAL", label: "6 Months", badge: null },
                    { id: "ANNUAL", label: "12 Months", badge: "2 Mos Free" },
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handlePaymentPlanOrCycleChange(paymentForm.plan, c.id)}
                      className={`p-2 rounded-xl border text-center transition cursor-pointer relative ${
                        paymentForm.billingCycle === c.id
                          ? "bg-indigo-600/20 border-indigo-500 text-white font-bold"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      {c.badge && (
                        <span className="absolute -top-1.5 -right-1 px-1.5 py-0.2 bg-emerald-500 text-[9px] font-black text-slate-950 rounded-full">
                          {c.badge}
                        </span>
                      )}
                      <div className="text-xs">{c.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount & Discount Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Amount Paid (LKR) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={paymentForm.amount}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Prepayment Discount (LKR)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={paymentForm.discountAmount}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, discountAmount: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-emerald-400 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
              </div>

              {/* Payment Method & Bank */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Payment Method *
                  </label>
                  <select
                    value={paymentForm.paymentMethod}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, paymentMethod: e.target.value as any })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    <option value="BANK_TRANSFER">Bank Transfer (Deposit / EFT)</option>
                    <option value="CASH">Cash Payment (In-Person)</option>
                    <option value="ONLINE_CARD">Online Credit/Debit Card</option>
                    <option value="CHEQUE">Company Cheque</option>
                    <option value="OTHER">Other LankaPay</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Bank / Channel Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Commercial Bank, Sampath, BOC"
                    value={paymentForm.bankName}
                    onChange={(e) => setPaymentForm({ ...paymentForm, bankName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
              </div>

              {/* Reference Number & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Bank Reference / Slip ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. COMM-TXN-89472"
                    value={paymentForm.paymentReference}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentReference: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={paymentForm.paymentDate}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Internal Remarks / Invoice Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Annual renewal prepayment for 2026/2027"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>

              {/* Auto Extend Toggle */}
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white">Automatically Extend Store License</div>
                  <div className="text-[11px] text-slate-400">
                    Sets status to ACTIVE and extends expiry date by {paymentForm.durationMonths} month(s)
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={paymentForm.autoExtendLicense}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, autoExtendLicense: e.target.checked })
                  }
                  className="w-4 h-4 text-emerald-600 rounded bg-slate-900 border-slate-700 focus:ring-emerald-500"
                />
              </div>

              {/* Modal Buttons */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paymentSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition disabled:opacity-50 cursor-pointer"
                >
                  {paymentSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Recording...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Confirm & Issue Receipt</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 5: OFFICIAL SUBSCRIPTION INVOICE RECEIPT MODAL ================= */}
      {selectedReceiptInvoice && (
        <SubscriptionInvoiceReceipt
          invoice={selectedReceiptInvoice}
          onClose={() => setSelectedReceiptInvoice(null)}
        />
      )}
    </div>
  );
}
