import { CampaignSegment, ICampaignCustomFilter } from "@/models/PromotionalCampaign";

export interface CustomerRfmData {
  recencyDays: number;
  frequency: number;
  monetary: number;
  segment: CampaignSegment;
}

export interface SegmentMetadata {
  id: CampaignSegment;
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
}

export const SEGMENT_METADATA: Record<CampaignSegment, SegmentMetadata> = {
  CHAMPIONS: {
    id: "CHAMPIONS",
    name: "Champions",
    nameSi: "ශූර පාරිභෝගිකයින්",
    nameTa: "முன்னணி வாடிக்கையாளர்கள்",
    description: "Bought recently, visit often, and have the highest lifetime spend.",
    color: "#8B5CF6",
    bgLight: "bg-purple-50",
    borderColor: "border-purple-200",
    textColor: "text-purple-700",
    badgeClass: "bg-purple-100 text-purple-800 border-purple-300",
    recommendedOffer: "VIP reward multiplier, early access to new shipments, priority counter service.",
    defaultTemplate:
      "Dear {name}, as our Platinum Champion at {store}, enjoy an exclusive VIP discount! Use code {coupon} for {discount} off (min Rs. {minSpend}). Valid till {expiryDate}. Thank you for your continued loyalty!",
  },
  LOYAL: {
    id: "LOYAL",
    name: "Loyal Regulars",
    nameSi: "නිරන්තර විශ්වාසවන්තයින්",
    nameTa: "விசுவாசமான வாடிக்கையாளர்கள்",
    description: "Consistent regular visitors with solid basket sizes and positive responsiveness.",
    color: "#3B82F6",
    bgLight: "bg-blue-50",
    borderColor: "border-blue-200",
    textColor: "text-blue-700",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-300",
    recommendedOffer: "Cross-category promotions, upsell bundled products, loyalty point boosters.",
    defaultTemplate:
      "Dear {name}, thank you for regularly choosing {store}! Here is a special treat: use coupon code {coupon} to get {discount} off your next purchase above Rs. {minSpend}. Valid till {expiryDate}!",
  },
  POTENTIAL_LOYAL: {
    id: "POTENTIAL_LOYAL",
    name: "Potential Loyalists",
    nameSi: "විශ්වාසවන්ත වියහැකි අය",
    nameTa: "வாய்ப்புள்ள விசுவாசிகள்",
    description: "Recent customers with 2–4 purchases. High likelihood of becoming long-term regulars.",
    color: "#10B981",
    bgLight: "bg-emerald-50",
    borderColor: "border-emerald-200",
    textColor: "text-emerald-700",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
    recommendedOffer: "Membership card invitations, second & third visit incentives, category exploration.",
    defaultTemplate:
      "Hello {name}! We loved seeing you at {store}. Enjoy {discount} off your next visit with coupon code {coupon} (min spend Rs. {minSpend}). Offer expires on {expiryDate}. See you soon!",
  },
  NEW_CUSTOMERS: {
    id: "NEW_CUSTOMERS",
    name: "New Customers",
    nameSi: "නව පාරිභෝගිකයින්",
    nameTa: "புதிய வாடிக்கையாளர்கள்",
    description: "Visited within the last 30 days for their 1st purchase.",
    color: "#06B6D4",
    bgLight: "bg-cyan-50",
    borderColor: "border-cyan-200",
    textColor: "text-cyan-700",
    badgeClass: "bg-cyan-100 text-cyan-800 border-cyan-300",
    recommendedOffer: "Welcome gift, onboarding discount, referral code incentive.",
    defaultTemplate:
      "Welcome to {store}, {name}! As a special welcome, use code {coupon} on your next order for {discount} off (min Rs. {minSpend}). Valid till {expiryDate}. We look forward to serving you again!",
  },
  AT_RISK: {
    id: "AT_RISK",
    name: "At-Risk Customers",
    nameSi: "අවදානම් / මගහැරී ඇති අය",
    nameTa: "இழக்கும் அபாயமுள்ளவர்கள்",
    description: "Previously active shoppers who haven't visited in 45–90 days.",
    color: "#F59E0B",
    bgLight: "bg-amber-50",
    borderColor: "border-amber-200",
    textColor: "text-amber-700",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
    recommendedOffer: "Win-back discount, personalized 'We miss you' coupon, restock notice.",
    defaultTemplate:
      "Dear {name}, we miss seeing you at {store}! Here is an exclusive win-back gift: use code {coupon} for {discount} off your next bill over Rs. {minSpend}. Valid till {expiryDate}. Visit us today!",
  },
  HIBERNATING: {
    id: "HIBERNATING",
    name: "Hibernating / Dormant",
    nameSi: "දිගුකාලීනව නොපැමිණි අය",
    nameTa: "செயலற்ற வாடிக்கையாளர்கள்",
    description: "Last purchase was over 90 days ago with declining visit frequency.",
    color: "#EF4444",
    bgLight: "bg-red-50",
    borderColor: "border-red-200",
    textColor: "text-red-700",
    badgeClass: "bg-red-100 text-red-800 border-red-300",
    recommendedOffer: "High-value reactivation coupon, flash clearance invitation.",
    defaultTemplate:
      "Dear {name}, it's been a while! {store} is welcoming you back with {discount} off your purchase using code {coupon} (min spend Rs. {minSpend}). Valid till {expiryDate}. Don't miss out!",
  },
  HIGH_SPENDERS: {
    id: "HIGH_SPENDERS",
    name: "High Spenders (Whales)",
    nameSi: "වැඩිම වියදම් කරන පාරිභෝගිකයින්",
    nameTa: "அதிகம் செலவழிப்பவர்கள்",
    description: "Top spenders with lifetime expenditure exceeding Rs. 50,000.",
    color: "#EC4899",
    bgLight: "bg-pink-50",
    borderColor: "border-pink-200",
    textColor: "text-pink-700",
    badgeClass: "bg-pink-100 text-pink-800 border-pink-300",
    recommendedOffer: "Premium gift with purchase, personal concierge, bulk wholesale pricing.",
    defaultTemplate:
      "Dear {name}, as one of {store}'s most valued patrons, enjoy {discount} off with promo code {coupon} on your next order (min Rs. {minSpend}). Valid till {expiryDate}. We appreciate your trust!",
  },
  ALL: {
    id: "ALL",
    name: "All Customers",
    nameSi: "සියලුම පාරිභෝගිකයින්",
    nameTa: "அனைத்து வாடிக்கையாளர்கள்",
    description: "Store-wide broadcast reaching all registered customers with phone numbers.",
    color: "#6B7280",
    bgLight: "bg-gray-50",
    borderColor: "border-gray-200",
    textColor: "text-gray-700",
    badgeClass: "bg-gray-100 text-gray-800 border-gray-300",
    recommendedOffer: "Store-wide seasonal sales, holiday greetings (Avurudu, Christmas, Ramadan, Deepavali).",
    defaultTemplate:
      "Special seasonal announcement from {store}! Enjoy {discount} with coupon code {coupon} (min spend Rs. {minSpend}). Valid till {expiryDate}. Thank you for shopping with us!",
  },
  CUSTOM: {
    id: "CUSTOM",
    name: "Custom Audience",
    nameSi: "අභිරුචි පිරිස",
    nameTa: "விருப்பப் பார்வையாளர்கள்",
    description: "Filtered by specific spend thresholds, visit frequency, or loyalty tiers.",
    color: "#6366F1",
    bgLight: "bg-indigo-50",
    borderColor: "border-indigo-200",
    textColor: "text-indigo-700",
    badgeClass: "bg-indigo-100 text-indigo-800 border-indigo-300",
    recommendedOffer: "Tailored to custom filter parameters.",
    defaultTemplate:
      "Dear {name}, {store} has a special offer just for you! Use coupon code {coupon} for {discount} off your bill over Rs. {minSpend}. Valid till {expiryDate}!",
  },
};

