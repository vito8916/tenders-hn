import { z } from "zod";

/**
 * Schemas for authentication-related forms.
 */
export const signInSchema = z.object({
    email: z.string().email("Please enter a valid email address").trim().toLowerCase(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .max(100, "Password is too long"),
  })

export const signUpSchema = z.object({
    fullName: z.string().min(1, "Full name is required").trim().toLowerCase(),
    email: z.string().email("Please enter a valid email address").trim().toLowerCase(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .max(20, "Password is too long"),
  })

export const resendConfirmationEmailSchema = z.object({
    email: z.string().email("Please enter a valid email address").trim().toLowerCase(),
  });

export const forgotPasswordSchema = z.object({
    email: z.string().email("Please enter a valid email address").trim().toLowerCase(),
  });

export const updatePasswordSchema = z.object({
    password: z.string().min(8, "Password must be at least 8 characters long").max(20, "Password is too long"),
    confirmPassword: z.string().min(8, "Password must be at least 8 characters long").max(20, "Password is too long"),
  });

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters long").max(20, "Password is too long"),
    confirmPassword: z.string().min(8, "Password must be at least 8 characters long").max(20, "Password is too long"),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignInFormValues = z.infer<typeof signInSchema>
export type SignUpFormValues = z.infer<typeof signUpSchema>
export type ResendConfirmationEmailFormValues = z.infer<typeof resendConfirmationEmailSchema>
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>
export type UpdatePasswordFormValues = z.infer<typeof updatePasswordSchema>
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>
