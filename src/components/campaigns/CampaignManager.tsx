"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Users,
  Send,
  Sparkles,
  TrendingUp,
  Tag,
  DollarSign,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  Search,
  Filter,
  ArrowRight,
  Eye,
  Plus,
  RefreshCw,
  Smartphone,
  Copy,
  Check,
  Percent,
  Award,
  ChevronRight,
  X,
  PieChart,
  ShieldCheck,
  FileText,
  HeartHandshake,
  BarChart3,
  HelpCircle,
} from "lucide-react";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";
import { SEGMENT_METADATA } from "@/lib/rfm";

interface SegmentInfo {
  id: string;
  name: string;
  nameSi: string;
  nameTa: string;
  description: string;
  color: string;
  bgLight: string;
  borderColor: string;
  textColor: string;
  badgeClass: string;
  recommendedOffer: string;
  defaultTemplate: string;
  count: number;
  validPhoneCount: number;
  percentage: number;
  totalRevenue: number;
  avgSpend: number;
  avgRecencyDays: number;
}

interface CampaignSummary {
  totalCampaigns: number;
  totalSent: number;
  totalCost: number;
  totalCouponsIssued: number;
  totalCouponsRedeemed: number;
  redemptionRate: number;
  totalRevenue: number;
  totalDiscountGiven: number;
  overallRoi: number;
}

interface CampaignItem {
  _id: string;
  campaignNumber: string;
  name: string;
  description?: string;
  status: "DRAFT" | "SCHEDULED" | "RUNNING" | "COMPLETED" | "CANCELLED";
  targetSegment: string;
  messageTemplate: string;
  language: string;
  couponConfig: {
    enabled: boolean;
    codePrefix: string;
    discountType: "PERCENTAGE" | "FIXED_AMOUNT";
    discountValue: number;
    minSpend: number;
    validDays: number;
  };
  stats: {
    totalTargeted: number;
    smsSent: number;
    smsFailed: number;
    smsSimulated: number;
    smsCost: number;
    couponsIssued: number;
    couponsRedeemed: number;
    revenueGenerated: number;
    discountGiven: number;
    roiPercent: number;
  };
  recipients?: Array<{
    _id: string;
    customerId: string;
    customerName: string;
    phone: string;
    segment: string;
    couponCode?: string;
    couponExpiresAt?: string;
    smsStatus: string;
    sentAt?: string;
    redeemed: boolean;
    redeemedAt?: string;
    invoiceNumber?: string;
    saleAmount?: number;
    discountAmount?: number;
  }>;
  scheduledAt?: string;
  sentAt?: string;
  completedAt?: string;
  createdAt: string;
}

