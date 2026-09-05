"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface ReportData {
  range: string;
  summary: {
    totalRevenue: number;
    totalTransactions: number;
    totalCostOfGoods: number;
    estimatedGrossProfit: number;
    averageOrderValue: number;
    totalDiscount: number;
    totalTax: number;
    lowStockCount: number;
  };
  paymentBreakdown: Record<string, { count: number; total: number }>;
  topProducts: Array<{
    name: string;
    unitsSold: number;
    revenue: number;
    estimatedProfit: number;
  }>;
}

export default function ReportsPage() {
  const [range, setRange] = useState<"today" | "yesterday" | "this_week" | "this_month">("today");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReports() {
      try {
        setLoading(true);
        const res = await fetch(`/api/reports?range=${range}`);
        const json = await res.json();
        if (json.success) {
          setData(json);
        }
      } catch (err) {
        console.error("Failed to load reports:", err);
      } finally {
        setLoading(false);
      }
    }
    loadReports();
  }, [range]);

  const summary = data?.summary || {
    totalRevenue: 0,
    totalTransactions: 0,
    totalCostOfGoods: 0,
    estimatedGrossProfit: 0,
    averageOrderValue: 0,
    totalDiscount: 0,
    totalTax: 0,
    lowStockCount: 0,
  };

  const payments = data?.paymentBreakdown || {};
  const totalRev = summary.totalRevenue || 1; // avoid divide by zero

  const cashTotal = payments.CASH?.total || 0;
  const cardTotal = payments.CARD?.total || 0;
  const qrTotal = payments.QR?.total || 0;
  const bankTotal = payments.BANK_TRANSFER?.total || 0;

  const grossMarginPercent =
    summary.totalRevenue > 0
      ? Math.round((summary.estimatedGrossProfit / summary.totalRevenue) * 100)
      : 0;

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Top Header & Range Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-blue-600" /> Business Reports & Profits
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Analyze daily counter sales, payment method splits, top-selling items, and estimated gross profit in LKR.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Range Selector */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setRange("today")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  range === "today" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setRange("yesterday")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  range === "yesterday" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Yesterday
              </button>
              <button
                onClick={() => setRange("this_week")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  range === "this_week" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                This Week
              </button>
              <button
                onClick={() => setRange("this_month")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  range === "this_month" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                This Month
              </button>
            </div>

            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors no-print"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Report</span>
            </button>
          </div>
        </div>

        {/* 4 Key Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-slate-500 text-xs font-medium block">Total Sales Revenue</span>
            <div className="text-2xl font-black text-slate-900 font-mono mt-1">
              {formatCurrency(summary.totalRevenue)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 capitalize">{range.replace("_", " ")} sales in LKR</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-slate-500 text-xs font-medium block">Bills / Transactions</span>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {summary.totalTransactions}{" "}
              <span className="text-sm font-normal text-slate-500">completed</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Total customer checkouts</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-slate-500 text-xs font-medium block">Estimated Gross Profit</span>
            <div className="text-2xl font-black text-emerald-700 font-mono mt-1">
              {formatCurrency(summary.estimatedGrossProfit)}
            </div>
            <p className="text-[11px] text-emerald-600 mt-1">Gross Margin: {grossMarginPercent}%</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-slate-500 text-xs font-medium block">Average Bill Size (AOV)</span>
            <div className="text-2xl font-black text-blue-950 font-mono mt-1">
              {formatCurrency(summary.averageOrderValue)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Average spent per transaction</p>
          </div>
        </div>

        {/* Middle Section: Payment Methods Split + Profit Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: Payment Method Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Coins className="w-4 h-4 text-blue-600" /> Payment Methods Distribution
            </h3>

            <div className="space-y-3">
              {/* Cash */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex justify-between items-center text-xs font-semibold mb-1">
                  <span className="flex items-center gap-1.5 text-emerald-800">
                    <Banknote className="w-3.5 h-3.5" /> Cash (Retail Counter)
                  </span>
                  <span className="font-mono text-slate-900">{formatCurrency(cashTotal)}</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all"
                    style={{ width: `${Math.round((cashTotal / totalRev) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>{payments.CASH?.count || 0} transactions</span>
                  <span>{Math.round((cashTotal / totalRev) * 100)}% of total</span>
                </div>
              </div>

              {/* Card */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex justify-between items-center text-xs font-semibold mb-1">
                  <span className="flex items-center gap-1.5 text-blue-800">
                    <CreditCard className="w-3.5 h-3.5" /> Card Terminal
                  </span>
                  <span className="font-mono text-slate-900">{formatCurrency(cardTotal)}</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all"
                    style={{ width: `${Math.round((cardTotal / totalRev) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>{payments.CARD?.count || 0} transactions</span>
                  <span>{Math.round((cardTotal / totalRev) * 100)}% of total</span>
                </div>
              </div>

              {/* LankaQR */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex justify-between items-center text-xs font-semibold mb-1">
                  <span className="flex items-center gap-1.5 text-purple-800">
                    <QrCode className="w-3.5 h-3.5" /> LankaQR / Mobile QR
                  </span>
                  <span className="font-mono text-slate-900">{formatCurrency(qrTotal)}</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-purple-500 h-full rounded-full transition-all"
                    style={{ width: `${Math.round((qrTotal / totalRev) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>{payments.QR?.count || 0} transactions</span>
                  <span>{Math.round((qrTotal / totalRev) * 100)}% of total</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Transparent Profit & Loss Formula */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" /> Transparent Profit Calculation
            </h3>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 font-mono text-xs">
              <div className="flex justify-between text-slate-700">
                <span>Gross Revenue:</span>
                <span className="font-bold text-slate-900">{formatCurrency(summary.totalRevenue)}</span>
              </div>

              {summary.totalDiscount > 0 && (
                <div className="flex justify-between text-slate-600 text-[11px]">
                  <span>Less: Discounts Given:</span>
                  <span className="text-rose-600">-{formatCurrency(summary.totalDiscount)}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-600 text-[11px]">
                <span>Less: Cost of Goods Sold (COGS):</span>
                <span className="text-rose-600">-{formatCurrency(summary.totalCostOfGoods)}</span>
              </div>

              <div className="pt-2 border-t-2 border-slate-300 flex justify-between text-sm font-black text-emerald-700">
                <span>ESTIMATED GROSS PROFIT:</span>
                <span>{formatCurrency(summary.estimatedGrossProfit)}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
              <span className="font-bold block mb-0.5">⚠️ Sri Lanka Small Business Accounting Note:</span>
              This figure represents **Gross Profit** (Total Sales minus Supplier Item Costs). It does not deduct operating expenses (such as store rent, electricity, or employee wages). Therefore, this is an estimate until formal operational expenses are logged.
            </div>
          </div>
        </div>

        {/* Bottom Full Table: Top-Selling Retail Products */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-600" /> Top-Selling Retail Products
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Best-performing items ranked by sales volume and profitability during this period.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4 text-center">Units Sold</th>
                  <th className="py-3 px-4 text-right">Revenue (Rs.)</th>
                  <th className="py-3 px-4 text-right">Estimated Gross Profit (Rs.)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Calculating product analytics...
                    </td>
                  </tr>
                ) : data?.topProducts && data.topProducts.length > 0 ? (
                  data.topProducts.map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-400">
                        #{idx + 1}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {p.name}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                        {p.unitsSold}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(p.revenue)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                        {formatCurrency(p.estimatedProfit)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No sales data recorded during this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
