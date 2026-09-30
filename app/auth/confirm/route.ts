import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

/**
 * Handle Supabase email OTP verification for auth flows.
 * Accepts `token_hash`, `type`, and optional `next` from query params.
 * Errors go to /error with the Supabase error code, which the page maps to Spanish text.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/organizations";

  if (token_hash && type) {
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (!error) {
      // redirect user to specified redirect URL or root of app
      redirect(next);
    } else {
      // redirect the user to an error page with some instructions
      redirect(`/error?error=${encodeURIComponent(error.code ?? "otp_expired")}`);
    }
  }

  // redirect the user to an error page with some instructions
  redirect("/error?error=otp_expired");
}
