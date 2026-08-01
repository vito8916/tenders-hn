import { z } from "zod";
import { InviteRoleSchema } from "@/features/invitations/schemas";

export const onboardingProfileSchema = z.object({
    fullName: z.string().min(1, "Name is required").max(100).trim(),
    phone: z
        .string()
        .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format")
        .optional()
        .or(z.literal("")),
    email: z.string().email("Email is required"),
});

export const onboardingThemeSchema = z.enum(["light", "dark", "system"]);

export const onboardingOrganizationSchema = z.object({
    name: z.string().min(2, "Organization name is too short").max(100).trim(),
    slug: z
        .string()
        .min(2, "Slug is too short")
        .max(50, "Slug is too long")
        .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and dashes"),
});

export const onboardingInviteSchema = z.object({
    email: z.string().email("Enter a valid email address").or(z.literal("")),
    role: InviteRoleSchema,
});

export const onboardingInvitesSchema = z
    .array(onboardingInviteSchema)
    .max(10, "Maximum 10 invitations allowed");

export type OnboardingProfile = z.infer<typeof onboardingProfileSchema>;
export type OnboardingTheme = z.infer<typeof onboardingThemeSchema>;
export type OnboardingOrganization = z.infer<typeof onboardingOrganizationSchema>;
export type OnboardingInvite = z.infer<typeof onboardingInviteSchema>;
