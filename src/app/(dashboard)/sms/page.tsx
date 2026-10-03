"use client";

import { useEffect, useState, useMemo } from "react";
import AppLayout from "@/components/layout/AppLayout";
import {
  MessageSquare,
  Send,
  Radio,
  Settings2,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  Coins,
  Copy,
  Check,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Smartphone,
  Info,
  Sliders,
  DollarSign,
  AlertTriangle,
  Play,
  RotateCw,
  Sparkles,
  Tag,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import CampaignManager from "@/components/campaigns/CampaignManager";

interface ISmsLogItem {
  _id: string;
  recipientPhone: string;
  recipientName?: string;
  customerId?: string;
  eventType: string;
  message: string;
  provider: "NOTIFY_LK" | "DIALOG" | "MOBITEL" | "SIMULATED";
  senderId?: string;
  status: "SENT" | "FAILED" | "SIMULATED";
  cost: number;
  gatewayResponse?: any;
  errorDetails?: string;
  createdAt: string;
}

interface ISmsSettingsForm {
  provider: "NOTIFY_LK" | "DIALOG" | "MOBITEL" | "SIMULATED";
  senderId: string;
  notifyLk: {
    apiKey: string;
    userId: string;
  };
  dialog: {
    username: string;
    password: string;
  };
  mobitel: {
    username: string;
    password: string;
  };
  sendOnCreditSale: boolean;
  sendOnCreditSettlement: boolean;
  sendOnOverdueReminder: boolean;
  sendOnLoyaltyPoints: boolean;
  sendOnGiftVoucher: boolean;
  sendOnQuotation: boolean;
  templates: {
    creditSale: string;
    creditSettlement: string;
    overdueReminder: string;
    loyaltyAccrual: string;
    giftVoucher: string;
    quotationAlert: string;
  };
}

const DEFAULT_TEMPLATES = {
  creditSale: "Dear {customerName}, a credit purchase of Rs. {amount} was added to your account at {storeName}. Current balance: Rs. {balance}. Due: {dueDate}. Ref: {ref}.",
  creditSettlement: "Dear {customerName}, we received your payment of Rs. {amount}. Your remaining balance at {storeName} is Rs. {balance}. Ref: {ref}. Thank you!",
  overdueReminder: "Dear {customerName}, this is a gentle reminder that your balance of Rs. {balance} at {storeName} is past due ({dueDate}). Kindly settle soon. Thank you.",
  loyaltyAccrual: "Dear {customerName}, you just earned {points} loyalty points at {storeName}! Total points: {balance} ({tier} Tier). Thank you for shopping with us!",
  giftVoucher: "Dear {customerName}, your Gift Voucher from {storeName} is {code} valued at Rs. {amount}. Valid until {dueDate}. Present this code at counter.",
  quotationAlert: "Dear {customerName}, your quotation {ref} for Rs. {amount} is ready at {storeName}. Valid until {dueDate}. Contact us to confirm your order.",
};

export default function SmsManagementPage() {
  const [activeTab, setActiveTab] = useState<"logs" | "settings" | "triggers" | "broadcast" | "campaigns">("logs");
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Stats & Analytics
  const [stats, setStats] = useState({
    totalSent: 0,
    deliveredCount: 0,
    failedCount: 0,
    simulatedCount: 0,
    deliveryRate: 100,
    totalCost: 0,
  });

  // Logs state
  const [logs, setLogs] = useState<ISmsLogItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [eventFilter, setEventFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogsCount, setTotalLogsCount] = useState(0);

  // Log View Detail Modal
  const [selectedLog, setSelectedLog] = useState<ISmsLogItem | null>(null);
  const [resendingLogId, setResendingLogId] = useState<string | null>(null);

  // Settings state
  const [settings, setSettings] = useState<ISmsSettingsForm>({
    provider: "SIMULATED",
    senderId: "STOREPOS",
    notifyLk: { apiKey: "", userId: "" },
    dialog: { username: "", password: "" },
    mobitel: { username: "", password: "" },
    sendOnCreditSale: true,
    sendOnCreditSettlement: true,
    sendOnOverdueReminder: true,
    sendOnLoyaltyPoints: true,
    sendOnGiftVoucher: true,
    sendOnQuotation: true,
    templates: { ...DEFAULT_TEMPLATES },
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Quick Test SMS Widget state
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("Testing Sri Lanka POS SMS Gateway integration. All systems operational!");
  const [sendingTest, setSendingTest] = useState(false);

  // Broadcast campaign state
  const [broadcastTarget, setBroadcastTarget] = useState<
    "OVERDUE_DEBTORS" | "ALL_CREDIT_CUSTOMERS" | "VIP_PLATINUM" | "VIP_GOLD" | "VIP_SILVER" | "ALL_CUSTOMERS"
  >("OVERDUE_DEBTORS");
  const [broadcastMessage, setBroadcastMessage] = useState(
    "Dear {customerName}, this is a gentle reminder regarding your outstanding balance of Rs. {balance} at {storeName}. Kindly settle at your earliest convenience."
  );
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // Fetch initial data
  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/sms/settings");
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings({
          provider: data.settings.provider || "SIMULATED",
          senderId: data.settings.senderId || "STOREPOS",
          notifyLk: {
            apiKey: data.settings.notifyLk?.apiKey || "",
            userId: data.settings.notifyLk?.userId || "",
          },
          dialog: {
            username: data.settings.dialog?.username || "",
            password: data.settings.dialog?.password || "",
          },
          mobitel: {
            username: data.settings.mobitel?.username || "",
            password: data.settings.mobitel?.password || "",
          },
          sendOnCreditSale: data.settings.sendOnCreditSale ?? true,
          sendOnCreditSettlement: data.settings.sendOnCreditSettlement ?? true,
          sendOnOverdueReminder: data.settings.sendOnOverdueReminder ?? true,
          sendOnLoyaltyPoints: data.settings.sendOnLoyaltyPoints ?? true,
          sendOnGiftVoucher: data.settings.sendOnGiftVoucher ?? true,
          sendOnQuotation: data.settings.sendOnQuotation ?? true,
          templates: {
            creditSale: data.settings.templates?.creditSale || DEFAULT_TEMPLATES.creditSale,
            creditSettlement: data.settings.templates?.creditSettlement || DEFAULT_TEMPLATES.creditSettlement,
            overdueReminder: data.settings.templates?.overdueReminder || DEFAULT_TEMPLATES.overdueReminder,
            loyaltyAccrual: data.settings.templates?.loyaltyAccrual || DEFAULT_TEMPLATES.loyaltyAccrual,
            giftVoucher: data.settings.templates?.giftVoucher || DEFAULT_TEMPLATES.giftVoucher,
            quotationAlert: data.settings.templates?.quotationAlert || DEFAULT_TEMPLATES.quotationAlert,
          },
        });
      }
    } catch (err) {
      console.error("Failed to fetch SMS settings:", err);
    }
  };

  const fetchLogs = async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "15",
        status: statusFilter,
        eventType: eventFilter,
        q: searchQuery,
      });

      const res = await fetch(`/api/sms/logs?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotalLogsCount(data.pagination?.total || 0);
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (err) {
      console.error("Failed to fetch SMS logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [page, statusFilter, eventFilter, searchQuery]);

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingSettings(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/sms/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", message: "SMS Gateway configuration saved successfully!" });
        fetchSettings();
      } else {
        setFeedback({ type: "error", message: data.error || "Failed to save SMS settings." });
      }
    } catch {
      setFeedback({ type: "error", message: "Network error saving SMS settings." });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSendTestSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone.trim() || !testMessage.trim()) {
      setFeedback({ type: "error", message: "Please provide a valid Sri Lankan phone number and message." });
      return;
    }
    setSendingTest(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientPhone: testPhone.trim(),
          recipientName: "Test Recipient",
          message: testMessage.trim(),
          eventType: "TEST",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({
          type: "success",
          message: `SMS sent successfully via ${data.log?.provider || "gateway"}! (Status: ${data.log?.status})`,
        });
        fetchLogs();
      } else {
        setFeedback({ type: "error", message: data.error || "Failed to send test SMS." });
      }
    } catch {
      setFeedback({ type: "error", message: "Network error sending test SMS." });
    } finally {
      setSendingTest(false);
    }
  };

  const handleResendLog = async (logItem: ISmsLogItem) => {
    setResendingLogId(logItem._id);
    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientPhone: logItem.recipientPhone,
          recipientName: logItem.recipientName,
          customerId: logItem.customerId,
          message: logItem.message,
          eventType: logItem.eventType,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", message: `SMS re-sent successfully to ${logItem.recipientPhone}!` });
        fetchLogs();
      } else {
        setFeedback({ type: "error", message: data.error || "Failed to re-send SMS." });
      }
    } catch {
      setFeedback({ type: "error", message: "Network error re-sending SMS." });
    } finally {
      setResendingLogId(null);
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastMessage.trim()) {
      setFeedback({ type: "error", message: "Broadcast message body cannot be blank." });
      return;
    }

    if (!confirm(`Are you sure you want to broadcast this SMS message to segment: ${broadcastTarget}?`)) {
      return;
    }

    setSendingBroadcast(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/sms/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: broadcastTarget,
          messageTemplate: broadcastMessage.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({
          type: "success",
          message: `Broadcast complete! ${data.sentCount} SMS queued/dispatched, ${data.failedCount} failed. Cost: Rs. ${data.totalEstimatedCost.toFixed(2)}`,
        });
        fetchLogs();
        setActiveTab("logs");
      } else {
        setFeedback({ type: "error", message: data.error || "Failed to dispatch broadcast campaign." });
      }
    } catch {
      setFeedback({ type: "error", message: "Network error dispatching broadcast campaign." });
    } finally {
      setSendingBroadcast(false);
    }
  };

  // Helper to count active triggers
  const activeTriggerCount = [
    settings.sendOnCreditSale,
    settings.sendOnCreditSettlement,
    settings.sendOnOverdueReminder,
    settings.sendOnLoyaltyPoints,
    settings.sendOnGiftVoucher,
    settings.sendOnQuotation,
  ].filter(Boolean).length;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                <MessageSquare className="w-6 h-6" />
              </span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  SMS Gateway & Automated Notifications
                </h1>
                <p className="text-sm text-slate-500">
                  Sri Lankan multi-gateway SMS engine (Notify.lk, Dialog Enterprise, Mobitel) & real-time customer transactional alerts
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                fetchSettings();
                fetchLogs();
                setFeedback({ type: "success", message: "Refreshed live delivery telemetry & gateway settings." });
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 shadow-sm transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 shadow-sm transition-colors"
            >
              <Sliders className="w-4 h-4" />
              Configure Gateway
            </button>
          </div>
        </div>

        {/* Global Feedback Alert */}
        {feedback && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between animate-in fade-in duration-200 ${
              feedback.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              )}
              <span className="text-sm font-medium">{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-xs underline hover:no-underline font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Delivered Messages</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">
                {(stats.deliveredCount + stats.simulatedCount).toLocaleString()}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {stats.simulatedCount > 0 ? `${stats.simulatedCount} in Sandbox mode` : "All production live"}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
              <Send className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Delivery Success</p>
              <h3 className="text-2xl font-black text-emerald-600 mt-1">{stats.deliveryRate}%</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {stats.failedCount} delivery {stats.failedCount === 1 ? "failure" : "failures"} logged
              </p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Gateway Cost / Credits</p>
              <h3 className="text-2xl font-black text-purple-700 mt-1">
                Rs. {stats.totalCost.toFixed(2)}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Avg ~Rs. 0.45 per transactional SMS</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600">
              <Coins className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Triggers</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">
                {activeTriggerCount} <span className="text-sm font-normal text-slate-500">/ 6 rules</span>
              </h3>
              <div className="mt-1 flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${activeTriggerCount > 0 ? "bg-emerald-500" : "bg-amber-500"}`} />
                <span className="text-xs font-medium text-slate-600">
                  {settings.provider === "SIMULATED" ? "Sandbox Simulation" : `${settings.provider} Active`}
                </span>
              </div>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
              <Radio className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-slate-200">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab("logs")}
              className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                activeTab === "logs"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              <Clock className="w-4 h-4" />
              Delivery Audit Logs
              <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 font-semibold">
                {totalLogsCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("settings")}
              className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                activeTab === "settings"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              <Settings2 className="w-4 h-4" />
              Gateway Configuration & Test
            </button>

            <button
              onClick={() => setActiveTab("triggers")}
              className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                activeTab === "triggers"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Automated Triggers & Templates
            </button>

            <button
              onClick={() => setActiveTab("broadcast")}
              className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                activeTab === "broadcast"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              <Users className="w-4 h-4" />
              Bulk Debt Reminders
            </button>

            <button
              onClick={() => setActiveTab("campaigns")}
              className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                activeTab === "campaigns"
                  ? "border-indigo-600 text-indigo-600 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              <Tag className="w-4 h-4" />
              RFM Promotional Campaigns & Coupons
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                PROMO
              </span>
            </button>
          </nav>
        </div>

        {/* TAB 1: AUDIT LOGS */}
        {activeTab === "logs" && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="relative w-full md:w-96">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search recipient phone, name, or text..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">All Delivery Statuses</option>
                  <option value="SENT">Sent (Live Gateway)</option>
                  <option value="SIMULATED">Simulated (Sandbox)</option>
                  <option value="FAILED">Failed</option>
                </select>

                <select
                  value={eventFilter}
                  onChange={(e) => {
                    setEventFilter(e.target.value);
                    setPage(1);
                  }}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">All Event Types</option>
                  <option value="CREDIT_PURCHASE">Credit Purchase (Naya Potha)</option>
                  <option value="CREDIT_SETTLEMENT">Debt Settlement</option>
                  <option value="OVERDUE_REMINDER">Overdue Debt Reminder</option>
                  <option value="LOYALTY_ACCRUAL">Loyalty Accrual</option>
                  <option value="GIFT_VOUCHER">Gift Voucher</option>
                  <option value="QUOTATION_ALERT">Quotation Alert</option>
                  <option value="BROADCAST">Bulk Broadcast</option>
                  <option value="TEST">Test SMS</option>
                </select>
              </div>
            </div>

            {/* Logs Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Event Trigger</th>
                      <th className="py-3 px-4">Recipient</th>
                      <th className="py-3 px-4">Message Preview</th>
                      <th className="py-3 px-4">Gateway</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Cost (Rs.)</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-500">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                          Loading SMS delivery logs...
                        </td>
                      </tr>
                    ) : logs.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-500">
                          <MessageSquare className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                          No SMS delivery records found matching your filters.
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => {
                        const eventBadgeColor =
                          log.eventType === "CREDIT_PURCHASE"
                            ? "bg-amber-100 text-amber-800"
                            : log.eventType === "CREDIT_SETTLEMENT"
                            ? "bg-emerald-100 text-emerald-800"
                            : log.eventType === "OVERDUE_REMINDER"
                            ? "bg-red-100 text-red-800"
                            : log.eventType === "LOYALTY_ACCRUAL"
                            ? "bg-purple-100 text-purple-800"
                            : log.eventType === "GIFT_VOUCHER"
                            ? "bg-pink-100 text-pink-800"
                            : log.eventType === "QUOTATION_ALERT"
                            ? "bg-cyan-100 text-cyan-800"
                            : "bg-blue-100 text-blue-800";

                        const statusBadge =
                          log.status === "SENT" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Delivered
                            </span>
                          ) : log.status === "SIMULATED" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                              <Radio className="w-3.5 h-3.5" />
                              Sandbox
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                              <AlertCircle className="w-3.5 h-3.5" />
                              Failed
                            </span>
                          );

                        return (
                          <tr key={log._id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                              {new Date(log.createdAt).toLocaleString("en-LK", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className={`px-2 py-0.5 text-xs font-semibold rounded-md ${eventBadgeColor}`}>
                                {log.eventType.replace(/_/g, " ")}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-semibold text-slate-900 leading-tight">
                                {log.recipientName || "Valued Customer"}
                              </p>
                              <p className="text-xs font-mono text-slate-500">{log.recipientPhone}</p>
                            </td>
                            <td className="py-3 px-4 max-w-xs truncate text-slate-700 font-mono text-xs">
                              {log.message}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded">
                                {log.provider}
                              </span>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">{statusBadge}</td>
                            <td className="py-3 px-4 text-right font-mono text-xs text-slate-700">
                              Rs. {(log.cost || 0).toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => setSelectedLog(log)}
                                  className="px-2.5 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                                >
                                  View
                                </button>
                                <button
                                  disabled={resendingLogId === log._id}
                                  onClick={() => handleResendLog(log)}
                                  title="Resend this message"
                                  className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors disabled:opacity-50"
                                >
                                  <RotateCw className={`w-3.5 h-3.5 ${resendingLogId === log._id ? "animate-spin text-blue-600" : ""}`} />
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

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="p-4 border-t border-slate-200 flex items-center justify-between text-sm text-slate-500">
                  <span>
                    Showing page {page} of {totalPages} ({totalLogsCount} total messages)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 border border-slate-300 rounded-md disabled:opacity-50 hover:bg-slate-50"
                    >
                      Previous
                    </button>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="px-3 py-1.5 border border-slate-300 rounded-md disabled:opacity-50 hover:bg-slate-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: GATEWAY CONFIGURATION & TEST WIDGET */}
        {activeTab === "settings" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Gateway Setup Column */}
            <div className="lg:col-span-2 space-y-6">
              <form onSubmit={handleSaveSettings} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Sri Lanka SMS Gateway Providers</h2>
                  <p className="text-sm text-slate-500">
                    Select your active telecom SMS gateway and input your developer API credentials.
                  </p>
                </div>

                {/* Gateway Provider Selection Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      id: "NOTIFY_LK",
                      name: "Notify.lk",
                      desc: "Sri Lanka developer SMS API. Supports custom SMS masks & instant top-ups.",
                      badge: "Standard Rest API",
                    },
                    {
                      id: "DIALOG",
                      name: "Dialog Enterprise",
                      desc: "Official Dialog eSMS gateway. High throughput for commercial Sri Lankan enterprises.",
                      badge: "Dialog Axiata",
                    },
                    {
                      id: "MOBITEL",
                      name: "Mobitel m-Spaces",
                      desc: "Sri Lanka Telecom (SLT-Mobitel) bulk messaging & transactional gateway.",
                      badge: "SLT Mobitel",
                    },
                    {
                      id: "SIMULATED",
                      name: "Local Sandbox",
                      desc: "Simulated zero-cost test mode. Dispatches without gateway charges or active SIMs.",
                      badge: "Dev & Demo Mode",
                    },
                  ].map((gw) => (
                    <div
                      key={gw.id}
                      onClick={() => setSettings({ ...settings, provider: gw.id as any })}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        settings.provider === gw.id
                          ? "border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-slate-900">{gw.name}</span>
                        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                          {gw.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{gw.desc}</p>
                    </div>
                  ))}
                </div>

                {/* Sender ID Mask */}
                <div className="space-y-1.5 pt-2">
                  <label className="text-sm font-semibold text-slate-700">Sender ID / Mask Name</label>
                  <input
                    type="text"
                    value={settings.senderId}
                    onChange={(e) => setSettings({ ...settings, senderId: e.target.value.toUpperCase() })}
                    placeholder="e.g. MYSTOREPOS or NOTIFYDEMO"
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none uppercase"
                  />
                  <p className="text-xs text-slate-400">
                    Alphanumeric Sender ID registered with Sri Lanka TRCSL and your provider (max 11 characters).
                  </p>
                </div>

                {/* Conditional Provider Credential Fields */}
                {settings.provider === "NOTIFY_LK" && (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                    <h3 className="text-sm font-bold text-slate-800">Notify.lk Credentials</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-600">User ID</label>
                        <input
                          type="text"
                          value={settings.notifyLk.userId}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              notifyLk: { ...settings.notifyLk, userId: e.target.value },
                            })
                          }
                          placeholder="e.g. 12345"
                          className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600">API Key</label>
                        <input
                          type="password"
                          value={settings.notifyLk.apiKey}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              notifyLk: { ...settings.notifyLk, apiKey: e.target.value },
                            })
                          }
                          placeholder="••••••••••••••••"
                          className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {settings.provider === "DIALOG" && (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                    <h3 className="text-sm font-bold text-slate-800">Dialog Enterprise (eSMS) Credentials</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-600">eSMS Username</label>
                        <input
                          type="text"
                          value={settings.dialog.username}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              dialog: { ...settings.dialog, username: e.target.value },
                            })
                          }
                          placeholder="Dialog account username"
                          className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600">eSMS Password / Auth Key</label>
                        <input
                          type="password"
                          value={settings.dialog.password}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              dialog: { ...settings.dialog, password: e.target.value },
                            })
                          }
                          placeholder="••••••••••••••••"
                          className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {settings.provider === "MOBITEL" && (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                    <h3 className="text-sm font-bold text-slate-800">Mobitel m-Spaces Credentials</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-600">Application ID / Username</label>
                        <input
                          type="text"
                          value={settings.mobitel.username}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              mobitel: { ...settings.mobitel, username: e.target.value },
                            })
                          }
                          placeholder="Mobitel Application ID"
                          className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600">Password</label>
                        <input
                          type="password"
                          value={settings.mobitel.password}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              mobitel: { ...settings.mobitel, password: e.target.value },
                            })
                          }
                          placeholder="••••••••••••••••"
                          className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {settings.provider === "SIMULATED" && (
                  <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-200 flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-blue-800">
                      <p className="font-semibold text-sm text-blue-900">Sandbox Mode Active</p>
                      <p className="mt-0.5">
                        Transactions will generate live logs and audit trails, without triggering external HTTP network calls or depleting telecommunications credit balances. Ideal for testing and live store demonstrations.
                      </p>
                    </div>
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 shadow-sm transition-colors disabled:opacity-50"
                  >
                    {savingSettings ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Save Gateway Configuration
                  </button>
                </div>
              </form>
            </div>

            {/* Test SMS Widget Column */}
            <div className="space-y-6">
              <form onSubmit={handleSendTestSms} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-slate-900 text-base">Send Test SMS</h3>
                </div>
                <p className="text-xs text-slate-500">
                  Verify your active gateway driver ({settings.provider}) and phone normalization with a live test message.
                </p>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Recipient Phone (Sri Lanka)</label>
                  <input
                    type="tel"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="0771234567 or +94771234567"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-400">Accepts 07X..., +947X..., or 947X...</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Test Message</label>
                  <textarea
                    rows={4}
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none text-xs"
                  />
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>{testMessage.length} characters</span>
                    <span>{Math.ceil(testMessage.length / 160) || 1} SMS part(s)</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={sendingTest}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  {sendingTest ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Dispatch Test SMS
                </button>
              </form>

              {/* Supported Sri Lanka Carriers Card */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs text-slate-600">
                <p className="font-semibold text-slate-800">Sri Lankan Mobile Networks Supported:</p>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="font-semibold text-slate-800">Dialog (077 / 076 / 074)</span>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="font-semibold text-slate-800">Mobitel (071 / 070)</span>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="font-semibold text-slate-800">Airtel (075)</span>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="font-semibold text-slate-800">Hutch (078 / 072)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: AUTOMATED TRIGGERS & TEMPLATES */}
        {activeTab === "triggers" && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Transactional Automation Triggers</h2>
                <p className="text-sm text-slate-500">
                  Toggle automated SMS alerts for POS sales events and customize customer messaging templates.
                </p>
              </div>
              <button
                onClick={() => handleSaveSettings()}
                disabled={savingSettings}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 shadow-sm transition-colors self-start md:self-auto disabled:opacity-50"
              >
                {savingSettings ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save All Triggers & Templates
              </button>
            </div>

            {/* Template Variables Helper Bar */}
            <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-blue-900">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="font-semibold">Supported Template Variables:</span>
              </div>
              <div className="flex flex-wrap gap-1 font-mono text-[11px]">
                {["{customerName}", "{amount}", "{balance}", "{storeName}", "{dueDate}", "{ref}", "{code}", "{points}", "{tier}"].map((v) => (
                  <span key={v} className="bg-white px-2 py-0.5 rounded border border-blue-200 text-blue-700">
                    {v}
                  </span>
                ))}
              </div>
            </div>

            {/* Trigger Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Trigger 1: Credit Sale */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
                      <Coins className="w-4 h-4" />
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm">Credit Sale / Naya Potha Alert</h3>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.sendOnCreditSale}
                      onChange={(e) => setSettings({ ...settings, sendOnCreditSale: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <p className="text-xs text-slate-500">
                  Instant SMS to customer when a sale is charged to their credit ledger.
                </p>
                <textarea
                  rows={3}
                  value={settings.templates.creditSale}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      templates: { ...settings.templates, creditSale: e.target.value },
                    })
                  }
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <div className="flex justify-between items-center text-[11px] text-slate-400">
                  <span>{settings.templates.creditSale.length} chars (1 SMS = 160)</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        templates: { ...settings.templates, creditSale: DEFAULT_TEMPLATES.creditSale },
                      })
                    }
                    className="text-blue-600 hover:underline"
                  >
                    Reset default
                  </button>
                </div>
              </div>

              {/* Trigger 2: Credit Settlement */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
                      <CheckCircle2 className="w-4 h-4" />
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm">Credit Debt Repayment Receipt</h3>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.sendOnCreditSettlement}
                      onChange={(e) => setSettings({ ...settings, sendOnCreditSettlement: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <p className="text-xs text-slate-500">
                  Instant receipt SMS acknowledging customer debt repayment and new remaining balance.
                </p>
                <textarea
                  rows={3}
                  value={settings.templates.creditSettlement}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      templates: { ...settings.templates, creditSettlement: e.target.value },
                    })
                  }
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <div className="flex justify-between items-center text-[11px] text-slate-400">
                  <span>{settings.templates.creditSettlement.length} chars</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        templates: { ...settings.templates, creditSettlement: DEFAULT_TEMPLATES.creditSettlement },
                      })
                    }
                    className="text-blue-600 hover:underline"
                  >
                    Reset default
                  </button>
                </div>
              </div>

              {/* Trigger 3: Overdue Reminder */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-red-100 text-red-800 rounded-lg">
                      <AlertTriangle className="w-4 h-4" />
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm">Overdue Debt Reminder</h3>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.sendOnOverdueReminder}
                      onChange={(e) => setSettings({ ...settings, sendOnOverdueReminder: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <p className="text-xs text-slate-500">
                  Reminder dispatched when customer credit balance exceeds grace period or due date.
                </p>
                <textarea
                  rows={3}
                  value={settings.templates.overdueReminder}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      templates: { ...settings.templates, overdueReminder: e.target.value },
                    })
                  }
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <div className="flex justify-between items-center text-[11px] text-slate-400">
                  <span>{settings.templates.overdueReminder.length} chars</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        templates: { ...settings.templates, overdueReminder: DEFAULT_TEMPLATES.overdueReminder },
                      })
                    }
                    className="text-blue-600 hover:underline"
                  >
                    Reset default
                  </button>
                </div>
              </div>

              {/* Trigger 4: Loyalty Accrual */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-purple-100 text-purple-800 rounded-lg">
                      <Sparkles className="w-4 h-4" />
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm">Loyalty Points & Tier Accrual</h3>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.sendOnLoyaltyPoints}
                      onChange={(e) => setSettings({ ...settings, sendOnLoyaltyPoints: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <p className="text-xs text-slate-500">
                  Alert sent when customer earns loyalty points or reaches Silver/Gold/Platinum tiers.
                </p>
                <textarea
                  rows={3}
                  value={settings.templates.loyaltyAccrual}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      templates: { ...settings.templates, loyaltyAccrual: e.target.value },
                    })
                  }
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <div className="flex justify-between items-center text-[11px] text-slate-400">
                  <span>{settings.templates.loyaltyAccrual.length} chars</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        templates: { ...settings.templates, loyaltyAccrual: DEFAULT_TEMPLATES.loyaltyAccrual },
                      })
                    }
                    className="text-blue-600 hover:underline"
                  >
                    Reset default
                  </button>
                </div>
              </div>

              {/* Trigger 5: Gift Voucher Delivery */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-pink-100 text-pink-800 rounded-lg">
                      <Send className="w-4 h-4" />
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm">Gift Voucher Code Delivery</h3>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.sendOnGiftVoucher}
                      onChange={(e) => setSettings({ ...settings, sendOnGiftVoucher: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <p className="text-xs text-slate-500">
                  Dispatches gift voucher code (`GV-...`) and balance to the recipient's phone number.
                </p>
                <textarea
                  rows={3}
                  value={settings.templates.giftVoucher}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      templates: { ...settings.templates, giftVoucher: e.target.value },
                    })
                  }
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <div className="flex justify-between items-center text-[11px] text-slate-400">
                  <span>{settings.templates.giftVoucher.length} chars</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        templates: { ...settings.templates, giftVoucher: DEFAULT_TEMPLATES.giftVoucher },
                      })
                    }
                    className="text-blue-600 hover:underline"
                  >
                    Reset default
                  </button>
                </div>
              </div>

              {/* Trigger 6: Quotation Alert */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-cyan-100 text-cyan-800 rounded-lg">
                      <MessageSquare className="w-4 h-4" />
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm">Commercial Quotation Alert</h3>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.sendOnQuotation}
                      onChange={(e) => setSettings({ ...settings, sendOnQuotation: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <p className="text-xs text-slate-500">
                  SMS notification sent when a commercial quotation (`QT-...`) is generated for a client.
                </p>
                <textarea
                  rows={3}
                  value={settings.templates.quotationAlert}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      templates: { ...settings.templates, quotationAlert: e.target.value },
                    })
                  }
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <div className="flex justify-between items-center text-[11px] text-slate-400">
                  <span>{settings.templates.quotationAlert.length} chars</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        templates: { ...settings.templates, quotationAlert: DEFAULT_TEMPLATES.quotationAlert },
                      })
                    }
                    className="text-blue-600 hover:underline"
                  >
                    Reset default
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: BULK CAMPAIGNS & DEBT COLLECTION */}
        {activeTab === "broadcast" && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Segmented Bulk SMS & Debt Collection</h2>
                <p className="text-sm text-slate-500">
                  Broadcast personalized transactional messages to targeted customer groups in Sri Lanka.
                </p>
              </div>

              {/* Target Segment */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-800">Target Audience Segment</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      id: "OVERDUE_DEBTORS",
                      name: "Overdue Debtors",
                      desc: "Customers with unpaid balances past due date (Collection Alert)",
                    },
                    {
                      id: "ALL_CREDIT_CUSTOMERS",
                      name: "All Credit Customers",
                      desc: "Every customer with a current positive credit balance > Rs. 0",
                    },
                    {
                      id: "VIP_PLATINUM",
                      name: "VIP Platinum Tier",
                      desc: "Top spending customers (Spend >= Rs. 150,000)",
                    },
                    {
                      id: "VIP_GOLD",
                      name: "VIP Gold Tier",
                      desc: "High spending customers (Spend >= Rs. 75,000)",
                    },
                    {
                      id: "VIP_SILVER",
                      name: "Silver Tier",
                      desc: "Regular shoppers (Spend >= Rs. 25,000)",
                    },
                    {
                      id: "ALL_CUSTOMERS",
                      name: "All Registered Customers",
                      desc: "Storewide customer database with Sri Lankan phone numbers",
                    },
                  ].map((seg) => (
                    <div
                      key={seg.id}
                      onClick={() => setBroadcastTarget(seg.id as any)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        broadcastTarget === seg.id
                          ? "border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <p className="text-sm font-bold text-slate-900">{seg.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{seg.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Broadcast Message Composer */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold text-slate-800">Broadcast Message Template</label>
                  <span className="text-xs text-slate-400">
                    {broadcastMessage.length} chars (
                    {Math.ceil(broadcastMessage.length / 160) || 1} SMS part
                    {Math.ceil(broadcastMessage.length / 160) > 1 ? "s" : ""})
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                  <span className="text-slate-500">Insert tag:</span>
                  {["{customerName}", "{balance}", "{storeName}", "{dueDate}"].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setBroadcastMessage((prev) => `${prev} ${tag}`)}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-mono text-[11px]"
                    >
                      +{tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Safety Warning & Cost Preview */}
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 space-y-1">
                  <p className="font-semibold text-sm">Campaign Broadcast Safeguard</p>
                  <p>
                    Messages are personalized for each customer and logged into your delivery audit trail. Ensure your active gateway ({settings.provider}) has sufficient credit balance before sending large broadcasts.
                  </p>
                </div>
              </div>

              <button
                onClick={handleSendBroadcast}
                disabled={sendingBroadcast}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md transition-colors disabled:opacity-50"
              >
                {sendingBroadcast ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
                Launch Segmented SMS Campaign
              </button>
            </div>
          </div>
        )}

        {/* TAB 5: RFM PROMOTIONAL CAMPAIGNS & COUPONS */}
        {activeTab === "campaigns" && (
          <CampaignManager />
        )}

        {/* Modal: View Message Log Details */}
        {selectedLog && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                    <MessageSquare className="w-4 h-4" />
                  </span>
                  <h3 className="font-bold text-slate-900">SMS Delivery Record</h3>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div>
                    <span className="text-slate-500">Recipient:</span>
                    <p className="font-semibold text-slate-800">{selectedLog.recipientName || "Customer"}</p>
                    <p className="font-mono text-slate-600">{selectedLog.recipientPhone}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Status & Cost:</span>
                    <p className="font-semibold text-slate-800">{selectedLog.status}</p>
                    <p className="text-slate-600">Rs. {(selectedLog.cost || 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Gateway Provider:</span>
                    <p className="font-semibold text-slate-800">{selectedLog.provider}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Trigger Event:</span>
                    <p className="font-semibold text-slate-800">{selectedLog.eventType}</p>
                  </div>
                </div>

                <div>
                  <span className="text-xs font-semibold text-slate-600">Dispatched Message Content:</span>
                  <div className="mt-1 p-3 bg-slate-950 text-slate-200 font-mono text-xs rounded-lg leading-relaxed whitespace-pre-wrap">
                    {selectedLog.message}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Length: {selectedLog.message.length} characters (
                    {Math.ceil(selectedLog.message.length / 160) || 1} SMS part
                    {Math.ceil(selectedLog.message.length / 160) > 1 ? "s" : ""})
                  </p>
                </div>

                {selectedLog.gatewayResponse && (
                  <div>
                    <span className="text-xs font-semibold text-slate-600">Gateway Response Payload:</span>
                    <pre className="mt-1 p-2.5 bg-slate-100 text-slate-700 font-mono text-[11px] rounded-lg overflow-x-auto max-h-32">
                      {JSON.stringify(selectedLog.gatewayResponse, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
