"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import {
  FileText,
  Barcode,
  Building2,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  X,
  Package,
  Layers,
  ChevronRight,
  RotateCcw,
  Check,
  Send,
  Boxes,
  Shield,
  Eye,
  MapPin,
  Phone,
  User,
  Wallet,
  Calendar,
  CreditCard,
  Building,
  Printer,
  DollarSign,
  ArrowDownLeft,
  ArrowUpRight,
  FileCheck,
  Truck,
  ShieldCheck,
  Sparkles,
  Globe,
} from "lucide-react";
import PurchaseOrderReceipt, { PurchaseOrderData } from "@/components/receipts/PurchaseOrderReceipt";
import SupplierPaymentReceipt, { SupplierPaymentData } from "@/components/receipts/SupplierPaymentReceipt";
import GoodsReceivedNoteReceipt, { GoodsReceivedNoteData } from "@/components/receipts/GoodsReceivedNoteReceipt";
import RfqBiddingManager from "@/components/purchases/RfqBiddingManager";
import VendorPortalShareModal from "@/components/purchases/VendorPortalShareModal";
import AutomatedReorderPlanner from "@/components/purchases/AutomatedReorderPlanner";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";


interface Supplier {
  _id: string;
  name: string;
  code?: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  address?: string;
  taxNumber?: string;
  paymentTermsDays: number;
  creditLimit: number;
  currentBalance: number;
  portalToken?: string;
  isActive: boolean;
}

interface PurchaseOrderItem {
  productId: string;
  name: string;
  sku?: string;
  unit: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  total: number;
  notes?: string;
}

interface PurchaseOrder {
  _id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  branchId?: string;
  branchName?: string;
  status: "DRAFT" | "SENT" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";
  items: PurchaseOrderItem[];
  subtotal: number;
  taxTotal: number;
  netTotal: number;
  expectedDeliveryDate?: string;
  supplierInvoiceNumber?: string;
  receivedAt?: string;
  receivedBy?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

interface Branch {
  _id: string;
  name: string;
  code: string;
  isMainWarehouse: boolean;
}

interface ProductOption {
  _id: string;
  name: string;
  sku?: string;
  barcode?: string;
  unit?: string;
  costPrice: number;
  sellingPrice: number;
  stockQuantity: number;
}

export interface DockInspectionItemInput {
  productId: string;
  name: string;
  sku?: string;
  unit: string;
  orderedQuantity: number;
  alreadyReceived: number;
  receivedQuantity: number;
  rejectedQuantity: number;
  rejectionReason: string;
  rejectionNotes: string;
  unitCost: number;
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  mrp: string;
  sellingPrice: string;
  qcInspectionNotes: string;
}

export default function PurchasesPage() {
  const [activeTab, setActiveTab] = useState<
    "ORDERS" | "REORDER_PLANNER" | "GRN" | "RFQ" | "SUPPLIERS" | "VOUCHERS"
  >("ORDERS");

  // Data
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filters for POs
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Supplier Search & Aging
  const [supplierSearch, setSupplierSearch] = useState("");
  const [hasDebtOnly, setHasDebtOnly] = useState(false);
  const [supplierAging, setSupplierAging] = useState({
    current: 0,
    days15to30: 0,
    days31to60: 0,
    over60: 0,
  });
  const [creditLimitExceededCount, setCreditLimitExceededCount] = useState(0);

  // Vouchers Register Data & Filters
  const [vouchers, setVouchers] = useState<SupplierPaymentData[]>([]);
  const [voucherMethodFilter, setVoucherMethodFilter] = useState("ALL");
  const [voucherSearchQuery, setVoucherSearchQuery] = useState("");
  const [loadingVouchers, setLoadingVouchers] = useState(false);
  const [voucherMetrics, setVoucherMetrics] = useState({
    totalAmount: 0,
    totalCheque: 0,
    totalBankTransfer: 0,
    totalCash: 0,
    totalVouchers: 0,
  });

  // Metrics
  const [metrics, setMetrics] = useState({
    totalCount: 0,
    openOrdersCount: 0,
    receivedOrdersCount: 0,
    totalProcurementValue: 0,
  });

  const [supplierPayableTotal, setSupplierPayableTotal] = useState(0);

  // Notification
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modals state
  const [isNewPOOpen, setIsNewPOOpen] = useState(false);
  const [newPOSupplier, setNewPOSupplier] = useState("");
  const [newPOBranch, setNewPOBranch] = useState("");
  const [newPODeliveryDate, setNewPODeliveryDate] = useState("");
  const [newPONotes, setNewPONotes] = useState("");
  const [newPOSupplierInv, setNewPOSupplierInv] = useState("");
  const [poLineItems, setPoLineItems] = useState<
    Array<{ productId: string; name: string; sku?: string; unit: string; quantityOrdered: number; unitCost: number }>
  >([]);
  const [selectedProductToAdd, setSelectedProductToAdd] = useState("");
  const [addQty, setAddQty] = useState("10");
  const [addCost, setAddCost] = useState("");
  const [submittingPO, setSubmittingPO] = useState(false);

  // PO Details View Modal
  const [viewingPO, setViewingPO] = useState<PurchaseOrder | null>(null);

  // GRN & Dock Inspection State
  const [grns, setGrns] = useState<GoodsReceivedNoteData[]>([]);
  const [loadingGrns, setLoadingGrns] = useState(false);
  const [grnStatusFilter, setGrnStatusFilter] = useState("ALL");
  const [grnInspectionFilter, setGrnInspectionFilter] = useState("ALL");
  const [grnSearchQuery, setGrnSearchQuery] = useState("");
  const [viewingGrnReceipt, setViewingGrnReceipt] = useState<GoodsReceivedNoteData | null>(null);

  // Warehouse Putaway Assistant Modal State
  const [putawayGrn, setPutawayGrn] = useState<GoodsReceivedNoteData | null>(null);
  const [putawaySuggestions, setPutawaySuggestions] = useState<any[]>([]);
  const [loadingPutawaySuggestions, setLoadingPutawaySuggestions] = useState(false);
  const [submittingPutawayConfirm, setSubmittingPutawayConfirm] = useState(false);

  // Receive GRN Modal State
  const [receivingPO, setReceivingPO] = useState<PurchaseOrder | null>(null);
  const [dockItems, setDockItems] = useState<DockInspectionItemInput[]>([]);
  const [supplierBillNumber, setSupplierBillNumber] = useState("");
  const [supplierInvoiceDate, setSupplierInvoiceDate] = useState("");
  const [dockInspectionNotes, setDockInspectionNotes] = useState("");
  const [submittingReceive, setSubmittingReceive] = useState(false);

  // Supplier Add / Edit Modal State
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState({
    _id: "",
    name: "",
    code: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
    taxNumber: "",
    paymentTermsDays: 30,
    creditLimit: 0,
    notes: "",
  });
  const [submittingSupplier, setSubmittingSupplier] = useState(false);

  // Settle Supplier Debt Modal State
  const [payingSupplier, setPayingSupplier] = useState<Supplier | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CHEQUE" | "BANK_TRANSFER" | "CASH">("CHEQUE");
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeDate, setChequeDate] = useState("");
  const [bankName, setBankName] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Supplier Statement Modal State
  const [statementSupplier, setStatementSupplier] = useState<Supplier | null>(null);
  const [statementData, setStatementData] = useState<any[]>([]);
  const [loadingStatement, setLoadingStatement] = useState(false);

  // Printable Slips
  const [activePrintPO, setActivePrintPO] = useState<PurchaseOrder | null>(null);
  const [activePrintPayment, setActivePrintPayment] = useState<SupplierPaymentData | null>(null);

  // Vendor Portal Share Modal State
  const [sharingSupplierPortal, setSharingSupplierPortal] = useState<Supplier | null>(null);

