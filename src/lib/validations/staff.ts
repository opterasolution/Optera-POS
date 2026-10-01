import { z } from "zod";

export const createStaffSchema = z.object({
  name: z.string().min(2, "Staff member name must be at least 2 characters").trim(),
  username: z
    .string()
    .min(3, "Username / Cashier ID must be at least 3 characters")
    .max(30, "Username too long")
    .trim()
    .toLowerCase(),
  password: z.string().min(4, "Password must be at least 4 characters"),
  role: z.enum([
    "OWNER",
    "MANAGER",
    "SUPERVISOR",
    "INVENTORY_CLERK",
    "ACCOUNTANT",
    "CASHIER",
    "SALES_REP",
  ]),
  phone: z.string().optional().or(z.literal("")),
  supervisorPin: z
    .string()
    .regex(/^\d{4,6}$/, "Supervisor PIN must be 4 to 6 digits")
    .optional()
    .or(z.literal("")),
  commissionRate: z.number().min(0).max(100).optional(),
  monthlyTargetAmount: z.number().min(0).optional(),
});

export const updateStaffSchema = z.object({
  name: z.string().min(2).optional(),
  password: z.string().min(4).optional().or(z.literal("")),
  role: z
    .enum([
      "OWNER",
      "MANAGER",
      "SUPERVISOR",
      "INVENTORY_CLERK",
      "ACCOUNTANT",
      "CASHIER",
      "SALES_REP",
    ])
    .optional(),
  phone: z.string().optional().or(z.literal("")),
  supervisorPin: z
    .string()
    .regex(/^\d{4,6}$/, "Supervisor PIN must be 4 to 6 digits")
    .optional()
    .or(z.literal("")),
  commissionRate: z.number().min(0).max(100).optional(),
  monthlyTargetAmount: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
