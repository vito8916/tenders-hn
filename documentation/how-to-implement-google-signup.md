## Google OAuth Sign-in/Sign-up with Supabase + Next.js

### Overview
This guide explains how to enable Google OAuth using Supabase and how it’s wired in this Next.js starter. You’ll configure Google Cloud, enable the provider in Supabase, set required URLs, and use the built-in server action, callback route, and UI buttons.

### Prerequisites
- Supabase project with Auth enabled
- Next.js app running (dev defaults to `http://localhost:3000`)
- Environment variables set in this project:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
  - Optional: `NEXT_PUBLIC_SITE_URL` (e.g., `http://localhost:3000`)

### Step 1 — Configure app URLs in Supabase Auth settings
In the Supabase Dashboard → Authentication → URL Configuration:
1. Site URL: `http://localhost:3000` (dev) or your production domain.
2. Additional Redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `https://your-domain.com/auth/callback` (for prod)

These URLs allow Supabase to redirect back to your app after Google returns a code.

### Step 2 — Create OAuth credentials in Google Cloud Console
In Google Cloud Console:
1. Create (or select) a project.
2. Go to APIs & Services → Credentials → Create Credentials → OAuth client ID.
3. Application type: Web application.
4. Authorized JavaScript origins:
   - `http://localhost:3002` (dev)
   - `https://your-domain.com` (prod)
5. Authorized redirect URIs: use your Supabase project callback URL from Supabase → Auth → Providers → Google, typically:
   - `https://<YOUR_PROJECT_REF>.supabase.co/auth/v1/callback`
6. Create and copy the Client ID and Client Secret.

Important: The Google redirect URI must be the Supabase callback URL. Supabase will then redirect to your app via the `redirectTo` we specify in code.

### Step 3 — Enable Google provider in Supabase
In Supabase → Authentication → Providers → Google:
1. Enable the provider.
2. Paste the Google Client ID and Client Secret.
3. Save.

### Step 4 — Server action to start the OAuth flow (already implemented)
Use the provided action to initiate OAuth and get a URL to redirect the user:

```ts
// features/auth/actions.ts
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
    options: { redirectTo },
  });

  if (error) return { error: error.message } as const;
  if (data?.url) return { url: data.url } as const;
  return { error: "Unable to start OAuth flow" } as const;
}
```

Call it with `provider = "google"`.

### Step 5 — OAuth callback route (already implemented)
The callback route exchanges the Supabase authorization `code` for a session and redirects to the `next` path (defaults to `/dashboard`).

```ts
// app/auth/callback/route.ts
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const error_description = searchParams.get("error_description");
  const next = searchParams.get("next") ?? "/organizations";

  if (error || error_description) {
    redirect(`/auth/error?error=${encodeURIComponent(error_description || error || "OAuth error")}`);
  }
  if (!code) redirect("/auth/error?error=Missing%20OAuth%20code");

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    redirect(`/auth/error?error=${encodeURIComponent(exchangeError.message)}`);
  }
  redirect(next);
}
```

### Step 6 — Wire the Google UI buttons (already connected)
- Login: `features/auth/components/login-form.tsx`
- Sign-up: `features/auth/components/sign-up-form.tsx`

Both call the server action and redirect the browser to Google:

```ts
async function handleOAuth(provider: "github" | "google") {
  setIsOauthLoading(provider);
  const result = await signInWithOAuthAction(provider, "/organizations");
  if (result?.error) {
    toast.error(result.error);
    return;
  }
  if (result?.url) {
    window.location.href = result.url;
  }
}
```

### Step 7 — Test locally
1. Ensure `NEXT_PUBLIC_SITE_URL=http://localhost:3000` in `.env.local`.
2. Run `pnpm dev`.
3. Open `/login` or `/sign-up` and click Google.
4. Complete consent; you should land on `/dashboard`.

### Deployment notes
- Add your production domain in Supabase Site URL and Additional Redirect URLs, including `/auth/callback`.
- Configure Google OAuth Client with your production origin.
- Set `NEXT_PUBLIC_SITE_URL` in your production environment.

### Troubleshooting
- redirect_uri_mismatch → The Google OAuth client redirect URI must match the Supabase provider callback URL exactly.
- Missing OAuth code → Ensure Additional Redirect URLs include your app’s `/auth/callback` and that `redirectTo` points there.
- Cookies/session issues → Keep the provided Supabase middleware, which maintains SSR cookie sync.
- 403 or disabled consent screen → Make sure the OAuth consent screen is configured and published in Google Cloud.

### Security considerations
- Only add trusted origins and redirect URIs.
- Use HTTPS for production.
- Do not log sensitive query parameters.


