import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().min(2, "Category name must be at least 2 characters").trim(),
  description: z.string().optional().or(z.literal("")),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color (e.g. #3b82f6)").default("#3b82f6"),
});

export const productSchema = z.object({
  name: z.string().min(2, "Product name must be at least 2 characters").trim(),
  categoryId: z.string().optional().or(z.literal("")),
  sku: z.string().optional().or(z.literal("")),
  barcode: z.string().optional().or(z.literal("")),
  costPrice: z.number().min(0, "Cost price cannot be negative").default(0),
  sellingPrice: z.number().min(0, "Selling price cannot be negative"),
  wholesalePrice: z.number().min(0, "Wholesale price cannot be negative").optional(),
  wholesaleMinQty: z.number().int().min(1, "Minimum wholesale quantity must be at least 1").default(1).optional(),
  stockQuantity: z.number().min(0, "Stock quantity cannot be negative").default(0),
  lowStockThreshold: z.number().min(0).default(5),
  unit: z.string().default("pcs"),
  pluCode: z.string().optional().or(z.literal("")),
  isWeighable: z.boolean().default(false),
  tareWeightGrams: z.number().min(0).default(0).optional(),
  isActive: z.boolean().default(true),
});

export type CategoryInput = z.infer<typeof categorySchema>;
export type ProductInput = z.infer<typeof productSchema>;
