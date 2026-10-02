"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import AppLayout from "@/components/layout/AppLayout";
import {
  ShoppingCart,
  Search,
  Barcode,
  Trash2,
  Plus,
  Minus,
  User,
  CreditCard,
  QrCode,
  Banknote,
  Building2,
  Receipt,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  Printer,
  ChevronRight,
  Wifi,
  WifiOff,
  RefreshCw,
  Monitor,
  Clock,
  Lock,
  Unlock,
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  FileText,
  FileSpreadsheet,
  BookOpen,
  Wallet,
  MessageSquare,
  Send,
  Check,
  Copy,
  Share2,
  Phone,
  Tag,
  Award,
  Gift,
  Coins,
  Ticket,
  ShieldAlert,
  KeyRound,
  Globe,
  UserCheck,
  Scale,
} from "lucide-react";
import QRCodeImage from "@/components/common/QRCodeImage";
import SupervisorOverrideModal from "@/components/pos/SupervisorOverrideModal";
import ShiftZReportReceipt, { ShiftZReportData } from "@/components/receipts/ShiftZReportReceipt";
import CreditSettlementReceipt, { CreditSettlementData } from "@/components/receipts/CreditSettlementReceipt";
import { formatCurrency } from "@/lib/formatters";
import {
  SUPPORTED_CURRENCY_PRESETS,
  formatForeignCurrency,
  convertLkrToForeign,
  convertForeignToLkr,
  calculateForeignTenderChange,
} from "@/lib/currency";
import { formatWhatsAppReceipt, buildWhatsAppUrl, toWhatsAppPhone } from "@/lib/notifications";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import {
  evaluatePromotions,
  calculateLoyaltyPointsEarned,
  calculateLoyaltyRedemptionDiscount,
  PromotionRule,
  CartEvaluationItem,
  LoyaltySettingsConfig,
} from "@/lib/promotions";
import {
  saveCatalogCache,
  getCatalogCache,
  decrementLocalStockCache,
  enqueueOfflineSale,
  OfflineSaleRecord,
} from "@/lib/offline-storage";
import LanguageSwitcher from "@/components/common/LanguageSwitcher";
import { useLanguage, useTranslation } from "@/lib/i18n/LanguageContext";
import { parseVariableWeightBarcode } from "@/lib/hardware/barcode-scale";
import { triggerCashDrawerKick } from "@/lib/hardware/escpos";
import { createCFDBroadcastChannel, CFDMessage } from "@/lib/hardware/cfd-channel";
import WeighingScaleModal, { IWeighableProduct } from "@/components/pos/WeighingScaleModal";

interface RegisterOption {
  _id: string;
  name: string;
  registerNumber: string;
  printerWidth?: "58mm" | "80mm";
  isDefault?: boolean;
}

interface Product {
  _id: string;
  name: string;
  nameSinhala?: string;
  nameTamil?: string;
  barcode?: string;
  sku?: string;
  pluCode?: string;
  isWeighable?: boolean;
  tareWeightGrams?: number;
  costPrice: number;
  sellingPrice: number;
  wholesalePrice?: number;
  wholesaleMinQty?: number;
  stockQuantity: number;
  unit: string;
  isBatchTracked?: boolean;
  categoryId?: { _id: string; name: string; color?: string } | string;
}

interface Category {
  _id: string;
  name: string;
  color?: string;
}

interface CartItem {
  productId: string;
  name: string;
  nameSinhala?: string;
  nameTamil?: string;
  barcode?: string;
  pluCode?: string;
  isWeighable?: boolean;
  tareWeightGrams?: number;
  unitPrice: number;
  costPrice: number;
  sellingPrice: number;
  wholesalePrice?: number;
  wholesaleMinQty?: number;
  quantity: number;
  stockQuantity: number;
  unit: string;
  discount: number;
  isBatchTracked?: boolean;
  batchId?: string;
  batchNumber?: string;
  expiryDate?: string;
}

interface BusinessSettings {
  name: string;
  phone: string;
  address: string;
  currency: string;
  subscription?: {
    plan: string;
    status?: string;
    expiryDate?: string;
  };
  taxSettings?: {
    enabled?: boolean;
    name?: string;
    rate?: number;
    type?: "INCLUSIVE" | "EXCLUSIVE";
    tin?: string;
    vatNumber?: string;
    ssclEnabled?: boolean;
    ssclRate?: number;
    isTaxInvoice?: boolean;
  };
  receiptSettings?: {
    headerMessage?: string;
    footerMessage?: string;
    defaultWidth?: "58mm" | "80mm";
    receiptLanguage?: "en" | "si" | "ta" | "bilingual_si" | "bilingual_ta" | "trilingual";
  };
  hardwareSettings?: {
    weighingScale?: {
      enabled?: boolean;
      scaleModel?: string;
      baudRate?: number;
      autoTare?: boolean;
      defaultTareWeightGrams?: number;
    };
    variableWeightBarcodes?: {
      enabled?: boolean;
      weightPrefixes?: string[];
      pricePrefixes?: string[];
      defaultUnit?: "kg" | "g";
    };
    cashDrawer?: {
      enabled?: boolean;
      autoKickOnCash?: boolean;
      kickPin?: "PIN2" | "PIN5";
      openKeyShortcut?: string;
    };
    customerDisplay?: {
      enabled?: boolean;
      welcomeMessage?: string;
      promotionalMessage?: string;
    };
  };
}

