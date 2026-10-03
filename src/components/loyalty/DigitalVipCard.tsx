"use client";

import React, { useState } from "react";
import QRCodeImage from "@/components/common/QRCodeImage";
import {
  Crown,
  Sparkles,
  Award,
  Star,
  Share2,
  Copy,
  Check,
  QrCode,
  Phone,
  Calendar,
  Gift,
  Printer,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { useLanguage, useTranslation } from "@/lib/i18n/LanguageContext";

export interface DigitalVipCardProps {
  customer: {
    _id?: string;
    name: string;
    phone: string;
    email?: string;
    dateOfBirth?: string | Date;
    portalToken?: string;
    referralCode?: string;
    referralCount?: number;
    referralPointsEarned?: number;
    vipCardIssuedAt?: string | Date;
  };
  loyalty: {
    tier: "REGULAR" | "SILVER" | "GOLD" | "PLATINUM" | string;
    points: number;
    monetaryEquivalent?: number;
    lifetimeEarned?: number;
    totalSpent?: number;
  };
  progression?: {
    nextTier?: string | null;
    nextTierName?: string;
    nextTierMultiplier?: number;
    amountNeeded?: number;
    progressPercent?: number;
  };
  business?: {
    name?: string;
    phone?: string;
    address?: string;
    logo?: string;
    currency?: string;
  };
  showSharing?: boolean;
  showPrint?: boolean;
  compact?: boolean;
}

export default function DigitalVipCard({
  customer,
  loyalty,
  progression,
  business,
  showSharing = true,
  showPrint = true,
  compact = false,
}: DigitalVipCardProps) {
  const { language } = useLanguage();
  const { t } = useTranslation();
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  const tier = (loyalty?.tier || "REGULAR").toUpperCase();
  const points = loyalty?.points || 0;
  const monetaryValue = loyalty?.monetaryEquivalent ?? points; // 1 point = Rs. 1 default
  const referralCode = customer.referralCode || "REF-VIP";
  const storeName = business?.name || "Sri Lanka Retail POS";

  // Tier Theme Config
  const tierConfig: Record<
    string,
    {
      label: string;
      labelSi: string;
      labelTa: string;
      multiplier: string;
      gradient: string;
      border: string;
      badgeBg: string;
      badgeText: string;
      accentText: string;
      icon: React.ReactNode;
      perkSi: string;
      perkTa: string;
      perkEn: string;
    }
  > = {
    PLATINUM: {
      label: "Platinum Elite",
      labelSi: "ප්ලැටිනම් එලයිට්",
      labelTa: "பிளாட்டினம் எலைட்",
      multiplier: "2.0x Double Points",
      gradient: "from-slate-950 via-purple-950 to-slate-900",
      border: "border-purple-500/40 shadow-purple-950/50",
      badgeBg: "bg-gradient-to-r from-purple-400 to-pink-400 text-slate-950 font-black",
      badgeText: "text-purple-300",
      accentText: "text-purple-300",
      icon: <Sparkles className="w-4 h-4 text-purple-300" />,
      perkSi: "සෑම මිලදී ගැනීමකටම 2x ලකුණු & විශේෂ වට්ටම්",
      perkTa: "அனைத்து கொள்முதல்களுக்கும் 2x புள்ளிகள்",
      perkEn: "2.0x Points Multiplier • VIP Hotline • Annual Gift",
    },
    GOLD: {
      label: "Gold VIP",
      labelSi: "රන් VIP",
      labelTa: "தங்க விஐபி",
      multiplier: "1.5x Points",
      gradient: "from-amber-950 via-yellow-950 to-stone-900",
      border: "border-amber-400/40 shadow-amber-950/50",
      badgeBg: "bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 font-black",
      badgeText: "text-amber-300",
      accentText: "text-amber-300",
      icon: <Crown className="w-4 h-4 text-amber-300" />,
      perkSi: "1.5x ලකුණු & නොමිලේ බෙදාහැරීම",
      perkTa: "1.5x புள்ளிகள் & இலவச டெலிவரி",
      perkEn: "1.5x Points Multiplier • Free Delivery > Rs. 5,000",
    },
    SILVER: {
      label: "Silver VIP",
      labelSi: "රිදී VIP",
      labelTa: "வெள்ளி விஐபி",
      multiplier: "1.25x Points",
      gradient: "from-slate-900 via-slate-800 to-zinc-900",
      border: "border-slate-400/40 shadow-slate-900/50",
      badgeBg: "bg-gradient-to-r from-slate-200 to-slate-300 text-slate-900 font-black",
      badgeText: "text-slate-300",
      accentText: "text-slate-200",
      icon: <Award className="w-4 h-4 text-slate-300" />,
      perkSi: "1.25x ලකුණු & ප්‍රමුඛතා පාරිභෝගික සහාය",
      perkTa: "1.25x புள்ளிகள் & முன்னுரிமை சேவை",
      perkEn: "1.25x Points Multiplier • Early Promotion Access",
    },
    REGULAR: {
      label: "Regular Member",
      labelSi: "සාමාන්‍ය සාමාජික",
      labelTa: "வழக்கமான உறுப்பினர்",
      multiplier: "1.0x Base Points",
      gradient: "from-slate-900 via-slate-850 to-slate-900",
      border: "border-slate-700/60 shadow-slate-950/40",
      badgeBg: "bg-slate-700 text-slate-200 font-bold",
      badgeText: "text-slate-400",
      accentText: "text-blue-400",
      icon: <Star className="w-4 h-4 text-slate-400" />,
      perkSi: "සෑම රු. 100 කටම ලකුණු 1 ක් & කවුන්ටරයෙන් අඩු කිරීම්",
      perkTa: "ஒவ்வொரு ரூ. 100 க்கும் 1 புள்ளி",
      perkEn: "1 pt per Rs. 100 Spent • Instant Checkout Deductions",
    },
  };

  const currentTheme = tierConfig[tier] || tierConfig.REGULAR;

  // Localized tier label
  const localizedTierName =
    language === "si"
      ? currentTheme.labelSi
      : language === "ta"
      ? currentTheme.labelTa
      : currentTheme.label;

  const localizedPerk =
    language === "si"
      ? currentTheme.perkSi
      : language === "ta"
      ? currentTheme.perkTa
      : currentTheme.perkEn;

  // Portal statement and referral URLs
  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "https://pos.srilanka.lk";
  const portalUrl = customer.portalToken
    ? `${baseUrl}/portal/statement/${customer.portalToken}`
    : `${baseUrl}/portal`;

  const inviteMessage = `Hi! Join the VIP Loyalty Club at ${storeName}. Use my referral code *${referralCode}* on your first order to get 50 bonus reward points! Portal: ${portalUrl}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(inviteMessage)}`;

  // Scannable barcode payload for counter checkout
  const qrScannerValue = `LOYALTY:${customer.phone}:${referralCode}:${customer._id || ""}`;

  const handleCopyCode = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(referralCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(portalUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* ================= THE WALLET PASS CARD ================= */}
      <div
        className={`relative overflow-hidden rounded-3xl p-6 sm:p-8 text-white shadow-2xl border transition-all duration-300 bg-gradient-to-br ${currentTheme.gradient} ${currentTheme.border}`}
      >
        {/* Iridescent Metallic Sheen Overlay */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-white/10 pointer-events-none" />

        {/* Ambient Watermark Icon */}
        <div className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none transform rotate-12 scale-125">
          {tier === "PLATINUM" ? (
            <Sparkles className="w-56 h-56" />
          ) : tier === "GOLD" ? (
            <Crown className="w-56 h-56" />
          ) : (
            <Award className="w-56 h-56" />
          )}
        </div>

        <div className="relative z-10 space-y-6">
          {/* Header Row: Store Name & VIP Tier Badge */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/70 block">
                  Digital VIP Membership Pass
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black tracking-tight drop-shadow-sm">
                {storeName}
              </h3>
            </div>

            <div className="text-right">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs uppercase tracking-wider shadow-md ${currentTheme.badgeBg}`}
              >
                {currentTheme.icon}
                <span>{localizedTierName}</span>
              </span>
              <span className="block text-[10px] text-white/70 mt-1 font-mono">
                {currentTheme.multiplier}
              </span>
            </div>
          </div>

          {/* Member Details & Scannable QR Code */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pt-2">
            <div className="space-y-3">
              <div>
                <span className="text-[10px] text-white/60 uppercase tracking-wider block">
                  Member Name
                </span>
                <span className="text-base sm:text-lg font-bold tracking-tight text-white block">
                  {customer.name}
                </span>
                <span className="text-xs font-mono text-white/80 flex items-center gap-1.5 mt-0.5">
                  <Phone className="w-3 h-3 text-white/60" />
                  <span>{customer.phone}</span>
                </span>
              </div>

              {/* Points & Monetary Discount Counter */}
              <div className="pt-1">
                <span className="text-[10px] text-white/60 uppercase tracking-wider block">
                  Points Balance (ලකුණු ශේෂය)
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white">
                    {points.toLocaleString()}
                  </span>
                  <span className="text-sm font-bold text-amber-300 uppercase tracking-wider">
                    PTS
                  </span>
                  <span className="text-xs text-emerald-400 font-semibold font-mono pl-1">
                    (≈ {formatCurrency(monetaryValue)} discount)
                  </span>
                </div>
              </div>
            </div>

            {/* Scannable E-Card QR Code for Fast Counter Lookup */}
            <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/95 text-slate-900 shadow-lg border border-white/20 shrink-0 self-start sm:self-auto">
              <QRCodeImage
                value={qrScannerValue}
                size={84}
                className="rounded-lg"
                alt={`${customer.name} Loyalty QR`}
                darkColor="#0f172a"
                lightColor="#ffffff"
              />
              <span className="text-[9px] font-mono font-bold tracking-wider text-slate-700 mt-1 uppercase">
                Scan at Counter
              </span>
            </div>
          </div>

          {/* Tier Perks & Progression Row */}
          <div className="pt-3 border-t border-white/10 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-white/90">
                <Gift className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span className="text-[11px] font-medium">{localizedPerk}</span>
              </div>

              {customer.vipCardIssuedAt && (
                <div className="text-[10px] text-white/50 flex items-center gap-1 font-mono">
                  <Calendar className="w-3 h-3" />
                  <span>
                    Card Active:{" "}
                    {new Date(customer.vipCardIssuedAt).toLocaleDateString("en-LK", {
                      year: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
              )}
            </div>

            {/* Next Tier Spend Progress Bar */}
            {progression && progression.nextTier && (
              <div className="p-3 rounded-xl bg-black/20 border border-white/10 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white/80 flex items-center gap-1 font-medium">
                    <TrendingUp className="w-3 h-3 text-amber-300" />
                    <span>
                      Target: <strong>{progression.nextTierName || progression.nextTier}</strong> ({progression.nextTierMultiplier}x)
                    </span>
                  </span>
                  <span className="font-mono text-amber-300 font-bold">
                    {progression.amountNeeded && progression.amountNeeded > 0
                      ? `Rs. ${progression.amountNeeded.toLocaleString()} to upgrade`
                      : "Upgrade Achieved!"}
                  </span>
                </div>

                {/* Progress track */}
                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-amber-400 via-pink-400 to-purple-400 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(5, progression.progressPercent || 0))}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-white/50 font-mono">
                  <span>Current Tier</span>
                  <span>{progression.progressPercent || 0}% Progress</span>
                  <span>Next VIP Tier</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================= REFERRAL SHARING & ACTIONS ================= */}
      {showSharing && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Gift className="w-4 h-4 text-purple-600" />
                <span>Referral Rewards Program (යොමු කිරීමේ ත්‍යාග)</span>
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Share your referral code with friends. You earn <strong>+100 bonus points</strong> and your friend gets <strong>+50 points</strong> on their first order!
              </p>
            </div>

            {/* Customer Referral Code Badge */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <div className="px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-xl font-mono font-black text-sm text-purple-900 tracking-wider">
                {referralCode}
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                title="Copy Referral Code"
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Social Share & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share on WhatsApp</span>
            </a>

            <button
              type="button"
              onClick={handleCopyLink}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Statement Link Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy Statement Link</span>
                </>
              )}
            </button>

            {showPrint && (
              <button
                type="button"
                onClick={handlePrint}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ml-auto"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span>Print Card</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
