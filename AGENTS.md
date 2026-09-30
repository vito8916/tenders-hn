<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

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
- next/image above the fold: `loading="eager"` or `fetchPriority="high"`; `preload` only for the single LCP image (`priority` is deprecated)
- Be mindful of serialized prop size for RSC → child components

## TypeScript

- Don't unnecessarily add try / catch
- Don't cast to 'any

## About this project.

Tenders HN finds public procurement opportunities in Honduras for each customer company: it collects the processes published on HonduCompras, reads their documents, and matches them against what the company sells. The product spec is `documentation/MVP_Specification.md`; the build plan, its current status, and the Spanish UI conventions (§6.1.1) are in `documentation/mvp-implementation-plan.md`. The UI is Spanish-only.

It is built on a multi-tenant foundation:

- Next.js (App Router, TypeScript)
- Supabase (Postgres + Auth + Storage, heavy use of RLS)
- Tailwind CSS + shadcn/ui
- Resend + React Email
- Claims-based auth (`supabase.auth.getClaims()`)
- A background worker in `worker/` (Supabase Queues) for ingestion, documents, and matching

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
  - Postgres DB with RLS enabled on every table in `public`; new tables get RLS in the migration that creates them.
  - Auth via Supabase **JWT claims** (`getClaims()`) – see section 2.
  - Storage buckets:
    - `profile-pictures` (per-user folders).
    - `organization-logos` (per-org folders, controlled by membership + role).

- **Email**
  - Resend client + React Email templates in `/emails`.

- **UI**
  - shadcn/ui components under `components/ui`.
---

## 2. Auth Model – claims, not getUser()

On the server (Server Components, Server Actions, repository layer), read the user from `supabase.auth.getClaims()` on the `createClient()` from `lib/supabase/server.ts`, and take the user id from `claims.sub`. getClaims verifies the JWT without a round trip to the Auth server, which getUser() makes on every call.

```ts
const supabase = await createClient();
const { data } = await supabase.auth.getClaims();
const userId = data?.claims?.sub;

if (!userId) {
  // not authenticated
}
```
