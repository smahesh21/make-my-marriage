import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(120),
  email: z.string().trim().email("Enter a valid email address.").max(254),
  password: z.string().min(8, "Password must be at least 8 characters.").max(72),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(254),
  password: z.string().min(1, "Enter your password.").max(72),
  rememberDevice: z.boolean().default(true),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(254),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Your password reset link is missing or invalid."),
  password: z.string().min(8, "Password must be at least 8 characters.").max(72),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
