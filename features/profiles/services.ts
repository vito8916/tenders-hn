import 'server-only';
import { getProfilePictureUrl } from "@/lib/utils/storage";
import {
    getProfileById,
    updateProfile,
    markOnboardingComplete,
} from "./repository";
import type {
    Profile,
    UpdateProfileInput,
} from "./schemas";

/**
 * Service layer for fetching user profile with signed avatar URL
 *
 * @param params - Object containing userId
 * @returns The profile entity with signed avatar URL or null if not found
 * @throws Error if query fails
 */
export async function getProfileService(params: { userId: string }): Promise<Profile | null> {
    const profile = await getProfileById({ userId: params.userId });

    if (!profile) return null;

    // Generate signed URL for avatar if it exists
    if (profile.avatarUrl) {
        const signedUrl = await getProfilePictureUrl(profile.avatarUrl);
        if (signedUrl) {
            profile.avatarUrl = signedUrl;
        }
    }

    return profile;
}

/**
 * Service layer for updating user profile
 * Orchestrates validation and repository calls
 *
 * @param params - Object containing userId and validated profile update input
 * @returns The updated profile entity
 * @throws Error if user profile doesn't exist or if update fails
 */
export async function updateProfileService(params: {
    userId: string;
    input: UpdateProfileInput;
}): Promise<Profile> {
    // 1. Verify profile exists
    const existingProfile = await getProfileById({ userId: params.userId });

    if (!existingProfile) {
        throw new Error("Profile not found");
    }

    // 2. Update the profile via repository
    const updatedProfile = await updateProfile({
        userId: params.userId,
        input: params.input,
    });

    return updatedProfile;
}

/**
 * Service layer for marking onboarding as complete
 *
 * @param params - Object containing userId
 * @returns Updated Profile entity with onboarding_completed_at set
 * @throws Error if profile doesn't exist or update fails
 */
export async function markOnboardingCompleteService(params: {
    userId: string;
}): Promise<Profile> {
    return markOnboardingComplete(params);
}
