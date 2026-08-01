"use server";

import { createClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
  type ForgotPasswordFormValues,
  type SignInFormValues,
  type SignUpFormValues,
  type UpdatePasswordFormValues,
} from "./schemas";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

/**
 * Get the currently authenticated user (or null).
 */
export const getAuthUser = cache(async () => {
    const supabase = await createClient();

    // Retrieve the current auth user from Supabase.
    const { data } = await supabase.auth.getClaims();
    const user = data?.claims;
    if (!user) {
        throw new Error('User not authenticated');
    }

    return user;
  });

/**
 * Sign up a new user with email/password.
 * @param values - Validated sign-up form values.
 */
export async function signUpAction(values: SignUpFormValues, nextPath?: string) {
    const supabase = await createClient();
    const headersList = await headers();
    const origin = headersList.get("origin") || process.env.NEXT_PUBLIC_SITE_URL;

    // Validate incoming values against Zod schema.
    const validatedFields = signUpSchema.safeParse(values);

    if (!validatedFields.success) {
        return { error: "Invalid fields" };
    }

    const { fullName, email, password } = validatedFields.data;

    const destination = nextPath?.startsWith("/") ? nextPath : "/organizations";

    // Create user and attach basic profile metadata.
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: fullName,
            },
            // Email link redirect target after confirmation.
            emailRedirectTo: `${origin}${destination}`,
        },
    });

    if (error) {
        return { error: error.message };
    }

    return { data };
}

/**
 * Sign in an existing user with email/password.
 * @param values - Validated sign-in form values.
 */
export async function signInAction(values: SignInFormValues) {
    const supabase = await createClient();

    // Validate incoming values against Zod schema.
    const validatedFields = signInSchema.safeParse(values);

    if (!validatedFields.success) {
        return {
            error: "Invalid fields",
        };
    }

    const { email, password } = validatedFields.data;

    // Attempt sign-in with email/password.
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        console.error('Error signing in:', error);
        return {
            error: error.message,
        };
    }

    return { data };
}

/**
 * Begin an OAuth sign-in flow for supported providers.
 * Redirects the user to the provider's consent screen.
 */
export async function signInWithOAuthAction(
  provider: "github" | "google",
  nextPath?: string,
) {
  const supabase = await createClient();
  const headersList = await headers();
  const origin = headersList.get("origin") || process.env.NEXT_PUBLIC_SITE_URL;

  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(
    nextPath ?? "/organizations",
  )}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
    },
  });

  if (error) {
    return { error: error.message } as const;
  }

  // If a URL is returned, return it so the client can navigate.
  if (data?.url) {
    return { url: data.url } as const;
  }

  return { error: "Unable to start OAuth flow" } as const;
}

/**
 * Sign out the current user and redirect to home.
 */
export async function signOutAction() {
    const supabase = await createClient();
    // Clear session and navigate home.
    await supabase.auth.signOut();
    redirect("/");
}

/**
 * Send a password reset email.
 * @param values - Validated forgot password form values.
 */
export async function forgotPasswordAction(values: ForgotPasswordFormValues) {
    const supabase = await createClient();
    const headersList = await headers();
    const origin = headersList.get("origin") || process.env.NEXT_PUBLIC_SITE_URL;

    // Validate email payload.
    const validatedFields = forgotPasswordSchema.safeParse(values);

    if (!validatedFields.success) {
        return {
            error: "Invalid fields",
        };
    }

    const { email } = validatedFields.data;

    // Send reset email with redirect back to the app.
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/update-password`,
    });

    if (error) {
        return { error: error.message };
    }

    return { data };
}

/**
 * Update the authenticated user's password.
 * @param values - Validated update password form values.
 */
export async function updatePasswordAction(values: UpdatePasswordFormValues) {
    const supabase = await createClient();

    // Validate new password fields.
    const validatedFields = updatePasswordSchema.safeParse(values);

    if (!validatedFields.success) {
        return { error: "Invalid fields" };
    }

    const { password, confirmPassword } = validatedFields.data;

    if (password !== confirmPassword) {
        return { error: "Passwords do not match" };
    }

    // Commit the password change to Supabase auth.
    const { data, error } = await supabase.auth.updateUser({
        password: password as string,
    });

    if (error) {
        return { error: error.message };
    }

    return { data };
}
