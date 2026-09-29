import { z } from "zod";
import { isValidSLPhone } from "@/lib/formatters";

export const loginSchema = z.object({
  username: z
    .string()
    .min(3, "Username or phone must be at least 3 characters")
    .max(50, "Username too long")
    .trim(),
  password: z
    .string()
    .min(4, "Password or PIN must be at least 4 characters"),
});

export const registerBusinessSchema = z.object({
  businessName: z.string().min(2, "Business name is required").trim(),
  businessType: z.string().trim().default("Grocery & Retail"),
  catalogPreset: z
    .enum(["GROCERY", "BAKERY", "PHARMACY", "APPAREL", "HARDWARE", "BLANK"])
    .default("GROCERY"),
  ownerName: z.string().min(2, "Owner name is required").trim(),
  phone: z.string().refine((val) => isValidSLPhone(val), {
    message: "Must be a valid Sri Lankan phone number (e.g. 0771234567 or +94771234567)",
  }),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username cannot exceed 30 characters")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Username can only contain letters, numbers, underscores, and dots")
    .trim()
    .toLowerCase(),
  password: z.string().min(4, "Password must be at least 4 characters"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterBusinessInput = z.infer<typeof registerBusinessSchema>;
