import { z } from "zod";

export const receiptItemInputSchema = z.object({
  name: z.string().min(1, "Item name is required"),
  quantity: z.number().positive("Quantity must be greater than zero"),
  unitPrice: z.number().nonnegative("Unit price cannot be negative"),
});

export const createReceiptSchema = z.object({
  merchantId: z.string().optional(),
  merchantName: z.string().optional(),
  merchantTin: z.string().optional(),
  merchantAddress: z.string().optional(),
  customerName: z.string().optional(),
  customerTin: z.string().optional(),
  customerPhone: z.string().optional(),
  items: z.array(receiptItemInputSchema).min(1, "At least one line item is required"),
  paymentMethod: z.enum(["Cash", "Telebirr", "CBEBirr", "Card", "Bank Transfer"]).default("Cash"),
});

export const voidReceiptSchema = z.object({
  reason: z.string().min(3, "A valid reason is required to void this receipt"),
});

export type CreateReceiptInput = z.infer<typeof createReceiptSchema>;
export type VoidReceiptInput = z.infer<typeof voidReceiptSchema>;
