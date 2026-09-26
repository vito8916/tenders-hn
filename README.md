# Tenders HN

Plataforma de oportunidades de compras públicas para Honduras. It collects the processes published on HonduCompras, reads their details and documents, compares them with what each company sells, and delivers a short, justified list of opportunities worth reviewing.

## Overview

Tenders HN is built on a multi-tenant Next.js + Supabase foundation (organizations, roles, invitations, plans, notifications, audit log — all enforced by RBAC in the app and Row Level Security in the database) plus a background worker for ingestion and AI matching.

- **Product spec:** `documentation/MVP_Specification.md`
- **How and in which order we build it:** `documentation/mvp-implementation-plan.md`
- **Status:** Phase 0 (worker, queues, AI layer, tests, CI) is done. Phase 1 (ingestion) is in progress: source tables, window sync, detail fetch, open-process rechecks, the source health read model, and the freshness measurement setup are done; the measurement runs until 1 Oct 2026, then the sync cadence and window are fixed. Phase 2 (documents) is in progress: document download and text extraction (text layer + Spanish OCR) are done; chunking with embeddings and candidate retrieval are next.

The project is **local-first**: the entire data model lives in versioned migrations under `supabase/migrations/`, and development runs against a local Supabase stack (Docker). No cloud project is required to work on it.

The product UI will be **Spanish-only**; screens inherited from the template are still in English until the Phase 4 translation pass.

## Features

- **Multi-Organization**: Shared-schema multi-tenancy; every row is scoped by `org_id` and isolated by RLS.
- **RBAC**: Four roles (`owner`, `admin`, `member`, `viewer`) enforced in services and mirrored by database policies.
- **Invitations**: Invite by email (Resend + React Email), resend/revoke, and a token-based accept flow at `/invitations/[token]`.
- **Member Management**: Members table with role changes, removal, leave, and atomic ownership transfer.
- **Onboarding**: Multi-step flow (profile → theme → organization → invites); invited users get a join flow instead of creating an organization.
- **Settings**: Account (profile, password, appearance), organization (name, slug, logo, danger zone), and notification preferences.
- **Notifications**: In-app inbox in the header bell with live updates (Supabase Realtime), per-user in-app/email preferences, and an email outbox drained by an edge function.
- **Plans and entitlements**: Organization subscriptions activated by the platform admin app, seat limits, read-only mode without an active plan, and monthly AI credits with reserve / commit / release.
- **Audit Log**: `app_events` written by a SECURITY DEFINER RPC and by database triggers (subscription changes), surfaced as Recent Activity and a filterable audit log page.
- **Background worker**: Node process consuming Supabase Queues for ingestion, documents, matching, and reports.
- **Complete Auth**: Sign up, sign in, OAuth (GitHub/Google), forgot/update password, email confirmation, and `next` redirect support.

## Tech Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Supabase (Auth, Postgres, Storage, RLS) via `@supabase/ssr` with claims-based auth (`getClaims()`)
- Tailwind CSS v4 + shadcn/ui
- Zod (runtime validation + inferred types) + React Hook Form
- Resend + React Email
- Supabase Queues (pgmq) + pg_cron for background jobs; `worker/` package (Node 24) consumes them
- AI SDK + Vercel AI Gateway: Jev (`typesafe-ai/jev`) for matching, multi-provider chat and embedding models by task role
- Vitest for unit tests, pgTAP for database tests
- Deployment target: Railway (`web` and `worker` services) + Supabase Cloud
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

Current domains: `auth`, `onboarding`, `organizations`, `memberships`, `invitations`, `profiles`, `events`, `notifications`, `settings`. Procurement domains (processes, documents, profiles, searches, runs, chat) arrive with the phases in the implementation plan.

See `documentation/project-overview.md` for the full architecture snapshot.

## Requirements

- Node.js 24 (used by CI and the worker image)
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

5) Optional: run the background worker and check AI access

```bash
cp worker/.env.example worker/.env.local   # add AI_GATEWAY_API_KEY for AI jobs
pnpm worker:dev
pnpm --filter worker ai:smoke --all-chat   # calls Jev and each chat candidate once
```

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
- `pnpm typecheck` – TypeScript for the app and the worker
- `pnpm test` – Run Vitest once
- `pnpm test:watch` – Vitest in watch mode
- `pnpm db:start` / `pnpm db:stop` / `pnpm db:status` – Local Supabase stack (uses the CLI version pinned in `package.json`)
- `pnpm db:reset` – Recreate the local database from migrations + seed
- `pnpm db:types` – Regenerate `types/database.types.ts` from the local database
- `pnpm worker:dev` – Run the background worker against the local stack (reads `worker/.env.local`)
- `pnpm --filter worker ai:smoke [--all-chat]` – Call each enabled AI role once through AI Gateway and log it in `ai_usage_events`

