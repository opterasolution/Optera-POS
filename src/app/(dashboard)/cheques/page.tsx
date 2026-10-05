"use client";

import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import {
  FileText,
  Landmark,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Printer,
  Calendar,
  DollarSign,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  Check,
  X,
  CreditCard,
  Building,
  RefreshCw,
  Eye,
  FileWarning,
  Send,
  Building2,
  ChevronRight,
  Users,
} from "lucide-react";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";
import {
  SRI_LANKAN_BANKS,
  POPULAR_SRI_LANKA_BRANCHES,
  CHEQUE_DISHONOR_REASONS,
  SriLankanBank,
} from "@/lib/sri-lanka-banks";
import BankDepositSlipReceipt, { BankDepositSlipData } from "@/components/receipts/BankDepositSlipReceipt";
import ChequeReturnNotice, { ChequeReturnNoticeData } from "@/components/receipts/ChequeReturnNotice";

interface BankChequeItem {
  _id: string;
  chequeNumber: string;
  direction: "INWARD" | "OUTWARD";
  partyType: "CUSTOMER" | "SUPPLIER" | "OTHER";
  partyId?: string;
  partyName: string;
  partyPhone?: string;
  bankName: string;
  bankBranch: string;
  bankCode?: string;
  accountNumber?: string;
  drawerName: string;
  payeeName: string;
  amount: number;
  chequeDate: string;
  receivedOrIssuedDate: string;
  isPdc: boolean;
  status: "RECEIVED" | "DEPOSITED" | "REALIZED" | "RETURNED" | "CANCELLED";
  depositDetails?: {
    depositSlipNumber?: string;
    depositedAt?: string;
    depositedBy?: string;
    bankName?: string;
    accountNumber?: string;
    branchName?: string;
    notes?: string;
  };
  realizationDetails?: {
    realizedAt?: string;
    realizedBy?: string;
    bankStatementRef?: string;
    clearedAmount?: number;
    notes?: string;
  };
  returnDetails?: {
    returnedAt?: string;
    returnedBy?: string;
    reasonCode?: string;
    reasonText?: string;
    returnPenaltyFee?: number;
    customerReDebited?: boolean;
    smsAlertSent?: boolean;
    notes?: string;
  };
  notes?: string;
  createdBy: string;
  createdAt: string;
}

interface BankAccountItem {
  _id: string;
  bankName: string;
  branchName: string;
  accountNumber: string;
  accountName: string;
  accountType: "CURRENT" | "SAVINGS";
  currency: string;
  ledgerBalance: number;
  clearedBalance: number;
  isDefault: boolean;
  isActive: boolean;
}

interface DepositSlipSummary {
  _id: string;
  slipNumber: string;
  bankName: string;
  branchName: string;
  accountNumber: string;
  accountName: string;
  depositDate: string;
  chequeCount: number;
  chequeTotal: number;
  cashAmount: number;
  totalDepositAmount: number;
  status: string;
  depositedBy: string;
  cheques: any[];
  notes?: string;
}

interface CustomerOption {
  _id: string;
  name: string;
  phone?: string;
  currentBalance?: number;
}

interface SupplierOption {
  _id: string;
  name: string;
  phone?: string;
  currentBalance?: number;
}

