"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import AppLayout from "@/components/layout/AppLayout";
import {
  ShoppingCart,
  Receipt,
  TrendingUp,
  AlertTriangle,
  Boxes,
  Users,
  ArrowRight,
  Sparkles,
  Store,
  Clock,
  CheckCircle,
  CheckCircle2,
  X,
  Settings,
  Printer,
} from "lucide-react";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";

interface DashboardData {
  stats: {
    todaySalesTotal: number;
    todayTransactions: number;
    estimatedGrossProfit: number;
    totalProducts: number;
    lowStockCount: number;
    totalCustomers: number;
  };
  lowStockProducts: Array<{
    _id: string;
    name: string;
    stockQuantity: number;
    lowStockThreshold: number;
    unit: string;
    sellingPrice: number;
  }>;
  recentSales: Array<{
    _id: string;
    invoiceNumber: string;
    cashierName: string;
    customerName: string;
    paymentMethod: string;
    netTotal: number;
    createdAt: string;
  }>;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChecklist, setShowChecklist] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const res = await fetch("/api/dashboard");
        const json = await res.json();
        if (json.success) {
          setData(json);
        }
      } catch (err) {
        console.error("Failed to load dashboard:", err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  const stats = data?.stats || {
    todaySalesTotal: 0,
    todayTransactions: 0,
    estimatedGrossProfit: 0,
    totalProducts: 0,
    lowStockCount: 0,
    totalCustomers: 0,
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Top Welcome Bar & Fast POS Launch */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 mb-1">
              <Sparkles className="w-3.5 h-3.5" /> Sri Lanka Retail Management
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {session?.user?.businessName || "Store Dashboard"}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Logged in as <span className="font-semibold text-slate-700">{session?.user?.name || "Admin"}</span> ({session?.user?.role || "OWNER"})
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/pos"
              className="inline-flex items-center justify-center gap-2.5 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-500/25 transition-all"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Launch POS Counter</span>
            </Link>
          </div>
        </div>

        {/* Store Launch & Getting Started Checklist */}
        {showChecklist && (
          <div className="bg-gradient-to-r from-blue-900/10 via-indigo-900/10 to-blue-950/5 border border-blue-200/80 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Store Setup & Launch Checklist
                  </h3>
                  <p className="text-xs text-slate-500">
                    Complete these essential steps to get the most out of your 14-day free trial.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowChecklist(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/50 transition cursor-pointer"
                title="Dismiss checklist"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
              <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-slate-900">Store Registered</div>
                  <div className="text-[11px] text-slate-500">14-Day Free Trial Active</div>
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-slate-900">Inventory Seeded</div>
                  <div className="text-[11px] text-slate-500">{stats.totalProducts} Starter Products</div>
                </div>
              </div>

              <Link
                href="/pos"
                className={`p-3 bg-white rounded-xl border transition flex items-start gap-2.5 ${
                  stats.todayTransactions > 0
                    ? "border-emerald-200 hover:border-emerald-300"
                    : "border-blue-300 ring-2 ring-blue-500/20 hover:border-blue-400"
                }`}
              >
                {stats.todayTransactions > 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <ShoppingCart className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    {stats.todayTransactions > 0 ? "First Sale Completed!" : "Ring Up First Sale"}
                  </div>
                  <div className="text-[11px] text-blue-600 font-medium">Open POS Counter →</div>
                </div>
              </Link>

              <Link
                href="/settings"
                className="p-3 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition flex items-start gap-2.5"
              >
                <Printer className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-slate-900">Printer & Receipts</div>
                  <div className="text-[11px] text-slate-500">Customize 58mm/80mm →</div>
                </div>
              </Link>
            </div>
          </div>
        )}

        {/* 4 Key Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Today's Sales */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
              <span>Today's Sales (LKR)</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900">
              {formatCurrency(stats.todaySalesTotal)}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-2">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>Reset daily at midnight (Asia/Colombo)</span>
            </div>
          </div>

          {/* Card 2: Today's Bills */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
              <span>Bills / Transactions</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900">
              {stats.todayTransactions}{" "}
              <span className="text-sm font-normal text-slate-500">completed</span>
            </div>
            <div className="text-[11px] text-emerald-600 font-medium mt-2">
              Live counter activity
            </div>
          </div>

          {/* Card 3: Estimated Gross Profit */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
              <span>Estimated Gross Profit</span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-purple-700">
              {formatCurrency(stats.estimatedGrossProfit)}
            </div>
            <div className="text-[11px] text-slate-500 mt-2">
              Revenue minus Cost of Goods Sold
            </div>
          </div>

          {/* Card 4: Low Stock Warnings */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
              <span>Low Stock Alerts</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-amber-600">
              {stats.lowStockCount}{" "}
              <span className="text-sm font-normal text-slate-500">products</span>
            </div>
            <Link
              href="/inventory"
              className="inline-flex items-center gap-1 text-[11px] text-amber-700 font-semibold hover:underline mt-2"
            >
              <span>View inventory stock</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Main Content Grid: Recent Sales + Low Stock List */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Recent Transactions */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <Receipt className="w-4 h-4 text-blue-600" /> Recent Sales
              </div>
              <Link
                href="/sales"
                className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1"
              >
                <span>All Invoices</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4 text-right">Total (Rs.)</th>
                    <th className="py-3 px-4 text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        Loading recent sales...
                      </td>
                    </tr>
                  ) : data?.recentSales && data.recentSales.length > 0 ? (
                    data.recentSales.map((sale) => (
                      <tr key={sale._id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                          {sale.invoiceNumber}
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          {sale.customerName || "Walk-in"}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full ${
                              sale.paymentMethod === "CASH"
                                ? "bg-emerald-100 text-emerald-800"
                                : sale.paymentMethod === "CARD"
                                ? "bg-blue-100 text-blue-800"
                                : sale.paymentMethod === "QR"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {sale.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          {formatCurrency(sale.netTotal)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-500 font-mono text-[11px]">
                          {formatSLDateTime(sale.createdAt)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No sales recorded today yet. Launch the POS counter to ring up your first sale!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right 1 Col: Low Stock Warnings */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-600" /> Low Stock Alerts
              </div>
              <Link
                href="/inventory"
                className="text-xs text-amber-700 font-semibold hover:underline"
              >
                Restock
              </Link>
            </div>

            <div className="space-y-3">
              {data?.lowStockProducts && data.lowStockProducts.length > 0 ? (
                data.lowStockProducts.map((p) => (
                  <div
                    key={p._id}
                    className="p-3 rounded-xl border border-amber-200 bg-amber-50/50 flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-bold text-slate-800 truncate">{p.name}</p>
                      <p className="text-[10px] text-slate-500">
                        Price: {formatCurrency(p.sellingPrice)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-black text-xs">
                        {p.stockQuantity} {p.unit}
                      </span>
                      <p className="text-[9px] text-slate-400 mt-0.5">
                        Min limit: {p.lowStockThreshold}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-slate-400 text-xs">
                  All inventory levels are healthy!
                </div>
              )}
            </div>

            {/* Quick Catalog Stats */}
            <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-slate-400 text-[10px]">Total Products</div>
                <div className="font-bold text-slate-800 mt-0.5">{stats.totalProducts}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-slate-400 text-[10px]">Total Customers</div>
                <div className="font-bold text-slate-800 mt-0.5">{stats.totalCustomers}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
