import { z } from "zod";

export const stockAdjustmentSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  type: z.enum(["RESTOCK", "DAMAGE", "RETURN", "ADJUSTMENT"]),
  quantity: z.number().int("Quantity must be a whole number").min(1, "Quantity must be at least 1"),
  reason: z.string().max(200, "Reason too long").optional().or(z.literal("")),
  exactCount: z.number().int().min(0, "Count cannot be negative").optional(), // Used if type === "ADJUSTMENT" with exact target
});

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
