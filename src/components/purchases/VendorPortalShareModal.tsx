"use client";

import { useState } from "react";
import {
  Building2,
  X,
  Copy,
  Check,
  Share2,
  ExternalLink,
  ShieldCheck,
  Phone,
  Mail,
  Clock,
  Wallet,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface Supplier {
  _id: string;
  name: string;
  code?: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  paymentTermsDays: number;
  currentBalance: number;
  portalToken?: string;
}

interface VendorPortalShareModalProps {
  supplier: Supplier;
  storeName?: string;
  onClose: () => void;
}

export default function VendorPortalShareModal({
  supplier,
  storeName = "Our Store",
  onClose,
}: VendorPortalShareModalProps) {
  const [copied, setCopied] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://pos.srilanka.lk";
  const portalUrl = `${origin}/portal/vendor/${supplier.portalToken || "vnd_" + supplier._id}`;

  const whatsappMessage = `Dear ${supplier.name}, here is your secure access link to the ${storeName} Supplier Self-Service Portal:\n\n🔗 ${portalUrl}\n\nYou can access issued Purchase Orders, submit dispatch notices & delivery dates, view warehouse dock receiving inspection reports (GRN), and submit bids on active quotation requests (RFQs).\n\nThank you!`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Supplier Self-Service Portal</h3>
              <p className="text-[11px] text-slate-500">{supplier.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Supplier details badge */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
          <div className="flex justify-between items-center font-semibold text-slate-700">
            <span>Contact: {supplier.contactPerson || "Sales Representative"}</span>
            <span className="font-mono text-slate-500">{supplier.phone}</span>
          </div>
          <div className="flex justify-between items-center text-[11px] text-slate-500">
            <span>Payment Terms: {supplier.paymentTermsDays || 30} Days Credit</span>
            <span>
              Outstanding AP: <strong className="text-rose-600 font-mono">{formatCurrency(supplier.currentBalance)}</strong>
            </span>
          </div>
        </div>

        {/* Portal URL Box */}
        <div className="space-y-1.5 text-xs">
          <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px]">
            Direct Vendor Portal URL
          </label>
          <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl">
            <input
              type="text"
              readOnly
              value={portalUrl}
              className="flex-1 bg-transparent text-xs font-mono text-slate-800 outline-none select-all truncate"
            />
            <button
              onClick={handleCopy}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                copied
                  ? "bg-emerald-600 text-white"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white"
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Feature benefits explanation */}
        <div className="space-y-1 text-[11px] text-slate-500 pt-1">
          <p className="flex items-center gap-1.5 font-medium text-slate-700">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>Supplier features enabled with this link:</span>
          </p>
          <ul className="list-disc pl-5 space-y-0.5 text-slate-500">
            <li>Acknowledge Purchase Orders & submit estimated delivery dates</li>
            <li>Submit dispatch notes, driver phone & delivery challan numbers</li>
            <li>Bid on active store Quotation Requests (RFQs) with item rates</li>
            <li>View dock inspection receiving reports (GRN) and payment statements</li>
          </ul>
        </div>

        {/* Action buttons */}
        <div className="pt-2 flex flex-col sm:flex-row gap-2 border-t border-slate-100">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition text-center flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share via WhatsApp</span>
          </a>

          <a
            href={portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition text-center flex items-center justify-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open Portal</span>
          </a>
        </div>
      </div>
    </div>
  );
}
