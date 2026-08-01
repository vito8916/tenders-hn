## GitHub OAuth Sign-in/Sign-up with Supabase + Next.js

### Overview
This guide walks you through enabling GitHub OAuth using Supabase in this Next.js starter. It covers Supabase configuration, GitHub app setup, necessary URLs, and where the code is wired in this repo (server action, callback route, and UI buttons).

### Prerequisites
- A Supabase project with Auth enabled
- Next.js app running (dev defaults to `http://localhost:3000`)
- Environment variables set in this project:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
  - Optional but recommended: `NEXT_PUBLIC_SITE_URL` (e.g., `http://localhost:3000` for dev or your production domain)

### Step 1 — Configure app URLs in Supabase Auth settings
In the Supabase Dashboard:
1. Go to Authentication → URL Configuration.
2. Set Site URL to your base app URL.
   - Local: `http://localhost:3000`
   - Prod: `https://your-domain.com`
3. Add the following to Additional Redirect URLs (one per line):
   - `http://localhost:3000/auth/callback`
   - `https://your-domain.com/auth/callback` (when you have prod ready)

These allow Supabase to redirect back to your Next.js route after the provider grants a code.

### Step 2 — Create a GitHub OAuth app
On GitHub:
1. Open Developer settings → OAuth Apps → New OAuth App.
2. Application name: your app name.
3. Homepage URL: your Site URL (e.g., `http://localhost:3002`).
4. Authorization callback URL: use your Supabase project callback URL:
   - You can find it in Supabase → Authentication → Providers → GitHub. It typically looks like:
     `https://<YOUR_PROJECT_REF>.supabase.co/auth/v1/callback`
5. Register the app and copy the Client ID and Client Secret.

Important: The Authorization callback URL at GitHub must be the Supabase callback URL, not your Next.js `/auth/callback`. Supabase will then redirect back to your app using the `redirectTo` we provide in code.

### Step 3 — Enable GitHub provider in Supabase
In Supabase → Authentication → Providers → GitHub:
1. Enable the provider.
2. Paste the Client ID and Client Secret from GitHub.
3. Save.

### Step 4 — Server action to start the OAuth flow (already implemented)
This project exposes a server action that initiates provider login and returns a URL for client-side redirect:

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

Notes:
- The `redirectTo` points to our Next.js route `/auth/callback`, carrying a `next` query param for post-login navigation.
- For GitHub, call with `provider = "github"`.

### Step 5 — OAuth callback route (already implemented)
The callback route exchanges the `code` from Supabase for a session, then redirects to `next` (default `/dashboard`).

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

### Step 6 — Wire the GitHub UI buttons (already connected)
- Login: `features/auth/components/login-form.tsx`
- Sign-up: `features/auth/components/sign-up-form.tsx`

Both call the server action and then navigate the browser to the provider URL:

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
2. Run `pnpm dev` (exposes app at port 3000).
3. Navigate to `/login` or `/sign-up` and click GitHub.
4. Approve on GitHub, you should be redirected back and land on `/dashboard`.

### Deployment notes
- Add your production domain in Supabase Site URL and Additional Redirect URLs, including `/auth/callback`.
- In your hosting provider, set `NEXT_PUBLIC_SITE_URL` to your prod domain.

### Troubleshooting
- Error: Missing OAuth code → Ensure Additional Redirect URLs include your callback URL and that the `redirectTo` generated points to `/auth/callback` on the correct domain.
- Provider error about redirect mismatch → The GitHub OAuth app Authorization callback URL must be the Supabase callback URL shown in Supabase provider settings.
- Random sign-outs/server mismatch → Keep the provided Supabase middleware as-is; it syncs cookies for SSR.
- 404 on callback → Ensure the file exists at `app/auth/callback/route.ts` and you’re on Next.js App Router.

### Security considerations
- Always use HTTPS in production for all URLs.
- Limit origins/redirects to trusted domains in Supabase settings.
- Avoid logging sensitive params from the callback.


