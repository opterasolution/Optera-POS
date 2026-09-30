/**
 * Sri Lanka POS — Promotions, Discounts & Loyalty Points Calculation Engine
 * Handles BOGO (Buy X Get Y), Bill-Threshold savings, Category deals,
 * Coupon code evaluation, and Customer Loyalty Points accrual/redemption.
 */

export interface CartEvaluationItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  categoryId?: string;
  subtotal?: number;
}

export interface PromotionRule {
  _id?: string;
  name: string;
  code?: string;
  description?: string;
  type: "BILL_THRESHOLD" | "BUY_X_GET_Y" | "CATEGORY_DISCOUNT" | "PRODUCT_DISCOUNT";
  discountType: "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_ITEM";
  discountValue: number;
  minSpend?: number;
  buyProductId?: string;
  buyQuantity?: number;
  getProductId?: string;
  getQuantity?: number;
  applicableCategories?: string[];
  applicableProducts?: string[];
  startDate: string | Date;
  endDate: string | Date;
  isActive: boolean;
  usageCount?: number;
  usageLimit?: number;
}

export interface AppliedPromotion {
  promoId?: string;
  name: string;
  code?: string;
  discountAmount: number;
  type: string;
}

export interface PromotionEvaluationResult {
  appliedPromotions: AppliedPromotion[];
  totalPromoDiscount: number;
  adjustedSubtotal: number;
}

/**
 * Evaluates active promotions against a current POS cart
 */
export function evaluatePromotions(
  cartItems: CartEvaluationItem[],
  subtotal: number,
  promotions: PromotionRule[],
  couponCode?: string
): PromotionEvaluationResult {
  if (!promotions || promotions.length === 0 || cartItems.length === 0) {
    return { appliedPromotions: [], totalPromoDiscount: 0, adjustedSubtotal: subtotal };
  }

  const now = new Date();
  const appliedPromotions: AppliedPromotion[] = [];
  let totalPromoDiscount = 0;

  // Filter active, unexpired promotions under their usage limit
  const eligiblePromos = promotions.filter((p) => {
    if (!p.isActive) return false;
    const start = new Date(p.startDate);
    const end = new Date(p.endDate);
    if (now < start || now > end) return false;
    if (p.usageLimit && (p.usageCount || 0) >= p.usageLimit) return false;

    // If promo has a coupon code, only apply if code matches user input
    if (p.code && p.code.trim()) {
      if (!couponCode) return false;
      return p.code.trim().toUpperCase() === couponCode.trim().toUpperCase();
    }

    return true; // Auto-applicable promo without coupon code
  });

  for (const promo of eligiblePromos) {
    let promoDiscount = 0;

    switch (promo.type) {
      case "BILL_THRESHOLD": {
        const threshold = promo.minSpend || 0;
        if (subtotal >= threshold && subtotal > 0) {
          if (promo.discountType === "PERCENTAGE") {
            promoDiscount = (subtotal * promo.discountValue) / 100;
          } else {
            promoDiscount = Math.min(subtotal, promo.discountValue);
          }
        }
        break;
      }

      case "BUY_X_GET_Y": {
        const buyId = promo.buyProductId?.toString();
        const getId = promo.getProductId ? promo.getProductId.toString() : buyId;
        const buyQtyReq = promo.buyQuantity || 1;
        const getQtyReward = promo.getQuantity || 1;

        if (buyId) {
          const buyItem = cartItems.find((i) => i.productId.toString() === buyId);
          if (buyItem && buyItem.quantity >= buyQtyReq) {
            const qualifyingSets = Math.floor(buyItem.quantity / buyQtyReq);
            const targetItem = cartItems.find((i) => i.productId.toString() === getId);

            if (targetItem) {
              // Eligible free or discounted units is capped by what is in the cart
              const eligibleUnits = Math.min(targetItem.quantity, qualifyingSets * getQtyReward);
              const rate = promo.discountType === "PERCENTAGE" ? promo.discountValue / 100 : 1;
              promoDiscount = eligibleUnits * targetItem.unitPrice * rate;
            }
          }
        }
        break;
      }

      case "CATEGORY_DISCOUNT": {
        if (promo.applicableCategories && promo.applicableCategories.length > 0) {
          const catSet = new Set(promo.applicableCategories.map((c) => c.toString()));
          let qualifyingCatSubtotal = 0;

          for (const item of cartItems) {
            if (item.categoryId && catSet.has(item.categoryId.toString())) {
              qualifyingCatSubtotal += item.unitPrice * item.quantity;
            }
          }

          if (qualifyingCatSubtotal > 0 && qualifyingCatSubtotal >= (promo.minSpend || 0)) {
            if (promo.discountType === "PERCENTAGE") {
              promoDiscount = (qualifyingCatSubtotal * promo.discountValue) / 100;
            } else {
              promoDiscount = Math.min(qualifyingCatSubtotal, promo.discountValue);
            }
          }
        }
        break;
      }

      case "PRODUCT_DISCOUNT": {
        if (promo.applicableProducts && promo.applicableProducts.length > 0) {
          const prodSet = new Set(promo.applicableProducts.map((p) => p.toString()));
          let qualifyingProdSubtotal = 0;

          for (const item of cartItems) {
            if (prodSet.has(item.productId.toString())) {
              qualifyingProdSubtotal += item.unitPrice * item.quantity;
            }
          }

          if (qualifyingProdSubtotal > 0 && qualifyingProdSubtotal >= (promo.minSpend || 0)) {
            if (promo.discountType === "PERCENTAGE") {
              promoDiscount = (qualifyingProdSubtotal * promo.discountValue) / 100;
            } else {
              promoDiscount = Math.min(qualifyingProdSubtotal, promo.discountValue);
            }
          }
        }
        break;
      }
    }

    if (promoDiscount > 0) {
      // Round to 2 decimal places
      const finalDiscount = Math.round(promoDiscount * 100) / 100;
      totalPromoDiscount += finalDiscount;
      appliedPromotions.push({
        promoId: promo._id,
        name: promo.name,
        code: promo.code,
        discountAmount: finalDiscount,
        type: promo.type,
      });
    }
  }

  // Ensure total promo discount never exceeds the bill subtotal
  totalPromoDiscount = Math.min(subtotal, Math.round(totalPromoDiscount * 100) / 100);
  const adjustedSubtotal = Math.max(0, subtotal - totalPromoDiscount);

  return {
    appliedPromotions,
    totalPromoDiscount,
    adjustedSubtotal,
  };
}

