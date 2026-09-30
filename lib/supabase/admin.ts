import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client for callers without a user session, such as the Paddle
 * webhook. It bypasses RLS: never use it to serve a user's request.
 */
export function createAdminClient() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}
