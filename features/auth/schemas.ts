import { z } from "zod";

/**
 * Schemas for authentication-related forms.
 */
const INVALID_EMAIL_MESSAGE = "Ingrese un correo electrónico válido";
const PASSWORD_TOO_SHORT_MESSAGE = "La contraseña debe tener al menos 8 caracteres";
const PASSWORD_TOO_LONG_MESSAGE = "La contraseña es demasiado larga";

export const signInSchema = z.object({
    email: z.string().email(INVALID_EMAIL_MESSAGE).trim().toLowerCase(),
    password: z
      .string()
      .min(8, PASSWORD_TOO_SHORT_MESSAGE)
      .max(100, PASSWORD_TOO_LONG_MESSAGE),
  })

export const signUpSchema = z.object({
    fullName: z.string().min(1, "Ingrese su nombre completo").trim(),
    email: z.string().email(INVALID_EMAIL_MESSAGE).trim().toLowerCase(),
    password: z
      .string()
      .min(8, PASSWORD_TOO_SHORT_MESSAGE)
      .max(20, PASSWORD_TOO_LONG_MESSAGE),
  })

export const resendConfirmationEmailSchema = z.object({
    email: z.string().email(INVALID_EMAIL_MESSAGE).trim().toLowerCase(),
  });

export const verifyEmailSchema = z.object({
    email: z.string().email(INVALID_EMAIL_MESSAGE).trim().toLowerCase(),
    token: z.string().trim().regex(/^\d{6}$/, "Ingrese el código de 6 dígitos del correo"),
  });

export const forgotPasswordSchema = z.object({
    email: z.string().email(INVALID_EMAIL_MESSAGE).trim().toLowerCase(),
  });

export const updatePasswordSchema = z.object({
    password: z.string().min(8, PASSWORD_TOO_SHORT_MESSAGE).max(20, PASSWORD_TOO_LONG_MESSAGE),
    confirmPassword: z.string().min(8, PASSWORD_TOO_SHORT_MESSAGE).max(20, PASSWORD_TOO_LONG_MESSAGE),
  });

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, "Ingrese su contraseña actual"),
    newPassword: z.string().min(8, PASSWORD_TOO_SHORT_MESSAGE).max(20, PASSWORD_TOO_LONG_MESSAGE),
    confirmPassword: z.string().min(8, PASSWORD_TOO_SHORT_MESSAGE).max(20, PASSWORD_TOO_LONG_MESSAGE),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export type SignInFormValues = z.infer<typeof signInSchema>
export type SignUpFormValues = z.infer<typeof signUpSchema>
export type ResendConfirmationEmailFormValues = z.infer<typeof resendConfirmationEmailSchema>
export type VerifyEmailFormValues = z.infer<typeof verifyEmailSchema>
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>
export type UpdatePasswordFormValues = z.infer<typeof updatePasswordSchema>
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>
