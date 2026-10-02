import { z } from "zod";

export const saleItemInputSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  quantity: z.number().min(0.001, "Quantity must be greater than 0"),
  discount: z.number().min(0).default(0),
  priceTier: z.enum(["RETAIL", "WHOLESALE"]).default("RETAIL").optional(),
  batchId: z.string().optional().or(z.literal("")),
});

export const createSaleSchema = z.object({
  items: z.array(saleItemInputSchema).min(1, "At least one product is required in the cart"),
  customerId: z.string().optional().or(z.literal("")),
  customerName: z.string().default("Walk-in Customer"),
  customerPhone: z.string().optional().or(z.literal("")),
  discountTotal: z.number().min(0, "Discount cannot be negative").default(0),
  paymentMethod: z.enum(["CASH", "CARD", "QR", "BANK_TRANSFER", "CREDIT", "CREDIT_NOTE", "GIFT_VOUCHER", "OTHER"]),
  cashReceived: z.number().min(0).optional(),
  changeGiven: z.number().min(0).optional(),
  paymentReference: z.string().optional().or(z.literal("")),
  creditNoteNumber: z.string().optional().or(z.literal("")),
  giftVoucherCode: z.string().optional().or(z.literal("")),
  giftVoucherAmount: z.number().min(0).optional(),
  registerId: z.string().optional().or(z.literal("")),
  registerName: z.string().optional().or(z.literal("")),
  shiftId: z.string().optional().or(z.literal("")),
  pointsRedeemed: z.number().min(0).default(0),
  loyaltyDiscount: z.number().min(0).default(0),
  appliedPromotions: z
    .array(
      z.object({
        promoId: z.string().optional().or(z.literal("")),
        name: z.string(),
        code: z.string().optional().or(z.literal("")),
        discountAmount: z.number().min(0),
      })
    )
    .optional(),
  billingType: z.enum(["RETAIL", "WHOLESALE"]).default("RETAIL").optional(),
  isTaxInvoice: z.boolean().default(false).optional(),
  buyerDetails: z
    .object({
      companyName: z.string().optional().or(z.literal("")),
      tin: z.string().optional().or(z.literal("")),
      vatNumber: z.string().optional().or(z.literal("")),
      address: z.string().optional().or(z.literal("")),
      phone: z.string().optional().or(z.literal("")),
    })
    .optional(),
  quotationId: z.string().optional().or(z.literal("")),
  dueDate: z.string().optional(),
  tenderCurrency: z.string().default("LKR").optional(),
  exchangeRate: z.number().positive().default(1).optional(),
  foreignAmount: z.number().min(0).optional(),
  foreignCashReceived: z.number().min(0).optional(),
  foreignChangeGiven: z.number().min(0).optional(),
  foreignCurrencySymbol: z.string().optional(),
  salesRepId: z.string().optional().or(z.literal("")),
  salesRepName: z.string().optional().or(z.literal("")),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
