import { z } from "zod";

export const merchantLoginSchema = z.object({
  tin: z
    .string()
    .length(10, { message: "TIN must be exactly 10 digits" })
    .regex(/^\d+$/, { message: "TIN must contain only numbers" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  rememberMe: z.boolean().optional(),
});

export const officerLoginSchema = z.object({
  username: z.string().min(3, { message: "Username must be at least 3 characters" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  rememberOfficer: z.boolean().optional(),
});

export const merchantPasswordResetRequestSchema = z.object({
  email: z.string().email("A valid email address is required."),
});

export const merchantPasswordResetSchema = z.object({
  email: z.string().email("A valid email address is required."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long.")
    .max(128, "Password must not exceed 128 characters."),
});

export type MerchantLoginInput = z.infer<typeof merchantLoginSchema>;
export type OfficerLoginInput = z.infer<typeof officerLoginSchema>;
export type MerchantPasswordResetRequestInput = z.infer<
  typeof merchantPasswordResetRequestSchema
>;
export type MerchantPasswordResetInput = z.infer<
  typeof merchantPasswordResetSchema
>;
