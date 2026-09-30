import { z } from "zod";

const PASSWORD_TOO_SHORT_MESSAGE = "La contraseña debe tener al menos 8 caracteres";
const PASSWORD_TOO_LONG_MESSAGE = "La contraseña es demasiado larga";

export const passwordFormSchema = z.object({
  password: z.string().min(8, PASSWORD_TOO_SHORT_MESSAGE).max(20, PASSWORD_TOO_LONG_MESSAGE),
  confirmPassword: z.string().min(8, PASSWORD_TOO_SHORT_MESSAGE).max(20, PASSWORD_TOO_LONG_MESSAGE),
});

export const profileSchema = z.object({
  fullName: z.string().min(1, "Ingrese su nombre").max(100, "El nombre es demasiado largo"),
  email: z.string().email("Ingrese un correo electrónico válido"),
  bio: z.string().max(500, "La biografía es demasiado larga").optional(),
});

export type PasswordFormValues = z.infer<typeof passwordFormSchema>;
export type ProfileFormValues = z.infer<typeof profileSchema>;
