<!-- BEGIN:nextjs-agent-rules -->
 
# Next.js: ALWAYS read docs before coding
 
Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data is outdated — the docs are the source of truth.
 
<!-- END:nextjs-agent-rules -->

- Only create an abstraction if it's actually needed
- Prefer clear function/variable names over inline comments
- Avoid helper functions when a simple inline expression would suffice
- Don't use emojis

## React

- Avoid massive JSX blocks and compose smaller components
- Colocate code that changes together
- Avoid useEffect unless absolutely needed

## Tailwind

- Mostly use built-in values, occasionally allow dynamic values, rarely globals
- Always use v4 + global CSS file format + shadcn/ui

## Next

- Prefer fetching data in RSC (page can still be static)
- Use next/font + next/script when applicable
- next/image above the fold should have 'sync / 'eager" / use 'priority' sparingly
- Be mindful of serialized prop size for RSC → child components

## TypeScript

- Don't unnecessarily add try / catch
- Don't cast to 'any

## About this project.

You are helping maintain and extend a **multi-tenant SaaS template** built with:

- Next.js (App Router, TypeScript)
- Supabase (Postgres + Auth + Storage, heavy use of RLS)
- Tailwind CSS + shadcn/ui
- Resend + React Email
- Claims-based auth (`supabase.auth.getClaims()`)

Your primary goals:

1. **Keep the multi-tenant architecture correct** (orgs + memberships + roles).
2. **Keep org-scoped app logic correct** (sidebar, settings, etc).
3. **Follow the existing patterns:** Feature-based architecture with repository/services/actions, all code co-located by domain in `features/[domain]/`.
4. **Avoid over-engineering unless explicitly asked.**

---

## 1. Stack & Architecture

- **Next.js**
  - App Router.
  - No `src/` directory (code at repo root).
  - Route groups:
    - `app/(marketing)` – public landing/docs.
    - `app/(auth)` – login/sign-up/reset flows.
    - `app/(app)` – authenticated area.
      - `/app/onboarding`
      - `/app/organizations`
      - `/app/organizations/[orgSlug]/...` (org-scoped app, with sidebar and settings).

- **Supabase**
  - Postgres DB with RLS enabled on:
    - `profiles`
    - `organizations`
    - `organization_members`
    - `organization_invitations`
    - `projects`
    - `app_events`
  - Auth via Supabase **JWT claims** (`getClaims()`) – see section 2.
  - Storage buckets:
    - `profile-pictures` (per-user folders).
    - `organization-logos` (per-org folders, controlled by membership + role).

- **Email**
  - Resend client + React Email templates in `/emails`.

- **UI**
  - shadcn/ui components under `components/ui`.
---

## 2. Auth Model – USE CLAIMS, NOT getUser()

**IMPORTANT RULE:**

- On the server (Server Components, Server Actions, Repository layer):
  - **Use** `supabase.auth.getClaims()` from our `createClient()` helper.
  - **The authenticated user id is always**: `claims.sub`.

Example pattern (follow this everywhere):

```ts
const supabase = createClient();
const { data } = await supabase.auth.getClaims();
const userId = data?.claims?.sub;

if (!userId) {
  // not authenticated
}