import { z } from "zod";

export const passwordFormSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters long").max(20, "Password is too long"),
  confirmPassword: z.string().min(8, "Password must be at least 8 characters long").max(20, "Password is too long"),
});

export const profileSchema = z.object({
  fullName: z.string().min(1, "Name is required").max(100, "Name is too long"),
  email: z.string().email("Invalid email address"),
  bio: z.string().max(500, "Bio is too long").optional(),
});

export type PasswordFormValues = z.infer<typeof passwordFormSchema>;
export type ProfileFormValues = z.infer<typeof profileSchema>;