  // Load Data
  const loadData = async () => {
    try {
      setLoading(true);
      const [supRes, poRes, branchRes, prodRes, bizRes] = await Promise.all([
        fetch("/api/suppliers"),
        fetch(`/api/purchases?status=${statusFilter}${supplierFilter ? `&supplierId=${supplierFilter}` : ""}${searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : ""}`),
        fetch("/api/branches"),
        fetch("/api/products?limit=500"),
        fetch("/api/business"),
      ]);

      const [supData, poData, branchData, prodData, bizData] = await Promise.all([
        supRes.json(),
        poRes.json(),
        branchRes.json(),
        prodRes.json(),
        bizRes.json(),
      ]);

      if (supData.success) {
        setSuppliers(supData.suppliers || []);
        if (supData.metrics) {
          setSupplierPayableTotal(supData.metrics.totalPayableBalance || 0);
          if (supData.metrics.aging) {
            setSupplierAging(supData.metrics.aging);
          }
          if (typeof supData.metrics.creditLimitExceededCount === "number") {
            setCreditLimitExceededCount(supData.metrics.creditLimitExceededCount);
          }
        }
      }

      if (poData.success) {
        setPurchaseOrders(poData.purchaseOrders || []);
        if (poData.metrics) setMetrics(poData.metrics);
      }

      if (branchData.success) {
        setBranches(branchData.branches || []);
        if (branchData.branches.length > 0 && !newPOBranch) {
          const main = branchData.branches.find((b: Branch) => b.isMainWarehouse) || branchData.branches[0];
          setNewPOBranch(main._id);
        }
      }

      if (prodData.success) {
        setProducts(prodData.products || []);
      }

      if (bizData.success && bizData.business) {
        setBusiness(bizData.business);
      }
    } catch (err) {
      console.error("Error loading procurement data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Load Vouchers
  const loadVouchers = async () => {
    try {
      setLoadingVouchers(true);
      const res = await fetch(
        `/api/purchases/payments?paymentMethod=${voucherMethodFilter}${
          voucherSearchQuery ? `&q=${encodeURIComponent(voucherSearchQuery)}` : ""
        }`
      );
      const data = await res.json();
      if (data.success) {
        setVouchers(data.payments || []);
        if (data.metrics) setVoucherMetrics(data.metrics);
      }
    } catch (err) {
      console.error("Failed to load payment vouchers:", err);
    } finally {
      setLoadingVouchers(false);
    }
  };

  // Load Goods Received Notes (GRN)
  const loadGrns = async () => {
    try {
      setLoadingGrns(true);
      const params = new URLSearchParams();
      if (grnStatusFilter && grnStatusFilter !== "ALL") params.append("status", grnStatusFilter);
      if (grnInspectionFilter && grnInspectionFilter !== "ALL") params.append("inspectionStatus", grnInspectionFilter);
      if (grnSearchQuery) params.append("search", grnSearchQuery);

      const res = await fetch(`/api/grn?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setGrns(data.grns || []);
      }
    } catch (err) {
      console.error("Failed to load Goods Received Notes:", err);
    } finally {
      setLoadingGrns(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlTab = new URLSearchParams(window.location.search).get("tab");
      if (urlTab === "GRN" || urlTab === "RFQ" || urlTab === "SUPPLIERS" || urlTab === "VOUCHERS" || urlTab === "ORDERS") {
        setActiveTab(urlTab as any);
      }
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [statusFilter, supplierFilter, searchQuery]);

  useEffect(() => {
    if (activeTab === "VOUCHERS") {
      loadVouchers();
    }
  }, [activeTab, voucherMethodFilter, voucherSearchQuery]);

  useEffect(() => {
    if (activeTab === "GRN" || activeTab === "ORDERS") {
      loadGrns();
    }
  }, [activeTab, grnStatusFilter, grnInspectionFilter, grnSearchQuery]);

  // Load Supplier Passbook Statement
  const handleOpenStatement = async (supplier: Supplier) => {
    setStatementSupplier(supplier);
    setLoadingStatement(true);
    try {
      const res = await fetch(`/api/suppliers/${supplier._id}/payments`);
      const data = await res.json();
      if (data.success) {
        setStatementData(data.statement || []);
      }
    } catch (err) {
      console.error("Failed to load supplier statement:", err);
    } finally {
      setLoadingStatement(false);
    }
  };

  // Add line item in new PO modal
  const handleAddLineItem = () => {
    if (!selectedProductToAdd) return;
    const prod = products.find((p) => p._id === selectedProductToAdd);
    if (!prod) return;

    const qty = parseFloat(addQty) || 1;
    const cost = parseFloat(addCost !== "" ? addCost : prod.costPrice.toString()) || 0;

    if (poLineItems.some((i) => i.productId === prod._id)) {
      alert("This product is already in the order list.");
      return;
    }

    setPoLineItems([
      ...poLineItems,
      {
        productId: prod._id,
        name: prod.name,
        sku: prod.sku,
        unit: prod.unit || "pcs",
        quantityOrdered: qty,
        unitCost: cost,
      },
    ]);

    setSelectedProductToAdd("");
    setAddQty("10");
    setAddCost("");
  };

  const handleRemoveLineItem = (productId: string) => {
    setPoLineItems(poLineItems.filter((i) => i.productId !== productId));
  };

  // Create Purchase Order
  const handleCreatePO = async (receiveImmediately: boolean, saveAsDraft: boolean) => {
    if (!newPOSupplier) {
      alert("Please select a supplier.");
      return;
    }
    if (poLineItems.length === 0) {
      alert("Please add at least one line item to the order.");
      return;
    }

    setSubmittingPO(true);
    try {
      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: newPOSupplier,
          branchId: newPOBranch || undefined,
          items: poLineItems.map((i) => ({
            productId: i.productId,
            quantityOrdered: i.quantityOrdered,
            unitCost: i.unitCost,
          })),
          expectedDeliveryDate: newPODeliveryDate || undefined,
          supplierInvoiceNumber: newPOSupplierInv.trim() || undefined,
          notes: newPONotes.trim() || undefined,
          receiveImmediately,
          saveAsDraft,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIsNewPOOpen(false);
        setPoLineItems([]);
        setNewPONotes("");
        setNewPOSupplierInv("");
        setStatusMessage({
          type: "success",
          text: data.message || "Purchase Order created successfully.",
        });
        loadData();
      } else {
        alert(data.error || "Failed to create PO.");
      }
    } catch (err: any) {
      alert(err.message || "Network error.");
    } finally {
      setSubmittingPO(false);
    }
  };

  // Open Dock Inspection / Receive GRN Modal
  const handleOpenReceiveModal = (po: PurchaseOrder) => {
    setReceivingPO(po);
    setSupplierBillNumber(po.supplierInvoiceNumber || "");
    setSupplierInvoiceDate(new Date().toISOString().slice(0, 10));
    setDockInspectionNotes("");

    const initialItems: DockInspectionItemInput[] = po.items.map((item, idx) => {
      const alreadyRec = item.quantityReceived || 0;
      const remaining = Math.max(0, item.quantityOrdered - alreadyRec);
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const nextYearDate = new Date();
      nextYearDate.setFullYear(nextYearDate.getFullYear() + 1);

      return {
        productId: item.productId,
        name: item.name,
        sku: item.sku || "",
        unit: item.unit || "pcs",
        orderedQuantity: item.quantityOrdered,
        alreadyReceived: alreadyRec,
        receivedQuantity: remaining,
        rejectedQuantity: 0,
        rejectionReason: "DAMAGED_PACKAGING",
        rejectionNotes: "",
        unitCost: item.unitCost,
        batchNumber: `LOT-${todayStr}-${(idx + 1).toString().padStart(2, "0")}`,
        manufacturingDate: new Date().toISOString().slice(0, 10),
        expiryDate: nextYearDate.toISOString().slice(0, 10),
        mrp: Math.round(item.unitCost * 1.3).toString(),
        sellingPrice: Math.round(item.unitCost * 1.3).toString(),
        qcInspectionNotes: "Outer seal intact, packaging inspected clean.",
      };
    });

    setDockItems(initialItems);
  };

  // Confirm or Draft GRN Inward Stock Receipt
  const handleConfirmReceiveGRN = async (confirmImmediately: boolean = true) => {
    if (!receivingPO) return;
    if (!supplierBillNumber.trim()) {
      alert("Please enter the Supplier Delivery / Invoice Bill number.");
      return;
    }

    setSubmittingReceive(true);
    try {
      const payloadItems = dockItems.map((item) => {
        const recQty = Math.max(0, Number(item.receivedQuantity) || 0);
        const rejQty = Math.max(0, Number(item.rejectedQuantity) || 0);
        const accQty = Math.max(0, recQty - rejQty);
        return {
          productId: item.productId,
          name: item.name,
          sku: item.sku,
          unit: item.unit,
          orderedQuantity: item.orderedQuantity,
          receivedQuantity: recQty,
          acceptedQuantity: accQty,
          rejectedQuantity: rejQty,
          rejectionReason: rejQty > 0 ? item.rejectionReason : undefined,
          rejectionNotes: rejQty > 0 ? item.rejectionNotes.trim() : undefined,
          unitCost: item.unitCost,
          batchNumber: item.batchNumber.trim() || undefined,
          manufacturingDate: item.manufacturingDate || undefined,
          expiryDate: item.expiryDate || undefined,
          mrp: item.mrp ? parseFloat(item.mrp) : undefined,
          sellingPrice: item.sellingPrice ? parseFloat(item.sellingPrice) : undefined,
          qcInspectionNotes: item.qcInspectionNotes.trim() || undefined,
        };
      });

      const res = await fetch("/api/grn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseOrderId: receivingPO._id,
          supplierInvoiceNumber: supplierBillNumber.trim(),
          supplierInvoiceDate: supplierInvoiceDate || new Date().toISOString(),
          notes: dockInspectionNotes.trim() || undefined,
          confirmImmediately,
          items: payloadItems,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setReceivingPO(null);
        setStatusMessage({
          type: "success",
          text: data.message || "Goods received and vendor credit updated.",
        });
        loadData();
        loadGrns();
        if (data.grn) {
          setViewingGrnReceipt(data.grn);
        }
      } else {
        alert(data.error || "Failed to receive goods.");
      }
    } catch (err: any) {
      alert(err.message || "Error receiving goods.");
    } finally {
      setSubmittingReceive(false);
    }
  };

  // Confirm Draft GRN
  const handleConfirmDraftGrn = async (grnId: string) => {
    if (!confirm("Are you sure you want to confirm this GRN and post items to inventory & vendor AP balance?")) return;
    try {
      const res = await fetch(`/api/grn/${grnId}/confirm`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: "success", text: data.message || "GRN confirmed successfully." });
        loadGrns();
        loadData();
      } else {
        alert(data.error || "Failed to confirm GRN.");
      }
    } catch (err: any) {
      alert(err.message || "Network error.");
    }
  };

  // Cancel Draft GRN
  const handleCancelDraftGrn = async (grnId: string) => {
    const reason = prompt("Enter a reason for cancelling this draft GRN:");
    if (!reason || !reason.trim()) return;
    try {
      const res = await fetch(`/api/grn/${grnId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancellationReason: reason.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: "success", text: data.message || "GRN cancelled." });
        loadGrns();
      } else {
        alert(data.error || "Failed to cancel GRN.");
      }
    } catch (err: any) {
      alert(err.message || "Network error.");
    }
  };

  // Open Putaway Modal & Fetch Recommended Bins
  const handleOpenPutawayModal = async (grn: GoodsReceivedNoteData) => {
    setPutawayGrn(grn);
    setLoadingPutawaySuggestions(true);
    try {
      const res = await fetch("/api/warehouse/putaway/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grnId: grn._id }),
      });
      const data = await res.json();
      if (data.success) {
        setPutawaySuggestions(data.suggestions || []);
      }
    } catch (err) {
      console.error("Failed to load putaway suggestions", err);
    } finally {
      setLoadingPutawaySuggestions(false);
    }
  };

  // Confirm and commit Putaway allocations to physical bins
  const handleConfirmPutaway = async () => {
    if (!putawayGrn) return;
    setSubmittingPutawayConfirm(true);
    try {
      const assignments: any[] = [];
      for (const s of putawaySuggestions) {
        if (s.acceptedQuantity > 0 && s.suggestedAcceptedBin) {
          assignments.push({
            itemId: s.itemId,
            productId: s.productId,
            productName: s.productName,
            sku: s.sku,
            unit: s.unit,
            binId: s.suggestedAcceptedBin._id,
            quantity: s.acceptedQuantity,
            batchNumber: s.batchNumber,
            expiryDate: s.expiryDate,
          });
        }
        if (s.rejectedQuantity > 0 && s.suggestedQuarantineBin) {
          assignments.push({
            itemId: s.itemId,
            productId: s.productId,
            productName: s.productName,
            sku: s.sku,
            unit: s.unit,
            binId: s.suggestedQuarantineBin._id,
            quantity: s.rejectedQuantity,
            batchNumber: s.batchNumber,
            expiryDate: s.expiryDate,
            isQuarantine: true,
          });
        }
      }

      const res = await fetch("/api/warehouse/putaway/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grnId: putawayGrn._id,
          assignments,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: "success",
          text: data.message || "Dock putaway recorded! Bin inventory updated.",
        });
        setPutawayGrn(null);
        loadGrns();
      } else {
        alert(data.error || "Failed to confirm putaway.");
      }
    } catch (err: any) {
      alert(err.message || "Error confirming putaway.");
    } finally {
      setSubmittingPutawayConfirm(false);
    }
  };

  // Cancel PO
  const handleCancelPO = async (poId: string) => {
    const reason = prompt("Enter a reason for cancelling this Purchase Order:");
    if (!reason || !reason.trim()) return;

    try {
      const res = await fetch(`/api/purchases/${poId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CANCEL", cancellationReason: reason.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: "success", text: data.message || "PO cancelled." });
        loadData();
      } else {
        alert(data.error || "Failed to cancel PO.");
      }
    } catch (err: any) {
      alert(err.message || "Error cancelling PO.");
    }
  };

  // Save Supplier
  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierForm.name.trim() || !supplierForm.phone.trim()) {
      alert("Supplier name and phone number are required.");
      return;
    }

    setSubmittingSupplier(true);
    try {
      const isEdit = Boolean(supplierForm._id);
      const url = isEdit ? `/api/suppliers/${supplierForm._id}` : "/api/suppliers";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(supplierForm),
      });

      const data = await res.json();
      if (data.success) {
        setIsSupplierModalOpen(false);
        setStatusMessage({
          type: "success",
          text: data.message || `Supplier "${supplierForm.name}" saved successfully.`,
        });
        loadData();
      } else {
        alert(data.error || "Failed to save supplier.");
      }
    } catch (err: any) {
      alert(err.message || "Error saving supplier.");
    } finally {
      setSubmittingSupplier(false);
    }
  };

  // Submit Supplier Payment Voucher
  const handleRecordSupplierPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingSupplier) return;

    const amt = parseFloat(paymentAmount) || 0;
    if (amt <= 0) {
      alert("Payment amount must be greater than zero.");
      return;
    }

    setSubmittingPayment(true);
    try {
      const res = await fetch(`/api/suppliers/${payingSupplier._id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amt,
          paymentMethod,
          chequeNumber: chequeNumber.trim() || undefined,
          chequeDate: chequeDate || undefined,
          bankName: bankName.trim() || undefined,
          notes: paymentNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setPayingSupplier(null);
        setPaymentAmount("");
        setChequeNumber("");
        setBankName("");
        setPaymentNotes("");
        setStatusMessage({
          type: "success",
          text: data.message || "Supplier payment voucher recorded.",
        });

        // Open printable payment voucher
        if (data.payment) {
          setActivePrintPayment({
            paymentNumber: data.payment.paymentNumber,
            supplierName: payingSupplier.name,
            amount: amt,
            balanceBefore: data.supplier?.previousBalance ?? payingSupplier.currentBalance,
            balanceAfter: data.supplier?.currentBalance ?? Math.max(0, payingSupplier.currentBalance - amt),
            paymentMethod,
            chequeNumber: chequeNumber.trim() || undefined,
            chequeDate: chequeDate || undefined,
            bankName: bankName.trim() || undefined,
            paidBy: "Store Accountant",
            createdAt: new Date(),
          });
        }

        loadData();
        loadVouchers();
      } else {
        alert(data.error || "Failed to record payment.");
      }
    } catch (err: any) {
      alert(err.message || "Error recording payment.");
    } finally {
      setSubmittingPayment(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Procurement, Purchase Orders & Accounts Payable
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                {suppliers.length} Vendors
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage FMCG distributor credit, issue Purchase Orders, receive stock (GRN), and record cheque/bank settlements
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/grn/scan"
              className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-purple-500/20 transition"
              title="Launch Mobile Barcode Receiving Scanner"
            >
              <Barcode className="w-3.5 h-3.5" />
              <span>Mobile Scanner</span>
            </Link>

            <button
              type="button"
              onClick={() => {
                setSupplierForm({
                  _id: "",
                  name: "",
                  code: "",
                  contactPerson: "",
                  phone: "",
                  email: "",
                  address: "",
                  taxNumber: "",
                  paymentTermsDays: 30,
                  creditLimit: 0,
                  notes: "",
                });
                setIsSupplierModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Add Supplier</span>
            </button>

            <button
              type="button"
              onClick={() => setIsNewPOOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-blue-500/20 transition"
            >
              <Plus className="w-4 h-4" />
              <span>New Purchase Order (PO)</span>
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
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{statusMessage.text}</span>
            </div>
            <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-slate-700 ml-2">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 4 Summary KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Total Accounts Payable
              </span>
              <div className="text-xl font-black text-rose-700 font-mono mt-0.5">
                {formatCurrency(supplierPayableTotal)}
              </div>
            </div>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Open Purchase Orders
              </span>
              <div className="text-xl font-black text-slate-900 font-mono mt-0.5">
                {metrics.openOrdersCount}
              </div>
            </div>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Received GRN Orders
              </span>
              <div className="text-xl font-black text-slate-900 font-mono mt-0.5">
                {metrics.receivedOrdersCount}
              </div>
            </div>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Active Vendors
              </span>
              <div className="text-xl font-black text-slate-900 font-mono mt-0.5">
                {suppliers.filter((s) => s.isActive).length}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 gap-6">
          <button
            type="button"
            onClick={() => setActiveTab("ORDERS")}
            className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
              activeTab === "ORDERS"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Purchase Orders</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 font-mono text-slate-700">
              {metrics.totalCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("REORDER_PLANNER")}
            className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
              activeTab === "REORDER_PLANNER"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Boxes className="w-4 h-4 text-blue-600" />
            <span>Auto-Reorder Engine</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 font-mono text-blue-800 font-bold">
              AI Planner
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("GRN")}

            className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
              activeTab === "GRN"
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>GRN & Dock Receiving</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 font-mono text-emerald-800 font-bold">
              {grns.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("RFQ")}
            className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
              activeTab === "RFQ"
                ? "border-purple-600 text-purple-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span>e-Bidding & RFQs</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("SUPPLIERS")}
            className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
              activeTab === "SUPPLIERS"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Suppliers & Accounts Payable (AP)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 font-mono text-slate-700">
              {suppliers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("VOUCHERS")}
            className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
              activeTab === "VOUCHERS"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Payment Vouchers (PV) Register</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 font-mono text-slate-700">
              {voucherMetrics.totalVouchers || vouchers.length}
            </span>
          </button>
        </div>

        {/* ================= TAB 1: PURCHASE ORDERS ================= */}
        {activeTab === "ORDERS" && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
                {[
                  { id: "ALL", label: "All POs" },
                  { id: "SENT", label: "Sent / Open" },
                  { id: "PARTIALLY_RECEIVED", label: "Partially Received" },
                  { id: "RECEIVED", label: "Received (GRN)" },
                  { id: "DRAFT", label: "Draft" },
                  { id: "CANCELLED", label: "Cancelled" },
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
                <div className="relative flex-1 md:w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search PO #, Invoice #..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <select
                  value={supplierFilter}
                  onChange={(e) => setSupplierFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none"
                >
                  <option value="">Supplier: Any</option>
                  {suppliers.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* PO Data Table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">PO Number & Date</th>
                      <th className="py-3 px-4">Supplier & Delivery Branch</th>
                      <th className="py-3 px-4">Items Ordered / Received</th>
                      <th className="py-3 px-4 text-right">Total Order Value</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          Loading purchase orders...
                        </td>
                      </tr>
                    ) : purchaseOrders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center space-y-2">
                          <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                          <p className="text-slate-500 font-semibold">No purchase orders found.</p>
                          <button
                            type="button"
                            onClick={() => setIsNewPOOpen(true)}
                            className="px-3.5 py-1.5 bg-blue-600 text-white rounded-lg font-bold text-xs"
                          >
                            Create First Purchase Order
                          </button>
                        </td>
                      </tr>
                    ) : (
                      purchaseOrders.map((po) => {
                        const totalOrdered = po.items.reduce((sum, i) => sum + i.quantityOrdered, 0);
                        const totalReceived = po.items.reduce((sum, i) => sum + (i.quantityReceived || 0), 0);

                        return (
                          <tr key={po._id} className="hover:bg-slate-50/70 transition">
                            <td className="py-3 px-4">
                              <span className="font-mono font-bold text-slate-900 block">{po.poNumber}</span>
                              <span className="text-[10px] text-slate-400">{formatSLDateTime(po.createdAt)}</span>
                              {po.supplierInvoiceNumber && (
                                <span className="text-[10px] font-mono text-blue-700 block">
                                  Bill: {po.supplierInvoiceNumber}
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              <span className="font-bold text-slate-900 block">{po.supplierName}</span>
                              <span className="text-[10px] text-slate-500">
                                Delivery: {po.branchName || "Main Central Warehouse"}
                              </span>
                            </td>

                            <td className="py-3 px-4">
                              <span className="font-semibold text-slate-800 block">
                                {totalOrdered} Units ({po.items.length} SKUs)
                              </span>
                              <div className="mt-1 flex items-center gap-1.5">
                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[90px]">
                                  <div
                                    className={`h-full transition-all ${
                                      totalReceived >= totalOrdered
                                        ? "bg-emerald-500"
                                        : totalReceived > 0
                                        ? "bg-amber-500"
                                        : "bg-slate-300"
                                    }`}
                                    style={{
                                      width: `${Math.min(100, Math.round((totalReceived / (totalOrdered || 1)) * 100))}%`,
                                    }}
                                  />
                                </div>
                                <span
                                  className={`text-[10px] font-bold font-mono ${
                                    totalReceived >= totalOrdered
                                      ? "text-emerald-700"
                                      : totalReceived > 0
                                      ? "text-amber-700"
                                      : "text-slate-400"
                                  }`}
                                >
                                  {totalReceived}/{totalOrdered}
                                </span>
                              </div>
                            </td>

                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                              {formatCurrency(po.netTotal)}
                            </td>

                            <td className="py-3 px-4 text-center">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  po.status === "RECEIVED"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : po.status === "PARTIALLY_RECEIVED"
                                    ? "bg-amber-100 text-amber-800"
                                    : po.status === "SENT"
                                    ? "bg-blue-100 text-blue-800"
                                    : po.status === "CANCELLED"
                                    ? "bg-rose-100 text-rose-800"
                                    : "bg-slate-100 text-slate-800"
                                }`}
                              >
                                {po.status.replace("_", " ")}
                              </span>
                            </td>

                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* View PO Details */}
                                <button
                                  type="button"
                                  onClick={() => setViewingPO(po)}
                                  title="View Order Details & SKUs"
                                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>

                                {/* Print PO */}
                                <button
                                  type="button"
                                  onClick={() => setActivePrintPO(po)}
                                  title="Print Purchase Order Document"
                                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>

                                {/* Receive Stock (GRN) */}
                                {(po.status === "SENT" || po.status === "PARTIALLY_RECEIVED" || po.status === "DRAFT") && (
                                  <>
                                    <Link
                                      href={`/grn/scan?poId=${po._id}`}
                                      title="Scan in Delivery with Mobile Barcode Scanner"
                                      className="p-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs"
                                    >
                                      <Barcode className="w-3.5 h-3.5" />
                                    </Link>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenReceiveModal(po)}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs"
                                    >
                                      <Check className="w-3 h-3" /> Receive (GRN)
                                    </button>
                                  </>
                                )}

                                {/* Cancel */}
                                {(po.status === "SENT" || po.status === "DRAFT") && (
                                  <button
                                    type="button"
                                    onClick={() => handleCancelPO(po._id)}
                                    title="Cancel PO"
                                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
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

        {/* ================= TAB: AUTO-REORDER INTELLIGENCE ENGINE ================= */}
        {activeTab === "REORDER_PLANNER" && (
          <AutomatedReorderPlanner
            onViewPO={(poId) => {
              setActiveTab("ORDERS");
            }}
          />
        )}

        {/* ================= TAB: GRN & DOCK RECEIVING ================= */}

        {activeTab === "GRN" && (
          <div className="space-y-4">
            {/* GRN Metrics Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Inward GRNs</span>
                  <div className="text-xl font-black text-slate-900 font-mono mt-0.5">{grns.length}</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
                  <FileCheck className="w-5 h-5" />
                </div>
              </div>

              <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">100% Accepted Clean</span>
                  <div className="text-xl font-black text-emerald-800 font-mono mt-0.5">
                    {grns.filter((g) => g.inspectionStatus === "PASSED").length}
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>

              <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">Variances / Quarantined</span>
                  <div className="text-xl font-black text-amber-800 font-mono mt-0.5">
                    {grns.filter((g) => g.inspectionStatus === "PARTIALLY_ACCEPTED" || g.inspectionStatus === "REJECTED").length}
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              </div>

              <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Intake Credited (AP)</span>
                  <div className="text-xl font-black text-slate-900 font-mono mt-0.5">
                    {formatCurrency(
                      grns.reduce((sum, g) => sum + (g.status === "CONFIRMED" ? g.totalAcceptedCost : 0), 0)
                    )}
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center">
                  <Truck className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={grnSearchQuery}
                    onChange={(e) => setGrnSearchQuery(e.target.value)}
                    placeholder="Search GRN #, PO #, Vendor, Invoice..."
                    className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs w-64 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <select
                  value={grnStatusFilter}
                  onChange={(e) => setGrnStatusFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="DRAFT">Draft</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>

                <select
                  value={grnInspectionFilter}
                  onChange={(e) => setGrnInspectionFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
                >
                  <option value="ALL">All Inspection Results</option>
                  <option value="PASSED">100% Passed</option>
                  <option value="PARTIALLY_ACCEPTED">Partially Accepted</option>
                  <option value="REJECTED">Rejected at Dock</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => loadGrns()}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition"
                >
                  Refresh
                </button>
                <Link
                  href="/grn/scan"
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <Barcode className="w-3.5 h-3.5" />
                  <span>Mobile Barcode Intake</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setActiveTab("ORDERS")}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Receive PO at Dock</span>
                </button>
              </div>
            </div>

            {/* GRN Table */}
            <div className="overflow-hidden border border-slate-200 rounded-2xl bg-white shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3.5">GRN # & Date</th>
                    <th className="py-3 px-3.5">Purchase Order</th>
                    <th className="py-3 px-3.5">Vendor / Supplier</th>
                    <th className="py-3 px-3.5">Vendor Bill #</th>
                    <th className="py-3 px-3.5 text-center">Inspection Outcome</th>
                    <th className="py-3 px-3.5 text-right">Net Accepted Value</th>
                    <th className="py-3 px-3.5 text-right">Rejected Value</th>
                    <th className="py-3 px-3.5 text-center">Status</th>
                    <th className="py-3 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingGrns ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">Loading Goods Received Notes...</td>
                    </tr>
                  ) : grns.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <FileCheck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <div className="font-bold text-slate-600">No Goods Received Notes found</div>
                        <p className="text-xs text-slate-400 mt-1">Receive stock against an open Purchase Order to generate official GRNs.</p>
                      </td>
                    </tr>
                  ) : (
                    grns.map((grn) => {
                      const isDraft = grn.status === "DRAFT";
                      return (
                        <tr key={grn._id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-3.5">
                            <div className="font-mono font-bold text-slate-900">{grn.grnNumber}</div>
                            <div className="text-[10px] text-slate-400">{formatSLDateTime(grn.createdAt)}</div>
                          </td>
                          <td className="py-3 px-3.5 font-mono text-slate-700 font-semibold">
                            {grn.poNumber}
                          </td>
                          <td className="py-3 px-3.5">
                            <span className="font-bold text-slate-900 block">{grn.supplierName}</span>
                            <span className="text-[10px] text-slate-500">{grn.branchName || "Central Warehouse"}</span>
                          </td>
                          <td className="py-3 px-3.5 font-mono text-slate-600">
                            {grn.supplierInvoiceNumber || "—"}
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                grn.inspectionStatus === "PASSED"
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  : grn.inspectionStatus === "PARTIALLY_ACCEPTED"
                                  ? "bg-amber-50 text-amber-800 border-amber-200"
                                  : "bg-red-50 text-red-800 border-red-200"
                              }`}
                            >
                              {grn.inspectionStatus === "PASSED"
                                ? "100% Passed"
                                : grn.inspectionStatus === "PARTIALLY_ACCEPTED"
                                ? "Partially Accepted"
                                : "Rejected"}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-700">
                            {formatCurrency(grn.totalAcceptedCost)}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono text-red-600">
                            {grn.totalRejectedCost > 0 ? `- ${formatCurrency(grn.totalRejectedCost)}` : "—"}
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                grn.status === "CONFIRMED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : grn.status === "DRAFT"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {grn.status}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setViewingGrnReceipt(grn)}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition"
                                title="Print Official GRN Slip"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              {!isDraft && grn.status === "CONFIRMED" && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenPutawayModal(grn)}
                                  className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition ${
                                    grn.putawayStatus === "COMPLETED"
                                      ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200"
                                      : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                                  }`}
                                  title="Warehouse Dock Putaway Assistant"
                                >
                                  <Boxes className="w-3.5 h-3.5" />
                                  <span>{grn.putawayStatus === "COMPLETED" ? "Putaway Done" : "Putaway"}</span>
                                </button>
                              )}
                              {isDraft && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleConfirmDraftGrn(grn._id)}
                                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCancelDraftGrn(grn._id)}
                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                                    title="Cancel Draft GRN"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </>
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
        )}

        {/* ================= TAB: E-BIDDING & RFQS ================= */}
        {activeTab === "RFQ" && (
          <RfqBiddingManager
            products={products}
            suppliers={suppliers}
            branches={branches}
            onPoCreated={loadData}
            setStatusMessage={setStatusMessage}
          />
        )}

        {/* ================= TAB 2: SUPPLIERS & ACCOUNTS PAYABLE ================= */}
        {activeTab === "SUPPLIERS" && (
          <div className="space-y-4">
            {/* Accounts Payable Aging Analysis Widget */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Accounts Payable (AP) Aging Analysis
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Debt breakdown categorized by distributor credit terms and receipt dates
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Net Payable</span>
                  <span className="text-base font-black font-mono text-rose-700">
                    {formatCurrency(supplierPayableTotal)}
                  </span>
                </div>
              </div>

              {/* 4 Aging Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
                  <div className="flex justify-between items-center text-[10px] text-emerald-800 font-bold uppercase">
                    <span>0 – 14 Days</span>
                    <span className="bg-emerald-200/60 px-1 rounded">Current</span>
                  </div>
                  <div className="text-base font-black font-mono text-emerald-900 mt-1">
                    {formatCurrency(supplierAging.current)}
                  </div>
                  <span className="text-[9px] text-emerald-700">Normal credit cycle</span>
                </div>

                <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200">
                  <div className="flex justify-between items-center text-[10px] text-blue-800 font-bold uppercase">
                    <span>15 – 30 Days</span>
                    <span className="bg-blue-200/60 px-1 rounded">Due Soon</span>
                  </div>
                  <div className="text-base font-black font-mono text-blue-900 mt-1">
                    {formatCurrency(supplierAging.days15to30)}
                  </div>
                  <span className="text-[9px] text-blue-700">Standard 30-day terms</span>
                </div>

                <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200">
                  <div className="flex justify-between items-center text-[10px] text-amber-800 font-bold uppercase">
                    <span>31 – 60 Days</span>
                    <span className="bg-amber-200/60 px-1 rounded">Action Due</span>
                  </div>
                  <div className="text-base font-black font-mono text-amber-900 mt-1">
                    {formatCurrency(supplierAging.days31to60)}
                  </div>
                  <span className="text-[9px] text-amber-700">Issue settlement cheque</span>
                </div>

                <div className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-200">
                  <div className="flex justify-between items-center text-[10px] text-rose-800 font-bold uppercase">
                    <span>60+ Days</span>
                    <span className="bg-rose-200/60 px-1 rounded">Overdue</span>
                  </div>
                  <div className="text-base font-black font-mono text-rose-900 mt-1">
                    {formatCurrency(supplierAging.over60)}
                  </div>
                  <span className="text-[9px] text-rose-700">Supply hold risk</span>
                </div>
              </div>

              {/* Proportional visual bar */}
              {supplierPayableTotal > 0 && (
                <div className="space-y-1">
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full transition-all"
                      style={{
                        width: `${Math.round((supplierAging.current / supplierPayableTotal) * 100)}%`,
                      }}
                      title={`Current (0-14d): ${formatCurrency(supplierAging.current)}`}
                    />
                    <div
                      className="bg-blue-500 h-full transition-all"
                      style={{
                        width: `${Math.round((supplierAging.days15to30 / supplierPayableTotal) * 100)}%`,
                      }}
                      title={`15-30d: ${formatCurrency(supplierAging.days15to30)}`}
                    />
                    <div
                      className="bg-amber-500 h-full transition-all"
                      style={{
                        width: `${Math.round((supplierAging.days31to60 / supplierPayableTotal) * 100)}%`,
                      }}
                      title={`31-60d: ${formatCurrency(supplierAging.days31to60)}`}
                    />
                    <div
                      className="bg-rose-500 h-full transition-all"
                      style={{
                        width: `${Math.round((supplierAging.over60 / supplierPayableTotal) * 100)}%`,
                      }}
                      title={`60+d Overdue: ${formatCurrency(supplierAging.over60)}`}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                    <span>🟢 0-14d: {Math.round((supplierAging.current / (supplierPayableTotal || 1)) * 100)}%</span>
                    <span>🔵 15-30d: {Math.round((supplierAging.days15to30 / (supplierPayableTotal || 1)) * 100)}%</span>
                    <span>🟡 31-60d: {Math.round((supplierAging.days31to60 / (supplierPayableTotal || 1)) * 100)}%</span>
                    <span>🔴 60+d: {Math.round((supplierAging.over60 / (supplierPayableTotal || 1)) * 100)}%</span>
                  </div>
                </div>
              )}

              {/* Credit Limit Alert Banner */}
              {creditLimitExceededCount > 0 && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      <strong>{creditLimitExceededCount} Vendor(s) have exceeded agreed credit limits.</strong> Settle outstanding bills to avoid delivery stoppages.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Supplier Search & Filter Bar */}
            <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="relative flex-1 w-full sm:w-72">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={supplierSearch}
                  onChange={(e) => setSupplierSearch(e.target.value)}
                  placeholder="Search vendor by name, phone, code, rep..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-semibold">
                  <input
                    type="checkbox"
                    checked={hasDebtOnly}
                    onChange={(e) => setHasDebtOnly(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                  />
                  <span>Show Only Vendors With Pending Debt</span>
                </label>
              </div>
            </div>

            {/* Supplier Table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Supplier Name & Code</th>
                      <th className="py-3 px-4">Contact Person & Phone</th>
                      <th className="py-3 px-4">Payment Terms</th>
                      <th className="py-3 px-4 text-right">Outstanding Debt (AP)</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {suppliers
                      .filter((s) => {
                        if (hasDebtOnly && s.currentBalance <= 0) return false;
                        if (!supplierSearch.trim()) return true;
                        const q = supplierSearch.toLowerCase();
                        return (
                          s.name.toLowerCase().includes(q) ||
                          (s.code && s.code.toLowerCase().includes(q)) ||
                          (s.contactPerson && s.contactPerson.toLowerCase().includes(q)) ||
                          s.phone.toLowerCase().includes(q)
                        );
                      })
                      .map((s) => {
                        const isOverLimit = s.creditLimit > 0 && s.currentBalance > s.creditLimit;

                        return (
                          <tr key={s._id} className="hover:bg-slate-50/70 transition">
                            <td className="py-3 px-4">
                              <span className="font-bold text-slate-900 text-sm block">{s.name}</span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {s.code && <span className="font-mono text-[10px] text-slate-400">Code: {s.code}</span>}
                                {isOverLimit && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-700">
                                    ⚠️ Exceeded Limit
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="py-3 px-4 text-slate-600">
                              <span className="font-medium block">{s.contactPerson || "Sales Rep"}</span>
                              <span className="font-mono text-[11px] text-slate-500">{s.phone}</span>
                            </td>

                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700">
                                {s.paymentTermsDays === 0 ? "Cash on Delivery (COD)" : `${s.paymentTermsDays} Days Credit`}
                              </span>
                            </td>

                            <td className="py-3 px-4 text-right">
                              <span
                                className={`font-mono font-black text-sm block ${
                                  s.currentBalance > 0 ? "text-rose-600" : "text-emerald-700"
                                }`}
                              >
                                {formatCurrency(s.currentBalance || 0)}
                              </span>
                              {s.creditLimit > 0 && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  Limit: {formatCurrency(s.creditLimit)}
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Pay Supplier */}
                                {s.currentBalance > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPayingSupplier(s);
                                      setPaymentAmount(s.currentBalance.toString());
                                      setChequeDate(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
                                    }}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs"
                                  >
                                    <Wallet className="w-3 h-3" /> Pay Debt
                                  </button>
                                )}

                                {/* Vendor Portal Link */}
                                <button
                                  type="button"
                                  onClick={() => setSharingSupplierPortal(s)}
                                  title="Vendor Self-Service Portal Access Link"
                                  className="px-2 py-1 rounded-lg border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                                >
                                  <Globe className="w-3 h-3 text-indigo-600" />
                                  <span>Portal</span>
                                </button>

                                {/* Statement / Ledger */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenStatement(s)}
                                  className="px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition"
                                >
                                  Statement
                                </button>

                                {/* Edit */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSupplierForm({
                                      _id: s._id,
                                      name: s.name,
                                      code: s.code || "",
                                      contactPerson: s.contactPerson || "",
                                      phone: s.phone,
                                      email: s.email || "",
                                      address: s.address || "",
                                      taxNumber: s.taxNumber || "",
                                      paymentTermsDays: s.paymentTermsDays,
                                      creditLimit: s.creditLimit,
                                      notes: (s as any).notes || "",
                                    });
                                    setIsSupplierModalOpen(true);
                                  }}
                                  className="px-2 py-1 text-xs text-slate-400 hover:text-slate-700"
                                >
                                  Edit
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: PAYMENT VOUCHERS REGISTER ================= */}
        {activeTab === "VOUCHERS" && (
          <div className="space-y-4">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Total Disbursed
                  </span>
                  <div className="text-lg font-black text-slate-900 font-mono">
                    {formatCurrency(voucherMetrics.totalAmount)}
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Cheque Settlements
                  </span>
                  <div className="text-lg font-black text-blue-900 font-mono">
                    {formatCurrency(voucherMetrics.totalCheque)}
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Bank Transfers
                  </span>
                  <div className="text-lg font-black text-purple-900 font-mono">
                    {formatCurrency(voucherMetrics.totalBankTransfer)}
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Cash Payments
                  </span>
                  <div className="text-lg font-black text-amber-900 font-mono">
                    {formatCurrency(voucherMetrics.totalCash)}
                  </div>
                </div>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
                {[
                  { id: "ALL", label: "All Methods" },
                  { id: "CHEQUE", label: "Cheques" },
                  { id: "BANK_TRANSFER", label: "Bank Transfer" },
                  { id: "CASH", label: "Cash" },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setVoucherMethodFilter(m.id)}
                    className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition ${
                      voucherMethodFilter === m.id
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={voucherSearchQuery}
                    onChange={(e) => setVoucherSearchQuery(e.target.value)}
                    placeholder="Search Voucher #, Cheque #, Vendor..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Vouchers Table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Voucher # & Date</th>
                      <th className="py-3 px-4">Supplier & Reference</th>
                      <th className="py-3 px-4">Payment Channel & Details</th>
                      <th className="py-3 px-4 text-right">Settled Amount</th>
                      <th className="py-3 px-4 text-right">Payable Impact</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingVouchers ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          Loading payment vouchers...
                        </td>
                      </tr>
                    ) : vouchers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center space-y-2">
                          <CreditCard className="w-8 h-8 text-slate-300 mx-auto" />
                          <p className="text-slate-500 font-semibold">No payment vouchers found.</p>
                          <p className="text-slate-400 text-xs">
                            Settle supplier debts in the Suppliers tab to generate vouchers.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      vouchers.map((v) => (
                        <tr key={v.paymentNumber} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold text-slate-900 block">
                              {v.paymentNumber}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {formatSLDateTime(v.createdAt)}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900 block">{v.supplierName}</span>
                            {v.poNumber && (
                              <span className="font-mono text-[10px] text-blue-700">
                                PO: {v.poNumber}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  v.paymentMethod === "CHEQUE"
                                    ? "bg-blue-100 text-blue-800"
                                    : v.paymentMethod === "BANK_TRANSFER"
                                    ? "bg-purple-100 text-purple-800"
                                    : "bg-emerald-100 text-emerald-800"
                                }`}
                              >
                                {v.paymentMethod}
                              </span>
                            </div>
                            {v.paymentMethod === "CHEQUE" && (
                              <div className="text-[10px] text-slate-600 mt-1 space-y-0.5 font-mono">
                                <div>Chq: <strong>{v.chequeNumber || "N/A"}</strong> ({v.bankName || "Bank"})</div>
                                {v.chequeDate && (
                                  <div className="text-amber-700">
                                    Realize: {new Date(v.chequeDate).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                            )}
                            {v.paymentMethod === "BANK_TRANSFER" && (
                              <div className="text-[10px] text-slate-600 mt-1 font-mono">
                                Ref: {v.referenceNumber || v.chequeNumber || "Online Transfer"}
                                {v.bankName && ` • ${v.bankName}`}
                              </div>
                            )}
                            {v.notes && (
                              <div className="text-[10px] text-slate-400 italic mt-0.5">
                                {v.notes}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-black text-sm text-emerald-700">
                            {formatCurrency(v.amount)}
                          </td>

                          <td className="py-3 px-4 text-right font-mono text-[11px] text-slate-600">
                            <span className="line-through text-slate-400 block">
                              {formatCurrency(v.balanceBefore)}
                            </span>
                            <span className="font-bold text-slate-900 block">
                              → {formatCurrency(v.balanceAfter)}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                setActivePrintPayment({
                                  paymentNumber: v.paymentNumber,
                                  supplierName: v.supplierName,
                                  amount: v.amount,
                                  balanceBefore: v.balanceBefore,
                                  balanceAfter: v.balanceAfter,
                                  paymentMethod: v.paymentMethod,
                                  chequeNumber: v.chequeNumber,
                                  chequeDate: v.chequeDate,
                                  bankName: v.bankName,
                                  referenceNumber: v.referenceNumber,
                                  poNumber: v.poNumber,
                                  notes: v.notes,
                                  paidBy: v.paidBy || "Store Accountant",
                                  createdAt: v.createdAt,
                                })
                              }
                              className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1 ml-auto shadow-xs"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Voucher</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= MODAL: CREATE PURCHASE ORDER ================= */}
        {isNewPOOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[95vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Issue Purchase Order (PO)</h3>
                    <p className="text-[11px] text-slate-500">Procure inventory from FMCG & Pharma distributors</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewPOOpen(false)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Supplier & Destination Selectors */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Select Supplier / Vendor *
                  </label>
                  <select
                    value={newPOSupplier}
                    onChange={(e) => setNewPOSupplier(e.target.value)}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-semibold text-slate-800 focus:outline-none"
                  >
                    <option value="">Choose Supplier...</option>
                    {suppliers.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name} ({s.paymentTermsDays === 0 ? "COD" : `${s.paymentTermsDays} Days`})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Delivery Warehouse / Branch
                  </label>
                  <select
                    value={newPOBranch}
                    onChange={(e) => setNewPOBranch(e.target.value)}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-semibold text-slate-800 focus:outline-none"
                  >
                    {branches.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.code}: {b.name} {b.isMainWarehouse ? "(Main Hub)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Add Product Section */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-800 block">Add Products to Purchase Order:</span>
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-6">
                    <select
                      value={selectedProductToAdd}
                      onChange={(e) => {
                        setSelectedProductToAdd(e.target.value);
                        const p = products.find((pr) => pr._id === e.target.value);
                        if (p) setAddCost(p.costPrice.toString());
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="">Select a Product...</option>
                      {products.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name} • Cost: Rs. {p.costPrice}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-3">
                    <input
                      type="number"
                      min="1"
                      value={addQty}
                      onChange={(e) => setAddQty(e.target.value)}
                      placeholder="Qty"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-center focus:outline-none"
                    />
                  </div>

                  <div className="col-span-3 flex items-center gap-1.5">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={addCost}
                      onChange={(e) => setAddCost(e.target.value)}
                      placeholder="Unit Cost"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-center focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddLineItem}
                      className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shrink-0"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Line items table */}
              <div className="overflow-hidden border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase">
                    <tr>
                      <th className="py-2 px-3">Product Name</th>
                      <th className="py-2 px-3 w-20 text-center">Qty</th>
                      <th className="py-2 px-3 w-28 text-right">Unit Cost (Rs.)</th>
                      <th className="py-2 px-3 w-28 text-right">Total (Rs.)</th>
                      <th className="py-2 px-3 w-16 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-xs">
                    {poLineItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-400 font-sans text-xs">
                          No items added yet. Select a product above.
                        </td>
                      </tr>
                    ) : (
                      poLineItems.map((item) => (
                        <tr key={item.productId} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-sans font-semibold text-slate-800">
                            {item.name}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <input
                              type="number"
                              min="1"
                              value={item.quantityOrdered}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 1;
                                setPoLineItems(
                                  poLineItems.map((i) =>
                                    i.productId === item.productId ? { ...i, quantityOrdered: val } : i
                                  )
                                );
                              }}
                              className="w-14 px-1 py-1 text-center font-bold font-mono border border-slate-300 rounded text-xs"
                            />{" "}
                            <span className="text-[10px] text-slate-500 font-sans">{item.unit}</span>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              step="0.01"
                              value={item.unitCost}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setPoLineItems(
                                  poLineItems.map((i) =>
                                    i.productId === item.productId ? { ...i, unitCost: val } : i
                                  )
                                );
                              }}
                              className="w-20 px-1 py-1 text-right font-bold font-mono border border-slate-300 rounded text-xs"
                            />
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900">
                            {formatCurrency(item.quantityOrdered * item.unitCost)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveLineItem(item.productId)}
                              className="text-rose-600 hover:text-rose-800 font-sans text-xs font-bold"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {poLineItems.length > 0 && (
                    <tfoot className="bg-slate-50 font-bold border-t border-slate-200 text-xs">
                      <tr>
                        <td colSpan={3} className="py-2 px-3 text-right uppercase text-[10px] text-slate-600">
                          Total PO Value:
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-900 font-black">
                          {formatCurrency(
                            poLineItems.reduce((sum, i) => sum + i.quantityOrdered * i.unitCost, 0)
                          )}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Delivery and Bill Details */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Expected Delivery Date</label>
                  <input
                    type="date"
                    value={newPODeliveryDate}
                    onChange={(e) => setNewPODeliveryDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Supplier Bill # (Optional if receiving now)
                  </label>
                  <input
                    type="text"
                    value={newPOSupplierInv}
                    onChange={(e) => setNewPOSupplierInv(e.target.value)}
                    placeholder="e.g. INV-UNI-99881"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewPOOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submittingPO || poLineItems.length === 0}
                  onClick={() => handleCreatePO(false, true)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition disabled:opacity-50"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  disabled={submittingPO || poLineItems.length === 0}
                  onClick={() => handleCreatePO(false, false)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/25 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Order to Vendor</span>
                </button>
                <button
                  type="button"
                  disabled={submittingPO || poLineItems.length === 0}
                  onClick={() => handleCreatePO(true, false)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/25 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Receive Directly (Instant GRN)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= MODAL: ENHANCED DOCK INSPECTION & GRN ================= */}
        {receivingPO && (() => {
          const totalOrderedVal = dockItems.reduce((sum, it) => sum + it.orderedQuantity * it.unitCost, 0);
          const totalAcceptedVal = dockItems.reduce((sum, it) => {
            const rec = Math.max(0, Number(it.receivedQuantity) || 0);
            const rej = Math.max(0, Number(it.rejectedQuantity) || 0);
            return sum + Math.max(0, rec - rej) * it.unitCost;
          }, 0);
          const totalRejectedVal = dockItems.reduce((sum, it) => {
            const rej = Math.max(0, Number(it.rejectedQuantity) || 0);
            return sum + rej * it.unitCost;
          }, 0);

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
              <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 my-8 max-h-[92vh] overflow-y-auto">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <FileCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 text-sm">Goods Received Note (GRN) Dock Inspection</h3>
                      <p className="text-[11px] text-slate-500 font-mono">
                        PO Reference: {receivingPO.poNumber} • Vendor: {receivingPO.supplierName}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReceivingPO(null)}
                    className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Delivery Challan & Vendor Bill Header */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                      Supplier Invoice / Challan # *
                    </label>
                    <input
                      type="text"
                      required
                      value={supplierBillNumber}
                      onChange={(e) => setSupplierBillNumber(e.target.value)}
                      placeholder="e.g. INV-CBL-99120"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                      Supplier Invoice Date
                    </label>
                    <input
                      type="date"
                      value={supplierInvoiceDate}
                      onChange={(e) => setSupplierInvoiceDate(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                      Receiving Dock / Warehouse
                    </label>
                    <div className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 truncate">
                      {receivingPO.branchName || "Main Central Warehouse"}
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                      Dock QC Inspection Observation / Transit Notes
                    </label>
                    <input
                      type="text"
                      value={dockInspectionNotes}
                      onChange={(e) => setDockInspectionNotes(e.target.value)}
                      placeholder="e.g. Outer truck seals checked, temp 22°C, pallet wrap intact."
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Items Verification Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900">Line Items Dock Inspection:</span>
                      <span className="text-[11px] text-slate-500 font-mono">({dockItems.length} lines)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setDockItems((prev) =>
                            prev.map((it) => ({
                              ...it,
                              receivedQuantity: Math.max(0, it.orderedQuantity - it.alreadyReceived),
                              rejectedQuantity: 0,
                            }))
                          );
                        }}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                      >
                        Accept All Remaining
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDockItems((prev) =>
                            prev.map((it) => ({
                              ...it,
                              receivedQuantity: 0,
                              rejectedQuantity: 0,
                            }))
                          );
                        }}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                      >
                        Zero All
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {dockItems.map((item, index) => {
                      const recQty = Math.max(0, Number(item.receivedQuantity) || 0);
                      const rejQty = Math.max(0, Number(item.rejectedQuantity) || 0);
                      const accQty = Math.max(0, recQty - rejQty);
                      const isShort = recQty < (item.orderedQuantity - item.alreadyReceived);
                      const hasRejections = rejQty > 0;

                      return (
                        <div
                          key={item.productId}
                          className={`p-3.5 rounded-xl border transition text-xs space-y-2.5 ${
                            hasRejections
                              ? "bg-rose-50/40 border-rose-200"
                              : isShort
                              ? "bg-amber-50/40 border-amber-200"
                              : "bg-white border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                            <div>
                              <span className="font-bold text-slate-900 text-xs">{item.name}</span>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 font-mono">
                                {item.sku && <span>SKU: {item.sku}</span>}
                                <span>Unit: {item.unit}</span>
                                <span>PO Ordered: {item.orderedQuantity}</span>
                                {item.alreadyReceived > 0 && (
                                  <span className="text-blue-600 font-semibold">
                                    Already Inward: {item.alreadyReceived}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-slate-400 block uppercase font-bold">Line Accepted Value</span>
                              <span className="font-mono font-bold text-slate-900 text-xs">
                                {formatCurrency(accQty * item.unitCost)}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 pt-1">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                                Delivered Qty
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={item.receivedQuantity}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setDockItems((prev) =>
                                    prev.map((it, idx) => (idx === index ? { ...it, receivedQuantity: val } : it))
                                  );
                                }}
                                className="w-full px-2 py-1 text-center font-mono font-bold border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-rose-700 uppercase mb-0.5">
                                Rejected Qty
                              </label>
                              <input
                                type="number"
                                min="0"
                                max={recQty}
                                value={item.rejectedQuantity}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setDockItems((prev) =>
                                    prev.map((it, idx) => (idx === index ? { ...it, rejectedQuantity: val } : it))
                                  );
                                }}
                                className="w-full px-2 py-1 text-center font-mono font-bold border border-rose-300 text-rose-800 bg-rose-50 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-emerald-700 uppercase mb-0.5">
                                Accepted Net
                              </label>
                              <div className="px-2 py-1 text-center font-mono font-black text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg text-xs">
                                {accQty} {item.unit}
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                                Batch / Lot #
                              </label>
                              <input
                                type="text"
                                value={item.batchNumber}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDockItems((prev) =>
                                    prev.map((it, idx) => (idx === index ? { ...it, batchNumber: val } : it))
                                  );
                                }}
                                placeholder="BN-XXXX"
                                className="w-full px-2 py-1 font-mono text-center border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                                Expiry Date
                              </label>
                              <input
                                type="date"
                                value={item.expiryDate}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDockItems((prev) =>
                                    prev.map((it, idx) => (idx === index ? { ...it, expiryDate: val } : it))
                                  );
                                }}
                                className="w-full px-2 py-1 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                                MRP (Rs.)
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={item.mrp}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDockItems((prev) =>
                                    prev.map((it, idx) => (idx === index ? { ...it, mrp: val } : it))
                                  );
                                }}
                                placeholder="Retail MRP"
                                className="w-full px-2 py-1 font-mono text-center border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              />
                            </div>
                          </div>

                          {/* Rejection Details if rejected > 0 */}
                          {hasRejections && (
                            <div className="p-2.5 rounded-lg bg-rose-100/60 border border-rose-200 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              <div>
                                <label className="block text-[10px] font-bold text-rose-800 uppercase mb-0.5">
                                  Rejection Failure Reason *
                                </label>
                                <select
                                  value={item.rejectionReason}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setDockItems((prev) =>
                                      prev.map((it, idx) => (idx === index ? { ...it, rejectionReason: val } : it))
                                    );
                                  }}
                                  className="w-full px-2 py-1 bg-white border border-rose-300 rounded-lg text-xs font-semibold text-rose-900 focus:outline-none"
                                >
                                  <option value="DAMAGED_PACKAGING">Damaged / Torn Packaging</option>
                                  <option value="EXPIRED_SHORT_DATE">Expired / Short Dated (&lt;90 days)</option>
                                  <option value="WRONG_ITEM">Wrong Spec / Item Discrepancy</option>
                                  <option value="QUALITY_DEFECT">Quality / Manufacturing Defect</option>
                                  <option value="TEMPERATURE_EXCURSION">Temperature Excursion (Cold Chain Broken)</option>
                                  <option value="OTHER">Other Quarantine Reason</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-rose-800 uppercase mb-0.5">
                                  Rejection Notes (For Vendor Debit Note)
                                </label>
                                <input
                                  type="text"
                                  value={item.rejectionNotes}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setDockItems((prev) =>
                                      prev.map((it, idx) => (idx === index ? { ...it, rejectionNotes: val } : it))
                                    );
                                  }}
                                  placeholder="e.g. 2 bottles broken and leaking in carton"
                                  className="w-full px-2 py-1 bg-white border border-rose-300 rounded-lg text-xs focus:outline-none"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Batch Reconciliation Financial Summary */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">PO Ordered Value</span>
                    <span className="font-mono text-sm font-semibold text-slate-700">
                      {formatCurrency(totalOrderedVal)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-rose-600 font-bold uppercase block">Quarantined / Rejected</span>
                    <span className="font-mono text-sm font-bold text-rose-700">
                      {totalRejectedVal > 0 ? `- ${formatCurrency(totalRejectedVal)}` : "None (0.00)"}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-emerald-700 font-bold uppercase block">Net Accepted Vendor AP</span>
                    <span className="font-mono text-base font-black text-emerald-800 block">
                      {formatCurrency(totalAcceptedVal)}
                    </span>
                    <span className="text-[10px] text-slate-400">Credited to Accounts Payable ledger</span>
                  </div>
                </div>

                {/* Modal Footer Controls */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setReceivingPO(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                  >
                    Cancel
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={submittingReceive}
                      onClick={() => handleConfirmReceiveGRN(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition disabled:opacity-50"
                    >
                      Save as Draft GRN
                    </button>

                    <button
                      type="button"
                      disabled={submittingReceive}
                      onClick={() => handleConfirmReceiveGRN(true)}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/25 transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{submittingReceive ? "Processing Dock Intake..." : "Confirm GRN & Post to Inventory"}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ================= MODAL: VIEW PO DETAILS ================= */}
        {viewingPO && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[95vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      Purchase Order: {viewingPO.poNumber}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-mono">
                      Issued {formatSLDateTime(viewingPO.createdAt)} by {viewingPO.createdBy}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingPO(null)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status and Destination banner */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 block">Supplier:</span>
                  <span className="font-bold text-slate-900 text-sm block">{viewingPO.supplierName}</span>
                  {viewingPO.supplierInvoiceNumber && (
                    <span className="text-[11px] font-mono text-blue-700">
                      Bill Ref: {viewingPO.supplierInvoiceNumber}
                    </span>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-slate-500 block">Order Status:</span>
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mt-0.5 ${
                      viewingPO.status === "RECEIVED"
                        ? "bg-emerald-100 text-emerald-800"
                        : viewingPO.status === "PARTIALLY_RECEIVED"
                        ? "bg-amber-100 text-amber-800"
                        : viewingPO.status === "SENT"
                        ? "bg-blue-100 text-blue-800"
                        : viewingPO.status === "CANCELLED"
                        ? "bg-rose-100 text-rose-800"
                        : "bg-slate-100 text-slate-800"
                    }`}
                  >
                    {viewingPO.status.replace("_", " ")}
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-1">
                    Destination: {viewingPO.branchName || "Main Central Warehouse"}
                  </span>
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-hidden border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Product Name</th>
                      <th className="py-2.5 px-3 text-center">Ordered</th>
                      <th className="py-2.5 px-3 text-center">Received</th>
                      <th className="py-2.5 px-3 text-right">Unit Cost</th>
                      <th className="py-2.5 px-3 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-xs">
                    {viewingPO.items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-sans font-semibold text-slate-800">
                          {it.name}
                          {it.sku && <span className="block text-[10px] text-slate-400 font-mono">{it.sku}</span>}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-700">
                          {it.quantityOrdered} {it.unit}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`font-bold ${
                              (it.quantityReceived || 0) >= it.quantityOrdered
                                ? "text-emerald-700"
                                : (it.quantityReceived || 0) > 0
                                ? "text-amber-700"
                                : "text-slate-400"
                            }`}
                          >
                            {it.quantityReceived || 0} {it.unit}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-700">
                          {formatCurrency(it.unitCost)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                          {formatCurrency(it.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold border-t border-slate-200 text-xs">
                    <tr>
                      <td colSpan={4} className="py-2.5 px-3 text-right uppercase text-[10px] text-slate-600 font-sans">
                        Net Purchase Total:
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-900 font-black text-sm">
                        {formatCurrency(viewingPO.netTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {viewingPO.cancellationReason && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900">
                  <span className="font-bold">Cancellation Reason: </span>
                  <span>{viewingPO.cancellationReason}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setActivePrintPO(viewingPO);
                    setViewingPO(null);
                  }}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print PO</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setViewingPO(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Close
                  </button>
                  {(viewingPO.status === "SENT" || viewingPO.status === "PARTIALLY_RECEIVED" || viewingPO.status === "DRAFT") && (
                    <button
                      type="button"
                      onClick={() => {
                        handleOpenReceiveModal(viewingPO);
                        setViewingPO(null);
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/25 transition flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Receive Goods (GRN)</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= MODAL: ADD / EDIT SUPPLIER ================= */}
        {isSupplierModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      {supplierForm._id ? "Edit Supplier" : "Register Supplier / Distributor"}
                    </h3>
                    <p className="text-[11px] text-slate-500">FMCG & Pharma vendor profile</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveSupplier} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Company / Supplier Name *</label>
                  <input
                    type="text"
                    required
                    value={supplierForm.name}
                    onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                    placeholder="e.g. Unilever Sri Lanka Ltd"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Code / Short Tag</label>
                    <input
                      type="text"
                      value={supplierForm.code}
                      onChange={(e) => setSupplierForm({ ...supplierForm, code: e.target.value.toUpperCase() })}
                      placeholder="e.g. SUP-UNI"
                      className="w-full px-3 py-2 font-mono uppercase border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Phone Number *</label>
                    <input
                      type="text"
                      required
                      value={supplierForm.phone}
                      onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                      placeholder="011XXXXXXX"
                      className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Contact Person (Sales Rep)</label>
                    <input
                      type="text"
                      value={supplierForm.contactPerson}
                      onChange={(e) => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })}
                      placeholder="e.g. Kamal Perera"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Payment Terms (Days)</label>
                    <input
                      type="number"
                      min="0"
                      value={supplierForm.paymentTermsDays}
                      onChange={(e) => setSupplierForm({ ...supplierForm, paymentTermsDays: parseInt(e.target.value) || 0 })}
                      placeholder="30"
                      className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Credit Limit (Rs.)</label>
                    <input
                      type="number"
                      min="0"
                      value={supplierForm.creditLimit}
                      onChange={(e) => setSupplierForm({ ...supplierForm, creditLimit: parseFloat(e.target.value) || 0 })}
                      placeholder="500000"
                      className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">VAT / TIN Number</label>
                    <input
                      type="text"
                      value={supplierForm.taxNumber}
                      onChange={(e) => setSupplierForm({ ...supplierForm, taxNumber: e.target.value })}
                      placeholder="e.g. 102938475"
                      className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Address / Depot</label>
                  <input
                    type="text"
                    value={supplierForm.address}
                    onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                    placeholder="e.g. 258 M3 Tower, Colombo 10"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsSupplierModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingSupplier}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/25 transition disabled:opacity-50"
                  >
                    {submittingSupplier ? "Saving..." : supplierForm._id ? "Update Supplier" : "Create Supplier"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= MODAL: PAY SUPPLIER VOUCHER ================= */}
        {payingSupplier && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Issue Supplier Payment Voucher</h3>
                    <p className="text-[11px] text-slate-500">Settle accounts payable liabilities</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPayingSupplier(null)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Debt card */}
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Supplier:</span>
                  <span className="font-bold text-slate-900">{payingSupplier.name}</span>
                </div>
                <div className="flex justify-between font-bold pt-1 border-t border-rose-200/60">
                  <span className="text-rose-900">Total Outstanding Payable:</span>
                  <span className="font-mono text-rose-700 text-sm">
                    {formatCurrency(payingSupplier.currentBalance)}
                  </span>
                </div>
              </div>

              <form onSubmit={handleRecordSupplierPayment} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Payment Amount (Rs.) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-base font-bold font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <button
                      type="button"
                      onClick={() => setPaymentAmount(payingSupplier.currentBalance.toString())}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700"
                    >
                      Full Settle ({formatCurrency(payingSupplier.currentBalance)})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentAmount(Math.round(payingSupplier.currentBalance / 2).toString())}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700"
                    >
                      50% Settle
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Payment Channel *</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["CHEQUE", "BANK_TRANSFER", "CASH"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPaymentMethod(m)}
                        className={`p-2 rounded-lg border text-xs font-semibold transition ${
                          paymentMethod === m
                            ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                            : "border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {m === "CHEQUE" ? "Cheque" : m === "BANK_TRANSFER" ? "Bank Transfer" : "Cash"}
                      </button>
                    ))}
                  </div>
                </div>

                {paymentMethod === "CHEQUE" && (
                  <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Cheque Number *</label>
                      <input
                        type="text"
                        required
                        value={chequeNumber}
                        onChange={(e) => setChequeNumber(e.target.value)}
                        placeholder="e.g. CQ-998812"
                        className="w-full px-3 py-1.5 font-mono border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Realization Date *</label>
                      <input
                        type="date"
                        required
                        value={chequeDate}
                        onChange={(e) => setChequeDate(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-slate-700 font-semibold mb-1">Drawn on Bank</label>
                      <input
                        type="text"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="e.g. Commercial Bank / Sampath Bank"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                )}

                {paymentMethod === "BANK_TRANSFER" && (
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Transfer Reference #</label>
                    <input
                      type="text"
                      value={chequeNumber}
                      onChange={(e) => setChequeNumber(e.target.value)}
                      placeholder="e.g. FT-20260930-8812"
                      className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Notes / Remarks</label>
                  <input
                    type="text"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="e.g. Handed to delivery rep"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setPayingSupplier(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingPayment}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/25 transition disabled:opacity-50"
                  >
                    {submittingPayment ? "Recording..." : "Confirm & Print Payment Voucher"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= MODAL: SUPPLIER STATEMENT PASSBOOK ================= */}
        {statementSupplier && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      {statementSupplier.name} — Vendor Statement
                    </h3>
                    <p className="text-[11px] text-slate-500">Chronological history of bills and payments</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStatementSupplier(null)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Outstanding debt highlight */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500 block">Payment Terms:</span>
                  <span className="font-semibold text-slate-800">
                    {statementSupplier.paymentTermsDays === 0 ? "Cash on Delivery" : `${statementSupplier.paymentTermsDays} Days Credit`}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block">Current Balance Payable:</span>
                  <span className="font-mono font-black text-rose-700 text-base">
                    {formatCurrency(statementSupplier.currentBalance)}
                  </span>
                </div>
              </div>

              {/* Statement Table */}
              <div className="overflow-hidden border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Reference / Description</th>
                      <th className="py-2.5 px-3 text-right">Bill (+)</th>
                      <th className="py-2.5 px-3 text-right">Paid (-)</th>
                      <th className="py-2.5 px-3 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-xs">
                    {loadingStatement ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400 font-sans">
                          Loading statement entries...
                        </td>
                      </tr>
                    ) : statementData.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400 font-sans">
                          No transactions found for this vendor.
                        </td>
                      </tr>
                    ) : (
                      statementData.map((entry, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3 text-[11px] text-slate-500">
                            {new Date(entry.date).toLocaleDateString()}
                          </td>
                          <td className="py-2 px-3 font-sans">
                            <span className="font-bold text-slate-900 block font-mono text-xs">{entry.ref}</span>
                            <span className="text-[10px] text-slate-500">{entry.description}</span>
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-rose-700">
                            {entry.billAmount ? `+${formatCurrency(entry.billAmount)}` : "—"}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-emerald-700">
                            {entry.paidAmount ? `-${formatCurrency(entry.paidAmount)}` : "—"}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900">
                            {formatCurrency(entry.runningBalance)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= MODAL: PRINTABLE PO ================= */}
        {activePrintPO && (
          <PurchaseOrderReceipt
            business={
              business || {
                name: "Sri Lanka Commercial Store",
                address: "Procurement Division",
              }
            }
            purchaseOrder={activePrintPO as any}
            onClose={() => setActivePrintPO(null)}
          />
        )}

        {/* ================= MODAL: PRINTABLE PAYMENT VOUCHER ================= */}
        {activePrintPayment && (
          <SupplierPaymentReceipt
            business={
              business || {
                name: "Sri Lanka Commercial Store",
              }
            }
            payment={activePrintPayment}
            onClose={() => setActivePrintPayment(null)}
          />
        )}

        {/* ================= MODAL: PRINTABLE GRN ================= */}
        {viewingGrnReceipt && (
          <GoodsReceivedNoteReceipt
            business={
              business || {
                name: "Sri Lanka Commercial Store",
                address: "Procurement & Receiving Dock Division",
              }
            }
            grn={viewingGrnReceipt}
            onClose={() => setViewingGrnReceipt(null)}
          />
        )}

        {/* ================= MODAL: VENDOR PORTAL SHARE ================= */}
        {sharingSupplierPortal && (
          <VendorPortalShareModal
            supplier={sharingSupplierPortal}
            storeName={business?.name || "Our Store"}
            onClose={() => setSharingSupplierPortal(null)}
          />
        )}

        {/* ================= MODAL: WAREHOUSE DOCK PUTAWAY ASSISTANT ================= */}
        {putawayGrn && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 max-h-[92vh] flex flex-col">
              <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <Boxes className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-slate-900">
                        Dock Putaway Assistant
                      </h3>
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 font-mono text-[11px] font-bold border border-indigo-200">
                        {putawayGrn.grnNumber}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Vendor: {putawayGrn.supplierName} &bull; PO: {putawayGrn.poNumber} &bull; Facility:{" "}
                      {putawayGrn.branchName || "Main Central Warehouse"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPutawayGrn(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {loadingPutawaySuggestions ? (
                <div className="py-16 text-center text-slate-400">
                  <Sparkles className="w-7 h-7 animate-spin mx-auto mb-2 text-indigo-600" />
                  <div className="font-bold text-slate-700 text-xs">
                    Analyzing Warehouse Spatial Layout...
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Matching pick-face capacity, FIFO batch ordering, and defect quarantine zones.
                  </p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-4 py-3">
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-2xl text-xs text-indigo-900 flex items-center justify-between">
                    <div>
                      <span className="font-bold block">Automated Spatial Putaway Routing</span>
                      <span className="text-[11px] text-indigo-700">
                        Accepted goods are mapped to ground pick-faces or nearest overstock. Quarantined defects are isolated in Zone Q.
                      </span>
                    </div>
                    <span className="font-bold font-mono text-indigo-800 text-xs">
                      {putawaySuggestions.length} Items Evaluated
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Item Description</th>
                          <th className="py-2.5 px-3">Batch & Expiry</th>
                          <th className="py-2.5 px-3 text-right">Accepted Qty</th>
                          <th className="py-2.5 px-3">Suggested Putaway Bin</th>
                          <th className="py-2.5 px-3 text-right">Defects / Quarantine</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {putawaySuggestions.map((s, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/70 transition">
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-900">{s.productName}</div>
                              {s.sku && (
                                <span className="text-[10px] text-slate-500 font-mono">
                                  SKU: {s.sku}
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-3 text-[11px] font-mono text-slate-600">
                              {s.batchNumber || "—"}{" "}
                              {s.expiryDate && (
                                <span className="text-[10px] text-slate-400 block">
                                  Exp: {new Date(s.expiryDate).toLocaleDateString()}
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                              {s.acceptedQuantity} {s.unit}
                            </td>

                            <td className="py-3 px-3">
                              {s.suggestedAcceptedBin ? (
                                <div className="space-y-0.5">
                                  <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 font-mono font-bold text-[11px] border border-blue-200 inline-block">
                                    {s.suggestedAcceptedBin.binCode}
                                  </span>
                                  <div className="text-[10px] text-slate-500 font-sans">
                                    {s.suggestedAcceptedBin.binType === "PRIMARY_PICK"
                                      ? "Primary Pick Face"
                                      : "Bulk Overstock Rack"}{" "}
                                    &bull; Aisle {s.suggestedAcceptedBin.aisle}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">No bin needed</span>
                              )}
                            </td>

                            <td className="py-3 px-3 text-right">
                              {s.rejectedQuantity > 0 ? (
                                <div className="space-y-0.5">
                                  <span className="font-mono font-bold text-rose-700 block">
                                    {s.rejectedQuantity} {s.unit}
                                  </span>
                                  {s.suggestedQuarantineBin && (
                                    <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 font-mono font-bold text-[10px] border border-purple-200 inline-block">
                                      {s.suggestedQuarantineBin.binCode} (Zone Q)
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  Confirming updates physical bin stock & marks items as PUTAWAY_DONE.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPutawayGrn(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmPutaway}
                    disabled={submittingPutawayConfirm || loadingPutawaySuggestions}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5"
                  >
                    {submittingPutawayConfirm ? (
                      <>
                        <Sparkles className="w-3.5 h-3.5 animate-spin" />
                        <span>Committing Putaway...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Confirm & Commit Putaway</span>
                      </>
                    )}
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
