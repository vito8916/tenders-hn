import { createBrowserClient } from "@supabase/ssr";

/**
 * Create a Supabase client for the browser.
 * Uses public env vars and stores session via cookies.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
  );
}
