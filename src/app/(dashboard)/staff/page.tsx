"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";
import CommissionPayoutReceipt, { CommissionPayoutData } from "@/components/receipts/CommissionPayoutReceipt";
import {
  Award,
  Trophy,
  Users,
  Target,
  BadgePercent,
  TrendingUp,
  DollarSign,
  Calendar,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Printer,
  ChevronRight,
  Sparkles,
  ArrowUpRight,
  Percent,
  Check,
  X,
  CreditCard,
  Building,
  UserCheck,
  AlertCircle,
  FileText,
  FileSpreadsheet,
  Sliders,
  RefreshCw,
} from "lucide-react";

export default function StaffPerformancePage() {
  const { data: session } = useSession();

  // Tab State: leaderboard | targets | rules | payouts | directory
  const [activeTab, setActiveTab] = useState<"leaderboard" | "targets" | "rules" | "payouts" | "directory">("leaderboard");
  const [periodFilter, setPeriodFilter] = useState<"this_month" | "last_month" | "this_week" | "today" | "all">("this_month");

  // Performance Data State
  const [perfLoading, setPerfLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [teamTotals, setTeamTotals] = useState<any>({
    totalTeamRevenue: 0,
    totalInvoices: 0,
    totalCommissions: 0,
    totalBonuses: 0,
    averageTeamBasketValue: 0,
    topSalesChampion: null,
    targetAchievementRate: 0,
  });

  // Sales Targets State
  const [targets, setTargets] = useState<any[]>([]);
  const [targetsLoading, setTargetsLoading] = useState(false);
  const [targetFilterStatus, setTargetFilterStatus] = useState("ALL");
  const [isAddTargetModalOpen, setIsAddTargetModalOpen] = useState(false);
  const [newTarget, setNewTarget] = useState({
    userId: "",
    period: "MONTHLY",
    periodLabel: "",
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10),
    targetAmount: 500000,
    targetUnits: 0,
    bonusReward: 15000,
    notes: "",
  });

  // Commission Schemes State
  const [rules, setRules] = useState<any[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [isAddRuleModalOpen, setIsAddRuleModalOpen] = useState(false);
  const [newRule, setNewRule] = useState({
    name: "",
    description: "",
    type: "FLAT_PERCENT",
    defaultRate: 2.0,
    categoryRates: [] as Array<{ categoryId: string; categoryName: string; rate: number }>,
    applicableRoles: ["CASHIER", "SALES_REP"],
    minSaleAmount: 0,
    isActive: true,
  });

  // Categories for scheme builder
  const [categories, setCategories] = useState<any[]>([]);

  // Commission Payouts State
  const [payouts, setPayouts] = useState<any[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [payoutStats, setPayoutStats] = useState({ totalDisbursed: 0, totalPending: 0, totalApproved: 0 });
  const [payoutSearch, setPayoutSearch] = useState("");
  const [payoutStatusFilter, setPayoutStatusFilter] = useState("ALL");
  const [isGeneratePayoutModalOpen, setIsGeneratePayoutModalOpen] = useState(false);
  const [generatingPayout, setGeneratingPayout] = useState(false);
  const [newPayout, setNewPayout] = useState({
    userId: "",
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10),
    period: "",
    deductions: 0,
    deductionReason: "",
    notes: "",
  });

  // Settle/Pay Modal State
  const [settlingPayout, setSettlingPayout] = useState<any | null>(null);
  const [settleForm, setSettleForm] = useState({
    paymentMethod: "BANK_TRANSFER" as "CASH" | "BANK_TRANSFER" | "CHEQUE",
    paymentReference: "",
  });

  // Print Payout Receipt Modal
  const [printPayout, setPrintPayout] = useState<CommissionPayoutData | null>(null);

  // Staff Directory List State
  const [staffList, setStaffList] = useState<any[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any | null>(null);

  // Notification / Toast
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Fetch Performance Leaderboard
  const fetchPerformance = async () => {
    setPerfLoading(true);
    try {
      const res = await fetch(`/api/staff/performance?period=${periodFilter}`);
      const data = await res.json();
      if (data.success) {
        setLeaderboard(data.leaderboard || []);
        setTeamTotals(data.teamTotals || {});
      }
    } catch {
      // Fallback
    } finally {
      setPerfLoading(false);
    }
  };

  // Fetch Sales Targets
  const fetchTargets = async () => {
    setTargetsLoading(true);
    try {
      const res = await fetch(`/api/staff/targets?status=${targetFilterStatus}`);
      const data = await res.json();
      if (data.success) {
        setTargets(data.targets || []);
      }
    } catch {
      // Fallback
    } finally {
      setTargetsLoading(false);
    }
  };

  // Fetch Commission Rules
  const fetchRules = async () => {
    setRulesLoading(true);
    try {
      const res = await fetch("/api/staff/commissions");
      const data = await res.json();
      if (data.success) {
        setRules(data.rules || []);
      }
    } catch {
      // Fallback
    } finally {
      setRulesLoading(false);
    }
  };

  // Fetch Payouts
  const fetchPayouts = async () => {
    setPayoutsLoading(true);
    try {
      const res = await fetch(`/api/staff/payouts?status=${payoutStatusFilter}&search=${encodeURIComponent(payoutSearch)}`);
      const data = await res.json();
      if (data.success) {
        setPayouts(data.payouts || []);
        if (data.stats) {
          setPayoutStats(data.stats);
        }
      }
    } catch {
      // Fallback
    } finally {
      setPayoutsLoading(false);
    }
  };

  // Fetch Staff List
  const fetchStaff = async () => {
    setStaffLoading(true);
    try {
      const res = await fetch("/api/staff");
      const data = await res.json();
      if (data.success) {
        setStaffList(data.staff || []);
      }
    } catch {
      // Fallback
    } finally {
      setStaffLoading(false);
    }
  };

  // Fetch Categories for rules
  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/categories");
      const data = await res.json();
      if (data.success) {
        setCategories(data.categories || []);
      }
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    fetchPerformance();
  }, [periodFilter]);

  useEffect(() => {
    if (activeTab === "targets") fetchTargets();
    if (activeTab === "rules") {
      fetchRules();
      fetchCategories();
    }
    if (activeTab === "payouts") fetchPayouts();
    if (activeTab === "directory") fetchStaff();
  }, [activeTab]);

  useEffect(() => {
    fetchStaff();
  }, []);

  // Handle Save Target
  const handleSaveTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/staff/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTarget),
      });
      const data = await res.json();
      if (data.success) {
        showNotification("success", "Sales target created successfully");
        setIsAddTargetModalOpen(false);
        fetchTargets();
        fetchPerformance();
      } else {
        showNotification("error", data.error || "Failed to create target");
      }
    } catch {
      showNotification("error", "Error creating target");
    }
  };

  // Handle Save Commission Rule
  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/staff/commissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRule),
      });
      const data = await res.json();
      if (data.success) {
        showNotification("success", "Commission scheme created successfully");
        setIsAddRuleModalOpen(false);
        fetchRules();
      } else {
        showNotification("error", data.error || "Failed to create scheme");
      }
    } catch {
      showNotification("error", "Error creating scheme");
    }
  };

  // Handle Toggle Rule Active
  const handleToggleRule = async (ruleId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/staff/commissions/${ruleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification("success", "Scheme status updated");
        fetchRules();
      }
    } catch {
      showNotification("error", "Failed to update scheme status");
    }
  };

  // Handle Generate Payout
  const handleGeneratePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneratingPayout(true);
    try {
      const res = await fetch("/api/staff/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPayout),
      });
      const data = await res.json();
      if (data.success) {
        showNotification("success", data.message || "Payout generated successfully");
        setIsGeneratePayoutModalOpen(false);
        fetchPayouts();
        fetchPerformance();
        if (data.payout) {
          setPrintPayout(data.payout);
        }
      } else {
        showNotification("error", data.error || "Failed to generate payout");
      }
    } catch {
      showNotification("error", "Error generating payout");
    } finally {
      setGeneratingPayout(false);
    }
  };

  // Handle Settle / Pay Payout
  const handleSettlePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingPayout) return;
    try {
      const res = await fetch(`/api/staff/payouts/${settlingPayout._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "PAID",
          paymentMethod: settleForm.paymentMethod,
          paymentReference: settleForm.paymentReference,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification("success", `Payout ${settlingPayout.payoutNumber} marked as PAID`);
        setSettlingPayout(null);
        fetchPayouts();
        fetchPerformance();
      } else {
        showNotification("error", data.error || "Failed to settle payout");
      }
    } catch {
      showNotification("error", "Error settling payout");
    }
  };

  // Handle Quick Edit Staff (Commission % & Target)
  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    try {
      const res = await fetch(`/api/staff/${editingStaff._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commissionRate: editingStaff.commissionRate,
          monthlyTargetAmount: editingStaff.monthlyTargetAmount,
          role: editingStaff.role,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification("success", "Staff profile updated");
        setEditingStaff(null);
        fetchStaff();
        fetchPerformance();
      } else {
        showNotification("error", data.error || "Failed to update staff");
      }
    } catch {
      showNotification("error", "Error updating staff");
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold transition ${
            notification.type === "success"
              ? "bg-emerald-600 text-white"
              : "bg-rose-600 text-white"
          }`}
        >
          {notification.type === "success" ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header with Title and Period Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Award className="w-7 h-7 text-blue-600" />
              Staff Commissions, Sales Targets & Performance
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
              Commercial SaaS
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Track cashier and sales representative performance, automate tier-based commission accruals, and disburse verifiable settlement vouchers.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setPeriodFilter("this_month")}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                periodFilter === "this_month" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setPeriodFilter("last_month")}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                periodFilter === "last_month" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Last Month
            </button>
            <button
              onClick={() => setPeriodFilter("this_week")}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                periodFilter === "this_week" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              This Week
            </button>
            <button
              onClick={() => setPeriodFilter("today")}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                periodFilter === "today" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Today
            </button>
          </div>

          <button
            onClick={() => setIsGeneratePayoutModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
          >
            <DollarSign className="w-4 h-4" />
            <span>Generate Payout</span>
          </button>
        </div>
      </div>

      {/* 4 Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sales Volume */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Team Sales Volume</p>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black text-slate-900 mt-2 font-mono">
            Rs. {formatCurrency(teamTotals.totalTeamRevenue || 0)}
          </p>
          <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1">
            <span className="font-semibold text-slate-700">{teamTotals.totalInvoices || 0}</span> sales completed
            <span className="text-slate-300">•</span>
            Avg: <span className="font-semibold text-slate-700">Rs. {formatCurrency(teamTotals.averageTeamBasketValue || 0)}</span>
          </div>
        </div>

        {/* Accrued Commission Pipeline */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Commission Accrued</p>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <BadgePercent className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black text-emerald-600 mt-2 font-mono">
            Rs. {formatCurrency(teamTotals.totalCommissions || 0)}
          </p>
          <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1">
            <span>Quota Bonuses:</span>
            <span className="font-bold text-emerald-700 font-mono">+Rs. {formatCurrency(teamTotals.totalBonuses || 0)}</span>
          </div>
        </div>

        {/* Target Achievement Rate */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Target Achievement</p>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <p className="text-xl font-black text-indigo-600 font-mono">{teamTotals.targetAchievementRate || 0}%</p>
            <span className="text-[11px] text-slate-500 font-medium">quota hit rate</span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, teamTotals.targetAchievementRate || 0)}%` }}
            ></div>
          </div>
        </div>

        {/* Top Sales Champion */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100/60 border border-amber-200 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-amber-900 uppercase tracking-wider">Top Performer</p>
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
              <Trophy className="w-4 h-4" />
            </div>
          </div>
          <p className="text-base font-extrabold text-amber-950 mt-2 truncate">
            {teamTotals.topSalesChampion?.name || "No sales logged"}
          </p>
          <p className="text-xs font-bold text-amber-700 font-mono mt-0.5">
            {teamTotals.topSalesChampion ? `Rs. ${formatCurrency(teamTotals.topSalesChampion.salesVolume)}` : "—"}
          </p>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-2">
        <button
          onClick={() => setActiveTab("leaderboard")}
          className={`pb-3 px-3 text-xs font-extrabold tracking-tight border-b-2 flex items-center gap-1.5 transition shrink-0 ${
            activeTab === "leaderboard"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>Leaderboard & Performance</span>
          <span className="ml-1 px-1.5 py-0.2 bg-blue-100 text-blue-700 rounded-full text-[10px]">
            {leaderboard.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("targets")}
          className={`pb-3 px-3 text-xs font-extrabold tracking-tight border-b-2 flex items-center gap-1.5 transition shrink-0 ${
            activeTab === "targets"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Target className="w-4 h-4" />
          <span>Sales Targets & Quotas</span>
        </button>

        <button
          onClick={() => setActiveTab("rules")}
          className={`pb-3 px-3 text-xs font-extrabold tracking-tight border-b-2 flex items-center gap-1.5 transition shrink-0 ${
            activeTab === "rules"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Commission Schemes ({rules.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("payouts")}
          className={`pb-3 px-3 text-xs font-extrabold tracking-tight border-b-2 flex items-center gap-1.5 transition shrink-0 ${
            activeTab === "payouts"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Commission Payouts</span>
          {payoutStats.totalPending > 0 && (
            <span className="ml-1 px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded-full text-[10px] font-bold">
              Pending
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("directory")}
          className={`pb-3 px-3 text-xs font-extrabold tracking-tight border-b-2 flex items-center gap-1.5 transition shrink-0 ${
            activeTab === "directory"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Staff Directory ({staffList.length})</span>
        </button>
      </div>

      {/* ================= TAB 1: LEADERBOARD & PERFORMANCE ================= */}
      {activeTab === "leaderboard" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Staff Sales Leaderboard</h3>
                <p className="text-xs text-slate-500">
                  Performance ranking based on verified sales for {periodFilter.replace("_", " ")}
                </p>
              </div>
              <button
                onClick={fetchPerformance}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
                title="Refresh Metrics"
              >
                <RefreshCw className={`w-4 h-4 ${perfLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {perfLoading ? (
              <div className="p-12 text-center text-slate-400 text-xs">Loading performance analytics...</div>
            ) : leaderboard.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">No staff sales recorded for this period.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {leaderboard.map((member, idx) => {
                  const isTop1 = idx === 0 && member.salesVolume > 0;
                  const isTop2 = idx === 1 && member.salesVolume > 0;
                  const isTop3 = idx === 2 && member.salesVolume > 0;

                  return (
                    <div
                      key={member.userId}
                      className={`p-4 hover:bg-slate-50/80 transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                        isTop1 ? "bg-amber-50/30" : ""
                      }`}
                    >
                      {/* Rank & Profile */}
                      <div className="flex items-center gap-3 min-w-[240px]">
                        <div
                          className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shrink-0 ${
                            isTop1
                              ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                              : isTop2
                              ? "bg-slate-300 text-slate-800"
                              : isTop3
                              ? "bg-amber-800/60 text-white"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {isTop1 ? "★ 1" : `#${idx + 1}`}
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-sm text-slate-900">{member.name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-slate-100 text-slate-600">
                              {member.role}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">@{member.username} {member.phone ? `• ${member.phone}` : ""}</p>
                        </div>
                      </div>

                      {/* Performance Numbers */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                        {/* Revenue */}
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-semibold">Sales Revenue</p>
                          <p className="font-extrabold text-slate-900 font-mono text-sm mt-0.5">
                            Rs. {formatCurrency(member.salesVolume)}
                          </p>
                          <p className="text-[10px] text-slate-500">{member.invoicesCount} invoices</p>
                        </div>

                        {/* Avg Basket */}
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-semibold">Avg Basket (ATV)</p>
                          <p className="font-bold text-slate-700 font-mono mt-0.5">
                            Rs. {formatCurrency(member.averageBasket)}
                          </p>
                          <p className="text-[10px] text-slate-500">{member.itemsCount} items</p>
                        </div>

                        {/* Target Progress */}
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-semibold">Quota Target</p>
                          {member.target.hasTarget ? (
                            <div className="space-y-1 mt-0.5">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-bold text-indigo-700">{member.target.progressPercent}%</span>
                                <span className="text-slate-400 text-[10px]">
                                  Rs. {formatCurrency(member.target.targetAmount)}
                                </span>
                              </div>
                              <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-1.5 rounded-full ${
                                    member.target.status === "ACHIEVED"
                                      ? "bg-emerald-500"
                                      : "bg-indigo-600"
                                  }`}
                                  style={{ width: `${Math.min(100, member.target.progressPercent)}%` }}
                                ></div>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-400 mt-0.5">No quota set</p>
                          )}
                        </div>

                        {/* Commission Earned */}
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-semibold">Commission</p>
                          <p className="font-extrabold text-emerald-600 font-mono text-sm mt-0.5">
                            Rs. {formatCurrency(member.commissionEarned)}
                          </p>
                          {member.bonusReward > 0 && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                              +Rs. {formatCurrency(member.bonusReward)} Bonus
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quick Action Button */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setNewPayout({
                              ...newPayout,
                              userId: member.userId,
                            });
                            setIsGeneratePayoutModalOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>Disburse</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 2: SALES TARGETS & QUOTAS ================= */}
      {activeTab === "targets" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-slate-900">Sales Targets & Achievement Quotas</h3>
              <p className="text-xs text-slate-500">Configure monthly or weekly sales targets with cash incentive bonuses.</p>
            </div>
            <button
              onClick={() => setIsAddTargetModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Set New Sales Target</span>
            </button>
          </div>

          {/* Targets Filter */}
          <div className="flex items-center gap-2">
            {["ALL", "IN_PROGRESS", "ACHIEVED", "BONUS_PAID", "MISSED"].map((status) => (
              <button
                key={status}
                onClick={() => setTargetFilterStatus(status)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  targetFilterStatus === status
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                {status.replace("_", " ")}
              </button>
            ))}
          </div>

          {targetsLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs">Loading sales targets...</div>
          ) : targets.length === 0 ? (
            <div className="p-12 bg-white rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
              No sales quotas found for this criteria. Click "Set New Sales Target" to assign quotas.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {targets.map((tgt) => {
                const isAchieved = tgt.status === "ACHIEVED" || tgt.status === "BONUS_PAID";
                return (
                  <div
                    key={tgt._id}
                    className={`bg-white rounded-2xl border p-5 shadow-sm space-y-3 transition ${
                      isAchieved ? "border-emerald-200 bg-emerald-50/20" : "border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{tgt.period} TARGET</span>
                        <h4 className="font-bold text-sm text-slate-900">{tgt.userName}</h4>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          tgt.status === "ACHIEVED"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : tgt.status === "BONUS_PAID"
                            ? "bg-purple-100 text-purple-800"
                            : tgt.status === "MISSED"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {tgt.status.replace("_", " ")}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Target:</span>
                        <span className="font-extrabold text-slate-900 font-mono">Rs. {formatCurrency(tgt.targetAmount)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Achieved:</span>
                        <span className={`font-extrabold font-mono ${isAchieved ? "text-emerald-600" : "text-slate-700"}`}>
                          Rs. {formatCurrency(tgt.achievedAmount)} ({tgt.progressPercent || 0}%)
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-100 rounded-full h-2 mt-1.5 overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${
                            isAchieved ? "bg-emerald-500" : "bg-blue-600"
                          }`}
                          style={{ width: `${Math.min(100, tgt.progressPercent || 0)}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div>
                        <p className="text-[10px] text-slate-400">Bonus Incentive</p>
                        <p className="font-bold text-amber-700 font-mono">+Rs. {formatCurrency(tgt.bonusReward)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400">Period</p>
                        <p className="text-[11px] font-semibold text-slate-700">{tgt.periodLabel}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 3: COMMISSION SCHEMES & RULES ================= */}
      {activeTab === "rules" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-slate-900">Commission Schemes & Tier Rules</h3>
              <p className="text-xs text-slate-500">Define storewide percentages, category-based incentives, or volume tiers.</p>
            </div>
            <button
              onClick={() => setIsAddRuleModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Create Scheme</span>
            </button>
          </div>

          {rulesLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs">Loading commission schemes...</div>
          ) : rules.length === 0 ? (
            <div className="p-12 bg-white rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
              No custom commission schemes created yet. Click "Create Scheme" to establish commission policies.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rules.map((rule) => (
                <div key={rule._id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{rule.name}</h4>
                      <p className="text-xs text-slate-500">{rule.description || "Commission incentive plan"}</p>
                    </div>
                    <button
                      onClick={() => handleToggleRule(rule._id, rule.isActive)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition ${
                        rule.isActive
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {rule.isActive ? "Active" : "Inactive"}
                    </button>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Scheme Type:</span>
                      <span className="font-bold text-slate-800">{rule.type.replace("_", " ")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Default Rate:</span>
                      <span className="font-mono font-bold text-emerald-600">{rule.defaultRate}%</span>
                    </div>
                    {rule.minSaleAmount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Min. Invoice Amount:</span>
                        <span className="font-mono font-semibold text-slate-700">Rs. {formatCurrency(rule.minSaleAmount)}</span>
                      </div>
                    )}
                  </div>

                  {rule.categoryRates && rule.categoryRates.length > 0 && (
                    <div className="space-y-1 text-xs">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Category Specific Rates:</p>
                      <div className="flex flex-wrap gap-1">
                        {rule.categoryRates.map((cr: any, i: number) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-medium text-[11px]">
                            {cr.categoryName}: <strong>{cr.rate}%</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Applicable to:</span>
                    <span className="font-semibold text-slate-700">{rule.applicableRoles.join(", ")}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 4: COMMISSION PAYOUTS REGISTER ================= */}
      {activeTab === "payouts" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-base text-slate-900">Commission Payout Register</h3>
              <p className="text-xs text-slate-500">Verifiable payout vouchers, audit statements, and disbursed settlements.</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search voucher # or staff..."
                  value={payoutSearch}
                  onChange={(e) => setPayoutSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                onClick={() => setIsGeneratePayoutModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Generate Voucher</span>
              </button>
            </div>
          </div>

          {/* Status filters */}
          <div className="flex items-center gap-2">
            {["ALL", "PENDING", "APPROVED", "PAID"].map((st) => (
              <button
                key={st}
                onClick={() => setPayoutStatusFilter(st)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  payoutStatusFilter === st
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Payouts Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {payoutsLoading ? (
              <div className="p-12 text-center text-slate-400 text-xs">Loading commission vouchers...</div>
            ) : payouts.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">No commission payout vouchers found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Voucher #</th>
                      <th className="px-4 py-3">Staff Member</th>
                      <th className="px-4 py-3">Period</th>
                      <th className="px-4 py-3 text-right">Sales Volume</th>
                      <th className="px-4 py-3 text-right">Base Comm.</th>
                      <th className="px-4 py-3 text-right">Bonus</th>
                      <th className="px-4 py-3 text-right">Net Payable</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {payouts.map((po) => (
                      <tr key={po._id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">{po.payoutNumber}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{po.userName}</td>
                        <td className="px-4 py-3 text-slate-500">{po.period}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-700">
                          Rs. {formatCurrency(po.totalSalesVolume)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-700">
                          Rs. {formatCurrency(po.baseCommission)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-amber-700">
                          {po.targetBonus > 0 ? `+Rs. ${formatCurrency(po.targetBonus)}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-black text-emerald-600 text-sm">
                          Rs. {formatCurrency(po.netPayable)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              po.status === "PAID"
                                ? "bg-emerald-100 text-emerald-800"
                                : po.status === "APPROVED"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {po.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right space-x-1.5">
                          <button
                            onClick={() => setPrintPayout(po)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                            title="Print Slip"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          {po.status !== "PAID" && (
                            <button
                              onClick={() => {
                                setSettlingPayout(po);
                                setSettleForm({ paymentMethod: "BANK_TRANSFER", paymentReference: "" });
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition"
                            >
                              Pay Now
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
      )}

      {/* ================= TAB 5: STAFF DIRECTORY & DEFAULT RATES ================= */}
      {activeTab === "directory" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-slate-900">Staff Accounts & Incentive Rates</h3>
              <p className="text-xs text-slate-500">Configure personal commission rates and monthly target defaults per team member.</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Staff Name</th>
                  <th className="px-4 py-3">Login Username</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3 text-center">PIN Security</th>
                  <th className="px-4 py-3 text-right">Commission Rate</th>
                  <th className="px-4 py-3 text-right">Monthly Target</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {staffList.map((st) => (
                  <tr key={st._id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-bold text-slate-900">{st.name}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">@{st.username}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {st.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{st.phone || "—"}</td>
                    <td className="px-4 py-3 text-center">
                      {st.hasSupervisorPin ? (
                        <span className="text-emerald-600 font-bold text-[11px] flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> PIN Set
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">No PIN</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">
                      {st.commissionRate ? `${st.commissionRate}%` : "Default (2%)"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">
                      {st.monthlyTargetAmount ? `Rs. ${formatCurrency(st.monthlyTargetAmount)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setEditingStaff(st)}
                        className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] transition"
                      >
                        Edit Rates
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= MODAL: SET SALES TARGET ================= */}
      {isAddTargetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-blue-600" />
                Set New Sales Target
              </h3>
              <button
                onClick={() => setIsAddTargetModalOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTarget} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Staff Member</label>
                <select
                  required
                  value={newTarget.userId}
                  onChange={(e) => setNewTarget({ ...newTarget, userId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Staff Member...</option>
                  {staffList.map((st) => (
                    <option key={st._id} value={st._id}>
                      {st.name} ({st.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Period</label>
                  <select
                    value={newTarget.period}
                    onChange={(e) => setNewTarget({ ...newTarget, period: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="DAILY">Daily</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Period Label</label>
                  <input
                    type="text"
                    placeholder="e.g. October 2026"
                    value={newTarget.periodLabel}
                    onChange={(e) => setNewTarget({ ...newTarget, periodLabel: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={newTarget.startDate}
                    onChange={(e) => setNewTarget({ ...newTarget, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={newTarget.endDate}
                    onChange={(e) => setNewTarget({ ...newTarget, endDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Target Amount (LKR)</label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    required
                    value={newTarget.targetAmount}
                    onChange={(e) => setNewTarget({ ...newTarget, targetAmount: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Bonus Incentive (LKR)</label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={newTarget.bonusReward}
                    onChange={(e) => setNewTarget({ ...newTarget, bonusReward: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Notes / Terms</label>
                <textarea
                  rows={2}
                  value={newTarget.notes}
                  onChange={(e) => setNewTarget({ ...newTarget, notes: e.target.value })}
                  placeholder="e.g. Festive promotion target for supermarket floor"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddTargetModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                  Assign Target
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: CREATE COMMISSION SCHEME ================= */}
      {isAddRuleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-blue-600" />
                Create Commission Scheme
              </h3>
              <button
                onClick={() => setIsAddRuleModalOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Scheme Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Standard Store Sales Commission"
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Description</label>
                <input
                  type="text"
                  placeholder="e.g. 2% on retail sales, 4% on appliances"
                  value={newRule.description}
                  onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Scheme Type</label>
                  <select
                    value={newRule.type}
                    onChange={(e) => setNewRule({ ...newRule, type: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="FLAT_PERCENT">Flat Percentage</option>
                    <option value="CATEGORY_BASED">Category Based</option>
                    <option value="TIERED_VOLUME">Volume Tiered</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Default Rate (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    required
                    value={newRule.defaultRate}
                    onChange={(e) => setNewRule({ ...newRule, defaultRate: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Minimum Invoice Amount (LKR)</label>
                <input
                  type="number"
                  min="0"
                  value={newRule.minSaleAmount}
                  onChange={(e) => setNewRule({ ...newRule, minSaleAmount: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddRuleModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                  Save Scheme
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: GENERATE PAYOUT ================= */}
      {isGeneratePayoutModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                Generate Commission Payout Statement
              </h3>
              <button
                onClick={() => setIsGeneratePayoutModalOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGeneratePayout} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Staff Member</label>
                <select
                  required
                  value={newPayout.userId}
                  onChange={(e) => setNewPayout({ ...newPayout, userId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Staff Member...</option>
                  {staffList.map((st) => (
                    <option key={st._id} value={st._id}>
                      {st.name} ({st.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={newPayout.startDate}
                    onChange={(e) => setNewPayout({ ...newPayout, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={newPayout.endDate}
                    onChange={(e) => setNewPayout({ ...newPayout, endDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Deductions (LKR)</label>
                  <input
                    type="number"
                    min="0"
                    value={newPayout.deductions}
                    onChange={(e) => setNewPayout({ ...newPayout, deductions: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Deduction Reason</label>
                  <input
                    type="text"
                    placeholder="e.g. Cash advance"
                    value={newPayout.deductionReason}
                    onChange={(e) => setNewPayout({ ...newPayout, deductionReason: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="e.g. October monthly sales settlement"
                  value={newPayout.notes}
                  onChange={(e) => setNewPayout({ ...newPayout, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsGeneratePayoutModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generatingPayout}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5"
                >
                  {generatingPayout && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Generate Voucher</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: SETTLE / PAY VOUCHER ================= */}
      {settlingPayout && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                Disburse Commission Payout
              </h3>
              <button
                onClick={() => setSettlingPayout(null)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Voucher #:</span>
                <span className="font-mono font-bold text-slate-800">{settlingPayout.payoutNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Staff Member:</span>
                <span className="font-bold text-slate-800">{settlingPayout.userName}</span>
              </div>
              <div className="flex justify-between text-sm pt-1 border-t border-slate-200">
                <span className="font-bold text-slate-800">Net Payable:</span>
                <span className="font-mono font-black text-emerald-600">Rs. {formatCurrency(settlingPayout.netPayable)}</span>
              </div>
            </div>

            <form onSubmit={handleSettlePayout} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Disbursement Channel</label>
                <select
                  value={settleForm.paymentMethod}
                  onChange={(e) => setSettleForm({ ...settleForm, paymentMethod: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="BANK_TRANSFER">Bank Wire / Online Transfer</option>
                  <option value="CASH">Cash in Hand</option>
                  <option value="CHEQUE">Company Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Payment Reference / Cheque #</label>
                <input
                  type="text"
                  placeholder="e.g. BOC-TXN-129048 or Cheque 002941"
                  value={settleForm.paymentReference}
                  onChange={(e) => setSettleForm({ ...settleForm, paymentReference: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSettlingPayout(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  Confirm Disbursement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT STAFF COMMISSION & TARGET ================= */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-blue-600" />
                Configure Staff Rates: {editingStaff.name}
              </h3>
              <button
                onClick={() => setEditingStaff(null)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateStaff} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Designation / Role</label>
                <select
                  value={editingStaff.role}
                  onChange={(e) => setEditingStaff({ ...editingStaff, role: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="SALES_REP">SALES_REP (Floor Assistant)</option>
                  <option value="CASHIER">CASHIER (Counter Staff)</option>
                  <option value="SUPERVISOR">SUPERVISOR (Floor Lead)</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="INVENTORY_CLERK">INVENTORY_CLERK</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Personal Commission Rate (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={editingStaff.commissionRate || 0}
                  onChange={(e) => setEditingStaff({ ...editingStaff, commissionRate: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">Applied when no category scheme overrides.</p>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Default Monthly Target (LKR)</label>
                <input
                  type="number"
                  min="0"
                  step="5000"
                  value={editingStaff.monthlyTargetAmount || 0}
                  onChange={(e) => setEditingStaff({ ...editingStaff, monthlyTargetAmount: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: PRINT COMMISSION PAYOUT VOUCHER ================= */}
      {printPayout && (
        <CommissionPayoutReceipt
          business={{
            name: session?.user?.businessName || "Sri Lanka Commercial Store",
          }}
          payout={printPayout}
          onClose={() => setPrintPayout(null)}
        />
      )}
    </div>
  );
}
