"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Package,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Truck,
  Phone,
  Mail,
  MapPin,
  Printer,
  AlertTriangle,
  ChevronRight,
  Check,
  X,
  FileText,
  DollarSign,
  Send,
  MessageSquare,
  ShieldCheck,
  User,
} from "lucide-react";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";

interface PurchaseOrderItem {
  productId: string;
  name: string;
  sku?: string;
  barcode?: string;
  unit: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  total: number;
  vendorAvailability?: "AVAILABLE" | "SHORTAGE" | "OUT_OF_STOCK";
  vendorConfirmedQuantity?: number;
  vendorNotes?: string;
}

interface PurchaseOrderData {
  _id: string;
  poNumber: string;
  supplierName: string;
  branchName?: string;
  status: "DRAFT" | "SENT" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";
  items: PurchaseOrderItem[];
  subtotal: number;
  taxTotal: number;
  netTotal: number;
  expectedDeliveryDate?: string;
  supplierInvoiceNumber?: string;
  vendorAcknowledgement?: {
    status: "PENDING" | "ACKNOWLEDGED" | "IN_TRANSIT" | "REJECTED";
    acknowledgedAt?: string;
    estimatedDeliveryDate?: string;
    vendorReferenceNumber?: string;
    repName?: string;
    repPhone?: string;
    dispatchInvoiceNumber?: string;
    vehicleNumber?: string;
    driverName?: string;
    driverPhone?: string;
    dispatchedAt?: string;
    notes?: string;
  };
  createdAt: string;
}

interface BusinessInfo {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  currency: string;
}

interface SupplierInfo {
  name: string;
  phone?: string;
  contactPerson?: string;
}

