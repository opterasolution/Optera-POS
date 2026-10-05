"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import GrnVarianceSlip, { GrnVarianceSlipData } from "@/components/receipts/GrnVarianceSlip";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";
import {
  FileCheck,
  Package,
  Plus,
  Search,
  Printer,
  RefreshCw,
  Building2,
  Calendar,
  Layers,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  Camera,
  X,
  Eye,
  Filter,
} from "lucide-react";

export default function GrnManagementHubPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [grns, setGrns] = useState<any[]>([]);
  const [openPOs, setOpenPOs] = useState<any[]>([]);
  const [businessName, setBusinessName] = useState("Corner Store POS");

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [inspectionFilter, setInspectionFilter] = useState("ALL");

  // Printable Slip Modal
  const [selectedSlipGrn, setSelectedSlipGrn] = useState<GrnVarianceSlipData | null>(null);

  // Item details modal
  const [viewingGrnDetails, setViewingGrnDetails] = useState<any | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [grnRes, poRes, bizRes] = await Promise.all([
        fetch(`/api/grn?status=${statusFilter}&inspectionStatus=${inspectionFilter}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ""}`),
        fetch("/api/purchases?status=ALL&limit=30"),
        fetch("/api/business"),
      ]);

      const [grnData, poData, bizData] = await Promise.all([
        grnRes.json(),
        poRes.json(),
        bizRes.json(),
      ]);

      if (grnData.success && Array.isArray(grnData.grns)) {
        setGrns(grnData.grns);
      }

      if (poData.success && Array.isArray(poData.purchaseOrders)) {
        const actionable = poData.purchaseOrders.filter(
          (p: any) => p.status === "SENT" || p.status === "DRAFT" || p.status === "PARTIALLY_RECEIVED"
        );
        setOpenPOs(actionable);
      }

      if (bizData?.business?.name) {
        setBusinessName(bizData.business.name);
      }
    } catch (err) {
      console.error("Failed to load GRN data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, inspectionFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  // KPI Calculations
  const totalAcceptedValue = grns.reduce((sum, g) => sum + (g.totalAcceptedCost || 0), 0);
  const totalRejectedValue = grns.reduce((sum, g) => sum + (g.totalRejectedCost || 0), 0);
  const passedCount = grns.filter((g) => g.inspectionStatus === "PASSED").length;
  const varianceCount = grns.filter((g) => g.inspectionStatus === "PARTIALLY_ACCEPTED").length;

  return (
    <AppLayout>
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        {/* Header Bar */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <FileCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Goods Received Notes (GRN) & Dock Hub</span>
              </h1>
              <p className="text-xs text-slate-500">
                Receive inbound shipments, scan barcodes, log batch expiry dates, and audit PO variances
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/grn/scan")}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <Camera className="w-4 h-4" />
              <span>Mobile Barcode Scanner Intake</span>
            </button>

            <button
              type="button"
              onClick={loadData}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition"
              title="Refresh GRNs"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </header>

        {/* Main Body */}
        <main className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto w-full">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Total GRNs Logged
              </span>
              <div className="text-2xl font-black text-slate-900 mt-1 flex items-center gap-2">
                <span>{grns.length}</span>
                {varianceCount > 0 && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    {varianceCount} Variances
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                {passedCount} passed 100% inspection
              </span>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Pending Inbound POs
              </span>
              <div className="text-2xl font-black text-blue-600 mt-1 flex items-center gap-2">
                <span>{openPOs.length}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  Ready to Receive
                </span>
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Awaiting supplier delivery</span>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider block">
                Total Stock Value Received
              </span>
              <div className="text-2xl font-black font-mono text-emerald-600 mt-1">
                {formatCurrency(totalAcceptedValue)}
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Credited to supplier accounts payable
              </span>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
              <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider block">
                Rejected / Damaged Value
              </span>
              <div className="text-2xl font-black font-mono text-rose-600 mt-1">
                {formatCurrency(totalRejectedValue)}
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Debited back / return slips
              </span>
            </div>
          </div>

          {/* Section: Pending Purchase Orders Ready for Receiving */}
          {openPOs.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">
                      Inbound Purchase Orders Pending Dock Receiving ({openPOs.length})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Suppliers scheduled for delivery. Tap Scan In to launch the mobile barcode checklist.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                {openPOs.slice(0, 6).map((po) => (
                  <div
                    key={po._id}
                    className="p-3.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl transition flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-slate-900 text-xs">{po.poNumber}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-blue-100 text-blue-800">
                          {po.status}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-800 mt-1">{po.supplierName}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>{po.items?.length || 0} ordered SKUs</span>
                        <span>•</span>
                        <span className="font-mono text-emerald-700 font-bold">
                          {formatCurrency(po.netTotal || 0)}
                        </span>
                      </div>
                      {po.expectedDeliveryDate && (
                        <div className="text-[10px] text-slate-400 mt-1">
                          Delivery: {new Date(po.expectedDeliveryDate).toLocaleDateString("en-LK")}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => router.push(`/grn/scan?poId=${po._id}`)}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Scan In Delivery</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Goods Received Notes Ledger */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
            {/* Filter Bar */}
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search GRN #, PO #, supplier, invoice..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </form>

              <div className="flex items-center gap-2">
                <select
                  value={inspectionFilter}
                  onChange={(e) => setInspectionFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-700 font-medium focus:outline-none"
                >
                  <option value="ALL">All Inspection Statuses</option>
                  <option value="PASSED">Passed (100% Accepted)</option>
                  <option value="PARTIALLY_ACCEPTED">Partially Accepted (Variances)</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
            </div>

            {/* Table */}
            {loading ? (
              <div className="py-16 text-center text-slate-500">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-2" />
                <p className="text-xs font-semibold">Loading Goods Received Notes...</p>
              </div>
            ) : grns.length === 0 ? (
              <div className="py-16 text-center text-slate-500 space-y-3">
                <FileCheck className="w-12 h-12 mx-auto text-slate-300" />
                <p className="text-sm font-bold text-slate-700">No Goods Received Notes Found</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Receive your first shipment using the mobile barcode scanner or dock intake form.
                </p>
                <button
                  type="button"
                  onClick={() => router.push("/grn/scan")}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5"
                >
                  <Camera className="w-4 h-4" />
                  <span>Launch Mobile Scanner</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px]">
                    <tr>
                      <th className="py-3 px-4">GRN #</th>
                      <th className="py-3 px-3">PO Number</th>
                      <th className="py-3 px-3">Supplier Name</th>
                      <th className="py-3 px-3">Inspection Status</th>
                      <th className="py-3 px-3 text-right">Items Count</th>
                      <th className="py-3 px-3 text-right">Accepted Value</th>
                      <th className="py-3 px-3">Received At</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {grns.map((grn) => {
                      const isPassed = grn.inspectionStatus === "PASSED";
                      const isPartial = grn.inspectionStatus === "PARTIALLY_ACCEPTED";

                      return (
                        <tr key={grn._id} className="hover:bg-slate-50/60 transition">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            {grn.grnNumber}
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-600">
                            {grn.poNumber}
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-800">
                            <div>{grn.supplierName}</div>
                            {grn.supplierInvoiceNumber && (
                              <span className="text-[10px] text-slate-400">
                                Inv: {grn.supplierInvoiceNumber}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                                isPassed
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                  : isPartial
                                  ? "bg-amber-50 text-amber-800 border-amber-300"
                                  : "bg-rose-50 text-rose-800 border-rose-300"
                              }`}
                            >
                              {isPassed
                                ? "Passed"
                                : isPartial
                                ? "Variance Detected"
                                : "Rejected"}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-medium text-slate-600">
                            {grn.items?.length || 0} SKUs
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">
                            {formatCurrency(grn.totalAcceptedCost || 0)}
                          </td>
                          <td className="py-3 px-3 text-slate-500 text-[11px]">
                            {formatSLDateTime(grn.createdAt)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setViewingGrnDetails(grn)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                                title="View Itemized Breakdown"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSlipGrn({
                                    grnNumber: grn.grnNumber,
                                    poNumber: grn.poNumber,
                                    storeName: businessName,
                                    supplierName: grn.supplierName,
                                    supplierInvoiceNumber: grn.supplierInvoiceNumber,
                                    supplierInvoiceDate: grn.supplierInvoiceDate,
                                    branchName: grn.branchName,
                                    status: grn.status,
                                    inspectionStatus: grn.inspectionStatus,
                                    receivedBy: grn.receivedBy,
                                    receivedAt: grn.createdAt,
                                    items: grn.items || [],
                                    totalOrderedCost: grn.totalOrderedCost || 0,
                                    totalAcceptedCost: grn.totalAcceptedCost || 0,
                                    totalRejectedCost: grn.totalRejectedCost || 0,
                                    notes: grn.notes,
                                  });
                                }}
                                className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition flex items-center gap-1"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Manifest</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>

        {/* Modal: Itemized GRN Details */}
        {viewingGrnDetails && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 my-8">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Goods Received Note #{viewingGrnDetails.grnNumber}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    PO: {viewingGrnDetails.poNumber} &bull; Supplier: {viewingGrnDetails.supplierName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingGrnDetails(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="py-4 space-y-4">
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[10px] uppercase">
                      <tr>
                        <th className="py-2 px-3">Product</th>
                        <th className="py-2 px-2 text-right">Ordered</th>
                        <th className="py-2 px-2 text-right">Received</th>
                        <th className="py-2 px-2 text-right">Accepted</th>
                        <th className="py-2 px-2 text-right">Rejected</th>
                        <th className="py-2 px-2 text-right">Unit Cost</th>
                        <th className="py-2 px-2">Batch / Lot</th>
                        <th className="py-2 px-2">Expiry Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11px]">
                      {viewingGrnDetails.items?.map((it: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 font-semibold text-slate-900">{it.name}</td>
                          <td className="py-2 px-2 text-right font-mono text-slate-600">{it.orderedQuantity}</td>
                          <td className="py-2 px-2 text-right font-mono text-slate-800">{it.receivedQuantity}</td>
                          <td className="py-2 px-2 text-right font-mono font-bold text-emerald-700">{it.acceptedQuantity}</td>
                          <td className="py-2 px-2 text-right font-mono font-bold text-rose-600">{it.rejectedQuantity || "-"}</td>
                          <td className="py-2 px-2 text-right font-mono text-slate-700">Rs. {it.unitCost.toFixed(2)}</td>
                          <td className="py-2 px-2 font-mono text-blue-700 text-[10px]">{it.batchNumber || "-"}</td>
                          <td className="py-2 px-2 text-slate-600 text-[10px]">
                            {it.expiryDate ? new Date(it.expiryDate).toLocaleDateString("en-LK") : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setViewingGrnDetails(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Printable GRN Slip & Manifest */}
        {selectedSlipGrn && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 my-8">
              <div className="flex justify-end pb-2">
                <button
                  type="button"
                  onClick={() => setSelectedSlipGrn(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <GrnVarianceSlip
                data={selectedSlipGrn}
                onPrint={() => window.print()}
              />
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
