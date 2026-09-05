import { z } from "zod";

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
  businessType: z.string().default("Grocery"),
  ownerName: z.string().min(2, "Owner name is required").trim(),
  phone: z.string().min(9, "Valid Sri Lankan phone number required").trim(),
  username: z.string().min(3, "Username must be at least 3 characters").trim().toLowerCase(),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterBusinessInput = z.infer<typeof registerBusinessSchema>;
