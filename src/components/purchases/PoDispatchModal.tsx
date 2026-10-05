"use client";

import React, { useState } from "react";
import {
  Send,
  X,
  Copy,
  Check,
  ExternalLink,
  MessageSquare,
  Mail,
  Link as LinkIcon,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Calendar,
  Truck,
  Package,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { normalizeSriLankanPhone } from "@/lib/sms";

interface PurchaseOrderItem {
  productId: string;
  name: string;
  quantityOrdered: number;
  unitCost: number;
  total: number;
}

interface PurchaseOrderData {
  _id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  branchName?: string;
  status: string;
  items: PurchaseOrderItem[];
  subtotal: number;
  taxTotal: number;
  netTotal: number;
  expectedDeliveryDate?: string;
  vendorAccessToken?: string;
}

interface SupplierData {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
}

interface PoDispatchModalProps {
  po: PurchaseOrderData;
  supplier?: SupplierData;
  storeName?: string;
  onClose: () => void;
  onDispatched?: (updatedPo: any) => void;
}

export default function PoDispatchModal({
  po,
  supplier,
  storeName = "Our Store",
  onClose,
  onDispatched,
}: PoDispatchModalProps) {
  const [activeTab, setActiveTab] = useState<"WHATSAPP" | "EMAIL" | "LINK">("WHATSAPP");

  const [phone, setPhone] = useState(supplier?.phone || "");
  const [email, setEmail] = useState(supplier?.email || "");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Compute portal link
  const origin = typeof window !== "undefined" ? window.location.origin : "https://pos.srilanka.lk";
  const token = po.vendorAccessToken || `po_${po._id.slice(-6)}_direct`;
  const portalUrl = `${origin}/portal/vendor/po/${token}`;

  const branchName = po.branchName || "Main Store Warehouse";
  const deliveryDateStr = po.expectedDeliveryDate
    ? new Date(po.expectedDeliveryDate).toLocaleDateString("en-GB")
    : "Urgent Delivery Requested";

  // Item lines preview for message
  const itemSummary = po.items
    .slice(0, 4)
    .map((it) => `• ${it.quantityOrdered}x ${it.name} @ Rs. ${it.unitCost.toLocaleString()}`)
    .join("\n");
  const extraItemsCount = po.items.length > 4 ? `\n...and ${po.items.length - 4} more line items` : "";

  // WhatsApp Message Text
  const whatsappText = `📦 *PURCHASE ORDER: ${po.poNumber}*\nFrom: *${storeName}* (${branchName})\nSupplier: ${po.supplierName}\nLines: ${po.items.length} items | Total: *${formatCurrency(po.netTotal)}*\nExpected Delivery: ${deliveryDateStr}\n\n*Order Lines Preview:*\n${itemSummary}${extraItemsCount}\n\n🔗 *Review PO & Submit Delivery Confirmation (ASN):*\n${portalUrl}\n\nPlease acknowledge receipt or report van dispatch details.\nThank you!`;

  const normalizedPhone = normalizeSriLankanPhone(phone);
  const whatsappUrl = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(whatsappText)}`;

  // Email Content
  const emailSubject = `Purchase Order ${po.poNumber} from ${storeName}`;
  const emailBody = `Dear ${po.supplierName},\n\nPlease find Purchase Order ${po.poNumber} from ${storeName} for ${po.items.length} line items totaling ${formatCurrency(po.netTotal)}.\n\nDelivery Branch: ${branchName}\nExpected Delivery: ${deliveryDateStr}\n\nView Full Purchase Order & Submit Fulfillment Notice (ASN):\n${portalUrl}\n\nThank you,\n${storeName} Procurement Team`;

  // Handle Dispatch API Call
  const handleDispatch = async (channel: "WHATSAPP" | "EMAIL" | "DIRECT_LINK") => {
    try {
      setLoading(true);
      const res = await fetch(`/api/purchases/${po._id}/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          recipientPhone: phone,
          recipientEmail: email,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to dispatch purchase order");
      }

      setStatusMessage({ type: "success", text: `PO marked as SENT via ${channel}.` });
      if (onDispatched) onDispatched(data.po);

      if (channel === "WHATSAPP") {
        window.open(whatsappUrl, "_blank");
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(portalUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(whatsappText);
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Dispatch Purchase Order</h3>
              <p className="text-[11px] text-slate-500 font-mono">
                {po.poNumber} • {po.supplierName}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* PO Quick Stats */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-3 gap-2 text-xs">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Items Count</span>
            <span className="font-mono font-bold text-slate-800">{po.items.length} Lines</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Net Valuation</span>
            <span className="font-mono font-bold text-slate-900">{formatCurrency(po.netTotal)}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Delivery Date</span>
            <span className="font-mono font-bold text-blue-700 truncate block">{deliveryDateStr}</span>
          </div>
        </div>

        {/* Channel Selector */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab("WHATSAPP")}
            className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === "WHATSAPP" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
            <span>WhatsApp</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("EMAIL")}
            className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === "EMAIL" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Mail className="w-3.5 h-3.5 text-blue-600" />
            <span>Email</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("LINK")}
            className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === "LINK" ? "bg-white text-purple-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5 text-purple-600" />
            <span>Direct Link</span>
          </button>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div
            className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs ${
              statusMessage.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-rose-50 border-rose-200 text-rose-900"
            }`}
          >
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* ================= TAB 1: WHATSAPP ================= */}
        {activeTab === "WHATSAPP" && (
          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Distributor / Sales Rep Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="077XXXXXXX"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Target: {normalizedPhone ? `+${normalizedPhone}` : "Enter phone to dispatch directly"}
              </span>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-bold text-slate-700">WhatsApp Message Preview</label>
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                >
                  {copiedMsg ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedMsg ? "Copied" : "Copy Text"}</span>
                </button>
              </div>
              <textarea
                readOnly
                rows={7}
                value={whatsappText}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-[11px] font-mono leading-relaxed text-slate-800 focus:outline-none"
              />
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={() => handleDispatch("WHATSAPP")}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition shadow-sm shadow-emerald-600/20"
            >
              <MessageSquare className="w-4 h-4" />
              <span>{loading ? "Dispatching..." : "Send via WhatsApp & Mark as Sent"}</span>
            </button>
          </div>
        )}

        {/* ================= TAB 2: EMAIL ================= */}
        {activeTab === "EMAIL" && (
          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Supplier Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="orders@supplier.lk"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Subject</label>
              <input
                type="text"
                readOnly
                value={emailSubject}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Email Body Preview</label>
              <textarea
                readOnly
                rows={5}
                value={emailBody}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-[11px] text-slate-800 focus:outline-none"
              />
            </div>

            <button
              type="button"
              disabled={loading || !email}
              onClick={() => handleDispatch("EMAIL")}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition shadow-sm"
            >
              <Mail className="w-4 h-4" />
              <span>{loading ? "Dispatching..." : "Send Email & Mark as Sent"}</span>
            </button>
          </div>
        )}

        {/* ================= TAB 3: DIRECT LINK ================= */}
        {activeTab === "LINK" && (
          <div className="space-y-3.5 text-xs">
            <p className="text-slate-600 leading-relaxed">
              Distributor sales reps and logistics drivers can open this link on their mobile phones to view the order, confirm delivery dates, report out-of-stock lines, or notify van dispatch:
            </p>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] text-slate-700 truncate select-all">{portalUrl}</span>
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg font-bold text-slate-700 flex items-center gap-1 shrink-0"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? "Copied" : "Copy"}</span>
              </button>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => window.open(portalUrl, "_blank")}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold flex items-center justify-center gap-1.5 transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Vendor Portal View</span>
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleDispatch("DIRECT_LINK")}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 transition shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Mark as Dispatched</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
