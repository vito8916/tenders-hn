# Multi-Tenant SupaNext Kit

Multi-tenant SaaS starter kit built on Next.js and Supabase.

## Overview

Multi-Tenant SupaNext Kit helps you manage projects, members, and organization workflows from one place. It ships with complete flows for authentication, onboarding (including invited users), organizations, projects, member management, invitations with email delivery, settings, and an audit log — all enforced by RBAC in the app and Row Level Security in the database.

The project is **local-first**: the entire data model lives in versioned migrations under `supabase/migrations/`, and development runs against a local Supabase stack (Docker). No cloud project is required to work on it.

## Features

- **Multi-Organization**: Shared-schema multi-tenancy; every row is scoped by `org_id` and isolated by RLS.
- **RBAC**: Four roles (`owner`, `admin`, `member`, `viewer`) enforced in services and mirrored by database policies.
- **Invitations**: Invite by email (Resend + React Email), resend/revoke, and a token-based accept flow at `/invitations/[token]`.
- **Member Management**: Members table with role changes, removal, leave, and atomic ownership transfer.
- **Onboarding**: Multi-step flow (profile → theme → organization → invites); invited users get a join flow instead of creating an organization.
- **Projects**: List (TanStack Table), create, edit (name, description, status, visibility), favorites, and detail page.
- **Settings**: Account (profile, password, appearance) and organization (name, slug, logo, danger zone).
- **Audit Log**: `app_events` table written through a SECURITY DEFINER RPC, surfaced as Recent Activity on the dashboard.
- **Complete Auth**: Sign up, sign in, OAuth (GitHub/Google), forgot/update password, email confirmation, and `next` redirect support.

## Tech Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Supabase (Auth, Postgres, Storage, RLS) via `@supabase/ssr` with claims-based auth (`getClaims()`)
- Tailwind CSS v4 + shadcn/ui
- Zod (runtime validation + inferred types) + React Hook Form
- Resend + React Email
- Vitest for unit tests
- ESLint flat config (`eslint-config-next/core-web-vitals` + `/typescript`)

## Architecture

Layered, feature-sliced. The core rule: **actions never contain business logic** — they validate and delegate. Services own the rules. Repositories own the data. RLS is the final authority.

```
UI → Server Actions → Services (RBAC) → Repository → Supabase (RLS)
```

Every domain is self-contained under `features/[domain]/`:

```
features/[domain]/
  actions.ts      # Server Action entrypoints (validate session + input, delegate)
  services.ts     # Business logic and RBAC enforcement
  repository.ts   # Supabase queries and mutations only
  schemas.ts      # Zod schemas + inferred types (single source of truth)
  rbac.ts         # Pure permission functions (no DB access)
  components/     # UI colocated with the domain
```

Current domains: `auth`, `onboarding`, `organizations`, `memberships`, `invitations`, `projects`, `profiles`, `events`.

See `documentation/project-overview.md` for the full architecture snapshot.

## Requirements

- Node.js 18+ (LTS recommended)
- pnpm 11+ (repository includes `pnpm-lock.yaml`)
- Docker (for the local Supabase stack)

## Getting Started

1) Install dependencies

```bash
pnpm install
```

2) Start the local Supabase stack

```bash
pnpm db:start
```

This applies every migration in `supabase/migrations/` and runs `supabase/seed.sql`, which creates a test account (`test@mtsupanextkit.app` / `12345678`) that owns "Test Organization" on an active `pilot` plan, plus placeholder plans and the local Vault secrets for the email dispatcher.

3) Environment variables

Create `.env.local` (see `.env.example`):

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=<publishable key from `pnpm db:status`>
NEXT_PUBLIC_APP_URL=http://localhost:3001

# Optional: invitation emails (invitations still work without them;
# only delivery fails, and the members page offers resend)
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM="Multi-Tenant SupaNext Kit <onboarding@resend.dev>"
```

4) Run the dev server

```bash
pnpm dev
```

The app starts on http://localhost:3001.

Useful local URLs:

- Supabase Studio: http://127.0.0.1:55323
- Mailpit (auth emails sent by local Supabase): http://127.0.0.1:55324
- Postgres: `postgresql://postgres:postgres@127.0.0.1:55322/postgres`

### Running next to other local Supabase projects

This project avoids the Supabase CLI defaults so it can run at the same time as another local Next.js + Supabase app:

- Supabase ports are shifted to the `553xx` range in `supabase/config.toml` (API `55321`, DB `55322`, Studio `55323`, Mailpit `55324`, analytics `55327`, edge inspector `8183`).
- `pnpm dev` is pinned to port `3001`; `site_url` / `additional_redirect_urls` in `config.toml` match it.
- The auth cookie has an app-specific name (`lib/supabase/auth-cookie.ts`). Browsers share cookies across ports on the same host, so the default `sb-127-auth-token` would make two local apps overwrite each other's sessions.
- `supabase stop` only stops the containers for this `project_id`; the other project's stack keeps running.

## Scripts

- `pnpm dev` – Next dev server
- `pnpm build` – Production build
- `pnpm start` – Start the production server
- `pnpm lint` – ESLint (flat config)
- `pnpm test` – Run Vitest once
- `pnpm test:watch` – Vitest in watch mode
- `pnpm db:start` / `pnpm db:stop` / `pnpm db:status` – Local Supabase stack (uses the CLI version pinned in `package.json`)
- `pnpm db:reset` – Recreate the local database from migrations + seed
- `pnpm db:types` – Regenerate `types/database.types.ts` from the local database

