import { z } from "zod";

/**
 * Core Profile schema representing user profile data
 */
export const profileSchema = z.object({
    id: z.string().uuid(),
    fullName: z.string().nullable(),
    avatarUrl: z.string().nullable().or(z.literal("")),
    bio: z.string().nullable(),
    email: z.string().email().nullable(),
    phone: z.string().nullable(),
    status: z.string().nullable(),
    stripeCustomerId: z.string().nullable(),
    stripeSubscriptionId: z.string().nullable(),
    onboardingCompletedAt: z.coerce.date().nullable(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
});

/**
 * Lightweight profile schema for list views or minimal data display
 */
export const profileSummarySchema = z.object({
    id: z.string().uuid(),
    fullName: z.string().nullable(),
    avatarUrl: z.string().nullable().or(z.literal("")),
    email: z.string().email().nullable(),
});

/**
 * Auth user claims schema from Supabase JWT
 */
export const authUserSchema = z.object({
    sub: z.string().uuid(),
    email: z.string().email().optional(),
    role: z.string().optional(),
    aud: z.string().optional(),
});

/**
 * Combined user + profile schema for authenticated contexts
 */
export const userWithProfileSchema = z.object({
    user: authUserSchema,
    profile: profileSchema,
});

/**
 * Schema for updating user profile information
 */
export const updateProfileInputSchema = z.object({
    fullName: z.string().min(1, "Full name is required").max(100).trim().optional(),
    bio: z.string().max(500, "Bio must be 500 characters or less").trim().optional(),
    phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format").optional(),
    avatarUrl: z.string().min(1).optional(),
});

/**
 * Schema for creating a new profile (typically handled by trigger)
 */
export const createProfileInputSchema = z.object({
    id: z.string().uuid(),
    fullName: z.string().min(1).max(100).trim().nullable().optional(),
    email: z.string().email(),
    avatarUrl: z.string().url().nullable().optional(),
});

export type Profile = z.infer<typeof profileSchema>;
export type ProfileSummary = z.infer<typeof profileSummarySchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type UserWithProfile = z.infer<typeof userWithProfileSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileInputSchema>;
export type CreateProfileInput = z.infer<typeof createProfileInputSchema>;
