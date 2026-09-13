import { z } from "zod";
import { isValidSLPhone } from "@/lib/formatters";

export const createClientBusinessSchema = z.object({
  name: z.string().min(2, "Business name must be at least 2 characters").trim(),
  businessType: z.string().default("Grocery & Retail"),
  ownerName: z.string().min(2, "Owner name must be at least 2 characters").trim(),
  ownerUsername: z
    .string()
    .min(3, "Owner username must be at least 3 characters")
    .max(30, "Username too long")
    .trim()
    .toLowerCase(),
  ownerPassword: z.string().min(4, "Password or PIN must be at least 4 characters"),
  phone: z.string().refine((val) => isValidSLPhone(val), {
    message: "Must be a valid Sri Lankan phone number (e.g. 0771234567 or +94771234567)",
  }),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  address: z.string().max(200, "Address too long").optional().or(z.literal("")),
  plan: z.enum(["TRIAL", "BASIC", "PROFESSIONAL", "ENTERPRISE"]).default("TRIAL"),
  durationDays: z.number().int().min(1).default(14), // Duration in days (e.g. 14 for trial, 30 for 1 month)
});

export const updateSubscriptionSchema = z.object({
  status: z.enum(["TRIAL", "ACTIVE", "EXPIRED", "SUSPENDED", "CANCELLED"]).optional(),
  plan: z.enum(["TRIAL", "BASIC", "PROFESSIONAL", "ENTERPRISE"]).optional(),
  expiryDate: z.string().optional(),
  isActive: z.boolean().optional(),
});

export type CreateClientBusinessInput = z.infer<typeof createClientBusinessSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
