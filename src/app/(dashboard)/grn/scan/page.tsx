"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import MobileBarcodeScanner from "@/components/grn/MobileBarcodeScanner";
import GrnVarianceSlip, { GrnVarianceSlipData } from "@/components/receipts/GrnVarianceSlip";
import { scannerAudio } from "@/lib/scanner-audio";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";
import {
  FileCheck,
  Package,
  Plus,
  Minus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Search,
  Printer,
  RefreshCw,
  Building2,
  Calendar,
  Layers,
  ShieldCheck,
  Check,
  X,
  Camera,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

interface ScannedGrnLineItem {
  productId: string;
  name: string;
  sku?: string;
  barcode?: string;
  unit: string;
  orderedQuantity: number;
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
  isExtraItem?: boolean;
}

interface PurchaseOrderSummary {
  _id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  branchName?: string;
  status: string;
  subtotal: number;
  netTotal: number;
  expectedDeliveryDate?: string;
  supplierInvoiceNumber?: string;
  items: Array<{
    productId: string;
    name: string;
    barcode?: string;
    sku?: string;
    unit: string;
    quantityOrdered: number;
    quantityReceived?: number;
    unitCost: number;
  }>;
}

function GrnScannerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const poIdFromQuery = searchParams.get("poId");

  const [loadingPOs, setLoadingPOs] = useState(false);
  const [openPOs, setOpenPOs] = useState<PurchaseOrderSummary[]>([]);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrderSummary | null>(null);

  // Active receiving lines
  const [lineItems, setLineItems] = useState<ScannedGrnLineItem[]>([]);
  const [supplierBillNumber, setSupplierBillNumber] = useState("");
  const [supplierInvoiceDate, setSupplierInvoiceDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [receivingNotes, setReceivingNotes] = useState("");

  // Scanner UI
  const [scannerOpen, setScannerOpen] = useState(true);
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string | null>(null);
  const [highlightedProductId, setHighlightedProductId] = useState<string | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<{
    type: "success" | "warning" | "error";
    message: string;
  } | null>(null);

  // Submitting & Results
  const [submittingGrn, setSubmittingGrn] = useState(false);
  const [completedGrnSlip, setCompletedGrnSlip] = useState<GrnVarianceSlipData | null>(null);
  const [businessName, setBusinessName] = useState("Corner Store POS");

  // Load Open POs
  const loadOpenPOs = async () => {
    try {
      setLoadingPOs(true);
      const res = await fetch("/api/purchases?status=ALL&limit=50");
      const data = await res.json();
      if (data.success && Array.isArray(data.purchaseOrders)) {
        const actionable = data.purchaseOrders.filter(
          (p: any) => p.status === "SENT" || p.status === "DRAFT" || p.status === "PARTIALLY_RECEIVED"
        );
        setOpenPOs(actionable);

        // If query has poId, auto-select it
        if (poIdFromQuery) {
          const match = actionable.find((p: any) => p._id === poIdFromQuery || p.poNumber === poIdFromQuery);
          if (match) {
            selectPurchaseOrder(match._id);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load POs:", err);
    } finally {
      setLoadingPOs(false);
    }
  };

  useEffect(() => {
    loadOpenPOs();

    fetch("/api/business")
      .then((r) => r.json())
      .then((d) => {
        if (d?.business?.name) setBusinessName(d.business.name);
      })
      .catch(() => {});
  }, [poIdFromQuery]);

  // Select PO and load enriched items
  const selectPurchaseOrder = async (poId: string) => {
    try {
      setLoadingPOs(true);
      const res = await fetch(`/api/purchases/${poId}`);
      const data = await res.json();
      if (data.success && data.purchaseOrder) {
        const po = data.purchaseOrder;
        setSelectedPO(po);
        setSupplierBillNumber(po.supplierInvoiceNumber || "");

        // Prepare line items
        const todayStr = new Date().toISOString().slice(0, 10);
        const mappedLines: ScannedGrnLineItem[] = po.items.map((it: any) => ({
          productId: it.productId.toString(),
          name: it.name,
          sku: it.sku || "",
          barcode: it.barcode || "",
          unit: it.unit || "pcs",
          orderedQuantity: it.quantityOrdered,
          receivedQuantity: 0,
          rejectedQuantity: 0,
          rejectionReason: "",
          rejectionNotes: "",
          unitCost: it.unitCost,
          batchNumber: `LOT-${todayStr.replace(/-/g, "")}`,
          manufacturingDate: todayStr,
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10),
          mrp: "",
          sellingPrice: it.currentSellingPrice?.toString() || "",
          qcInspectionNotes: "",
          isExtraItem: false,
        }));

        setLineItems(mappedLines);
        setScannerOpen(true);
      } else {
        alert(data.error || "Failed to load Purchase Order details.");
      }
    } catch {
      alert("Network error connecting to store server.");
    } finally {
      setLoadingPOs(false);
    }
  };

  // Handle barcode scanned from mobile camera or hardware gun
  const handleBarcodeScanned = async (barcode: string) => {
    setLastScannedBarcode(barcode);

    // 1. Try to match within selected PO items
    const matchIndex = lineItems.findIndex(
      (item) =>
        (item.barcode && item.barcode.trim().toLowerCase() === barcode.trim().toLowerCase()) ||
        (item.sku && item.sku.trim().toLowerCase() === barcode.trim().toLowerCase())
    );

    if (matchIndex !== -1) {
      const targetItem = lineItems[matchIndex];
      const nextReceived = targetItem.receivedQuantity + 1;

      // Check over-delivery
      if (nextReceived > targetItem.orderedQuantity) {
        scannerAudio.playWarningBeep();
        setFeedbackToast({
          type: "warning",
          message: `Excess delivery on "${targetItem.name}". Ordered: ${targetItem.orderedQuantity}, now received: ${nextReceived}.`,
        });
      } else {
        scannerAudio.playSuccessBeep();
        setFeedbackToast({
          type: "success",
          message: `Scanned: ${targetItem.name} (${nextReceived}/${targetItem.orderedQuantity})`,
        });
      }

      setLineItems((prev) =>
        prev.map((it, idx) =>
          idx === matchIndex ? { ...it, receivedQuantity: nextReceived } : it
        )
      );

      setHighlightedProductId(targetItem.productId);
      setTimeout(() => setHighlightedProductId(null), 2000);
      return;
    }

    // 2. Not found in PO - Lookup in store catalog to see if it's an unauthorized substitute
    try {
      const res = await fetch(`/api/products?barcode=${encodeURIComponent(barcode)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        const prod = data.data[0];
        scannerAudio.playWarningBeep();

        const shouldAdd = confirm(
          `⚠️ Barcode "${barcode}" belongs to "${prod.name}" which is in your catalog but NOT listed on PO #${selectedPO?.poNumber}.\n\nDo you want to accept this item into the GRN as an unexpected extra delivery?`
        );

        if (shouldAdd) {
          const todayStr = new Date().toISOString().slice(0, 10);
          setLineItems((prev) => [
            ...prev,
            {
              productId: prod._id,
              name: prod.name,
              sku: prod.sku || "",
              barcode: prod.barcode || barcode,
              unit: prod.unit || "pcs",
              orderedQuantity: 0,
              receivedQuantity: 1,
              rejectedQuantity: 0,
              rejectionReason: "",
              rejectionNotes: "",
              unitCost: prod.costPrice || 0,
              batchNumber: `EXTRA-${todayStr.replace(/-/g, "")}`,
              manufacturingDate: todayStr,
              expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
                .toISOString()
                .slice(0, 10),
              mrp: "",
              sellingPrice: prod.sellingPrice?.toString() || "",
              qcInspectionNotes: "Unexpected supplier bonus/extra item accepted at receiving dock.",
              isExtraItem: true,
            },
          ]);

          setFeedbackToast({
            type: "warning",
            message: `Added extra catalog item "${prod.name}" to GRN list.`,
          });
        }
      } else {
        scannerAudio.playErrorBeep();
        setFeedbackToast({
          type: "error",
          message: `Unrecognized Barcode "${barcode}". Not found on PO or store product catalog.`,
        });
      }
    } catch {
      scannerAudio.playErrorBeep();
    }
  };

  // Quantity helpers
  const handleUpdateQty = (productId: string, delta: number) => {
    setLineItems((prev) =>
      prev.map((it) => {
        if (it.productId === productId) {
          const next = Math.max(0, it.receivedQuantity + delta);
          return { ...it, receivedQuantity: next };
        }
        return it;
      })
    );
  };

  const handleApplyPackSize = (productId: string, packSize: number) => {
    setLineItems((prev) =>
      prev.map((it) =>
        it.productId === productId
          ? { ...it, receivedQuantity: it.receivedQuantity + packSize }
          : it
      )
    );
  };

  const handleUpdateField = (productId: string, field: keyof ScannedGrnLineItem, value: any) => {
    setLineItems((prev) =>
      prev.map((it) => (it.productId === productId ? { ...it, [field]: value } : it))
    );
  };

  const handleRemoveExtraItem = (productId: string) => {
    setLineItems((prev) => prev.filter((it) => it.productId !== productId));
  };

  // Calculations
  const totalOrderedCount = lineItems.reduce((acc, it) => acc + it.orderedQuantity, 0);
  const totalReceivedCount = lineItems.reduce((acc, it) => acc + it.receivedQuantity, 0);
  const totalRejectedCount = lineItems.reduce((acc, it) => acc + (Number(it.rejectedQuantity) || 0), 0);
  const totalAcceptedCount = Math.max(0, totalReceivedCount - totalRejectedCount);

  const totalAcceptedValue = lineItems.reduce((acc, it) => {
    const accepted = Math.max(0, it.receivedQuantity - (Number(it.rejectedQuantity) || 0));
    return acc + accepted * it.unitCost;
  }, 0);

  const progressPercent = totalOrderedCount > 0 ? Math.min(100, Math.round((totalAcceptedCount / totalOrderedCount) * 100)) : 100;

  // Submit GRN Intake
  const handleSubmitGrn = async () => {
    if (!selectedPO) return;

    if (totalReceivedCount === 0) {
      alert("No items have been scanned or marked as received yet.");
      return;
    }

    try {
      setSubmittingGrn(true);

      const itemsPayload = lineItems.map((it) => ({
        productId: it.productId,
        name: it.name,
        sku: it.sku,
        unit: it.unit,
        orderedQuantity: it.orderedQuantity,
        receivedQuantity: it.receivedQuantity,
        rejectedQuantity: Number(it.rejectedQuantity) || 0,
        rejectionReason: it.rejectionReason || undefined,
        rejectionNotes: it.rejectionNotes || undefined,
        unitCost: it.unitCost,
        batchNumber: it.batchNumber?.trim() || undefined,
        manufacturingDate: it.manufacturingDate || undefined,
        expiryDate: it.expiryDate || undefined,
        mrp: it.mrp ? parseFloat(it.mrp) : undefined,
        sellingPrice: it.sellingPrice ? parseFloat(it.sellingPrice) : undefined,
        qcInspectionNotes: it.qcInspectionNotes?.trim() || undefined,
      }));

      const res = await fetch("/api/grn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseOrderId: selectedPO._id,
          supplierInvoiceNumber: supplierBillNumber.trim() || undefined,
          supplierInvoiceDate: supplierInvoiceDate || undefined,
          items: itemsPayload,
          notes: receivingNotes.trim() || undefined,
          confirmImmediately: true,
        }),
      });

      const data = await res.json();
      if (data.success && data.grn) {
        const grn = data.grn;

        // Build slip data
        const slipData: GrnVarianceSlipData = {
          grnNumber: grn.grnNumber,
          poNumber: selectedPO.poNumber,
          storeName: businessName,
          supplierName: selectedPO.supplierName,
          supplierInvoiceNumber: supplierBillNumber,
          supplierInvoiceDate,
          branchName: selectedPO.branchName,
          status: "CONFIRMED",
          inspectionStatus: grn.inspectionStatus,
          receivedBy: grn.receivedBy || "Receiving Officer",
          receivedAt: new Date(),
          items: grn.items.map((it: any) => ({
            productId: it.productId,
            name: it.name,
            sku: it.sku,
            barcode: it.barcode,
            unit: it.unit,
            orderedQuantity: it.orderedQuantity,
            receivedQuantity: it.receivedQuantity,
            acceptedQuantity: it.acceptedQuantity,
            rejectedQuantity: it.rejectedQuantity,
            rejectionReason: it.rejectionReason,
            rejectionNotes: it.rejectionNotes,
            unitCost: it.unitCost,
            acceptedTotalCost: it.acceptedTotalCost,
            rejectedTotalCost: it.rejectedTotalCost,
            batchNumber: it.batchNumber,
            expiryDate: it.expiryDate,
          })),
          totalOrderedCost: grn.totalOrderedCost,
          totalAcceptedCost: grn.totalAcceptedCost,
          totalRejectedCost: grn.totalRejectedCost,
          notes: receivingNotes,
        };

        setCompletedGrnSlip(slipData);
      } else {
        alert(data.error || "Failed to confirm GRN receiving.");
      }
    } catch {
      alert("Network error processing GRN confirmation.");
    } finally {
      setSubmittingGrn(false);
    }
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-16">
        {/* Top Header */}
        <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 sticky top-0 z-30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/grn")}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition"
              title="Return to GRN Hub"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4 text-emerald-400" />
                  <span>Mobile Receiving Scanner</span>
                </h1>
                {selectedPO && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    {selectedPO.poNumber}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                {selectedPO
                  ? `${selectedPO.supplierName} • ${lineItems.length} lines`
                  : "Goods Receiving Dock • Camera & Hardware Scanner"}
              </p>
            </div>
          </div>

          {selectedPO && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setScannerOpen(!scannerOpen)}
                className={`p-2 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${
                  scannerOpen
                    ? "bg-blue-600 border-blue-500 text-white"
                    : "bg-slate-800 border-slate-700 text-slate-300"
                }`}
              >
                <Camera className="w-4 h-4" />
                <span className="hidden sm:inline">{scannerOpen ? "Hide Camera" : "Open Camera"}</span>
              </button>
              <button
                type="button"
                onClick={handleSubmitGrn}
                disabled={submittingGrn || totalReceivedCount === 0}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-emerald-600/30"
              >
                {submittingGrn ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>Confirm GRN</span>
              </button>
            </div>
          )}
        </header>

        {/* Feedback Toast */}
        {feedbackToast && (
          <div
            className={`px-4 py-2 text-xs font-bold flex items-center justify-between animate-in fade-in ${
              feedbackToast.type === "success"
                ? "bg-emerald-600 text-white"
                : feedbackToast.type === "warning"
                ? "bg-amber-600 text-white"
                : "bg-rose-600 text-white"
            }`}
          >
            <span>{feedbackToast.message}</span>
            <button onClick={() => setFeedbackToast(null)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 1: Purchase Order Selection (if none selected) */}
        {!selectedPO ? (
          <div className="max-w-2xl mx-auto w-full p-4 sm:p-6 space-y-4">
            <div className="text-center space-y-1 mb-4">
              <h2 className="text-lg font-bold text-white">Select Purchase Order to Receive</h2>
              <p className="text-xs text-slate-400">
                Choose an open inbound order or scan the PO barcode printed on the delivery note.
              </p>
            </div>

            {loadingPOs ? (
              <div className="py-16 text-center text-slate-500">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-2" />
                <p className="text-xs font-semibold">Loading open purchase orders...</p>
              </div>
            ) : openPOs.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-3">
                <Package className="w-10 h-10 text-slate-600 mx-auto" />
                <h3 className="text-sm font-bold text-white">No Inbound Orders Pending</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  All current Purchase Orders are either in draft or already received. Create a new PO under Purchases & Vendors first.
                </p>
                <button
                  type="button"
                  onClick={() => router.push("/purchases")}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5"
                >
                  <span>Go to Purchases</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {openPOs.map((po) => (
                  <div
                    key={po._id}
                    onClick={() => selectPurchaseOrder(po._id)}
                    className="p-4 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-blue-500/50 rounded-2xl cursor-pointer transition flex items-center justify-between gap-3 shadow-md"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white text-sm">{po.poNumber}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-slate-800 text-slate-300 border border-slate-700">
                          {po.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                        <span className="font-semibold text-slate-200">{po.supplierName}</span>
                        <span>•</span>
                        <span>{po.items?.length || 0} items</span>
                        <span>•</span>
                        <span className="text-emerald-400 font-mono">
                          {formatCurrency(po.netTotal || 0)}
                        </span>
                      </div>
                      {po.expectedDeliveryDate && (
                        <div className="text-[10px] text-slate-500 mt-1">
                          Expected: {new Date(po.expectedDeliveryDate).toLocaleDateString("en-LK")}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="px-3.5 py-2 bg-blue-600/90 hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0"
                    >
                      <span>Start Scan</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Step 2: Live Scanning Dock and PO Matching */
          <div className="max-w-4xl mx-auto w-full p-3 sm:p-4 space-y-4">
            {/* Camera Viewfinder (Collapsible) */}
            {scannerOpen && (
              <MobileBarcodeScanner
                onScan={handleBarcodeScanned}
                active={scannerOpen}
                placeholder="Scan item barcode or enter SKU manually..."
              />
            )}

            {/* Receiving Progress & Summary Banner */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                    Dock Receiving Progress
                  </span>
                  <div className="font-bold text-white text-sm flex items-center gap-2">
                    <span>
                      {totalAcceptedCount} / {totalOrderedCount} Units Accepted
                    </span>
                    <span className="text-xs text-slate-400">({progressPercent}%)</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                    Accepted Value
                  </span>
                  <div className="font-mono font-bold text-emerald-400 text-sm">
                    {formatCurrency(totalAcceptedValue)}
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    progressPercent >= 100 ? "bg-emerald-500" : "bg-blue-500"
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Supplier Invoice Inputs */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-0.5">
                    Supplier Delivery Bill #
                  </label>
                  <input
                    type="text"
                    value={supplierBillNumber}
                    onChange={(e) => setSupplierBillNumber(e.target.value)}
                    placeholder="e.g. INV-99841"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-0.5">
                    Delivery Note Date
                  </label>
                  <input
                    type="date"
                    value={supplierInvoiceDate}
                    onChange={(e) => setSupplierInvoiceDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Line Items List */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">
                  PO Items Matching Checklist ({lineItems.length} SKUs)
                </h3>
                <span className="text-[11px] text-slate-500">
                  Tap barcode or + / - to adjust counts
                </span>
              </div>

              {lineItems.map((item) => {
                const variance = item.receivedQuantity - item.orderedQuantity;
                const isUnder = variance < 0;
                const isOver = variance > 0;
                const isMatched = item.receivedQuantity === item.orderedQuantity && item.orderedQuantity > 0;
                const isHighlighted = highlightedProductId === item.productId;

                return (
                  <div
                    key={item.productId}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isHighlighted
                        ? "bg-blue-950/40 border-blue-400 scale-[1.01]"
                        : item.isExtraItem
                        ? "bg-purple-950/20 border-purple-800"
                        : isMatched
                        ? "bg-emerald-950/15 border-emerald-500/40"
                        : isOver
                        ? "bg-amber-950/20 border-amber-500/40"
                        : "bg-slate-900 border-slate-800"
                    }`}
                  >
                    {/* Item Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-white truncate">{item.name}</h4>
                          {item.isExtraItem && (
                            <span className="px-1.5 py-0.2 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded text-[9px] font-black uppercase">
                              Extra Item
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          {item.barcode && (
                            <span className="font-mono bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                              Barcode: {item.barcode}
                            </span>
                          )}
                          <span>Cost: Rs. {item.unitCost.toFixed(2)}</span>
                          <span>&bull;</span>
                          <span>Ordered: {item.orderedQuantity} {item.unit}</span>
                        </div>
                      </div>

                      {/* Variance Status Pill */}
                      <div>
                        {isMatched ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Matched</span>
                          </span>
                        ) : isOver ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            Over (+{variance})
                          </span>
                        ) : item.receivedQuantity > 0 ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30">
                            Short ({variance})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-slate-800 text-slate-500 border border-slate-700">
                            Pending
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stepper & Pack Size Controls */}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60">
                      <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl p-1">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.productId, -1)}
                          disabled={item.receivedQuantity <= 0}
                          className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 flex items-center justify-center text-white"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-mono font-bold text-sm px-2 text-white">
                          {item.receivedQuantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.productId, 1)}
                          className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Quick pack size multipliers */}
                      <div className="flex items-center gap-1">
                        {[6, 12, 24].map((pack) => (
                          <button
                            key={pack}
                            type="button"
                            onClick={() => handleApplyPackSize(item.productId, pack)}
                            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold"
                          >
                            +{pack}
                          </button>
                        ))}
                        {item.isExtraItem && (
                          <button
                            type="button"
                            onClick={() => handleRemoveExtraItem(item.productId)}
                            className="p-1 text-rose-400 hover:bg-rose-500/20 rounded"
                            title="Remove Extra Item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Batch Number & Expiry Date Inputs (Accordion / Direct) */}
                    <div className="mt-2.5 pt-2 border-t border-slate-800/40 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                      <div>
                        <label className="text-[9px] text-slate-400 uppercase font-bold block">
                          Batch / Lot #
                        </label>
                        <input
                          type="text"
                          value={item.batchNumber}
                          onChange={(e) =>
                            handleUpdateField(item.productId, "batchNumber", e.target.value)
                          }
                          className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-[11px] text-white font-mono focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-400 uppercase font-bold block">
                          Expiry Date
                        </label>
                        <input
                          type="date"
                          value={item.expiryDate}
                          onChange={(e) =>
                            handleUpdateField(item.productId, "expiryDate", e.target.value)
                          }
                          className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-[11px] text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-rose-400 uppercase font-bold block">
                          Damaged / Rejected
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={item.rejectedQuantity}
                          onChange={(e) =>
                            handleUpdateField(item.productId, "rejectedQuantity", e.target.value)
                          }
                          placeholder="0"
                          className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-[11px] text-rose-400 font-bold focus:outline-none focus:border-rose-500"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-400 uppercase font-bold block">
                          Rejection Reason
                        </label>
                        <select
                          value={item.rejectionReason}
                          onChange={(e) =>
                            handleUpdateField(item.productId, "rejectionReason", e.target.value)
                          }
                          className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-[11px] text-slate-300 focus:outline-none focus:border-blue-500"
                        >
                          <option value="">None</option>
                          <option value="DAMAGED_PACKAGING">Damaged Packaging</option>
                          <option value="EXPIRED_SHORT_DATE">Expired / Short Date</option>
                          <option value="WRONG_ITEM">Wrong Item / Mislabel</option>
                          <option value="QUALITY_DEFECT">Quality Defect</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Receiving Memo */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3">
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Dock Inspection Remarks / Notes
              </label>
              <textarea
                value={receivingNotes}
                onChange={(e) => setReceivingNotes(e.target.value)}
                placeholder="e.g. Driver unloaded pallets at Dock 2; inner cartons clean and intact."
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Bottom Actions */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleSubmitGrn}
                disabled={submittingGrn || totalReceivedCount === 0}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-2xl font-bold text-sm transition flex items-center justify-center gap-2 shadow-xl shadow-emerald-600/30"
              >
                {submittingGrn ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Confirming & Adding to Inventory...</span>
                  </>
                ) : (
                  <>
                    <FileCheck className="w-5 h-5" />
                    <span>Confirm GRN &bull; {totalAcceptedCount} Units Accepted (Rs. {totalAcceptedValue.toFixed(2)})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Modal: Post-Completion GRN Slip & Manifest */}
        {completedGrnSlip && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 my-8">
              <div className="flex justify-between items-center pb-3 mb-2 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Goods Received Note Recorded!</h3>
                    <span className="text-xs text-slate-500 font-mono">Stock Added to Store Warehouse</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => router.push("/grn")}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <GrnVarianceSlip
                data={completedGrnSlip}
                onPrint={() => window.print()}
              />
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function GrnScanPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      }
    >
      <GrnScannerContent />
    </Suspense>
  );
}
