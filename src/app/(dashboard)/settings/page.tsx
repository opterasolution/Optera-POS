"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import AppLayout from "@/components/layout/AppLayout";
import {
  Store,
  Receipt,
  Percent,
  Coins,
  Save,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Users,
  UserPlus,
  CreditCard,
  Shield,
  Clock,
  Check,
  RefreshCw,
  Phone,
  Package,
  X,
  Monitor,
  Trash2,
  Plus,
  Building,
  MessageSquare,
  KeyRound,
  Search,
  Download,
  Eye,
  Lock,
  Unlock,
  Sliders,
  Globe,
  ArrowRightLeft,
  TrendingDown,
  Info,
  Scale,
  Cpu,
} from "lucide-react";
import { formatCurrency, isValidSLPhone } from "@/lib/formatters";
import SubscriptionInvoiceReceipt, {
  SubscriptionInvoiceData,
} from "@/components/receipts/SubscriptionInvoiceReceipt";
import {
  SUPPORTED_CURRENCY_PRESETS,
  formatForeignCurrency,
  applyMerchantBuffer,
} from "@/lib/currency";
import { generateScaleBarcode } from "@/lib/hardware/barcode-scale";
import ScaleBarcodeSvg from "@/components/labels/ScaleBarcodeSvg";

interface RegisterItem {
  _id: string;
  registerNumber: string;
  name: string;
  location?: string;
  printerWidth?: "58mm" | "80mm";
  isDefault?: boolean;
  isActive?: boolean;
  salesCount?: number;
  createdAt?: string;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Tab State: profile | staff | registers | subscription | security | audit | currency | hardware
  const [activeTab, setActiveTab] = useState<"profile" | "staff" | "registers" | "subscription" | "security" | "audit" | "currency" | "hardware">("profile");

  // Hardware Weighing Scale & Variable Barcode Settings State
  const [hardwareScaleSettings, setHardwareScaleSettings] = useState({
    weighingScale: {
      enabled: true,
      scaleModel: "CAS_PD_II",
      baudRate: 9600,
      autoTare: true,
      defaultTareWeightGrams: 5,
    },
    variableWeightBarcodes: {
      enabled: true,
      weightPrefixes: ["21", "20", "02"],
      pricePrefixes: ["28", "29"],
      defaultUnit: "kg",
    },
  });
  const [savingHardware, setSavingHardware] = useState(false);
  const [seedingProduce, setSeedingProduce] = useState(false);
  const [testPlu, setTestPlu] = useState("101");
  const [testWeightKg, setTestWeightKg] = useState(1.25);

