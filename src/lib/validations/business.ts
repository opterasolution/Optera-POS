import { z } from "zod";
import { isValidSLPhone } from "@/lib/formatters";

export const businessSettingsSchema = z.object({
  name: z.string().min(2, "Business name must be at least 2 characters").trim(),
  businessType: z.string().min(2, "Business type is required").trim(),
  ownerName: z.string().min(2, "Owner name must be at least 2 characters").trim(),
  phone: z.string().refine((val) => isValidSLPhone(val), {
    message: "Must be a valid Sri Lankan phone number (e.g. 0771234567 or +94771234567)",
  }),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  currency: z.string().default("LKR"),
  taxSettings: z.object({
    enabled: z.boolean().default(false),
    name: z.string().min(1, "Tax name is required if enabled").default("VAT"),
    rate: z.number().min(0, "Tax rate cannot be negative").max(100, "Tax rate cannot exceed 100%").default(0),
    type: z.enum(["INCLUSIVE", "EXCLUSIVE"]).default("INCLUSIVE"),
    tin: z.string().optional().or(z.literal("")),
    vatNumber: z.string().optional().or(z.literal("")),
    ssclEnabled: z.boolean().default(false),
    ssclRate: z.number().min(0).max(100).default(2.5),
    invoiceNotes: z.string().max(1000).optional().or(z.literal("")),
  }),
  receiptSettings: z.object({
    headerMessage: z.string().max(120, "Header message too long").default("Thank you for shopping with us!"),
    footerMessage: z.string().max(120, "Footer message too long").default("Please come again!"),
    showLogo: z.boolean().default(false),
    defaultWidth: z.enum(["58mm", "80mm"]).default("58mm"),
  }),
  bankDetails: z
    .object({
      bankName: z.string().optional().or(z.literal("")),
      branchName: z.string().optional().or(z.literal("")),
      accountNumber: z.string().optional().or(z.literal("")),
      accountName: z.string().optional().or(z.literal("")),
    })
    .optional(),
  notificationSettings: z
    .object({
      whatsappEnabled: z.boolean().default(true),
      autoPromptWhatsappReceipt: z.boolean().default(true),
      defaultReminderTemplate: z.string().max(500).optional().or(z.literal("")),
    })
    .optional(),
  loyaltySettings: z
    .object({
      enabled: z.boolean().default(true),
      pointsPerSpend: z.number().min(1, "Points spend threshold must be at least 1").default(100),
      redemptionRate: z.number().min(0.01, "Redemption rate must be positive").default(1),
      minPointsToRedeem: z.number().min(0).default(50),
    })
    .optional(),
  securityPolicy: z
    .object({
      requireSupervisorForVoid: z.boolean().default(true),
      requireSupervisorForDiscount: z.boolean().default(true),
      maxCashierDiscountPercent: z.number().min(0).max(100).default(5),
      maxCashierDiscountAmount: z.number().min(0).default(500),
      requireSupervisorForPriceOverride: z.boolean().default(true),
      requireSupervisorForNoSale: z.boolean().default(true),
      requireSupervisorForExpenseDelete: z.boolean().default(true),
    })
    .optional(),
  currencySettings: z
    .object({
      enabled: z.boolean().default(false),
      baseCurrency: z.string().default("LKR"),
      exchangeBufferPercent: z.number().min(-20).max(20).default(2),
      currencies: z
        .array(
          z.object({
            code: z.string().min(2).max(5),
            symbol: z.string().min(1).max(5),
            name: z.string().min(1),
            exchangeRate: z.number().positive("Exchange rate must be positive"),
            isEnabled: z.boolean().default(true),
            isAutoUpdated: z.boolean().default(true),
            marginPercent: z.number().default(0),
            updatedAt: z.union([z.string(), z.date()]).optional(),
          })
        )
        .default([]),
    })
    .optional(),
});

export type BusinessSettingsInput = z.infer<typeof businessSettingsSchema>;
