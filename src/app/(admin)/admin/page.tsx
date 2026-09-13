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
} from "lucide-react";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";

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

  // Modal states
  const [isOnboardOpen, setIsOnboardOpen] = useState(false);
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<ClientBusiness | null>(null);

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
      const [bizRes, statsRes] = await Promise.all([
        fetch("/api/admin/businesses"),
        fetch("/api/admin/stats"),
      ]);

      const bizData = await bizRes.json();
      const statsData = await statsRes.json();

      if (bizData.success) {
        setBusinesses(bizData.businesses);
      }
      if (statsData.success) {
        setStats(statsData.stats);
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

        {/* Action Header & Filtering Bar */}
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
    </div>
  );
}
