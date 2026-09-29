import { z } from "zod";

export const saleItemInputSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  quantity: z.number().int("Quantity must be a whole number").min(1, "Quantity must be at least 1"),
  discount: z.number().min(0).default(0),
});

export const createSaleSchema = z.object({
  items: z.array(saleItemInputSchema).min(1, "At least one product is required in the cart"),
  customerName: z.string().default("Walk-in Customer"),
  customerPhone: z.string().optional().or(z.literal("")),
  discountTotal: z.number().min(0, "Discount cannot be negative").default(0),
  paymentMethod: z.enum(["CASH", "CARD", "QR", "BANK_TRANSFER", "OTHER"]),
  cashReceived: z.number().min(0).optional(),
  changeGiven: z.number().min(0).optional(),
  paymentReference: z.string().optional().or(z.literal("")),
  registerId: z.string().optional().or(z.literal("")),
  registerName: z.string().optional().or(z.literal("")),
  shiftId: z.string().optional().or(z.literal("")),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
