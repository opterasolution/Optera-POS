"use client";

import { useEffect, useState, useMemo } from "react";
import AppLayout from "@/components/layout/AppLayout";
import {
  BarChart3,
  TrendingUp,
  Receipt,
  CreditCard,
  Banknote,
  QrCode,
  Building2,
  Printer,
  Calendar,
  Sparkles,
  Percent,
  Coins,
  Package,
  Monitor,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Download,
  ShieldAlert,
  Clock,
  Layers,
  HelpCircle,
  CheckCircle2,
  Tag,
  Search,
  ChevronRight,
  ExternalLink,
  Flame,
  Snowflake,
  RotateCcw,
  Wallet,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import Link from "next/link";

interface PnLData {
  grossSalesRevenue: number;
  totalDiscountsGiven: number;
  totalCustomerRefunds: number;
  netSalesRevenue: number;
  totalTransactions: number;
  totalReturnsCount: number;
  baseCOGS: number;
  restockedCOGSReduction: number;
  damagedStockLoss: number;
  netCOGS: number;
  grossProfit: number;
  grossMarginPercent: number;
  totalOperatingExpenses: number;
  expensesCount: number;
  expensesByCategory: Record<string, number>;
  expensesBySource: Record<string, number>;
  totalEarlyDiscountsReceived?: number;
  netOperatingProfit: number;
  netMarginPercent: number;
  totalTaxesCollected: number;
}

interface TrendDay {
  date: string;
  dayLabel: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
}

interface InventoryIntelligenceData {
  summary: {
    totalProducts: number;
    totalInventoryValuation: number;
    totalPotentialRevenue: number;
    deadStockCapital: number;
    deadStockCount: number;
    slowMovingCapital: number;
    slowMovingCount: number;
    fastMovingCount: number;
    moderateCount: number;
    healthScore: number;
  };
  categoryBreakdown: Array<{
    categoryName: string;
    productCount: number;
    tiedUpCapital: number;
    potentialRevenue: number;
    deadStockCapital: number;
    marginPercent: number;
  }>;
  topMarginProducts: Array<{
    name: string;
    sellingPrice: number;
    costPrice: number;
    marginPercent: number;
    categoryName: string;
  }>;
  items: Array<{
    productId: string;
    name: string;
    sku?: string;
    barcode?: string;
    categoryName: string;
    unit: string;
    stockQuantity: number;
    costPrice: number;
    sellingPrice: number;
    tiedUpCapital: number;
    potentialRevenue: number;
    unitMargin: number;
    marginPercent: number;
    daysSinceLastSale: number;
    unitsSold30d: number;
    agingStatus: "FAST_MOVING" | "MODERATE" | "SLOW_MOVING" | "DEAD_STOCK";
    clearanceRecommendation: string;
  }>;
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<"pnl" | "dead_stock" | "margins" | "counters">("pnl");
  const [range, setRange] = useState<"today" | "yesterday" | "this_week" | "this_month" | "last_month" | "this_year">("this_month");
  
  // Data States
  const [pnlData, setPnlData] = useState<PnLData | null>(null);
  const [pnlTrend, setPnlTrend] = useState<TrendDay[]>([]);
  const [inventoryData, setInventoryData] = useState<InventoryIntelligenceData | null>(null);
  const [legacyReport, setLegacyReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Inventory filter state
  const [inventoryFilter, setInventoryFilter] = useState<"all" | "dead_stock" | "slow_moving" | "fast_moving" | "loss_leaders">("all");
  const [inventorySearch, setInventorySearch] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [pnlRes, invRes, legacyRes] = await Promise.all([
          fetch(`/api/reports/pnl?range=${range}`),
          fetch(`/api/reports/inventory-intelligence?filter=${inventoryFilter}`),
          fetch(`/api/reports?range=${range}`),
        ]);

        const [pnlJson, invJson, legacyJson] = await Promise.all([
          pnlRes.json(),
          invRes.json(),
          legacyRes.json(),
        ]);

        if (pnlJson.success) {
          setPnlData(pnlJson.pnl);
          setPnlTrend(pnlJson.trend || []);
        }
        if (invJson.success) {
          setInventoryData(invJson);
        }
        if (legacyJson.success) {
          setLegacyReport(legacyJson);
        }
      } catch (err) {
        console.error("Failed to load reports:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [range, inventoryFilter]);

  // Filtered inventory items for Tab 2
  const filteredInventoryItems = useMemo(() => {
    if (!inventoryData?.items) return [];
    let list = inventoryData.items;
    if (inventorySearch.trim()) {
      const q = inventorySearch.toLowerCase();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.sku && i.sku.toLowerCase().includes(q)) ||
          (i.barcode && i.barcode.toLowerCase().includes(q)) ||
          i.categoryName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [inventoryData, inventorySearch]);

  // CSV Exporter
  const exportPnLToCsv = () => {
    if (!pnlData) return;
    const rows = [
      ["Metric", "Value (LKR)"],
      ["Gross Sales Revenue", pnlData.grossSalesRevenue],
      ["Less: Discounts Given", -pnlData.totalDiscountsGiven],
      ["Less: Customer Returns & Refunds", -pnlData.totalCustomerRefunds],
      ["Net Sales Revenue", pnlData.netSalesRevenue],
      ["Less: Base COGS", -pnlData.baseCOGS],
      ["Restocked Goods Adjustment", pnlData.restockedCOGSReduction],
      ["Damaged/Expired Stock Loss", -pnlData.damagedStockLoss],
      ["Net Cost of Goods Sold (COGS)", -pnlData.netCOGS],
      ["GROSS PROFIT", pnlData.grossProfit],
      ["Gross Margin %", `${pnlData.grossMarginPercent}%`],
      ["Less: Total Operating Expenses", -pnlData.totalOperatingExpenses],
      ["  - Staff Meals & Refreshments", pnlData.expensesByCategory?.MEALS_AND_TEA || pnlData.expensesByCategory?.STAFF_MEALS || 0],
      ["  - Polybags & Packaging", pnlData.expensesByCategory?.PACKAGING || 0],
      ["  - Local Transport & Delivery", pnlData.expensesByCategory?.TRANSPORT || 0],
      ["  - Utilities (CEB/NWSDB/Telecom)", pnlData.expensesByCategory?.UTILITIES || 0],
      ["  - Repairs & Maintenance", pnlData.expensesByCategory?.MAINTENANCE || 0],
      ["  - Store Rent", pnlData.expensesByCategory?.RENT || 0],
      ["  - Municipal Council Taxes", pnlData.expensesByCategory?.MUNICIPAL_TAX || 0],
      ["  - Salary Advances", pnlData.expensesByCategory?.SALARY_ADVANCE || 0],
      ["  - Other Sundry Expenses", pnlData.expensesByCategory?.OTHER || 0],
      ["Plus: Early Payment Cash Discounts Received (AP Rebates)", pnlData.totalEarlyDiscountsReceived || 0],
      ["NET OPERATING PROFIT", pnlData.netOperatingProfit],
      ["Net Margin %", `${pnlData.netMarginPercent}%`],
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `PnL_Report_${range}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const pnl = pnlData || {
    grossSalesRevenue: 0,
    totalDiscountsGiven: 0,
    totalCustomerRefunds: 0,
    netSalesRevenue: 0,
    totalTransactions: 0,
    totalReturnsCount: 0,
    baseCOGS: 0,
    restockedCOGSReduction: 0,
    damagedStockLoss: 0,
    netCOGS: 0,
    grossProfit: 0,
    grossMarginPercent: 0,
    totalOperatingExpenses: 0,
    expensesCount: 0,
    expensesByCategory: {},
    expensesBySource: {},
    totalEarlyDiscountsReceived: 0,
    netOperatingProfit: 0,
    netMarginPercent: 0,
    totalTaxesCollected: 0,
  };

  const invSummary = inventoryData?.summary || {
    totalProducts: 0,
    totalInventoryValuation: 0,
    totalPotentialRevenue: 0,
    deadStockCapital: 0,
    deadStockCount: 0,
    slowMovingCapital: 0,
    slowMovingCount: 0,
    fastMovingCount: 0,
    moderateCount: 0,
    healthScore: 100,
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Printable Executive P&L Formal Document (Hidden on screen, visible on print) */}
        <div className="hidden print:block font-sans text-slate-900 p-8 max-w-4xl mx-auto">
          <div className="border-b-2 border-slate-900 pb-4 mb-6">
            <h1 className="text-2xl font-black uppercase tracking-wider text-center">
              Executive Profit & Loss Statement (Income Statement)
            </h1>
            <div className="flex justify-between items-center text-xs mt-2 text-slate-600 font-mono">
              <span>Period: {range.replace("_", " ").toUpperCase()}</span>
              <span>Generated: {new Date().toLocaleString("en-LK")}</span>
            </div>
          </div>

          <table className="w-full text-xs font-mono border-collapse mb-6">
            <thead>
              <tr className="border-b-2 border-slate-400 text-left">
                <th className="py-2">Line Item Account</th>
                <th className="py-2 text-right">Amount (LKR)</th>
                <th className="py-2 text-right">% of Net Sales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="py-2 font-bold">Gross Sales Revenue</td>
                <td className="py-2 text-right">{formatCurrency(pnl.grossSalesRevenue)}</td>
                <td className="py-2 text-right">-</td>
              </tr>
              {pnl.totalDiscountsGiven > 0 && (
                <tr className="text-slate-600">
                  <td className="py-1 pl-4">Less: POS Cashier Discounts</td>
                  <td className="py-1 text-right text-rose-700">-{formatCurrency(pnl.totalDiscountsGiven)}</td>
                  <td className="py-1 text-right">{pnl.netSalesRevenue > 0 ? ((pnl.totalDiscountsGiven / pnl.netSalesRevenue) * 100).toFixed(1) : 0}%</td>
                </tr>
              )}
              {pnl.totalCustomerRefunds > 0 && (
                <tr className="text-slate-600">
                  <td className="py-1 pl-4">Less: Customer Returns & Cash Refunds</td>
                  <td className="py-1 text-right text-rose-700">-{formatCurrency(pnl.totalCustomerRefunds)}</td>
                  <td className="py-1 text-right">{pnl.netSalesRevenue > 0 ? ((pnl.totalCustomerRefunds / pnl.netSalesRevenue) * 100).toFixed(1) : 0}%</td>
                </tr>
              )}
              <tr className="bg-slate-100 font-bold">
                <td className="py-2">NET SALES REVENUE</td>
                <td className="py-2 text-right">{formatCurrency(pnl.netSalesRevenue)}</td>
                <td className="py-2 text-right">100.0%</td>
              </tr>
              <tr>
                <td className="py-2 pl-4">Cost of Goods Sold (COGS)</td>
                <td className="py-2 text-right text-rose-700">-{formatCurrency(pnl.netCOGS)}</td>
                <td className="py-2 text-right">{pnl.netSalesRevenue > 0 ? ((pnl.netCOGS / pnl.netSalesRevenue) * 100).toFixed(1) : 0}%</td>
              </tr>
              <tr className="bg-slate-100 font-bold text-emerald-800">
                <td className="py-2">GROSS PROFIT</td>
                <td className="py-2 text-right">{formatCurrency(pnl.grossProfit)}</td>
                <td className="py-2 text-right">{pnl.grossMarginPercent}%</td>
              </tr>
              <tr>
                <td className="py-2 font-bold" colSpan={3}>Operating Expenses (OPEX):</td>
              </tr>
              {Object.entries(pnl.expensesByCategory || {}).map(([cat, amt]) => {
                if (!amt) return null;
                return (
                  <tr key={cat} className="text-slate-600">
                    <td className="py-1 pl-6">{cat.replace(/_/g, " ")}</td>
                    <td className="py-1 text-right text-rose-700">-{formatCurrency(amt)}</td>
                    <td className="py-1 text-right">{pnl.netSalesRevenue > 0 ? ((amt / pnl.netSalesRevenue) * 100).toFixed(1) : 0}%</td>
                  </tr>
                );
              })}
              <tr className="font-semibold text-rose-800">
                <td className="py-1 pl-4">Total Operating Expenses</td>
                <td className="py-1 text-right">-{formatCurrency(pnl.totalOperatingExpenses)}</td>
                <td className="py-1 text-right">{pnl.netSalesRevenue > 0 ? ((pnl.totalOperatingExpenses / pnl.netSalesRevenue) * 100).toFixed(1) : 0}%</td>
              </tr>
              {(pnl.totalEarlyDiscountsReceived || 0) > 0 && (
                <tr className="font-semibold text-emerald-800">
                  <td className="py-1 pl-4">Add: Prompt Payment Discounts Received (AP Rebates)</td>
                  <td className="py-1 text-right text-emerald-700">+{formatCurrency(pnl.totalEarlyDiscountsReceived || 0)}</td>
                  <td className="py-1 text-right">{pnl.netSalesRevenue > 0 ? (((pnl.totalEarlyDiscountsReceived || 0) / pnl.netSalesRevenue) * 100).toFixed(1) : 0}%</td>
                </tr>
              )}
              <tr className="border-t-2 border-b-2 border-slate-900 bg-slate-200 font-black text-sm">
                <td className="py-3">NET OPERATING PROFIT (EBITDA)</td>
                <td className="py-3 text-right">{formatCurrency(pnl.netOperatingProfit)}</td>
                <td className="py-3 text-right">{pnl.netMarginPercent}%</td>
              </tr>
            </tbody>
          </table>

          <div className="grid grid-cols-2 gap-8 mt-16 pt-8 border-t border-slate-400 text-xs">
            <div className="text-center">
              <div className="h-12 border-b border-slate-400 mb-2"></div>
              <p className="font-bold">Prepared By (Store Accountant / Manager)</p>
            </div>
            <div className="text-center">
              <div className="h-12 border-b border-slate-400 mb-2"></div>
              <p className="font-bold">Approved By (Store Director / Business Owner)</p>
            </div>
          </div>
        </div>

        {/* Screen Header & Top Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm no-print">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-blue-600" />
              Financial Reports & Inventory Intelligence
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Executive Profit & Loss (P&L), real COGS, dead stock analysis, and product margin contributions in LKR.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Period selector */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setRange("today")}
                className={`px-2.5 py-1.5 rounded-lg transition-all ${
                  range === "today" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setRange("yesterday")}
                className={`px-2.5 py-1.5 rounded-lg transition-all ${
                  range === "yesterday" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Yesterday
              </button>
              <button
                onClick={() => setRange("this_week")}
                className={`px-2.5 py-1.5 rounded-lg transition-all ${
                  range === "this_week" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setRange("this_month")}
                className={`px-2.5 py-1.5 rounded-lg transition-all ${
                  range === "this_month" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                This Month
              </button>
              <button
                onClick={() => setRange("last_month")}
                className={`px-2.5 py-1.5 rounded-lg transition-all ${
                  range === "last_month" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Last Month
              </button>
            </div>

            <button
              onClick={exportPnLToCsv}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Export P&L to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm shadow-blue-500/20"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print P&L</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 gap-2 no-print overflow-x-auto">
          <button
            onClick={() => setActiveTab("pnl")}
            className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === "pnl"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Executive Profit & Loss (P&L)
          </button>

          <button
            onClick={() => setActiveTab("dead_stock")}
            className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === "dead_stock"
                ? "border-amber-600 text-amber-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            Dead Stock & Aging Intelligence
            {invSummary.deadStockCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-100 text-rose-700 font-black">
                {invSummary.deadStockCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("margins")}
            className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === "margins"
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Percent className="w-4 h-4" />
            Category Margins & Loss Leaders
          </button>

          <button
            onClick={() => setActiveTab("counters")}
            className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === "counters"
                ? "border-purple-600 text-purple-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Coins className="w-4 h-4" />
            Counter Registers & Payment Splits
          </button>
        </div>

        {/* TAB 1: EXECUTIVE PROFIT & LOSS (P&L) */}
        {activeTab === "pnl" && (
          <div className="space-y-6 no-print">
            {/* 5 KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-slate-500 text-xs font-medium block">Net Sales Revenue</span>
                <div className="text-2xl font-black text-slate-900 font-mono mt-1">
                  {formatCurrency(pnl.netSalesRevenue)}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {pnl.totalTransactions} bills ({pnl.totalReturnsCount} returns)
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-slate-500 text-xs font-medium block">Cost of Goods Sold</span>
                <div className="text-2xl font-black text-rose-700 font-mono mt-1">
                  {formatCurrency(pnl.netCOGS)}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {pnl.netSalesRevenue > 0 ? ((pnl.netCOGS / pnl.netSalesRevenue) * 100).toFixed(1) : 0}% of net sales
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-slate-500 text-xs font-medium block">Gross Profit</span>
                <div className="text-2xl font-black text-blue-700 font-mono mt-1">
                  {formatCurrency(pnl.grossProfit)}
                </div>
                <p className="text-[11px] text-blue-600 font-semibold mt-1">
                  Gross Margin: {pnl.grossMarginPercent}%
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-slate-500 text-xs font-medium block">Operating Expenses</span>
                <div className="text-2xl font-black text-amber-700 font-mono mt-1">
                  {formatCurrency(pnl.totalOperatingExpenses)}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {pnl.expensesCount} petty cash & shop vouchers
                </p>
              </div>

              <div className={`p-5 rounded-2xl border shadow-sm ${
                pnl.netOperatingProfit >= 0 ? "bg-emerald-50/70 border-emerald-200" : "bg-rose-50 border-rose-200"
              }`}>
                <span className={`text-xs font-medium block ${pnl.netOperatingProfit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  Net Operating Profit
                </span>
                <div className={`text-2xl font-black font-mono mt-1 ${pnl.netOperatingProfit >= 0 ? "text-emerald-800" : "text-rose-800"}`}>
                  {formatCurrency(pnl.netOperatingProfit)}
                </div>
                <p className={`text-[11px] font-semibold mt-1 flex items-center gap-1 ${pnl.netOperatingProfit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  {pnl.netOperatingProfit >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  Net Margin: {pnl.netMarginPercent}%
                </p>
                {(pnl.totalEarlyDiscountsReceived || 0) > 0 && (
                  <p className="text-[10px] text-emerald-700 font-medium mt-1">
                    Incl. +{formatCurrency(pnl.totalEarlyDiscountsReceived || 0)} AP prompt discounts
                  </p>
                )}
              </div>
            </div>

            {/* Income Statement & Operating Expenses Drilldown */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Formal Income Statement Table */}
              <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    Formal Income Statement (P&L Breakdown)
                  </h3>
                  <span className="text-[11px] font-mono text-slate-400">Values in LKR</span>
                </div>

                <div className="space-y-2.5 font-mono text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-600">Gross Counter Sales</span>
                    <span className="font-bold text-slate-900">{formatCurrency(pnl.grossSalesRevenue)}</span>
                  </div>

                  {pnl.totalDiscountsGiven > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-50 text-slate-500 pl-4">
                      <span>Less: Cashier Discounts Given</span>
                      <span className="text-rose-600">-{formatCurrency(pnl.totalDiscountsGiven)}</span>
                    </div>
                  )}

                  {pnl.totalCustomerRefunds > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-50 text-slate-500 pl-4">
                      <span>Less: Customer Returns & Cash Refunds</span>
                      <span className="text-rose-600">-{formatCurrency(pnl.totalCustomerRefunds)}</span>
                    </div>
                  )}

                  <div className="flex justify-between py-2 bg-slate-50 px-3 rounded-lg font-bold text-slate-900">
                    <span>= NET SALES REVENUE</span>
                    <span>{formatCurrency(pnl.netSalesRevenue)}</span>
                  </div>

                  <div className="flex justify-between py-1 text-slate-600 pl-4">
                    <span>Less: Net Cost of Goods Sold (COGS)</span>
                    <span className="text-rose-600">-{formatCurrency(pnl.netCOGS)}</span>
                  </div>

                  <div className="flex justify-between py-2 bg-blue-50 px-3 rounded-lg font-bold text-blue-900">
                    <span>= GROSS PROFIT (Gross Margin: {pnl.grossMarginPercent}%)</span>
                    <span>{formatCurrency(pnl.grossProfit)}</span>
                  </div>

                  <div className="flex justify-between py-1 text-slate-600 pl-4">
                    <span>Less: Store Operating Expenses (OPEX)</span>
                    <span className="text-rose-600">-{formatCurrency(pnl.totalOperatingExpenses)}</span>
                  </div>

                  {(pnl.totalEarlyDiscountsReceived || 0) > 0 && (
                    <div className="flex justify-between py-1 text-emerald-700 pl-4 font-semibold">
                      <span>Add: Prompt Payment Discounts Received (AP Rebates)</span>
                      <span className="text-emerald-600">+{formatCurrency(pnl.totalEarlyDiscountsReceived || 0)}</span>
                    </div>
                  )}

                  <div className={`flex justify-between py-3 px-3 rounded-xl font-black text-sm border-2 ${
                    pnl.netOperatingProfit >= 0
                      ? "bg-emerald-50 border-emerald-500 text-emerald-900"
                      : "bg-rose-50 border-rose-500 text-rose-900"
                  }`}>
                    <span>= NET OPERATING PROFIT (Net Margin: {pnl.netMarginPercent}%)</span>
                    <span>{formatCurrency(pnl.netOperatingProfit)}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[11px] leading-relaxed">
                  <span className="font-bold text-slate-800 block mb-1">💡 Sri Lankan Small Business Insights:</span>
                  Net Operating Profit reflects your true bottom-line after deducting physical item acquisition costs (COGS) plus real store operational expenses (meals, bags, electricity, tuk-tuk delivery, and municipal taxes).
                </div>
              </div>

              {/* Operating Expenses Breakdown */}
              <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-amber-600" />
                    Operating Expenses by Category
                  </h3>
                  <Link
                    href="/expenses"
                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
                  >
                    <span>View Hub</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="space-y-3">
                  {Object.entries(pnl.expensesByCategory || {}).map(([cat, amt]) => {
                    const percent = pnl.totalOperatingExpenses > 0
                      ? Math.round((amt / pnl.totalOperatingExpenses) * 100)
                      : 0;

                    const catLabels: Record<string, string> = {
                      MEALS_AND_TEA: "Staff Meals & Tea (කෑම/තේ)",
                      STAFF_MEALS: "Staff Meals & Refreshments",
                      PACKAGING: "Polybags & Packaging",
                      TRANSPORT: "Local Transport & Tuk-Tuk",
                      UTILITIES: "Utilities (CEB / Water / Internet)",
                      MAINTENANCE: "Repairs & Maintenance",
                      RENT: "Store Rent",
                      MUNICIPAL_TAX: "Council / Pradeshiya Sabha",
                      SALARY_ADVANCE: "Staff Salary Advances",
                      OTHER: "General & Miscellaneous",
                    };

                    return (
                      <div key={cat} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="flex justify-between items-center text-xs font-semibold mb-1">
                          <span className="text-slate-800">{catLabels[cat] || cat.replace(/_/g, " ")}</span>
                          <span className="font-mono text-slate-900">{formatCurrency(amt)}</span>
                        </div>
                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-amber-500 h-full rounded-full transition-all"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                          <span>{percent}% of total expenses</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Expense Disbursement Source */}
                <div className="pt-3 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-700 block mb-2">Disbursement Channel:</span>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 block">Register Drawer</span>
                      <span className="font-bold font-mono text-slate-900">
                        {formatCurrency(pnl.expensesBySource?.REGISTER_DRAWER || 0)}
                      </span>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 block">Petty Cash Safe</span>
                      <span className="font-bold font-mono text-slate-900">
                        {formatCurrency(pnl.expensesBySource?.STORE_PETTY_CASH || 0)}
                      </span>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 block">Bank Account</span>
                      <span className="font-bold font-mono text-slate-900">
                        {formatCurrency(pnl.expensesBySource?.BANK_ACCOUNT || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Daily Trend Chart (Waterfall/Bar) */}
            {pnlTrend.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-blue-600" />
                      Daily Profitability Timeline
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Net Sales vs COGS vs Expenses vs Net Profit over days.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 text-left">
                        <th className="py-2">Date</th>
                        <th className="py-2 text-right">Net Revenue</th>
                        <th className="py-2 text-right">COGS</th>
                        <th className="py-2 text-right">Gross Profit</th>
                        <th className="py-2 text-right">Expenses</th>
                        <th className="py-2 text-right">Net Profit</th>
                        <th className="py-2 text-center">Net Margin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pnlTrend.map((t) => {
                        const mPercent = t.revenue > 0 ? Math.round((t.netProfit / t.revenue) * 100) : 0;
                        return (
                          <tr key={t.date} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 font-bold text-slate-800">{t.dayLabel}</td>
                            <td className="py-2.5 text-right font-semibold">{formatCurrency(t.revenue)}</td>
                            <td className="py-2.5 text-right text-rose-600">-{formatCurrency(t.cogs)}</td>
                            <td className="py-2.5 text-right text-blue-600 font-semibold">{formatCurrency(t.grossProfit)}</td>
                            <td className="py-2.5 text-right text-amber-600">-{formatCurrency(t.expenses)}</td>
                            <td className={`py-2.5 text-right font-bold ${t.netProfit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                              {formatCurrency(t.netProfit)}
                            </td>
                            <td className="py-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                mPercent >= 15
                                  ? "bg-emerald-100 text-emerald-800"
                                  : mPercent > 0
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}>
                                {mPercent}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DEAD STOCK & INVENTORY INTELLIGENCE */}
        {activeTab === "dead_stock" && (
          <div className="space-y-6 no-print">
            {/* 4 Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-slate-500 text-xs font-medium block">Total Inventory Valuation</span>
                <div className="text-2xl font-black text-slate-900 font-mono mt-1">
                  {formatCurrency(invSummary.totalInventoryValuation)}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Across {invSummary.totalProducts} active product SKUs
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-sm bg-rose-50/30">
                <span className="text-rose-700 text-xs font-bold block flex items-center gap-1.5">
                  <Snowflake className="w-3.5 h-3.5 text-rose-600" />
                  Locked in Dead Stock (60+ Days)
                </span>
                <div className="text-2xl font-black text-rose-800 font-mono mt-1">
                  {formatCurrency(invSummary.deadStockCapital)}
                </div>
                <p className="text-[11px] text-rose-600 mt-1 font-semibold">
                  {invSummary.deadStockCount} SKUs ({invSummary.totalInventoryValuation > 0 ? ((invSummary.deadStockCapital / invSummary.totalInventoryValuation) * 100).toFixed(1) : 0}% of store capital)
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-sm bg-amber-50/30">
                <span className="text-amber-700 text-xs font-bold block flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  Slow-Moving Capital (31-60 Days)
                </span>
                <div className="text-2xl font-black text-amber-800 font-mono mt-1">
                  {formatCurrency(invSummary.slowMovingCapital)}
                </div>
                <p className="text-[11px] text-amber-600 mt-1 font-semibold">
                  {invSummary.slowMovingCount} SKUs needing shelf attention
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm bg-emerald-50/30">
                <span className="text-emerald-700 text-xs font-bold block flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Inventory Health Score
                </span>
                <div className="text-2xl font-black text-emerald-800 font-mono mt-1">
                  {invSummary.healthScore}%
                </div>
                <p className="text-[11px] text-emerald-600 mt-1">
                  {invSummary.healthScore >= 80 ? "Healthy capital velocity" : "Attention needed on dormant SKUs"}
                </p>
              </div>
            </div>

            {/* Filter Pills & Search Bar */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <button
                  onClick={() => setInventoryFilter("all")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    inventoryFilter === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  All Items
                </button>
                <button
                  onClick={() => setInventoryFilter("dead_stock")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    inventoryFilter === "dead_stock"
                      ? "bg-rose-600 text-white shadow-sm"
                      : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                  }`}
                >
                  <Snowflake className="w-3.5 h-3.5" />
                  Dead Stock (60+ days)
                </button>
                <button
                  onClick={() => setInventoryFilter("slow_moving")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    inventoryFilter === "slow_moving"
                      ? "bg-amber-600 text-white shadow-sm"
                      : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  Slow Moving (31-60 days)
                </button>
                <button
                  onClick={() => setInventoryFilter("fast_moving")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    inventoryFilter === "fast_moving"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" />
                  Fast Movers
                </button>
                <button
                  onClick={() => setInventoryFilter("loss_leaders")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    inventoryFilter === "loss_leaders"
                      ? "bg-purple-600 text-white shadow-sm"
                      : "bg-purple-50 text-purple-700 hover:bg-purple-100"
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Loss Leaders (&lt;5% margin)
                </button>
              </div>

              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search SKU or item name..."
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            {/* Inventory Intelligence Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-600" />
                    Inventory Aging & Capital Recovery Action Table
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Showing {filteredInventoryItems.length} products sorted by tied-up capital in LKR.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-3 px-4">Product / SKU</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4 text-right">Stock</th>
                      <th className="py-3 px-4 text-right">Cost Price</th>
                      <th className="py-3 px-4 text-right">Selling Price</th>
                      <th className="py-3 px-4 text-right">Tied-Up Capital</th>
                      <th className="py-3 px-4 text-center">Movement Status</th>
                      <th className="py-3 px-4">Sri Lankan Retail Clearance Advice</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredInventoryItems.length > 0 ? (
                      filteredInventoryItems.map((item) => (
                        <tr key={item.productId} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900 block">{item.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              SKU: {item.sku || "N/A"} | {item.barcode || "No Barcode"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600">{item.categoryName}</td>
                          <td className="py-3 px-4 text-right font-bold text-slate-800">
                            {item.stockQuantity} <span className="text-[10px] font-normal text-slate-400">{item.unit}</span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-600">
                            {formatCurrency(item.costPrice)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-900 font-bold">
                            {formatCurrency(item.sellingPrice)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-rose-700">
                            {formatCurrency(item.tiedUpCapital)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {item.agingStatus === "DEAD_STOCK" && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 inline-flex items-center gap-1">
                                <Snowflake className="w-3 h-3 text-rose-600" />
                                Dead ({item.daysSinceLastSale}d)
                              </span>
                            )}
                            {item.agingStatus === "SLOW_MOVING" && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 inline-flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-600" />
                                Slow ({item.daysSinceLastSale}d)
                              </span>
                            )}
                            {item.agingStatus === "FAST_MOVING" && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 inline-flex items-center gap-1">
                                <Flame className="w-3 h-3 text-emerald-600" />
                                Fast Mover
                              </span>
                            )}
                            {item.agingStatus === "MODERATE" && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                                Normal ({item.daysSinceLastSale}d)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-[11px] text-slate-700 font-medium block">
                              {item.clearanceRecommendation}
                            </span>
                            <div className="flex items-center gap-2 mt-1">
                              {item.agingStatus === "DEAD_STOCK" && (
                                <Link
                                  href="/promotions"
                                  className="text-[10px] text-blue-600 hover:underline font-bold inline-flex items-center gap-0.5"
                                >
                                  <Tag className="w-3 h-3" /> Create Promotion
                                </Link>
                              )}
                              <Link
                                href="/labels"
                                className="text-[10px] text-slate-500 hover:text-slate-800 font-bold inline-flex items-center gap-0.5"
                              >
                                Print Price Talker
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="text-center py-10 text-slate-400 text-xs">
                          No products found matching this filter criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CATEGORY MARGINS & LOSS LEADERS */}
        {activeTab === "margins" && (
          <div className="space-y-6 no-print">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Category Margin Breakdown Table */}
              <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Percent className="w-4 h-4 text-emerald-600" />
                    Product Category Profit Margin Matrix
                  </h3>
                  <span className="text-[11px] text-slate-400">Ranked by margin %</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 text-left">
                        <th className="py-2">Category</th>
                        <th className="py-2 text-right">SKUs</th>
                        <th className="py-2 text-right">Stock Capital</th>
                        <th className="py-2 text-right">Potential Revenue</th>
                        <th className="py-2 text-right">Dead Capital</th>
                        <th className="py-2 text-center">Avg Margin %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {inventoryData?.categoryBreakdown?.map((cat) => (
                        <tr key={cat.categoryName} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 font-bold text-slate-800">{cat.categoryName}</td>
                          <td className="py-2.5 text-right font-mono">{cat.productCount}</td>
                          <td className="py-2.5 text-right font-mono">{formatCurrency(cat.tiedUpCapital)}</td>
                          <td className="py-2.5 text-right font-mono">{formatCurrency(cat.potentialRevenue)}</td>
                          <td className="py-2.5 text-right font-mono text-rose-700">
                            {cat.deadStockCapital > 0 ? formatCurrency(cat.deadStockCapital) : "-"}
                          </td>
                          <td className="py-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                              cat.marginPercent >= 25
                                ? "bg-emerald-100 text-emerald-800"
                                : cat.marginPercent >= 12
                                ? "bg-blue-100 text-blue-800"
                                : "bg-amber-100 text-amber-800"
                            }`}>
                              {cat.marginPercent}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Top Margin Contributors */}
              <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Flame className="w-4 h-4 text-emerald-600" />
                    Top Profit Margin Contributors
                  </h3>
                </div>

                <div className="space-y-3">
                  {inventoryData?.topMarginProducts?.map((p, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex justify-between items-start text-xs font-semibold mb-1">
                        <span className="text-slate-900 font-bold truncate pr-2">{p.name}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 shrink-0">
                          {p.marginPercent}%
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500 font-mono mt-1">
                        <span>Cost: {formatCurrency(p.costPrice)}</span>
                        <span>Price: {formatCurrency(p.sellingPrice)}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">{p.categoryName}</span>
                    </div>
                  ))}
                </div>

                <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-900 text-[11px] leading-relaxed">
                  <span className="font-bold block mb-1">Strategic Pricing Tip:</span>
                  Essential staples (rice, sugar, dhal) usually carry thin margins (2-8%). Maximize profitability by cross-merchandising high-margin goods (spices, herbal balms, biscuits, tea) near cash counters.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: COUNTER REGISTERS & PAYMENT SPLIT (Preserved from original Reports) */}
        {activeTab === "counters" && legacyReport && (
          <div className="space-y-6 no-print">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Payment Methods */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Coins className="w-4 h-4 text-blue-600" /> Payment Methods Distribution
                </h3>

                <div className="space-y-3">
                  {Object.entries(legacyReport.paymentBreakdown || {}).map(([method, val]: any) => {
                    const totalR = legacyReport.summary?.totalRevenue || 1;
                    const percent = Math.round((val.total / totalR) * 100);
                    return (
                      <div key={method} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="flex justify-between items-center text-xs font-semibold mb-1">
                          <span className="text-slate-800">{method}</span>
                          <span className="font-mono text-slate-900">{formatCurrency(val.total)}</span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-blue-600 h-full rounded-full transition-all"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                          <span>{val.count} transactions</span>
                          <span>{percent}% of total</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Counter Breakdown */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-blue-600" /> Sales by Checkout Register
                </h3>

                <div className="space-y-3">
                  {(legacyReport.registerBreakdown || []).map((item: any, idx: number) => {
                    const totalR = legacyReport.summary?.totalRevenue || 1;
                    const regPercent = Math.round((item.total / totalR) * 100);
                    return (
                      <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="flex justify-between items-center text-xs font-semibold mb-1">
                          <span className="text-slate-800 truncate">{item.name}</span>
                          <span className="font-mono text-slate-900">{formatCurrency(item.total)}</span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-600 h-full rounded-full transition-all"
                            style={{ width: `${regPercent}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                          <span>{item.count} checkouts</span>
                          <span>{regPercent}% of sales</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