export interface LoyaltySettingsConfig {
  enabled?: boolean;
  pointsPerSpend?: number; // e.g. 100 -> 1 pt per Rs. 100 spent
  redemptionRate?: number; // e.g. 1.00 -> 1 pt = Rs. 1.00
  minPointsToRedeem?: number; // e.g. 50
}

/**
 * Calculates customer loyalty points earned on a purchase
 */
export function calculateLoyaltyPointsEarned(
  netTotal: number,
  settings?: LoyaltySettingsConfig
): number {
  if (!settings || settings.enabled === false) return 0;
  const spendThreshold = settings.pointsPerSpend && settings.pointsPerSpend > 0 ? settings.pointsPerSpend : 100;
  if (netTotal <= 0) return 0;
  return Math.floor(netTotal / spendThreshold);
}

/**
 * Validates and calculates discount value when redeeming loyalty points
 */
export function calculateLoyaltyRedemptionDiscount(
  pointsToRedeem: number,
  currentPoints: number,
  billNetTotal: number,
  settings?: LoyaltySettingsConfig
): { eligible: boolean; discountAmount: number; error?: string } {
  if (!settings || settings.enabled === false) {
    return { eligible: false, discountAmount: 0, error: "Loyalty program is not enabled." };
  }

  if (pointsToRedeem <= 0) {
    return { eligible: true, discountAmount: 0 };
  }

  const minPoints = settings.minPointsToRedeem || 50;
  if (currentPoints < minPoints) {
    return {
      eligible: false,
      discountAmount: 0,
      error: `Minimum ${minPoints} loyalty points required to redeem rewards (Customer has ${currentPoints} pts).`,
    };
  }

  if (pointsToRedeem > currentPoints) {
    return {
      eligible: false,
      discountAmount: 0,
      error: `Cannot redeem ${pointsToRedeem} points. Customer only has ${currentPoints} points available.`,
    };
  }

  const rate = settings.redemptionRate && settings.redemptionRate > 0 ? settings.redemptionRate : 1;
  const grossDiscount = pointsToRedeem * rate;
  // Cannot discount more than the current bill
  const finalDiscount = Math.min(billNetTotal, Math.round(grossDiscount * 100) / 100);

  return {
    eligible: true,
    discountAmount: finalDiscount,
  };
}
