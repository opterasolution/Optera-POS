import { z } from "zod";

export const createPromotionSchema = z.object({
  name: z.string().min(2, "Promotion name must be at least 2 characters").trim(),
  code: z.string().trim().toUpperCase().optional().or(z.literal("")),
  description: z.string().trim().optional().or(z.literal("")),
  type: z.enum(["BILL_THRESHOLD", "BUY_X_GET_Y", "CATEGORY_DISCOUNT", "PRODUCT_DISCOUNT"]),
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "FREE_ITEM"]),
  discountValue: z.number().min(0, "Discount value must be at least 0"),
  minSpend: z.number().min(0).default(0),
  buyProductId: z.string().optional().or(z.literal("")),
  buyQuantity: z.number().min(1).default(1),
  getProductId: z.string().optional().or(z.literal("")),
  getQuantity: z.number().min(1).default(1),
  applicableCategories: z.array(z.string()).optional(),
  applicableProducts: z.array(z.string()).optional(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  isActive: z.boolean().default(true),
  usageLimit: z.number().min(1).optional(),
});

export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;