  // Multi-Currency & Central Bank of Sri Lanka (CBSL) Exchange Engine State
  const [currencySettings, setCurrencySettings] = useState<{
    enabled: boolean;
    baseCurrency: string;
    exchangeBufferPercent: number;
    currencies: Array<{
      code: string;
      symbol: string;
      name: string;
      exchangeRate: number;
      isEnabled: boolean;
      isAutoUpdated?: boolean;
      marginPercent?: number;
      updatedAt?: string | Date;
    }>;
  }>({
    enabled: true,
    baseCurrency: "LKR",
    exchangeBufferPercent: 2,
    currencies: [],
  });
  const [loadingCurrencies, setLoadingCurrencies] = useState(false);
  const [savingCurrencies, setSavingCurrencies] = useState(false);
  const [syncingRates, setSyncingRates] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);

  // Store Subscription Invoices State
  const [storeInvoices, setStoreInvoices] = useState<SubscriptionInvoiceData[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<SubscriptionInvoiceData | null>(null);

  // Registers State
  const [registersList, setRegistersList] = useState<RegisterItem[]>([]);
  const [registersLoading, setRegistersLoading] = useState(false);
  const [registerQuota, setRegisterQuota] = useState({ maxRegisters: 2, totalCount: 1, canAddMore: true });
  const [isAddRegisterOpen, setIsAddRegisterOpen] = useState(false);
  const [newRegister, setNewRegister] = useState({
    name: "",
    registerNumber: "",
    location: "",
    printerWidth: "58mm" as "58mm" | "80mm",
    isDefault: false,
  });
  const [addRegisterLoading, setAddRegisterLoading] = useState(false);
  const [addRegisterError, setAddRegisterError] = useState("");

  // Staff State
  const [staffList, setStaffList] = useState<Array<{
    _id: string;
    name: string;
    username: string;
    role: "OWNER" | "MANAGER" | "SUPERVISOR" | "INVENTORY_CLERK" | "ACCOUNTANT" | "CASHIER";
    phone?: string;
    hasSupervisorPin: boolean;
    isActive: boolean;
    createdAt: string;
  }>>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [newStaff, setNewStaff] = useState({
    name: "",
    username: "",
    password: "",
    role: "CASHIER" as "OWNER" | "MANAGER" | "SUPERVISOR" | "INVENTORY_CLERK" | "ACCOUNTANT" | "CASHIER",
    phone: "",
    supervisorPin: "",
  });
  const [addStaffLoading, setAddStaffLoading] = useState(false);
  const [addStaffError, setAddStaffError] = useState("");

  // Store Security Policy State
  const [securityPolicy, setSecurityPolicy] = useState({
    requireSupervisorForVoid: true,
    requireSupervisorForDiscount: true,
    maxCashierDiscountPercent: 5,
    maxCashierDiscountAmount: 500,
    requireSupervisorForPriceOverride: true,
    requireSupervisorForNoSale: true,
    requireSupervisorForExpenseDelete: true,
  });
  const [savingSecurity, setSavingSecurity] = useState(false);

  // Audit Trail Explorer State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditActionFilter, setAuditActionFilter] = useState("ALL");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditRange, setAuditRange] = useState("all");
  const [selectedAuditLog, setSelectedAuditLog] = useState<any | null>(null);
  const [auditActionsList, setAuditActionsList] = useState<string[]>([]);

  // Subscription State
  const [subscriptionData, setSubscriptionData] = useState<{
    plan: "TRIAL" | "BASIC" | "PROFESSIONAL" | "ENTERPRISE";
    status: "TRIAL" | "ACTIVE" | "EXPIRED" | "SUSPENDED" | "CANCELLED";
    startDate?: string;
    expiryDate?: string;
    maxProducts?: number;
    maxUsers?: number;
    productCount?: number;
  } | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    businessType: "Grocery & Retail",
    ownerName: "",
    phone: "",
    email: "",
    address: "",
    currency: "LKR",
    taxSettings: {
      enabled: false,
      name: "VAT",
      rate: 0,
      type: "INCLUSIVE" as "INCLUSIVE" | "EXCLUSIVE",
      tin: "",
      vatNumber: "",
      ssclEnabled: false,
      ssclRate: 2.5,
      invoiceNotes: "",
    },
    receiptSettings: {
      headerMessage: "Thank you for shopping with us!",
      footerMessage: "Goods returnable within 3 days with receipt. Please come again!",
      showLogo: false,
      defaultWidth: "58mm" as "58mm" | "80mm",
    },
    bankDetails: {
      bankName: "",
      branchName: "",
      accountNumber: "",
      accountName: "",
    },
    notificationSettings: {
      whatsappEnabled: true,
      autoPromptWhatsappReceipt: true,
      defaultReminderTemplate: "",
    },
  });

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/business");
        const data = await res.json();
        if (data.success && data.business) {
          if (data.business.subscription) {
            setSubscriptionData({
              ...data.business.subscription,
              productCount: data.business.productCount || 0,
            });
          }
          setFormData({
            name: data.business.name || "",
            businessType: data.business.businessType || "Grocery & Retail",
            ownerName: data.business.ownerName || "",
            phone: data.business.phone || "",
            email: data.business.email || "",
            address: data.business.address || "",
            currency: data.business.currency || "LKR",
            taxSettings: {
              enabled: data.business.taxSettings?.enabled || false,
              name: data.business.taxSettings?.name || "VAT",
              rate: data.business.taxSettings?.rate || 0,
              type: data.business.taxSettings?.type || "INCLUSIVE",
              tin: data.business.taxSettings?.tin || "",
              vatNumber: data.business.taxSettings?.vatNumber || "",
              ssclEnabled: data.business.taxSettings?.ssclEnabled || false,
              ssclRate: data.business.taxSettings?.ssclRate ?? 2.5,
              invoiceNotes: data.business.taxSettings?.invoiceNotes || "",
            },
            receiptSettings: {
              headerMessage: data.business.receiptSettings?.headerMessage || "Thank you for shopping with us!",
              footerMessage: data.business.receiptSettings?.footerMessage || "Please come again!",
              showLogo: data.business.receiptSettings?.showLogo || false,
              defaultWidth: data.business.receiptSettings?.defaultWidth || "58mm",
            },
            bankDetails: {
              bankName: data.business.bankDetails?.bankName || "",
              branchName: data.business.bankDetails?.branchName || "",
              accountNumber: data.business.bankDetails?.accountNumber || "",
              accountName: data.business.bankDetails?.accountName || "",
            },
            notificationSettings: {
              whatsappEnabled: data.business.notificationSettings?.whatsappEnabled ?? true,
              autoPromptWhatsappReceipt: data.business.notificationSettings?.autoPromptWhatsappReceipt ?? true,
              defaultReminderTemplate: data.business.notificationSettings?.defaultReminderTemplate || "",
            },
          });
          if (data.business.securityPolicy) {
            setSecurityPolicy(data.business.securityPolicy);
          }
        }
      } catch {
        setStatusMessage({ type: "error", text: "Failed to load store settings." });
      } finally {
        setLoading(false);
      }
    }

    async function loadStaff() {
      setStaffLoading(true);
      try {
        const res = await fetch("/api/staff");
        const data = await res.json();
        if (data.success && data.staff) {
          setStaffList(data.staff);
        }
      } catch {
        console.error("Failed to load staff list");
      } finally {
        setStaffLoading(false);
      }
    }

    async function loadInvoices() {
      setInvoicesLoading(true);
      try {
        const res = await fetch("/api/business/invoices");
        const data = await res.json();
        if (data.success && data.invoices) {
          setStoreInvoices(data.invoices);
        }
      } catch {
        console.error("Failed to load store invoices");
      } finally {
        setInvoicesLoading(false);
      }
    }

    async function loadRegisters() {
      setRegistersLoading(true);
      try {
        const res = await fetch("/api/registers");
        const data = await res.json();
        if (data.success && data.registers) {
          setRegistersList(data.registers);
          if (data.quota) setRegisterQuota(data.quota);
        }
      } catch {
        console.error("Failed to load registers list");
      } finally {
        setRegistersLoading(false);
      }
    }

    async function loadCurrencies() {
      setLoadingCurrencies(true);
      try {
        const res = await fetch("/api/currencies");
        const data = await res.json();
        if (data.success && data.currencySettings) {
          setCurrencySettings(data.currencySettings);
          if (data.indicativeRates?.timestamp) {
            setLastSyncedTime(new Date(data.indicativeRates.timestamp).toLocaleTimeString());
          }
        }
      } catch (err) {
        console.error("Failed to load currency settings", err);
      } finally {
        setLoadingCurrencies(false);
      }
    }

    async function loadHardware() {
      try {
        const res = await fetch("/api/hardware/scale/settings");
        const data = await res.json();
        if (data.success) {
          setHardwareScaleSettings({
            weighingScale: data.weighingScale,
            variableWeightBarcodes: data.variableWeightBarcodes,
          });
        }
      } catch (err) {
        console.error("Failed to load hardware settings", err);
      }
    }

    loadSettings();
    loadStaff();
    loadInvoices();
    loadRegisters();
    loadCurrencies();
    loadHardware();
  }, []);

  const handleSaveHardwareSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingHardware(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/hardware/scale/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hardwareScaleSettings),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: "success",
          text: "Digital scale & barcode hardware settings saved successfully!",
        });
      } else {
        setStatusMessage({ type: "error", text: data.error || "Failed to save scale settings." });
      }
    } catch {
      setStatusMessage({ type: "error", text: "Network error saving scale settings." });
    } finally {
      setSavingHardware(false);
    }
  };

  const handleSeedProduceCatalog = async () => {
    setSeedingProduce(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/hardware/scale/seed-produce", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: "success",
          text: data.message || "Produce catalog seeded with PLU 101-109 items!",
        });
      } else {
        setStatusMessage({ type: "error", text: data.error || "Failed to seed produce items." });
      }
    } catch {
      setStatusMessage({ type: "error", text: "Network error seeding produce items." });
    } finally {
      setSeedingProduce(false);
    }
  };

  const handleSyncRates = async () => {
    setSyncingRates(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/currencies/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bufferPercent: currencySettings.exchangeBufferPercent ?? 2,
          applyToSettings: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCurrencySettings(data.currencySettings);
        setLastSyncedTime(new Date().toLocaleTimeString());
        setStatusMessage({
          type: "success",
          text: `Successfully synced exchange rates with ${data.source || "CBSL indicative benchmarks"}. Effective rates updated with ${currencySettings.exchangeBufferPercent}% buffer margin.`,
        });
      } else {
        setStatusMessage({ type: "error", text: data.error || "Failed to sync exchange rates." });
      }
    } catch {
      setStatusMessage({ type: "error", text: "Network error communicating with currency rates service." });
    } finally {
      setSyncingRates(false);
    }
  };

  const handleSaveCurrencies = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingCurrencies(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/currencies", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currencySettings),
      });
      const data = await res.json();
      if (data.success) {
        setCurrencySettings(data.currencySettings);
        setStatusMessage({
          type: "success",
          text: "Multi-currency settings and counter exchange rates updated successfully.",
        });
      } else {
        setStatusMessage({ type: "error", text: data.error || "Failed to save currency settings." });
      }
    } catch {
      setStatusMessage({ type: "error", text: "Network error saving currency settings." });
    } finally {
      setSavingCurrencies(false);
    }
  };

  const handleToggleCurrency = (code: string) => {
    setCurrencySettings((prev) => {
      const existing = prev.currencies.find((c) => c.code === code);
      let updatedCurrencies;
      if (existing) {
        updatedCurrencies = prev.currencies.map((c) =>
          c.code === code ? { ...c, isEnabled: !c.isEnabled } : c
        );
      } else {
        const preset = SUPPORTED_CURRENCY_PRESETS.find((p) => p.code === code);
        if (!preset) return prev;
        const rate = applyMerchantBuffer(preset.defaultRate, prev.exchangeBufferPercent);
        updatedCurrencies = [
          ...prev.currencies,
          {
            code: preset.code,
            symbol: preset.symbol,
            name: preset.name,
            exchangeRate: rate,
            isEnabled: true,
            isAutoUpdated: true,
          },
        ];
      }
      return { ...prev, currencies: updatedCurrencies };
    });
  };

  const handleRateChange = (code: string, newRate: number) => {
    setCurrencySettings((prev) => ({
      ...prev,
      currencies: prev.currencies.map((c) =>
        c.code === code ? { ...c, exchangeRate: newRate, isAutoUpdated: false } : c
      ),
    }));
  };

  const handleBufferChange = (bufferPercent: number) => {
    setCurrencySettings((prev) => ({
      ...prev,
      exchangeBufferPercent: bufferPercent,
    }));
  };

  const loadAuditLogs = async (action = auditActionFilter, search = auditSearch, range = auditRange) => {
    setAuditLoading(true);
    try {
      const params = new URLSearchParams();
      if (action && action !== "ALL") params.append("action", action);
      if (search.trim()) params.append("search", search.trim());
      if (range && range !== "all") params.append("range", range);

      const res = await fetch(`/api/audit?${params.toString()}`);
      const data = await res.json();
      if (data.success && data.logs) {
        setAuditLogs(data.logs);
        if (data.actionsList) setAuditActionsList(data.actionsList);
      }
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleSaveSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSecurity(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/business", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          securityPolicy,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: "success", text: "Security policy & action gates updated successfully." });
      } else {
        setStatusMessage({ type: "error", text: data.error || "Failed to update security policy." });
      }
    } catch (err) {
      setStatusMessage({ type: "error", text: "Network error saving security policy." });
    } finally {
      setSavingSecurity(false);
    }
  };

  const exportAuditToCsv = () => {
    if (!auditLogs.length) return;
    const rows = [
      ["Timestamp", "Action", "Performed By", "Supervisor Authorizer", "Entity Type", "Reason / Details"],
      ...auditLogs.map((l: any) => [
        new Date(l.createdAt).toLocaleString("en-LK"),
        l.action,
        l.userName,
        l.details?.supervisorName || "-",
        l.entityType,
        JSON.stringify(l.details || {}),
      ]),
    ];
    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.map(x => `"${(x + '').replace(/"/g, '""')}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Audit_Trail_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddRegisterLoading(true);
    setAddRegisterError("");

    try {
      const res = await fetch("/api/registers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRegister),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setAddRegisterError(data.error || "Failed to create register");
        setAddRegisterLoading(false);
        return;
      }

      setIsAddRegisterOpen(false);
      setNewRegister({
        name: "",
        registerNumber: "",
        location: "",
        printerWidth: "58mm",
        isDefault: false,
      });

      // Refresh registers
      const regRes = await fetch("/api/registers");
      const regJson = await regRes.json();
      if (regJson.success) {
        setRegistersList(regJson.registers);
        if (regJson.quota) setRegisterQuota(regJson.quota);
      }

      setStatusMessage({
        type: "success",
        text: `Counter "${data.register?.name || newRegister.name}" created successfully!`,
      });
    } catch {
      setAddRegisterError("Network error creating checkout counter.");
    } finally {
      setAddRegisterLoading(false);
    }
  };

  const handleDeleteRegister = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove or deactivate counter "${name}"?`)) return;
    try {
      const res = await fetch(`/api/registers/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: "success", text: data.message });
        const regRes = await fetch("/api/registers");
        const regJson = await regRes.json();
        if (regJson.success) {
          setRegistersList(regJson.registers);
          if (regJson.quota) setRegisterQuota(regJson.quota);
        }
      } else {
        setStatusMessage({ type: "error", text: data.error || "Failed to remove register" });
      }
    } catch {
      setStatusMessage({ type: "error", text: "Network error removing register." });
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddStaffLoading(true);
    setAddStaffError("");

    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newStaff),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setAddStaffError(data.error || "Failed to create staff member");
        setAddStaffLoading(false);
        return;
      }

      setIsAddStaffOpen(false);
      setNewStaff({
        name: "",
        username: "",
        password: "",
        role: "CASHIER",
        phone: "",
        supervisorPin: "",
      });
      // Refresh staff list
      const staffRes = await fetch("/api/staff");
      const staffJson = await staffRes.json();
      if (staffJson.success) setStaffList(staffJson.staff);

      setStatusMessage({
        type: "success",
        text: `Staff member "${data.user?.name || newStaff.name}" created successfully!`,
      });
    } catch {
      setAddStaffError("Network error creating staff member.");
    } finally {
      setAddStaffLoading(false);
    }
  };

  const isPhoneValid = !formData.phone || isValidSLPhone(formData.phone);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPhoneValid) {
      setStatusMessage({ type: "error", text: "Please enter a valid Sri Lankan phone number." });
      return;
    }

    setSaving(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/business", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (data.success) {
        setStatusMessage({ type: "success", text: "Store settings updated successfully!" });
      } else {
        setStatusMessage({ type: "error", text: data.error || "Failed to update settings." });
      }
    } catch {
      setStatusMessage({ type: "error", text: "Network error saving settings." });
    } finally {
      setSaving(false);
    }
  };

  if (session?.user?.role === "CASHIER") {
    return (
      <AppLayout>
        <div className="p-8 max-w-lg mx-auto text-center mt-12">
          <div className="inline-flex p-4 rounded-full bg-amber-100 text-amber-600 mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Access Restricted</h2>
          <p className="text-sm text-slate-600 mb-6">
            Store configuration and tax settings are only accessible by the Store Owner.
          </p>
          <a
            href="/pos"
            className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700"
          >
            Return to POS Counter
          </a>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-5xl mx-auto">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Store Settings</h1>
            <p className="text-xs text-slate-500 mt-1">
              Configure store identity, Sri Lankan tax rules, staff accounts, and license limits.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === "profile" && (
              <button
                onClick={handleSubmit}
                disabled={saving || loading}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm disabled:opacity-50"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Save Settings
                  </>
                )}
              </button>
            )}

            {activeTab === "staff" && (
              <button
                onClick={() => setIsAddStaffOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
              >
                <UserPlus className="w-4 h-4" /> Add Staff Member
              </button>
            )}

            {activeTab === "registers" && (
              <button
                onClick={() => {
                  if (!registerQuota.canAddMore) {
                    alert(`Plan Quota Reached: Your current plan allows ${registerQuota.maxRegisters} counter(s). Please upgrade to add more.`);
                    return;
                  }
                  setIsAddRegisterOpen(true);
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
              >
                <Monitor className="w-4 h-4" /> Add Register / Counter
              </button>
            )}

            {activeTab === "security" && (
              <button
                onClick={handleSaveSecurity}
                disabled={savingSecurity}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm disabled:opacity-50"
              >
                {savingSecurity ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Save Security Policy
                  </>
                )}
              </button>
            )}

            {activeTab === "audit" && (
              <button
                onClick={exportAuditToCsv}
                disabled={auditLogs.length === 0}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-semibold transition-all shadow-sm disabled:opacity-50"
              >
                <Download className="w-4 h-4" /> Export CSV
              </button>
            )}

            {activeTab === "currency" && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSyncRates}
                  disabled={syncingRates}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition-all shadow-sm disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingRates ? "animate-spin" : ""}`} />
                  <span>{syncingRates ? "Syncing CBSL..." : "Sync CBSL Rates"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveCurrencies}
                  disabled={savingCurrencies}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm disabled:opacity-50"
                >
                  {savingCurrencies ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4" /> Save FX Rates
                    </>
                  )}
                </button>
              </div>
            )}

            {activeTab === "subscription" && (
              <a
                href="tel:0771234567"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
              >
                <Phone className="w-3.5 h-3.5 text-blue-400" /> Platform Support
              </a>
            )}

            {activeTab === "hardware" && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSeedProduceCatalog}
                  disabled={seedingProduce}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all shadow-sm disabled:opacity-50"
                >
                  {seedingProduce ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-500" />
                  ) : (
                    <Package className="w-4 h-4 text-emerald-600" />
                  )}
                  <span>Seed Produce Items</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveHardwareSettings}
                  disabled={savingHardware}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm disabled:opacity-50"
                >
                  {savingHardware ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4" /> Save Scale Settings
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 mb-6 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "profile"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Store className="w-4 h-4" /> Store & Tax Profile
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("currency")}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "currency"
                ? "border-emerald-600 text-emerald-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Globe className="w-4 h-4" /> Multi-Currency & FX Rates
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("hardware")}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "hardware"
                ? "border-emerald-600 text-emerald-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Scale className="w-4 h-4" /> Scales & Barcodes
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("staff")}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "staff"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Users className="w-4 h-4" /> Staff & Cashiers ({staffList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("security")}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "security"
                ? "border-amber-600 text-amber-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <ShieldAlert className="w-4 h-4" /> Security & Action Gates
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("audit");
              loadAuditLogs();
            }}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "audit"
                ? "border-purple-600 text-purple-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Clock className="w-4 h-4" /> Audit Trail Explorer
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("registers")}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "registers"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Monitor className="w-4 h-4" /> Registers & Terminals ({registersList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("subscription")}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "subscription"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <CreditCard className="w-4 h-4" /> Subscription & License
          </button>
        </div>

        {statusMessage && (
          <div
            className={`mb-6 p-4 rounded-xl text-xs flex items-center gap-3 ${
              statusMessage.type === "success"
                ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                : "bg-rose-50 border border-rose-200 text-rose-800"
            }`}
          >
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{statusMessage.text}</span>
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading settings...</div>
        ) : (
          <>
            {activeTab === "profile" && (
              <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Columns: Settings Forms */}
              <div className="lg:col-span-2 space-y-6">
                {/* 1. Store Profile */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-slate-100 font-semibold text-slate-900 text-sm">
                    <Store className="w-4 h-4 text-blue-600" /> Store Profile
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Business / Store Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. Kandy Super Grocers"
                        className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Business Category
                      </label>
                      <select
                        value={formData.businessType}
                        onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="Grocery & Retail">Grocery & Retail</option>
                        <option value="Mini Supermarket">Mini Supermarket</option>
                        <option value="Clothing & Textile">Clothing & Textile</option>
                        <option value="Mobile & Electronics">Mobile & Electronics</option>
                        <option value="Hardware & Tools">Hardware & Tools</option>
                        <option value="Stationery & Books">Stationery & Books</option>
                        <option value="Cosmetics & Care">Cosmetics & Care</option>
                        <option value="Bakery & Cafe">Bakery & Cafe</option>
                        <option value="Other Retail">Other Retail</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Owner / Contact Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.ownerName}
                        onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                        placeholder="e.g. Sunil Perera"
                        className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Sri Lankan Phone Number *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="0771234567 or +94771234567"
                        className={`w-full px-3.5 py-2 text-sm border rounded-xl focus:ring-2 focus:outline-none ${
                          !isPhoneValid
                            ? "border-rose-300 focus:ring-rose-500 bg-rose-50/30"
                            : "border-slate-200 focus:ring-blue-500"
                        }`}
                      />
                      {!isPhoneValid && (
                        <p className="text-[11px] text-rose-500 mt-1">
                          Format: 07XXXXXXXX or +947XXXXXXXX
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Email Address (Optional)
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="shop@example.lk"
                        className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Shop Address (Printed on Receipts)
                      </label>
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        placeholder="e.g. No. 45, Peradeniya Road, Kandy"
                        className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Tax Settings */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2.5 font-semibold text-slate-900 text-sm">
                      <Percent className="w-4 h-4 text-blue-600" /> Sri Lankan Tax Engine
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.taxSettings.enabled}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            taxSettings: { ...formData.taxSettings, enabled: e.target.checked },
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      <span className="ml-2 text-xs font-medium text-slate-700">
                        {formData.taxSettings.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </label>
                  </div>

                  {formData.taxSettings.enabled ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Tax Name
                          </label>
                          <input
                            type="text"
                            value={formData.taxSettings.name}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                taxSettings: { ...formData.taxSettings, name: e.target.value },
                              })
                            }
                            placeholder="e.g. VAT"
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            VAT Percentage (%)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={formData.taxSettings.rate}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                taxSettings: {
                                  ...formData.taxSettings,
                                  rate: parseFloat(e.target.value) || 0,
                                },
                              })
                            }
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                          <p className="text-[10px] text-slate-400 mt-1">Standard Sri Lanka VAT is 18%</p>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Price Calculation
                          </label>
                          <select
                            value={formData.taxSettings.type}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                taxSettings: {
                                  ...formData.taxSettings,
                                  type: e.target.value as "INCLUSIVE" | "EXCLUSIVE",
                                },
                              })
                            }
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          >
                            <option value="INCLUSIVE">Tax Inclusive (Included in Price)</option>
                            <option value="EXCLUSIVE">Tax Exclusive (Added at Checkout)</option>
                          </select>
                        </div>
                      </div>

                      {/* Sri Lanka IRD Tax Identification Numbers */}
                      <div className="pt-4 border-t border-slate-100">
                        <div className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Percent className="w-3.5 h-3.5 text-blue-600" />
                          Sri Lanka IRD RAMIS & Tax Invoice Credentials
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                              Seller TIN (Taxpayer Identification Number) *
                            </label>
                            <input
                              type="text"
                              value={formData.taxSettings.tin}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  taxSettings: { ...formData.taxSettings, tin: e.target.value },
                                })
                              }
                              placeholder="e.g. 102938475"
                              className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Printed on all official IRD tax invoices</p>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                              VAT Registration Number
                            </label>
                            <input
                              type="text"
                              value={formData.taxSettings.vatNumber}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  taxSettings: { ...formData.taxSettings, vatNumber: e.target.value },
                                })
                              }
                              placeholder="e.g. 102938475-7000"
                              className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Required for B2B input tax claim</p>
                          </div>
                        </div>
                      </div>

                      {/* Social Security Contribution Levy (SSCL) */}
                      <div className="pt-4 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <div className="text-xs font-semibold text-slate-800">
                              Social Security Contribution Levy (SSCL)
                            </div>
                            <p className="text-[11px] text-slate-500">
                              Levied at 2.5% under Social Security Contribution Levy Act, No. 25 of 2022
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.taxSettings.ssclEnabled}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  taxSettings: { ...formData.taxSettings, ssclEnabled: e.target.checked },
                                })
                              }
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                            <span className="ml-2 text-xs font-medium text-slate-700">
                              {formData.taxSettings.ssclEnabled ? "Active (2.5%)" : "Disabled"}
                            </span>
                          </label>
                        </div>
                        {formData.taxSettings.ssclEnabled && (
                          <div className="w-48">
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                              SSCL Rate (%)
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="10"
                              value={formData.taxSettings.ssclRate}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  taxSettings: {
                                    ...formData.taxSettings,
                                    ssclRate: parseFloat(e.target.value) || 2.5,
                                  },
                                })
                              }
                              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                          </div>
                        )}
                      </div>

                      {/* Default Invoice & Quotation Bank / Payment Instructions */}
                      <div className="pt-4 border-t border-slate-100">
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Default B2B Invoice & Quotation Terms / Payment Notes
                        </label>
                        <textarea
                          rows={2}
                          value={formData.taxSettings.invoiceNotes}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              taxSettings: { ...formData.taxSettings, invoiceNotes: e.target.value },
                            })
                          }
                          placeholder="e.g. Please make cheque or transfer payable to store account. Credit period 30 days."
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Appears at the footer of official A4 Tax Invoices and Quotations</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl">
                      Tax calculation is currently turned off. Sales will be recorded without tax. Ideal for small retail businesses under the VAT/SSCL registration threshold.
                    </p>
                  )}
                </div>

                {/* 3. Thermal Receipt Customizer */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-slate-100 font-semibold text-slate-900 text-sm">
                    <Receipt className="w-4 h-4 text-blue-600" /> Thermal Receipt Settings
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Receipt Roll Width
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <label
                          className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer text-xs ${
                            formData.receiptSettings.defaultWidth === "58mm"
                              ? "border-blue-500 bg-blue-50/50 text-blue-900 font-semibold"
                              : "border-slate-200 text-slate-700"
                          }`}
                        >
                          <span>58mm (Small Compact Roll)</span>
                          <input
                            type="radio"
                            name="receiptWidth"
                            value="58mm"
                            checked={formData.receiptSettings.defaultWidth === "58mm"}
                            onChange={() =>
                              setFormData({
                                ...formData,
                                receiptSettings: {
                                  ...formData.receiptSettings,
                                  defaultWidth: "58mm",
                                },
                              })
                            }
                            className="text-blue-600"
                          />
                        </label>

                        <label
                          className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer text-xs ${
                            formData.receiptSettings.defaultWidth === "80mm"
                              ? "border-blue-500 bg-blue-50/50 text-blue-900 font-semibold"
                              : "border-slate-200 text-slate-700"
                          }`}
                        >
                          <span>80mm (Supermarket Standard)</span>
                          <input
                            type="radio"
                            name="receiptWidth"
                            value="80mm"
                            checked={formData.receiptSettings.defaultWidth === "80mm"}
                            onChange={() =>
                              setFormData({
                                ...formData,
                                receiptSettings: {
                                  ...formData.receiptSettings,
                                  defaultWidth: "80mm",
                                },
                              })
                            }
                            className="text-blue-600"
                          />
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Header Message
                      </label>
                      <input
                        type="text"
                        value={formData.receiptSettings.headerMessage}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            receiptSettings: {
                              ...formData.receiptSettings,
                              headerMessage: e.target.value,
                            },
                          })
                        }
                        placeholder="Thank you for shopping with us!"
                        className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Footer Notice / Return Policy
                      </label>
                      <input
                        type="text"
                        value={formData.receiptSettings.footerMessage}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            receiptSettings: {
                              ...formData.receiptSettings,
                              footerMessage: e.target.value,
                            },
                          })
                        }
                        placeholder="Goods returnable within 3 days with receipt."
                        className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Store Bank Account & WhatsApp Digital Communications */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-slate-100 font-semibold text-slate-900 text-sm">
                    <Building className="w-4 h-4 text-emerald-600" /> Bank Details & WhatsApp Notifications
                  </div>

                  <div className="space-y-4">
                    {/* Bank Section Header */}
                    <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl text-xs text-emerald-900 space-y-1">
                      <span className="font-bold flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-emerald-600" /> Store Bank Account for Debt Settlements
                      </span>
                      <p className="text-[11px] text-emerald-700 leading-relaxed">
                        These bank deposit details are automatically attached to WhatsApp reminders sent to &quot;Naya Potha&quot; credit customers and printed on vendor settlement vouchers.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Bank Name
                        </label>
                        <input
                          type="text"
                          value={formData.bankDetails.bankName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              bankDetails: { ...formData.bankDetails, bankName: e.target.value },
                            })
                          }
                          placeholder="e.g. Commercial Bank / BOC / Sampath"
                          className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Branch Name
                        </label>
                        <input
                          type="text"
                          value={formData.bankDetails.branchName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              bankDetails: { ...formData.bankDetails, branchName: e.target.value },
                            })
                          }
                          placeholder="e.g. Peradeniya Branch / Kandy City"
                          className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Account Number
                        </label>
                        <input
                          type="text"
                          value={formData.bankDetails.accountNumber}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              bankDetails: { ...formData.bankDetails, accountNumber: e.target.value },
                            })
                          }
                          placeholder="e.g. 1002345678"
                          className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Account Holder Name
                        </label>
                        <input
                          type="text"
                          value={formData.bankDetails.accountName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              bankDetails: { ...formData.bankDetails, accountName: e.target.value },
                            })
                          }
                          placeholder="e.g. Kandy Super Grocers"
                          className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* WhatsApp Digital Notifications Section */}
                    <div className="pt-3 border-t border-slate-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" /> Prompt WhatsApp Receipt on POS Checkout
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Display a 1-click WhatsApp dispatch button immediately when completing a sale at the counter.
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={formData.notificationSettings.autoPromptWhatsappReceipt}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                notificationSettings: {
                                  ...formData.notificationSettings,
                                  autoPromptWhatsappReceipt: e.target.checked,
                                },
                              })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Custom Debt Reminder Opening / Note (Optional)
                        </label>
                        <input
                          type="text"
                          value={formData.notificationSettings.defaultReminderTemplate}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              notificationSettings: {
                                ...formData.notificationSettings,
                                defaultReminderTemplate: e.target.value,
                              },
                            })
                          }
                          placeholder="e.g. Kindly arrange settlement at your earliest convenience."
                          className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right 1 Column: Live Receipt Preview */}
              <div className="space-y-6">
                {/* Currency Card */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <div className="flex items-center gap-2 font-semibold text-slate-900 text-xs mb-3">
                    <Coins className="w-4 h-4 text-emerald-600" /> Currency Standard
                  </div>
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-100">
                    <div className="text-[11px] text-emerald-700 font-medium">Default Currency</div>
                    <div className="text-xl font-extrabold text-emerald-900 mt-0.5">
                      {formatCurrency(1250)}
                    </div>
                    <p className="text-[10px] text-emerald-600 mt-1">
                      Sri Lankan Rupees (LKR) formatted with standard two-decimal precision.
                    </p>
                  </div>
                </div>

                {/* Thermal Preview Card */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <div className="text-xs font-semibold text-slate-900 mb-3 flex items-center justify-between">
                    <span>Receipt Preview</span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                      {formData.receiptSettings.defaultWidth}
                    </span>
                  </div>

                  <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl font-mono text-[11px] text-slate-800 space-y-2 shadow-inner">
                    <div className="text-center font-bold text-xs uppercase">
                      {formData.name || "YOUR STORE NAME"}
                    </div>
                    <div className="text-center text-[10px] text-slate-600">
                      {formData.address || "Shop Address Line"}
                      <br />
                      Tel: {formData.phone || "07XXXXXXXX"}
                    </div>
                    <div className="text-center text-[10px] text-slate-500 italic">
                      {formData.receiptSettings.headerMessage}
                    </div>

                    <div className="border-t border-dashed border-slate-300 pt-1.5 space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span>INV-2026-0001</span>
                        <span>06/09/2026</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span>Cashier: Admin</span>
                        <span>Cash</span>
                      </div>
                    </div>

                    <div className="border-t border-slate-300 pt-1.5 space-y-1">
                      <div className="flex justify-between">
                        <span>Munchee Super Cream Cracker</span>
                        <span>Rs. 320.00</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 pl-2">
                        <span>1 x Rs. 320.00</span>
                      </div>

                      <div className="flex justify-between">
                        <span>Kotmale Fresh Milk 1L</span>
                        <span>Rs. 580.00</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 pl-2">
                        <span>1 x Rs. 580.00</span>
                      </div>
                    </div>

                    <div className="border-t border-dashed border-slate-300 pt-1.5 space-y-0.5 text-right font-medium">
                      <div className="flex justify-between text-slate-600">
                        <span>Subtotal:</span>
                        <span>Rs. 900.00</span>
                      </div>
                      {formData.taxSettings.enabled && (
                        <div className="flex justify-between text-slate-600 text-[10px]">
                          <span>
                            {formData.taxSettings.name} ({formData.taxSettings.rate}%):
                          </span>
                          <span>
                            Rs. {((900 * formData.taxSettings.rate) / 100).toFixed(2)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-xs font-bold text-slate-900 pt-1 border-t border-slate-200">
                        <span>TOTAL:</span>
                        <span>
                          Rs.{" "}
                          {(
                            900 +
                            (formData.taxSettings.enabled && formData.taxSettings.type === "EXCLUSIVE"
                              ? (900 * formData.taxSettings.rate) / 100
                              : 0)
                          ).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-600">
                        <span>Cash Tendered:</span>
                        <span>Rs. 1,000.00</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-bold text-emerald-700">
                        <span>Change Due:</span>
                        <span>
                          Rs.{" "}
                          {(
                            1000 -
                            (900 +
                              (formData.taxSettings.enabled && formData.taxSettings.type === "EXCLUSIVE"
                                ? (900 * formData.taxSettings.rate) / 100
                                : 0))
                          ).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-dashed border-slate-300 pt-2 text-center text-[10px] text-slate-500">
                      {formData.receiptSettings.footerMessage}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>
        )}

        {/* 2. Staff & Cashiers Tab */}
        {activeTab === "staff" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Staff & Cashier Directory</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Manage store employees, login IDs, and counter checkout permissions.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddStaffOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
                >
                  <UserPlus className="w-4 h-4" /> Add Staff Member
                </button>
              </div>

              {staffLoading ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-blue-500 mb-2" />
                  Loading store staff members...
                </div>
              ) : staffList.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  No staff members registered yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                        <th className="py-3 px-4">Staff Member</th>
                        <th className="py-3 px-4">Login Username</th>
                        <th className="py-3 px-4">Role & Access</th>
                        <th className="py-3 px-4">Supervisor PIN</th>
                        <th className="py-3 px-4">Contact Phone</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Joined Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {staffList.map((member) => (
                        <tr key={member._id} className="hover:bg-slate-50/60 transition">
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {member.name}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600">
                            @{member.username}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                member.role === "OWNER"
                                  ? "bg-purple-100 text-purple-800 border border-purple-200"
                                  : member.role === "MANAGER"
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                  : member.role === "SUPERVISOR"
                                  ? "bg-blue-100 text-blue-800 border border-blue-200"
                                  : member.role === "INVENTORY_CLERK"
                                  ? "bg-cyan-100 text-cyan-800 border border-cyan-200"
                                  : member.role === "ACCOUNTANT"
                                  ? "bg-indigo-100 text-indigo-800 border border-indigo-200"
                                  : "bg-amber-100 text-amber-800 border border-amber-200"
                              }`}
                            >
                              <Shield className="w-2.5 h-2.5" />
                              {member.role.replace("_", " ")}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {["OWNER", "MANAGER", "SUPERVISOR"].includes(member.role) ? (
                              member.hasSupervisorPin ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                  <KeyRound className="w-3 h-3 text-emerald-600" />
                                  PIN Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                                  <AlertCircle className="w-3 h-3 text-amber-600" />
                                  No PIN Set
                                </span>
                              )
                            ) : (
                              <span className="text-slate-400 text-[11px] font-mono">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600">
                            {member.phone || "—"}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              Active
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500">
                            {new Date(member.createdAt).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
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

        {/* 3. Registers & Terminals Tab */}
        {activeTab === "registers" && (
          <div className="space-y-6">
            {/* Quota & Capacity Banner */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                  <Monitor className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    SaaS Terminal Quota: {registerQuota.totalCount} / {registerQuota.maxRegisters} Active
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Your store subscription allows up to {registerQuota.maxRegisters} physical checkout counter(s) or billing devices.
                  </p>
                </div>
              </div>

              {!registerQuota.canAddMore ? (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Terminal Limit Reached</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddRegisterOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition shrink-0"
                >
                  <Plus className="w-4 h-4" /> Add Register / Counter
                </button>
              )}
            </div>

            {/* Main Registers Directory Table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Physical Registers & Billing Terminals</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configure hardware terminals, assign default counters, and set individual receipt roll widths.
                  </p>
                </div>
              </div>

              {registersLoading ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-blue-500 mb-2" />
                  Loading store checkout counters...
                </div>
              ) : registersList.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  No checkout counters found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                        <th className="py-3 px-4">Register ID</th>
                        <th className="py-3 px-4">Counter Name</th>
                        <th className="py-3 px-4">Location / Zone</th>
                        <th className="py-3 px-4">Thermal Printer</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Transactions</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {registersList.map((reg) => (
                        <tr key={reg._id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                            {reg.registerNumber}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                              {reg.name}
                              {reg.isDefault && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                  Default
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            {reg.location || "Main Sales Floor"}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-600">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold border border-slate-200">
                              {reg.printerWidth || "58mm"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {reg.isActive !== false ? (
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                                <span className="w-2 h-2 rounded-full bg-slate-300" />
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-slate-600">
                            {reg.salesCount ?? "—"}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {reg.isDefault && registersList.length === 1 ? (
                              <span className="text-[10px] text-slate-400 italic">Primary Counter</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleDeleteRegister(reg._id, reg.name)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                title={reg.salesCount && reg.salesCount > 0 ? "Deactivate counter (preserves past sales)" : "Delete counter"}
                              >
                                <Trash2 className="w-4 h-4" />
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

            {/* Sri Lanka Multi-Terminal Guide Callout */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-xs text-slate-600 space-y-2">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <Store className="w-4 h-4 text-blue-600" /> How Multi-Counter Deployment Works
              </div>
              <p className="leading-relaxed">
                Log into this POS dashboard on each physical counter's PC, laptop, or Android tablet. Use the counter selector in the top bar to set that device's active station (e.g. <strong>Counter 01</strong> for Main Checkout and <strong>Counter 02</strong> for Express Lane). All transactions, stock decrements, and thermal receipts will be permanently isolated and attributed to that terminal.
              </p>
            </div>
          </div>
        )}

        {/* 4. Subscription & License Tab */}
        {activeTab === "subscription" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Plan & Status Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="text-xs font-semibold text-slate-500">Subscription Plan</span>
                  <span
                    className={`px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                      subscriptionData?.plan === "ENTERPRISE"
                        ? "bg-purple-100 text-purple-800 border border-purple-200"
                        : subscriptionData?.plan === "PROFESSIONAL"
                        ? "bg-indigo-100 text-indigo-800 border border-indigo-200"
                        : subscriptionData?.plan === "BASIC"
                        ? "bg-blue-100 text-blue-800 border border-blue-200"
                        : "bg-amber-100 text-amber-800 border border-amber-200"
                    }`}
                  >
                    {subscriptionData?.plan || "BASIC"}
                  </span>
                </div>

                <div>
                  <div className="text-xs text-slate-500">License Status</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        subscriptionData?.status === "ACTIVE"
                          ? "bg-emerald-100 text-emerald-800"
                          : subscriptionData?.status === "TRIAL"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {subscriptionData?.status || "ACTIVE"}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500">License Expiry Date</div>
                  <div className="text-sm font-bold text-slate-900 font-mono mt-0.5">
                    {subscriptionData?.expiryDate
                      ? new Date(subscriptionData.expiryDate).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "Lifetime License"}
                  </div>
                  {subscriptionData?.expiryDate && (
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {Math.ceil(
                        (new Date(subscriptionData.expiryDate).getTime() - Date.now()) /
                          (1000 * 60 * 60 * 24)
                      )}{" "}
                      days remaining
                    </div>
                  )}
                </div>
              </div>

              {/* Quota & Capacity Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="text-xs font-semibold text-slate-500">Store Capacity</span>
                  <Package className="w-4 h-4 text-slate-400" />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-700 mb-1">
                    <span>Product Catalog Usage</span>
                    <span className="font-bold">
                      {subscriptionData?.productCount || 0} /{" "}
                      {subscriptionData?.maxProducts || 1000}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          (((subscriptionData?.productCount || 0) /
                            (subscriptionData?.maxProducts || 1000)) *
                            100)
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-700 mb-1">
                    <span>Staff Accounts</span>
                    <span className="font-bold">
                      {staffList.length} / {subscriptionData?.maxUsers || 5}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          ((staffList.length / (subscriptionData?.maxUsers || 5)) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-700 mb-1">
                    <span>Checkout Terminals</span>
                    <span className="font-bold">
                      {registerQuota.totalCount} / {registerQuota.maxRegisters}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          ((registerQuota.totalCount / (registerQuota.maxRegisters || 1)) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="pt-2 text-[11px] text-slate-500">
                  Unlimited transactions & thermal invoice receipts.
                </div>
              </div>

              {/* Platform Billing & Support Hotline */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] font-bold uppercase tracking-wider mb-3">
                    Sri Lanka POS Cloud
                  </div>
                  <h4 className="text-sm font-bold text-white">Need to Upgrade or Extend?</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Contact your dedicated POS SaaS platform representative to renew your license, order thermal paper rolls, or upgrade plan capacity.
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <a
                    href="tel:0771234567"
                    className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Hotline: 077 123 4567</span>
                  </a>
                  <p className="text-[10px] text-slate-400 text-center">
                    Available Mon–Sat: 8:00 AM – 8:00 PM (Asia/Colombo)
                  </p>
                </div>
              </div>
            </div>

            {/* Billing & Official Expense Receipts History */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-blue-600" />
                    <span>Payment Receipts & Invoices</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Official Sri Lanka POS SaaS payment receipts for tax and accounting records
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setInvoicesLoading(true);
                    fetch("/api/business/invoices")
                      .then((res) => res.json())
                      .then((data) => {
                        if (data.success && data.invoices) setStoreInvoices(data.invoices);
                      })
                      .catch((err) => console.error(err))
                      .finally(() => setInvoicesLoading(false));
                  }}
                  className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                  title="Refresh receipts"
                >
                  <RefreshCw className={`w-4 h-4 ${invoicesLoading ? "animate-spin text-blue-600" : ""}`} />
                </button>
              </div>

              {invoicesLoading ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading invoice history...</div>
              ) : storeInvoices.length === 0 ? (
                <div className="p-8 text-center">
                  <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-600">No payment receipts found</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Official receipts will appear here whenever a subscription payment is recorded by platform support.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                        <th className="py-3 px-4">Invoice #</th>
                        <th className="py-3 px-4">Plan / Cycle</th>
                        <th className="py-3 px-4">Amount Paid</th>
                        <th className="py-3 px-4">Payment Method</th>
                        <th className="py-3 px-4">Payment Date</th>
                        <th className="py-3 px-4">Coverage Period</th>
                        <th className="py-3 px-4 text-right">Official Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {storeInvoices.map((inv) => (
                        <tr key={inv._id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            {inv.invoiceNumber}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-800">{inv.plan}</span>
                            <span className="text-slate-400 ml-1 text-[11px]">({inv.billingCycle.toLowerCase()})</span>
                          </td>
                          <td className="py-3 px-4 font-bold text-emerald-700">
                            {formatCurrency(inv.amount)}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]">
                              {inv.paymentMethod.replace("_", " ")}
                            </span>
                            {inv.paymentReference && (
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">Ref: {inv.paymentReference}</div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {new Date(inv.paidAt || inv.issuedAt || Date.now()).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className="py-3 px-4 text-slate-600 text-[11px]">
                            {new Date(inv.periodStart).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
                            {" → "}
                            {new Date(inv.periodEnd).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedReceipt(inv)}
                              className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-lg text-xs transition"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                              <span>View Receipt</span>
                            </button>
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

        {/* 5. Security & Action Gates Tab */}
        {activeTab === "security" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 pb-6 border-b border-slate-100">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0 mt-0.5">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Loss Prevention & Cashier Action Gates
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                      Configure automated counter authorization gates. When triggered, cashiers cannot complete high-risk actions without approval from an on-duty Supervisor or Manager using a 4-6 digit numeric PIN.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSaveSecurity}
                  disabled={savingSecurity}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50 shrink-0"
                >
                  {savingSecurity ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Policies
                </button>
              </div>

              <form onSubmit={handleSaveSecurity} className="space-y-6">
                {/* 1. POS Counter Action Gates */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Sliders className="w-4 h-4 text-blue-600" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Counter Checkout Gates
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Cart Void Gate */}
                    <div className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors bg-slate-50/50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                            Require Approval for Cart Void / Clear
                          </span>
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            Cashiers must ask a supervisor before discarding scanned items or clearing an active checkout cart.
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                          <input
                            type="checkbox"
                            checked={securityPolicy.requireSupervisorForVoid}
                            onChange={(e) =>
                              setSecurityPolicy({
                                ...securityPolicy,
                                requireSupervisorForVoid: e.target.checked,
                              })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    </div>

                    {/* Cashier Discount Ceilings Gate */}
                    <div className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors bg-slate-50/50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <Percent className="w-3.5 h-3.5 text-amber-500" />
                            Enforce Cashier Discount Ceilings
                          </span>
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            Intercept manual discounts that exceed store-defined percentage or fixed rupee thresholds.
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                          <input
                            type="checkbox"
                            checked={securityPolicy.requireSupervisorForDiscount}
                            onChange={(e) =>
                              setSecurityPolicy({
                                ...securityPolicy,
                                requireSupervisorForDiscount: e.target.checked,
                              })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>

                      {securityPolicy.requireSupervisorForDiscount && (
                        <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                              Max Cashier Discount %
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={securityPolicy.maxCashierDiscountPercent}
                                onChange={(e) =>
                                  setSecurityPolicy({
                                    ...securityPolicy,
                                    maxCashierDiscountPercent: Math.max(0, Number(e.target.value)),
                                  })
                                }
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-6"
                              />
                              <span className="absolute right-2 top-2 text-[10px] text-slate-400 font-bold">%</span>
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                              Max Cashier Discount (LKR)
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min={0}
                                value={securityPolicy.maxCashierDiscountAmount}
                                onChange={(e) =>
                                  setSecurityPolicy({
                                    ...securityPolicy,
                                    maxCashierDiscountAmount: Math.max(0, Number(e.target.value)),
                                  })
                                }
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
                              />
                              <span className="absolute right-2 top-2 text-[10px] text-slate-400 font-bold">Rs.</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Manual Drawer Kick Gate */}
                    <div className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors bg-slate-50/50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-blue-500" />
                            Require Approval for "No Sale" Drawer Kick
                          </span>
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            Opening the cash drawer without an active billing transaction requires a supervisor approval reason.
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                          <input
                            type="checkbox"
                            checked={securityPolicy.requireSupervisorForNoSale}
                            onChange={(e) =>
                              setSecurityPolicy({
                                ...securityPolicy,
                                requireSupervisorForNoSale: e.target.checked,
                              })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    </div>

                    {/* Price Override Gate */}
                    <div className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors bg-slate-50/50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <Coins className="w-3.5 h-3.5 text-emerald-500" />
                            Require Approval for Price Overrides
                          </span>
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            Direct counter price modifications require supervisor authentication to prevent unrecorded discounts.
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                          <input
                            type="checkbox"
                            checked={securityPolicy.requireSupervisorForPriceOverride}
                            onChange={(e) =>
                              setSecurityPolicy({
                                ...securityPolicy,
                                requireSupervisorForPriceOverride: e.target.checked,
                              })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Back-Office Anti-Tampering Gates */}
                <div className="pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Ledger & Inventory Protection
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Petty Cash Delete Gate */}
                    <div className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors bg-slate-50/50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <Receipt className="w-3.5 h-3.5 text-purple-500" />
                            Supervisor Gate on Expense Deletions
                          </span>
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            Restricts deleting or voiding petty cash expense entries to authorized supervisors only.
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                          <input
                            type="checkbox"
                            checked={securityPolicy.requireSupervisorForExpenseDelete}
                            onChange={(e) =>
                              setSecurityPolicy({
                                ...securityPolicy,
                                requireSupervisorForExpenseDelete: e.target.checked,
                              })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 6. Audit Trail Explorer Tab */}
        {activeTab === "audit" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              {/* Header & Filter Controls */}
              <div className="p-6 border-b border-slate-100">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-purple-600" />
                      Live Store Security Audit Trail
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Immutable forensic log of counter events, supervisor approvals, voids, and staff updates.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => loadAuditLogs(auditActionFilter, auditSearch, auditRange)}
                      disabled={auditLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${auditLoading ? "animate-spin text-blue-600" : ""}`} />
                      Refresh Log
                    </button>
                    <button
                      type="button"
                      onClick={exportAuditToCsv}
                      disabled={auditLogs.length === 0}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-semibold transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export CSV
                    </button>
                  </div>
                </div>

                {/* Filter Controls Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search cashier, supervisor, action..."
                      value={auditSearch}
                      onChange={(e) => setAuditSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          loadAuditLogs(auditActionFilter, auditSearch, auditRange);
                        }
                      }}
                      className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <select
                      value={auditActionFilter}
                      onChange={(e) => {
                        setAuditActionFilter(e.target.value);
                        loadAuditLogs(e.target.value, auditSearch, auditRange);
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="ALL">All Event Types</option>
                      <option value="SUPERVISOR_OVERRIDE">Supervisor Overrides (Approved)</option>
                      <option value="OVERRIDE_FAILED_INVALID_PIN">Supervisor Overrides (Failed PIN)</option>
                      <option value="CART_VOIDED">Cart Voided</option>
                      <option value="NO_SALE_DRAWER_KICK">No-Sale Drawer Kicks</option>
                      <option value="USER_CREATE">Staff Member Created</option>
                      <option value="USER_UPDATE">Staff Member Updated</option>
                      <option value="BUSINESS_UPDATE">Store Settings Modified</option>
                      {auditActionsList
                        .filter(
                          (a) =>
                            ![
                              "SUPERVISOR_OVERRIDE",
                              "OVERRIDE_FAILED_INVALID_PIN",
                              "CART_VOIDED",
                              "NO_SALE_DRAWER_KICK",
                              "USER_CREATE",
                              "USER_UPDATE",
                              "BUSINESS_UPDATE",
                            ].includes(a)
                        )
                        .map((act) => (
                          <option key={act} value={act}>
                            {act}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <select
                      value={auditRange}
                      onChange={(e) => {
                        setAuditRange(e.target.value);
                        loadAuditLogs(auditActionFilter, auditSearch, e.target.value);
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All Time</option>
                      <option value="today">Today Only</option>
                      <option value="7d">Last 7 Days</option>
                      <option value="30d">Last 30 Days</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Audit Table */}
              {auditLoading ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-blue-500 mb-2" />
                  Loading audit logs...
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  No audit trail events matched your filter criteria.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                        <th className="py-3 px-4">Timestamp</th>
                        <th className="py-3 px-4">Event / Action</th>
                        <th className="py-3 px-4">Cashier / Staff</th>
                        <th className="py-3 px-4">Supervisor Authorizer</th>
                        <th className="py-3 px-4">Context / Reason</th>
                        <th className="py-3 px-4 text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {auditLogs.map((log: any) => {
                        const isApproval = log.action === "SUPERVISOR_OVERRIDE";
                        const isFailedPin = log.action === "OVERRIDE_FAILED_INVALID_PIN";
                        const isVoid = log.action === "CART_VOIDED";
                        const isDrawer = log.action === "NO_SALE_DRAWER_KICK";

                        return (
                          <tr key={log._id} className="hover:bg-slate-50/60 transition">
                            <td className="py-3 px-4 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                              {new Date(log.createdAt).toLocaleString("en-LK", {
                                month: "short",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isApproval
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                    : isFailedPin
                                    ? "bg-rose-100 text-rose-800 border border-rose-200"
                                    : isVoid
                                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                                    : isDrawer
                                    ? "bg-blue-100 text-blue-800 border border-blue-200"
                                    : "bg-slate-100 text-slate-800 border border-slate-200"
                                }`}
                              >
                                {isApproval ? (
                                  <Check className="w-2.5 h-2.5" />
                                ) : isFailedPin ? (
                                  <AlertCircle className="w-2.5 h-2.5" />
                                ) : (
                                  <Shield className="w-2.5 h-2.5" />
                                )}
                                {log.action.replace(/_/g, " ")}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-900">{log.userName || "System"}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{log.userRole || "STAFF"}</div>
                            </td>
                            <td className="py-3 px-4">
                              {log.details?.supervisorName ? (
                                <div className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
                                  <KeyRound className="w-3 h-3 text-purple-600 shrink-0" />
                                  <span>{log.details.supervisorName}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[11px]">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 max-w-xs truncate text-slate-600 text-[11px]">
                              {log.details?.reason || log.details?.actionType || log.entityType || "—"}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedAuditLog(log)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Inspect</span>
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
          </div>
        )}

        {/* ================= MULTI-CURRENCY & FX EXCHANGE RATES TAB ================= */}
        {activeTab === "currency" && (
          <div className="space-y-6">
            {/* Top Overview & Master Controls Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Dual-Currency & Exchange Engine</h3>
                    <p className="text-xs text-slate-500">
                      Central Bank of Sri Lanka (CBSL) benchmark rates with custom counter buffer margins
                    </p>
                  </div>
                </div>

                {/* Master Switch */}
                <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
                  <span className="text-xs font-semibold text-slate-700">Multi-Currency Billing:</span>
                  <button
                    type="button"
                    onClick={() => setCurrencySettings((prev) => ({ ...prev, enabled: !prev.enabled }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      currencySettings.enabled ? "bg-emerald-600" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        currencySettings.enabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                  <span className="text-xs font-bold font-mono text-slate-800">
                    {currencySettings.enabled ? "ACTIVE" : "DISABLED"}
                  </span>
                </div>
              </div>

              {/* Statutory Disclosure & Settings Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Base Currency Box */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Statutory Base Currency
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🇱🇰</span>
                    <span className="font-bold text-sm text-slate-900">Sri Lankan Rupee (LKR)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    All legal taxes (VAT/SSCL), general ledger entries, and shift reports are denominated in LKR.
                  </p>
                </div>

                {/* Merchant Counter Buffer Margin Slider */}
                <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 block">
                      Counter Buffer Margin
                    </span>
                    <span className="font-mono font-bold text-xs bg-emerald-200 text-emerald-950 px-2 py-0.5 rounded-full">
                      {currencySettings.exchangeBufferPercent}% Margin
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="0.5"
                      value={currencySettings.exchangeBufferPercent}
                      onChange={(e) => handleBufferChange(parseFloat(e.target.value) || 0)}
                      className="w-full accent-emerald-600"
                    />
                  </div>
                  <p className="text-[10px] text-emerald-800 leading-normal">
                    Applied below benchmark rate (e.g. -2%) to protect against foreign exchange volatility and cash handling.
                  </p>
                </div>

                {/* CBSL Sync & Benchmark Status */}
                <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-900 block">
                      Exchange Rate Source
                    </span>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                      CBSL / Market
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-800">
                    Last Synced: <span className="font-mono text-blue-900">{lastSyncedTime || "Ready to sync"}</span>
                  </div>
                  <p className="text-[10px] text-blue-800 leading-normal">
                    Fetches Central Bank of Sri Lanka indicative counter rates with auto-fallbacks.
                  </p>
                </div>
              </div>
            </div>

            {/* Currencies Grid & Exchange Rates Configuration */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Supported Foreign Currencies</h4>
                  <p className="text-xs text-slate-500">
                    Enable the foreign banknotes your store accepts at the counter and configure exchange rates.
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-600">
                  {currencySettings.currencies.filter((c) => c.isEnabled).length} of {SUPPORTED_CURRENCY_PRESETS.length} Active
                </span>
              </div>

              {loadingCurrencies ? (
                <div className="py-12 text-center text-slate-400 text-xs">Loading currency rates...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {SUPPORTED_CURRENCY_PRESETS.map((preset) => {
                    const current = currencySettings.currencies.find((c) => c.code === preset.code);
                    const isEnabled = current ? current.isEnabled : ["USD", "EUR", "GBP"].includes(preset.code);
                    const currentRate = current?.exchangeRate || applyMerchantBuffer(preset.defaultRate, currencySettings.exchangeBufferPercent);

                    return (
                      <div
                        key={preset.code}
                        className={`p-4 rounded-xl border transition-all ${
                          isEnabled
                            ? "bg-white border-slate-300 shadow-xs"
                            : "bg-slate-50/70 border-slate-200 opacity-60"
                        }`}
                      >
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                          <div className="flex items-center gap-2.5">
                            <span className="text-2xl">{preset.flag}</span>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-extrabold text-slate-900 text-sm">{preset.code}</span>
                                <span className="text-xs text-slate-500 font-medium">({preset.symbol})</span>
                              </div>
                              <span className="text-[11px] text-slate-500 block">{preset.name}</span>
                            </div>
                          </div>

                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isEnabled}
                              onChange={() => handleToggleCurrency(preset.code)}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                          </label>
                        </div>

                        {/* Rate Editing & Conversion Simulation */}
                        <div className="pt-3 space-y-2">
                          <div className="flex items-center justify-between gap-3 text-xs">
                            <span className="text-slate-600 font-medium">1 {preset.code} =</span>
                            <div className="flex items-center gap-1">
                              <span className="text-slate-500 font-mono">Rs.</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                disabled={!isEnabled}
                                value={currentRate}
                                onChange={(e) => handleRateChange(preset.code, parseFloat(e.target.value) || 0)}
                                className="w-24 px-2 py-1 text-right font-mono font-bold text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100"
                              />
                            </div>
                          </div>

                          <div className="p-2 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center justify-between text-[11px] text-slate-600 font-mono">
                            <span>Counter Example:</span>
                            <span className="font-semibold text-slate-900">
                              {preset.symbol}100.00 = {formatCurrency(100 * currentRate)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Shift & Cash Drawer Segregation Guidance */}
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-start gap-3 text-xs text-amber-900">
              <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold block">Cash Drawer & Shift Auditing Note</span>
                <p className="text-[11px] text-amber-800 leading-normal">
                  When cashiers accept foreign notes (e.g. $50 USD or €20 EUR), the foreign banknotes are physically retained in the cash drawer and change is given in Sri Lankan Rupees (LKR). At the end of each shift, the X/Z-Report will itemize foreign banknotes separately from LKR cash float.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Digital Scales & GS1 Barcodes Settings Tab */}
        {activeTab === "hardware" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header / Intro Card */}
            <div className="p-6 bg-gradient-to-r from-emerald-900 to-teal-900 text-white rounded-3xl shadow-lg relative overflow-hidden">
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-semibold">
                    <Scale className="w-3.5 h-3.5" /> Retail Supermarket Hardware Engine
                  </div>
                  <h2 className="text-xl font-bold tracking-tight">
                    Digital Weighing Scales & Variable Barcode Architecture
                  </h2>
                  <p className="text-xs text-emerald-100/80 max-w-2xl leading-relaxed">
                    Direct Web Serial RS-232 / USB scale integration with live weight streaming, auto-tare calibration, and GS1 variable-measure barcode decoding (Price & Weight embedded EAN-13) for fresh produce, deli, and meat packaging.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSeedProduceCatalog}
                    disabled={seedingProduce}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50"
                  >
                    {seedingProduce ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Package className="w-4 h-4" />
                    )}
                    <span>Seed Produce (PLUs 101–109)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveHardwareSettings}
                    disabled={savingHardware}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-emerald-900 hover:bg-emerald-50 rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50"
                  >
                    {savingHardware ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-emerald-900" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>Save Scale Config</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Web Serial Scale Driver Card */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                      <Cpu className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Web Serial Scale Protocol</h3>
                      <p className="text-xs text-slate-500">Physical RS-232 / USB scale communication</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hardwareScaleSettings.weighingScale.enabled}
                      onChange={(e) =>
                        setHardwareScaleSettings({
                          ...hardwareScaleSettings,
                          weighingScale: {
                            ...hardwareScaleSettings.weighingScale,
                            enabled: e.target.checked,
                          },
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Scale Protocol / Manufacturer Model
                    </label>
                    <select
                      value={hardwareScaleSettings.weighingScale.scaleModel}
                      onChange={(e) =>
                        setHardwareScaleSettings({
                          ...hardwareScaleSettings,
                          weighingScale: {
                            ...hardwareScaleSettings.weighingScale,
                            scaleModel: e.target.value,
                          },
                        })
                      }
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="CAS_PD_II">CAS AP-1 / PD-II / ER Plus (Standard SL Retail)</option>
                      <option value="METTLER_TOLEDO">Mettler Toledo PS60 / 8217 (Supermarket Deli)</option>
                      <option value="DIGI">DIGI DS-788 / SM-100 / SM-500 (Teraoka Seiko)</option>
                      <option value="RONGTA">Rongta RLS1000 / RLS1100 (Barcode Printing Scale)</option>
                      <option value="AVERY_BERKEL">Avery Berkel FX120 / 6720 POS Scale</option>
                      <option value="CONTINUOUS_ASCII">Continuous Stream (Generic RS-232 / USB ASCII)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Baud Rate
                      </label>
                      <select
                        value={hardwareScaleSettings.weighingScale.baudRate}
                        onChange={(e) =>
                          setHardwareScaleSettings({
                            ...hardwareScaleSettings,
                            weighingScale: {
                              ...hardwareScaleSettings.weighingScale,
                              baudRate: parseInt(e.target.value, 10) || 9600,
                            },
                          })
                        }
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value={9600}>9600 baud (Standard)</option>
                        <option value={4800}>4800 baud</option>
                        <option value={2400}>2400 baud</option>
                        <option value={19200}>19200 baud</option>
                        <option value={38400}>38400 baud</option>
                        <option value={115200}>115200 baud</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Default Tare Deduction (g)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="1000"
                        value={hardwareScaleSettings.weighingScale.defaultTareWeightGrams}
                        onChange={(e) =>
                          setHardwareScaleSettings({
                            ...hardwareScaleSettings,
                            weighingScale: {
                              ...hardwareScaleSettings.weighingScale,
                              defaultTareWeightGrams: parseInt(e.target.value, 10) || 0,
                            },
                          })
                        }
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="5g (Polythene bag)"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-900 block">Automatic Tare Compensation</span>
                      <span className="text-[11px] text-slate-500">Auto-deduct bag/tray packaging weight from raw weight</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hardwareScaleSettings.weighingScale.autoTare}
                        onChange={(e) =>
                          setHardwareScaleSettings({
                            ...hardwareScaleSettings,
                            weighingScale: {
                              ...hardwareScaleSettings.weighingScale,
                              autoTare: e.target.checked,
                            },
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-[11px] text-emerald-900 flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Web Serial Driver Capabilities:</p>
                      <p className="text-emerald-800 mt-0.5 leading-relaxed">
                        Chrome, Edge & Opera support direct connection via USB or USB-to-RS232 FTDI cables. If no physical scale is connected, staff can switch to the interactive Scale Simulator in the POS Weighing Modal.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* GS1 Variable Barcode Settings Card */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">GS1 Variable-Measure Barcodes</h3>
                      <p className="text-xs text-slate-500">Weight & Price embedded EAN-13 standards</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hardwareScaleSettings.variableWeightBarcodes.enabled}
                      onChange={(e) =>
                        setHardwareScaleSettings({
                          ...hardwareScaleSettings,
                          variableWeightBarcodes: {
                            ...hardwareScaleSettings.variableWeightBarcodes,
                            enabled: e.target.checked,
                          },
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                  </label>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Weight-Embedded EAN-13 Prefixes (2-digit)
                    </label>
                    <input
                      type="text"
                      value={hardwareScaleSettings.variableWeightBarcodes.weightPrefixes.join(", ")}
                      onChange={(e) =>
                        setHardwareScaleSettings({
                          ...hardwareScaleSettings,
                          variableWeightBarcodes: {
                            ...hardwareScaleSettings.variableWeightBarcodes,
                            weightPrefixes: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                          },
                        })
                      }
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="21, 20, 02"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Format: <span className="font-mono text-slate-700">PP-LLLLL-WWWWW-C</span> (2-digit prefix, 5-digit PLU, 5-digit weight in grams, Mod-10 checksum)
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Price-Embedded EAN-13 Prefixes (2-digit)
                    </label>
                    <input
                      type="text"
                      value={hardwareScaleSettings.variableWeightBarcodes.pricePrefixes.join(", ")}
                      onChange={(e) =>
                        setHardwareScaleSettings({
                          ...hardwareScaleSettings,
                          variableWeightBarcodes: {
                            ...hardwareScaleSettings.variableWeightBarcodes,
                            pricePrefixes: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                          },
                        })
                      }
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="28, 29"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Format: <span className="font-mono text-slate-700">PP-LLLLL-$$$$$-C</span> (2-digit prefix, 5-digit PLU, 5-digit price in cents/LKR, Mod-10 checksum)
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Default Unit</span>
                      <span className="font-bold text-slate-800 uppercase font-mono">
                        {hardwareScaleSettings.variableWeightBarcodes.defaultUnit || "kg"} (Kilograms)
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Checksum Algorithm</span>
                      <span className="font-bold text-slate-800 font-mono">Modulo-10 (GS1 Spec)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Test Barcode Generation & Vector SVG Verification */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                    <Search className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">GS1 Barcode Verification & Label Test</h3>
                    <p className="text-xs text-slate-500">
                      Real-time vector SVG rendering and Modulo-10 checksum validation
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> EAN-13 Compliant
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Test PLU Code
                    </label>
                    <input
                      type="text"
                      value={testPlu}
                      onChange={(e) => setTestPlu(e.target.value.replace(/\D/g, "").slice(0, 5))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="101"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">e.g. 101 = Red Onions</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Test Net Weight (kg)
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      min="0.01"
                      max="50"
                      value={testWeightKg}
                      onChange={(e) => setTestWeightKg(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      = {Math.round(testWeightKg * 1000)} grams
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                    Decoded Barcode Structure
                  </span>
                  {(() => {
                    const testBarcode = generateScaleBarcode({
                      type: "WEIGHT",
                      pluCode: testPlu || "101",
                      prefix: hardwareScaleSettings.variableWeightBarcodes.weightPrefixes?.[0] || "21",
                      weightKg: Number(testWeightKg) || 1.25,
                    });
                    const pfx = testBarcode.slice(0, 2);
                    const pluPart = testBarcode.slice(2, 7);
                    const wtPart = testBarcode.slice(7, 12);
                    const chk = testBarcode.slice(12, 13);
                    return (
                      <div className="space-y-2">
                        <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-center">
                          <span className="font-mono text-base font-bold text-slate-900 tracking-widest">
                            <span className="text-emerald-600">{pfx}</span>
                            <span className="text-blue-600">{pluPart}</span>
                            <span className="text-purple-600">{wtPart}</span>
                            <span className="text-rose-600">{chk}</span>
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 text-[10px] text-slate-600 font-mono">
                          <div>
                            <span className="text-slate-400">Prefix: </span>
                            <span className="font-bold text-emerald-600">{pfx} (Weight)</span>
                          </div>
                          <div>
                            <span className="text-slate-400">PLU: </span>
                            <span className="font-bold text-blue-600">{pluPart}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Weight: </span>
                            <span className="font-bold text-purple-600">{wtPart}g</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Checksum: </span>
                            <span className="font-bold text-rose-600">{chk}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-2">
                    Live Vector SVG Rendering
                  </span>
                  <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
                    <ScaleBarcodeSvg
                      value={generateScaleBarcode({
                        type: "WEIGHT",
                        pluCode: testPlu || "101",
                        prefix: hardwareScaleSettings.variableWeightBarcodes.weightPrefixes?.[0] || "21",
                        weightKg: Number(testWeightKg) || 1.25,
                      })}
                      height={54}
                      moduleWidth={1.8}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-2 font-mono">
                    Scannable by 1D/2D POS Scanners
                  </span>
                </div>
              </div>
            </div>

            {/* Produce Seeding and Hardware Links Info Card */}
            <div className="p-6 bg-slate-900 text-white rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-1">
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-400" />
                  Pre-configured Produce Items (PLU 101–109)
                </h4>
                <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
                  Red Onions (101), Big Onions (102), Potatoes (103), Carrots (104), Green Chillies (105), Fresh Chicken (106), Thalapath (107), Papaya (108), Bananas (109) with predefined bilingual names and tare allowances.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <a
                  href="/labels"
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition"
                >
                  Thermal Label Station &rarr;
                </a>
                <a
                  href="/pos"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition shadow-sm"
                >
                  Open POS Register &rarr;
                </a>
              </div>
            </div>
          </div>
        )}
      </>
    )}

    {/* Add Register / Terminal Modal */}
    {isAddRegisterOpen && (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                <Monitor className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Add Checkout Register</h3>
                <p className="text-[11px] text-slate-500">Configure new checkout counter / physical terminal</p>
              </div>
            </div>
            <button
              onClick={() => setIsAddRegisterOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleAddRegister} className="p-6 space-y-4">
            {addRegisterError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{addRegisterError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Counter Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Counter 02 (Express Lane), Bakery Counter"
                value={newRegister.name}
                onChange={(e) => setNewRegister({ ...newRegister, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Register ID / Code</label>
                <input
                  type="text"
                  placeholder="e.g. REG-02"
                  value={newRegister.registerNumber}
                  onChange={(e) => setNewRegister({ ...newRegister, registerNumber: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Location / Zone</label>
                <input
                  type="text"
                  placeholder="e.g. Front Entrance"
                  value={newRegister.location}
                  onChange={(e) => setNewRegister({ ...newRegister, location: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Receipt Paper Width</label>
              <select
                value={newRegister.printerWidth}
                onChange={(e) => setNewRegister({ ...newRegister, printerWidth: e.target.value as "58mm" | "80mm" })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="58mm">58mm (2-inch standard thermal roll)</option>
                <option value="80mm">80mm (3-inch wide supermarket roll)</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="regDefault"
                checked={newRegister.isDefault}
                onChange={(e) => setNewRegister({ ...newRegister, isDefault: e.target.checked })}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="regDefault" className="text-xs text-slate-700 select-none">
                Make this the store's primary / default counter
              </label>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsAddRegisterOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addRegisterLoading}
                className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50"
              >
                {addRegisterLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Create Counter</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* Add Staff Modal */}
    {isAddStaffOpen && (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                <UserPlus className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Add Staff Member</h3>
                <p className="text-[11px] text-slate-500">Grant counter or manager access</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsAddStaffOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleAddStaff} className="p-6 space-y-4">
            {addStaffError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{addStaffError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Nimal Perera"
                value={newStaff.name}
                onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Login Username *</label>
              <input
                type="text"
                required
                placeholder="e.g. nimal_pos"
                value={newStaff.username}
                onChange={(e) =>
                  setNewStaff({
                    ...newStaff,
                    username: e.target.value.toLowerCase().replace(/\s+/g, ""),
                  })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Password / PIN *</label>
              <input
                type="password"
                required
                placeholder="Minimum 4 characters"
                value={newStaff.password}
                onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Role *</label>
                <select
                  value={newStaff.role}
                  onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="CASHIER">CASHIER (POS Only)</option>
                  <option value="SUPERVISOR">SUPERVISOR (Overrides & Approvals)</option>
                  <option value="MANAGER">MANAGER (Stock, Prices & Reports)</option>
                  <option value="INVENTORY_CLERK">INVENTORY CLERK (Products & Stock)</option>
                  <option value="ACCOUNTANT">ACCOUNTANT (Financials & Expenses)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Phone (SL)</label>
                <input
                  type="text"
                  placeholder="0771234567"
                  value={newStaff.phone}
                  onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {["OWNER", "MANAGER", "SUPERVISOR"].includes(newStaff.role) && (
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1.5">
                <label className="block text-xs font-semibold text-blue-900 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                    Supervisor Override PIN (4-6 Digits)
                  </span>
                  <span className="text-[10px] text-blue-600 font-normal">Optional</span>
                </label>
                <input
                  type="password"
                  maxLength={6}
                  placeholder="e.g. 1234 (Numeric PIN)"
                  value={newStaff.supervisorPin}
                  onChange={(e) => setNewStaff({ ...newStaff, supervisorPin: e.target.value.replace(/\D/g, "") })}
                  className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl text-xs text-slate-900 font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[10px] text-blue-700 leading-normal">
                  Used by supervisors to authorize cashier cart voids, excess discounts, and drawer kicks directly at the counter.
                </p>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsAddStaffOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addStaffLoading}
                className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50"
              >
                {addStaffLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Create Account</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* Subscription Invoice Receipt Modal */}
    {selectedReceipt && (
      <SubscriptionInvoiceReceipt
        invoice={selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
      />
    )}

    {/* Audit Log Inspect Modal */}
    {selectedAuditLog && (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Audit Event Details</h3>
                <p className="text-[11px] text-slate-500 font-mono">ID: {selectedAuditLog._id}</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedAuditLog(null)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Action</span>
                <span className="font-bold text-slate-900">{selectedAuditLog.action}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Timestamp</span>
                <span className="font-mono text-slate-700">{new Date(selectedAuditLog.createdAt).toLocaleString("en-LK")}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Staff / Cashier</span>
                <span className="font-semibold text-slate-800">{selectedAuditLog.userName} ({selectedAuditLog.userRole})</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Supervisor</span>
                <span className="font-semibold text-purple-700">{selectedAuditLog.details?.supervisorName || "N/A"}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1">Payload / Details</span>
              <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl text-[11px] font-mono overflow-x-auto max-h-60">
                {JSON.stringify(selectedAuditLog.details || {}, null, 2)}
              </pre>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedAuditLog(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
      </div>
    </AppLayout>
  );
}