export default function ChequesPage() {
  const [activeTab, setActiveTab] = useState<"INWARD" | "OUTWARD" | "CALENDAR" | "DEPOSIT_SLIPS" | "BANK_ACCOUNTS">("INWARD");

  const [cheques, setCheques] = useState<BankChequeItem[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccountItem[]>([]);
  const [depositSlips, setDepositSlips] = useState<DepositSlipSummary[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [pdcFilter, setPdcFilter] = useState("ALL"); // ALL | PDC_ONLY | CURRENT_ONLY
  const [timelineFilter, setTimelineFilter] = useState("ALL"); // ALL | DUE_TODAY | DUE_WEEK | OVERDUE

  // Metrics
  const [metrics, setMetrics] = useState({
    inward: {
      inHandCount: 0,
      inHandTotal: 0,
      pdcPendingCount: 0,
      pdcPendingTotal: 0,
      depositedCount: 0,
      depositedTotal: 0,
      realizedCount: 0,
      realizedTotal: 0,
      returnedCount: 0,
      returnedTotal: 0,
      dueTodayCount: 0,
      dueTodayTotal: 0,
    },
    outward: {
      issuedCount: 0,
      issuedTotal: 0,
      pdcPendingCount: 0,
      pdcPendingTotal: 0,
      realizedCount: 0,
      realizedTotal: 0,
      returnedCount: 0,
      returnedTotal: 0,
    },
  });

  // Notifications
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modals state
  const [isAddChequeModalOpen, setIsAddChequeModalOpen] = useState(false);
  const [isBatchDepositModalOpen, setIsBatchDepositModalOpen] = useState(false);
  const [isRealizeModalOpen, setIsRealizeModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [selectedCheque, setSelectedCheque] = useState<BankChequeItem | null>(null);

  // Printable Slips state
  const [activePrintSlip, setActivePrintSlip] = useState<BankDepositSlipData | null>(null);
  const [activePrintNotice, setActivePrintNotice] = useState<ChequeReturnNoticeData | null>(null);

  // Multi-select for batch deposit
  const [selectedChequeIds, setSelectedChequeIds] = useState<string[]>([]);

  // Add Cheque Form
  const [chequeForm, setChequeForm] = useState({
    direction: "INWARD" as "INWARD" | "OUTWARD",
    partyType: "CUSTOMER" as "CUSTOMER" | "SUPPLIER" | "OTHER",
    partyId: "",
    drawerName: "",
    payeeName: "",
    partyPhone: "",
    bankName: "Commercial Bank of Ceylon PLC",
    bankBranch: "Colombo Fort",
    accountNumber: "",
    chequeNumber: "",
    amount: "",
    chequeDate: new Date().toISOString().slice(0, 10),
    applyAsPayment: true,
    notes: "",
  });

  // Batch Deposit Form
  const [depositForm, setDepositForm] = useState({
    bankAccountId: "",
    cashAmount: "0",
    depositDate: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  // Realize Form
  const [realizeForm, setRealizeForm] = useState({
    bankStatementRef: "",
    realizedAt: new Date().toISOString().slice(0, 10),
    clearedAmount: "",
    notes: "",
  });

  // Return / Bounce Form
  const [returnForm, setReturnForm] = useState({
    reasonCode: "01",
    returnPenaltyFee: "1000",
    reDebitCustomer: true,
    sendSms: false,
    notes: "",
  });

  // Add Bank Account Form
  const [accountForm, setAccountForm] = useState({
    bankName: "Commercial Bank of Ceylon PLC",
    branchName: "Colombo Fort",
    accountNumber: "",
    accountName: "",
    accountType: "CURRENT" as "CURRENT" | "SAVINGS",
    ledgerBalance: "0",
    isDefault: false,
  });

  // Load Cheques and Metrics
  const loadCheques = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (activeTab === "INWARD") params.set("direction", "INWARD");
      else if (activeTab === "OUTWARD") params.set("direction", "OUTWARD");

      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (pdcFilter === "PDC_ONLY") params.set("isPdc", "true");
      if (pdcFilter === "CURRENT_ONLY") params.set("isPdc", "false");
      if (timelineFilter !== "ALL") params.set("timeline", timelineFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await fetch(`/api/cheques?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setCheques(data.cheques || []);
        if (data.metrics) setMetrics(data.metrics);
      }
    } catch (err: any) {
      console.error("Failed to load cheques:", err);
    } finally {
      setLoading(false);
    }
  };

  // Load Supporting Data
  const loadSupportingData = async () => {
    try {
      const [accRes, slipRes, custRes, suppRes] = await Promise.all([
        fetch("/api/bank-accounts"),
        fetch("/api/cheques/deposit-slips"),
        fetch("/api/customers?limit=100"),
        fetch("/api/suppliers?limit=100"),
      ]);

      const [accData, slipData, custData, suppData] = await Promise.all([
        accRes.json(),
        slipRes.json(),
        custRes.json(),
        suppRes.json(),
      ]);

      if (accData.success) {
        setBankAccounts(accData.accounts || []);
        if (accData.accounts?.length > 0 && !depositForm.bankAccountId) {
          const defaultAcc = accData.accounts.find((a: any) => a.isDefault) || accData.accounts[0];
          setDepositForm((prev) => ({ ...prev, bankAccountId: defaultAcc._id }));
        }
      }
      if (slipData.success) setDepositSlips(slipData.slips || []);
      if (custData.success) setCustomers(custData.customers || []);
      if (suppData.success) setSuppliers(suppData.suppliers || []);
    } catch (err) {
      console.error("Failed to load supporting cheque data:", err);
    }
  };

  useEffect(() => {
    loadCheques();
  }, [activeTab, statusFilter, pdcFilter, timelineFilter]);

  useEffect(() => {
    loadSupportingData();
  }, []);

  // Quick Action: Handle Submit New Cheque
  const handleCreateCheque = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/cheques", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chequeForm),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to record cheque");
      }

      setStatusMessage({ type: "success", text: data.message });
      setIsAddChequeModalOpen(false);
      // Reset form
      setChequeForm({
        direction: "INWARD",
        partyType: "CUSTOMER",
        partyId: "",
        drawerName: "",
        payeeName: "",
        partyPhone: "",
        bankName: "Commercial Bank of Ceylon PLC",
        bankBranch: "Colombo Fort",
        accountNumber: "",
        chequeNumber: "",
        amount: "",
        chequeDate: new Date().toISOString().slice(0, 10),
        applyAsPayment: true,
        notes: "",
      });
      loadCheques();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message });
    }
  };

  // Quick Action: Batch Deposit
  const handleBatchDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const selectedAccount = bankAccounts.find((a) => a._id === depositForm.bankAccountId);
      if (!selectedAccount) {
        throw new Error("Please select a target merchant bank account.");
      }

      const res = await fetch("/api/cheques/deposit-slips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankAccountId: selectedAccount._id,
          bankName: selectedAccount.bankName,
          branchName: selectedAccount.branchName,
          accountNumber: selectedAccount.accountNumber,
          accountName: selectedAccount.accountName,
          depositDate: depositForm.depositDate,
          chequeIds: selectedChequeIds,
          cashAmount: Number(depositForm.cashAmount) || 0,
          notes: depositForm.notes,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create deposit slip");
      }

      setStatusMessage({ type: "success", text: data.message });
      setIsBatchDepositModalOpen(false);
      setSelectedChequeIds([]);

      // Prompt printable deposit slip
      setActivePrintSlip({
        slipNumber: data.depositSlip.slipNumber,
        bankName: data.depositSlip.bankName,
        branchName: data.depositSlip.branchName,
        accountNumber: data.depositSlip.accountNumber,
        accountName: data.depositSlip.accountName,
        depositDate: data.depositSlip.depositDate,
        cheques: data.depositSlip.cheques,
        chequeCount: data.depositSlip.chequeCount,
        chequeTotal: data.depositSlip.chequeTotal,
        cashAmount: data.depositSlip.cashAmount,
        totalDepositAmount: data.depositSlip.totalDepositAmount,
        depositedBy: data.depositSlip.depositedBy,
        notes: data.depositSlip.notes,
      });

      loadCheques();
      loadSupportingData();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message });
    }
  };

  // Quick Action: Mark Realized
  const handleMarkRealized = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCheque) return;

    try {
      const res = await fetch(`/api/cheques/${selectedCheque._id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REALIZE",
          bankStatementRef: realizeForm.bankStatementRef,
          realizedAt: realizeForm.realizedAt,
          clearedAmount: realizeForm.clearedAmount ? Number(realizeForm.clearedAmount) : selectedCheque.amount,
          notes: realizeForm.notes,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to mark cheque as realized");
      }

      setStatusMessage({ type: "success", text: data.message });
      setIsRealizeModalOpen(false);
      setSelectedCheque(null);
      loadCheques();
      loadSupportingData();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message });
    }
  };

  // Quick Action: Mark Returned / Bounce
  const handleMarkReturned = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCheque) return;

    try {
      const res = await fetch(`/api/cheques/${selectedCheque._id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RETURN",
          reasonCode: returnForm.reasonCode,
          returnPenaltyFee: Number(returnForm.returnPenaltyFee) || 0,
          reDebitCustomer: returnForm.reDebitCustomer,
          sendSms: returnForm.sendSms,
          notes: returnForm.notes,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to mark cheque as returned");
      }

      setStatusMessage({ type: "success", text: data.message });
      setIsReturnModalOpen(false);

      // Offer print debit advice notice
      const reasonObj = CHEQUE_DISHONOR_REASONS.find((r) => r.code === returnForm.reasonCode);
      const penalty = Number(returnForm.returnPenaltyFee) || 0;
      setActivePrintNotice({
        noticeNumber: `RET-${selectedCheque.chequeNumber}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`,
        noticeDate: new Date(),
        customerName: selectedCheque.partyName,
        customerPhone: selectedCheque.partyPhone,
        chequeNumber: selectedCheque.chequeNumber,
        bankName: selectedCheque.bankName,
        bankBranch: selectedCheque.bankBranch,
        drawerName: selectedCheque.drawerName,
        chequeDate: selectedCheque.chequeDate,
        amount: selectedCheque.amount,
        reasonCode: returnForm.reasonCode,
        reasonText: reasonObj?.description || "Dishonored by Bank",
        penaltyFee: penalty,
        totalReDebited: selectedCheque.amount + penalty,
        newCustomerBalance: data.updatedCustomerBalance,
        storeName: "Corner Store POS Merchant",
        settlementBankAccount: bankAccounts[0]
          ? {
              bankName: bankAccounts[0].bankName,
              branchName: bankAccounts[0].branchName,
              accountNumber: bankAccounts[0].accountNumber,
              accountName: bankAccounts[0].accountName,
            }
          : undefined,
      });

      setSelectedCheque(null);
      loadCheques();
      loadSupportingData();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message });
    }
  };

  // Quick Action: Add Bank Account
  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/bank-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accountForm),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to add bank account");
      }

      setStatusMessage({ type: "success", text: data.message });
      setIsAddAccountModalOpen(false);
      setAccountForm({
        bankName: "Commercial Bank of Ceylon PLC",
        branchName: "Colombo Fort",
        accountNumber: "",
        accountName: "",
        accountType: "CURRENT",
        ledgerBalance: "0",
        isDefault: false,
      });
      loadSupportingData();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message });
    }
  };

  // Toggle Selection
  const toggleSelectCheque = (id: string) => {
    setSelectedChequeIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAllInHand = () => {
    const inHandIds = cheques.filter((c) => c.status === "RECEIVED").map((c) => c._id);
    if (selectedChequeIds.length === inHandIds.length) {
      setSelectedChequeIds([]);
    } else {
      setSelectedChequeIds(inHandIds);
    }
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
                <Landmark className="w-5 h-5" />
              </span>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                Cheques & Bank Realization Engine
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Sri Lankan bank cheque lifecycle, post-dated cheques (PDC), batch lodgement slips & dishonor penalty debit engine
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setChequeForm((prev) => ({
                  ...prev,
                  direction: "INWARD",
                  partyType: "CUSTOMER",
                  payeeName: "Corner Store POS",
                }));
                setIsAddChequeModalOpen(true);
              }}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-blue-500/20 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Receive Customer Cheque</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setChequeForm((prev) => ({
                  ...prev,
                  direction: "OUTWARD",
                  partyType: "SUPPLIER",
                  drawerName: "Corner Store POS",
                }));
                setIsAddChequeModalOpen(true);
              }}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <ArrowUpRight className="w-4 h-4 text-amber-400" />
              <span>Issue Supplier Cheque</span>
            </button>
          </div>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div
            className={`p-3 rounded-xl border flex items-center justify-between text-xs animate-in fade-in ${
              statusMessage.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-rose-50 border-rose-200 text-rose-900"
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-slate-700 ml-2">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 5 Executive KPI Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {/* 1. In-Hand Cheques */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">In-Hand (Safe)</span>
              <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-mono text-xs font-bold">
                {metrics.inward.inHandCount}
              </span>
            </div>
            <div className="mt-2">
              <div className="text-lg font-black text-slate-900 font-mono">
                {formatCurrency(metrics.inward.inHandTotal)}
              </div>
              <span className="text-[10px] text-slate-500 font-medium">Ready for deposit</span>
            </div>
          </div>

          {/* 2. Maturing PDCs Today */}
          <div className="p-4 bg-white rounded-2xl border border-amber-200 bg-amber-50/20 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Due Today (PDC)</span>
              <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-mono text-xs font-bold">
                {metrics.inward.dueTodayCount}
              </span>
            </div>
            <div className="mt-2">
              <div className="text-lg font-black text-amber-800 font-mono">
                {formatCurrency(metrics.inward.dueTodayTotal)}
              </div>
              <span className="text-[10px] text-amber-700 font-medium">Bank presentation date reached</span>
            </div>
          </div>

          {/* 3. Deposited In-Clearing */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">In Clearing</span>
              <span className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center font-mono text-xs font-bold">
                {metrics.inward.depositedCount}
              </span>
            </div>
            <div className="mt-2">
              <div className="text-lg font-black text-purple-700 font-mono">
                {formatCurrency(metrics.inward.depositedTotal)}
              </div>
              <span className="text-[10px] text-slate-500 font-medium">Awaiting bank realization</span>
            </div>
          </div>

          {/* 4. Realized / Cleared */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Realized (Cleared)</span>
              <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-mono text-xs font-bold">
                {metrics.inward.realizedCount}
              </span>
            </div>
            <div className="mt-2">
              <div className="text-lg font-black text-emerald-800 font-mono">
                {formatCurrency(metrics.inward.realizedTotal)}
              </div>
              <span className="text-[10px] text-emerald-600 font-medium">Credited to merchant account</span>
            </div>
          </div>

          {/* 5. Returned / Bounced */}
          <div className="p-4 bg-white rounded-2xl border border-rose-200 bg-rose-50/20 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Returned (Bounced)</span>
              <span className="w-7 h-7 rounded-lg bg-rose-100 text-rose-800 flex items-center justify-center font-mono text-xs font-bold">
                {metrics.inward.returnedCount}
              </span>
            </div>
            <div className="mt-2">
              <div className="text-lg font-black text-rose-700 font-mono">
                {formatCurrency(metrics.inward.returnedTotal)}
              </div>
              <span className="text-[10px] text-rose-600 font-medium">Customer re-debited</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 gap-6 overflow-x-auto pb-px">
          <button
            type="button"
            onClick={() => {
              setActiveTab("INWARD");
              setStatusFilter("ALL");
            }}
            className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
              activeTab === "INWARD"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
            <span>Customer Cheques (Inward)</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 font-mono text-slate-700">
              {metrics.inward.inHandCount + metrics.inward.depositedCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("OUTWARD");
              setStatusFilter("ALL");
            }}
            className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
              activeTab === "OUTWARD"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <ArrowUpRight className="w-4 h-4 text-amber-600" />
            <span>Supplier Cheques (Outward)</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 font-mono text-slate-700">
              {metrics.outward.issuedCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("CALENDAR")}
            className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
              activeTab === "CALENDAR"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>PDC Maturing Timeline</span>
            {metrics.inward.dueTodayCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-mono font-bold animate-pulse">
                {metrics.inward.dueTodayCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("DEPOSIT_SLIPS")}
            className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
              activeTab === "DEPOSIT_SLIPS"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>Bank Deposit Slips</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 font-mono text-slate-700">
              {depositSlips.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("BANK_ACCOUNTS")}
            className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
              activeTab === "BANK_ACCOUNTS"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Building className="w-4 h-4" />
            <span>Merchant Bank Accounts</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 font-mono text-slate-700">
              {bankAccounts.length}
            </span>
          </button>
        </div>

        {/* ================= TAB: INWARD & OUTWARD CHEQUES ================= */}
        {(activeTab === "INWARD" || activeTab === "OUTWARD") && (
          <div className="space-y-4">
            {/* Filter and Action Bar */}
            <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
                {[
                  { id: "ALL", label: "All Cheques" },
                  { id: "RECEIVED", label: activeTab === "INWARD" ? "In-Hand (Safe)" : "Issued (Unpresented)" },
                  { id: "DEPOSITED", label: "Deposited (Clearing)" },
                  { id: "REALIZED", label: "Realized (Cleared)" },
                  { id: "RETURNED", label: "Returned (Bounced)" },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setStatusFilter(st.id)}
                    className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition ${
                      statusFilter === st.id
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                {/* Search */}
                <div className="relative flex-1 md:w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && loadCheques()}
                    placeholder="Search Cheque #, Drawer, Bank..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                {/* PDC Filter */}
                <select
                  value={pdcFilter}
                  onChange={(e) => setPdcFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none"
                >
                  <option value="ALL">All Dates</option>
                  <option value="PDC_ONLY">Post-Dated Only (PDC)</option>
                  <option value="CURRENT_ONLY">Current Date Only</option>
                </select>

                <button
                  type="button"
                  onClick={() => loadCheques()}
                  className="p-1.5 border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-600 transition"
                  title="Refresh Cheques"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>

                {/* Batch Deposit button when cheques selected */}
                {activeTab === "INWARD" && selectedChequeIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsBatchDepositModalOpen(true)}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                  >
                    <Landmark className="w-3.5 h-3.5" />
                    <span>Deposit Selected ({selectedChequeIds.length})</span>
                  </button>
                )}
              </div>
            </div>

            {/* Cheque Data Table */}
            <div className="overflow-hidden border border-slate-200 rounded-2xl bg-white shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-600 border-b border-slate-200">
                    <tr>
                      {activeTab === "INWARD" && (
                        <th className="py-3 px-3 text-center w-8">
                          <input
                            type="checkbox"
                            checked={
                              cheques.filter((c) => c.status === "RECEIVED").length > 0 &&
                              selectedChequeIds.length === cheques.filter((c) => c.status === "RECEIVED").length
                            }
                            onChange={selectAllInHand}
                            className="rounded text-blue-600"
                          />
                        </th>
                      )}
                      <th className="py-3 px-3.5 font-mono">Cheque Number & Date</th>
                      <th className="py-3 px-3.5">{activeTab === "INWARD" ? "Customer / Drawer" : "Payee / Supplier"}</th>
                      <th className="py-3 px-3.5">Bank & Branch</th>
                      <th className="py-3 px-3.5 text-right font-mono">Amount (LKR)</th>
                      <th className="py-3 px-3.5 text-center">Lifecycle Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                          <span>Loading cheques...</span>
                        </td>
                      </tr>
                    ) : cheques.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400">
                          <Landmark className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                          <p className="font-semibold text-slate-600">No cheques found matching filters.</p>
                          <p className="text-[11px] text-slate-400 mt-1">Receive or issue a cheque to begin.</p>
                        </td>
                      </tr>
                    ) : (
                      cheques.map((c) => {
                        const cDate = new Date(c.chequeDate);
                        const isPast = cDate.getTime() < new Date().setHours(0, 0, 0, 0);
                        const isDueToday =
                          new Date(cDate).toDateString() === new Date().toDateString();

                        return (
                          <tr key={c._id} className="hover:bg-slate-50/70 transition">
                            {activeTab === "INWARD" && (
                              <td className="py-3 px-3 text-center">
                                {c.status === "RECEIVED" ? (
                                  <input
                                    type="checkbox"
                                    checked={selectedChequeIds.includes(c._id)}
                                    onChange={() => toggleSelectCheque(c._id)}
                                    className="rounded text-blue-600"
                                  />
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>
                            )}

                            {/* Cheque # & Date */}
                            <td className="py-3 px-3.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-slate-900 text-xs">
                                  #{c.chequeNumber}
                                </span>
                                {c.isPdc && (
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[9px] font-black tracking-wider uppercase ${
                                      isDueToday
                                        ? "bg-amber-100 text-amber-800 border border-amber-300 animate-pulse"
                                        : isPast
                                        ? "bg-rose-100 text-rose-800"
                                        : "bg-blue-100 text-blue-800"
                                    }`}
                                  >
                                    {isDueToday ? "Due Today" : isPast ? "PDC Matured" : "PDC"}
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-500 font-mono block mt-0.5">
                                Date: {new Date(c.chequeDate).toLocaleDateString("en-GB")}
                              </span>
                            </td>

                            {/* Customer / Drawer */}
                            <td className="py-3 px-3.5">
                              <span className="font-semibold text-slate-900 block">{c.partyName || c.drawerName}</span>
                              {c.partyPhone && (
                                <span className="text-[10px] text-slate-400 font-mono block">{c.partyPhone}</span>
                              )}
                            </td>

                            {/* Bank & Branch */}
                            <td className="py-3 px-3.5">
                              <span className="font-medium text-slate-800 block truncate max-w-[160px]">{c.bankName}</span>
                              <span className="text-[10px] text-slate-500 block">{c.bankBranch || "Main Branch"}</span>
                            </td>

                            {/* Amount */}
                            <td className="py-3 px-3.5 text-right font-mono font-black text-slate-900">
                              {formatCurrency(c.amount)}
                            </td>

                            {/* Status Badge */}
                            <td className="py-3 px-3.5 text-center">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  c.status === "REALIZED"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : c.status === "DEPOSITED"
                                    ? "bg-purple-100 text-purple-800"
                                    : c.status === "RETURNED"
                                    ? "bg-rose-100 text-rose-800"
                                    : c.status === "CANCELLED"
                                    ? "bg-slate-200 text-slate-700"
                                    : "bg-blue-100 text-blue-800"
                                }`}
                              >
                                {c.status === "RECEIVED" ? (activeTab === "INWARD" ? "In-Hand (Safe)" : "Issued") : c.status}
                              </span>
                              {c.depositDetails?.depositSlipNumber && (
                                <span className="text-[9px] text-slate-400 font-mono block mt-0.5 truncate max-w-[100px] mx-auto">
                                  {c.depositDetails.depositSlipNumber}
                                </span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Inward Actions */}
                                {c.status === "RECEIVED" && activeTab === "INWARD" && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedChequeIds([c._id]);
                                      setIsBatchDepositModalOpen(true);
                                    }}
                                    className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                                    title="Deposit Cheque to Bank"
                                  >
                                    <Landmark className="w-3 h-3" /> Deposit
                                  </button>
                                )}

                                {(c.status === "DEPOSITED" || c.status === "RECEIVED") && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedCheque(c);
                                      setRealizeForm({
                                        bankStatementRef: `CLEAR-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`,
                                        realizedAt: new Date().toISOString().slice(0, 10),
                                        clearedAmount: String(c.amount),
                                        notes: "",
                                      });
                                      setIsRealizeModalOpen(true);
                                    }}
                                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                                    title="Mark Realized / Cleared"
                                  >
                                    <Check className="w-3 h-3" /> Realize
                                  </button>
                                )}

                                {(c.status === "DEPOSITED" || c.status === "RECEIVED") && activeTab === "INWARD" && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedCheque(c);
                                      setReturnForm({
                                        reasonCode: "01",
                                        returnPenaltyFee: "1000",
                                        reDebitCustomer: true,
                                        sendSms: Boolean(c.partyPhone),
                                        notes: "",
                                      });
                                      setIsReturnModalOpen(true);
                                    }}
                                    className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                                    title="Mark Dishonored / Bounced"
                                  >
                                    <FileWarning className="w-3 h-3" /> Bounce
                                  </button>
                                )}

                                {c.status === "RETURNED" && activeTab === "INWARD" && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const penalty = c.returnDetails?.returnPenaltyFee || 1000;
                                      setActivePrintNotice({
                                        noticeNumber: `RET-${c.chequeNumber}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`,
                                        noticeDate: c.returnDetails?.returnedAt || new Date(),
                                        customerName: c.partyName,
                                        customerPhone: c.partyPhone,
                                        chequeNumber: c.chequeNumber,
                                        bankName: c.bankName,
                                        bankBranch: c.bankBranch,
                                        drawerName: c.drawerName,
                                        chequeDate: c.chequeDate,
                                        amount: c.amount,
                                        reasonCode: c.returnDetails?.reasonCode,
                                        reasonText: c.returnDetails?.reasonText || "Dishonored by Bank",
                                        penaltyFee: penalty,
                                        totalReDebited: c.amount + penalty,
                                        storeName: "Corner Store POS Merchant",
                                        settlementBankAccount: bankAccounts[0]
                                          ? {
                                              bankName: bankAccounts[0].bankName,
                                              branchName: bankAccounts[0].branchName,
                                              accountNumber: bankAccounts[0].accountNumber,
                                              accountName: bankAccounts[0].accountName,
                                            }
                                          : undefined,
                                      });
                                    }}
                                    className="p-1 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition"
                                    title="Print Dishonor Debit Advice Notice"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                  </button>
                                )}
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
          </div>
        )}

        {/* ================= TAB: PDC MATURING TIMELINE ================= */}
        {activeTab === "CALENDAR" && (
          <div className="space-y-4">
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Post-Dated Cheques (PDC) Maturing Schedule</h3>
                <p className="text-xs text-slate-500">Track and deposit cheques as their presentation maturity date arrives.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTimelineFilter("DUE_TODAY")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    timelineFilter === "DUE_TODAY" ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Due Today
                </button>
                <button
                  type="button"
                  onClick={() => setTimelineFilter("DUE_WEEK")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    timelineFilter === "DUE_WEEK" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Due This Week
                </button>
                <button
                  type="button"
                  onClick={() => setTimelineFilter("ALL")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    timelineFilter === "ALL" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  All Dates
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {cheques.filter((c) => c.isPdc && c.status === "RECEIVED").length === 0 ? (
                <div className="col-span-full p-12 bg-white rounded-2xl border border-slate-200 text-center text-slate-400">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                  <p className="font-bold text-slate-700">No pending post-dated cheques in safe.</p>
                  <p className="text-xs text-slate-400 mt-0.5">All customer PDCs have been deposited or realized.</p>
                </div>
              ) : (
                cheques
                  .filter((c) => c.isPdc && c.status === "RECEIVED")
                  .map((c) => {
                    const cDate = new Date(c.chequeDate);
                    const isDueToday = new Date(cDate).toDateString() === new Date().toDateString();
                    const isMatured = cDate.getTime() < new Date().getTime();

                    return (
                      <div
                        key={c._id}
                        className={`p-4 bg-white rounded-2xl border transition shadow-xs ${
                          isDueToday
                            ? "border-amber-300 ring-2 ring-amber-200 bg-amber-50/20"
                            : isMatured
                            ? "border-emerald-300 bg-emerald-50/10"
                            : "border-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono font-bold text-xs text-slate-900">#{c.chequeNumber}</span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                              isDueToday
                                ? "bg-amber-100 text-amber-800 animate-pulse"
                                : isMatured
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {isDueToday ? "Due Today" : isMatured ? "Matured" : "Future PDC"}
                          </span>
                        </div>

                        <div className="text-xl font-black font-mono text-slate-900 mb-2">
                          {formatCurrency(c.amount)}
                        </div>

                        <div className="space-y-1 text-xs text-slate-600 border-t border-slate-100 pt-2 mb-3">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Customer:</span>
                            <span className="font-semibold text-slate-800">{c.partyName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Bank:</span>
                            <span className="font-medium text-slate-700">{c.bankName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Maturity Date:</span>
                            <span className="font-mono font-bold text-slate-900">
                              {new Date(c.chequeDate).toLocaleDateString("en-GB")}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedChequeIds([c._id]);
                            setIsBatchDepositModalOpen(true);
                          }}
                          className={`w-full py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                            isDueToday || isMatured
                              ? "bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                          }`}
                        >
                          <Landmark className="w-3.5 h-3.5" />
                          <span>Deposit Into Bank</span>
                        </button>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        )}

        {/* ================= TAB: BANK DEPOSIT SLIPS ================= */}
        {activeTab === "DEPOSIT_SLIPS" && (
          <div className="space-y-4">
            <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Generated Bank Lodgement Slips</h3>
                <p className="text-xs text-slate-500">Official multi-cheque lodgement manifests printed for bank counters.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const inHand = cheques.filter((c) => c.status === "RECEIVED").map((c) => c._id);
                  setSelectedChequeIds(inHand);
                  setIsBatchDepositModalOpen(true);
                }}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Deposit Slip</span>
              </button>
            </div>

            <div className="overflow-hidden border border-slate-200 rounded-2xl bg-white shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3.5 font-mono">Slip # & Date</th>
                    <th className="py-3 px-3.5">Credit Bank & Account</th>
                    <th className="py-3 px-3.5 text-center">Cheques Included</th>
                    <th className="py-3 px-3.5 text-right font-mono">Cash Amount</th>
                    <th className="py-3 px-3.5 text-right font-mono">Total Deposit (LKR)</th>
                    <th className="py-3 px-3.5">Deposited By</th>
                    <th className="py-3 px-4 text-right">Print Slip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {depositSlips.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <Printer className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold text-slate-600">No bank deposit slips created yet.</p>
                      </td>
                    </tr>
                  ) : (
                    depositSlips.map((ds) => (
                      <tr key={ds._id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-3.5">
                          <span className="font-mono font-bold text-slate-900 block">{ds.slipNumber}</span>
                          <span className="text-[11px] text-slate-500 font-mono block">
                            {new Date(ds.depositDate).toLocaleDateString("en-GB")}
                          </span>
                        </td>
                        <td className="py-3 px-3.5">
                          <span className="font-semibold text-slate-900 block">{ds.bankName}</span>
                          <span className="text-[10px] font-mono text-slate-500 block">
                            A/C: {ds.accountNumber} ({ds.accountName})
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-center font-mono font-bold text-blue-700">
                          {ds.chequeCount} Cheques
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-slate-600">
                          {formatCurrency(ds.cashAmount)}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-black text-slate-900">
                          {formatCurrency(ds.totalDepositAmount)}
                        </td>
                        <td className="py-3 px-3.5 text-slate-600">{ds.depositedBy}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setActivePrintSlip({
                                slipNumber: ds.slipNumber,
                                bankName: ds.bankName,
                                branchName: ds.branchName,
                                accountNumber: ds.accountNumber,
                                accountName: ds.accountName,
                                depositDate: ds.depositDate,
                                cheques: ds.cheques,
                                chequeCount: ds.chequeCount,
                                chequeTotal: ds.chequeTotal,
                                cashAmount: ds.cashAmount,
                                totalDepositAmount: ds.totalDepositAmount,
                                depositedBy: ds.depositedBy,
                                notes: ds.notes,
                              });
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition inline-flex items-center gap-1"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Print</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================= TAB: MERCHANT BANK ACCOUNTS ================= */}
        {activeTab === "BANK_ACCOUNTS" && (
          <div className="space-y-4">
            <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Company Bank Accounts (Sri Lanka)</h3>
                <p className="text-xs text-slate-500">Commercial Bank, Sampath Bank, BOC & private bank ledger balances.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddAccountModalOpen(true)}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Bank Account</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bankAccounts.map((acc) => (
                <div key={acc._id} className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs relative">
                  {acc.isDefault && (
                    <span className="absolute top-4 right-4 px-2 py-0.5 bg-blue-100 text-blue-800 text-[9px] font-black uppercase rounded-full">
                      Default Deposit A/C
                    </span>
                  )}
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center mb-3">
                    <Building className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">{acc.bankName}</h4>
                  <p className="text-xs text-slate-500">{acc.branchName} Branch</p>

                  <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Account #:</span>
                      <span className="font-bold text-slate-900">{acc.accountNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Title:</span>
                      <span className="font-medium text-slate-800 uppercase">{acc.accountName}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Ledger Balance</span>
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        {formatCurrency(acc.ledgerBalance)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-700 uppercase font-bold block">Cleared Balance</span>
                      <span className="font-mono font-black text-emerald-700 text-sm">
                        {formatCurrency(acc.clearedBalance)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= MODAL: RECEIVE / ISSUE CHEQUE ================= */}
        {isAddChequeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                    <Landmark className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {chequeForm.direction === "INWARD" ? "Receive Customer Cheque" : "Issue Supplier Cheque"}
                  </h3>
                </div>
                <button
                  onClick={() => setIsAddChequeModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateCheque} className="space-y-3.5 text-xs">
                {/* Party Link */}
                {chequeForm.direction === "INWARD" ? (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Customer</label>
                    <select
                      value={chequeForm.partyId}
                      onChange={(e) => {
                        const cust = customers.find((c) => c._id === e.target.value);
                        setChequeForm((prev) => ({
                          ...prev,
                          partyId: e.target.value,
                          drawerName: cust ? cust.name : prev.drawerName,
                          partyPhone: cust?.phone || prev.partyPhone,
                        }));
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="">Select Customer (or enter name below)</option>
                      {customers.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name} {c.phone ? `(${c.phone})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Supplier / Vendor</label>
                    <select
                      value={chequeForm.partyId}
                      onChange={(e) => {
                        const supp = suppliers.find((s) => s._id === e.target.value);
                        setChequeForm((prev) => ({
                          ...prev,
                          partyId: e.target.value,
                          payeeName: supp ? supp.name : prev.payeeName,
                          partyPhone: supp?.phone || prev.partyPhone,
                        }));
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="">Select Supplier</option>
                      {suppliers.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Drawer (Issuer Name) *</label>
                    <input
                      type="text"
                      required
                      value={chequeForm.drawerName}
                      onChange={(e) => setChequeForm({ ...chequeForm, drawerName: e.target.value })}
                      placeholder="e.g. K. Perera"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Payee Name *</label>
                    <input
                      type="text"
                      required
                      value={chequeForm.payeeName}
                      onChange={(e) => setChequeForm({ ...chequeForm, payeeName: e.target.value })}
                      placeholder="e.g. Corner Store POS"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Sri Lankan Bank Dropdown */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Bank Name *</label>
                    <select
                      value={chequeForm.bankName}
                      onChange={(e) => setChequeForm({ ...chequeForm, bankName: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      {SRI_LANKAN_BANKS.map((b) => (
                        <option key={b.code} value={b.name}>
                          {b.shortName} ({b.name})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Bank Branch</label>
                    <input
                      type="text"
                      list="branch-list"
                      value={chequeForm.bankBranch}
                      onChange={(e) => setChequeForm({ ...chequeForm, bankBranch: e.target.value })}
                      placeholder="Branch name"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <datalist id="branch-list">
                      {POPULAR_SRI_LANKA_BRANCHES.map((br) => (
                        <option key={br} value={br} />
                      ))}
                    </datalist>
                  </div>
                </div>

                {/* Cheque # and Amount */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Cheque Number *</label>
                    <input
                      type="text"
                      required
                      value={chequeForm.chequeNumber}
                      onChange={(e) => setChequeForm({ ...chequeForm, chequeNumber: e.target.value })}
                      placeholder="e.g. 104829"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Amount (LKR) *</label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      value={chequeForm.amount}
                      onChange={(e) => setChequeForm({ ...chequeForm, amount: e.target.value })}
                      placeholder="0.00"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Cheque Date & Phone */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Cheque Face Date * (PDC)
                    </label>
                    <input
                      type="date"
                      required
                      value={chequeForm.chequeDate}
                      onChange={(e) => setChequeForm({ ...chequeForm, chequeDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Contact Phone</label>
                    <input
                      type="tel"
                      value={chequeForm.partyPhone}
                      onChange={(e) => setChequeForm({ ...chequeForm, partyPhone: e.target.value })}
                      placeholder="077XXXXXXX"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Apply As Payment Checkbox */}
                {chequeForm.partyId && (
                  <label className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl border border-blue-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={chequeForm.applyAsPayment}
                      onChange={(e) => setChequeForm({ ...chequeForm, applyAsPayment: e.target.checked })}
                      className="rounded text-blue-600"
                    />
                    <span className="text-xs font-semibold text-blue-950">
                      {chequeForm.direction === "INWARD"
                        ? "Credit towards customer's account balance immediately"
                        : "Debit from supplier payable balance immediately"}
                    </span>
                  </label>
                )}

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddChequeModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shadow-sm"
                  >
                    Save Cheque
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= MODAL: BATCH BANK DEPOSIT ================= */}
        {isBatchDepositModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Landmark className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Batch Bank Deposit Lodgement</h3>
                    <p className="text-[11px] text-slate-400">
                      Deposit {selectedChequeIds.length} cheques to merchant bank account
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsBatchDepositModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleBatchDeposit} className="space-y-4 text-xs">
                {/* Select Bank Account */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Credit Merchant Bank Account *
                  </label>
                  <select
                    required
                    value={depositForm.bankAccountId}
                    onChange={(e) => setDepositForm({ ...depositForm, bankAccountId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    {bankAccounts.map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.bankName} — A/C {a.accountNumber} ({a.accountName})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selected Cheques Summary */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <span className="font-bold text-slate-700 text-[11px] uppercase block">
                    Lodgement Cheque Roster ({selectedChequeIds.length})
                  </span>
                  <div className="max-h-36 overflow-y-auto divide-y divide-slate-200/60 pr-1 text-[11px]">
                    {cheques
                      .filter((c) => selectedChequeIds.includes(c._id))
                      .map((c) => (
                        <div key={c._id} className="py-1 flex justify-between items-center">
                          <div>
                            <span className="font-mono font-bold text-slate-800">#{c.chequeNumber}</span>{" "}
                            <span className="text-slate-500">({c.bankName})</span>
                          </div>
                          <span className="font-mono font-bold text-slate-900">{formatCurrency(c.amount)}</span>
                        </div>
                      ))}
                  </div>
                  <div className="border-t border-slate-300 pt-1.5 flex justify-between font-bold">
                    <span>Cheque Subtotal:</span>
                    <span className="font-mono text-emerald-800">
                      {formatCurrency(
                        cheques
                          .filter((c) => selectedChequeIds.includes(c._id))
                          .reduce((sum, c) => sum + c.amount, 0)
                      )}
                    </span>
                  </div>
                </div>

                {/* Optional Cash Lodgement */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Physical Cash (Optional)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={depositForm.cashAmount}
                      onChange={(e) => setDepositForm({ ...depositForm, cashAmount: e.target.value })}
                      placeholder="0.00"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Lodgement Date</label>
                    <input
                      type="date"
                      required
                      value={depositForm.depositDate}
                      onChange={(e) => setDepositForm({ ...depositForm, depositDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Deposit Memo / Notes</label>
                  <input
                    type="text"
                    value={depositForm.notes}
                    onChange={(e) => setDepositForm({ ...depositForm, notes: e.target.value })}
                    placeholder="e.g. Fort branch morning courier drop"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsBatchDepositModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition shadow-sm"
                  >
                    Generate Bank Deposit Slip
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= MODAL: MARK REALIZED / CLEARED ================= */}
        {isRealizeModalOpen && selectedCheque && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Mark Cheque as Realized</h3>
                    <p className="text-[11px] text-slate-400 font-mono">
                      #{selectedCheque.chequeNumber} • {formatCurrency(selectedCheque.amount)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsRealizeModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleMarkRealized} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Bank Statement Clearance Ref *
                  </label>
                  <input
                    type="text"
                    required
                    value={realizeForm.bankStatementRef}
                    onChange={(e) => setRealizeForm({ ...realizeForm, bankStatementRef: e.target.value })}
                    placeholder="e.g. CB-TXN-902148"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Realization Date</label>
                    <input
                      type="date"
                      required
                      value={realizeForm.realizedAt}
                      onChange={(e) => setRealizeForm({ ...realizeForm, realizedAt: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Cleared Amount (LKR)</label>
                    <input
                      type="number"
                      required
                      value={realizeForm.clearedAmount}
                      onChange={(e) => setRealizeForm({ ...realizeForm, clearedAmount: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Notes</label>
                  <input
                    type="text"
                    value={realizeForm.notes}
                    onChange={(e) => setRealizeForm({ ...realizeForm, notes: e.target.value })}
                    placeholder="Clearance memo"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsRealizeModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition shadow-sm"
                  >
                    Confirm Realized
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= MODAL: MARK RETURNED / BOUNCE ================= */}
        {isReturnModalOpen && selectedCheque && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                    <FileWarning className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Dishonored Cheque (Bounce Engine)</h3>
                    <p className="text-[11px] text-slate-400 font-mono">
                      #{selectedCheque.chequeNumber} • {formatCurrency(selectedCheque.amount)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsReturnModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleMarkReturned} className="space-y-4 text-xs">
                {/* Dishonor Reason */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Central Bank Dishonor Reason *
                  </label>
                  <select
                    value={returnForm.reasonCode}
                    onChange={(e) => {
                      const found = CHEQUE_DISHONOR_REASONS.find((r) => r.code === e.target.value);
                      setReturnForm((prev) => ({
                        ...prev,
                        reasonCode: e.target.value,
                        returnPenaltyFee: String(found?.defaultPenalty ?? 1000),
                      }));
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  >
                    {CHEQUE_DISHONOR_REASONS.map((r) => (
                      <option key={r.code} value={r.code}>
                        [Code {r.code}] {r.description}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Return Penalty Fee */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Bank Return Penalty Fee (LKR)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={returnForm.returnPenaltyFee}
                      onChange={(e) => setReturnForm({ ...returnForm, returnPenaltyFee: e.target.value })}
                      placeholder="1000"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Total Re-Debit to Customer
                    </label>
                    <div className="px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl font-mono font-black text-rose-800 text-xs">
                      {formatCurrency(selectedCheque.amount + (Number(returnForm.returnPenaltyFee) || 0))}
                    </div>
                  </div>
                </div>

                {/* Re-Debit Checkbox */}
                <label className="flex items-center gap-2 p-3 bg-rose-50/70 border border-rose-200 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={returnForm.reDebitCustomer}
                    onChange={(e) => setReturnForm({ ...returnForm, reDebitCustomer: e.target.checked })}
                    className="rounded text-rose-600"
                  />
                  <div>
                    <span className="font-bold text-rose-950 block">Re-debit Customer Credit Balance Automatically</span>
                    <span className="text-[10px] text-rose-700 block">
                      Restores customer debt and records CHEQUE_RETURN credit transaction.
                    </span>
                  </div>
                </label>

                {/* SMS Alert Checkbox */}
                {selectedCheque.partyPhone && (
                  <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={returnForm.sendSms}
                      onChange={(e) => setReturnForm({ ...returnForm, sendSms: e.target.checked })}
                      className="rounded text-blue-600"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">Dispatch Automated SMS Bounce Alert</span>
                      <span className="text-[10px] text-slate-500 block">
                        Sends formal dishonor warning to {selectedCheque.partyPhone}
                      </span>
                    </div>
                  </label>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Return Memo / Notes</label>
                  <input
                    type="text"
                    value={returnForm.notes}
                    onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
                    placeholder="Bank memo notes"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsReturnModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition shadow-sm"
                  >
                    Confirm Cheque Bounce
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= MODAL: ADD BANK ACCOUNT ================= */}
        {isAddAccountModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                    <Building className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">Add Company Bank Account</h3>
                </div>
                <button
                  onClick={() => setIsAddAccountModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddAccount} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Bank Name *</label>
                  <select
                    value={accountForm.bankName}
                    onChange={(e) => setAccountForm({ ...accountForm, bankName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {SRI_LANKAN_BANKS.map((b) => (
                      <option key={b.code} value={b.name}>
                        {b.shortName} ({b.name})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Branch Name *</label>
                    <input
                      type="text"
                      required
                      list="branch-list-acc"
                      value={accountForm.branchName}
                      onChange={(e) => setAccountForm({ ...accountForm, branchName: e.target.value })}
                      placeholder="e.g. Colombo Fort"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <datalist id="branch-list-acc">
                      {POPULAR_SRI_LANKA_BRANCHES.map((br) => (
                        <option key={br} value={br} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Account Type</label>
                    <select
                      value={accountForm.accountType}
                      onChange={(e: any) => setAccountForm({ ...accountForm, accountType: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="CURRENT">Current Account</option>
                      <option value="SAVINGS">Savings Account</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Account Title / Name *</label>
                  <input
                    type="text"
                    required
                    value={accountForm.accountName}
                    onChange={(e) => setAccountForm({ ...accountForm, accountName: e.target.value })}
                    placeholder="e.g. Corner Store (Pvt) Ltd"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Account Number *</label>
                  <input
                    type="text"
                    required
                    value={accountForm.accountNumber}
                    onChange={(e) => setAccountForm({ ...accountForm, accountNumber: e.target.value })}
                    placeholder="e.g. 1000293847"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddAccountModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shadow-sm"
                  >
                    Save Account
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Printable Deposit Slip Modal */}
        {activePrintSlip && (
          <BankDepositSlipReceipt
            data={activePrintSlip}
            onClose={() => setActivePrintSlip(null)}
          />
        )}

        {/* Printable Cheque Return Debit Advice Modal */}
        {activePrintNotice && (
          <ChequeReturnNotice
            data={activePrintNotice}
            onClose={() => setActivePrintNotice(null)}
          />
        )}
      </div>
    </AppLayout>
  );
}
