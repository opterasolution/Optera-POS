import { z } from "zod";

export const expenseCategoryEnum = z.enum([
  "UTILITIES",
  "STAFF_MEALS",
  "PACKAGING",
  "TRANSPORT",
  "MAINTENANCE",
  "RENT",
  "MUNICIPAL_TAX",
  "SALARY_ADVANCE",
  "OTHER",
]);

export const expensePaymentMethodEnum = z.enum([
  "CASH",
  "BANK_TRANSFER",
  "CARD",
  "PETTY_CASH",
]);

export const expensePaidFromEnum = z.enum([
  "REGISTER_DRAWER",
  "STORE_PETTY_CASH",
  "BANK_ACCOUNT",
]);

export const createExpenseSchema = z.object({
  title: z.string().min(1, "Expense title is required"),
  category: expenseCategoryEnum,
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  paymentMethod: expensePaymentMethodEnum.default("CASH"),
  paidFrom: expensePaidFromEnum.default("STORE_PETTY_CASH"),
  shiftId: z.string().optional().or(z.literal("")),
  registerId: z.string().optional().or(z.literal("")),
  registerName: z.string().optional().or(z.literal("")),
  payee: z.string().optional().or(z.literal("")),
  receiptNumber: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  date: z.string().optional().or(z.literal("")),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
