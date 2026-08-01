import {cache} from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Generates a signed URL for a file in Supabase Storage
 *
 * @param bucket - The storage bucket name
 * @param path - The file path within the bucket
 * @param expiresIn - Time in seconds until the URL expires (default: 3600 = 1 hour)
 * @returns Signed URL or null if file doesn't exist or on error
 */
export const getSignedUrl = cache(async (
    bucket: string,
    path: string,
    expiresIn: number = 3600
): Promise<string | null> => {
    if (!path) return null;

    const supabase = await createClient();

    const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn);

    if (error) {
        console.error(`Error generating signed URL for ${bucket}/${path}:`, error);
        throw error;
    }

    return data.signedUrl;
});

/**
 * Generates a signed URL for a profile picture
 *
 * @param avatarPath - The avatar file path (e.g., "user-id/filename.jpg")
 * @param expiresIn - Time in seconds until the URL expires (default: 3600 = 1 hour)
 * @returns Signed URL or null if path is empty or on error
 */
export const getProfilePictureUrl = cache(async (
    avatarPath: string | null,
    expiresIn: number = 3600
): Promise<string | null> => {
    if (!avatarPath) return null;

    return getSignedUrl("profile-pictures", avatarPath, expiresIn);
});

/**
 * Generates a signed URL for an organization logo
 *
 * @param logoPath - The logo file path (e.g., "org-id/logo.png") or already a full URL
 * @param expiresIn - Time in seconds until the URL expires (default: 86400 = 24 hours)
 * @returns Signed URL or null if path is empty or on error
 */
export const getOrganizationLogoUrl = cache(async (
    logoPath: string | null,
    expiresIn: number = 86400 // 24 hours instead of 1 hour
): Promise<string | null> => {
    if (!logoPath) return null;

    // If it's already a full URL (signed URL), return it as-is
    if (logoPath.startsWith('http://') || logoPath.startsWith('https://')) {
        return logoPath;
    }

    return getSignedUrl("organization-logos", logoPath, expiresIn);
});
