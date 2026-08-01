import 'server-only';
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";
import {
    profileSchema,
    profileSummarySchema,
    type Profile,
    type ProfileSummary,
    type UpdateProfileInput,
} from "./schemas";

type ProfileRow = Tables<"profiles">;

// ========== MAPPERS ==========

/**
 * Maps a database row to a Profile entity
 * Converts snake_case to camelCase and validates with Zod
 */
export function mapProfileRow(row: ProfileRow): Profile {
    const mapped = {
        id: row.id,
        fullName: row.full_name,
        avatarUrl: row.avatar_url ?? "",
        bio: row.bio,
        email: row.email,
        phone: row.phone,
        status: row.status,
        stripeCustomerId: row.stripe_customer_id,
        stripeSubscriptionId: row.stripe_subscription_id,
        onboardingCompletedAt: row.onboarding_completed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };

    return profileSchema.parse(mapped);
}

/**
 * Maps a lightweight profile row to ProfileSummary
 * Used for list views or minimal profile displays
 */
export function mapProfileSummary(row: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    email: string | null;
}): ProfileSummary {
    const mapped = {
        id: row.id,
        fullName: row.full_name,
        avatarUrl: row.avatar_url ?? "",
        email: row.email,
    };

    return profileSummarySchema.parse(mapped);
}

// ========== QUERIES ==========

/**
 * Fetches a single profile by user ID
 * @param params - Object containing userId
 * @returns Profile entity or null if not found
 * @throws Supabase error if query fails (except PGRST116 - not found)
 */
export async function getProfileById(params: { userId: string }): Promise<Profile | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", params.userId)
        .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return mapProfileRow(data);
}

/**
 * Fetches a single profile by email address
 * @param params - Object containing email
 * @returns Profile entity or null if not found
 * @throws Supabase error if query fails (except PGRST116 - not found)
 */
export async function getProfileByEmail(params: { email: string }): Promise<Profile | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("email", params.email.toLowerCase())
        .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return mapProfileRow(data);
}

// ========== MUTATIONS ==========

/**
 * Updates an existing profile
 * @param params - Object containing userId and input data
 * @returns Updated Profile entity
 * @throws Supabase error if update fails
 */
export async function updateProfile(params: {
    userId: string;
    input: UpdateProfileInput;
}): Promise<Profile> {
    const supabase = await createClient();

    // Map camelCase to snake_case for database
    const dbInput: Record<string, unknown> = {};

    if (params.input.fullName !== undefined) {
        dbInput.full_name = params.input.fullName;
    }
    if (params.input.bio !== undefined) {
        dbInput.bio = params.input.bio;
    }
    if (params.input.phone !== undefined) {
        dbInput.phone = params.input.phone;
    }
    if (params.input.avatarUrl !== undefined) {
        dbInput.avatar_url = params.input.avatarUrl;
    }

    const { data, error } = await supabase
        .from("profiles")
        .update(dbInput)
        .eq("id", params.userId)
        .select()
        .single();

    if (error) throw error;

    return mapProfileRow(data);
}

/**
 * Marks onboarding as complete for a user profile
 * @param params - Object containing userId
 * @returns Updated Profile entity with onboarding_completed_at set
 * @throws Supabase error if update fails
 */
export async function markOnboardingComplete(params: { userId: string }): Promise<Profile> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("profiles")
        .update({
            onboarding_completed_at: new Date().toISOString(),
        })
        .eq("id", params.userId)
        .select()
        .single();

    if (error) throw error;

    return mapProfileRow(data);
}

// ========== STORAGE ==========

/**
 * Uploads a profile picture to Supabase Storage
 * @param params - Object containing userId, file buffer, and file name
 * @returns The storage path (e.g., "user-id/avatar.jpg")
 * @throws Error if upload fails
 */
export async function uploadProfilePicture(params: {
    userId: string;
    file: Buffer;
    fileName: string;
    contentType: string;
}): Promise<string> {
    const supabase = await createClient();

    const filePath = `${params.userId}/${params.fileName}`;

    const { error } = await supabase.storage
        .from("profile-pictures")
        .upload(filePath, params.file, {
            contentType: params.contentType,
            upsert: true,
        });

    if (error) throw error;

    return filePath;
}
