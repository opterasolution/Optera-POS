"use client";

import { useEffect, useState, useMemo } from "react";
import AppLayout from "@/components/layout/AppLayout";
import {
  Wallet,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Printer,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  DollarSign,
  Receipt,
  Building2,
  Coffee,
  ShoppingBag,
  Truck,
  Zap,
  Wrench,
  Home,
  Landmark,
  Coins,
  FileText,
  Calendar,
} from "lucide-react";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";
import ExpenseVoucherReceipt from "@/components/receipts/ExpenseVoucherReceipt";

interface ExpenseItem {
  _id: string;
  expenseNumber: string;
  category: string;
  title: string;
  amount: number;
  paymentMethod: string;
  paidFrom: "REGISTER_DRAWER" | "STORE_PETTY_CASH" | "BANK_ACCOUNT";
  shiftId?: string;
  registerId?: string;
  registerName?: string;
  payee?: string;
  receiptNumber?: string;
  notes?: string;
  recordedBy: string;
  date: string;
  createdAt: string;
}

interface ExpenseStats {
  totalExpensesCount: number;
  totalExpensesAmount: number;
  dailyPettyCashToday: number;
  drawerPayoutsTotal: number;
  centralSafeTotal: number;
  bankTransferTotal: number;
  categoryBreakdown: Record<string, number>;
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [stats, setStats] = useState<ExpenseStats | null>(null);
  const [registers, setRegisters] = useState<any[]>([]);
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedPaidFrom, setSelectedPaidFrom] = useState("ALL");
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modal State
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [categoryInput, setCategoryInput] = useState("STAFF_MEALS");
  const [amountInput, setAmountInput] = useState("");
  const [paidFromInput, setPaidFromInput] = useState<"REGISTER_DRAWER" | "STORE_PETTY_CASH" | "BANK_ACCOUNT">("REGISTER_DRAWER");
  const [registerIdInput, setRegisterIdInput] = useState("");
  const [payeeInput, setPayeeInput] = useState("");
  const [receiptNumberInput, setReceiptNumberInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Print voucher modal state
  const [activeVoucher, setActiveVoucher] = useState<ExpenseItem | null>(null);
  const [receiptWidth, setReceiptWidth] = useState<"58mm" | "80mm">("58mm");

  const loadData = async () => {
    try {
      setLoading(true);
      const [expRes, regRes, bizRes] = await Promise.all([
        fetch("/api/expenses"),
        fetch("/api/registers"),
        fetch("/api/business"),
      ]);

      const [expData, regData, bizData] = await Promise.all([
        expRes.json(),
        regRes.json(),
        bizRes.json(),
      ]);

      if (expData.success) {
        setExpenses(expData.expenses || []);
        setStats(expData.stats);
      }
      if (regData.success) {
        setRegisters(regData.registers || []);
        if (regData.registers && regData.registers.length > 0) {
          setRegisterIdInput(regData.registers[0]._id);
        }
      }
      if (bizData.success) {
        setBusiness(bizData.business);
        if (bizData.business?.receiptSettings?.defaultWidth) {
          setReceiptWidth(bizData.business.receiptSettings.defaultWidth);
        }
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: "Failed to load expenses data." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRecordExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amountInput) || 0;
    if (amt <= 0) {
      alert("Amount must be greater than Rs. 0.");
      return;
    }

    if (!titleInput.trim()) {
      alert("Please provide an expense description / title.");
      return;
    }

    setSubmitting(true);
    try {
      const reg = registers.find((r) => r._id === registerIdInput);

      const payload = {
        title: titleInput.trim(),
        category: categoryInput,
        amount: amt,
        paymentMethod: paidFromInput === "BANK_ACCOUNT" ? "BANK_TRANSFER" : "CASH",
        paidFrom: paidFromInput,
        registerId: paidFromInput === "REGISTER_DRAWER" ? registerIdInput : undefined,
        registerName: paidFromInput === "REGISTER_DRAWER" && reg ? `${reg.registerNumber} - ${reg.name}` : undefined,
        payee: payeeInput.trim() || undefined,
        receiptNumber: receiptNumberInput.trim() || undefined,
        notes: notesInput.trim() || undefined,
      };

      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success && data.expense) {
        setStatusMessage({
          type: "success",
          text: `Expense ${data.expense.expenseNumber} of ${formatCurrency(amt)} recorded successfully!`,
        });
        setIsRecordModalOpen(false);
        setActiveVoucher(data.expense);
        // Reset form
        setTitleInput("");
        setAmountInput("");
        setPayeeInput("");
        setReceiptNumberInput("");
        setNotesInput("");
        await loadData();
      } else {
        alert(data.error || "Failed to record expense.");
      }
    } catch (err: any) {
      alert(err.message || "Failed to communicate with expenses service.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async (expense: ExpenseItem) => {
    if (
      !confirm(
        `Are you sure you want to delete and void Expense ${expense.expenseNumber} (${formatCurrency(expense.amount)})? If paid from a cash drawer, a balancing Pay-In will be added.`
      )
    )
      return;

    try {
      const res = await fetch(`/api/expenses/${expense._id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: "success",
          text: `Expense ${expense.expenseNumber} voided and drawer adjusted.`,
        });
        await loadData();
      } else {
        alert(data.error || "Failed to delete expense.");
      }
    } catch (err: any) {
      alert(err.message || "Error deleting expense.");
    }
  };

  // Filtered expense ledger
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      const q = searchQuery.toLowerCase();
      const matchesQuery =
        !q ||
        exp.expenseNumber.toLowerCase().includes(q) ||
        exp.title.toLowerCase().includes(q) ||
        (exp.payee && exp.payee.toLowerCase().includes(q)) ||
        (exp.receiptNumber && exp.receiptNumber.toLowerCase().includes(q));

      const matchesCat = selectedCategory === "ALL" || exp.category === selectedCategory;
      const matchesSource = selectedPaidFrom === "ALL" || exp.paidFrom === selectedPaidFrom;

      return matchesQuery && matchesCat && matchesSource;
    });
  }, [expenses, searchQuery, selectedCategory, selectedPaidFrom]);

  // Top category
  const topCategoryName = useMemo(() => {
    if (!stats?.categoryBreakdown) return "None";
    let maxCat = "None";
    let maxVal = 0;
    for (const [cat, val] of Object.entries(stats.categoryBreakdown)) {
      if (val > maxVal) {
        maxVal = val;
        maxCat = cat;
      }
    }
    return maxCat;
  }, [stats]);

  const defaultBusiness = {
    name: business?.name || "SRI LANKA RETAIL POS",
    phone: business?.phone || "011-2345678",
    address: business?.address || "Main Street, Colombo, Sri Lanka",
    receiptSettings: {
      defaultWidth: receiptWidth,
    },
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case "STAFF_MEALS":
        return { label: "Staff Meals", icon: Coffee, bg: "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300" };
      case "PACKAGING":
        return { label: "Packaging Bags", icon: ShoppingBag, bg: "bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300" };
      case "TRANSPORT":
        return { label: "Transport / Tuk", icon: Truck, bg: "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300" };
      case "UTILITIES":
        return { label: "Electricity / Water", icon: Zap, bg: "bg-yellow-100 dark:bg-yellow-950/60 text-yellow-800 dark:text-yellow-300" };
      case "MAINTENANCE":
        return { label: "Repairs & Cleaning", icon: Wrench, bg: "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200" };
      case "RENT":
        return { label: "Store Rent", icon: Home, bg: "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300" };
      case "MUNICIPAL_TAX":
        return { label: "Council & Waste Tax", icon: Landmark, bg: "bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300" };
      case "SALARY_ADVANCE":
        return { label: "Salary Advance", icon: Coins, bg: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300" };
      default:
        return { label: "Other Expense", icon: FileText, bg: "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300" };
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 pb-16">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
                <Wallet className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
                Expenses & Petty Cash
              </h1>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Record daily counter disbursements, staff meals, packaging, utility bills, and track net cash
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2.5 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition border border-zinc-200 dark:border-zinc-700"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => setIsRecordModalOpen(true)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-sm transition active:scale-95 text-sm"
            >
              <Plus className="w-4 h-4" />
              Record Expense
            </button>
          </div>
        </div>

        {/* Status Toast */}
        {statusMessage && (
          <div
            className={`p-4 rounded-xl flex items-center justify-between gap-3 text-sm font-medium ${
              statusMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                : "bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 5 KPI Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Expenses</span>
              <DollarSign className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white">
              {formatCurrency(stats?.totalExpensesAmount ?? 0)}
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              {stats?.totalExpensesCount ?? expenses.length} vouchers recorded
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Today's Petty Cash</span>
              <Receipt className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">
              {formatCurrency(stats?.dailyPettyCashToday ?? 0)}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Disbursed today</div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Drawer Payouts</span>
              <Coins className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400">
              {formatCurrency(stats?.drawerPayoutsTotal ?? 0)}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Shift drawer Pay-Outs</div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Safe & Bank</span>
              <Building2 className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400">
              {formatCurrency((stats?.centralSafeTotal ?? 0) + (stats?.bankTransferTotal ?? 0))}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Outside register drawers</div>
          </div>

          <div className="col-span-2 md:col-span-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Top Category</span>
              <Coffee className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-sm font-bold text-zinc-900 dark:text-white truncate">
              {topCategoryName}
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              {stats?.categoryBreakdown?.[topCategoryName]
                ? formatCurrency(stats.categoryBreakdown[topCategoryName])
                : "Rs. 0.00"}
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, voucher #, payee, receipt #..."
              className="w-full pl-10 pr-3 py-2 text-xs sm:text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 text-xs sm:text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">All Categories</option>
              <option value="STAFF_MEALS">Staff Meals & Refreshments</option>
              <option value="PACKAGING">Packaging & Bags</option>
              <option value="TRANSPORT">Transport & Deliveries</option>
              <option value="UTILITIES">Electricity & Water</option>
              <option value="MAINTENANCE">Store Repairs & Cleaning</option>
              <option value="RENT">Store Rent</option>
              <option value="MUNICIPAL_TAX">Council & Waste Tax</option>
              <option value="SALARY_ADVANCE">Staff Salary Advance</option>
              <option value="OTHER">Other Expense</option>
            </select>

            <select
              value={selectedPaidFrom}
              onChange={(e) => setSelectedPaidFrom(e.target.value)}
              className="px-3 py-2 text-xs sm:text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">All Sources</option>
              <option value="REGISTER_DRAWER">Register Cash Drawer</option>
              <option value="STORE_PETTY_CASH">Store Petty Cash Safe</option>
              <option value="BANK_ACCOUNT">Commercial Bank Account</option>
            </select>
          </div>
        </div>

        {/* Expenses Ledger Table */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800/70 text-zinc-500 dark:text-zinc-400 text-xs uppercase font-semibold border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="px-4 py-3">Voucher # & Date</th>
                  <th className="px-4 py-3">Category & Title</th>
                  <th className="px-4 py-3">Paid To (Payee)</th>
                  <th className="px-4 py-3">Disbursed From</th>
                  <th className="px-4 py-3">Recorded By</th>
                  <th className="px-4 py-3 text-right">Amount (LKR)</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-500" />
                      Loading expense records...
                    </td>
                  </tr>
                ) : filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                      <Wallet className="w-8 h-8 mx-auto mb-2 text-zinc-400 stroke-1" />
                      No expenses or petty cash disbursements found.
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((exp) => {
                    const badge = getCategoryBadge(exp.category);
                    const CategoryIcon = badge.icon;
                    return (
                      <tr key={exp._id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition">
                        <td className="px-4 py-3">
                          <div className="font-bold text-zinc-900 dark:text-white font-mono text-xs">
                            {exp.expenseNumber}
                          </div>
                          <div className="text-[11px] text-zinc-500">
                            {formatSLDateTime(exp.date)}
                          </div>
                          {exp.receiptNumber && (
                            <div className="text-[10px] text-zinc-400 font-mono">
                              Ref: {exp.receiptNumber}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mb-1 ${badge.bg}`}
                          >
                            <CategoryIcon className="w-3 h-3" />
                            {badge.label}
                          </span>
                          <div className="font-semibold text-zinc-900 dark:text-white text-xs">
                            {exp.title}
                          </div>
                          {exp.notes && (
                            <div className="text-[11px] text-zinc-400 italic mt-0.5 line-clamp-1">
                              {exp.notes}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <div className="font-medium text-xs text-zinc-900 dark:text-white">
                            {exp.payee || "—"}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          {exp.paidFrom === "REGISTER_DRAWER" && (
                            <div>
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 rounded-lg border border-rose-200 dark:border-rose-800">
                                <Coins className="w-3 h-3" /> Register Drawer
                              </span>
                              {exp.registerName && (
                                <div className="text-[10px] text-zinc-500 mt-0.5">
                                  {exp.registerName}
                                </div>
                              )}
                            </div>
                          )}
                          {exp.paidFrom === "STORE_PETTY_CASH" && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 rounded-lg border border-blue-200 dark:border-blue-800">
                              <Wallet className="w-3 h-3" /> Petty Cash Safe
                            </span>
                          )}
                          {exp.paidFrom === "BANK_ACCOUNT" && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 rounded-lg border border-purple-200 dark:border-purple-800">
                              <Building2 className="w-3 h-3" /> Bank Transfer
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-xs text-zinc-500">
                          {exp.recordedBy}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <div className="font-black text-rose-600 dark:text-rose-400 text-sm">
                            {formatCurrency(exp.amount)}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setActiveVoucher(exp)}
                              className="p-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg transition"
                              title="Print Petty Cash Voucher"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteExpense(exp)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 rounded-lg transition"
                              title="Void Expense"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Record Expense Modal */}
        {isRecordModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg my-8 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 rounded-lg">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                      Record Store Expense / Petty Cash
                    </h2>
                    <p className="text-xs text-zinc-500">
                      Disburse funds and balance active register cash drawers
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsRecordModalOpen(false)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleRecordExpense} className="p-5 overflow-y-auto space-y-4 flex-1">
                {/* Category Preset Picker */}
                <div>
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block mb-1.5">
                    Expense Category
                  </label>
                  <select
                    value={categoryInput}
                    onChange={(e) => setCategoryInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="STAFF_MEALS">🍲 Staff Meals & Refreshments (කෑම/තේ)</option>
                    <option value="PACKAGING">🛍️ Packaging Bags & Materials (ඇසුරුම්)</option>
                    <option value="TRANSPORT">🛺 Transport & Deliveries (ප්‍රවාහන/ත්‍රීවීල්)</option>
                    <option value="UTILITIES">⚡ Electricity / Water / Telecom (බිල්පත්)</option>
                    <option value="MAINTENANCE">🔧 Store Repairs & Cleaning Materials</option>
                    <option value="RENT">🏢 Building / Stall Rent</option>
                    <option value="MUNICIPAL_TAX">🏛️ Municipal Council & Waste Tax</option>
                    <option value="SALARY_ADVANCE">💵 Staff Salary Advance</option>
                    <option value="OTHER">📋 Other Store Expense</option>
                  </select>
                </div>

                {/* Title / Description */}
                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Description / Purpose *
                  </label>
                  <input
                    type="text"
                    required
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    placeholder="e.g. 500x Polythene shopping bags (Large)"
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Amount in LKR */}
                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Amount (Rs.) *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    required
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    placeholder="e.g. 1500"
                    className="w-full px-3 py-2 text-base font-bold font-mono bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Disbursement Source */}
                <div>
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block mb-1.5">
                    Disbursed From (Payment Source)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaidFromInput("REGISTER_DRAWER")}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        paidFromInput === "REGISTER_DRAWER"
                          ? "bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-900 dark:text-rose-300 ring-2 ring-rose-500/20"
                          : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      <div className="font-bold text-xs mb-0.5 flex items-center gap-1">
                        <Coins className="w-3.5 h-3.5" /> Cash Drawer
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        Adds PAY_OUT to shift float
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaidFromInput("STORE_PETTY_CASH")}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        paidFromInput === "STORE_PETTY_CASH"
                          ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-900 dark:text-blue-300 ring-2 ring-blue-500/20"
                          : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      <div className="font-bold text-xs mb-0.5 flex items-center gap-1">
                        <Wallet className="w-3.5 h-3.5" /> Store Safe
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        Owner's petty cash
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaidFromInput("BANK_ACCOUNT")}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        paidFromInput === "BANK_ACCOUNT"
                          ? "bg-purple-50 dark:bg-purple-950/40 border-purple-500 text-purple-900 dark:text-purple-300 ring-2 ring-purple-500/20"
                          : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      <div className="font-bold text-xs mb-0.5 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5" /> Bank Transfer
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        Online banking
                      </div>
                    </button>
                  </div>
                </div>

                {/* If Register Drawer, select register */}
                {paidFromInput === "REGISTER_DRAWER" && (
                  <div className="p-3 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-xl space-y-2">
                    <label className="text-xs font-semibold text-rose-900 dark:text-rose-300 block">
                      Target Counter Cash Drawer
                    </label>
                    <select
                      value={registerIdInput}
                      onChange={(e) => setRegisterIdInput(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
                    >
                      {registers.map((r) => (
                        <option key={r._id} value={r._id}>
                          {r.registerNumber} - {r.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-rose-700 dark:text-rose-400">
                      * Deducting Rs. {parseFloat(amountInput) || 0} will automatically adjust expected cash at shift closing.
                    </p>
                  </div>
                )}

                {/* Payee & Receipt Number */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Paid To (Payee / Vendor)
                    </label>
                    <input
                      type="text"
                      value={payeeInput}
                      onChange={(e) => setPayeeInput(e.target.value)}
                      placeholder="e.g. Sunil Packaging / CEB"
                      className="w-full px-3 py-1.5 text-xs sm:text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Bill / Slip # (Optional)
                    </label>
                    <input
                      type="text"
                      value={receiptNumberInput}
                      onChange={(e) => setReceiptNumberInput(e.target.value)}
                      placeholder="e.g. CEB-09-48201"
                      className="w-full px-3 py-1.5 text-xs sm:text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Additional Notes */}
                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Notes / Comments
                  </label>
                  <input
                    type="text"
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                    placeholder="e.g. Emergency purchase for morning shift"
                    className="w-full px-3 py-1.5 text-xs sm:text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white"
                  />
                </div>

                {/* Footer Buttons */}
                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRecordModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition active:scale-95 flex items-center gap-1.5"
                  >
                    {submitting ? "Saving..." : "Record & Print Voucher"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Printable Petty Cash Voucher Slip */}
        {activeVoucher && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md my-8 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2 font-bold text-sm text-zinc-900 dark:text-white">
                  <Printer className="w-4 h-4 text-emerald-600" />
                  Petty Cash Voucher ({receiptWidth})
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={receiptWidth}
                    onChange={(e) => setReceiptWidth(e.target.value as any)}
                    className="text-xs px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700"
                  >
                    <option value="58mm">58mm</option>
                    <option value="80mm">80mm</option>
                  </select>
                  <button
                    onClick={() => setActiveVoucher(null)}
                    className="p-1 text-zinc-400 hover:text-zinc-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-4 overflow-y-auto bg-zinc-100 dark:bg-zinc-950 flex-1">
                <ExpenseVoucherReceipt
                  business={defaultBusiness}
                  expense={activeVoucher}
                  width={receiptWidth}
                />
              </div>

              <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-2 bg-white dark:bg-zinc-900">
                <button
                  onClick={() => setActiveVoucher(null)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"
                >
                  Close
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Voucher
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
