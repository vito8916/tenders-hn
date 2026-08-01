import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Session } from "@supabase/supabase-js";

/**
 * Gets the current Supabase session
 * Uses React cache for request deduplication
 *
 * @returns Session object or null if not authenticated
 * @throws Error if session fetch fails
 */
export const getSession = cache(async (): Promise<Session | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getSession();

    if (error) {
        throw new Error(`Failed to get session: ${error.message}`);
    }

    return data.session;
});

/**
 * Checks if user is currently authenticated
 * Uses React cache for request deduplication
 *
 * @returns boolean indicating authentication status
 */
export const isAuthenticated = cache(async (): Promise<boolean> => {
    try {
        const session = await getSession();
        return session !== null;
    } catch {
        return false;
    }
});
