"use client";

import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import {
  Clock,
  Search,
  Calendar,
  Monitor,
  Printer,
  X,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Banknote,
  ShieldAlert,
  ArrowDownRight,
  ArrowUpRight,
  Layers,
  FileText,
} from "lucide-react";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";
import ShiftZReportReceipt, {
  ShiftZReportData,
} from "@/components/receipts/ShiftZReportReceipt";

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<ShiftZReportData[]>([]);
  const [registers, setRegisters] = useState<Array<{ _id: string; name: string; registerNumber: string }>>([]);
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [registerFilter, setRegisterFilter] = useState("all");
  const [dateRange, setDateRange] = useState("all");

  // Selected Report Modal
  const [selectedReportShift, setSelectedReportShift] = useState<ShiftZReportData | null>(null);
  const [reportType, setReportType] = useState<"X_REPORT" | "Z_REPORT">("Z_REPORT");

  const loadData = async () => {
    try {
      setLoading(true);
      const [shiftsRes, regRes, bizRes] = await Promise.all([
        fetch(`/api/shifts?status=${statusFilter}&registerId=${registerFilter}&dateRange=${dateRange}`),
        fetch("/api/registers"),
        fetch("/api/business"),
      ]);

      const [shiftsData, regData, bizData] = await Promise.all([
        shiftsRes.json(),
        regRes.json(),
        bizRes.json(),
      ]);

      if (shiftsData.success) {
        setShifts(shiftsData.shifts || []);
      }
      if (regData.success) {
        setRegisters(regData.registers || []);
      }
      if (bizData.success) {
        setBusiness(bizData.business);
      }
    } catch (err) {
      console.error("Failed to load shifts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, registerFilter, dateRange]);

  // Aggregate Metrics across loaded shifts
  const closedShifts = shifts.filter((s) => s.status === "CLOSED");
  const totalActualCash = closedShifts.reduce((sum, s) => sum + (s.actualCash || 0), 0);
  const totalExpectedCash = shifts.reduce((sum, s) => sum + (s.expectedCash || 0), 0);
  const totalCashSales = shifts.reduce((sum, s) => sum + (s.cashSales || 0), 0);
  const totalCashDrops = shifts.reduce((sum, s) => {
    const drops = (s.cashMovements || [])
      .filter((m) => m.type === "CASH_DROP")
      .reduce((dSum, m) => dSum + m.amount, 0);
    return sum + drops;
  }, 0);
  const totalDifference = closedShifts.reduce((sum, s) => sum + (s.difference || 0), 0);

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Clock className="w-6 h-6 text-blue-600" /> Shifts & Cash Drawers
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Audit counter shifts, opening floats, mid-shift cash drops to safe, and cash drawer reconciliations.
            </p>
          </div>

          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-600" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* 4 Financial KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-slate-500 text-xs font-medium block">Total Cash Sales</span>
            <div className="text-2xl font-black text-slate-900 font-mono mt-1">
              {formatCurrency(totalCashSales)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Gross cash collected across shifts</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-slate-500 text-xs font-medium block">Cash Drops to Safe</span>
            <div className="text-2xl font-black text-blue-900 font-mono mt-1">
              {formatCurrency(totalCashDrops)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Mid-day drawer withdrawals to safe</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-slate-500 text-xs font-medium block">Actual Cash Counted</span>
            <div className="text-2xl font-black text-emerald-700 font-mono mt-1">
              {formatCurrency(totalActualCash)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">{closedShifts.length} closed drawer reconciliations</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-slate-500 text-xs font-medium block">Net Discrepancy (Over / Short)</span>
            <div
              className={`text-2xl font-black font-mono mt-1 ${
                Math.abs(totalDifference) < 0.01
                  ? "text-slate-900"
                  : totalDifference > 0
                  ? "text-blue-600"
                  : "text-rose-600"
              }`}
            >
              {Math.abs(totalDifference) < 0.01
                ? "Rs. 0.00"
                : totalDifference > 0
                ? `+${formatCurrency(totalDifference)}`
                : `-${formatCurrency(Math.abs(totalDifference))}`}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {Math.abs(totalDifference) < 0.01
                ? "All closed shifts balanced perfectly"
                : totalDifference > 0
                ? "Net cash surplus across counters"
                : "Net cash shortage detected"}
            </p>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="flex flex-wrap items-center gap-2.5 w-full text-xs">
            {/* Date Filter */}
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
            >
              <option value="all">All Dates</option>
              <option value="today">Today (Colombo Time)</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">Past 7 Days</option>
              <option value="month">This Month</option>
            </select>

            {/* Counter Filter */}
            {registers.length > 0 && (
              <select
                value={registerFilter}
                onChange={(e) => setRegisterFilter(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
              >
                <option value="all">All Counters</option>
                {registers.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.registerNumber}: {r.name}
                  </option>
                ))}
              </select>
            )}

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
            >
              <option value="all">All Shift Statuses</option>
              <option value="OPEN">🟢 Active / Open Shifts</option>
              <option value="CLOSED">🔒 Closed Shifts</option>
            </select>
          </div>
        </div>

        {/* Shifts Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Shift #</th>
                  <th className="py-3 px-4">Counter</th>
                  <th className="py-3 px-4">Cashier</th>
                  <th className="py-3 px-4">Opened</th>
                  <th className="py-3 px-4">Closed</th>
                  <th className="py-3 px-4 text-right">Float (Rs.)</th>
                  <th className="py-3 px-4 text-right">Cash Sales</th>
                  <th className="py-3 px-4 text-right">Expected Cash</th>
                  <th className="py-3 px-4 text-right">Actual Counted</th>
                  <th className="py-3 px-4 text-center">Status & Difference</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400">
                      Loading drawer shifts...
                    </td>
                  </tr>
                ) : shifts.length > 0 ? (
                  shifts.map((shift) => {
                    const diff = shift.difference ?? 0;
                    const isBalanced = Math.abs(diff) < 0.01;
                    const isOver = diff > 0.01;

                    return (
                      <tr key={shift._id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          {shift.shiftNumber}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            <Monitor className="w-2.5 h-2.5 text-blue-500 shrink-0" />
                            {shift.registerNumber}
                          </span>
                          <div className="text-[10px] text-slate-400 truncate max-w-[110px]">
                            {shift.registerName}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 font-medium">
                          {shift.cashierName}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                          {formatSLDateTime(shift.openedAt)}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                          {shift.closedAt ? formatSLDateTime(shift.closedAt) : (
                            <span className="text-emerald-600 font-semibold animate-pulse">Active</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-slate-700">
                          {formatCurrency(shift.openingFloat)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-slate-900 font-semibold">
                          {formatCurrency(shift.cashSales)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-slate-900 font-bold">
                          {formatCurrency(shift.expectedCash)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                          {shift.status === "CLOSED" ? (
                            formatCurrency(shift.actualCash || 0)
                          ) : (
                            <span className="text-slate-400 italic">Pending</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {shift.status === "OPEN" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              OPEN
                            </span>
                          ) : isBalanced ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              Balanced
                            </span>
                          ) : isOver ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                              <ArrowUpRight className="w-3 h-3" />
                              +{formatCurrency(diff)} Over
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              <ArrowDownRight className="w-3 h-3" />
                              -{formatCurrency(Math.abs(diff))} Short
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedReportShift(shift);
                              setReportType(shift.status === "CLOSED" ? "Z_REPORT" : "X_REPORT");
                            }}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 font-semibold rounded-lg text-[11px] transition inline-flex items-center gap-1"
                          >
                            <FileText className="w-3 h-3" />
                            <span>{shift.status === "CLOSED" ? "Z-Report" : "X-Report"}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400">
                      No shift records found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: View & Print Thermal Z-Report / X-Report */}
        {selectedReportShift && business && (
          <ShiftZReportReceipt
            business={business}
            shift={selectedReportShift}
            reportType={reportType}
            onClose={() => setSelectedReportShift(null)}
          />
        )}
      </div>
    </AppLayout>
  );
}
