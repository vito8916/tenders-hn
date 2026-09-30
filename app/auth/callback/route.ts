import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

/**
 * Handle Supabase OAuth callback. Exchanges the `code` for a session
 * and then redirects the user to the desired `next` path or organizations.
 * Errors go to /error with the Supabase error code, which the page maps to Spanish text.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorCode = searchParams.get("error_code");
  const next = searchParams.get("next") ?? "/organizations";

  if (error || errorCode) {
    redirect(`/error?error=${encodeURIComponent(errorCode ?? "bad_oauth_callback")}`);
  }

  if (!code) {
    redirect("/error?error=bad_oauth_callback");
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    redirect(`/error?error=${encodeURIComponent(exchangeError.code ?? "bad_oauth_callback")}`);
  }

  redirect(next);
}
