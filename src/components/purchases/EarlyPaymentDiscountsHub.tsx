"use client";

import React, { useState, useEffect } from "react";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";
import {
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Search,
  Filter,
  RefreshCw,
  CreditCard,
  Building2,
  Calendar,
  Sparkles,
  ArrowRight,
  Info,
  ChevronRight,
  AlertCircle,
  Percent,
} from "lucide-react";
import type { EarlyDiscountOpportunity } from "@/app/api/purchases/early-discounts/route";

interface EarlyPaymentDiscountsHubProps {
  onPayBill: (opportunity: EarlyDiscountOpportunity) => void;
  onRefresh?: () => void;
}

export default function EarlyPaymentDiscountsHub({
  onPayBill,
  onRefresh,
}: EarlyPaymentDiscountsHubProps) {
  const [opportunities, setOpportunities] = useState<EarlyDiscountOpportunity[]>([]);
  const [summary, setSummary] = useState({
    totalEligibleBillsCount: 0,
    totalPendingDebtLkr: 0,
    totalPotentialDiscountSavingsLkr: 0,
    expiringTodayCount: 0,
    urgentCount: 0,
    activeCount: 0,
    expiredCount: 0,
    missedSavingsLkr: 0,
  });
  const [loading, setLoading] = useState(true);
  const [urgencyFilter, setUrgencyFilter] = useState<
    "ALL" | "EXPIRING_TODAY" | "URGENT" | "ACTIVE" | "EXPIRED"
  >("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (urgencyFilter !== "ALL") params.set("urgency", urgencyFilter);
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      if (selectedSupplier) params.set("supplierId", selectedSupplier);

      const res = await fetch(`/api/purchases/early-discounts?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setOpportunities(data.discounts || []);
        if (data.summary) {
          setSummary(data.summary);
        }
      }
    } catch (err) {
      console.error("Failed to load early settlement discounts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [urgencyFilter, selectedSupplier]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  // Distinct suppliers for filter
  const uniqueSuppliers = Array.from(
    new Set(opportunities.map((o) => JSON.stringify({ id: o.supplierId, name: o.supplierName })))
  ).map((str) => JSON.parse(str));

  return (
    <div className="space-y-6">
      {/* Top Banner: Educational Overview */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-6">
          <Percent className="w-64 h-64 text-white" />
        </div>
        <div className="relative z-10 space-y-2 max-w-3xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-blue-300" />
            <span>Sri Lanka Prompt Payment AP Rebate Engine</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Supplier Early Payment Settlement Discounts (Skonto)
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Leading Sri Lankan FMCG and pharmaceutical distributors (Unilever, CBL, Maliban, Hemas) offer credit terms like <strong>2/10 Net 30</strong> or <strong>3/7 Net 21</strong>.
            Settling accounts within the countdown window clears the <strong>full AP debt</strong> while claiming up to 3% as prompt settlement gain in your P&L statement!
          </p>
        </div>
      </div>

      {/* KPI Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Potential Savings */}
        <div className="p-4 bg-white rounded-2xl border border-emerald-200 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
              Available Rebate Savings
            </span>
            <div className="text-xl font-black text-emerald-700 font-mono mt-0.5">
              {formatCurrency(summary.totalPotentialDiscountSavingsLkr)}
            </div>
            <span className="text-[10px] text-emerald-600 font-medium block mt-0.5">
              Claimable across {summary.expiringTodayCount + summary.urgentCount + summary.activeCount} active bills
            </span>
          </div>
        </div>

        {/* Expiring Today & Urgent Alerts */}
        <div className={`p-4 bg-white rounded-2xl border shadow-xs flex items-center gap-3.5 ${
          summary.expiringTodayCount > 0
            ? "border-rose-300 bg-rose-50/20"
            : "border-slate-200"
        }`}>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
            summary.expiringTodayCount > 0
              ? "bg-rose-100 text-rose-700 animate-pulse"
              : "bg-amber-100 text-amber-700"
          }`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider block">
              Expiring Today / Urgent
            </span>
            <div className="text-xl font-black text-rose-700 font-mono mt-0.5">
              {summary.expiringTodayCount + summary.urgentCount} Bills
            </div>
            <span className="text-[10px] text-rose-600 font-medium block mt-0.5">
              {summary.expiringTodayCount} expiring &le; 24h &bull; {summary.urgentCount} &le; 48h
            </span>
          </div>
        </div>

        {/* Total Outstanding AP Debt Covered */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Eligible Bill Debt (Gross)
            </span>
            <div className="text-xl font-black text-slate-900 font-mono mt-0.5">
              {formatCurrency(summary.totalPendingDebtLkr)}
            </div>
            <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
              Across {summary.totalEligibleBillsCount} pending supplier invoices
            </span>
          </div>
        </div>

        {/* Forfeited / Missed Savings */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Missed Discount Cost
            </span>
            <div className="text-xl font-black text-slate-700 font-mono mt-0.5">
              {formatCurrency(summary.missedSavingsLkr)}
            </div>
            <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
              {summary.expiredCount} bills passed discount deadline
            </span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        {/* Urgency Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            { id: "ALL", label: "All Bills", count: summary.totalEligibleBillsCount },
            { id: "EXPIRING_TODAY", label: "Expiring Today", count: summary.expiringTodayCount, alert: true },
            { id: "URGENT", label: "Urgent (<= 2 Days)", count: summary.urgentCount },
            { id: "ACTIVE", label: "Active Discounts", count: summary.activeCount },
            { id: "EXPIRED", label: "Expired Terms", count: summary.expiredCount },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setUrgencyFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                urgencyFilter === tab.id
                  ? tab.alert
                    ? "bg-rose-600 text-white shadow-xs"
                    : "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  urgencyFilter === tab.id
                    ? "bg-white/20 text-white"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 md:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search PO #, supplier, invoice..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
          </form>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
            title="Refresh opportunities"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Main Opportunities Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <h3 className="font-extrabold text-sm text-slate-900">
              Prompt Settlement Opportunities & AP Countdown Ledger
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            Showing <strong>{opportunities.length}</strong> supplier invoices
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600" />
            <p className="text-xs">Scanning AP invoices and discount deadlines...</p>
          </div>
        ) : opportunities.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-slate-800 text-sm">No Pending Discount Invoices</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No unpaid supplier bills match the selected filter. When you intake goods (GRN) with prompt payment terms, discount opportunities will appear here.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Supplier & Reference</th>
                  <th className="py-3 px-4">Invoice / GRN Date</th>
                  <th className="py-3 px-4 text-right">Outstanding Debt (Gross)</th>
                  <th className="py-3 px-4">Terms & Deadline</th>
                  <th className="py-3 px-4 text-center">Countdown / Urgency</th>
                  <th className="py-3 px-4 text-right">Prompt Savings (LKR)</th>
                  <th className="py-3 px-4 text-right">Net Payout Required</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {opportunities.map((op) => {
                  const isExpiringToday = op.urgency === "EXPIRING_TODAY";
                  const isUrgent = op.urgency === "URGENT";
                  const isExpired = op.urgency === "EXPIRED";
                  const isActive = op.urgency === "ACTIVE";

                  return (
                    <tr
                      key={op.purchaseOrderId}
                      className={`hover:bg-slate-50/80 transition ${
                        isExpiringToday ? "bg-rose-50/30" : ""
                      }`}
                    >
                      {/* Supplier & Ref */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{op.supplierName}</div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                          <span className="font-mono text-blue-700 font-semibold">{op.poNumber}</span>
                          {op.supplierInvoiceNumber && (
                            <span className="text-slate-500">Inv: {op.supplierInvoiceNumber}</span>
                          )}
                        </div>
                      </td>

                      {/* Invoice Date */}
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {formatSLDateTime(op.receivedAt)}
                      </td>

                      {/* Outstanding Debt Gross */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {formatCurrency(op.outstandingBalance)}
                      </td>

                      {/* Terms */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {op.earlyPaymentDiscountPercentage > 0 ? (
                          <div className="space-y-0.5">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
                              {op.earlyPaymentDiscountPercentage}% in {op.earlyPaymentDiscountDays} Days
                            </span>
                            <div className="text-[10px] text-slate-500">
                              Cut-off: {op.discountDeadline ? new Date(op.discountDeadline).toLocaleDateString() : "N/A"}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">Standard Net</span>
                        )}
                      </td>

                      {/* Urgency Badge */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {isExpiringToday && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-600 text-white shadow-xs animate-pulse">
                            <AlertTriangle className="w-3 h-3" />
                            <span>EXPIRING TODAY ({op.hoursRemaining}h left)</span>
                          </span>
                        )}
                        {isUrgent && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            <Clock className="w-3 h-3 text-amber-700" />
                            <span>{op.daysRemaining} Days Left</span>
                          </span>
                        )}
                        {isActive && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            <Clock className="w-3 h-3 text-blue-600" />
                            <span>{op.daysRemaining} Days Remaining</span>
                          </span>
                        )}
                        {isExpired && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                            <span>Deadline Passed</span>
                          </span>
                        )}
                        {op.urgency === "NO_DISCOUNT" && (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>

                      {/* Potential Savings */}
                      <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
                        {op.potentialSavingsLkr > 0 ? (
                          <div>
                            <span className="text-emerald-700 font-extrabold text-sm">
                              +{formatCurrency(op.potentialSavingsLkr)}
                            </span>
                            <div className="text-[10px] text-emerald-600 font-sans font-semibold">
                              Save {op.earlyPaymentDiscountPercentage}%
                            </div>
                          </div>
                        ) : isExpired ? (
                          <div className="text-slate-400">
                            <span>Rs. 0</span>
                            <div className="text-[10px] text-rose-500">
                              Missed {formatCurrency(op.missedSavingsLkr)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Net Payout */}
                      <td className="py-3 px-4 text-right font-mono font-black text-sm whitespace-nowrap">
                        <span className={op.potentialSavingsLkr > 0 ? "text-blue-900" : "text-slate-900"}>
                          {formatCurrency(op.netSettlementAmountLkr)}
                        </span>
                        {op.potentialSavingsLkr > 0 && (
                          <div className="text-[10px] font-sans text-slate-500 font-normal">
                            Full {formatCurrency(op.outstandingBalance)} cleared
                          </div>
                        )}
                      </td>

                      {/* Action Button */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onPayBill(op)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 mx-auto shadow-xs ${
                            isExpiringToday
                              ? "bg-rose-600 hover:bg-rose-700 text-white"
                              : op.potentialSavingsLkr > 0
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                              : "bg-blue-600 hover:bg-blue-700 text-white"
                          }`}
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>
                            {op.potentialSavingsLkr > 0 ? "Pay & Claim Discount" : "Settle Bill"}
                          </span>
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

      {/* Financial Accounting Reconciliation Guidance Box */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3 text-xs text-slate-600">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold text-slate-900 block">
            Double-Entry Accounting & Statutory Tax Treatment:
          </span>
          <p>
            Prompt settlement discounts are recorded under <strong>"Other Financial Income / Discounts Received"</strong> in your P&L statement, rather than lowering inventory landed cost.
            When you disburse Rs. 98,000 on a Rs. 100,000 bill with 2% terms, the supplier's live Accounts Payable (AP) debt balance reduces by the full Rs. 100,000, perfectly matching your supplier ledger statement.
          </p>
        </div>
      </div>
    </div>
  );
}
