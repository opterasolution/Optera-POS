"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import MobileBarcodeScanner from "@/components/grn/MobileBarcodeScanner";
import StockTransferManifestReceipt, {
  StockTransferManifestData,
} from "@/components/receipts/StockTransferManifestReceipt";
import { scannerAudio } from "@/lib/scanner-audio";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";
import {
  Truck,
  Barcode as BarcodeIcon,
  Package,
  Plus,
  Minus,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Search,
  Printer,
  RefreshCw,
  Building2,
  Calendar,
  ShieldCheck,
  Check,
  X,
  Phone,
  User,
  Clock,
  ExternalLink,
} from "lucide-react";

interface ScannedTransferLine {
  productId: string;
  name: string;
  sku: string;
  barcode?: string;
  unit: string;
  quantitySent: number;
  quantityReceived: number;
  quantityDamagedInTransit: number;
  discrepancyReason:
    | "NONE"
    | "SHORTAGE_IN_TRANSIT"
    | "DAMAGED_IN_TRANSIT"
    | "WRONG_ITEM"
    | "OVER_DELIVERED";
  discrepancyAction:
    | "NONE"
    | "ACCEPT_SHORTAGE"
    | "CLAIM_DRIVER"
    | "RETURN_TO_SENDER"
    | "RECONCILED";
  discrepancyNotes: string;
  batchNumber?: string;
  expiryDate?: string;
  unitCost: number;
}

interface TransferSummary {
  _id: string;
  transferNumber: string;
  manifestToken?: string;
  sourceBranchName: string;
  destinationBranchName: string;
  status: string;
  totalItemsSent: number;
  totalTransitValue?: number;
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
  gatePassOutTime?: string;
  dispatchedAt?: string;
  items: Array<{
    productId: string;
    name: string;
    sku: string;
    barcode?: string;
    unit: string;
    quantitySent: number;
    unitCost?: number;
    batchNumber?: string;
    expiryDate?: string;
  }>;
}

function TransferScannerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const transferIdFromQuery = searchParams.get("transferId");

  const [loadingTransfers, setLoadingTransfers] = useState(false);
  const [inTransitTransfers, setInTransitTransfers] = useState<TransferSummary[]>([]);
  const [selectedTransfer, setSelectedTransfer] = useState<TransferSummary | null>(null);

  // Active intake scan lines
  const [scanLines, setScanLines] = useState<ScannedTransferLine[]>([]);
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
  const [submittingReceive, setSubmittingReceive] = useState(false);
  const [completedTransferReceipt, setCompletedTransferReceipt] =
    useState<StockTransferManifestData | null>(null);
  const [business, setBusiness] = useState<any>({ name: "Corner Store POS" });

  // Load In-Transit Transfers
  const loadInTransitTransfers = async () => {
    try {
      setLoadingTransfers(true);
      const res = await fetch("/api/transfers?status=IN_TRANSIT&limit=50");
      const data = await res.json();
      if (data.success && Array.isArray(data.transfers)) {
        setInTransitTransfers(data.transfers);

        if (transferIdFromQuery) {
          const match = data.transfers.find(
            (t: any) =>
              t._id === transferIdFromQuery ||
              t.manifestToken === transferIdFromQuery ||
              t.transferNumber === transferIdFromQuery
          );
          if (match) {
            selectTransfer(match._id);
          } else {
            // Try fetching directly by ID or token
            selectTransfer(transferIdFromQuery);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load transfers:", err);
    } finally {
      setLoadingTransfers(false);
    }
  };

  useEffect(() => {
    loadInTransitTransfers();

    fetch("/api/business")
      .then((r) => r.json())
      .then((d) => {
        if (d?.business) setBusiness(d.business);
      })
      .catch(() => {});
  }, [transferIdFromQuery]);

  // Select Transfer and prepare scan lines
  const selectTransfer = async (idOrToken: string) => {
    try {
      setLoadingTransfers(true);
      const res = await fetch(`/api/transfers/${idOrToken}`);
      const data = await res.json();
      if (data.success && data.transfer) {
        const transfer = data.transfer;
        setSelectedTransfer(transfer);

        // Map items into scanLines
        const lines: ScannedTransferLine[] = transfer.items.map((it: any) => ({
          productId: it.productId?.toString() || it._id?.toString(),
          name: it.name,
          sku: it.sku || "",
          barcode: it.barcode || it.sku || "",
          unit: it.unit || "pcs",
          quantitySent: it.quantitySent,
          quantityReceived: 0,
          quantityDamagedInTransit: 0,
          discrepancyReason: "NONE",
          discrepancyAction: "NONE",
          discrepancyNotes: "",
          batchNumber: it.batchNumber || "",
          expiryDate: it.expiryDate
            ? new Date(it.expiryDate).toISOString().slice(0, 10)
            : "",
          unitCost: it.unitCost || 0,
        }));

        setScanLines(lines);
      }
    } catch (err) {
      console.error("Failed to fetch transfer details:", err);
    } finally {
      setLoadingTransfers(false);
    }
  };

  // Toast feedback with timeout
  const showToast = (type: "success" | "warning" | "error", message: string) => {
    setFeedbackToast({ type, message });
    setTimeout(() => {
      setFeedbackToast((prev) => (prev?.message === message ? null : prev));
    }, 3200);
  };

  // Handle Barcode Scan
  const handleBarcodeScanned = (scannedCode: string) => {
    const code = scannedCode.trim();
    if (!code || !selectedTransfer) return;

    setLastScannedBarcode(code);

    // Search by barcode, SKU, or productId
    const targetIdx = scanLines.findIndex(
      (line) =>
        (line.barcode && line.barcode.toLowerCase() === code.toLowerCase()) ||
        (line.sku && line.sku.toLowerCase() === code.toLowerCase()) ||
        line.productId === code
    );

    if (targetIdx === -1) {
      scannerAudio.playErrorBeep();
      showToast(
        "error",
        `Item not on manifest: "${code}". Check barcode or add discrepancy notes.`
      );
      return;
    }

    const updated = [...scanLines];
    const target = { ...updated[targetIdx] };
    const nextReceived = target.quantityReceived + 1;
    target.quantityReceived = nextReceived;

    // Automatic discrepancy reason evaluation
    if (nextReceived > target.quantitySent) {
      target.discrepancyReason = "OVER_DELIVERED";
      scannerAudio.playWarningBeep();
      showToast(
        "warning",
        `Over-delivery: "${target.name}" received ${nextReceived} > ${target.quantitySent} sent.`
      );
    } else {
      if (target.quantityDamagedInTransit > 0) {
        target.discrepancyReason = "DAMAGED_IN_TRANSIT";
      } else if (nextReceived < target.quantitySent) {
        target.discrepancyReason = "SHORTAGE_IN_TRANSIT";
      } else {
        target.discrepancyReason = "NONE";
      }
      scannerAudio.playSuccessBeep();
      showToast(
        "success",
        `Scanned: "${target.name}" (+1) -> ${nextReceived} of ${target.quantitySent} ${target.unit}`
      );
    }

    updated[targetIdx] = target;
    setScanLines(updated);

    // Trigger visual pulse
    setHighlightedProductId(target.productId);
    setTimeout(() => {
      setHighlightedProductId((curr) => (curr === target.productId ? null : curr));
    }, 1500);
  };

  // Adjust quantity manually
  const updateQuantityReceived = (productId: string, val: number) => {
    const nextVal = Math.max(0, val);
    setScanLines((prev) =>
      prev.map((line) => {
        if (line.productId !== productId) return line;

        let reason = line.discrepancyReason;
        if (line.quantityDamagedInTransit > 0) {
          reason = "DAMAGED_IN_TRANSIT";
        } else if (nextVal > line.quantitySent) {
          reason = "OVER_DELIVERED";
        } else if (nextVal < line.quantitySent) {
          reason = "SHORTAGE_IN_TRANSIT";
        } else {
          reason = "NONE";
        }

        return {
          ...line,
          quantityReceived: nextVal,
          discrepancyReason: reason,
        };
      })
    );
  };

  // Adjust damage count
  const updateDamageCount = (productId: string, val: number) => {
    const nextVal = Math.max(0, val);
    setScanLines((prev) =>
      prev.map((line) => {
        if (line.productId !== productId) return line;
        let reason = line.discrepancyReason;
        if (nextVal > 0) {
          reason = "DAMAGED_IN_TRANSIT";
        } else if (line.quantityReceived < line.quantitySent) {
          reason = "SHORTAGE_IN_TRANSIT";
        } else if (line.quantityReceived > line.quantitySent) {
          reason = "OVER_DELIVERED";
        } else {
          reason = "NONE";
        }

        return {
          ...line,
          quantityDamagedInTransit: nextVal,
          discrepancyReason: reason,
        };
      })
    );
  };

  // Update line discrepancy details
  const updateLineDiscrepancy = (
    productId: string,
    updates: Partial<ScannedTransferLine>
  ) => {
    setScanLines((prev) =>
      prev.map((line) => (line.productId === productId ? { ...line, ...updates } : line))
    );
  };

  // Quick Action: Fill All Sent Qty as Good
  const handleReceiveAllGood = () => {
    if (!confirm("Auto-fill all items with 100% good received quantities?")) return;
    setScanLines((prev) =>
      prev.map((line) => ({
        ...line,
        quantityReceived: line.quantitySent,
        quantityDamagedInTransit: 0,
        discrepancyReason: "NONE",
        discrepancyAction: "NONE",
      }))
    );
    scannerAudio.playSuccessBeep();
    showToast("success", "All transfer line items marked received as good.");
  };

  // Quick Action: Reset All
  const handleResetCounts = () => {
    if (!confirm("Reset all received counts to 0?")) return;
    setScanLines((prev) =>
      prev.map((line) => ({
        ...line,
        quantityReceived: 0,
        quantityDamagedInTransit: 0,
        discrepancyReason: "NONE",
        discrepancyAction: "NONE",
      }))
    );
  };

  // Calculate totals
  const totalSentQty = scanLines.reduce((sum, l) => sum + l.quantitySent, 0);
  const totalReceivedQty = scanLines.reduce((sum, l) => sum + l.quantityReceived, 0);
  const totalDamagedQty = scanLines.reduce(
    (sum, l) => sum + l.quantityDamagedInTransit,
    0
  );
  const totalSentVal = scanLines.reduce(
    (sum, l) => sum + l.quantitySent * (l.unitCost || 0),
    0
  );
  const totalReceivedVal = scanLines.reduce(
    (sum, l) => sum + l.quantityReceived * (l.unitCost || 0),
    0
  );
  const discrepancyVal = Math.max(0, Math.round((totalSentVal - totalReceivedVal) * 100) / 100);

  const hasShortage = totalReceivedQty < totalSentQty;
  const hasOverage = totalReceivedQty > totalSentQty;
  const hasDamaged = totalDamagedQty > 0;

  let overallDiscrepancy: "NO_DISCREPANCY" | "SHORTAGE" | "OVERAGE" | "DAMAGED" =
    "NO_DISCREPANCY";
  if (hasDamaged) {
    overallDiscrepancy = "DAMAGED";
  } else if (hasShortage) {
    overallDiscrepancy = "SHORTAGE";
  } else if (hasOverage) {
    overallDiscrepancy = "OVERAGE";
  }

  // Submit Receiving to Server
  const handleSubmitReceiving = async () => {
    if (!selectedTransfer) return;

    if (totalReceivedQty === 0) {
      if (
        !confirm(
          "Warning: Total received quantity is 0! Are you sure you want to finalize this transfer as an entire shortage?"
        )
      ) {
        return;
      }
    }

    setSubmittingReceive(true);
    try {
      const receivedItems = scanLines.map((line) => ({
        productId: line.productId,
        quantityReceived: line.quantityReceived,
        quantityDamagedInTransit: line.quantityDamagedInTransit,
        discrepancyReason: line.discrepancyReason,
        discrepancyAction: line.discrepancyAction,
        discrepancyNotes: line.discrepancyNotes,
        batchNumber: line.batchNumber,
        expiryDate: line.expiryDate,
      }));

      const res = await fetch(`/api/transfers/${selectedTransfer._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RECEIVE",
          receivedItems,
          notes: receivingNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success && data.transfer) {
        scannerAudio.playSuccessBeep();
        setCompletedTransferReceipt(data.transfer);
        showToast("success", data.message || "Stock transfer successfully received!");
      } else {
        scannerAudio.playErrorBeep();
        alert(data.error || "Failed to receive transfer.");
      }
    } catch (err: any) {
      scannerAudio.playErrorBeep();
      alert(err.message || "Network error occurred.");
    } finally {
      setSubmittingReceive(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toast Feedback */}
      {feedbackToast && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg border text-xs font-bold flex items-center gap-2.5 max-w-md animate-in slide-in-from-top-4 ${
            feedbackToast.type === "success"
              ? "bg-emerald-500 text-white border-emerald-600"
              : feedbackToast.type === "warning"
              ? "bg-amber-500 text-white border-amber-600"
              : "bg-rose-500 text-white border-rose-600"
          }`}
        >
          {feedbackToast.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : feedbackToast.type === "warning" ? (
            <AlertTriangle className="w-5 h-5 shrink-0" />
          ) : (
            <X className="w-5 h-5 shrink-0" />
          )}
          <span>{feedbackToast.message}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/transfers")}
            className="w-9 h-9 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-600 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-900 tracking-tight">
                Receiving Dock Barcode Scanner
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                Replenishment Intake
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Scan van transit barcodes on the dock to increment received quantities and record
              shortages/damage.
            </p>
          </div>
        </div>

        {selectedTransfer && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setSelectedTransfer(null)}
              className="px-3 py-1.5 text-xs font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-xl transition"
            >
              Change Transfer Order
            </button>
            <button
              type="button"
              onClick={() => setScannerOpen(!scannerOpen)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition ${
                scannerOpen
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <BarcodeIcon className="w-3.5 h-3.5" />
              <span>{scannerOpen ? "Hide Scanner" : "Open Camera Scanner"}</span>
            </button>
          </div>
        )}
      </div>

      {/* STEP 1: Select In-Transit Transfer if none selected */}
      {!selectedTransfer && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Select Active In-Transit Van Transfer
              </h2>
              <p className="text-xs text-slate-500">
                Choose an incoming replenishment order currently on the road or at the receiving
                bay.
              </p>
            </div>
            <button
              type="button"
              onClick={loadInTransitTransfers}
              disabled={loadingTransfers}
              className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition"
              title="Refresh transfers"
            >
              <RefreshCw className={`w-4 h-4 ${loadingTransfers ? "animate-spin" : ""}`} />
            </button>
          </div>

          {loadingTransfers ? (
            <div className="p-12 text-center text-xs text-slate-400">
              Loading active transfers...
            </div>
          ) : inTransitTransfers.length === 0 ? (
            <div className="p-12 text-center bg-slate-50 rounded-xl border border-slate-200 border-dashed">
              <Truck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-slate-700 text-xs">No Transfers In Transit</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                All branch transfers have been received or no dispatches are on the road.
              </p>
              <button
                type="button"
                onClick={() => router.push("/transfers")}
                className="mt-3 px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold"
              >
                Go to Transfers Dashboard
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {inTransitTransfers.map((tr) => (
                <div
                  key={tr._id}
                  onClick={() => selectTransfer(tr._id)}
                  className="p-4 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/20 transition cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-black font-mono text-xs text-slate-900 group-hover:text-indigo-600 transition">
                        {tr.transferNumber}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 uppercase">
                        In Transit
                      </span>
                    </div>

                    <div className="text-xs space-y-1 text-slate-600 mb-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">From:</span>
                        <span className="font-semibold text-slate-800">
                          {tr.sourceBranchName}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">To:</span>
                        <span className="font-semibold text-slate-800">
                          {tr.destinationBranchName}
                        </span>
                      </div>
                      {tr.vehicleNumber && (
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <Truck className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-mono font-bold text-slate-700">
                            {tr.vehicleNumber}
                          </span>
                          {tr.driverName && <span>• {tr.driverName}</span>}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                      {tr.totalItemsSent} units ({tr.items.length} items)
                    </span>
                    <span className="font-bold font-mono text-indigo-700">
                      {formatCurrency(tr.totalTransitValue || 0)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Active Transfer Receiving Interface */}
      {selectedTransfer && (
        <div className="space-y-4">
          {/* Transfer Header Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-black font-mono text-sm sm:text-base text-slate-900">
                      {selectedTransfer.transferNumber}
                    </h2>
                    {selectedTransfer.manifestToken && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-100 text-indigo-800">
                        Token: {selectedTransfer.manifestToken}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    Route: <span className="font-bold text-slate-800">{selectedTransfer.sourceBranchName}</span>{" "}
                    &rarr; <span className="font-bold text-slate-800">{selectedTransfer.destinationBranchName}</span>
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right text-xs">
                {selectedTransfer.vehicleNumber && (
                  <div className="font-bold text-slate-900 font-mono">
                    Van: {selectedTransfer.vehicleNumber}
                  </div>
                )}
                {selectedTransfer.driverName && (
                  <div className="text-slate-600 flex items-center sm:justify-end gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>{selectedTransfer.driverName}</span>
                    {selectedTransfer.driverPhone && (
                      <span className="font-mono">({selectedTransfer.driverPhone})</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Intake Progress Bar */}
            <div className="pt-3">
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="font-bold text-slate-700">Intake Progress</span>
                <span className="font-mono text-slate-500">
                  <strong className="text-slate-900">{totalReceivedQty}</strong> / {totalSentQty}{" "}
                  units received ({Math.min(100, Math.round((totalReceivedQty / (totalSentQty || 1)) * 100))}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    totalReceivedQty === totalSentQty
                      ? "bg-emerald-500"
                      : totalReceivedQty > totalSentQty
                      ? "bg-purple-500"
                      : "bg-indigo-600"
                  }`}
                  style={{
                    width: `${Math.min(100, Math.round((totalReceivedQty / (totalSentQty || 1)) * 100))}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Scanner Viewport (Camera & Barcode Gun Listener) */}
          {scannerOpen && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <MobileBarcodeScanner
                onScan={handleBarcodeScanned}
                placeholder="Scan EAN-13, UPC, or type product SKU/Barcode..."
              />
            </div>
          )}

          {/* Control Bar: Quick Fills & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">Quick Actions:</span>
              <button
                type="button"
                onClick={handleReceiveAllGood}
                className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Receive All as Good</span>
              </button>
              <button
                type="button"
                onClick={handleResetCounts}
                className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold transition"
              >
                Reset Counts
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="text-slate-500">
                Discrepancy Status:{" "}
                <strong
                  className={`uppercase ${
                    overallDiscrepancy === "NO_DISCREPANCY"
                      ? "text-emerald-700"
                      : overallDiscrepancy === "DAMAGED"
                      ? "text-rose-700"
                      : "text-amber-700"
                  }`}
                >
                  {overallDiscrepancy.replace(/_/g, " ")}
                </strong>
              </span>
            </div>
          </div>

          {/* Items Intake List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">
                Manifest Items Verification ({scanLines.length})
              </h3>
              <span className="text-xs text-slate-500">
                Scan or use +/- buttons to adjust dock intake
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {scanLines.map((line) => {
                const isHighlighted = highlightedProductId === line.productId;
                const isShortage = line.quantityReceived < line.quantitySent;
                const isOverage = line.quantityReceived > line.quantitySent;
                const isExact = line.quantityReceived === line.quantitySent && line.quantityDamagedInTransit === 0;

                return (
                  <div
                    key={line.productId}
                    className={`p-4 transition-all duration-300 ${
                      isHighlighted
                        ? "bg-indigo-50/70 ring-2 ring-indigo-500 ring-inset"
                        : "hover:bg-slate-50/50"
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Product Metadata */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-slate-900 text-sm">{line.name}</h4>
                          {isExact && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Verified</span>
                            </span>
                          )}
                          {isShortage && line.quantityReceived > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              Shortage ({line.quantitySent - line.quantityReceived})
                            </span>
                          )}
                          {isOverage && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                              Excess (+{line.quantityReceived - line.quantitySent})
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-mono mt-1">
                          <span>SKU: {line.sku}</span>
                          {line.barcode && <span>• Barcode: {line.barcode}</span>}
                          <span>• Unit Cost: {formatCurrency(line.unitCost)}</span>
                          <span className="font-bold text-slate-700">
                            Sent: {line.quantitySent} {line.unit}
                          </span>
                        </div>
                      </div>

                      {/* Dock Quantities Controller */}
                      <div className="flex flex-wrap items-center gap-4">
                        {/* Received Good Count */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-600">Received:</span>
                          <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden bg-white shadow-2xs">
                            <button
                              type="button"
                              onClick={() =>
                                updateQuantityReceived(line.productId, line.quantityReceived - 1)
                              }
                              className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 text-slate-600 transition"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={line.quantityReceived}
                              onChange={(e) =>
                                updateQuantityReceived(
                                  line.productId,
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-14 text-center font-black font-mono text-xs border-x border-slate-200 py-1.5 focus:outline-hidden"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                updateQuantityReceived(line.productId, line.quantityReceived + 1)
                              }
                              className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 text-slate-600 transition"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <span className="text-xs text-slate-500 font-mono">{line.unit}</span>
                        </div>

                        {/* Damaged Count */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-rose-600">Damaged:</span>
                          <div className="flex items-center border border-rose-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                            <button
                              type="button"
                              onClick={() =>
                                updateDamageCount(
                                  line.productId,
                                  line.quantityDamagedInTransit - 1
                                )
                              }
                              className="w-8 h-8 flex items-center justify-center hover:bg-rose-50 text-rose-600 transition"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={line.quantityDamagedInTransit}
                              onChange={(e) =>
                                updateDamageCount(
                                  line.productId,
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-12 text-center font-bold font-mono text-xs text-rose-700 border-x border-rose-200 py-1.5 focus:outline-hidden"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                updateDamageCount(
                                  line.productId,
                                  line.quantityDamagedInTransit + 1
                                )
                              }
                              className="w-8 h-8 flex items-center justify-center hover:bg-rose-50 text-rose-600 transition"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Discrepancy Reason & Action Details (Shown if variance or damage exists) */}
                    {(line.quantityReceived !== line.quantitySent ||
                      line.quantityDamagedInTransit > 0) && (
                      <div className="mt-3 p-3 bg-amber-50/70 border border-amber-200 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        <div>
                          <label className="font-semibold text-amber-900 block mb-1">
                            Discrepancy Reason:
                          </label>
                          <select
                            value={line.discrepancyReason}
                            onChange={(e) =>
                              updateLineDiscrepancy(line.productId, {
                                discrepancyReason: e.target.value as any,
                              })
                            }
                            className="w-full bg-white border border-amber-300 rounded-lg p-1.5 font-medium text-slate-800"
                          >
                            <option value="SHORTAGE_IN_TRANSIT">Shortage in Transit</option>
                            <option value="DAMAGED_IN_TRANSIT">Damaged in Transit</option>
                            <option value="WRONG_ITEM">Wrong Item Delivered</option>
                            <option value="OVER_DELIVERED">Excess / Over-delivered</option>
                            <option value="NONE">None</option>
                          </select>
                        </div>

                        <div>
                          <label className="font-semibold text-amber-900 block mb-1">
                            Immediate Action:
                          </label>
                          <select
                            value={line.discrepancyAction}
                            onChange={(e) =>
                              updateLineDiscrepancy(line.productId, {
                                discrepancyAction: e.target.value as any,
                              })
                            }
                            className="w-full bg-white border border-amber-300 rounded-lg p-1.5 font-medium text-slate-800"
                          >
                            <option value="ACCEPT_SHORTAGE">Accept as Transit Shrinkage</option>
                            <option value="CLAIM_DRIVER">Claim Against Driver / Carrier</option>
                            <option value="RETURN_TO_SENDER">Return Damaged to Sender</option>
                            <option value="RECONCILED">Reconcile / Clear</option>
                            <option value="NONE">Pending Manager Review</option>
                          </select>
                        </div>

                        <div>
                          <label className="font-semibold text-amber-900 block mb-1">
                            Remarks / Batch Note:
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Broken seal, box wet, etc."
                            value={line.discrepancyNotes}
                            onChange={(e) =>
                              updateLineDiscrepancy(line.productId, {
                                discrepancyNotes: e.target.value,
                              })
                            }
                            className="w-full bg-white border border-amber-300 rounded-lg p-1.5 text-slate-800 placeholder-slate-400"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Receiving Finalization Block */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Receiving Dock Remarks / Condition Notes:
                </label>
                <textarea
                  rows={3}
                  value={receivingNotes}
                  onChange={(e) => setReceivingNotes(e.target.value)}
                  placeholder="Note overall van condition, security seal number, driver remarks..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 focus:outline-indigo-500"
                />
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Total Dispatched Valuation:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatCurrency(totalSentVal)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Verified Intake Valuation:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatCurrency(totalReceivedVal)}
                  </span>
                </div>
                {discrepancyVal > 0 && (
                  <div className="flex justify-between items-center text-rose-600 font-bold border-t border-rose-200 pt-1.5">
                    <span>Discrepancy Variance Value:</span>
                    <span className="font-mono">{formatCurrency(discrepancyVal)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center font-black text-sm text-slate-900">
                  <span>Intake Reconciliation:</span>
                  <span
                    className={
                      overallDiscrepancy === "NO_DISCREPANCY"
                        ? "text-emerald-600"
                        : "text-amber-600"
                    }
                  >
                    {overallDiscrepancy.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => router.push("/transfers")}
                className="px-4 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Cancel / Return Later
              </button>
              <button
                type="button"
                onClick={handleSubmitReceiving}
                disabled={submittingReceive}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-black transition flex items-center gap-2 shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {submittingReceive
                    ? "Updating Branch Inventory..."
                    : "Confirm & Complete Goods Receiving"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completed Transfer Receipt Modal */}
      {completedTransferReceipt && (
        <StockTransferManifestReceipt
          business={business}
          transfer={completedTransferReceipt}
          onClose={() => {
            setCompletedTransferReceipt(null);
            router.push("/transfers");
          }}
        />
      )}
    </div>
  );
}

export default function TransferScannerPage() {
  return (
    <AppLayout>
      <Suspense
        fallback={
          <div className="p-12 text-center text-xs text-slate-400">
            Initializing barcode scanner...
          </div>
        }
      >
        <TransferScannerContent />
      </Suspense>
    </AppLayout>
  );
}
