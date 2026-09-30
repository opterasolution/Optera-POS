import { z } from "zod";

export const quotationItemSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  quantity: z.number().min(0.001, "Quantity must be greater than 0"),
  unitPrice: z.number().min(0, "Unit price cannot be negative"),
  discount: z.number().min(0, "Discount cannot be negative").default(0),
  priceTier: z.enum(["RETAIL", "WHOLESALE"]).default("RETAIL"),
});

export const createQuotationSchema = z.object({
  customerId: z.string().optional().or(z.literal("")),
  customerName: z.string().min(2, "Customer or business name must be at least 2 characters").trim(),
  customerPhone: z.string().optional().or(z.literal("")),
  customerEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  companyName: z.string().optional().or(z.literal("")),
  tin: z.string().optional().or(z.literal("")),
  vatNumber: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  items: z.array(quotationItemSchema).min(1, "Quotation must have at least one product"),
  discountTotal: z.number().min(0).default(0),
  applySscl: z.boolean().default(false),
  applyVat: z.boolean().default(false),
  validUntil: z.string().optional(),
  notes: z.string().optional().or(z.literal("")),
});

export const updateQuotationSchema = z.object({
  status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED", "CONVERTED", "EXPIRED"]).optional(),
  validUntil: z.string().optional(),
  notes: z.string().optional().or(z.literal("")),
});

export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;
export type UpdateQuotationInput = z.infer<typeof updateQuotationSchema>;