export default function VendorPoFulfillmentPage() {
  const params = useParams();
  const token = params?.token as string;

  const [po, setPo] = useState<PurchaseOrderData | null>(null);
  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [supplier, setSupplier] = useState<SupplierInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modals / Form States
  const [isAckModalOpen, setIsAckModalOpen] = useState(false);
  const [isAsnModalOpen, setIsAsnModalOpen] = useState(false);
  const [isLineModalOpen, setIsLineModalOpen] = useState(false);
  const [selectedItemForEdit, setSelectedItemForEdit] = useState<PurchaseOrderItem | null>(null);

  // Acknowledge Form
  const [ackForm, setAckForm] = useState({
    estimatedDeliveryDate: "",
    vendorReferenceNumber: "",
    repName: "",
    repPhone: "",
    notes: "",
  });

  // ASN Form
  const [asnForm, setAsnForm] = useState({
    dispatchInvoiceNumber: "",
    vehicleNumber: "",
    driverName: "",
    driverPhone: "",
    notes: "",
  });

  // Line Item Edit Form
  const [lineForm, setLineForm] = useState({
    availability: "AVAILABLE" as "AVAILABLE" | "SHORTAGE" | "OUT_OF_STOCK",
    confirmedQuantity: 0,
    vendorNotes: "",
  });

  // Load PO Fulfillment Details
  const loadPoData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/public/vendor/po/${token}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load Purchase Order");
      }

      setPo(data.po);
      setBusiness(data.business);
      setSupplier(data.supplier);

      // Pre-populate ack form
      if (data.po?.expectedDeliveryDate) {
        setAckForm((prev) => ({
          ...prev,
          estimatedDeliveryDate: new Date(data.po.expectedDeliveryDate).toISOString().slice(0, 10),
        }));
      }
    } catch (err: any) {
      setError(err.message || "Could not load order details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadPoData();
    }
  }, [token]);

  // Submit Acknowledgement
  const handleAcknowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/public/vendor/po/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ACKNOWLEDGE",
          ...ackForm,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit acknowledgement");
      }

      setStatusMessage({ type: "success", text: data.message });
      setIsAckModalOpen(false);
      loadPoData();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message });
    }
  };

  // Submit ASN (In-Transit Dispatch)
  const handleDispatchAsn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/public/vendor/po/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "DISPATCH_ASN",
          ...asnForm,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit advance shipping notice");
      }

      setStatusMessage({ type: "success", text: data.message });
      setIsAsnModalOpen(false);
      loadPoData();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message });
    }
  };

  // Submit Line Update
  const handleUpdateLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForEdit) return;

    try {
      const res = await fetch(`/api/public/vendor/po/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_LINES",
          lineUpdates: [
            {
              productId: selectedItemForEdit.productId,
              availability: lineForm.availability,
              confirmedQuantity: lineForm.confirmedQuantity,
              vendorNotes: lineForm.vendorNotes,
            },
          ],
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update item availability");
      }

      setStatusMessage({ type: "success", text: "Line availability updated." });
      setIsLineModalOpen(false);
      setSelectedItemForEdit(null);
      loadPoData();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <Package className="w-10 h-10 text-blue-500 animate-bounce mb-3" />
        <h2 className="text-base font-bold">Loading Purchase Order...</h2>
        <p className="text-xs text-slate-400 mt-1">Fetching order fulfillment specifications</p>
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <div className="bg-slate-800 p-8 rounded-2xl max-w-md w-full text-center border border-slate-700 space-y-3">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold">Order Not Accessible</h2>
          <p className="text-xs text-slate-400">{error || "This Purchase Order link is invalid or has expired."}</p>
        </div>
      </div>
    );
  }

  const fulfillmentStatus = po.vendorAcknowledgement?.status || "PENDING";
  const isReceived = po.status === "RECEIVED" || po.status === "PARTIALLY_RECEIVED";

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-16">
      {/* Top Branding Bar */}
      <header className="bg-slate-900 text-white border-b border-slate-800 py-4 px-4 sm:px-8 sticky top-0 z-40 print:hidden">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-blue-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 block">
                SUPPLIER SELF-SERVICE FULFILLMENT PORTAL
              </span>
              <h1 className="text-base font-bold leading-tight">{business?.name || "Merchant Store"}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Order</span>
            </button>
            {business?.phone && (
              <a
                href={`tel:${business.phone}`}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call Store</span>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Status Message Banner */}
        {statusMessage && (
          <div
            className={`p-3 rounded-2xl border flex items-center justify-between text-xs animate-in fade-in print:hidden ${
              statusMessage.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-rose-50 border-rose-200 text-rose-900"
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{statusMessage.text}</span>
            </div>
            <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-slate-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* PO Header Overview Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-black font-mono tracking-tight text-slate-900">{po.poNumber}</h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    isReceived
                      ? "bg-emerald-100 text-emerald-800"
                      : fulfillmentStatus === "IN_TRANSIT"
                      ? "bg-purple-100 text-purple-800 animate-pulse"
                      : fulfillmentStatus === "ACKNOWLEDGED"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {isReceived
                    ? "Received at Dock (GRN)"
                    : fulfillmentStatus === "IN_TRANSIT"
                    ? "In Transit (Van Dispatched)"
                    : fulfillmentStatus === "ACKNOWLEDGED"
                    ? "Confirmed by Vendor"
                    : "Awaiting Confirmation"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Issued on {new Date(po.createdAt).toLocaleDateString("en-GB")} to{" "}
                <span className="font-semibold text-slate-800">{po.supplierName}</span>
              </p>
            </div>

            <div className="flex items-center gap-2 text-right">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Agreed Net Valuation
                </span>
                <span className="text-2xl font-black font-mono text-slate-950">{formatCurrency(po.netTotal)}</span>
              </div>
            </div>
          </div>

          {/* Stepper Progress Pipeline */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 print:hidden">
            <div className="p-3 rounded-xl border bg-slate-50 border-slate-200">
              <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-xs mb-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>1. Order Issued</span>
              </div>
              <p className="text-[11px] text-slate-500 font-mono">
                {new Date(po.createdAt).toLocaleDateString("en-GB")}
              </p>
            </div>

            <div
              className={`p-3 rounded-xl border transition ${
                fulfillmentStatus === "ACKNOWLEDGED" || fulfillmentStatus === "IN_TRANSIT" || isReceived
                  ? "bg-blue-50/60 border-blue-200 text-blue-900"
                  : "bg-slate-50 border-slate-200 text-slate-400"
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                {fulfillmentStatus !== "PENDING" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                ) : (
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span>2. Acknowledged</span>
              </div>
              <p className="text-[11px] font-mono">
                {po.vendorAcknowledgement?.acknowledgedAt
                  ? new Date(po.vendorAcknowledgement.acknowledgedAt).toLocaleDateString("en-GB")
                  : "Pending confirmation"}
              </p>
            </div>

            <div
              className={`p-3 rounded-xl border transition ${
                fulfillmentStatus === "IN_TRANSIT" || isReceived
                  ? "bg-purple-50/60 border-purple-200 text-purple-900"
                  : "bg-slate-50 border-slate-200 text-slate-400"
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                {fulfillmentStatus === "IN_TRANSIT" || isReceived ? (
                  <Truck className="w-3.5 h-3.5 text-purple-600" />
                ) : (
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span>3. In Transit (ASN)</span>
              </div>
              <p className="text-[11px] font-mono">
                {po.vendorAcknowledgement?.vehicleNumber
                  ? `Van: ${po.vendorAcknowledgement.vehicleNumber}`
                  : "Not yet dispatched"}
              </p>
            </div>

            <div
              className={`p-3 rounded-xl border transition ${
                isReceived
                  ? "bg-emerald-50/60 border-emerald-200 text-emerald-900"
                  : "bg-slate-50 border-slate-200 text-slate-400"
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                {isReceived ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span>4. Store Dock GRN</span>
              </div>
              <p className="text-[11px] font-mono">
                {isReceived ? "Completed at dock" : "Awaiting delivery"}
              </p>
            </div>
          </div>

          {/* Logistics & Delivery Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Delivery Location
              </span>
              <p className="font-bold text-slate-900">{po.branchName || "Main Warehouse Dock"}</p>
              {business?.address && <p className="text-slate-500 text-[11px] mt-0.5">{business.address}</p>}
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Requested Delivery Date
              </span>
              <p className="font-bold font-mono text-blue-700 text-sm">
                {po.expectedDeliveryDate
                  ? new Date(po.expectedDeliveryDate).toLocaleDateString("en-GB")
                  : "Immediate"}
              </p>
              {po.vendorAcknowledgement?.estimatedDeliveryDate && (
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Confirmed: {new Date(po.vendorAcknowledgement.estimatedDeliveryDate).toLocaleDateString("en-GB")}
                </p>
              )}
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Store Procurement Contact
              </span>
              <p className="font-bold text-slate-900">{business?.phone || "Store Telephone"}</p>
              {business?.email && <p className="text-slate-500 text-[11px] mt-0.5">{business.email}</p>}
            </div>
          </div>
        </div>

        {/* Action Prompt Banners for Distributors (Hidden in Print) */}
        {!isReceived && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:hidden">
            {/* Action 1: Acknowledge */}
            <div className="p-5 bg-blue-600 text-white rounded-2xl shadow-sm flex flex-col justify-between space-y-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-200 block mb-1">
                  STEP 1: ORDER CONFIRMATION
                </span>
                <h3 className="text-base font-bold">Acknowledge Order & Confirm Date</h3>
                <p className="text-xs text-blue-100 mt-1 leading-relaxed">
                  Confirm receipt of this PO, submit your sales order reference, and inform the store of your scheduled delivery date.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAckModalOpen(true)}
                className="w-full py-2.5 bg-white text-blue-700 hover:bg-blue-50 font-bold rounded-xl text-xs transition shadow-sm"
              >
                {fulfillmentStatus === "ACKNOWLEDGED" ? "Update Confirmation Details" : "Acknowledge Purchase Order"}
              </button>
            </div>

            {/* Action 2: ASN Van Dispatch */}
            <div className="p-5 bg-purple-700 text-white rounded-2xl shadow-sm flex flex-col justify-between space-y-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-purple-200 block mb-1">
                  STEP 2: LOGISTICS NOTIFICATION
                </span>
                <h3 className="text-base font-bold">Submit Advance Shipping Notice (ASN)</h3>
                <p className="text-xs text-purple-100 mt-1 leading-relaxed">
                  When your delivery van departs the warehouse, notify the store dock with the vehicle registration, driver phone, and invoice number.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAsnModalOpen(true)}
                className="w-full py-2.5 bg-white text-purple-800 hover:bg-purple-50 font-bold rounded-xl text-xs transition shadow-sm"
              >
                {fulfillmentStatus === "IN_TRANSIT" ? "Update In-Transit Van Notice" : "Dispatch Van (In-Transit Notice)"}
              </button>
            </div>
          </div>
        )}

        {/* Itemized Order Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Ordered Line Items ({po.items.length})</h3>
              <p className="text-[11px] text-slate-500">
                Please prepare goods according to the quantities and specifications below.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 text-center w-8">#</th>
                  <th className="py-3 px-3.5">Product Name & SKU</th>
                  <th className="py-3 px-3.5 text-center">Ordered Qty</th>
                  <th className="py-3 px-3.5 text-right font-mono">Agreed Unit Cost</th>
                  <th className="py-3 px-3.5 text-right font-mono">Total (LKR)</th>
                  <th className="py-3 px-3.5 text-center">Fulfillment Status</th>
                  <th className="py-3 px-3.5 text-right print:hidden">Stock Flag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {po.items.map((it, idx) => (
                  <tr key={it.productId || idx} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-3.5">
                      <span className="font-bold text-slate-900 block">{it.name}</span>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                        {it.sku && <span>SKU: {it.sku}</span>}
                        {it.barcode && <span>Barcode: {it.barcode}</span>}
                      </div>
                    </td>
                    <td className="py-3 px-3.5 text-center font-mono font-bold text-slate-900">
                      {it.quantityOrdered} {it.unit}
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-700">
                      {formatCurrency(it.unitCost)}
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono font-black text-slate-900">
                      {formatCurrency(it.total)}
                    </td>
                    <td className="py-3 px-3.5 text-center">
                      {it.vendorAvailability === "OUT_OF_STOCK" ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-100 text-rose-800 uppercase">
                          Out of Stock
                        </span>
                      ) : it.vendorAvailability === "SHORTAGE" ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-800 uppercase">
                          Shortage: {it.vendorConfirmedQuantity ?? it.quantityOrdered}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                          Available
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 text-right print:hidden">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedItemForEdit(it);
                          setLineForm({
                            availability: it.vendorAvailability || "AVAILABLE",
                            confirmedQuantity: it.vendorConfirmedQuantity ?? it.quantityOrdered,
                            vendorNotes: it.vendorNotes || "",
                          });
                          setIsLineModalOpen(true);
                        }}
                        className="px-2 py-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition"
                      >
                        Change
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                <tr>
                  <td colSpan={4} className="py-3 px-3.5 text-right uppercase text-slate-600 text-xs">
                    Order Subtotal:
                  </td>
                  <td className="py-3 px-3.5 text-right font-mono text-slate-900">
                    {formatCurrency(po.subtotal)}
                  </td>
                  <td colSpan={2}></td>
                </tr>
                {po.taxTotal > 0 && (
                  <tr>
                    <td colSpan={4} className="py-2 px-3.5 text-right uppercase text-slate-600 text-xs">
                      Taxes (VAT / SSCL):
                    </td>
                    <td className="py-2 px-3.5 text-right font-mono text-slate-900">
                      {formatCurrency(po.taxTotal)}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                )}
                <tr className="border-t border-slate-300 bg-slate-100 font-black">
                  <td colSpan={4} className="py-3.5 px-3.5 text-right uppercase text-slate-950 text-xs">
                    NET TOTAL PAYABLE (LKR):
                  </td>
                  <td className="py-3.5 px-3.5 text-right font-mono text-base text-blue-900">
                    {formatCurrency(po.netTotal)}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Footer Guidance */}
        <div className="text-center text-xs text-slate-400 pt-4 border-t border-slate-200 space-y-1">
          <p>This is a formal electronic Purchase Order from {business?.name || "Merchant Store"}.</p>
          <p className="text-[11px]">Goods received at warehouse dock are subject to standard barcode verification and quality inspection (GRN).</p>
        </div>
      </main>

      {/* ================= MODAL: ACKNOWLEDGE ORDER ================= */}
      {isAckModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <Check className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Acknowledge Purchase Order</h3>
              </div>
              <button onClick={() => setIsAckModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAcknowledge} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Confirmed Estimated Delivery Date *
                </label>
                <input
                  type="date"
                  required
                  value={ackForm.estimatedDeliveryDate}
                  onChange={(e) => setAckForm({ ...ackForm, estimatedDeliveryDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Distributor Reference # (Sales Order / Booking #)
                </label>
                <input
                  type="text"
                  value={ackForm.vendorReferenceNumber}
                  onChange={(e) => setAckForm({ ...ackForm, vendorReferenceNumber: e.target.value })}
                  placeholder="e.g. SO-8921"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Sales Rep Name</label>
                  <input
                    type="text"
                    value={ackForm.repName}
                    onChange={(e) => setAckForm({ ...ackForm, repName: e.target.value })}
                    placeholder="Rep name"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Sales Rep Phone</label>
                  <input
                    type="tel"
                    value={ackForm.repPhone}
                    onChange={(e) => setAckForm({ ...ackForm, repPhone: e.target.value })}
                    placeholder="077XXXXXXX"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Notes / Remarks</label>
                <textarea
                  rows={2}
                  value={ackForm.notes}
                  onChange={(e) => setAckForm({ ...ackForm, notes: e.target.value })}
                  placeholder="Any logistics details or delivery schedule notes"
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAckModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shadow-sm"
                >
                  Submit Confirmation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADVANCE SHIPPING NOTICE (ASN) ================= */}
      {isAsnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <Truck className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Advance Shipping Notice (Van Dispatch)</h3>
              </div>
              <button onClick={() => setIsAsnModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleDispatchAsn} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Supplier Invoice / Bill # *
                  </label>
                  <input
                    type="text"
                    required
                    value={asnForm.dispatchInvoiceNumber}
                    onChange={(e) => setAsnForm({ ...asnForm, dispatchInvoiceNumber: e.target.value })}
                    placeholder="e.g. INV-9021"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Vehicle Number (Van #) *
                  </label>
                  <input
                    type="text"
                    required
                    value={asnForm.vehicleNumber}
                    onChange={(e) => setAsnForm({ ...asnForm, vehicleNumber: e.target.value })}
                    placeholder="e.g. WP-CAB-4921"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Driver Name</label>
                  <input
                    type="text"
                    value={asnForm.driverName}
                    onChange={(e) => setAsnForm({ ...asnForm, driverName: e.target.value })}
                    placeholder="Driver name"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Driver Phone</label>
                  <input
                    type="tel"
                    value={asnForm.driverPhone}
                    onChange={(e) => setAsnForm({ ...asnForm, driverPhone: e.target.value })}
                    placeholder="077XXXXXXX"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Dispatch Remarks</label>
                <input
                  type="text"
                  value={asnForm.notes}
                  onChange={(e) => setAsnForm({ ...asnForm, notes: e.target.value })}
                  placeholder="e.g. Scheduled to reach dock around 11:30 AM"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAsnModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold transition shadow-sm"
                >
                  Submit Van Dispatch (ASN)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT LINE ITEM AVAILABILITY ================= */}
      {isLineModalOpen && selectedItemForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Line Stock Availability</h3>
              <button onClick={() => setIsLineModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
              <p className="font-bold text-slate-900">{selectedItemForEdit.name}</p>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Ordered Quantity: {selectedItemForEdit.quantityOrdered} {selectedItemForEdit.unit}
              </p>
            </div>

            <form onSubmit={handleUpdateLine} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Availability Status</label>
                <select
                  value={lineForm.availability}
                  onChange={(e: any) =>
                    setLineForm({
                      ...lineForm,
                      availability: e.target.value,
                      confirmedQuantity:
                        e.target.value === "OUT_OF_STOCK"
                          ? 0
                          : e.target.value === "AVAILABLE"
                          ? selectedItemForEdit.quantityOrdered
                          : lineForm.confirmedQuantity,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="AVAILABLE">Full Quantity In Stock</option>
                  <option value="SHORTAGE">Partial Shortage (Partial Supply)</option>
                  <option value="OUT_OF_STOCK">Out of Stock (Zero Units)</option>
                </select>
              </div>

              {lineForm.availability === "SHORTAGE" && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Available Supply Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={selectedItemForEdit.quantityOrdered}
                    value={lineForm.confirmedQuantity}
                    onChange={(e) => setLineForm({ ...lineForm, confirmedQuantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Distributor Note</label>
                <input
                  type="text"
                  value={lineForm.vendorNotes}
                  onChange={(e) => setLineForm({ ...lineForm, vendorNotes: e.target.value })}
                  placeholder="e.g. Remaining balance will arrive next Tuesday"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsLineModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shadow-sm"
                >
                  Save Flag
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
