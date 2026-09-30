import { z } from "zod";
import { isValidSLPhone } from "@/lib/formatters";

export const customerSchema = z.object({
  name: z.string().min(2, "Customer name must be at least 2 characters").trim(),
  phone: z.string().refine((val) => isValidSLPhone(val), {
    message: "Must be a valid Sri Lankan phone number (e.g. 0712345678 or +94712345678)",
  }),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  address: z.string().max(200, "Address too long").optional().or(z.literal("")),
  notes: z.string().max(500, "Notes too long").optional().or(z.literal("")),
  creditAllowed: z.boolean().optional(),
  creditLimit: z.number().min(0, "Credit limit must be non-negative").optional(),
  nicNumber: z.string().max(20, "NIC too long").optional().or(z.literal("")),
});

export type CustomerInput = z.infer<typeof customerSchema>;