## Database

The single source of truth is `supabase/migrations/`:

- `*_baseline.sql` — profiles, organizations, memberships, invitations, audit log (`app_events`), invitation/ownership RPCs, and the private storage buckets (`profile-pictures`, `organization-logos`).
- `*_notifications.sql` — notification catalog, per-user preferences, in-app `notifications` (published to Realtime), and the `notification_deliveries` email outbox. Membership and invitation triggers create notifications.
- `*_billing_and_entitlements.sql` — `plans`, `organization_subscriptions`, seat limits, and AI credits (`ai_credit_reservations` + append-only `ai_credit_ledger`). Subscription changes are audited and notified.
- `*_scheduled_jobs.sql` — pg_cron jobs: expire subscriptions, warn 7 days before expiry, grant monthly AI credits, release abandoned credit reservations, dispatch notification emails, purge old records.
- `*_worker_and_ai_foundation.sql` — search extensions (`vector`, `pg_trgm`, `unaccent`), Supabase Queues (`pgmq`) with the `maintenance` queue and a per-minute worker heartbeat, `worker_heartbeats`, `ai_usage_events`, and `ai_model_rates`.
- `*_source_data.sql` — shared HonduCompras data readable by any organization member: `source_sync_runs`, `source_pages` (raw HTML in the private `source-pages` bucket), `procurement_processes` (accent-insensitive full-text search), `process_versions`, `process_events`, and `source_documents`. Adds the `ingest` queue and a sync every 3 hours.
- `*_recheck_open_processes.sql` — hourly recheck of open processes (`private.enqueue_open_rechecks`).
- `*_source_health.sql` — service-role-only read model for the platform admin app: `source_health` (latest run, last successful sync and its age, failed runs in the last 24 hours, per source) and `worker_job_failures` (jobs that exhausted their attempts, with the error).
- `*_source_document_files.sql` — `document_versions` (one per file content, with extraction status), `document_pages` (text per page, method, OCR confidence), download state on `source_documents`, the private `source-documents` bucket, and the `docs` queue.
- `*_freshness_measurement.sql` — a daily 30-day sync (`private.enqueue_ingest_wide_sync`, 04:00 Honduras) and the service-role-only `process_arrivals` view: processes that appeared after an earlier successful sync had covered their start date, with how many days late they appeared.

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
- Public routes: `/`, `/login`, `/sign-up`, `/forgot-password`, `/update-password`, `/verify-email`, `/error`, and everything under `/auth`.
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
      [orgSlug]/          # Dashboard, members, settings
features/                 # Domain slices (see Architecture)
components/               # App shell, marketing, shared UI
components/ui/            # Vendored shadcn/diceui components — do not edit
emails/                   # React Email templates
lib/
  ai/                     # AI role → gateway model registry (shared with the worker)
  auth/                   # Claims helpers, onboarding guard
  email/                  # Resend wrapper
  supabase/               # SSR/CSR clients, middleware integration
worker/
  src/                    # Queue consumer, jobs, scripts
  src/honducompras/__fixtures__/  # Captured portal pages for parser tests
  Dockerfile              # Worker image (poppler + Tesseract spa)
supabase/
  migrations/             # Database source of truth
  functions/              # Edge functions (email dispatcher)
  tests/                  # pgTAP database tests
  seed.sql                # Local test data
