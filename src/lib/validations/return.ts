import { z } from "zod";

export const returnItemInputSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  name: z.string().min(1, "Product name is required"),
  barcode: z.string().optional().or(z.literal("")),
  quantity: z.number().int("Quantity must be a whole number").min(1, "Quantity must be at least 1"),
  unitPrice: z.number().min(0, "Unit price must be non-negative"),
  condition: z.enum(["RESTOCKABLE", "DAMAGED", "EXPIRED"]),
  reason: z.string().min(1, "Reason is required"),
});

export const createReturnSchema = z.object({
  originalSaleId: z.string().optional().or(z.literal("")),
  originalInvoiceNumber: z.string().optional().or(z.literal("")),
  customerId: z.string().optional().or(z.literal("")),
  customerName: z.string().default("Walk-in Customer"),
  customerPhone: z.string().optional().or(z.literal("")),
  items: z.array(returnItemInputSchema).min(1, "At least one item must be returned"),
  refundMethod: z.enum(["CASH", "CREDIT_NOTE", "CUSTOMER_BALANCE"]),
  registerId: z.string().optional().or(z.literal("")),
  registerName: z.string().optional().or(z.literal("")),
  shiftId: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export type ReturnItemInput = z.infer<typeof returnItemInputSchema>;
export type CreateReturnInput = z.infer<typeof createReturnSchema>;
