import { cache } from "react";
import { redirect } from "next/navigation";
import { getCurrentUserWithProfile } from "@/lib/auth/get-current-user";
import { UserWithProfile } from "@/features/profiles/schemas";

/**
 * Ensures a user has completed onboarding, redirecting if not
 * Uses React cache for request deduplication
 *
 * @returns UserWithProfile object if onboarding is complete
 * @throws Redirects to /onboarding if not completed
 */
export const requireOnboarding = cache(async (): Promise<UserWithProfile> => {
    const userWithProfile = await getCurrentUserWithProfile();

    if (!userWithProfile.profile.onboardingCompletedAt) {
        redirect("/onboarding");
    }

    return userWithProfile;
});
