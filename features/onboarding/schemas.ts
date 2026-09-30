import { z } from "zod";
import { InviteRoleSchema } from "@/features/invitations/schemas";

export const onboardingProfileSchema = z.object({
    fullName: z
        .string()
        .min(1, "Ingrese su nombre")
        .max(100, "El nombre no puede tener más de 100 caracteres")
        .trim(),
    phone: z
        .string()
        .regex(/^\+?[1-9]\d{1,14}$/, "Ingrese un número de teléfono válido, por ejemplo +50499998888")
        .optional()
        .or(z.literal("")),
    email: z.string().email("Ingrese un correo electrónico válido"),
});

export const onboardingThemeSchema = z.enum(["light", "dark", "system"], "Seleccione un tema");

export const onboardingOrganizationSchema = z.object({
    name: z
        .string()
        .min(2, "El nombre de la organización debe tener al menos 2 caracteres")
        .max(100, "El nombre de la organización no puede tener más de 100 caracteres")
        .trim(),
    slug: z
        .string()
        .min(2, "El identificador en la URL debe tener al menos 2 caracteres")
        .max(50, "El identificador en la URL no puede tener más de 50 caracteres")
        .regex(/^[a-z0-9-]+$/, "Use solo letras minúsculas, números y guiones"),
});

export const onboardingInviteSchema = z.object({
    email: z.string().email("Ingrese un correo electrónico válido").or(z.literal("")),
    role: InviteRoleSchema,
});

export const onboardingInvitesSchema = z
    .array(onboardingInviteSchema)
    .max(10, "Puede enviar hasta 10 invitaciones a la vez");

export type OnboardingProfile = z.infer<typeof onboardingProfileSchema>;
export type OnboardingTheme = z.infer<typeof onboardingThemeSchema>;
export type OnboardingOrganization = z.infer<typeof onboardingOrganizationSchema>;
export type OnboardingInvite = z.infer<typeof onboardingInviteSchema>;
