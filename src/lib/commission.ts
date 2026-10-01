import { Types } from "mongoose";
import { ICommissionRule } from "@/models/CommissionRule";

export interface ItemForCommission {
  productId: Types.ObjectId | string;
  categoryId?: Types.ObjectId | string;
  categoryName?: string;
  total: number;
}

export interface CommissionCalculationParams {
  saleTotal: number;
  items: ItemForCommission[];
  staffUserId?: string | Types.ObjectId;
  staffRole?: string;
  staffCustomRate?: number;
  activeRules: any[];
  monthToDateSales?: number;
}

export interface CommissionResult {
  commissionAmount: number;
  ruleId?: Types.ObjectId;
  ruleName?: string;
  rateApplied: number;
}

export function calculateSaleCommission({
  saleTotal,
  items,
  staffUserId,
  staffRole = "CASHIER",
  staffCustomRate = 0,
  activeRules = [],
  monthToDateSales = 0,
}: CommissionCalculationParams): CommissionResult {
  if (saleTotal <= 0) {
    return { commissionAmount: 0, rateApplied: 0 };
  }

  // 1. Find the highest priority matching active rule
  // Specific user matching takes precedence over role matching
  let matchedRule: ICommissionRule | undefined = undefined;

  if (staffUserId) {
    const userStr = staffUserId.toString();
    matchedRule = activeRules.find(
      (r) =>
        r.isActive &&
        r.applicableUsers &&
        r.applicableUsers.some((u: any) => u.toString() === userStr)
    );
  }

  if (!matchedRule) {
    matchedRule = activeRules.find(
      (r) => r.isActive && r.applicableRoles && r.applicableRoles.includes(staffRole)
    );
  }

  // 2. If no rule matched, check if staff member has an individual flat rate
  if (!matchedRule) {
    if (staffCustomRate && staffCustomRate > 0) {
      const amount = Math.round((saleTotal * (staffCustomRate / 100)) * 100) / 100;
      return {
        commissionAmount: amount,
        rateApplied: staffCustomRate,
        ruleName: "Staff Custom Rate",
      };
    }
    return { commissionAmount: 0, rateApplied: 0 };
  }

  // 3. Check minimum threshold requirement
  if (matchedRule.minSaleAmount && saleTotal < matchedRule.minSaleAmount) {
    return {
      commissionAmount: 0,
      ruleId: matchedRule._id as Types.ObjectId,
      ruleName: matchedRule.name,
      rateApplied: 0,
    };
  }

  // 4. Calculate based on rule type
  if (matchedRule.type === "CATEGORY_BASED" && matchedRule.categoryRates?.length > 0) {
    const categoryRateMap = new Map<string, number>();
    for (const cr of matchedRule.categoryRates) {
      categoryRateMap.set(cr.categoryId.toString(), cr.rate);
      if (cr.categoryName) {
        categoryRateMap.set(cr.categoryName.toLowerCase(), cr.rate);
      }
    }

    let calculatedCommission = 0;
    for (const item of items) {
      const itemCatId = item.categoryId ? item.categoryId.toString() : "";
      const itemCatName = item.categoryName ? item.categoryName.toLowerCase() : "";

      const rate =
        categoryRateMap.get(itemCatId) ??
        categoryRateMap.get(itemCatName) ??
        matchedRule.defaultRate;

      calculatedCommission += item.total * (rate / 100);
    }

    const finalAmount = Math.round(calculatedCommission * 100) / 100;
    const effectiveRate = saleTotal > 0 ? Math.round((finalAmount / saleTotal) * 1000) / 10 : matchedRule.defaultRate;

    return {
      commissionAmount: finalAmount,
      ruleId: matchedRule._id as Types.ObjectId,
      ruleName: matchedRule.name,
      rateApplied: effectiveRate,
    };
  }

  if (matchedRule.type === "TIERED_VOLUME" && matchedRule.volumeTiers?.length > 0) {
    const cumulativeSales = monthToDateSales + saleTotal;
    // Find tier matching cumulative sales
    const matchingTier = matchedRule.volumeTiers.find((tier) => {
      const minOk = cumulativeSales >= tier.minSales;
      const maxOk = tier.maxSales === undefined || tier.maxSales === null || cumulativeSales <= tier.maxSales;
      return minOk && maxOk;
    });

    const tierRate = matchingTier ? matchingTier.rate : matchedRule.defaultRate;
    const finalAmount = Math.round((saleTotal * (tierRate / 100)) * 100) / 100;

    return {
      commissionAmount: finalAmount,
      ruleId: matchedRule._id as Types.ObjectId,
      ruleName: matchedRule.name,
      rateApplied: tierRate,
    };
  }

  // Default: FLAT_PERCENT
  const rate = matchedRule.defaultRate || 0;
  const finalAmount = Math.round((saleTotal * (rate / 100)) * 100) / 100;

  return {
    commissionAmount: finalAmount,
    ruleId: matchedRule._id as Types.ObjectId,
    ruleName: matchedRule.name,
    rateApplied: rate,
  };
}