export default function CampaignManager() {
  const [segments, setSegments] = useState<SegmentInfo[]>([]);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [validPhoneCount, setValidPhoneCount] = useState(0);
  const [storeName, setStoreName] = useState("");
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [summary, setSummary] = useState<CampaignSummary>({
    totalCampaigns: 0,
    totalSent: 0,
    totalCost: 0,
    totalCouponsIssued: 0,
    totalCouponsRedeemed: 0,
    redemptionRate: 0,
    totalRevenue: 0,
    totalDiscountGiven: 0,
    overallRoi: 0,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Filter & Search
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal: Create Campaign
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formName, setFormName] = useState("");
  const [formSegment, setFormSegment] = useState<string>("CHAMPIONS");
  const [formTemplate, setFormTemplate] = useState("");
  const [formCouponEnabled, setFormCouponEnabled] = useState(true);
  const [formCouponPrefix, setFormCouponPrefix] = useState("SAVE15");
  const [formDiscountType, setFormDiscountType] = useState<"PERCENTAGE" | "FIXED_AMOUNT">("PERCENTAGE");
  const [formDiscountValue, setFormDiscountValue] = useState<number>(15);
  const [formMinSpend, setFormMinSpend] = useState<number>(2000);
  const [formValidDays, setFormValidDays] = useState<number>(7);
  const [formLanguage, setFormLanguage] = useState<string>("EN");
  const [formCustomFilter, setFormCustomFilter] = useState({
    minSpend: 0,
    maxDaysInactive: 90,
  });

  // Audience Preview State
  const [previewLoading, setPreviewLoading] = useState(false);
  const [audiencePreview, setAudiencePreview] = useState<{
    totalMatched: number;
    sampleMessage: string;
    charCount: number;
    smsParts: number;
    isUnicode: boolean;
    estimatedCost: number;
  } | null>(null);

  // Modal: View Campaign Analytics
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignItem | null>(null);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState("");

  // Initial Load
  const fetchData = async () => {
    try {
      setLoading(true);
      const [segRes, campRes] = await Promise.all([
        fetch("/api/campaigns/segments"),
        fetch("/api/campaigns"),
      ]);

      if (segRes.ok) {
        const segData = await segRes.json();
        setSegments(segData.segments || []);
        setTotalCustomers(segData.totalCustomers || 0);
        setValidPhoneCount(segData.validPhoneCount || 0);
        setStoreName(segData.storeName || "Store");
      }

      if (campRes.ok) {
        const campData = await campRes.json();
        setCampaigns(campData.campaigns || []);
        if (campData.summary) setSummary(campData.summary);
      }
    } catch (err) {
      console.error("Failed to load campaign data:", err);
      setFeedback({ type: "error", message: "Failed to connect to campaigns engine." });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Update audience preview when segment or form values change
  const fetchPreview = async () => {
    try {
      setPreviewLoading(true);
      const res = await fetch("/api/campaigns/segments/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetSegment: formSegment,
          customFilter: formSegment === "CUSTOM" ? formCustomFilter : undefined,
          messageTemplate: formTemplate,
          couponConfig: {
            enabled: formCouponEnabled,
            codePrefix: formCouponPrefix,
            discountType: formDiscountType,
            discountValue: formDiscountValue,
            minSpend: formMinSpend,
            validDays: formValidDays,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAudiencePreview(data);
      }
    } catch (err) {
      console.error("Preview fetch error:", err);
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (isCreateOpen) {
      fetchPreview();
    }
  }, [
    isCreateOpen,
    formSegment,
    formTemplate,
    formCouponEnabled,
    formCouponPrefix,
    formDiscountType,
    formDiscountValue,
    formMinSpend,
    formValidDays,
    formCustomFilter,
  ]);

  // Open Creator pre-configured for a selected segment
  const handleLaunchForSegment = (segId: string) => {
    const meta = SEGMENT_METADATA[segId as keyof typeof SEGMENT_METADATA];
    setFormSegment(segId);
    setFormName(`${meta?.name || segId} Special Campaign`);
    setFormTemplate(meta?.defaultTemplate || SEGMENT_METADATA.ALL.defaultTemplate);

    if (segId === "CHAMPIONS") {
      setFormCouponPrefix("VIP20");
      setFormDiscountValue(20);
      setFormMinSpend(3000);
      setFormValidDays(7);
    } else if (segId === "AT_RISK" || segId === "HIBERNATING") {
      setFormCouponPrefix("WINBACK");
      setFormDiscountValue(15);
      setFormMinSpend(1500);
      setFormValidDays(10);
    } else if (segId === "NEW_CUSTOMERS") {
      setFormCouponPrefix("WELCOME");
      setFormDiscountValue(10);
      setFormMinSpend(1000);
      setFormValidDays(14);
    } else {
      setFormCouponPrefix("SAVE10");
      setFormDiscountValue(10);
      setFormMinSpend(1500);
      setFormValidDays(7);
    }

    setCreateStep(1);
    setIsCreateOpen(true);
  };

  // Submit Campaign
  const handleCreateCampaign = async (launchNow: boolean) => {
    if (!formName.trim()) {
      setFeedback({ type: "error", message: "Please enter a campaign name." });
      return;
    }
    if (!formTemplate.trim()) {
      setFeedback({ type: "error", message: "Please provide an SMS message template." });
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          targetSegment: formSegment,
          customFilter: formSegment === "CUSTOM" ? formCustomFilter : undefined,
          messageTemplate: formTemplate.trim(),
          language: formLanguage,
          couponConfig: {
            enabled: formCouponEnabled,
            codePrefix: formCouponPrefix.trim().toUpperCase(),
            discountType: formDiscountType,
            discountValue: formDiscountValue,
            minSpend: formMinSpend,
            validDays: formValidDays,
          },
          launchNow,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({
          type: "success",
          message: launchNow
            ? `Campaign launched! Successfully sent to ${data.campaign?.stats?.smsSent || 0} customers.`
            : "Campaign saved as draft.",
        });
        setIsCreateOpen(false);
        fetchData();
      } else {
        setFeedback({ type: "error", message: data.error || "Failed to create campaign." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to submit campaign." });
    } finally {
      setSubmitting(false);
    }
  };

  // Launch a draft campaign
  const handleLaunchDraft = async (id: string) => {
    if (!confirm("Are you sure you want to dispatch this SMS campaign now?")) return;
    try {
      const res = await fetch(`/api/campaigns/${id}/launch`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({ type: "success", message: data.message || "Campaign dispatched!" });
        fetchData();
      } else {
        setFeedback({ type: "error", message: data.error || "Failed to launch campaign." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Network error launching campaign." });
    }
  };

  // Insert template placeholder
  const insertPlaceholder = (tag: string) => {
    setFormTemplate((prev) => prev + ` {${tag}}`);
  };

  // Filtered campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
      const matchesSearch =
        searchQuery === "" ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.campaignNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.targetSegment.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [campaigns, statusFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Alert / Feedback Notification */}
      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-sm transition-all ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-gray-400 hover:text-gray-600 ml-4 font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Top Banner & KPI Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Segmented Audience</div>
            <div className="text-xl font-bold text-gray-900">
              {totalCustomers}{" "}
              <span className="text-xs font-normal text-emerald-600 font-medium">
                ({validPhoneCount} SMS-ready)
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">SMS Broadcasts</div>
            <div className="text-xl font-bold text-gray-900">
              {summary.totalSent.toLocaleString()}{" "}
              <span className="text-xs font-normal text-gray-400">
                (Rs. {summary.totalCost.toFixed(1)})
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Coupons Redeemed</div>
            <div className="text-xl font-bold text-emerald-700">
              {summary.totalCouponsRedeemed} / {summary.totalCouponsIssued}{" "}
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                {summary.redemptionRate}% conversion
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Attributed Sales & ROI</div>
            <div className="text-xl font-bold text-gray-900">
              {formatCurrency(summary.totalRevenue)}{" "}
              <span className="text-xs font-bold text-emerald-600">
                +{summary.overallRoi}% ROI
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* RFM Customer Segmentation Matrix */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-indigo-600" />
              RFM Customer Segments (Recency, Frequency, Spend)
            </h2>
            <p className="text-xs text-gray-500">
              Intelligent customer classification computed from live transaction patterns, checkout frequency, and days since last store visit.
            </p>
          </div>
          <button
            onClick={() => handleLaunchForSegment("ALL")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            New Campaign
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {segments
            .filter((s) => s.id !== "ALL" && s.id !== "CUSTOM")
            .map((seg) => (
              <div
                key={seg.id}
                className={`p-4 rounded-xl border ${seg.borderColor} ${seg.bgLight} transition-all hover:shadow-md flex flex-col justify-between`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${seg.badgeClass}`}
                    >
                      {seg.name}
                    </span>
                    <span className="text-xs font-semibold text-gray-500">
                      {seg.percentage}% of base
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between pt-1">
                    <div className="text-2xl font-black text-gray-900">
                      {seg.count}{" "}
                      <span className="text-xs font-normal text-gray-500">
                        customers
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">Avg Spend</div>
                      <div className="text-sm font-bold text-gray-800">
                        {formatCurrency(seg.avgSpend)}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-gray-600 line-clamp-2">
                    {seg.description}
                  </p>

                  <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between text-xs text-gray-500">
                    <span>
                      Avg Inactivity:{" "}
                      <strong className="text-gray-800">
                        {seg.avgRecencyDays} days
                      </strong>
                    </span>
                    <span>
                      Phones:{" "}
                      <strong className="text-emerald-700 font-semibold">
                        {seg.validPhoneCount}
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-200/60 flex items-center justify-between">
                  <div className="text-xs text-indigo-700 font-medium truncate max-w-[170px]" title={seg.recommendedOffer}>
                    💡 {seg.recommendedOffer}
                  </div>
                  <button
                    onClick={() => handleLaunchForSegment(seg.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-gray-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-all shadow-2xs shrink-0"
                  >
                    <span>Launch</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Campaigns Ledger & History */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              Promotional SMS Campaigns & Live Attribution
            </h2>
            <p className="text-xs text-gray-500">
              Track SMS delivery, recipient coupon redemptions at POS checkout counters, and direct marketing ROI.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search campaigns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 w-44"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 focus:bg-white focus:outline-hidden"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="RUNNING">Running</option>
              <option value="DRAFT">Draft</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            <button
              onClick={() => {
                setRefreshing(true);
                fetchData();
              }}
              disabled={refreshing}
              className="p-1.5 text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-gray-400 animate-pulse">
            Loading campaigns & customer segmentation matrix...
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <Tag className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-gray-800">No campaigns found</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Launch your first automated SMS promotional campaign to re-engage customers or reward top shoppers with unique coupons!
            </p>
            <button
              onClick={() => handleLaunchForSegment("ALL")}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700"
            >
              Create First Campaign
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/75 border-b border-gray-100 text-gray-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Campaign Info</th>
                  <th className="py-3 px-4">Target Segment</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">SMS Delivered</th>
                  <th className="py-3 px-4 text-center">Coupons Redeemed</th>
                  <th className="py-3 px-4 text-right">Attributed Revenue</th>
                  <th className="py-3 px-4 text-right">Marketing ROI</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCampaigns.map((camp) => {
                  const targetMeta =
                    SEGMENT_METADATA[camp.targetSegment as keyof typeof SEGMENT_METADATA] ||
                    SEGMENT_METADATA.ALL;

                  const redemptionRate =
                    camp.stats.couponsIssued > 0
                      ? Math.round(
                          (camp.stats.couponsRedeemed / camp.stats.couponsIssued) * 100
                        )
                      : 0;

                  return (
                    <tr key={camp._id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-gray-900">{camp.name}</div>
                        <div className="text-[11px] text-gray-400 font-mono">
                          {camp.campaignNumber} •{" "}
                          {camp.sentAt
                            ? formatSLDateTime(camp.sentAt)
                            : "Draft"}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold border ${targetMeta.badgeClass}`}
                        >
                          {targetMeta.name}
                        </span>
                        {camp.couponConfig.enabled && (
                          <div className="text-[11px] text-gray-500 mt-1">
                            Prefix: <span className="font-mono font-bold text-indigo-600">{camp.couponConfig.codePrefix}</span> (
                            {camp.couponConfig.discountType === "PERCENTAGE"
                              ? `${camp.couponConfig.discountValue}%`
                              : `Rs. ${camp.couponConfig.discountValue}`}
                            )
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            camp.status === "COMPLETED"
                              ? "bg-emerald-100 text-emerald-800"
                              : camp.status === "RUNNING"
                              ? "bg-blue-100 text-blue-800 animate-pulse"
                              : camp.status === "DRAFT"
                              ? "bg-gray-100 text-gray-700"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {camp.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="font-bold text-gray-900">
                          {camp.stats.smsSent + camp.stats.smsSimulated} /{" "}
                          {camp.stats.totalTargeted}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          Cost: Rs. {camp.stats.smsCost.toFixed(1)}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        {camp.couponConfig.enabled ? (
                          <div>
                            <span className="font-bold text-emerald-700">
                              {camp.stats.couponsRedeemed}
                            </span>
                            <span className="text-gray-400">
                              {" "}
                              / {camp.stats.couponsIssued}
                            </span>
                            <div className="text-[10px] font-semibold text-emerald-600">
                              {redemptionRate}% conversion
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">No coupons</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="font-bold text-gray-900">
                          {formatCurrency(camp.stats.revenueGenerated)}
                        </div>
                        <div className="text-[10px] text-rose-600">
                          Discounts: {formatCurrency(camp.stats.discountGiven)}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-lg text-xs font-black ${
                            camp.stats.roiPercent > 0
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {camp.stats.roiPercent > 0 ? `+${camp.stats.roiPercent}%` : "0%"} ROI
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedCampaign(camp);
                              setIsAnalyticsOpen(true);
                            }}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-semibold flex items-center gap-1 transition-colors"
                            title="Inspect conversion details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Details</span>
                          </button>

                          {camp.status === "DRAFT" && (
                            <button
                              onClick={() => handleLaunchDraft(camp._id)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold flex items-center gap-1 transition-colors"
                              title="Launch campaign now"
                            >
                              <Send className="w-3 h-3" />
                              <span>Send</span>
                            </button>
                          )}
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

      {/* MODAL: Create New Campaign */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden my-8">
            <div className="p-5 bg-gradient-to-r from-indigo-900 to-indigo-700 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-300" />
                  Targeted Promotional SMS Campaign Builder
                </h3>
                <p className="text-xs text-indigo-200">
                  Step {createStep} of 3 • Segment Audience, Incentive Offer & Message Composer
                </p>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Stepper Header */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <button
                  type="button"
                  onClick={() => setCreateStep(1)}
                  className={`flex items-center gap-2 text-xs font-bold pb-1 border-b-2 transition-all ${
                    createStep === 1
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-gray-400 hover:text-gray-700"
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs">
                    1
                  </span>
                  Audience & Target Segment
                </button>

                <button
                  type="button"
                  onClick={() => setCreateStep(2)}
                  className={`flex items-center gap-2 text-xs font-bold pb-1 border-b-2 transition-all ${
                    createStep === 2
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-gray-400 hover:text-gray-700"
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs">
                    2
                  </span>
                  Promo Coupon Incentive
                </button>

                <button
                  type="button"
                  onClick={() => setCreateStep(3)}
                  className={`flex items-center gap-2 text-xs font-bold pb-1 border-b-2 transition-all ${
                    createStep === 3
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-gray-400 hover:text-gray-700"
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs">
                    3
                  </span>
                  SMS Composer & Phone Preview
                </button>
              </div>

              {/* Step 1: Target Audience */}
              {createStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Campaign Title *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Sinhala & Tamil New Year 15% VIP Flash Sale"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Select Target RFM Customer Segment *
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                      {Object.keys(SEGMENT_METADATA).map((segKey) => {
                        const m = SEGMENT_METADATA[segKey as keyof typeof SEGMENT_METADATA];
                        const segData = segments.find((s) => s.id === segKey);
                        const isSelected = formSegment === segKey;

                        return (
                          <div
                            key={segKey}
                            onClick={() => {
                              setFormSegment(segKey);
                              setFormTemplate(m.defaultTemplate);
                            }}
                            className={`p-3 rounded-xl border cursor-pointer transition-all ${
                              isSelected
                                ? `border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20 shadow-xs`
                                : "border-gray-200 hover:border-gray-300 bg-white"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span
                                className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${m.badgeClass}`}
                              >
                                {m.name}
                              </span>
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-indigo-600" />
                              )}
                            </div>
                            <div className="text-sm font-bold text-gray-900">
                              {segData?.count ?? 0}{" "}
                              <span className="text-[10px] font-normal text-gray-500">
                                customers
                              </span>
                            </div>
                            <div className="text-[10px] text-gray-500 truncate mt-1">
                              {m.description}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {formSegment === "CUSTOM" && (
                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Minimum Lifetime Spend (LKR)
                        </label>
                        <input
                          type="number"
                          value={formCustomFilter.minSpend}
                          onChange={(e) =>
                            setFormCustomFilter({
                              ...formCustomFilter,
                              minSpend: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Max Days Since Last Visit
                        </label>
                        <input
                          type="number"
                          value={formCustomFilter.maxDaysInactive}
                          onChange={(e) =>
                            setFormCustomFilter({
                              ...formCustomFilter,
                              maxDaysInactive: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-white"
                        />
                      </div>
                    </div>
                  )}

                  {audiencePreview && (
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between text-xs text-emerald-800">
                      <div>
                        Matched Audience: <strong>{audiencePreview.totalMatched} customers</strong> with verified phone numbers.
                      </div>
                      <div>
                        Estimated Broadcast Cost: <strong>Rs. {audiencePreview.estimatedCost.toFixed(2)}</strong> (at Rs. 0.40/SMS)
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Promo Coupon Incentive */}
              {createStep === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-gray-50">
                    <div>
                      <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <Tag className="w-4 h-4 text-indigo-600" />
                        Generate Unique Promo Coupon Codes for Each Recipient
                      </div>
                      <p className="text-xs text-gray-500">
                        When enabled, each SMS contains a unique code (e.g. <code>SAVE15-X8Y2</code>) that can be entered at the counter for automatic checkout discounts.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formCouponEnabled}
                        onChange={(e) => setFormCouponEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  {formCouponEnabled && (
                    <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/30 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">
                            Coupon Code Prefix
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. SAVE15, AVURUDU, VIP20"
                            value={formCouponPrefix}
                            onChange={(e) =>
                              setFormCouponPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
                            }
                            className="w-full px-3 py-2 text-sm uppercase font-mono font-bold rounded-xl border border-gray-200 bg-white"
                          />
                          <p className="text-[11px] text-gray-400 mt-1">
                            Code format: <code>{formCouponPrefix || "PROMO"}-XXXX</code>
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">
                            Discount Type
                          </label>
                          <select
                            value={formDiscountType}
                            onChange={(e) =>
                              setFormDiscountType(e.target.value as "PERCENTAGE" | "FIXED_AMOUNT")
                            }
                            className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white"
                          >
                            <option value="PERCENTAGE">Percentage (%) Discount</option>
                            <option value="FIXED_AMOUNT">Fixed Rupee (Rs.) Discount</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">
                            Discount Value {formDiscountType === "PERCENTAGE" ? "(%)" : "(Rs.)"}
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={formDiscountValue}
                            onChange={(e) => setFormDiscountValue(parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">
                            Minimum Cart Spend (LKR)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={formMinSpend}
                            onChange={(e) => setFormMinSpend(parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">
                            Validity Period (Days from Send)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="90"
                            value={formValidDays}
                            onChange={(e) => setFormValidDays(parseInt(e.target.value) || 7)}
                            className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: SMS Composer & Phone Preview */}
              {createStep === 3 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left: Editor */}
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-gray-700">
                          SMS Message Template *
                        </label>
                        <span className="text-[11px] text-gray-400">
                          Supports Sinhala, Tamil & English
                        </span>
                      </div>
                      <textarea
                        rows={6}
                        value={formTemplate}
                        onChange={(e) => setFormTemplate(e.target.value)}
                        placeholder="Draft your promotional SMS with dynamic tags..."
                        className="w-full p-3 text-sm rounded-xl border border-gray-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-sans"
                      />
                    </div>

                    {/* Placeholder tags */}
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                        Insert Dynamic Placeholders
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { tag: "name", label: "Customer Name" },
                          { tag: "coupon", label: "Coupon Code" },
                          { tag: "discount", label: "Discount Value" },
                          { tag: "minSpend", label: "Min Spend" },
                          { tag: "expiryDate", label: "Expiry Date" },
                          { tag: "points", label: "Loyalty Points" },
                          { tag: "store", label: "Store Name" },
                        ].map(({ tag, label }) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => insertPlaceholder(tag)}
                            className="px-2 py-1 rounded-md bg-gray-100 hover:bg-indigo-50 text-gray-700 hover:text-indigo-700 border border-gray-200 text-xs font-mono font-medium transition-colors"
                          >
                            +&#123;{tag}&#125;
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Character and part counter */}
                    {audiencePreview && (
                      <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between text-xs">
                        <div>
                          Characters: <strong>{audiencePreview.charCount}</strong> | Parts:{" "}
                          <strong>{audiencePreview.smsParts} SMS</strong>
                          {audiencePreview.isUnicode && (
                            <span className="ml-2 px-1.5 py-0.5 rounded-sm bg-purple-100 text-purple-800 text-[10px] font-bold">
                              Unicode (Sinhala/Tamil)
                            </span>
                          )}
                        </div>
                        <div className="text-gray-600">
                          Est. Broadcast Cost:{" "}
                          <strong className="text-indigo-700">
                            Rs. {audiencePreview.estimatedCost.toFixed(2)}
                          </strong>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right: Realistic Phone Preview */}
                  <div className="flex flex-col items-center justify-center p-4 bg-gray-100 rounded-2xl border border-gray-200">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-indigo-600" />
                      Recipient Phone Simulation
                    </div>

                    {/* Smartphone Mockup */}
                    <div className="w-[280px] bg-slate-900 rounded-[36px] p-3 shadow-xl border-4 border-slate-700 text-white relative">
                      <div className="w-20 h-4 bg-black rounded-full mx-auto mb-2"></div>
                      <div className="bg-slate-800 rounded-2xl p-3 min-h-[300px] flex flex-col justify-between text-slate-100 text-xs">
                        <div className="border-b border-slate-700 pb-2 flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-500 text-[10px] font-bold flex items-center justify-center">
                            {storeName ? storeName.charAt(0) : "S"}
                          </div>
                          <div>
                            <div className="font-bold text-[11px] truncate max-w-[170px]">
                              {storeName || "Your Store"}
                            </div>
                            <div className="text-[9px] text-slate-400">SMS Notification</div>
                          </div>
                        </div>

                        {/* Message Bubble */}
                        <div className="bg-indigo-600 text-white p-3 rounded-2xl rounded-bl-xs text-xs shadow-sm my-auto leading-relaxed whitespace-pre-wrap">
                          {previewLoading ? (
                            <span className="italic text-indigo-200">Formatting preview...</span>
                          ) : (
                            audiencePreview?.sampleMessage || formTemplate
                          )}
                        </div>

                        <div className="text-[9px] text-center text-slate-400 pt-2 border-t border-slate-700">
                          Sri Lanka Telecom Delivery Gateway
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Stepper Footer Controls */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <div>
                {createStep > 1 && (
                  <button
                    type="button"
                    onClick={() => setCreateStep((prev) => (prev - 1) as any)}
                    className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-100"
                  >
                    Back
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {createStep < 3 ? (
                  <button
                    type="button"
                    onClick={() => setCreateStep((prev) => (prev + 1) as any)}
                    className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 flex items-center gap-1.5"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleCreateCampaign(false)}
                      className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-100"
                    >
                      Save as Draft
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleCreateCampaign(true)}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{submitting ? "Dispatching..." : "Launch Campaign Now"}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: View Campaign Analytics & Recipients */}
      {isAnalyticsOpen && selectedCampaign && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden my-8">
            <div className="p-5 bg-gradient-to-r from-gray-900 to-indigo-900 text-white flex items-center justify-between">
              <div>
                <div className="text-xs text-indigo-300 font-mono">
                  {selectedCampaign.campaignNumber} • {selectedCampaign.status}
                </div>
                <h3 className="text-base font-bold">{selectedCampaign.name}</h3>
              </div>
              <button
                onClick={() => setIsAnalyticsOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Financial ROI Dashboard Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-gray-500 font-medium">SMS Investment</div>
                  <div className="text-lg font-bold text-gray-900">
                    Rs. {selectedCampaign.stats.smsCost.toFixed(2)}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {selectedCampaign.stats.smsSent} messages delivered
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 font-medium">Coupons Redeemed</div>
                  <div className="text-lg font-bold text-emerald-700">
                    {selectedCampaign.stats.couponsRedeemed} / {selectedCampaign.stats.couponsIssued}
                  </div>
                  <div className="text-[11px] text-emerald-600 font-semibold">
                    {selectedCampaign.stats.couponsIssued > 0
                      ? Math.round(
                          (selectedCampaign.stats.couponsRedeemed /
                            selectedCampaign.stats.couponsIssued) *
                            100
                        )
                      : 0}
                    % conversion rate
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 font-medium">Attributed Sales</div>
                  <div className="text-lg font-bold text-indigo-900">
                    {formatCurrency(selectedCampaign.stats.revenueGenerated)}
                  </div>
                  <div className="text-[11px] text-rose-600">
                    Discount absorbed: {formatCurrency(selectedCampaign.stats.discountGiven)}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 font-medium">Net Marketing ROI</div>
                  <div className="text-xl font-black text-emerald-600">
                    +{selectedCampaign.stats.roiPercent}%
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {selectedCampaign.stats.revenueGenerated > 0
                      ? `${(
                          selectedCampaign.stats.revenueGenerated /
                          Math.max(1, selectedCampaign.stats.smsCost + selectedCampaign.stats.discountGiven)
                        ).toFixed(1)}x Return on Spend`
                      : "Awaiting redemptions"}
                  </div>
                </div>
              </div>

              {/* Message Sent Snapshot */}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                <div className="text-xs font-bold text-gray-700 mb-1">Dispatched SMS Content:</div>
                <div className="text-xs text-gray-800 font-sans italic bg-white p-3 rounded-lg border border-gray-200">
                  "{selectedCampaign.messageTemplate}"
                </div>
              </div>

              {/* Recipient Conversion Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-gray-900">
                    Recipient Conversion & Redemption Audit Log
                  </h4>
                  <input
                    type="text"
                    placeholder="Search by customer name or coupon..."
                    value={recipientSearch}
                    onChange={(e) => setRecipientSearch(e.target.value)}
                    className="px-3 py-1.5 text-xs rounded-xl border border-gray-200 w-64"
                  />
                </div>

                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 uppercase font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">Phone</th>
                        <th className="py-2.5 px-3">Unique Coupon</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Invoice Ref</th>
                        <th className="py-2.5 px-3 text-right">Sale Amount</th>
                        <th className="py-2.5 px-3 text-right">Discount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(selectedCampaign.recipients || [])
                        .filter(
                          (r) =>
                            recipientSearch === "" ||
                            r.customerName.toLowerCase().includes(recipientSearch.toLowerCase()) ||
                            r.phone.includes(recipientSearch) ||
                            (r.couponCode && r.couponCode.includes(recipientSearch.toUpperCase()))
                        )
                        .map((rec) => (
                          <tr key={rec._id} className="hover:bg-gray-50/50">
                            <td className="py-2 px-3 font-semibold text-gray-900">
                              {rec.customerName}
                            </td>
                            <td className="py-2 px-3 font-mono text-gray-600">
                              {rec.phone}
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-indigo-700">
                              {rec.couponCode || "-"}
                            </td>
                            <td className="py-2 px-3">
                              {rec.redeemed ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  <Check className="w-3 h-3" />
                                  REDEEMED
                                </span>
                              ) : (
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">
                                  ISSUED
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-mono text-gray-500">
                              {rec.invoiceNumber || "-"}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-gray-800">
                              {rec.saleAmount ? formatCurrency(rec.saleAmount) : "-"}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-emerald-600">
                              {rec.discountAmount ? formatCurrency(rec.discountAmount) : "-"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end">
              <button
                onClick={() => setIsAnalyticsOpen(false)}
                className="px-4 py-2 bg-gray-800 text-white rounded-xl text-xs font-bold hover:bg-gray-900"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