types/database.types.ts   # Generated from the database
documentation/            # Spec, implementation plan, architecture docs
.github/workflows/ci.yml  # Lint, types, unit + DB tests, worker image
```

## Background Worker

`worker/` is a second pnpm workspace package: a long-running Node process that consumes Supabase Queues (pgmq) filled by pg_cron. It will run scraping, document processing, matching, and report jobs (see `documentation/mvp-implementation-plan.md`).

```bash
cp worker/.env.example worker/.env.local   # DATABASE_URL, SUPABASE_URL, SUPABASE_SECRET_KEY (from `supabase status`)
pnpm worker:dev                            # watch mode
```

Text extraction shells out to poppler and Tesseract (both in the worker image). To run it outside Docker on macOS: `brew install poppler tesseract tesseract-lang`.

- Ingestion (`ingest` queue): `sync_window` searches HonduCompras by start date (last 7 days), walks every results page, keeps each page's gzipped HTML for 14 days, upserts `procurement_processes`, and enqueues `fetch_detail` for new or changed processes. `fetch_detail` reads the detail page, stores a version when the content changed, records events (created, stage, deadlines, documents), and syncs `source_documents`. Once a day, a 30-day sync catches processes that appear with a start date older than the regular window. Every hour, `private.enqueue_open_rechecks()` enqueues `fetch_detail` for up to 300 open processes not checked in 6 hours, so deadline, stage, and annex changes are caught after a process leaves the window. Each detail fetch also queues `download_document` for the process's files: new files are stored once per content hash in the private `source-documents` bucket, unchanged ones cost a conditional request (304), and a new file under the same link is recorded as `document_replaced`. The files are served by the same server as the portal, so downloads share this queue. One consumer handles all of it, one message at a time, 2–3 s between requests to the portal. A page that no longer matches the parser fails the job instead of storing data. To sync a specific window: `select pgmq.send('ingest', '{"type":"sync_window","from":"2026-09-22","to":"2026-09-23"}')`.
- Extraction (`docs` queue): `extract_document` writes `document_pages` per page from the PDF text layer, or with Tesseract `spa` at 300 dpi when a page has under 100 visible characters (scans); images are OCR'd directly; other formats (docx, xlsx, doc) are marked `unsupported`. It never calls the portal, so it has its own consumer and OCR never delays a sync. Pages are stored as they finish, so an interrupted job resumes. A scanned page takes about 3 s.

- Failed jobs retry with exponential backoff (30 s, 60 s, ... up to 30 min) and are archived as dead letters after their queue's `maxAttempts`, with the error recorded in `worker_job_failures`.
- `SIGTERM` finishes in-flight jobs before exiting; the Docker image runs `node` as PID 1 so Railway's stop signal reaches it.
- Liveness: pg_cron enqueues a heartbeat every minute and the worker records it in `worker_heartbeats`.
- Image: `docker build -f worker/Dockerfile .` (includes poppler and Tesseract with Spanish). Shared modules it imports (`types/`, `lib/ai/`) must not import packages, because the image installs only the worker's dependencies.

AI calls go through Vercel AI Gateway with the AI SDK. `lib/ai/models.ts` maps task roles (`evaluate`, `chat`, `embed`, ...) to gateway model ids; override any role per environment with `AI_MODEL_<ROLE>`.

## Testing

```bash
pnpm test              # Vitest: app, lib, and worker unit tests
pnpm exec supabase test db   # pgTAP: RLS isolation, seats, notifications, billing and credits
```

Unit tests live next to what they validate (`features/*/rbac.test.ts`, `lib/ai/models.test.ts`, `worker/src/queue.test.ts`, `worker/src/honducompras/*.test.ts` against the captured portal pages). Database tests live in `supabase/tests/`; each file creates its own fixtures and rolls back.

CI (`.github/workflows/ci.yml`) runs lint, type checks, and unit tests; migrations, pgTAP, and `supabase db advisors --fail-on warn` on a fresh local stack; and a worker image build.

## Deploying to the Cloud

1. Create a Supabase project (the new API keys / JWT signing keys setup).
2. Link and push the migrations:

```bash
pnpm exec supabase link --project-ref <ref>
pnpm exec supabase db push
```

3. Configure auth email templates in the Supabase dashboard (Authentication → Emails). Sign-up confirmation sends a 6-digit code that users enter on `/verify-email`; paste `supabase/templates/confirmation.html` (it uses `{{ .Token }}`) into **Confirm signup**. Password reset links go through the app's confirm route:

```html
<!-- Reset password -->
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/update-password">Reset Password</a></p>
```

4. Railway `web` service (root of the repo, `pnpm build` / `pnpm start`): set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`, `NEXT_PUBLIC_APP_URL` (production origin), `RESEND_API_KEY` and `EMAIL_FROM` for invitation emails, and `AI_GATEWAY_API_KEY` once chat lands.

   Railway `worker` service: Dockerfile `worker/Dockerfile` with the repository root as build context; set `DATABASE_URL` to the Supabase **Session pooler** connection string (the direct connection is IPv6-only), `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (a secret key from Project Settings → API Keys, for Storage), and `AI_GATEWAY_API_KEY`. Optional `AI_MODEL_<ROLE>` overrides per environment.

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
