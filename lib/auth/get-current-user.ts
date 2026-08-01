import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getProfileService } from "@/features/profiles/services";
import { authUserSchema, type AuthUser, type UserWithProfile } from "@/features/profiles/schemas";

/**
 * Gets the current authenticated user from Supabase JWT claims
 * Uses React cache for request deduplication
 *
 * @returns AuthUser object with validated claims
 * @throws Error if not authenticated or if token is invalid
 */
export const getCurrentUser = cache(async (): Promise<AuthUser> => {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();

    if (error) {
        throw new Error(`Authentication error: ${error.message}`);
    }

    const claims = data?.claims;

    if (!claims || !claims.sub) {
        throw new Error("Not authenticated");
    }

    // Validate and type the user claims
    return authUserSchema.parse({
        sub: claims.sub,
        email: claims.email,
        role: claims.role,
        aud: claims.aud,
    });
});

/**
 * Gets the current authenticated user along with their profile
 * Uses React cache for request deduplication
 * Profile includes signed URLs for avatar images
 *
 * @returns UserWithProfile object containing both auth claims and profile data with signed URLs
 * @throws Error if not authenticated or if profile fetch fails
 */
export const getCurrentUserWithProfile = cache(async (): Promise<UserWithProfile> => {
    const user = await getCurrentUser();

    const profile = await getProfileService({ userId: user.sub });

    if (!profile) {
        throw new Error("Profile not found for authenticated user");
    }

    return {
        user,
        profile,
    };
});