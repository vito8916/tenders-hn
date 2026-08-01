# Project Overview
> Snapshot — July 2026

## 1. What This Is

A multi-tenant SaaS template — not an app, but the foundation you build one on. Built with Next.js and Supabase, chosen for simplicity: auth, database, storage, and RLS all in one place without extra services. All organizations share the same tables (shared-schema multi-tenancy), with each row scoped by `org_id`. The architecture follows a layered pattern inspired by Laravel — actions → services → repository — to avoid fat controllers and keep business logic decoupled from the framework. It ships with complete flows for auth, onboarding, organizations, and projects, ready to extend.

---

## 2. Tech Stack

| Role | Tool |
|---|---|
| Framework | Next.js (App Router, TypeScript, no `src/`) |
| Runtime UI | React 19 + Server Components |
| Backend | Supabase (Auth, PostgreSQL, Storage, RLS) |
| Styling | Tailwind CSS v4 + shadcn/ui + Radix UI |
| Validation | Zod (runtime + inferred types) |
| Forms | React Hook Form + Zod resolvers |
| Email | Resend + React Email |
| Tables | TanStack Table |
| Notifications | Sonner |
| File uploads | react-dropzone |
| Auth pattern | Claims-based (`supabase.auth.getClaims()`) |

---

## 3. Architecture

### Layers

| Layer | Location | Responsibility |
|---|---|---|
| Presentation | `app/` | Pages, layouts, route groups, loading/error boundaries |
| Application | `features/*/actions.ts` | Server Actions — validate session + input, delegate to services |
| Domain | `features/*/services.ts` | Business logic and orchestration |
| Persistence | `features/*/repository.ts` | Supabase queries and mutations only |

The core rule: **actions never contain business logic**. They validate and delegate. Services own the rules. Repositories own the data.

### Feature Structure

Every domain is self-contained under `features/[domain]/`:

```
features/[domain]/
  actions.ts      # Server Action entrypoints
  services.ts     # Business logic
  repository.ts   # Supabase queries
  schemas.ts      # Zod schemas + inferred types
  components/     # UI colocated with the domain
```

### Routing

- `app/(auth)/` — login, sign-up, forgot/reset password
- `app/(marketing)/` — public landing page
- `app/(app)/` — authenticated area: onboarding, organizations, org-scoped app

The org-scoped area lives under `[orgSlug]/`. Its `layout.tsx` is the central guard: it resolves the slug to an org, validates the user's membership, and provides org context via `OrgProvider` to all child routes.

### Security

Middleware keeps sessions fresh and blocks unauthenticated access to private routes. Inside the app, services enforce RBAC. RLS is the final layer — unauthorized queries are rejected at the database regardless of what the app sends.

---

## 4. What's Built

**Legend:** ✓ complete — ~ partial — ✗ missing

| Module | Status | Notes |
|---|---|---|
| Auth | ✓ | Login, sign-up, forgot/reset password, sign-up-success, OAuth callback, `next` redirect support |
| Onboarding | ✓ | Multi-step flow (profile → org → invites → theme), `requireOnboarding()` guard |
| Organizations | ✓ | List, create, RBAC, actions/services/repository, logo upload, `OrgProvider` context |
| Projects | ✓ | List (TanStack Table), create via slide-in sheet, detail page, favorites in sidebar |
| Profiles | ✓ | Actions, services, repository, settings forms (profile, password, appearance) |
| App shell | ✓ | Sidebar (Dashboard, Projects, Members, Settings), team/project switcher, breadcrumb, user nav |
| Memberships | ✓ | Full slice: list with profiles, role change, remove, leave — wired to members page |
| Invitations | ✓ | Full slice: send (with email), resend, revoke, accept flow at `/invitations/[token]` |
| Database schema | ✓ | Tables live in Supabase; `supabase/migrations/` adds RLS fixes + RPCs (see below) |
| Settings pages | ✓ | `[orgSlug]/settings/account` and `[orgSlug]/settings/organization` (incl. danger zone) |
| Member management | ✓ | `[orgSlug]/members` — members table, role select, remove, pending invitations |
| Email templates | ✓ | `/emails/organization-invitation.tsx` (React Email) sent via `lib/email/resend.ts` |
| App events | ✓ | `features/events/` — audit log via `log_app_event` RPC + Recent Activity on dashboard |
| Dashboard | ✓ | Real counts (projects, members, pending invites) + recent activity for owner/admin |
| Ownership transfer | ✓ | `transfer_organization_ownership` RPC + crown action in members table (owner only) |
| Invited-user onboarding | ✓ | Onboarding detects pending invitations and offers a join flow instead of org creation |
| Project detail | ✓ | Overview + metadata cards, owner name, edit dialog (name, description, status, visibility) |
| Marketing landing | ✓ | Hero, features, and pricing copy |
| Tests | ✓ | Vitest: RBAC matrices (orgs, projects) and invitation schemas — `pnpm test` |

---

## 5. Local Development (Supabase CLI + Docker)

The project is local-first. There is no cloud project; the database schema lives in
`supabase/migrations/20260720000000_initial_schema.sql` — a single baseline with the
complete data model: tables, triggers (including profile auto-creation on sign-up and
owner membership on org creation), final RLS policies, the invitation/audit RPCs
(`accept_invitation`, `get_invitation_by_token`, `log_app_event`), and the two private
storage buckets (`profile-pictures`, `organization-logos`) with their policies.

Key security decisions baked into the baseline:

- `organization_members` has **no INSERT policy**: memberships are created only by
  SECURITY DEFINER paths (org-creation trigger, `accept_invitation`), so roles cannot be forged.
- Role changes are owner-only, never on their own row, and never to `owner` — ownership
  moves only through the atomic `transfer_organization_ownership` RPC
  (migration `20260720120000`), which also demotes the previous owner to admin.
- `user_org_role()` / `shares_org_with()` (SECURITY DEFINER) power the policies without RLS recursion.
- `list_my_pending_invitations` (SECURITY DEFINER) lets a just-signed-up user see
  invitations addressed to their verified email before they have any membership.

### Daily workflow

```bash
pnpm exec supabase start    # start the local stack (Docker)
pnpm dev                    # Next.js against .env.local (http://127.0.0.1:54321)
pnpm exec supabase stop     # stop containers (keeps data)
```

- Studio: http://127.0.0.1:54323 — Mailpit (emails sent by Supabase auth): http://127.0.0.1:54324
- Test account (seeded): `test@mtsupanextkit.app` / `12345678`
- Sign-up email confirmation is disabled locally (`enable_confirmations = false` in config.toml)

### Changing the schema

```bash
pnpm exec supabase migration new <name>   # write SQL in the generated file
pnpm exec supabase db reset               # replay all migrations + seed.sql
pnpm exec supabase gen types typescript --local > types/database.types.ts
```

### Email (Resend)

`RESEND_API_KEY` / `EMAIL_FROM` are optional in local dev: invitation rows are still
created and the members page offers resend; only delivery fails without them. Set them
(plus `NEXT_PUBLIC_APP_URL`) to send real invitation emails.

### Going to the cloud later

Create a project, `pnpm exec supabase link --project-ref <ref>`, then `pnpm exec supabase db push`
to apply the same migrations. Update env vars with the cloud URL and publishable key.

---

## 6. Next Steps

All planned polish items are done (see section 4). Ideas for when you build on top:

1. **Real billing** — the pricing section is display-only; wire Stripe when plans become real
2. **Project workspace** — tasks, documents, or reports inside the project detail page
3. **Notifications** — the bell in the header is decorative; back it with `app_events`
