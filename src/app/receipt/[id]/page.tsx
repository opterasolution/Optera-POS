"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import ThermalReceipt from "@/components/receipts/ThermalReceipt";
import QRCodeImage from "@/components/common/QRCodeImage";
import {
  Printer,
  ArrowLeft,
  Share2,
  Check,
  MessageSquare,
  ShieldCheck,
  Building,
  Calendar,
  Clock,
  Tag,
  Gift,
  Star,
  Receipt,
  FileText,
  CreditCard,
  ExternalLink,
  Info,
  Layers,
} from "lucide-react";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";
import { formatWhatsAppReceipt, buildWhatsAppUrl } from "@/lib/notifications";
import LanguageSwitcher from "@/components/common/LanguageSwitcher";
import { useLanguage, useTranslation } from "@/lib/i18n/LanguageContext";

export default function ReceiptPrintPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { language } = useLanguage();
  const { t } = useTranslation();

  const saleId = params?.id as string;
  const autoPrint = searchParams.get("autoprint") === "true";

  const [sale, setSale] = useState<any | null>(null);
  const [business, setBusiness] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [customWidth, setCustomWidth] = useState<"58mm" | "80mm">("58mm");
  const [activeView, setActiveView] = useState<"digital" | "thermal">("digital");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const res = await fetch(`/api/public/receipt/${saleId}`);
        const data = await res.json();

        if (data.success && data.sale) {
          setSale(data.sale);
          if (data.business) {
            setBusiness(data.business);
            if (data.business.receiptSettings?.defaultWidth) {
              setCustomWidth(data.business.receiptSettings.defaultWidth);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load receipt:", err);
      } finally {
        setLoading(false);
      }
    }

    if (saleId) {
      loadData();
    }
  }, [saleId]);

  // Handle auto-print after data load
  useEffect(() => {
    if (!loading && sale && autoPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [loading, sale, autoPrint]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-slate-600 font-sans space-y-3">
        <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="font-semibold text-xs tracking-wide">Loading digital e-receipt...</p>
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-center space-y-4 font-sans">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <Info className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-800">Receipt Not Found</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
            The requested receipt may have expired or the invoice link is invalid.
          </p>
        </div>
        <button
          onClick={() => router.push("/pos")}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition"
        >
          Return to POS Counter
        </button>
      </div>
    );
  }

  const currentUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <div className="min-h-screen bg-slate-100 py-4 sm:py-8 print:bg-white print:py-0 font-sans">
      {/* On-Screen Action Bar (Hidden during printing via .no-print) */}
      <div className="no-print max-w-lg mx-auto mb-4 px-4 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={() => router.push("/pos")}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-sm border border-slate-200 flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t("nav.posCounter") || "POS Counter"}</span>
          </button>

          {/* View switcher: Digital E-Receipt vs Thermal Print */}
          <div className="flex items-center bg-slate-200/80 p-0.5 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveView("digital")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeView === "digital"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Digital E-Receipt
            </button>
            <button
              onClick={() => setActiveView("thermal")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeView === "thermal"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Thermal Roll
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <LanguageSwitcher />

            <button
              onClick={handlePrint}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-blue-600/20 flex items-center gap-1.5 transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{t("common.print") || "Print"}</span>
            </button>
          </div>
        </div>

        {/* Digital Share Row */}
        <div className="flex items-center gap-2">
          <a
            href={buildWhatsAppUrl(
              sale.customerPhone,
              formatWhatsAppReceipt({
                sale,
                business: business || {},
                publicReceiptUrl: currentUrl,
              })
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{t("common.shareWhatsapp") || "Share via WhatsApp"}</span>
          </a>

          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                navigator.clipboard.writeText(currentUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }
            }}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-sm border border-slate-200 flex items-center gap-1.5 transition"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-bold">{t("common.copied") || "Copied!"}</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-slate-500" />
                <span>{t("common.copyLink") || "Copy Link"}</span>
              </>
            )}
          </button>
        </div>

        {/* Customer Self-Service Portal Fast Link */}
        {sale.customerPortalToken && (
          <Link
            href={`/portal/statement/${sale.customerPortalToken}`}
            className="block p-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl text-xs text-blue-900 hover:border-blue-300 transition shadow-2xs"
          >
            <div className="flex items-center justify-between font-semibold">
              <span className="flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-blue-600" />
                <span>Naya Potha Credit & Loyalty Statement</span>
              </span>
              <span className="text-[11px] font-bold text-blue-700 flex items-center gap-0.5">
                <span>Open Portal</span>
                <ExternalLink className="w-3 h-3" />
              </span>
            </div>
          </Link>
        )}
      </div>

      {/* Main View Container */}
      {activeView === "digital" ? (
        /* ================= 1. RESPONSIVE DIGITAL E-RECEIPT VIEW ================= */
        <div className="max-w-md mx-auto px-4 print:p-0 print:max-w-none">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden print:border-none print:shadow-none">
            {/* Top Merchant Branding Header */}
            <div className="bg-gradient-to-b from-slate-900 to-slate-800 text-white p-6 text-center space-y-2 relative">
              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold tracking-wide uppercase border border-emerald-500/30">
                <ShieldCheck className="w-3 h-3" />
                <span>Official E-Receipt Verified</span>
              </div>
              <h1 className="text-xl font-extrabold tracking-tight">
                {business?.name || "SRI LANKA RETAIL POS"}
              </h1>
              {business?.address && (
                <p className="text-xs text-slate-300 leading-snug">{business.address}</p>
              )}
              {business?.phone && (
                <p className="text-xs text-slate-300 font-medium">Hotline: {business.phone}</p>
              )}

              {/* Tax Credentials */}
              <div className="pt-1 flex flex-wrap items-center justify-center gap-3 text-[10px] text-slate-400 font-mono">
                {business?.taxSettings?.tin && <span>TIN: {business.taxSettings.tin}</span>}
                {business?.taxSettings?.vatNumber && (
                  <span>VAT Reg: {business.taxSettings.vatNumber}</span>
                )}
              </div>
            </div>

            {/* Invoice Meta Banner */}
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between text-xs font-mono">
              <div>
                <span className="text-slate-400 block text-[10px]">INVOICE NUMBER</span>
                <span className="font-bold text-slate-800 text-sm">{sale.invoiceNumber}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block text-[10px]">DATE & TIME</span>
                <span className="font-semibold text-slate-700">
                  {formatSLDateTime(sale.createdAt)}
                </span>
              </div>
            </div>

            {/* Customer & Cashier Section */}
            <div className="px-5 py-3 border-b border-slate-100 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 text-[10px] block">BILLED TO</span>
                <span className="font-semibold text-slate-800">
                  {sale.customerName || "Walk-in Customer"}
                </span>
                {sale.customerPhone && (
                  <span className="text-[11px] text-slate-500 block font-mono">
                    {sale.customerPhone}
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="text-slate-400 text-[10px] block">SERVED BY</span>
                <span className="font-semibold text-slate-800">{sale.cashierName}</span>
                {sale.registerName && (
                  <span className="text-[11px] text-slate-500 block">
                    Counter: {sale.registerName}
                  </span>
                )}
              </div>
            </div>

            {/* Itemized Goods Breakdown */}
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 pb-1.5">
                <span>{t("receipt.item") || "Items Purchased"}</span>
                <span>{t("receipt.total") || "Amount"}</span>
              </div>

              <div className="divide-y divide-slate-100">
                {sale.items?.map((item: any, idx: number) => (
                  <div key={idx} className="py-2.5 space-y-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {language === "si" && item.nameSinhala
                            ? item.nameSinhala
                            : language === "ta" && item.nameTamil
                            ? item.nameTamil
                            : item.name}
                        </div>
                        {((language === "si" && item.nameSinhala) || (language === "ta" && item.nameTamil)) && (
                          <div className="text-[10px] text-slate-400 font-mono truncate">{item.name}</div>
                        )}
                        <div className="text-[11px] text-slate-500 font-mono">
                          {item.quantity} {item.unit || "unit"} × {formatCurrency(item.unitPrice)}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-bold text-slate-900 font-mono">
                          {formatCurrency(item.total)}
                        </div>
                        {item.discount > 0 && (
                          <div className="text-[10px] text-rose-600 font-mono">
                            -{formatCurrency(item.discount)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Batch & Shelf-Life Lot Info */}
                    {item.batchNumber && (
                      <div className="flex items-center gap-2 text-[10px] font-mono text-blue-700 bg-blue-50/70 px-2 py-0.5 rounded w-fit">
                        <span className="font-bold">Lot: {item.batchNumber}</span>
                        {item.expiryDate && (
                          <span className="text-slate-600">
                            Exp: {new Date(item.expiryDate).toLocaleDateString("en-GB")}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Calculations & IRD Tax Breakdown */}
            <div className="bg-slate-50 p-5 border-t border-slate-200 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span>{formatCurrency(sale.subtotal)}</span>
              </div>

              {sale.appliedPromotions && sale.appliedPromotions.length > 0 && (
                <div className="space-y-1">
                  {sale.appliedPromotions.map((p: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-emerald-700">
                      <span>Promo ({p.name}):</span>
                      <span>-{formatCurrency(p.discountAmount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {sale.loyaltyDiscount > 0 && (
                <div className="flex justify-between text-purple-700">
                  <span>Loyalty Rewards ({sale.pointsRedeemed || 0} pts):</span>
                  <span>-{formatCurrency(sale.loyaltyDiscount)}</span>
                </div>
              )}

              {sale.discountTotal > 0 &&
                (!sale.appliedPromotions || sale.appliedPromotions.length === 0) &&
                !sale.loyaltyDiscount && (
                  <div className="flex justify-between text-slate-600">
                    <span>Discount:</span>
                    <span>-{formatCurrency(sale.discountTotal)}</span>
                  </div>
                )}

              {/* IRD Statutory Tax Breakdown */}
              {sale.taxBreakdown && (
                <div className="pt-1 border-t border-dashed border-slate-200 space-y-1 text-slate-600">
                  {sale.taxBreakdown.ssclAmount > 0 && (
                    <div className="flex justify-between">
                      <span>SSCL ({sale.taxBreakdown.ssclRate || 2.5}%):</span>
                      <span>+{formatCurrency(sale.taxBreakdown.ssclAmount)}</span>
                    </div>
                  )}
                  {sale.taxBreakdown.vatAmount > 0 && (
                    <div className="flex justify-between">
                      <span>VAT ({sale.taxBreakdown.vatRate || 18}%):</span>
                      <span>+{formatCurrency(sale.taxBreakdown.vatAmount)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Grand Total */}
              <div className="pt-2 border-t border-slate-300 flex justify-between items-center text-slate-900 font-sans">
                <span className="font-extrabold text-sm uppercase">Net Total:</span>
                <span className="font-black text-lg text-slate-900 font-mono">
                  {formatCurrency(sale.netTotal)}
                </span>
              </div>

              {/* Payment Tender Breakdown */}
              <div className="pt-3 border-t border-slate-200 space-y-1">
                <div className="flex justify-between text-slate-700">
                  <span className="font-sans font-semibold">Payment Tender:</span>
                  <span className="font-bold text-slate-900 uppercase">{sale.paymentMethod}</span>
                </div>

                {sale.paymentMethod === "CASH" && (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span>Cash Tendered:</span>
                      <span>{formatCurrency(sale.cashReceived)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-emerald-700">
                      <span>Change Given:</span>
                      <span>{formatCurrency(sale.changeGiven)}</span>
                    </div>
                  </>
                )}

                {sale.paymentMethod === "CREDIT" && (
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-center font-bold text-[11px] text-amber-900">
                    BILLED TO NAYA POTHA CREDIT ACCOUNT
                  </div>
                )}

                {sale.giftVoucherRedeemed && (
                  <div className="p-2 bg-purple-50 border border-purple-200 rounded-lg space-y-0.5 text-[11px] text-purple-950">
                    <div className="font-bold">Gift Voucher Applied: {sale.giftVoucherRedeemed.code}</div>
                    <div className="flex justify-between">
                      <span>Amount Deducted:</span>
                      <span>-{formatCurrency(sale.giftVoucherRedeemed.amount)}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>Remaining Voucher Balance:</span>
                      <span>{formatCurrency(sale.giftVoucherRedeemed.remainingBalance)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Loyalty Rewards Banner */}
            {sale.pointsEarned > 0 && (
              <div className="p-4 bg-purple-50 border-t border-purple-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                  <Star className="w-4 h-4 fill-purple-600 text-purple-600" />
                </div>
                <div className="text-xs">
                  <div className="font-bold text-purple-950">
                    +{sale.pointsEarned} Loyalty Points Earned!
                  </div>
                  <div className="text-purple-700 text-[11px]">
                    Thank you for being a valued customer. Redeem points on your next checkout.
                  </div>
                </div>
              </div>
            )}

            {/* Digital Verification & QR Section */}
            <div className="p-5 border-t border-slate-200 text-center space-y-3 bg-white">
              <div className="flex justify-center">
                <div className="p-2 border border-slate-200 rounded-xl bg-white shadow-2xs">
                  <QRCodeImage value={currentUrl} size={96} margin={1} />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-800">
                  SCAN TO VERIFY AUTHENTICITY & WARRANTY
                </p>
                {sale.verificationToken && (
                  <p className="text-[10px] text-slate-400 font-mono">
                    Security Token: {sale.verificationToken}
                  </p>
                )}
              </div>

              {/* Store Return Policy */}
              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 leading-snug">
                {business?.receiptSettings?.footerMessage ||
                  "Goods returnable within 3 days in original packaging with digital receipt."}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ================= 2. CLASSIC THERMAL ROLL VIEW ================= */
        <div className="max-w-fit mx-auto px-4 print:p-0">
          <div className="no-print flex items-center justify-between mb-3 px-2">
            <span className="text-xs font-bold text-slate-600">Roll Width:</span>
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
              <button
                onClick={() => setCustomWidth("58mm")}
                className={`px-2.5 py-1 rounded text-xs font-mono font-bold ${
                  customWidth === "58mm" ? "bg-blue-600 text-white" : "text-slate-600"
                }`}
              >
                58mm
              </button>
              <button
                onClick={() => setCustomWidth("80mm")}
                className={`px-2.5 py-1 rounded text-xs font-mono font-bold ${
                  customWidth === "80mm" ? "bg-blue-600 text-white" : "text-slate-600"
                }`}
              >
                80mm
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-slate-300 print:border-none print:shadow-none print:rounded-none">
            <ThermalReceipt
              business={business || { name: "Sri Lanka POS" }}
              sale={sale}
              width={customWidth}
              receiptLanguage={language}
              publicReceiptUrl={currentUrl}
            />
          </div>
        </div>
      )}

      {/* Embedded Print CSS */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .no-print {
            display: none !important;
          }
          .thermal-receipt,
          .thermal-receipt * {
            visibility: visible;
          }
          .thermal-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>
    </div>
  );
}