export default function POSPage() {
  const { data: session } = useSession();
  const businessId = (session?.user as any)?.businessId || "default";
  const { language } = useLanguage();
  const { t } = useTranslation();

  // Offline Network Resilience Hook
  const {
    isOnline,
    wasOffline,
    queuedCount,
    isSyncing,
    lastSyncResult,
    refreshQueueCount,
    syncQueuedSales,
  } = useNetworkStatus(businessId);

  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [registers, setRegisters] = useState<RegisterOption[]>([]);
  const [selectedRegister, setSelectedRegister] = useState<RegisterOption | null>(null);
  const [business, setBusiness] = useState<BusinessSettings | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [barcodeInput, setBarcodeInput] = useState("");

  // Customer & Discount
  const [customerName, setCustomerName] = useState("Walk-in Customer");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderDiscount, setOrderDiscount] = useState(0);

  // Promotions & Customer Loyalty Rewards State
  const [promotions, setPromotions] = useState<PromotionRule[]>([]);
  const [loyaltySettings, setLoyaltySettings] = useState<LoyaltySettingsConfig>({
    enabled: true,
    pointsPerSpend: 100,
    redemptionRate: 1,
    minPointsToRedeem: 50,
  });
  const [couponCode, setCouponCode] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [redeemLoyaltyPoints, setRedeemLoyaltyPoints] = useState(false);
  const [pointsToRedeemInput, setPointsToRedeemInput] = useState<number>(0);

  // Checkout Modal State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<
    "CASH" | "CARD" | "QR" | "BANK_TRANSFER" | "CREDIT" | "CREDIT_NOTE" | "GIFT_VOUCHER"
  >("CASH");
  const [cashReceived, setCashReceived] = useState<string>("");
  const [paymentReference, setPaymentReference] = useState("");
  const [creditNoteCodeInput, setCreditNoteCodeInput] = useState("");
  const [validatedCreditNote, setValidatedCreditNote] = useState<any | null>(null);
  const [validatingCreditNote, setValidatingCreditNote] = useState(false);
  const [creditNoteError, setCreditNoteError] = useState<string | null>(null);

  // Gift Voucher Counter Tender State
  const [giftVoucherCodeInput, setGiftVoucherCodeInput] = useState("");
  const [validatedGiftVoucher, setValidatedGiftVoucher] = useState<any | null>(null);
  const [validatingGiftVoucher, setValidatingGiftVoucher] = useState(false);
  const [giftVoucherError, setGiftVoucherError] = useState<string | null>(null);

  // Sales Rep / Floor Attendant Selection State (Milestone 23)
  const [salesReps, setSalesReps] = useState<Array<{ _id: string; name: string; username: string; role: string }>>([]);
  const [selectedSalesRepId, setSelectedSalesRepId] = useState<string>("");

  const [submittingSale, setSubmittingSale] = useState(false);

  // Multi-Currency & Dual-Currency Counter State (CBSL Engine)
  const [currencySettings, setCurrencySettings] = useState<{
    enabled: boolean;
    baseCurrency: string;
    exchangeBufferPercent?: number;
    currencies: Array<{
      code: string;
      symbol: string;
      name: string;
      exchangeRate: number;
      isEnabled: boolean;
      isAutoUpdated?: boolean;
      marginPercent?: number;
    }>;
  }>({
    enabled: false,
    baseCurrency: "LKR",
    exchangeBufferPercent: 2,
    currencies: [],
  });
  const [displayCurrency, setDisplayCurrency] = useState<string>("LKR");
  const [tenderCurrency, setTenderCurrency] = useState<string>("LKR");
  const [foreignCashReceived, setForeignCashReceived] = useState<string>("");

  // Wholesale & B2B Invoicing State
  const [billingMode, setBillingMode] = useState<"RETAIL" | "WHOLESALE">("RETAIL");
  const [isTaxInvoice, setIsTaxInvoice] = useState(false);
  const [buyerCompanyName, setBuyerCompanyName] = useState("");
  const [buyerTin, setBuyerTin] = useState("");
  const [buyerVatNumber, setBuyerVatNumber] = useState("");

  // Quotation Inward Loading State
  const [isLoadQuoteModalOpen, setIsLoadQuoteModalOpen] = useState(false);
  const [quoteSearchInput, setQuoteSearchInput] = useState("");
  const [activeQuotesList, setActiveQuotesList] = useState<any[]>([]);
  const [loadingActiveQuotes, setLoadingActiveQuotes] = useState(false);

  // Customer Credit & Quick Debt Settlement State
  const [matchedCustomer, setMatchedCustomer] = useState<any | null>(null);
  const [isCreditSettlementOpen, setIsCreditSettlementOpen] = useState(false);
  const [creditSettlementAmount, setCreditSettlementAmount] = useState("");
  const [creditSettlementMethod, setCreditSettlementMethod] = useState<"CASH" | "CARD" | "QR" | "BANK_TRANSFER">("CASH");
  const [creditSettlementRef, setCreditSettlementRef] = useState("");
  const [creditSettlementNotes, setCreditSettlementNotes] = useState("");
  const [submittingCreditSettlement, setSubmittingCreditSettlement] = useState(false);
  const [activeSettlementSlip, setActiveSettlementSlip] = useState<CreditSettlementData | null>(null);

  // Post-Sale Modal & Receipt State
  const [completedSale, setCompletedSale] = useState<any | null>(null);
  const [whatsappPhoneInput, setWhatsappPhoneInput] = useState("");
  const [copiedPublicReceipt, setCopiedPublicReceipt] = useState(false);
  const [showWhatsAppSection, setShowWhatsAppSection] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Supervisor Override Action Gate State
  const [overrideModal, setOverrideModal] = useState<{
    isOpen: boolean;
    action: "VOID_CART" | "ITEM_VOID" | "HIGH_DISCOUNT" | "PRICE_OVERRIDE" | "NO_SALE_DRAWER" | "EXPENSE_DELETE";
    actionDescription: string;
    details?: Record<string, unknown>;
    onApproved: (supervisor: { name: string; role: string }) => void;
  }>({
    isOpen: false,
    action: "VOID_CART",
    actionDescription: "",
    onApproved: () => {},
  });
  const [isDiscountAuthorized, setIsDiscountAuthorized] = useState(false);

  // Shift & Cash Drawer Reconciliation State
  const [currentShift, setCurrentShift] = useState<ShiftZReportData | null>(null);
  const [loadingShift, setLoadingShift] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [isXReportModalOpen, setIsXReportModalOpen] = useState(false);
  const [isZReportModalOpen, setIsZReportModalOpen] = useState(false);
  const [closingShiftData, setClosingShiftData] = useState<ShiftZReportData | null>(null);

  // Quick cash movements state
  const [movementType, setMovementType] = useState<"CASH_DROP" | "PAY_IN" | "PAY_OUT">("CASH_DROP");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementReason, setMovementReason] = useState("");
  const [submittingMovement, setSubmittingMovement] = useState(false);

  // Open shift state
  const [openingFloatInput, setOpeningFloatInput] = useState("5000");
  const [submittingOpenShift, setSubmittingOpenShift] = useState(false);

  // Close shift state
  const [actualCashInput, setActualCashInput] = useState("");
  const [closingNotesInput, setClosingNotesInput] = useState("");
  const [submittingCloseShift, setSubmittingCloseShift] = useState(false);

  // Barcode input ref
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Hardware Peripherals, Weighing Scale & Customer Facing Display State
  const [isWeighModalOpen, setIsWeighModalOpen] = useState(false);
  const [weighModalInitialProduct, setWeighModalInitialProduct] = useState<Product | null>(null);
  const cfdChannelRef = useRef<BroadcastChannel | null>(null);

  // Fetch active shift for current register
  const fetchCurrentShift = async (registerId?: string) => {
    const regId = registerId || selectedRegister?._id;
    if (!regId) {
      setCurrentShift(null);
      return;
    }
    try {
      setLoadingShift(true);
      const res = await fetch(`/api/shifts/current?registerId=${regId}`);
      const data = await res.json();
      if (data.success && data.shift) {
        const activeShift: ShiftZReportData = {
          ...data.shift,
          cashSales: data.liveMetrics?.cashSales ?? data.shift.cashSales ?? 0,
          cardSales: data.liveMetrics?.cardSales ?? data.shift.cardSales ?? 0,
          qrSales: data.liveMetrics?.qrSales ?? data.shift.qrSales ?? 0,
          bankTransferSales: data.liveMetrics?.bankTransferSales ?? data.shift.bankTransferSales ?? 0,
          totalSales: data.liveMetrics?.totalSales ?? data.shift.totalSales ?? 0,
          salesCount: data.liveMetrics?.salesCount ?? data.shift.salesCount ?? 0,
          totalDiscount: data.liveMetrics?.totalDiscount ?? data.shift.totalDiscount ?? 0,
          totalTax: data.liveMetrics?.totalTax ?? data.shift.totalTax ?? 0,
          expectedCash: data.liveMetrics?.expectedCash ?? data.shift.expectedCash ?? data.shift.openingFloat,
          payIns: data.liveMetrics?.payIns ?? 0,
          cashDrops: data.liveMetrics?.cashDrops ?? 0,
          payOuts: data.liveMetrics?.payOuts ?? 0,
        };
        setCurrentShift(activeShift);
      } else {
        setCurrentShift(null);
      }
    } catch (e) {
      console.warn("Failed to fetch active shift:", e);
    } finally {
      setLoadingShift(false);
    }
  };

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRegister?._id) {
      alert("Please select a counter/register first.");
      return;
    }
    const floatNum = parseFloat(openingFloatInput) || 0;
    if (floatNum < 0) {
      alert("Opening float cannot be negative.");
      return;
    }

    setSubmittingOpenShift(true);
    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registerId: selectedRegister._id,
          openingFloat: floatNum,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsOpenShiftModalOpen(false);
        await fetchCurrentShift(selectedRegister._id);
        setStatusMessage({
          type: "success",
          text: `Shift ${data.shift.shiftNumber} opened with opening float of ${formatCurrency(floatNum)}.`,
        });
      } else {
        alert(data.error || "Failed to open shift.");
      }
    } catch (err: any) {
      alert(err.message || "Failed to communicate with shift service.");
    } finally {
      setSubmittingOpenShift(false);
    }
  };

  const handleRecordMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShift?._id) {
      alert("No active shift found.");
      return;
    }
    const amt = parseFloat(movementAmount) || 0;
    if (amt <= 0) {
      alert("Please enter a valid amount greater than 0.");
      return;
    }
    if (!movementReason.trim()) {
      alert("Please provide a note or reason for this cash movement.");
      return;
    }

    setSubmittingMovement(true);
    try {
      const res = await fetch(`/api/shifts/${currentShift._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: movementType,
          amount: amt,
          reason: movementReason.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMovementAmount("");
        setMovementReason("");
        await fetchCurrentShift(selectedRegister?._id);
        setStatusMessage({
          type: "success",
          text: `${movementType === "CASH_DROP" ? "Safe Drop" : movementType === "PAY_IN" ? "Pay-In" : "Pay-Out"} of ${formatCurrency(amt)} recorded successfully.`,
        });
      } else {
        alert(data.error || "Failed to record cash movement.");
      }
    } catch (err: any) {
      alert(err.message || "Network error recording movement.");
    } finally {
      setSubmittingMovement(false);
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShift?._id) {
      alert("No active shift found.");
      return;
    }
    const actual = parseFloat(actualCashInput);
    if (isNaN(actual) || actual < 0) {
      alert("Please enter a valid actual counted cash amount (0 or higher).");
      return;
    }

    setSubmittingCloseShift(true);
    try {
      const res = await fetch(`/api/shifts/${currentShift._id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actualCash: actual,
          closingNotes: closingNotesInput.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsCloseShiftModalOpen(false);
        setIsShiftModalOpen(false);
        setClosingShiftData(data.shift);
        setIsZReportModalOpen(true);
        setCurrentShift(null);
        setActualCashInput("");
        setClosingNotesInput("");
        setStatusMessage({
          type: "success",
          text: `Shift ${data.shift.shiftNumber} closed! Z-Report ready for printing.`,
        });
      } else {
        alert(data.error || "Failed to close shift.");
      }
    } catch (err: any) {
      alert(err.message || "Failed to close shift.");
    } finally {
      setSubmittingCloseShift(false);
    }
  };

  // Reactive customer phone lookup to detect credit status & debt balance
  useEffect(() => {
    const phoneTrimmed = customerPhone.trim();
    if (phoneTrimmed.length >= 9) {
      fetch(`/api/customers?q=${encodeURIComponent(phoneTrimmed)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.customers && data.customers.length > 0) {
            const exact = data.customers.find((c: any) => c.phone.endsWith(phoneTrimmed.slice(-9)));
            if (exact) {
              setMatchedCustomer(exact);
              if (customerName === "Walk-in Customer" || !customerName) {
                setCustomerName(exact.name);
              }
              return;
            }
          }
          setMatchedCustomer(null);
        })
        .catch(() => setMatchedCustomer(null));
    } else {
      setMatchedCustomer(null);
    }
  }, [customerPhone]);

  // Fast debt settlement from counter POS
  const handlePOSCreditSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchedCustomer) return;
    const amt = parseFloat(creditSettlementAmount) || 0;
    if (amt <= 0) {
      alert("Payment amount must be greater than zero.");
      return;
    }

    setSubmittingCreditSettlement(true);
    try {
      const res = await fetch(`/api/customers/${matchedCustomer._id}/credit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amt,
          paymentMethod: creditSettlementMethod,
          paymentReference: creditSettlementRef.trim() || undefined,
          registerId: selectedRegister?._id,
          notes: creditSettlementNotes.trim() || "Counter credit settlement",
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIsCreditSettlementOpen(false);
        setStatusMessage({
          type: "success",
          text: `Recorded debt settlement of ${formatCurrency(amt)} for ${matchedCustomer.name}.`,
        });

        // Refresh shift so expected drawer cash reflects PAY_IN
        if (selectedRegister?._id) fetchCurrentShift(selectedRegister._id);

        const slip: CreditSettlementData = {
          transactionNumber: data.transaction?.transactionNumber || `CR-PAY-${Date.now()}`,
          customerName: matchedCustomer.name,
          customerPhone: matchedCustomer.phone,
          customerNic: matchedCustomer.nicNumber,
          previousBalance: data.customer?.previousBalance ?? matchedCustomer.currentBalance ?? 0,
          amountPaid: amt,
          remainingBalance: data.customer?.currentBalance ?? Math.max(0, (matchedCustomer.currentBalance || 0) - amt),
          paymentMethod: creditSettlementMethod,
          paymentReference: creditSettlementRef.trim() || undefined,
          notes: creditSettlementNotes.trim() || undefined,
          cashierName: session?.user?.name || "Cashier",
          registerName: selectedRegister ? `${selectedRegister.registerNumber}: ${selectedRegister.name}` : "Counter",
          createdAt: new Date(),
        };

        setActiveSettlementSlip(slip);
        setMatchedCustomer((prev: any) =>
          prev ? { ...prev, currentBalance: Math.max(0, (prev.currentBalance || 0) - amt) } : null
        );
      } else {
        alert(data.error || "Failed to record payment.");
      }
    } catch (err: any) {
      alert(err.message || "Failed to record credit payment.");
    } finally {
      setSubmittingCreditSettlement(false);
    }
  };

  // Fetch active quotations for loading into POS cart
  const fetchActiveQuotations = async (query = "") => {
    setLoadingActiveQuotes(true);
    try {
      const url = query.trim()
        ? `/api/quotations?q=${encodeURIComponent(query.trim())}`
        : `/api/quotations?status=ACCEPTED`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setActiveQuotesList(data.quotations || []);
      }
    } catch {
      console.warn("Error fetching quotations in POS");
    } finally {
      setLoadingActiveQuotes(false);
    }
  };

  const handleOpenLoadQuoteModal = () => {
    setIsLoadQuoteModalOpen(true);
    setQuoteSearchInput("");
    fetchActiveQuotations();
  };

  const handleApplyQuotationToCart = (quote: any) => {
    if (cart.length > 0) {
      if (
        !confirm(
          `Your cart already contains ${cart.length} item(s). Loading this quotation will replace the active order. Proceed?`
        )
      ) {
        return;
      }
    }

    const newCartItems: CartItem[] = quote.items.map((it: any) => {
      const matchedProd = products.find((p) => p._id === (it.productId?._id || it.productId));
      return {
        productId: it.productId?._id || it.productId,
        name: it.name,
        barcode: it.barcode || matchedProd?.barcode,
        sellingPrice: it.unitPrice,
        wholesalePrice: it.priceTier === "WHOLESALE" ? it.unitPrice : matchedProd?.wholesalePrice,
        wholesaleMinQty: matchedProd?.wholesaleMinQty,
        unitPrice: it.unitPrice,
        costPrice: it.costPrice || matchedProd?.costPrice || 0,
        quantity: it.quantity,
        stockQuantity: matchedProd ? matchedProd.stockQuantity : 999,
        unit: matchedProd?.unit || "pcs",
        discount: it.discount || 0,
      };
    });

    setCart(newCartItems);
    setCustomerName(quote.customerName || "Customer");
    setCustomerPhone(quote.customerPhone || "");
    if (quote.companyName) {
      setBuyerCompanyName(quote.companyName);
    }
    if (quote.tin) setBuyerTin(quote.tin);
    if (quote.vatNumber) setBuyerVatNumber(quote.vatNumber);

    const hasWholesale = quote.items.some((it: any) => it.priceTier === "WHOLESALE");
    if (hasWholesale || quote.companyName) {
      setBillingMode("WHOLESALE");
    }

    if (quote.taxBreakdown?.ssclAmount > 0 || quote.taxBreakdown?.vatAmount > 0) {
      setIsTaxInvoice(true);
    }

    if (quote.discountTotal > 0) {
      setOrderDiscount(quote.discountTotal);
    }

    setIsLoadQuoteModalOpen(false);
    setStatusMessage({
      type: "success",
      text: `Quotation ${quote.quotationNumber} loaded into cart (${quote.items.length} items, ${formatCurrency(quote.netTotal)}). Ready for checkout.`,
    });
  };

  // Load Products, Categories, Registers, and Business Settings (with offline fallback cache)
  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [prodRes, catRes, bizRes, regRes, promoRes, currRes, staffRes] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/categories"),
        fetch("/api/business"),
        fetch("/api/registers"),
        fetch("/api/promotions"),
        fetch("/api/currencies"),
        fetch("/api/staff"),
      ]);

      const [prodData, catData, bizData, regData, promoData, currData, staffData] = await Promise.all([
        prodRes.json(),
        catRes.json(),
        bizRes.json(),
        regRes.json(),
        promoRes.json(),
        currRes.json(),
        staffRes.json(),
      ]);

      const fetchedProducts = prodData.success ? prodData.products || [] : [];
      const fetchedCategories = catData.success ? catData.categories || [] : [];
      const fetchedBusiness = bizData.success ? bizData.business : null;
      const fetchedRegisters: RegisterOption[] = regData.success ? regData.registers || [] : [];

      if (prodData.success) setProducts(fetchedProducts);
      if (catData.success) setCategories(fetchedCategories);
      if (bizData.success) setBusiness(fetchedBusiness);
      if (promoData.success) {
        setPromotions(promoData.promotions || []);
        if (promoData.loyaltySettings) setLoyaltySettings(promoData.loyaltySettings);
      }
      if (currData?.success && currData.currencySettings) {
        setCurrencySettings(currData.currencySettings);
      }
      if (staffData?.success && staffData.staff) {
        setSalesReps(staffData.staff.filter((s: any) => s.isActive));
      }

      if (regData.success && fetchedRegisters.length > 0) {
        setRegisters(fetchedRegisters);
        if (typeof window !== "undefined") {
          localStorage.setItem(`slpos_${businessId}_saved_registers`, JSON.stringify(fetchedRegisters));
          const savedRegId = localStorage.getItem(`slpos_${businessId}_register`);
          const found =
            fetchedRegisters.find((r) => r._id === savedRegId) ||
            fetchedRegisters.find((r) => r.isDefault) ||
            fetchedRegisters[0];
          if (found) {
            setSelectedRegister(found);
            localStorage.setItem(`slpos_${businessId}_register`, found._id);
          }
        }
      }

      // Cache catalog locally for offline availability
      if (fetchedProducts.length > 0) {
        saveCatalogCache(businessId, fetchedProducts, fetchedCategories, fetchedBusiness);
      }
    } catch {
      // Internet / server unreachable -> Hydrate catalog and registers from offline cache
      const cached = getCatalogCache(businessId);
      if (cached.products && cached.products.length > 0) {
        setProducts(cached.products as Product[]);
        if (cached.categories) setCategories(cached.categories as Category[]);
        if (cached.settings) setBusiness(cached.settings);
        setStatusMessage({
          type: "success",
          text: `Offline Counter Mode: Loaded ${cached.products.length} products from local device cache.`,
        });
      } else {
        setStatusMessage({ type: "error", text: "Failed to initialize POS counter and no offline cache available." });
      }

      if (typeof window !== "undefined") {
        try {
          const cachedRegs = localStorage.getItem(`slpos_${businessId}_saved_registers`);
          if (cachedRegs) {
            const parsedRegs: RegisterOption[] = JSON.parse(cachedRegs);
            setRegisters(parsedRegs);
            const savedRegId = localStorage.getItem(`slpos_${businessId}_register`);
            const found =
              parsedRegs.find((r) => r._id === savedRegId) ||
              parsedRegs.find((r) => r.isDefault) ||
              parsedRegs[0];
            if (found) setSelectedRegister(found);
          }
        } catch {}
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [businessId]);

  // Sync current shift whenever selected counter/register changes
  useEffect(() => {
    if (selectedRegister?._id) {
      fetchCurrentShift(selectedRegister._id);
    } else {
      setCurrentShift(null);
    }
  }, [selectedRegister?._id]);

  // Alert & refresh catalog when background sync finishes successfully
  useEffect(() => {
    if (lastSyncResult && lastSyncResult.syncedCount > 0) {
      setStatusMessage({
        type: "success",
        text: `Connection Restored: ${lastSyncResult.syncedCount} offline sale(s) uploaded to cloud database!`,
      });
      loadInitialData();
    }
  }, [lastSyncResult]);

  // Keyboard shortcuts: F2 for barcode input, F9 for cash drawer kick
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      } else if (e.key === "F9") {
        e.preventDefault();
        handleNoSaleDrawerKick();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Determine unit price based on billingMode and wholesale threshold
  const getItemUnitPrice = (
    item: { sellingPrice: number; wholesalePrice?: number; wholesaleMinQty?: number },
    qty: number,
    mode: "RETAIL" | "WHOLESALE"
  ) => {
    if (mode === "WHOLESALE" && item.wholesalePrice && item.wholesalePrice > 0) {
      return item.wholesalePrice;
    }
    if (
      item.wholesalePrice &&
      item.wholesalePrice > 0 &&
      item.wholesaleMinQty &&
      qty >= item.wholesaleMinQty
    ) {
      return item.wholesalePrice;
    }
    return item.sellingPrice;
  };

  const handleToggleBillingMode = (mode: "RETAIL" | "WHOLESALE") => {
    setBillingMode(mode);
    setCart((prevCart) =>
      prevCart.map((item) => ({
        ...item,
        unitPrice: getItemUnitPrice(
          {
            sellingPrice: item.sellingPrice ?? item.unitPrice,
            wholesalePrice: item.wholesalePrice,
            wholesaleMinQty: item.wholesaleMinQty,
          },
          item.quantity,
          mode
        ),
      }))
    );
  };

  // Add product to cart (supports weighable decimal quantities e.g. 0.850 kg)
  const addToCart = (product: Product, quantityToAdd: number = 1) => {
    if (product.stockQuantity <= 0) {
      setStatusMessage({ type: "error", text: `"${product.name}" is currently OUT OF STOCK.` });
      return;
    }

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.productId === product._id);

      if (existingIndex > -1) {
        const item = prevCart[existingIndex];
        const newQty = Math.round((item.quantity + quantityToAdd) * 1000) / 1000;
        if (newQty > product.stockQuantity) {
          setStatusMessage({
            type: "error",
            text: `Cannot add more. Only ${product.stockQuantity} ${product.unit} available in stock.`,
          });
          return prevCart;
        }

        const newUnitPrice = getItemUnitPrice(
          {
            sellingPrice: item.sellingPrice ?? product.sellingPrice,
            wholesalePrice: item.wholesalePrice ?? product.wholesalePrice,
            wholesaleMinQty: item.wholesaleMinQty ?? product.wholesaleMinQty,
          },
          newQty,
          billingMode
        );

        const updated = [...prevCart];
        updated[existingIndex] = {
          ...item,
          quantity: newQty,
          unitPrice: newUnitPrice,
        };
        return updated;
      }

      const unitPrice = getItemUnitPrice(
        {
          sellingPrice: product.sellingPrice,
          wholesalePrice: product.wholesalePrice,
          wholesaleMinQty: product.wholesaleMinQty,
        },
        quantityToAdd,
        billingMode
      );

      return [
        ...prevCart,
        {
          productId: product._id,
          name: product.name,
          nameSinhala: product.nameSinhala,
          nameTamil: product.nameTamil,
          barcode: product.barcode,
          pluCode: product.pluCode,
          isWeighable: product.isWeighable,
          tareWeightGrams: product.tareWeightGrams,
          sellingPrice: product.sellingPrice,
          wholesalePrice: product.wholesalePrice,
          wholesaleMinQty: product.wholesaleMinQty,
          unitPrice,
          costPrice: product.costPrice,
          quantity: quantityToAdd,
          stockQuantity: product.stockQuantity,
          unit: product.unit,
          discount: 0,
          isBatchTracked: product.isBatchTracked,
        },
      ];
    });

    setStatusMessage(null);
  };

  // Adjust Cart Quantity
  const updateQuantity = (productId: string, newQty: number) => {
    setCart((prevCart) => {
      return prevCart
        .map((item) => {
          if (item.productId === productId) {
            if (newQty <= 0) return null;
            if (newQty > item.stockQuantity) {
              setStatusMessage({
                type: "error",
                text: `Limit reached: only ${item.stockQuantity} in stock.`,
              });
              return item;
            }
            const unitPrice = getItemUnitPrice(
              {
                sellingPrice: item.sellingPrice ?? item.unitPrice,
                wholesalePrice: item.wholesalePrice,
                wholesaleMinQty: item.wholesaleMinQty,
              },
              newQty,
              billingMode
            );
            return { ...item, quantity: newQty, unitPrice };
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  // Remove Item from Cart
  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  // Clear Cart with Supervisor Action Gate for Cashiers
  const clearCart = () => {
    if (cart.length === 0) return;

    const userRole = session?.user?.role;
    if (userRole === "OWNER" || userRole === "MANAGER" || userRole === "SUPERVISOR") {
      if (confirm(`Are you sure you want to clear the active cart (${cart.length} item(s))?`)) {
        setCart([]);
        setOrderDiscount(0);
        setIsDiscountAuthorized(false);
        setStatusMessage({ type: "success", text: "Cart cleared." });
      }
      return;
    }

    // Cashier requires supervisor approval
    setOverrideModal({
      isOpen: true,
      action: "VOID_CART",
      actionDescription: `Void entire cart: ${cart.length} item(s) totaling ${formatCurrency(subtotal)}`,
      details: { cartItemCount: cart.length, cartSubtotal: subtotal },
      onApproved: (supervisor) => {
        setCart([]);
        setOrderDiscount(0);
        setIsDiscountAuthorized(false);
        setStatusMessage({
          type: "success",
          text: `Cart void approved by ${supervisor.name} (${supervisor.role}).`,
        });
      },
    });
  };

  // No-Sale Cash Drawer Kick (Hardware ESC/POS & audio feedback)
  const handleNoSaleDrawerKick = () => {
    const userRole = session?.user?.role;
    const executeKick = async (supervisorName?: string) => {
      try {
        await triggerCashDrawerKick({
          pin: (business?.hardwareSettings?.cashDrawer?.kickPin as any) || "PIN2",
          audioFeedback: true,
        });
      } catch (err) {
        console.warn("Cash drawer kick pulse error:", err);
      }
      setStatusMessage({
        type: "success",
        text: `Cash drawer kicked (No Sale)${supervisorName ? ` authorized by ${supervisorName}` : ""}.`,
      });
    };

    if (userRole === "OWNER" || userRole === "MANAGER" || userRole === "SUPERVISOR") {
      executeKick();
      return;
    }

    setOverrideModal({
      isOpen: true,
      action: "NO_SALE_DRAWER",
      actionDescription: "Open cash drawer without a sale transaction (No Sale kick)",
      details: { registerName: selectedRegister?.name || "Counter 01" },
      onApproved: (supervisor) => {
        executeKick(`${supervisor.name} (${supervisor.role})`);
      },
    });
  };

  // Handle Barcode Scan (Enter key from USB scanner, scale sticker, or manual entry)
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;

    // Check Variable-Weight Barcode (e.g. 2000105008502 for 850g or 2800105002046 for Rs. 204)
    const parsedScale = parseVariableWeightBarcode(code);
    if (parsedScale && parsedScale.isVariableBarcode && parsedScale.pluCode) {
      const matched = products.find(
        (p) =>
          p.pluCode === parsedScale.pluCode ||
          p.barcode === parsedScale.pluCode ||
          p.sku?.toLowerCase() === parsedScale.pluCode.toLowerCase()
      );

      if (matched) {
        let weightKg = 1;
        if (parsedScale.type === "WEIGHT" && parsedScale.weightInKg) {
          weightKg = parsedScale.weightInKg;
        } else if (parsedScale.type === "PRICE" && parsedScale.embeddedPrice && matched.sellingPrice > 0) {
          weightKg = Math.round((parsedScale.embeddedPrice / matched.sellingPrice) * 1000) / 1000;
        }

        addToCart(matched, weightKg);
        setBarcodeInput("");
        setStatusMessage({
          type: "success",
          text: `Scale Sticker: ${matched.name} (${weightKg} kg @ ${formatCurrency(matched.sellingPrice)}/kg)`,
        });
        return;
      } else {
        setStatusMessage({
          type: "error",
          text: `Variable-weight barcode with PLU "${parsedScale.pluCode}" scanned, but no matching product found.`,
        });
        setBarcodeInput("");
        return;
      }
    }

    const matched = products.find(
      (p) => p.barcode === code || p.sku?.toLowerCase() === code.toLowerCase()
    );

    if (matched) {
      if (matched.isWeighable) {
        setWeighModalInitialProduct(matched);
        setIsWeighModalOpen(true);
        setBarcodeInput("");
      } else {
        addToCart(matched);
        setBarcodeInput("");
        setStatusMessage({ type: "success", text: `Scanned: ${matched.name}` });
      }
    } else {
      setStatusMessage({ type: "error", text: `No product found matching barcode "${code}".` });
      setBarcodeInput("");
    }
  };

  // Financial Calculations & Promotions Engine Evaluation
  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  // Evaluate active promotions against cart
  const cartEvalItems: CartEvaluationItem[] = cart.map((item) => {
    const prod = products.find((p) => p._id === item.productId);
    const catId = typeof prod?.categoryId === "object" ? prod?.categoryId?._id : prod?.categoryId;
    return {
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      categoryId: catId,
      subtotal: item.unitPrice * item.quantity,
    };
  });

  const promoResult = evaluatePromotions(
    cartEvalItems,
    subtotal,
    promotions,
    couponCode || undefined
  );

  // Evaluate loyalty points redemption
  const customerAvailablePoints = matchedCustomer?.loyaltyPoints || 0;
  const billAfterPromo = Math.max(0, subtotal - promoResult.totalPromoDiscount - orderDiscount);
  const maxUsablePoints = Math.min(
    customerAvailablePoints,
    Math.floor(billAfterPromo / (loyaltySettings.redemptionRate || 1))
  );
  const pointsToRedeem = redeemLoyaltyPoints
    ? pointsToRedeemInput > 0
      ? Math.min(pointsToRedeemInput, customerAvailablePoints)
      : maxUsablePoints
    : 0;

  const loyaltyResult = calculateLoyaltyRedemptionDiscount(
    pointsToRedeem,
    customerAvailablePoints,
    billAfterPromo,
    loyaltySettings
  );

  const totalDiscount = Math.round((orderDiscount + promoResult.totalPromoDiscount + (redeemLoyaltyPoints ? loyaltyResult.discountAmount : 0)) * 100) / 100;

  // Sri Lanka Tax Calculation
  const isTaxEnabled = business?.taxSettings?.enabled || false;
  const taxRate = isTaxEnabled ? business?.taxSettings?.rate || 0 : 0;
  const isExclusive = business?.taxSettings?.type === "EXCLUSIVE";

  let taxAmount = 0;
  let netTotal = Math.max(0, subtotal - totalDiscount);

  if (isTaxEnabled) {
    if (isExclusive) {
      taxAmount = (netTotal * taxRate) / 100;
      netTotal += taxAmount;
    } else {
      // Inclusive: tax is already inside the price
      taxAmount = (netTotal * taxRate) / (100 + taxRate);
    }
  }

  // Customer VIP Tier & Birthday Month Multipliers
  const customerTier: "REGULAR" | "SILVER" | "GOLD" | "PLATINUM" = matchedCustomer?.loyaltyTier || "REGULAR";
  const tierMultiplier =
    customerTier === "PLATINUM" ? 2.0 : customerTier === "GOLD" ? 1.5 : customerTier === "SILVER" ? 1.25 : 1.0;
  const isBirthdayMonth = matchedCustomer?.dateOfBirth
    ? new Date(matchedCustomer.dateOfBirth).getUTCMonth() === new Date().getUTCMonth()
    : false;
  const birthdayMultiplier = isBirthdayMonth ? 2.0 : 1.0;
  const totalLoyaltyMultiplier = tierMultiplier * birthdayMultiplier;

  // Points that will be earned on this transaction (with tier multiplier & birthday bonus)
  const basePointsEarned = calculateLoyaltyPointsEarned(netTotal, loyaltySettings);
  const pointsEarnedOnSale = Math.floor(basePointsEarned * totalLoyaltyMultiplier);

  // Cash Change Calculation
  const cashGivenNum = parseFloat(cashReceived) || 0;
  const changeDue = Math.max(0, cashGivenNum - netTotal);

  // Fast cash buttons
  const quickCashOptions = [
    Math.ceil(netTotal),
    Math.ceil(netTotal / 500) * 500 || 500,
    1000,
    2000,
    5000,
  ].filter((val, idx, self) => val >= netTotal && self.indexOf(val) === idx);

  // Foreign & Multi-Currency Dual-Tender Calculations
  const activeForeignCurrencies = currencySettings.enabled
    ? currencySettings.currencies.filter((c) => c.isEnabled && c.code !== "LKR")
    : [];

  const selectedCurrencyConfig =
    tenderCurrency === "LKR"
      ? null
      : currencySettings.currencies.find((c) => c.code === tenderCurrency);

  const currentExchangeRate = selectedCurrencyConfig?.exchangeRate || 1;
  const foreignAmountDue =
    tenderCurrency !== "LKR" && currentExchangeRate > 0
      ? convertLkrToForeign(netTotal, currentExchangeRate)
      : 0;

  const foreignCashReceivedNum = parseFloat(foreignCashReceived) || 0;
  const foreignTenderCalc = calculateForeignTenderChange(
    foreignCashReceivedNum,
    foreignAmountDue,
    currentExchangeRate
  );
  const foreignChangeLkr = foreignTenderCalc.changeLkr;

  // Quick foreign banknote options
  const quickForeignOptions = selectedCurrencyConfig
    ? [
        Math.ceil(foreignAmountDue),
        Math.ceil(foreignAmountDue / 5) * 5 || 5,
        Math.ceil(foreignAmountDue / 10) * 10 || 10,
        20,
        50,
        100,
      ].filter(
        (val, idx, self) =>
          val >= foreignAmountDue &&
          self.indexOf(val) === idx &&
          val <= (foreignAmountDue > 100 ? foreignAmountDue * 2 : 200)
      )
    : [];

  // Customer Facing Display (CFD) Synchronization via BroadcastChannel
  useEffect(() => {
    const channel = createCFDBroadcastChannel();
    if (channel) {
      cfdChannelRef.current = channel;

      channel.onmessage = (event: MessageEvent<CFDMessage>) => {
        if (event.data?.type === "SYNC_REQUEST") {
          channel.postMessage({
            type: "SYNC_STATE",
            state: {
              status: cart.length > 0 ? (isCheckoutOpen ? "CHECKOUT" : "SCANNING") : "IDLE",
              businessName: business?.name || "Corner Store POS",
              registerName: selectedRegister?.name || "Register 01",
              cashierName: (session?.user as any)?.name || "Cashier",
              welcomeMessage: business?.hardwareSettings?.customerDisplay?.welcomeMessage,
              promotionalMessage: business?.hardwareSettings?.customerDisplay?.promotionalMessage,
              items: cart.map((item) => ({
                id: item.productId,
                name: item.name,
                nameSi: item.nameSinhala,
                nameTa: item.nameTamil,
                price: item.unitPrice,
                quantity: item.quantity,
                unit: item.unit,
                isWeighable: item.isWeighable,
                tareWeightGrams: item.tareWeightGrams,
                lineTotal: Math.round(item.unitPrice * item.quantity * 100) / 100,
                discountAmount: item.discount,
              })),
              subtotal,
              discountTotal: totalDiscount,
              taxTotal: taxAmount,
              grandTotal: netTotal,
              currency: business?.currency || "LKR",
              lastUpdated: Date.now(),
            },
          });
        }
      };
    }

    return () => {
      channel?.close();
    };
  }, [cart, isCheckoutOpen, business, selectedRegister, session, subtotal, totalDiscount, taxAmount, netTotal]);

  useEffect(() => {
    if (!cfdChannelRef.current) return;
    if (cart.length === 0) {
      if (!completedSale) {
        cfdChannelRef.current.postMessage({ type: "RESET_IDLE" });
      }
    } else {
      cfdChannelRef.current.postMessage({
        type: "CART_UPDATE",
        state: {
          status: isCheckoutOpen ? "CHECKOUT" : "SCANNING",
          businessName: business?.name || "Corner Store POS",
          registerName: selectedRegister?.name || "Register 01",
          cashierName: (session?.user as any)?.name || "Cashier",
          welcomeMessage: business?.hardwareSettings?.customerDisplay?.welcomeMessage,
          promotionalMessage: business?.hardwareSettings?.customerDisplay?.promotionalMessage,
          items: cart.map((item) => ({
            id: item.productId,
            name: item.name,
            nameSi: item.nameSinhala,
            nameTa: item.nameTamil,
            price: item.unitPrice,
            quantity: item.quantity,
            unit: item.unit,
            isWeighable: item.isWeighable,
            tareWeightGrams: item.tareWeightGrams,
            lineTotal: Math.round(item.unitPrice * item.quantity * 100) / 100,
            discountAmount: item.discount,
          })),
          subtotal,
          discountTotal: totalDiscount,
          taxTotal: taxAmount,
          grandTotal: netTotal,
          currency: business?.currency || "LKR",
          lastUpdated: Date.now(),
        },
      });
    }
  }, [cart, subtotal, totalDiscount, taxAmount, netTotal, isCheckoutOpen, business, selectedRegister, session, completedSale]);

  // Open Checkout Modal
  const openCheckout = () => {
    if (cart.length === 0) {
      setStatusMessage({ type: "error", text: "Cart is empty. Add products to proceed." });
      return;
    }

    const subStatus = business?.subscription?.status;
    if (subStatus === "SUSPENDED" || subStatus === "EXPIRED") {
      setStatusMessage({
        type: "error",
        text: `Store License ${subStatus}: Counter billing is temporarily paused. Please contact platform support at 077 123 4567 to renew.`,
      });
      return;
    }

    if (!currentShift) {
      if (
        confirm(
          "No active shift is open on this counter. Would you like to open a shift with an initial float now?"
        )
      ) {
        setIsOpenShiftModalOpen(true);
        return;
      }
    }

    // High cashier discount supervisor action gate check
    const isHighDiscount = orderDiscount > 0 && subtotal > 0 && (((orderDiscount / subtotal) * 100 > 5) || orderDiscount > 500);
    const userRole = session?.user?.role;
    if (isHighDiscount && !isDiscountAuthorized && userRole === "CASHIER") {
      setOverrideModal({
        isOpen: true,
        action: "HIGH_DISCOUNT",
        actionDescription: `Cashier discount of ${formatCurrency(orderDiscount)} (${Math.round((orderDiscount / subtotal) * 100)}%) exceeds standard cashier limit (5% or Rs. 500)`,
        details: { orderDiscount, subtotal, discountPercent: Math.round((orderDiscount / subtotal) * 100) },
        onApproved: (supervisor) => {
          setIsDiscountAuthorized(true);
          setStatusMessage({
            type: "success",
            text: `Discount of ${formatCurrency(orderDiscount)} authorized by ${supervisor.name} (${supervisor.role}).`,
          });
          setCashReceived(Math.ceil(netTotal).toString());
          setTenderCurrency("LKR");
          setForeignCashReceived("");
          setValidatedCreditNote(null);
          setCreditNoteCodeInput("");
          setCreditNoteError(null);
          setValidatedGiftVoucher(null);
          setGiftVoucherCodeInput("");
          setGiftVoucherError(null);
          setIsCheckoutOpen(true);
        },
      });
      return;
    }

    setCashReceived(Math.ceil(netTotal).toString());
    setTenderCurrency("LKR");
    setForeignCashReceived("");
    setValidatedCreditNote(null);
    setCreditNoteCodeInput("");
    setCreditNoteError(null);
    setValidatedGiftVoucher(null);
    setGiftVoucherCodeInput("");
    setGiftVoucherError(null);
    setIsCheckoutOpen(true);
  };

  // Validate Credit Note voucher code
  const validateCreditNoteCode = async () => {
    if (!creditNoteCodeInput.trim()) return;
    setValidatingCreditNote(true);
    setCreditNoteError(null);
    setValidatedCreditNote(null);
    try {
      const res = await fetch(
        `/api/credit-notes?code=${encodeURIComponent(creditNoteCodeInput.trim().toUpperCase())}`
      );
      const data = await res.json();
      if (data.success && data.valid && data.creditNote) {
        if (data.creditNote.remainingBalance < netTotal) {
          setCreditNoteError(
            `Voucher has Rs. ${data.creditNote.remainingBalance.toFixed(2)}, which is less than bill total of Rs. ${netTotal.toFixed(2)}.`
          );
        }
        setValidatedCreditNote(data.creditNote);
      } else {
        setCreditNoteError(data.error || "Invalid or expired credit note voucher.");
      }
    } catch (err: any) {
      setCreditNoteError("Failed to validate credit note.");
    } finally {
      setValidatingCreditNote(false);
    }
  };

  // Validate Gift Voucher code
  const validateGiftVoucherCode = async () => {
    if (!giftVoucherCodeInput.trim()) return;
    setValidatingGiftVoucher(true);
    setGiftVoucherError(null);
    setValidatedGiftVoucher(null);
    try {
      const res = await fetch(
        `/api/gift-vouchers/${encodeURIComponent(giftVoucherCodeInput.trim().toUpperCase())}`
      );
      const data = await res.json();
      if (data.success && data.voucher) {
        if (data.voucher.status !== "ACTIVE") {
          setGiftVoucherError(`Gift voucher is ${data.voucher.status.toLowerCase()} and cannot be used.`);
        } else if (new Date(data.voucher.expiryDate) < new Date()) {
          setGiftVoucherError("Gift voucher has expired.");
        } else if (data.voucher.currentBalance <= 0) {
          setGiftVoucherError("Gift voucher balance is Rs. 0.00.");
        } else {
          setValidatedGiftVoucher(data.voucher);
        }
      } else {
        setGiftVoucherError(data.error || "Invalid or non-existent gift voucher.");
      }
    } catch (err: any) {
      setGiftVoucherError("Failed to validate gift voucher.");
    } finally {
      setValidatingGiftVoucher(false);
    }
  };

  // Complete Sale Submission (with offline fallback and automatic queueing)
  const handleCompleteSale = async () => {
    if (paymentMethod === "CASH") {
      if (tenderCurrency === "LKR" && cashGivenNum < netTotal) {
        alert(`Cash received (Rs. ${cashGivenNum}) is less than total bill (Rs. ${netTotal.toFixed(2)}).`);
        return;
      }
      if (tenderCurrency !== "LKR" && foreignCashReceivedNum < foreignAmountDue) {
        alert(
          `Foreign cash received (${selectedCurrencyConfig?.symbol || ""}${foreignCashReceivedNum}) is less than total foreign bill (${selectedCurrencyConfig?.symbol || ""}${foreignAmountDue.toFixed(2)} ${tenderCurrency}).`
        );
        return;
      }
    }

    if (paymentMethod === "CREDIT_NOTE") {
      if (!validatedCreditNote) {
        alert("Please enter and validate an active Credit Note voucher first.");
        return;
      }
      if (validatedCreditNote.remainingBalance < netTotal) {
        alert(
          `Credit Note balance (Rs. ${validatedCreditNote.remainingBalance.toFixed(2)}) is insufficient for this sale total of Rs. ${netTotal.toFixed(2)}.`
        );
        return;
      }
    }

    if (paymentMethod === "GIFT_VOUCHER") {
      if (!validatedGiftVoucher) {
        alert("Please enter and validate an active Gift Voucher first.");
        return;
      }
      if (validatedGiftVoucher.currentBalance < netTotal) {
        alert(
          `Gift Voucher balance (Rs. ${validatedGiftVoucher.currentBalance.toFixed(2)}) is insufficient for this sale total of Rs. ${netTotal.toFixed(2)}.`
        );
        return;
      }
    }

    if (paymentMethod === "CREDIT") {
      if (!matchedCustomer) {
        alert("Store Credit (Naya Potha) requires a registered customer with credit permissions. Please search or enter a registered customer phone number.");
        return;
      }
      if (!matchedCustomer.creditAllowed) {
        alert(`${matchedCustomer.name} is not permitted for credit purchases. Please enable credit allowance in Customer settings.`);
        return;
      }
      const projectedBalance = (matchedCustomer.currentBalance || 0) + netTotal;
      if (projectedBalance > (matchedCustomer.creditLimit || 0)) {
        alert(
          `Credit limit exceeded!\nCustomer Limit: ${formatCurrency(matchedCustomer.creditLimit)}\nCurrent Balance: ${formatCurrency(matchedCustomer.currentBalance || 0)}\nBill Total: ${formatCurrency(netTotal)}\nExcess: ${formatCurrency(projectedBalance - matchedCustomer.creditLimit)}`
        );
        return;
      }
    }

    setSubmittingSale(true);

    const regNameFormatted = selectedRegister
      ? `${selectedRegister.registerNumber} - ${selectedRegister.name}`
      : undefined;

    const salePayload = {
      shiftId: currentShift?._id,
      registerId: selectedRegister?._id,
      registerName: regNameFormatted,
      customerId: matchedCustomer?._id,
      billingType: billingMode,
      isTaxInvoice,
      buyerDetails:
        isTaxInvoice || matchedCustomer
          ? {
              companyName:
                buyerCompanyName.trim() ||
                (matchedCustomer as any)?.companyName ||
                customerName.trim() ||
                undefined,
              tin: buyerTin.trim() || (matchedCustomer as any)?.tin || undefined,
              vatNumber: buyerVatNumber.trim() || (matchedCustomer as any)?.vatNumber || undefined,
              phone: customerPhone.trim() || undefined,
            }
          : undefined,
      items: cart.map((item) => ({
        productId: item.productId,
        name: item.name,
        nameSinhala: item.nameSinhala,
        nameTamil: item.nameTamil,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        total: item.unitPrice * item.quantity - (item.discount || 0),
        priceTier: billingMode,
        batchId: item.batchId || undefined,
      })),
      customerName: customerName.trim() || "Walk-in Customer",
      customerPhone: customerPhone.trim() || undefined,
      salesRepId: selectedSalesRepId || undefined,
      salesRepName: salesReps.find((s) => s._id === selectedSalesRepId)?.name || undefined,
      discountTotal: totalDiscount,
      paymentMethod,
      tenderCurrency: paymentMethod === "CASH" ? tenderCurrency : "LKR",
      exchangeRate: paymentMethod === "CASH" && tenderCurrency !== "LKR" ? currentExchangeRate : undefined,
      foreignAmount: paymentMethod === "CASH" && tenderCurrency !== "LKR" ? foreignAmountDue : undefined,
      foreignCashReceived: paymentMethod === "CASH" && tenderCurrency !== "LKR" ? foreignCashReceivedNum : undefined,
      foreignChangeGiven: paymentMethod === "CASH" && tenderCurrency !== "LKR" ? foreignChangeLkr : undefined,
      foreignCurrencySymbol: paymentMethod === "CASH" && tenderCurrency !== "LKR" ? (selectedCurrencyConfig?.symbol || tenderCurrency) : undefined,
      cashReceived: paymentMethod === "CASH" ? (tenderCurrency !== "LKR" ? foreignCashReceivedNum * currentExchangeRate : cashGivenNum) : undefined,
      changeGiven: paymentMethod === "CASH" ? (tenderCurrency !== "LKR" ? foreignChangeLkr : changeDue) : undefined,
      paymentReference: paymentReference.trim() || undefined,
      creditNoteNumber:
        paymentMethod === "CREDIT_NOTE" && validatedCreditNote
          ? validatedCreditNote.creditNoteNumber
          : undefined,
      giftVoucherCode:
        paymentMethod === "GIFT_VOUCHER" && validatedGiftVoucher
          ? validatedGiftVoucher.code
          : undefined,
      giftVoucherAmount:
        paymentMethod === "GIFT_VOUCHER" && validatedGiftVoucher
          ? Math.min(validatedGiftVoucher.currentBalance, netTotal)
          : undefined,
      subtotal,
      taxTotal: taxAmount,
      netTotal,
      pointsRedeemed: redeemLoyaltyPoints ? pointsToRedeem : 0,
      loyaltyDiscount: redeemLoyaltyPoints ? loyaltyResult.discountAmount : 0,
      appliedPromotions: promoResult.appliedPromotions,
    };

    // Fallback: Record sale locally in offline queue and update local counter stock
    const recordOfflineSale = () => {
      const offlineId = `off_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const tempInvoiceNumber = `OFFLINE-INV-${Date.now().toString().slice(-6)}`;
      const nowIso = new Date().toISOString();

      const offlineRecord: OfflineSaleRecord = {
        offlineId,
        shiftId: currentShift?._id,
        registerId: selectedRegister?._id,
        registerName: regNameFormatted,
        customerId: matchedCustomer?._id,
        items: salePayload.items,
        customerName: salePayload.customerName,
        customerPhone: salePayload.customerPhone,
        discountTotal: salePayload.discountTotal,
        paymentMethod: salePayload.paymentMethod as any,
        cashReceived: salePayload.cashReceived,
        changeGiven: salePayload.changeGiven,
        tenderCurrency: salePayload.tenderCurrency,
        exchangeRate: salePayload.exchangeRate,
        foreignAmount: salePayload.foreignAmount,
        foreignCashReceived: salePayload.foreignCashReceived,
        foreignChangeGiven: salePayload.foreignChangeGiven,
        foreignCurrencySymbol: salePayload.foreignCurrencySymbol,
        paymentReference: salePayload.paymentReference,
        creditNoteNumber: salePayload.creditNoteNumber,
        giftVoucherCode: salePayload.giftVoucherCode,
        giftVoucherAmount: salePayload.giftVoucherAmount,
        subtotal: salePayload.subtotal,
        taxTotal: salePayload.taxTotal,
        netTotal: salePayload.netTotal,
        createdAt: nowIso,
        tempInvoiceNumber,
      };

      // 1. Enqueue in offline local storage
      enqueueOfflineSale(businessId, offlineRecord);

      // 2. Decrement local stock cache
      decrementLocalStockCache(
        businessId,
        cart.map((item) => ({ productId: item.productId, quantity: item.quantity }))
      );

      // 3. Update in-memory products state
      setProducts((prev) => {
        const soldMap = new Map(cart.map((i) => [i.productId, i.quantity]));
        return prev.map((p) => {
          const soldQty = soldMap.get(p._id);
          if (soldQty) {
            return { ...p, stockQuantity: Math.max(0, p.stockQuantity - soldQty) };
          }
          return p;
        });
      });

      // 4. Set completedSale for receipt modal & printing
      const completedSaleObj = {
        _id: offlineId,
        offlineId,
        invoiceNumber: tempInvoiceNumber,
        cashierName: session?.user?.name || "Cashier",
        registerName: regNameFormatted,
        registerNumber: selectedRegister?.registerNumber,
        customerId: matchedCustomer?._id,
        customerName: offlineRecord.customerName,
        customerPhone: offlineRecord.customerPhone,
        items: salePayload.items,
        subtotal,
        discountTotal: totalDiscount,
        taxTotal: taxAmount,
        netTotal,
        paymentMethod,
        tenderCurrency: salePayload.tenderCurrency,
        exchangeRate: salePayload.exchangeRate,
        foreignAmount: salePayload.foreignAmount,
        foreignCashReceived: salePayload.foreignCashReceived,
        foreignChangeGiven: salePayload.foreignChangeGiven,
        foreignCurrencySymbol: salePayload.foreignCurrencySymbol,
        cashReceived: salePayload.cashReceived,
        changeGiven: salePayload.changeGiven,
        pointsEarned: pointsEarnedOnSale,
        pointsRedeemed: redeemLoyaltyPoints ? pointsToRedeem : 0,
        loyaltyDiscount: redeemLoyaltyPoints ? loyaltyResult.discountAmount : 0,
        appliedPromotions: promoResult.appliedPromotions,
        giftVoucherRedeemed:
          paymentMethod === "GIFT_VOUCHER" && validatedGiftVoucher
            ? {
                code: validatedGiftVoucher.code,
                amount: Math.min(validatedGiftVoucher.currentBalance, netTotal),
                remainingBalance: Math.max(0, validatedGiftVoucher.currentBalance - netTotal),
              }
            : undefined,
        createdAt: nowIso,
        isOffline: true,
      };

      if (paymentMethod === "CREDIT" && matchedCustomer) {
        setMatchedCustomer((prev: any) =>
          prev ? { ...prev, currentBalance: (prev.currentBalance || 0) + netTotal } : null
        );
      }

      setCompletedSale(completedSaleObj);
      setWhatsappPhoneInput(offlineRecord.customerPhone || customerPhone || "");
      setShowWhatsAppSection(Boolean(offlineRecord.customerPhone || customerPhone));

      // Kick cash drawer on cash payment
      if (paymentMethod === "CASH") {
        triggerCashDrawerKick({
          pin: (business?.hardwareSettings?.cashDrawer?.kickPin as any) || "PIN2",
          audioFeedback: true,
        }).catch(console.error);
      }

      // Notify Customer Facing Display (CFD)
      cfdChannelRef.current?.postMessage({
        type: "SALE_COMPLETED",
        payment: {
          method: paymentMethod,
          tendered: cashGivenNum > 0 ? cashGivenNum : netTotal,
          change: changeDue,
          receiptNumber: tempInvoiceNumber,
        },
      });

      setIsCheckoutOpen(false);
      setCart([]);
      setOrderDiscount(0);
      setCouponCode("");
      setCouponInput("");
      setRedeemLoyaltyPoints(false);
      setPointsToRedeemInput(0);
      setValidatedGiftVoucher(null);
      setGiftVoucherCodeInput("");
      setGiftVoucherError(null);
      refreshQueueCount();
      if (selectedRegister?._id) fetchCurrentShift(selectedRegister._id);

      setStatusMessage({
        type: "success",
        text: `Offline Sale Recorded (${tempInvoiceNumber}): Stored safely on counter device. Ready for printing & queued for cloud sync.`,
      });
    };

    // If counter is already marked offline, bypass HTTP request immediately
    if (!isOnline) {
      recordOfflineSale();
      setSubmittingSale(false);
      return;
    }

    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(salePayload),
      });

      const data = await res.json();

      if (data.success) {
        setCompletedSale(data.sale);
        setWhatsappPhoneInput(data.sale.customerPhone || customerPhone || "");
        setShowWhatsAppSection(Boolean(data.sale.customerPhone || customerPhone));

        // Kick cash drawer on cash payment
        if (paymentMethod === "CASH") {
          triggerCashDrawerKick({
            pin: (business?.hardwareSettings?.cashDrawer?.kickPin as any) || "PIN2",
            audioFeedback: true,
          }).catch(console.error);
        }

        // Notify Customer Facing Display (CFD)
        cfdChannelRef.current?.postMessage({
          type: "SALE_COMPLETED",
          payment: {
            method: paymentMethod,
            tendered: cashGivenNum > 0 ? cashGivenNum : netTotal,
            change: changeDue,
            receiptNumber: data.sale.invoiceNumber,
            receiptUrl: typeof window !== "undefined" ? `${window.location.origin}/pos/receipt/${data.sale._id}` : undefined,
          },
        });

        if (paymentMethod === "CREDIT" && matchedCustomer) {
          setMatchedCustomer((prev: any) =>
            prev ? { ...prev, currentBalance: (prev.currentBalance || 0) + netTotal } : null
          );
        }
        setIsCheckoutOpen(false);
        setCart([]);
        setOrderDiscount(0);
        setCouponCode("");
        setCouponInput("");
        setRedeemLoyaltyPoints(false);
        setPointsToRedeemInput(0);
        setValidatedGiftVoucher(null);
        setGiftVoucherCodeInput("");
        setGiftVoucherError(null);
        // Refresh product stock & active shift metrics
        loadInitialData();
        if (selectedRegister?._id) fetchCurrentShift(selectedRegister._id);
      } else {
        alert(data.error || "Failed to complete sale.");
      }
    } catch (networkError) {
      console.warn("Network drop encountered during checkout; recording offline sale:", networkError);
      recordOfflineSale();
    } finally {
      setSubmittingSale(false);
    }
  };

  // Native Thermal Print Trigger
  const triggerPrint = () => {
    window.print();
  };

  // Filtered products list
  const filteredProducts = products.filter((p) => {
    const matchesCategory =
      selectedCategory === "all" ||
      (typeof p.categoryId === "object" ? p.categoryId?._id === selectedCategory : p.categoryId === selectedCategory);

    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.nameSinhala?.toLowerCase().includes(q) ||
      p.nameTamil?.toLowerCase().includes(q) ||
      p.barcode?.includes(q) ||
      p.sku?.toLowerCase().includes(q);

    return matchesCategory && matchesSearch;
  });

  return (
    <AppLayout>
      <div className="h-[calc(100vh-3.5rem)] md:h-screen flex flex-col lg:flex-row overflow-hidden bg-slate-100">
        {/* ================= LEFT SIDE (60%): PRODUCTS & BARCODE ================= */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-slate-200 bg-white">
          {/* Top Bar: Barcode Scanner & Search */}
          <div className="p-3 sm:p-4 border-b border-slate-200 bg-slate-50/80 space-y-2.5">
            <div className="flex items-center gap-2">
              {/* Barcode Scanner Input Form */}
              <form onSubmit={handleBarcodeSubmit} className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-emerald-600">
                  <Barcode className="w-5 h-5" />
                </div>
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Scan barcode with USB scanner (or press F2)..."
                  className="w-full pl-10 pr-20 py-2.5 bg-white border-2 border-emerald-500/80 rounded-xl text-xs sm:text-sm font-mono placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 shadow-sm"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700"
                >
                  Scan
                </button>
              </form>

              {/* Text Search */}
              <div className="w-36 sm:w-56 relative hidden sm:block">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("pos.searchPlaceholder") || "Search item..."}
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Wholesale / Retail Counter Mode Toggle */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggleBillingMode("RETAIL")}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
                    billingMode === "RETAIL"
                      ? "bg-white text-slate-800 shadow-2xs font-bold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  title="Standard retail pricing counter"
                >
                  {t("pos.retailPrice") || "Retail"}
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleBillingMode("WHOLESALE")}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                    billingMode === "WHOLESALE"
                      ? "bg-amber-500 text-white shadow-2xs font-bold"
                      : "text-amber-700 hover:text-amber-800"
                  }`}
                  title="Wholesale B2B counter mode: applies wholesale unit prices"
                >
                  <Building2 className="w-3 h-3" />
                  {t("pos.wholesalePrice") || "Wholesale"}
                </button>
              </div>

              {/* Register / Terminal Selector */}
              {registers.length > 0 && (
                <div className="flex items-center shrink-0">
                  <div
                    className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-xs bg-white border border-slate-300 shadow-2xs hover:border-slate-400"
                    title="Current Terminal / Counter Assignment"
                  >
                    <Monitor className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <select
                      value={selectedRegister?._id || ""}
                      onChange={(e) => {
                        const found = registers.find((r) => r._id === e.target.value);
                        if (found) {
                          setSelectedRegister(found);
                          if (typeof window !== "undefined") {
                            localStorage.setItem(`slpos_${businessId}_register`, found._id);
                          }
                        }
                      }}
                      className="bg-transparent border-none text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer max-w-[110px] sm:max-w-[140px] truncate"
                    >
                      {registers.map((r) => (
                        <option key={r._id} value={r._id}>
                          {r.registerNumber}: {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Shift & Cash Drawer Status Pill */}
              <div className="flex items-center shrink-0">
                {currentShift ? (
                  <button
                    type="button"
                    onClick={() => setIsShiftModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-900 border border-emerald-300 shadow-2xs hover:bg-emerald-100 transition"
                    title="Active Shift - Click to manage Cash Drawer, record cash drops, print X-Report, or close shift"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <Clock className="w-3.5 h-3.5 text-emerald-700" />
                    <span className="font-mono font-bold">{currentShift.shiftNumber}</span>
                    <span className="hidden sm:inline text-emerald-400 font-normal">|</span>
                    <span className="hidden sm:inline font-mono font-bold text-emerald-950">
                      {formatCurrency(currentShift.expectedCash ?? currentShift.openingFloat)}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsOpenShiftModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-300 shadow-2xs hover:bg-amber-100 transition animate-pulse"
                    title="No active shift open on this counter. Click to open shift with float."
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    <span className="font-bold">Open Shift</span>
                  </button>
                )}
              </div>

              {/* Hardware Peripherals: Weigh Scale, Drawer F9, CFD */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setWeighModalInitialProduct(null);
                    setIsWeighModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-300 shadow-2xs hover:bg-teal-100 transition"
                  title="Electronic Weighing Scale & Produce Station"
                >
                  <Scale className="w-3.5 h-3.5 text-teal-600" />
                  <span className="hidden xl:inline">Scale</span>
                </button>

                <button
                  type="button"
                  onClick={handleNoSaleDrawerKick}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs hover:bg-amber-100 transition"
                  title="Kick Cash Drawer (F9)"
                >
                  <Unlock className="w-3.5 h-3.5 text-amber-600" />
                  <span className="hidden xl:inline">Drawer (F9)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    window.open(
                      "/pos/customer-display",
                      "cfd_window",
                      "width=1024,height=768,menubar=no,toolbar=no,location=no,status=no"
                    );
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-300 shadow-2xs hover:bg-indigo-100 transition"
                  title="Pop Out Customer Facing Display (CFD) for Secondary Monitor"
                >
                  <Monitor className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="hidden xl:inline">CFD</span>
                </button>
              </div>

              {/* Network Status & Offline Resilience Queue */}
              <div className="flex items-center gap-1.5 shrink-0">
                {isOnline ? (
                  <span
                    title="Counter connected to cloud services"
                    className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <Wifi className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Online</span>
                  </span>
                ) : (
                  <span
                    title="Network drop detected. Operating safely in offline mode."
                    className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-300 shadow-2xs animate-pulse"
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                    <span>Offline</span>
                  </span>
                )}

                {queuedCount > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await syncQueuedSales();
                      if (res && res.syncedCount > 0) {
                        setStatusMessage({
                          type: "success",
                          text: `Synced ${res.syncedCount} queued sale(s) with cloud database!`,
                        });
                        loadInitialData();
                      } else if (!isOnline) {
                        setStatusMessage({
                          type: "error",
                          text: "Internet connection is down. Queued sales remain safe locally and will sync when reconnected.",
                        });
                      }
                    }}
                    disabled={isSyncing}
                    title="Click to trigger manual cloud sync of locally queued counter sales"
                    className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition shadow-sm disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                    <span>{queuedCount} Queued</span>
                    <span className="hidden xl:inline text-[10px] font-normal opacity-90">• Sync</span>
                  </button>
                )}
              </div>

              {/* Language Switcher on POS Top Bar */}
              <div className="shrink-0 pl-1 border-l border-slate-200">
                <LanguageSwitcher />
              </div>
            </div>

            {/* Category Filter Horizontal Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
              <button
                onClick={() => setSelectedCategory("all")}
                className={`px-3 py-1.5 rounded-lg font-semibold shrink-0 transition-colors ${
                  selectedCategory === "all"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {t("pos.allCategories") || "All Products"}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat._id}
                  onClick={() => setSelectedCategory(cat._id)}
                  style={{
                    borderColor: selectedCategory === cat._id ? cat.color || "#3b82f6" : undefined,
                  }}
                  className={`px-3 py-1.5 rounded-lg font-medium shrink-0 transition-all border ${
                    selectedCategory === cat._id
                      ? "bg-blue-600 text-white font-semibold shadow-sm"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Feedback Toast */}
          {statusMessage && (
            <div
              className={`px-4 py-2 text-xs flex items-center justify-between border-b ${
                statusMessage.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-rose-50 text-rose-800 border-rose-200"
              }`}
            >
              <div className="flex items-center gap-2 font-medium">
                {statusMessage.type === "success" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                )}
                <span>{statusMessage.text}</span>
              </div>
              <button onClick={() => setStatusMessage(null)}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Product Grid (Large touch/click friendly cards) */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4">
            {loading ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                Loading products catalog...
              </div>
            ) : filteredProducts.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
                {filteredProducts.map((p) => {
                  const isOut = p.stockQuantity <= 0;
                  const isLow = p.stockQuantity <= 5 && !isOut;

                  return (
                    <button
                      key={p._id}
                      onClick={() => {
                        if (p.isWeighable) {
                          setWeighModalInitialProduct(p);
                          setIsWeighModalOpen(true);
                        } else {
                          addToCart(p);
                        }
                      }}
                      disabled={isOut}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all group relative overflow-hidden ${
                        isOut
                          ? "opacity-50 bg-slate-50 border-slate-200 cursor-not-allowed"
                          : "bg-white border-slate-200 hover:border-blue-500 hover:shadow-md active:scale-[0.98]"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] text-slate-400 font-mono block">
                            {p.barcode ? `EAN: ${p.barcode}` : p.sku || "RETAIL"}
                          </span>
                          <div className="flex items-center gap-1">
                            {p.isWeighable && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 flex items-center gap-0.5">
                                <Scale className="w-2.5 h-2.5" /> Scale
                              </span>
                            )}
                            {p.isBatchTracked && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                FEFO
                              </span>
                            )}
                          </div>
                        </div>
                        <h4 className="font-semibold text-slate-800 text-xs sm:text-sm line-clamp-2 mt-0.5 leading-tight group-hover:text-blue-600">
                          {language === "si" && p.nameSinhala
                            ? p.nameSinhala
                            : language === "ta" && p.nameTamil
                            ? p.nameTamil
                            : p.name}
                        </h4>
                        {((language === "si" && p.nameSinhala) || (language === "ta" && p.nameTamil)) ? (
                          <span className="text-[10px] text-slate-400 block truncate font-mono">
                            {p.name}
                          </span>
                        ) : (p.nameSinhala || p.nameTamil) ? (
                          <span className="text-[10px] text-slate-400 block truncate font-sans">
                            {[p.nameSinhala, p.nameTamil].filter(Boolean).join(" • ")}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-end justify-between">
                        <div>
                          <span className="text-xs sm:text-sm font-bold text-slate-900 font-mono block">
                            {formatCurrency(p.sellingPrice)}
                          </span>
                          <span className="text-[10px] text-slate-400 capitalize">per {p.unit}</span>
                        </div>

                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            isOut
                              ? "bg-rose-100 text-rose-800"
                              : isLow
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {isOut ? "Out" : `${p.stockQuantity} left`}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs p-6 text-center">
                <Search className="w-8 h-8 text-slate-300 mb-2" />
                <p>No products match your search or filter.</p>
              </div>
            )}
          </div>
        </div>

        {/* ================= RIGHT SIDE (40%): CHECKOUT CART ================= */}
        <div className="w-full lg:w-[420px] xl:w-[460px] bg-white flex flex-col h-full shadow-lg border-t lg:border-t-0 border-slate-200 z-10">
          {/* Cart Header */}
          <div className="p-3 sm:p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-blue-600" />
              <h2 className="font-bold text-sm text-slate-900">{t("pos.cart") || "Active Order"}</h2>
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-xs">
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleOpenLoadQuoteModal}
                className="text-[11px] text-purple-700 hover:text-purple-900 font-bold flex items-center gap-1 px-2 py-0.5 rounded border border-purple-200 bg-purple-50 hover:bg-purple-100 transition shadow-2xs"
                title="Load Approved Quotation into Cart"
              >
                <FileSpreadsheet className="w-3 h-3" />
                <span>Quote</span>
              </button>

              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 ml-1"
                >
                  <Trash2 className="w-3 h-3" /> {t("pos.clearCart") || "Clear"}
                </button>
              )}
            </div>
          </div>

          {/* Customer Selection Bar */}
          <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2 text-xs">
            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer Name (Walk-in)"
              className="w-full bg-transparent text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
            />
            <input
              type="text"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Phone (07XXXXXXXX)"
              className="w-32 bg-transparent text-xs text-right font-mono text-slate-600 placeholder-slate-400 focus:outline-none"
            />
          </div>

          {/* Matched Customer Credit & Debt Indicator */}
          {matchedCustomer && (
            <div className="px-3 py-1.5 border-b border-amber-200/70 bg-amber-50/70 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5 min-w-0">
                <BookOpen className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span className="font-semibold text-slate-900 truncate max-w-[100px]">
                  {matchedCustomer.name}
                </span>
                {matchedCustomer.creditAllowed ? (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    (matchedCustomer.currentBalance || 0) > 0
                      ? "bg-rose-100 text-rose-800"
                      : "bg-emerald-100 text-emerald-800"
                  }`}>
                    Debt: {formatCurrency(matchedCustomer.currentBalance || 0)} / {formatCurrency(matchedCustomer.creditLimit || 0)}
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-600 shrink-0">
                    No Credit
                  </span>
                )}
              </div>
              {matchedCustomer.creditAllowed && (matchedCustomer.currentBalance || 0) > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setCreditSettlementAmount(matchedCustomer.currentBalance.toString());
                    setIsCreditSettlementOpen(true);
                  }}
                  className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] shrink-0 transition shadow-xs"
                >
                  Settle Debt
                </button>
              )}
            </div>
          )}

          {/* Matched Customer Loyalty Tier & Birthday Month Banner */}
          {matchedCustomer && (
            <div className="px-3 py-1.5 border-b border-indigo-100 bg-gradient-to-r from-indigo-50/80 to-purple-50/80 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                    customerTier === "PLATINUM"
                      ? "bg-purple-100 text-purple-800 border border-purple-300"
                      : customerTier === "GOLD"
                      ? "bg-amber-100 text-amber-800 border border-amber-300"
                      : customerTier === "SILVER"
                      ? "bg-slate-200 text-slate-800 border border-slate-300"
                      : "bg-blue-100 text-blue-800 border border-blue-200"
                  }`}
                >
                  VIP {customerTier} ({tierMultiplier}x)
                </span>
                <span className="text-slate-600 font-medium flex items-center gap-1">
                  <Award className="w-3 h-3 text-amber-500" />
                  <strong>{matchedCustomer.loyaltyPoints || 0}</strong> pts
                </span>
                {isBirthdayMonth && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-pink-100 text-pink-700 border border-pink-200 flex items-center gap-1 animate-pulse">
                    🎂 Birthday Month (2x Bonus!)
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Cart Line Items List */}
          <div className="flex-1 overflow-y-auto p-3 divide-y divide-slate-100">
            {cart.length > 0 ? (
              cart.map((item) => (
                <div key={item.productId} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h5 className="font-semibold text-xs text-slate-800 truncate leading-tight">
                      {language === "si" && item.nameSinhala
                        ? item.nameSinhala
                        : language === "ta" && item.nameTamil
                        ? item.nameTamil
                        : item.name}
                    </h5>
                    {((language === "si" && item.nameSinhala) || (language === "ta" && item.nameTamil)) && (
                      <span className="text-[10px] text-slate-400 block truncate font-mono">
                        {item.name}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 font-mono">
                      {formatCurrency(item.unitPrice)} / {item.unit}
                      {item.isWeighable && (
                        <span className="ml-1 text-[9px] text-teal-600 font-semibold inline-flex items-center gap-0.5">
                          <Scale className="w-2.5 h-2.5" /> {item.quantity.toFixed(3)} kg
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="flex items-center gap-1 shrink-0 bg-slate-100 rounded-lg p-0.5">
                    <button
                      onClick={() =>
                        updateQuantity(
                          item.productId,
                          item.isWeighable
                            ? Math.max(0, Math.round((item.quantity - 0.1) * 1000) / 1000)
                            : item.quantity - 1
                        )
                      }
                      className="w-6 h-6 rounded flex items-center justify-center text-slate-600 hover:bg-white hover:text-slate-900 transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="min-w-[28px] px-1 text-center font-bold text-xs font-mono text-slate-900">
                      {item.isWeighable ? item.quantity.toFixed(3) : item.quantity}
                    </span>
                    <button
                      onClick={() =>
                        updateQuantity(
                          item.productId,
                          item.isWeighable
                            ? Math.round((item.quantity + 0.1) * 1000) / 1000
                            : item.quantity + 1
                        )
                      }
                      className="w-6 h-6 rounded flex items-center justify-center text-slate-600 hover:bg-white hover:text-slate-900 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Line Total & Remove */}
                  <div className="text-right shrink-0 min-w-[70px]">
                    <span className="font-bold text-xs text-slate-900 font-mono block">
                      {formatCurrency(item.unitPrice * item.quantity)}
                    </span>
                    <button
                      onClick={() => removeFromCart(item.productId)}
                      className="text-[10px] text-slate-400 hover:text-rose-600 mt-0.5"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs p-6 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-300">
                  <ShoppingCart className="w-6 h-6" />
                </div>
                <p className="font-medium text-slate-600">{t("pos.emptyCart") || "Your cart is empty"}</p>
                <p className="text-[11px] text-slate-400">
                  {t("pos.emptyCartPrompt") || "Scan a barcode or click any product on the left to start billing."}
                </p>
              </div>
            )}
          </div>

          {/* Financial Summary & Pay Action */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-2.5">
            {/* Coupon Code Input Row */}
            <div className="flex items-center gap-1.5 pb-1">
              <div className="relative flex-1">
                <Tag className="w-3 h-3 absolute left-2 top-2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Coupon Code (e.g. MEGA5)"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  className="w-full pl-6 pr-2 py-1 text-xs font-mono uppercase border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              {couponCode ? (
                <button
                  type="button"
                  onClick={() => {
                    setCouponCode("");
                    setCouponInput("");
                  }}
                  className="px-2 py-1 text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg"
                >
                  Clear
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setCouponCode(couponInput.trim().toUpperCase())}
                  disabled={!couponInput.trim()}
                  className="px-2.5 py-1 text-xs font-semibold bg-slate-800 text-white hover:bg-slate-900 rounded-lg disabled:opacity-40"
                >
                  Apply
                </button>
              )}
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>{t("pos.subtotal") || "Subtotal"}:</span>
                <span className="font-mono">{formatCurrency(subtotal)}</span>
              </div>

              {/* Applied Promotions Breakdown */}
              {promoResult.appliedPromotions.length > 0 && (
                <div className="space-y-1 py-1">
                  {promoResult.appliedPromotions.map((p, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center text-xs text-emerald-800 bg-emerald-50/80 px-2 py-1 rounded border border-emerald-100"
                    >
                      <span className="flex items-center gap-1 truncate pr-1">
                        <Tag className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span className="truncate">{p.name}:</span>
                      </span>
                      <span className="font-mono font-bold shrink-0">
                        -{formatCurrency(p.discountAmount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Loyalty Points Redeemed Row */}
              {redeemLoyaltyPoints && loyaltyResult.discountAmount > 0 && (
                <div className="flex justify-between items-center text-xs text-purple-800 bg-purple-50/80 px-2 py-1 rounded border border-purple-100">
                  <span className="flex items-center gap-1">
                    <Award className="w-3 h-3 text-purple-600 shrink-0" />
                    <span>Loyalty Rewards ({pointsToRedeem} pts):</span>
                  </span>
                  <span className="font-mono font-bold">
                    -{formatCurrency(loyaltyResult.discountAmount)}
                  </span>
                </div>
              )}

              {/* Manual Discount Row */}
              <div className="flex justify-between items-center text-slate-600">
                <span>{t("pos.discount") || "Cashier Discount"} (Rs.):</span>
                <input
                  type="number"
                  min="0"
                  max={subtotal}
                  value={orderDiscount || ""}
                  onChange={(e) => setOrderDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0.00"
                  className="w-20 px-2 py-0.5 text-right font-mono text-xs border border-slate-200 rounded bg-white"
                />
              </div>

              {/* Tax Row */}
              {isTaxEnabled && (
                <div className="flex justify-between text-slate-600 text-[11px]">
                  <span>
                    {business?.taxSettings?.name || t("pos.tax") || "Tax"} ({taxRate}%
                    {isExclusive ? " excl." : " incl."}):
                  </span>
                  <span className="font-mono">{formatCurrency(taxAmount)}</span>
                </div>
              )}

              {/* Loyalty Points Earned Preview */}
              {loyaltySettings.enabled && pointsEarnedOnSale > 0 && (
                <div className="flex justify-between text-[11px] text-purple-700 pt-0.5">
                  <span className="flex items-center gap-1">
                    <Coins className="w-3 h-3" /> {t("pos.pointsEarned") || "Reward Points Earned"}:
                  </span>
                  <span className="font-bold">+{pointsEarnedOnSale} pts</span>
                </div>
              )}

              {/* Grand Total */}
              <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-200">
                <span>{t("pos.total") || "GRAND TOTAL"}:</span>
                <span className="text-blue-700 font-mono text-lg">{formatCurrency(netTotal)}</span>
              </div>

              {/* Dual-Currency Indicative Equivalent Pill */}
              {currencySettings.enabled && activeForeignCurrencies.length > 0 && netTotal > 0 && (
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1">
                  <div className="flex items-center gap-1">
                    <Globe className="w-3 h-3 text-emerald-600" />
                    <span>Indicative FX:</span>
                    <select
                      value={displayCurrency}
                      onChange={(e) => setDisplayCurrency(e.target.value)}
                      className="bg-transparent font-bold text-slate-700 underline cursor-pointer focus:outline-none"
                    >
                      <option value="LKR">LKR (Rs.)</option>
                      {activeForeignCurrencies.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} ({c.symbol})
                        </option>
                      ))}
                    </select>
                  </div>
                  {displayCurrency !== "LKR" ? (
                    (() => {
                      const curr = activeForeignCurrencies.find((c) => c.code === displayCurrency);
                      const rate = curr?.exchangeRate || 1;
                      const val = convertLkrToForeign(netTotal, rate);
                      return (
                        <span className="font-bold text-emerald-700">
                          {formatForeignCurrency(val, displayCurrency, curr?.symbol)}
                        </span>
                      );
                    })()
                  ) : (
                    <span className="text-slate-500">
                      ~${convertLkrToForeign(netTotal, currencySettings.currencies.find((c) => c.code === "USD")?.exchangeRate || 300).toFixed(2)} USD
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* High Visibility Checkout Action */}
            <button
              onClick={openCheckout}
              disabled={cart.length === 0}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{t("pos.checkout") || "PAY / CHECKOUT"}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ================= FAST PAYMENT MODAL ================= */}
        {isCheckoutOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Select Payment Method</h3>
                  <p className="text-xs text-slate-500">Bill: {customerName}</p>
                </div>
                <button onClick={() => setIsCheckoutOpen(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Offline Warning in Modal */}
              {!isOnline && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
                  <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Offline Counter Mode: Transaction will be stored locally and synced when connection returns.</span>
                </div>
              )}

              {/* Bill Amount Highlight */}
              <div className="p-4 rounded-xl bg-blue-50/80 border border-blue-100 text-center">
                <span className="text-xs text-blue-700 font-medium">Total Amount Due</span>
                <div className="text-3xl font-black text-blue-950 font-mono mt-0.5">
                  {formatCurrency(netTotal)}
                </div>
              </div>

              {/* Floor Attendant / Sales Rep Selector (Milestone 23) */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <label className="text-slate-700 font-bold flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>Attendant / Sales Rep</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">Performance & Commission</span>
                </div>
                <select
                  value={selectedSalesRepId}
                  onChange={(e) => setSelectedSalesRepId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{session?.user?.name || "Logged-in Cashier"} (Default)</option>
                  {salesReps.map((rep) => (
                    <option key={rep._id} value={rep._id}>
                      {rep.name} ({rep.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Customer Loyalty Points Redemption Block */}
              {loyaltySettings.enabled && matchedCustomer && (
                <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-purple-950">
                      <Award className="w-4 h-4 text-purple-700" />
                      <span>Customer Loyalty Points</span>
                    </div>
                    <span className="font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded-full text-[11px]">
                      {(matchedCustomer.loyaltyPoints || 0).toLocaleString()} pts available
                    </span>
                  </div>

                  {(matchedCustomer.loyaltyPoints || 0) >= (loyaltySettings.minPointsToRedeem || 50) ? (
                    <div className="pt-1.5 border-t border-purple-200/60 space-y-2">
                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-slate-700 font-medium">Redeem points for bill discount?</span>
                        <input
                          type="checkbox"
                          checked={redeemLoyaltyPoints}
                          onChange={(e) => {
                            setRedeemLoyaltyPoints(e.target.checked);
                            if (e.target.checked && pointsToRedeemInput === 0) {
                              setPointsToRedeemInput(maxUsablePoints);
                            }
                          }}
                          className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
                        />
                      </label>

                      {redeemLoyaltyPoints && (
                        <div className="p-2 bg-white rounded-lg border border-purple-200 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-600 font-medium">Points to use:</span>
                            <input
                              type="number"
                              min="1"
                              max={maxUsablePoints}
                              value={pointsToRedeemInput || maxUsablePoints}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setPointsToRedeemInput(Math.min(val, maxUsablePoints));
                              }}
                              className="w-20 px-2 py-0.5 border border-purple-300 rounded font-mono font-bold text-purple-900 text-center text-xs"
                            />
                          </div>
                          <span className="font-bold text-emerald-700 font-mono">
                            -{formatCurrency(loyaltyResult.discountAmount)}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-purple-700">
                      Minimum {loyaltySettings.minPointsToRedeem || 50} points required to redeem rewards (Customer has {matchedCustomer.loyaltyPoints || 0} pts).
                    </p>
                  )}
                </div>
              )}

              {/* Payment Method Selector Pills */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("CASH")}
                  className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs font-semibold transition-all ${
                    paymentMethod === "CASH"
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  <span>Cash Payment</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("CARD")}
                  className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs font-semibold transition-all ${
                    paymentMethod === "CARD"
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Credit / Debit Card</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("QR")}
                  className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs font-semibold transition-all ${
                    paymentMethod === "QR"
                      ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <QrCode className="w-4 h-4" />
                  <span>LankaQR / QR</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("BANK_TRANSFER")}
                  className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs font-semibold transition-all ${
                    paymentMethod === "BANK_TRANSFER"
                      ? "bg-slate-800 text-white border-slate-800 shadow-sm"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>Bank Transfer</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("CREDIT")}
                  className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs font-semibold transition-all ${
                    paymentMethod === "CREDIT"
                      ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                      : "border-amber-300 bg-amber-50/40 text-amber-900 hover:bg-amber-100/50"
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Store Credit (Naya Potha)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("CREDIT_NOTE")}
                  className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs font-semibold transition-all ${
                    paymentMethod === "CREDIT_NOTE"
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                      : "border-indigo-300 bg-indigo-50/40 text-indigo-900 hover:bg-indigo-100/50"
                  }`}
                >
                  <Ticket className="w-4 h-4" />
                  <span>Credit Voucher (CN-...)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("GIFT_VOUCHER")}
                  className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs font-semibold transition-all ${
                    paymentMethod === "GIFT_VOUCHER"
                      ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                      : "border-purple-300 bg-purple-50/40 text-purple-900 hover:bg-purple-100/50"
                  }`}
                >
                  <Gift className="w-4 h-4" />
                  <span>Gift Voucher (GV-...)</span>
                </button>
              </div>

              {/* Cash Change UX Calculator (Dual-Currency Tender Support) */}
              {paymentMethod === "CASH" && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  {/* Tender Currency Selector Pills */}
                  {currencySettings.enabled && activeForeignCurrencies.length > 0 && (
                    <div className="space-y-1.5 pb-2 border-b border-slate-200/80">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                        <span className="flex items-center gap-1">
                          <Globe className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Tender Currency</span>
                        </span>
                        {tenderCurrency !== "LKR" && selectedCurrencyConfig && (
                          <span className="font-mono text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                            1 {tenderCurrency} = Rs. {currentExchangeRate.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            setTenderCurrency("LKR");
                            setCashReceived(Math.ceil(netTotal).toString());
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border ${
                            tenderCurrency === "LKR"
                              ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          <span>🇱🇰</span>
                          <span>LKR (Rupees)</span>
                        </button>

                        {activeForeignCurrencies.map((c) => {
                          const preset = SUPPORTED_CURRENCY_PRESETS.find((p) => p.code === c.code);
                          const isSel = tenderCurrency === c.code;
                          return (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => {
                                setTenderCurrency(c.code);
                                const due = convertLkrToForeign(netTotal, c.exchangeRate);
                                setForeignCashReceived(Math.ceil(due).toString());
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 border ${
                                isSel
                                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                                  : "bg-white text-slate-700 border-slate-200 hover:bg-emerald-50"
                              }`}
                            >
                              <span>{preset?.flag || "🌐"}</span>
                              <span>{c.code}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Standard LKR Cash Flow */}
                  {tenderCurrency === "LKR" ? (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Cash Received from Customer (Rs.)
                        </label>
                        <input
                          type="number"
                          step="1"
                          required
                          value={cashReceived}
                          onChange={(e) => setCashReceived(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-base font-bold font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white text-slate-900"
                        />
                      </div>

                      {/* Quick Cash Buttons */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {quickCashOptions.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setCashReceived(opt.toString())}
                            className="px-2.5 py-1 bg-white hover:bg-emerald-50 border border-slate-200 rounded-lg text-xs font-mono font-semibold text-slate-700 transition-colors"
                          >
                            Rs. {opt}
                          </button>
                        ))}
                      </div>

                      {/* Change Due Box */}
                      <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-600">Balance / Change Due:</span>
                        <span
                          className={`text-lg font-black font-mono ${
                            changeDue >= 0 && cashGivenNum >= netTotal
                              ? "text-emerald-700"
                              : "text-rose-600 text-xs font-semibold"
                          }`}
                        >
                          {cashGivenNum >= netTotal
                            ? formatCurrency(changeDue)
                            : "Insufficient cash tendered"}
                        </span>
                      </div>
                    </>
                  ) : (
                    /* Foreign Currency Banknote Cash Flow */
                    <div className="space-y-3">
                      {/* Foreign Bill Due Header */}
                      <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-lg flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-emerald-900 uppercase block">
                            Foreign Amount Due ({tenderCurrency})
                          </span>
                          <span className="text-base font-black font-mono text-emerald-800">
                            {formatForeignCurrency(foreignAmountDue, tenderCurrency, selectedCurrencyConfig?.symbol)}
                          </span>
                        </div>
                        <div className="text-right text-[11px] font-mono text-slate-600">
                          <div>Bill: {formatCurrency(netTotal)}</div>
                          <div className="text-[10px] text-slate-500">Rate: Rs. {currentExchangeRate.toFixed(2)}</div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Foreign Banknotes Tendered ({selectedCurrencyConfig?.symbol || tenderCurrency})
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={foreignCashReceived}
                          onChange={(e) => setForeignCashReceived(e.target.value)}
                          placeholder="0.00"
                          className="w-full px-3.5 py-2.5 text-base font-bold font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white text-slate-900"
                        />
                      </div>

                      {/* Quick Foreign Banknote Buttons */}
                      {quickForeignOptions.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {quickForeignOptions.map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setForeignCashReceived(opt.toString())}
                              className="px-2.5 py-1 bg-white hover:bg-emerald-50 border border-slate-200 rounded-lg text-xs font-mono font-semibold text-slate-700 transition-colors"
                            >
                              {selectedCurrencyConfig?.symbol || "$"}{opt}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Foreign Cash Converted & LKR Change Calculation */}
                      <div className="pt-2 border-t border-slate-200 space-y-1.5 font-mono text-xs">
                        <div className="flex justify-between text-slate-600">
                          <span>Converted LKR Equivalent:</span>
                          <span className="font-bold text-slate-800">
                            {formatCurrency(foreignCashReceivedNum * currentExchangeRate)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                          <span className="font-semibold text-slate-700">Change to Return in LKR:</span>
                          <span
                            className={`text-base font-black ${
                              foreignCashReceivedNum >= foreignAmountDue
                                ? "text-emerald-700"
                                : "text-rose-600 text-xs font-semibold"
                            }`}
                          >
                            {foreignCashReceivedNum >= foreignAmountDue
                              ? formatCurrency(foreignChangeLkr)
                              : `Short by ${selectedCurrencyConfig?.symbol || "$"}${(foreignAmountDue - foreignCashReceivedNum).toFixed(2)}`}
                          </span>
                        </div>
                      </div>

                      <div className="p-2 bg-blue-50/60 rounded-lg border border-blue-100 text-[10px] text-blue-900 leading-tight">
                        * <strong>Banknote Policy:</strong> Foreign banknotes are held in drawer. Change is returned to the customer in Sri Lankan Rupees (LKR).
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Store Credit Authorization & Headroom UX */}
              {paymentMethod === "CREDIT" && (
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-amber-200/60">
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-amber-700" />
                      <span className="text-xs font-bold text-amber-950">Customer Credit Ledger (Naya Potha)</span>
                    </div>
                    {matchedCustomer ? (
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          matchedCustomer.creditAllowed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {matchedCustomer.creditAllowed ? "Credit Approved" : "Credit Disallowed"}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900">
                        Customer Required
                      </span>
                    )}
                  </div>

                  {!matchedCustomer ? (
                    <div className="text-xs text-amber-900 space-y-1">
                      <p className="font-semibold">No registered customer matched.</p>
                      <p className="text-[11px] text-amber-800">
                        Please enter or verify the customer phone number in the cart sidebar to link this purchase to their credit passbook.
                      </p>
                    </div>
                  ) : !matchedCustomer.creditAllowed ? (
                    <div className="text-xs text-rose-700 space-y-1">
                      <p className="font-bold">Customer is not approved for credit purchases.</p>
                      <p className="text-[11px] text-rose-600">
                        Enable "Credit Allowed" under Customers &gt; Naya Potha to permit purchases on account.
                      </p>
                    </div>
                  ) : (
                    (() => {
                      const currentBal = matchedCustomer.currentBalance || 0;
                      const limit = matchedCustomer.creditLimit || 0;
                      const projected = currentBal + netTotal;
                      const isOverLimit = projected > limit;

                      return (
                        <div className="space-y-2 text-xs">
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div className="p-2 bg-white rounded-lg border border-amber-200">
                              <span className="text-slate-500 block">Current Balance:</span>
                              <span className="font-bold font-mono text-slate-800">{formatCurrency(currentBal)}</span>
                            </div>
                            <div className="p-2 bg-white rounded-lg border border-amber-200">
                              <span className="text-slate-500 block">Credit Ceiling:</span>
                              <span className="font-bold font-mono text-slate-800">{formatCurrency(limit)}</span>
                            </div>
                          </div>

                          <div
                            className={`p-2.5 rounded-lg border flex items-center justify-between ${
                              isOverLimit
                                ? "bg-rose-50 border-rose-200 text-rose-900"
                                : "bg-emerald-50 border-emerald-200 text-emerald-900"
                            }`}
                          >
                            <div>
                              <span className="text-[10px] uppercase font-bold block">
                                {isOverLimit ? "Credit Limit Exceeded" : "Projected Balance After Sale"}
                              </span>
                              <span className="font-mono font-bold text-sm">
                                {formatCurrency(projected)}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] block">
                                {isOverLimit ? "Excess Over Limit:" : "Remaining Headroom:"}
                              </span>
                              <span className="font-mono font-bold">
                                {isOverLimit ? `+${formatCurrency(projected - limit)}` : formatCurrency(limit - projected)}
                              </span>
                            </div>
                          </div>

                          {isOverLimit && (
                            <p className="text-[11px] text-rose-600 font-semibold">
                              Cannot complete sale on credit. Customer must settle at least {formatCurrency(projected - limit)} first or pay via Cash/Card.
                            </p>
                          )}
                        </div>
                      );
                    })()
                  )}
                </div>
              )}

              {/* Store Credit Note Redemption UX */}
              {paymentMethod === "CREDIT_NOTE" && (
                <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-indigo-200/60">
                    <div className="flex items-center gap-1.5">
                      <Ticket className="w-4 h-4 text-indigo-700" />
                      <span className="text-xs font-bold text-indigo-950">
                        Redeem Store Credit Note Voucher
                      </span>
                    </div>
                    {validatedCreditNote ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Valid Voucher
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-200 text-indigo-900">
                        Verification Required
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={creditNoteCodeInput}
                      onChange={(e) => {
                        setCreditNoteCodeInput(e.target.value.toUpperCase());
                        setValidatedCreditNote(null);
                        setCreditNoteError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          validateCreditNoteCode();
                        }
                      }}
                      placeholder="Enter Voucher Code (e.g. CN-20260930-0001)"
                      className="flex-1 px-3 py-2 text-xs font-mono font-bold uppercase border border-indigo-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={validateCreditNoteCode}
                      disabled={validatingCreditNote || !creditNoteCodeInput.trim()}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition"
                    >
                      {validatingCreditNote ? "Checking..." : "Verify Code"}
                    </button>
                  </div>

                  {creditNoteError && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs font-medium text-rose-700 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{creditNoteError}</span>
                    </div>
                  )}

                  {validatedCreditNote && (
                    <div className="p-3 bg-white border border-indigo-200 rounded-xl space-y-2 text-xs">
                      <div className="flex justify-between font-bold text-slate-900">
                        <span>Voucher: {validatedCreditNote.creditNoteNumber}</span>
                        <span className="text-emerald-600 font-extrabold text-sm">
                          Available: {formatCurrency(validatedCreditNote.remainingBalance)}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-500 text-[11px]">
                        <span>Customer: {validatedCreditNote.customerName}</span>
                        <span>Valid Until: {new Date(validatedCreditNote.expiryDate).toLocaleDateString()}</span>
                      </div>
                      <div className="pt-2 border-t border-dashed border-slate-200 flex justify-between font-semibold">
                        <span className="text-slate-600">Bill Total:</span>
                        <span>{formatCurrency(netTotal)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-emerald-700">
                        <span>Remaining on Voucher after purchase:</span>
                        <span>
                          {formatCurrency(Math.max(0, validatedCreditNote.remainingBalance - netTotal))}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Digital Gift Voucher Redemption UX */}
              {paymentMethod === "GIFT_VOUCHER" && (
                <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-purple-200/60">
                    <div className="flex items-center gap-1.5">
                      <Gift className="w-4 h-4 text-purple-700" />
                      <span className="text-xs font-bold text-purple-950">
                        Redeem Digital Gift Voucher
                      </span>
                    </div>
                    {validatedGiftVoucher ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Valid Voucher
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-200 text-purple-900">
                        Verification Required
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={giftVoucherCodeInput}
                      onChange={(e) => {
                        setGiftVoucherCodeInput(e.target.value.toUpperCase());
                        setValidatedGiftVoucher(null);
                        setGiftVoucherError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          validateGiftVoucherCode();
                        }
                      }}
                      placeholder="Enter Voucher Code (e.g. GV-20261001-0001)"
                      className="flex-1 px-3 py-2 text-xs font-mono font-bold uppercase border border-purple-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={validateGiftVoucherCode}
                      disabled={validatingGiftVoucher || !giftVoucherCodeInput.trim()}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition"
                    >
                      {validatingGiftVoucher ? "Checking..." : "Verify Code"}
                    </button>
                  </div>

                  {giftVoucherError && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs font-medium text-rose-700 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{giftVoucherError}</span>
                    </div>
                  )}

                  {validatedGiftVoucher && (
                    <div className="p-3 bg-white border border-purple-200 rounded-xl space-y-2 text-xs">
                      <div className="flex justify-between font-bold text-slate-900">
                        <span>Voucher: {validatedGiftVoucher.code}</span>
                        <span className="text-emerald-600 font-extrabold text-sm">
                          Balance: {formatCurrency(validatedGiftVoucher.currentBalance)}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-500 text-[11px]">
                        <span>Recipient: {validatedGiftVoucher.recipientName || "Bearer"}</span>
                        <span>Valid Until: {new Date(validatedGiftVoucher.expiryDate).toLocaleDateString()}</span>
                      </div>
                      <div className="pt-2 border-t border-dashed border-slate-200 flex justify-between font-semibold">
                        <span className="text-slate-600">Bill Total:</span>
                        <span>{formatCurrency(netTotal)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-purple-700">
                        <span>Remaining on Voucher after purchase:</span>
                        <span>
                          {formatCurrency(Math.max(0, validatedGiftVoucher.currentBalance - netTotal))}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Reference note for Card / QR */}
              {paymentMethod !== "CASH" && paymentMethod !== "CREDIT" && paymentMethod !== "CREDIT_NOTE" && paymentMethod !== "GIFT_VOUCHER" && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Approval / Reference Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="e.g. Card slip # or LankaQR Ref"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              )}

              {/* Sri Lanka IRD Tax Invoicing (B2B) Option */}
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isTaxInvoice}
                      onChange={(e) => setIsTaxInvoice(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                    />
                    <div>
                      <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-blue-700" />
                        Issue as Sri Lanka IRD Tax Invoice
                      </span>
                      <p className="text-[10px] text-blue-700">Itemize SSCL (2.5%) & VAT (18%) for B2B input tax credit</p>
                    </div>
                  </label>
                  {isTaxInvoice && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                      B2B TAX INVOICE
                    </span>
                  )}
                </div>

                {isTaxInvoice && (
                  <div className="pt-2 border-t border-blue-200/80 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="block text-[10px] font-semibold text-blue-900 mb-0.5">
                          Buyer Company / Trade Name
                        </label>
                        <input
                          type="text"
                          value={buyerCompanyName}
                          onChange={(e) => setBuyerCompanyName(e.target.value)}
                          placeholder={(matchedCustomer as any)?.companyName || (matchedCustomer as any)?.name || "Company Name"}
                          className="w-full px-2.5 py-1.5 bg-white border border-blue-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-blue-900 mb-0.5">
                          Buyer TIN (Tax Identification No.)
                        </label>
                        <input
                          type="text"
                          value={buyerTin}
                          onChange={(e) => setBuyerTin(e.target.value)}
                          placeholder="e.g. 100234567"
                          className="w-full px-2.5 py-1.5 bg-white border border-blue-200 rounded-lg font-mono text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-semibold text-blue-900 mb-0.5">
                          Buyer VAT Registration No. (Optional)
                        </label>
                        <input
                          type="text"
                          value={buyerVatNumber}
                          onChange={(e) => setBuyerVatNumber(e.target.value)}
                          placeholder="e.g. 100234567-7000"
                          className="w-full px-2.5 py-1.5 bg-white border border-blue-200 rounded-lg font-mono text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Complete Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCheckoutOpen(false)}
                  className="px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCompleteSale}
                  disabled={
                    submittingSale ||
                    (paymentMethod === "CASH" && (
                      tenderCurrency === "LKR"
                        ? cashGivenNum < netTotal
                        : foreignCashReceivedNum < foreignAmountDue
                    )) ||
                    (paymentMethod === "CREDIT" && (
                      !matchedCustomer ||
                      !matchedCustomer.creditAllowed ||
                      ((matchedCustomer.currentBalance || 0) + netTotal > (matchedCustomer.creditLimit || 0))
                    ))
                  }
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/25 transition-all disabled:opacity-50"
                >
                  {submittingSale
                    ? "Recording Sale..."
                    : isOnline
                    ? "Complete & Confirm Sale"
                    : "Complete Sale (Offline Mode)"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= SALE COMPLETED & PRINT THERMAL RECEIPT MODAL ================= */}
        {completedSale && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[95vh] overflow-y-auto">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="font-extrabold text-slate-900 text-lg">Sale Completed!</h3>
                <p className="text-xs text-slate-500 font-mono">Invoice #{completedSale.invoiceNumber}</p>
              </div>

              {/* Printable Thermal Receipt Preview Area */}
              <div
                id="printable-receipt"
                className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl font-mono text-[11px] text-slate-800 space-y-2 shadow-inner"
              >
                <div className="text-center font-bold text-xs uppercase">
                  {business?.name || "KANDY SUPER GROCERS"}
                </div>
                <div className="text-center text-[10px] text-slate-600 leading-tight">
                  {business?.address || "Peradeniya Road, Kandy"}
                  <br />
                  Tel: {business?.phone || "0771234567"}
                </div>
                <div className="text-center text-[10px] text-slate-500 italic">
                  {business?.receiptSettings?.headerMessage || "Thank you for shopping with us!"}
                </div>

                <div className="border-t border-dashed border-slate-300 pt-1.5 space-y-0.5 text-[10px]">
                  {(completedSale.isOffline || completedSale.invoiceNumber?.startsWith("OFFLINE-")) && (
                    <div className="my-1 py-1 border border-dashed border-amber-600 bg-amber-50 text-amber-950 text-center font-bold text-[10px] uppercase tracking-wider print:border-black print:text-black">
                      * OFFLINE COUNTER SALE *
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Invoice: {completedSale.invoiceNumber}</span>
                    <span>{new Date(completedSale.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cashier: {completedSale.cashierName}</span>
                    <span>Method: {completedSale.paymentMethod}</span>
                  </div>
                  {completedSale.registerName && (
                    <div className="flex justify-between font-semibold text-blue-700 print:text-black">
                      <span>Counter:</span>
                      <span>{completedSale.registerName}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-300 pt-1.5 space-y-1">
                  {completedSale.items.map((it: any, idx: number) => (
                    <div key={idx}>
                      <div className="flex justify-between font-semibold">
                        <span className="truncate pr-2">{it.name}</span>
                        <span>{formatCurrency(it.total)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 pl-2">
                        <span>
                          {it.quantity} x {formatCurrency(it.unitPrice)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-dashed border-slate-300 pt-1.5 space-y-0.5 text-right font-medium">
                  <div className="flex justify-between text-slate-600 text-[10px]">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(completedSale.subtotal)}</span>
                  </div>
                  {completedSale.discountTotal > 0 && (
                    <div className="flex justify-between text-slate-600 text-[10px]">
                      <span>Discount:</span>
                      <span>-{formatCurrency(completedSale.discountTotal)}</span>
                    </div>
                  )}
                  {completedSale.taxTotal > 0 && (
                    <div className="flex justify-between text-slate-600 text-[10px]">
                      <span>Tax:</span>
                      <span>+{formatCurrency(completedSale.taxTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs font-bold text-slate-900 pt-1 border-t border-slate-200">
                    <span>TOTAL:</span>
                    <span>{formatCurrency(completedSale.netTotal)}</span>
                  </div>
                  {completedSale.paymentMethod === "CASH" && (
                    <>
                      {completedSale.tenderCurrency && completedSale.tenderCurrency !== "LKR" ? (
                        <>
                          <div className="flex justify-between text-[10px] text-slate-600">
                            <span>Foreign Tendered ({completedSale.tenderCurrency}):</span>
                            <span className="font-bold">
                              {completedSale.foreignCurrencySymbol || "$"}{completedSale.foreignCashReceived?.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-600">
                            <span>Exchange Rate:</span>
                            <span className="font-mono">
                              1 {completedSale.tenderCurrency} = Rs. {completedSale.exchangeRate?.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-600">
                            <span>LKR Converted Equivalent:</span>
                            <span className="font-mono">
                              {formatCurrency((completedSale.foreignCashReceived || 0) * (completedSale.exchangeRate || 1))}
                            </span>
                          </div>
                          <div className="flex justify-between text-[10px] font-bold text-emerald-700">
                            <span>LKR Change Returned:</span>
                            <span className="font-mono">
                              {formatCurrency(completedSale.foreignChangeGiven ?? completedSale.changeGiven ?? 0)}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between text-[10px] text-slate-600">
                            <span>Cash Tendered:</span>
                            <span>{formatCurrency(completedSale.cashReceived)}</span>
                          </div>
                          <div className="flex justify-between text-[10px] font-bold text-emerald-700">
                            <span>Change Returned:</span>
                            <span>{formatCurrency(completedSale.changeGiven)}</span>
                          </div>
                        </>
                      )}
                    </>
                  )}
                  {completedSale.paymentMethod === "CREDIT" && (
                    <div className="pt-2 text-center text-[10px] space-y-1">
                      <div className="p-1 border border-dashed border-amber-600 bg-amber-50/50 font-bold text-amber-900 print:text-black">
                        * BILLED TO CREDIT ACCOUNT (NAYA POTHA) *
                      </div>
                      <div className="pt-3 border-b border-dotted border-slate-400"></div>
                      <div className="text-[9px] text-slate-500 print:text-black">
                        Customer Signature / ණය ගිවිසුම
                      </div>
                    </div>
                  )}
                  {completedSale.paymentMethod === "CREDIT_NOTE" && (
                    <div className="pt-2 text-center text-[10px] space-y-1">
                      <div className="p-1 border border-dashed border-indigo-600 bg-indigo-50/50 font-bold text-indigo-900 print:text-black">
                        * PAID VIA STORE CREDIT VOUCHER ({completedSale.creditNoteRedeemed?.creditNoteNumber || "VOUCHER"}) *
                      </div>
                    </div>
                  )}
                  {completedSale.paymentMethod === "GIFT_VOUCHER" && (
                    <div className="pt-2 text-center text-[10px] space-y-1">
                      <div className="p-1 border border-dashed border-purple-600 bg-purple-50/50 font-bold text-purple-900 print:text-black">
                        * PAID VIA DIGITAL GIFT VOUCHER ({completedSale.giftVoucherRedeemed?.code || "GIFT VOUCHER"}) *
                      </div>
                      {completedSale.giftVoucherRedeemed?.remainingBalance !== undefined && (
                        <div className="text-[10px] text-purple-800 font-mono">
                          Remaining Voucher Balance: {formatCurrency(completedSale.giftVoucherRedeemed.remainingBalance)}
                        </div>
                      )}
                    </div>
                  )}
                  {completedSale.pointsEarned > 0 && (
                    <div className="pt-1.5 text-center text-[10px] text-purple-900 font-bold">
                      ⭐ Loyalty Points Earned: +{completedSale.pointsEarned} pts
                    </div>
                  )}
                </div>

                {/* Scannable E-Receipt QR Code */}
                <div className="border-t border-dashed border-slate-300 pt-2 text-center space-y-1">
                  <div className="flex justify-center">
                    <QRCodeImage
                      value={
                        typeof window !== "undefined"
                          ? `${window.location.origin}/receipt/${completedSale._id || completedSale.invoiceNumber}`
                          : `https://pos.srilanka.lk/receipt/${completedSale._id || completedSale.invoiceNumber}`
                      }
                      size={80}
                      margin={1}
                      className="border border-slate-200 p-0.5 rounded bg-white shadow-2xs"
                    />
                  </div>
                  <p className="text-[9px] font-bold text-slate-800 uppercase tracking-tight">
                    Scan for Digital E-Receipt & IRD Check
                  </p>
                </div>

                <div className="border-t border-dashed border-slate-300 pt-2 text-center text-[10px] text-slate-500">
                  {business?.receiptSettings?.footerMessage || "Please come again!"}
                </div>
              </div>

              {/* Offline Warning Notice */}
              {(completedSale.isOffline || completedSale.invoiceNumber?.startsWith("OFFLINE-")) && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start gap-2 print:hidden">
                  <WifiOff className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Offline Resilience Active:</span> Broadband is disconnected. This sale was saved locally to counter device memory and stock updated. It will auto-sync with the cloud when internet reconnects.
                  </div>
                </div>
              )}

              {/* WhatsApp Digital E-Receipt Section */}
              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                    <span>WhatsApp Digital E-Receipt</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowWhatsAppSection(!showWhatsAppSection)}
                    className="text-[11px] font-semibold text-emerald-700 hover:underline"
                  >
                    {showWhatsAppSection ? "Hide" : "Send Digital Receipt"}
                  </button>
                </div>

                {showWhatsAppSection && (
                  <div className="space-y-2 pt-1 border-t border-emerald-100">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Customer Mobile Number (WhatsApp)
                      </label>
                      <div className="relative">
                        <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={whatsappPhoneInput}
                          onChange={(e) => setWhatsappPhoneInput(e.target.value)}
                          placeholder="e.g. 077 123 4567 or 0712345678"
                          className="w-full pl-9 pr-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <a
                        href={buildWhatsAppUrl(
                          whatsappPhoneInput,
                          formatWhatsAppReceipt({
                            sale: completedSale,
                            business: business || {},
                            publicReceiptUrl:
                              typeof window !== "undefined"
                                ? `${window.location.origin}/receipt/${completedSale._id || completedSale.invoiceNumber}`
                                : undefined,
                          })
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Send on WhatsApp</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          if (typeof window !== "undefined") {
                            const url = `${window.location.origin}/receipt/${completedSale._id || completedSale.invoiceNumber}`;
                            navigator.clipboard.writeText(url);
                            setCopiedPublicReceipt(true);
                            setTimeout(() => setCopiedPublicReceipt(false), 2000);
                          }
                        }}
                        className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 shadow-2xs flex items-center gap-1 transition"
                      >
                        {copiedPublicReceipt ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700 font-bold">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-500" />
                            <span>Copy Link</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={triggerPrint}
                  className="w-full sm:flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Receipt</span>
                </button>

                {(completedSale.isTaxInvoice || completedSale.billingType === "WHOLESALE") && (
                  <Link
                    href="/invoices"
                    className="w-full sm:w-auto px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl text-xs font-bold border border-blue-200 flex items-center justify-center gap-1.5 transition"
                    title="Open Invoices & Quotations Hub for official A4 IRD Tax Invoice"
                  >
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>A4 Tax Invoice</span>
                  </Link>
                )}

                {!showWhatsAppSection && (
                  <button
                    type="button"
                    onClick={() => setShowWhatsAppSection(true)}
                    className="w-full sm:w-auto px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200 flex items-center justify-center gap-1.5 transition"
                  >
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                    <span>WhatsApp</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setCompletedSale(null)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Next Sale
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= OPEN SHIFT & FLOAT MODAL ================= */}
        {isOpenShiftModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm sm:text-base">Open Cash Drawer Shift</h3>
                    <p className="text-xs text-slate-500">Initialize counter float and start cashier session</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpenShiftModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleOpenShift} className="space-y-4">
                <div className="bg-slate-50 p-3 rounded-xl space-y-1.5 text-xs text-slate-700">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Counter / Terminal:</span>
                    <span className="font-bold text-slate-900">
                      {selectedRegister ? `${selectedRegister.registerNumber}: ${selectedRegister.name}` : "Not Selected"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Cashier:</span>
                    <span className="font-semibold text-slate-900">{session?.user?.name || "Cashier"}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Initial Cash Float (LKR)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rs.</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      value={openingFloatInput}
                      onChange={(e) => setOpeningFloatInput(e.target.value)}
                      placeholder="5000"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    {[0, 2000, 5000, 10000, 20000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setOpeningFloatInput(preset.toString())}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-semibold transition"
                      >
                        Rs. {preset.toLocaleString()}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2">
                    Base currency coins and banknotes kept in the cash drawer at the start of trading for making change.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsOpenShiftModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingOpenShift || !selectedRegister}
                    className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-600/25 transition disabled:opacity-50"
                  >
                    {submittingOpenShift ? "Opening Shift..." : "Open Shift & Begin Billing"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= CASH DRAWER CONTROL CENTER MODAL ================= */}
        {isShiftModalOpen && currentShift && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 my-auto max-h-[92vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                        Cash Drawer Control Center
                      </h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wide">
                        ACTIVE SHIFT
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-mono">
                      {currentShift.shiftNumber} • {currentShift.registerName || selectedRegister?.name || "Counter"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsShiftModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Cash Telemetry Grid */}
              <div className="p-4 bg-emerald-950 text-white rounded-2xl shadow-inner space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-emerald-300 font-medium uppercase tracking-wider">
                    Expected Cash in Drawer
                  </span>
                  <button
                    type="button"
                    onClick={() => fetchCurrentShift(selectedRegister?._id)}
                    className="p-1 text-emerald-400 hover:text-white rounded transition"
                    title="Refresh live metrics"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingShift ? "animate-spin" : ""}`} />
                  </button>
                </div>
                <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">
                  {formatCurrency(currentShift.expectedCash ?? currentShift.openingFloat)}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-800/80 text-[11px]">
                  <div>
                    <span className="text-emerald-400/80 block">Opening Float</span>
                    <span className="font-mono font-semibold">{formatCurrency(currentShift.openingFloat)}</span>
                  </div>
                  <div>
                    <span className="text-emerald-400/80 block">Cash Sales</span>
                    <span className="font-mono font-semibold text-emerald-200">+{formatCurrency(currentShift.cashSales)}</span>
                  </div>
                  <div>
                    <span className="text-emerald-400/80 block">Safe Drops</span>
                    <span className="font-mono font-semibold text-rose-300">
                      -{formatCurrency((currentShift.cashMovements || []).filter((m) => m.type === "CASH_DROP").reduce((sum, m) => sum + m.amount, 0))}
                    </span>
                  </div>
                  <div>
                    <span className="text-emerald-400/80 block">Pay-Ins / Outs</span>
                    <span className="font-mono font-semibold">
                      {formatCurrency(
                        (currentShift.cashMovements || []).filter((m) => m.type === "PAY_IN").reduce((sum, m) => sum + m.amount, 0) -
                        (currentShift.cashMovements || []).filter((m) => m.type === "PAY_OUT").reduce((sum, m) => sum + m.amount, 0)
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Digital & Card Breakdown */}
              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                <div className="text-center">
                  <span className="text-slate-500 text-[10px] block">Card Sales</span>
                  <span className="font-mono font-bold text-slate-800">{formatCurrency(currentShift.cardSales)}</span>
                </div>
                <div className="text-center border-x border-slate-200">
                  <span className="text-slate-500 text-[10px] block">LankaQR</span>
                  <span className="font-mono font-bold text-slate-800">{formatCurrency(currentShift.qrSales)}</span>
                </div>
                <div className="text-center">
                  <span className="text-slate-500 text-[10px] block">Bank Transfer</span>
                  <span className="font-mono font-bold text-slate-800">{formatCurrency(currentShift.bankTransferSales)}</span>
                </div>
              </div>

              {/* Cash Movements Action Section */}
              <div className="border border-slate-200 rounded-xl p-3.5 space-y-3 bg-white">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Record Drawer Movement
                  </h4>
                  <span className="text-[10px] text-slate-500">Affects physical drawer count</span>
                </div>

                {/* Movement Type Tabs */}
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setMovementType("CASH_DROP")}
                    className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition ${
                      movementType === "CASH_DROP"
                        ? "bg-rose-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <ArrowDownRight className="w-3.5 h-3.5" />
                    <span>Safe Drop</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementType("PAY_IN")}
                    className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition ${
                      movementType === "PAY_IN"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>Pay-In</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementType("PAY_OUT")}
                    className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition ${
                      movementType === "PAY_OUT"
                        ? "bg-amber-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Pay-Out</span>
                  </button>
                </div>

                <form onSubmit={handleRecordMovement} className="space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Amount (LKR)
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        required
                        value={movementAmount}
                        onChange={(e) => setMovementAmount(e.target.value)}
                        placeholder="e.g. 10000"
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Reason / Note
                      </label>
                      <input
                        type="text"
                        required
                        value={movementReason}
                        onChange={(e) => setMovementReason(e.target.value)}
                        placeholder={
                          movementType === "CASH_DROP"
                            ? "Safe transfer mid-day"
                            : movementType === "PAY_IN"
                            ? "Added float change"
                            : "Expense / supplier payment"
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1">
                      {[1000, 2000, 5000, 10000, 20000].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setMovementAmount(preset.toString())}
                          className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[10px] font-semibold"
                        >
                          +{preset / 1000}k
                        </button>
                      ))}
                    </div>
                    <button
                      type="submit"
                      disabled={submittingMovement || !movementAmount || !movementReason}
                      className="px-4 py-1.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition disabled:opacity-50"
                    >
                      {submittingMovement ? "Saving..." : "Record Entry"}
                    </button>
                  </div>
                </form>

                {/* Recent Movement Log */}
                {currentShift.cashMovements && currentShift.cashMovements.length > 0 && (
                  <div className="border-t border-slate-100 pt-2 space-y-1 max-h-28 overflow-y-auto pr-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Recent Drawer Activity ({currentShift.cashMovements.length})
                    </span>
                    {currentShift.cashMovements.slice(-4).reverse().map((m, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-[11px] py-1 border-b border-slate-50 last:border-none"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                              m.type === "CASH_DROP"
                                ? "bg-rose-100 text-rose-800"
                                : m.type === "PAY_IN"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {m.type === "CASH_DROP" ? "DROP" : m.type}
                          </span>
                          <span className="text-slate-700 truncate">{m.reason}</span>
                        </div>
                        <span className="font-mono font-bold shrink-0 pl-2">
                          {m.type === "PAY_IN" ? "+" : "-"}
                          {formatCurrency(m.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Manual Drawer Kick (No Sale) */}
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Manual Drawer Kick (No Sale)</span>
                    <span className="text-[10px] text-slate-400">Open drawer to make customer change (Supervisor PIN logged)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleNoSaleDrawerKick}
                    className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-xs rounded-xl flex items-center gap-1.5 transition active:scale-95"
                  >
                    <Unlock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Open Drawer</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsXReportModalOpen(true)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold border border-blue-200 transition shadow-2xs"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Interim X-Report</span>
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setIsShiftModalOpen(false)}
                    className="flex-1 sm:flex-none px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsShiftModalOpen(false);
                      setIsCloseShiftModalOpen(true);
                    }}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/25 transition"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Close Shift & Z-Report</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= CLOSE SHIFT & RECONCILE DRAWER MODAL ================= */}
        {isCloseShiftModalOpen && currentShift && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm sm:text-base">Close Cash Drawer Shift</h3>
                    <p className="text-xs text-slate-500">Count physical drawer cash and reconcile discrepancies</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCloseShiftModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCloseShift} className="space-y-4">
                {/* Expected Cash Reminder */}
                <div className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                      Expected Drawer Cash
                    </span>
                    <span className="font-mono text-xl font-bold text-emerald-400">
                      {formatCurrency(currentShift.expectedCash ?? currentShift.openingFloat)}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    {currentShift.salesCount || 0} Bills Sold
                  </span>
                </div>

                {/* Actual Counted Cash Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Actual Cash Counted in Drawer (LKR)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rs.</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      value={actualCashInput}
                      onChange={(e) => setActualCashInput(e.target.value)}
                      placeholder="Enter actual counted cash amount"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-slate-300 rounded-xl font-mono text-base font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setActualCashInput((currentShift.expectedCash ?? currentShift.openingFloat).toString())}
                    className="text-[11px] font-semibold text-blue-600 hover:underline mt-1"
                  >
                    Match expected ({formatCurrency(currentShift.expectedCash ?? currentShift.openingFloat)})
                  </button>
                </div>

                {/* Live Over / Short Variance Display */}
                {actualCashInput !== "" && !isNaN(parseFloat(actualCashInput)) && (
                  (() => {
                    const actualNum = parseFloat(actualCashInput) || 0;
                    const expectedNum = currentShift.expectedCash ?? currentShift.openingFloat;
                    const diff = actualNum - expectedNum;
                    const isBalanced = Math.abs(diff) < 0.01;
                    const isOver = diff > 0.01;
                    return (
                      <div
                        className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
                          isBalanced
                            ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                            : isOver
                            ? "bg-blue-50 text-blue-900 border-blue-200"
                            : "bg-rose-50 text-rose-900 border-rose-200"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          {isBalanced ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-rose-600" />
                          )}
                          <span>
                            {isBalanced ? "Balanced (Zero Discrepancy)" : isOver ? "Cash Over (Surplus)" : "Cash Short (Deficit)"}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-sm">
                          {diff >= 0 ? `+${formatCurrency(diff)}` : `-${formatCurrency(Math.abs(diff))}`}
                        </span>
                      </div>
                    );
                  })()
                )}

                {/* Closing Notes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Closing Notes / Handover Reason (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={closingNotesInput}
                    onChange={(e) => setClosingNotesInput(e.target.value)}
                    placeholder="e.g. Returned small change, safe drop completed with manager."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsCloseShiftModalOpen(false)}
                    className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingCloseShift || actualCashInput === ""}
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/25 transition disabled:opacity-50"
                  >
                    {submittingCloseShift ? "Reconciling..." : "Confirm & Print Z-Report"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= THERMAL X-REPORT MODAL (INTERIM AUDIT) ================= */}
        {isXReportModalOpen && currentShift && (
          <ShiftZReportReceipt
            business={
              business || {
                name: "Sri Lanka POS",
                receiptSettings: { defaultWidth: "58mm" },
              }
            }
            shift={currentShift}
            reportType="X_REPORT"
            onClose={() => setIsXReportModalOpen(false)}
          />
        )}

        {/* ================= THERMAL Z-REPORT MODAL (SHIFT CLOSURE) ================= */}
        {isZReportModalOpen && closingShiftData && (
          <ShiftZReportReceipt
            business={
              business || {
                name: "Sri Lanka POS",
                receiptSettings: { defaultWidth: "58mm" },
              }
            }
            shift={closingShiftData}
            reportType="Z_REPORT"
            onClose={() => {
              setIsZReportModalOpen(false);
              setClosingShiftData(null);
            }}
          />
        )}

        {/* ================= POS QUICK DEBT SETTLEMENT MODAL ================= */}
        {isCreditSettlementOpen && matchedCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Settle Debt (ණය බේරීම)</h3>
                    <p className="text-[11px] text-slate-500">Record customer payment at counter</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreditSettlementOpen(false)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Customer Info Card */}
              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Customer:</span>
                  <span className="font-bold text-slate-900">{matchedCustomer.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Phone / NIC:</span>
                  <span className="font-mono text-slate-700">
                    {matchedCustomer.phone} {matchedCustomer.nicNumber ? `• ${matchedCustomer.nicNumber}` : ""}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-amber-200/60 font-bold">
                  <span className="text-amber-900">Current Outstanding Debt:</span>
                  <span className="font-mono text-rose-600 text-sm">
                    {formatCurrency(matchedCustomer.currentBalance || 0)}
                  </span>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handlePOSCreditSettlement} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payment Amount (Rs.) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={creditSettlementAmount}
                    onChange={(e) => setCreditSettlementAmount(e.target.value)}
                    placeholder="Enter amount paid"
                    className="w-full px-3.5 py-2.5 text-base font-bold font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  {matchedCustomer.currentBalance > 0 && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <button
                        type="button"
                        onClick={() => setCreditSettlementAmount(matchedCustomer.currentBalance.toString())}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700"
                      >
                        Full Settle ({formatCurrency(matchedCustomer.currentBalance)})
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreditSettlementAmount(Math.round(matchedCustomer.currentBalance / 2).toString())}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700"
                      >
                        50% Settle
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payment Method *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["CASH", "CARD", "QR", "BANK_TRANSFER"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setCreditSettlementMethod(m)}
                        className={`p-2 rounded-lg border text-xs font-semibold transition ${
                          creditSettlementMethod === m
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                            : "border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {m === "CASH" ? "Cash (Drawer)" : m === "CARD" ? "Card Slip" : m === "QR" ? "LankaQR" : "Bank Transfer"}
                      </button>
                    ))}
                  </div>
                </div>

                {creditSettlementMethod !== "CASH" && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Reference Code
                    </label>
                    <input
                      type="text"
                      value={creditSettlementRef}
                      onChange={(e) => setCreditSettlementRef(e.target.value)}
                      placeholder="e.g. Card Auth, QR Ref, Bank Txn"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Notes / Remarks (Optional)
                  </label>
                  <input
                    type="text"
                    value={creditSettlementNotes}
                    onChange={(e) => setCreditSettlementNotes(e.target.value)}
                    placeholder="e.g. Paid at counter by customer"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Auto Pay-in notice */}
                {creditSettlementMethod === "CASH" && currentShift && (
                  <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>
                      Cash payment will be automatically recorded as a <strong>PAY-IN</strong> in counter shift #{currentShift.shiftNumber}.
                    </span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsCreditSettlementOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingCreditSettlement || !creditSettlementAmount}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/25 transition disabled:opacity-50"
                  >
                    {submittingCreditSettlement ? "Processing..." : "Confirm & Print Settlement Slip"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= THERMAL DEBT SETTLEMENT SLIP MODAL ================= */}
        {activeSettlementSlip && (
          <CreditSettlementReceipt
            business={
              business || {
                name: "Sri Lanka POS",
                receiptSettings: { defaultWidth: "58mm" },
              }
            }
            settlement={activeSettlementSlip}
            onClose={() => setActiveSettlementSlip(null)}
          />
        )}

        {/* ================= LOAD QUOTATION INTO POS COUNTER CART MODAL ================= */}
        {isLoadQuoteModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[85vh]">
              <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-purple-400" />
                  <div>
                    <h3 className="font-bold text-sm">Load Quotation into POS Cart</h3>
                    <p className="text-[10px] text-slate-400">
                      Import approved B2B estimates directly into active checkout counter
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsLoadQuoteModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-white rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 border-b border-slate-100 bg-slate-50 shrink-0">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search Quote # (e.g. QT-20261001-0001) or Customer..."
                      value={quoteSearchInput}
                      onChange={(e) => setQuoteSearchInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          fetchActiveQuotations(quoteSearchInput);
                        }
                      }}
                      className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => fetchActiveQuotations(quoteSearchInput)}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl transition"
                  >
                    Search
                  </button>
                </div>
              </div>

              <div className="p-4 overflow-y-auto flex-1 divide-y divide-slate-100 text-xs">
                {loadingActiveQuotes ? (
                  <div className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-purple-600 mb-2" />
                    Searching quotations...
                  </div>
                ) : activeQuotesList.length === 0 ? (
                  <div className="py-8 text-center text-slate-400">
                    No open quotations found. Type a quotation number above to search.
                  </div>
                ) : (
                  activeQuotesList.map((qt) => {
                    const isExpired = new Date(qt.validUntil) < new Date();
                    return (
                      <div key={qt._id} className="py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900">{qt.quotationNumber}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                qt.status === "CONVERTED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : isExpired
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-purple-100 text-purple-800"
                              }`}
                            >
                              {qt.status}
                            </span>
                          </div>
                          <div className="font-semibold text-slate-700 truncate">
                            {qt.companyName || qt.customerName}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {qt.items?.length || 0} items • Valid: {new Date(qt.validUntil).toLocaleDateString()}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="font-mono font-bold text-purple-700 text-sm">
                            {formatCurrency(qt.netTotal)}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleApplyQuotationToCart(qt)}
                            disabled={qt.status === "CONVERTED"}
                            className="mt-1 px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-bold text-xs rounded-lg transition shadow-xs"
                          >
                            Load to Cart
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-3 bg-slate-50 border-t border-slate-200 text-right shrink-0">
                <button
                  type="button"
                  onClick={() => setIsLoadQuoteModalOpen(false)}
                  className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-100 rounded-xl font-bold text-xs text-slate-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= SUPERVISOR OVERRIDE ACTION GATE MODAL ================= */}
        <SupervisorOverrideModal
          isOpen={overrideModal.isOpen}
          onClose={() => setOverrideModal((prev) => ({ ...prev, isOpen: false }))}
          onApproved={overrideModal.onApproved}
          action={overrideModal.action}
          actionDescription={overrideModal.actionDescription}
          details={overrideModal.details}
        />

        {/* ================= WEIGHING SCALE & PRODUCE MODAL ================= */}
        <WeighingScaleModal
          isOpen={isWeighModalOpen}
          onClose={() => {
            setIsWeighModalOpen(false);
            setWeighModalInitialProduct(null);
          }}
          products={
            weighModalInitialProduct
              ? [weighModalInitialProduct, ...products.filter((p) => p._id !== weighModalInitialProduct._id)]
              : products
          }
          onAddWeighedItem={(prod, netWeightKg) => {
            const foundProd = products.find((p) => p._id === prod._id);
            if (foundProd) {
              addToCart(foundProd, netWeightKg);
              setStatusMessage({
                type: "success",
                text: `Added weighed item: ${foundProd.name} (${netWeightKg} kg @ ${formatCurrency(foundProd.sellingPrice)}/kg)`,
              });
            }
          }}
          currency={business?.currency || "LKR"}
        />
      </div>
    </AppLayout>
  );
}