/**
 * Classifies a single customer into an RFM segment
 */
export function classifyCustomerRfm(
  customer: {
    lastVisit?: Date | string | null;
    visitCount?: number;
    totalSpent?: number;
    createdAt?: Date | string;
  },
  now = new Date()
): CustomerRfmData {
  const visitDate = customer.lastVisit
    ? new Date(customer.lastVisit)
    : customer.createdAt
    ? new Date(customer.createdAt)
    : null;

  const recencyDays = visitDate
    ? Math.max(0, Math.floor((now.getTime() - visitDate.getTime()) / (1000 * 60 * 60 * 24)))
    : 999;

  const frequency = customer.visitCount || 0;
  const monetary = customer.totalSpent || 0;

  let segment: CampaignSegment = "POTENTIAL_LOYAL";

  if (frequency <= 1 && recencyDays <= 30) {
    segment = "NEW_CUSTOMERS";
  } else if (monetary >= 50000) {
    segment = "HIGH_SPENDERS";
  } else if (recencyDays <= 30 && frequency >= 5 && monetary >= 25000) {
    segment = "CHAMPIONS";
  } else if (recencyDays <= 45 && frequency >= 3) {
    segment = "LOYAL";
  } else if (recencyDays <= 30 && frequency >= 2) {
    segment = "POTENTIAL_LOYAL";
  } else if (recencyDays > 45 && recencyDays <= 90 && (frequency >= 2 || monetary >= 10000)) {
    segment = "AT_RISK";
  } else if (recencyDays > 90) {
    segment = "HIBERNATING";
  } else if (recencyDays <= 60) {
    segment = "POTENTIAL_LOYAL";
  } else {
    segment = "AT_RISK";
  }

  return {
    recencyDays,
    frequency,
    monetary,
    segment,
  };
}

/**
 * Checks whether a customer matches custom audience criteria
 */
export function matchesCustomFilter(
  customer: {
    lastVisit?: Date | string | null;
    visitCount?: number;
    totalSpent?: number;
    loyaltyTier?: string;
    createdAt?: Date | string;
  },
  filter?: ICampaignCustomFilter,
  now = new Date()
): boolean {
  if (!filter) return true;

  const visitDate = customer.lastVisit
    ? new Date(customer.lastVisit)
    : customer.createdAt
    ? new Date(customer.createdAt)
    : null;

  const recencyDays = visitDate
    ? Math.max(0, Math.floor((now.getTime() - visitDate.getTime()) / (1000 * 60 * 60 * 24)))
    : 999;

  const spend = customer.totalSpent || 0;
  const visits = customer.visitCount || 0;
  const tier = customer.loyaltyTier || "REGULAR";

  if (filter.minSpend !== undefined && spend < filter.minSpend) return false;
  if (filter.maxSpend !== undefined && spend > filter.maxSpend) return false;
  if (filter.minVisits !== undefined && visits < filter.minVisits) return false;
  if (filter.minDaysInactive !== undefined && recencyDays < filter.minDaysInactive) return false;
  if (filter.maxDaysInactive !== undefined && recencyDays > filter.maxDaysInactive) return false;
  if (
    filter.loyaltyTiers &&
    filter.loyaltyTiers.length > 0 &&
    !filter.loyaltyTiers.includes(tier)
  ) {
    return false;
  }

  return true;
}
