"use server";

import { createClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  resendConfirmationEmailSchema,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
  verifyEmailSchema,
  type ForgotPasswordFormValues,
  type ResendConfirmationEmailFormValues,
  type SignInFormValues,
  type SignUpFormValues,
  type UpdatePasswordFormValues,
  type VerifyEmailFormValues,
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
 * Supabase emails a 6-digit code that the user enters on /verify-email.
 * @param values - Validated sign-up form values.
 */
export async function signUpAction(values: SignUpFormValues) {
    const supabase = await createClient();

    // Validate incoming values against Zod schema.
    const validatedFields = signUpSchema.safeParse(values);

    if (!validatedFields.success) {
        return { error: "Invalid fields" };
    }

    const { fullName, email, password } = validatedFields.data;

    // Create user and attach basic profile metadata.
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: fullName,
            },
        },
    });

    if (error) {
        return { error: error.message };
    }

    return { data };
}

/**
 * Confirm a new account with the code from the confirmation email.
 * On success the user is signed in.
 * @param values - Validated email and 6-digit code.
 */
export async function verifyEmailAction(values: VerifyEmailFormValues) {
    const supabase = await createClient();

    const validatedFields = verifyEmailSchema.safeParse(values);

    if (!validatedFields.success) {
        return { error: "Invalid fields" };
    }

    const { email, token } = validatedFields.data;

    const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "email",
    });

    if (error) {
        return { error: error.message };
    }

    return { data };
}

/**
 * Send a new confirmation code to an unconfirmed account.
 * @param values - Validated email.
 */
export async function resendConfirmationEmailAction(values: ResendConfirmationEmailFormValues) {
    const supabase = await createClient();

    const validatedFields = resendConfirmationEmailSchema.safeParse(values);

    if (!validatedFields.success) {
        return { error: "Invalid fields" };
    }

    const { error } = await supabase.auth.resend({
        type: "signup",
        email: validatedFields.data.email,
    });

    if (error) {
        return { error: error.message };
    }

    return { success: true };
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
            code: error.code,
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
