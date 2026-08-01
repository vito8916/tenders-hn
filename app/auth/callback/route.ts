import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

/**
 * Handle Supabase OAuth callback. Exchanges the `code` for a session
 * and then redirects the user to the desired `next` path or organizations.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const error_description = searchParams.get("error_description");
  const next = searchParams.get("next") ?? "/organizations";

  // Handle OAuth errors returned by Supabase
  if (error || error_description) {
    const errorMessage = error_description || error || "OAuth authentication failed";
    redirect(`/auth/error?error=${encodeURIComponent(errorMessage)}`);
  }

  // Handle missing code
  if (!code) {
    redirect("/auth/error?error=Missing%20OAuth%20code");
  }

  try {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    
    if (exchangeError) {
      redirect(`/auth/error?error=${encodeURIComponent(exchangeError.message)}`);
    }

    redirect(next);
  } catch (err) {
    // Catch any unexpected errors during the exchange process
    const message = err instanceof Error ? err.message : "An unexpected error occurred";
    redirect(`/auth/error?error=${encodeURIComponent(message)}`);
  }
}