## Database

The single source of truth is `supabase/migrations/`:

- `*_baseline.sql` — profiles, organizations, memberships, invitations, audit log (`app_events`), invitation/ownership RPCs, and the private storage buckets (`profile-pictures`, `organization-logos`).
- `*_notifications.sql` — notification catalog, per-user preferences, in-app `notifications` (published to Realtime), and the `notification_deliveries` email outbox. Membership and invitation triggers create notifications.
- `*_billing_and_entitlements.sql` — `plans`, `organization_subscriptions`, seat limits, and AI credits (`ai_credit_reservations` + append-only `ai_credit_ledger`). Subscription changes are audited and notified.
- `*_scheduled_jobs.sql` — pg_cron jobs: expire subscriptions, warn 7 days before expiry, grant monthly AI credits, release abandoned credit reservations, dispatch notification emails, purge old records.

Edge function `supabase/functions/send-notification-emails` drains the email outbox. pg_cron calls it every minute (only when there is due work) with a shared secret stored in Vault. It sends through Resend when `RESEND_API_KEY` is set; locally it delivers to Mailpit.

Key security decisions:

- Tables are opt-in for the Data API: default privileges are revoked and each table grants only what its RLS policies filter (column-level where it matters, e.g. `organizations.owner_id` and `notifications` can't be edited directly).
- SECURITY DEFINER helpers used by policies (`private.user_org_role()`, `private.shares_org_with()`, ...) live in the `private` schema, which the Data API does not expose.
- `organization_members` has **no INSERT policy**: memberships are created only by SECURITY DEFINER paths (org-creation trigger, `accept_invitation`), so roles cannot be forged.
- Role changes are owner-only, never on the owner's own row, and never to `owner`. Ownership moves only through the atomic `transfer_organization_ownership` RPC, which demotes the previous owner to admin.
- Subscriptions, plans and credits are read-only for customers. Only `service_role` writes them (the platform admin app today, a payment webhook later). `reserve_ai_credits` / `commit_ai_credits` / `release_ai_credits` are service_role-only.
- An organization without an active subscription is read-only: invitations and credit reservations fail with `subscription_inactive`; seat limits fail with `seat_limit_reached`.

### Changing the schema

```bash
pnpm exec supabase migration new <name>   # write SQL in the generated file
pnpm exec supabase db reset               # replay all migrations + seed.sql
pnpm exec supabase gen types typescript --local > types/database.types.ts
```

Generated types in `types/database.types.ts` are never edited by hand.

## Auth & Middleware

- Entry: `proxy.ts` delegates to `lib/supabase/middleware.updateSession()`.
- Unauthenticated users are redirected from protected routes to `/login?next=<destination>`; after signing in they land on the original destination (this is how invitation links survive the login wall).
- Authenticated users are redirected away from `/login` and `/sign-up`.
- Public routes: `/`, `/login`, `/sign-up`, `/forgot-password`, `/update-password`, `/sign-up-success`, `/error`, and everything under `/auth`.
- Middleware is a convenience layer only — every server entry point re-checks the session, and RLS enforces data access regardless.

## Project Structure

```
app/
  (marketing)/            # Public landing
  (auth)/                 # Login / sign-up / password flows
  (app)/                  # Authenticated area
    onboarding/           # Multi-step onboarding (create or join)
    invitations/[token]/  # Invitation accept page
    organizations/        # Org list + org-scoped app
      [orgSlug]/          # Dashboard, projects, members, settings
features/                 # Domain slices (see Architecture)
components/               # App shell, marketing, shared UI
components/ui/            # Vendored shadcn/diceui components — do not edit
emails/                   # React Email templates
lib/
  auth/                   # Claims helpers, onboarding guard
  email/                  # Resend wrapper
  supabase/               # SSR/CSR clients, middleware integration
supabase/
  migrations/             # Database source of truth
  seed.sql                # Local test data
types/database.types.ts   # Generated from the database
documentation/            # Architecture and project docs
```

## Testing

```bash
pnpm test
```

Unit tests live next to what they validate: RBAC permission matrices (`features/*/rbac.test.ts`) and schema validation (`features/invitations/schemas.test.ts`).

## Deploying to the Cloud

1. Create a Supabase project (the new API keys / JWT signing keys setup).
2. Link and push the migrations:

```bash
pnpm exec supabase link --project-ref <ref>
pnpm exec supabase db push
```

3. Configure auth email templates in the Supabase dashboard (Authentication → Emails) so links go through the app's confirm route:

```html
<!-- Confirm sign up -->
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirm your mail</a></p>

<!-- Reset password -->
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/update-password">Reset Password</a></p>
```

4. Set the environment variables in your host (e.g. Vercel): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`, `NEXT_PUBLIC_APP_URL` (production origin), plus `RESEND_API_KEY` and `EMAIL_FROM` for invitation emails.

5. Deploy the email dispatcher and give it (and pg_cron) the same shared secret:

```bash
pnpm exec supabase functions deploy send-notification-emails
pnpm exec supabase secrets set EMAIL_DISPATCHER_SECRET=<random> RESEND_API_KEY=<key> EMAIL_FROM="Tenders HN <noreply@your-domain>" APP_URL=https://<production origin>
```

```sql
-- SQL editor, once per project
select vault.create_secret('https://<ref>.supabase.co', 'project_url');
select vault.create_secret('<same random secret>', 'email_dispatcher_secret');
```

## License

MIT — see `LICENSE.txt`.
