# Roadmap — High-Value Improvements

> Snapshot — August 2026  
> Internal planning notes for what would add real value to this multi-tenant SaaS template. Not a commitment to ship everything listed.

## 1. Purpose

Capture the current state of the kit (solid vs partial vs mock), the highest-ROI gaps for a sellable starter, and an explicit deprioritization list. Use this when deciding what to build next.

**Guiding principle:** Prefer closing existing stubs and completing multi-tenant SaaS fundamentals over adding libraries or generic “nice to haves.”

---

## 2. What Is Already Solid

The foundation is strong enough that incremental features should build on it, not replace it.

| Area | Notes |
|---|---|
| Architecture | Feature slices (`actions` → `services` → `repository`), App Router, claims-based auth |
| Auth | Email/password, OAuth initiation (GitHub/Google), reset/confirm/callback flows |
| Onboarding | Profile, theme, create org, join via invite |
| Organizations | Create/switch, logo, settings, leave, ownership transfer, danger zone |
| Memberships | Roster, role changes (`owner` / `admin` / `member` / `viewer`), remove |
| Invitations | Create/resend/revoke/accept, email delivery, token RPC |
| Projects | CRUD, favorites, status/visibility metadata, project-member assignment |
| Storage | `profile-pictures`, `organization-logos` with RLS |
| Audit | `app_events` table, owner/admin reads, dashboard activity, filter/pagination |
| Marketing | Landing page with pricing section |
| Theme | Dark / light / system via `next-themes` |
| Tests | Vitest unit coverage for org/project RBAC helpers and invitation schemas |

---

## 3. Partial / Incomplete

These exist in some form but are not product-complete.

| Item | Gap | Key paths |
|---|---|---|
| Product email | Only org invitation template; auth emails live in Supabase; no welcome / transfer / billing templates | `emails/organization-invitation.tsx` |
| Audit coverage | Selective logging; missing project edits, favorites, profile/security, billing, denied actions | `features/events/` |
| Project `visibility` | Stored/displayed metadata only; RLS still requires org membership / assignment — no public URLs or guests | schema + `project_members` RLS |
| Profile avatar | Upload in onboarding; account profile form has no ongoing avatar control | `components/settings/profile-form.tsx` |
| OAuth | UI + callback present; provider setup is docs-only | `documentation/how-to-implement-*-signup.md` |
| Marketing surface | Single landing route; no docs/blog/legal/SEO CMS | `app/(marketing)/` |
| Global search | Local table/org filters + `cmdk` primitives; no command palette workflow | app shell / UI primitives |
| Test depth | No RLS integration tests, E2E, storage/email/migration smoke tests | `*.test.ts` |

---

## 4. Notable Mocks and Stubs

These are especially visible in demos and settings. Closing them yields outsized perceived quality.

| Surface | Status | Path |
|---|---|---|
| Header notifications bell | Hard-coded fake commerce items; read state is in-memory only | `components/app-shell/header-notifications.tsx` |
| Billing settings | Disabled shell (Pro/Trial, fake usage, disabled upgrade) | `features/settings/components/billing-settings-template.tsx` |
| Notification settings | Disabled defaults | `features/settings/components/notifications-settings-template.tsx` |
| Security settings | `mockSessions`; MFA and revoke disabled | `features/settings/components/security-settings-template.tsx` |
| Integrations settings | Disabled placeholders for API keys / webhooks | `features/settings/components/integrations-settings-template.tsx` |
| Stripe columns | `stripe_customer_id` / `stripe_subscription_id` on `profiles` without a working billing system | schema |

**Related drift:** `features/projects/rbac.ts` comments/helpers may not match newer RLS that restricts member/viewer project reads to creator/assignee. Database RLS remains the source of truth — keep app helpers aligned.

---

## 5. High-Value Gaps (Prioritized)

### Tier 1 — Highest ROI (close stubs + sell the kit)

1. **Billing with Stripe**  
   Checkout, Customer Portal, webhooks, org-scoped subscriptions, plan enforcement. Biggest missing piece for a SaaS starter. UI and DB columns already hint at it.

2. **Real notifications**  
   Persist notifications, preferences, mark-as-read; wire events from invites / memberships / projects. Optionally Supabase Realtime. Replaces the fake header bell and the disabled settings page.

3. **Security account management**  
   MFA (TOTP), active sessions + revoke, email change, account deletion. Replaces `mockSessions` and disabled controls.

4. **Product email templates**  
   Welcome, ownership transfer, member removed, billing receipts / failed payment. Complements the existing invitation email.

### Tier 2 — Premium differentiators

5. **Support impersonation / super-admin**  
   View a tenant as support without breaking RLS. Rare in starters; high operational value.

6. **API keys + outbound webhooks**  
   Org-scoped keys, HMAC signing, delivery retries. Turns the integrations settings stub into a real platform surface.

7. **Entitlements / plan gating**  
   Seat, project, and storage limits tied to billing. Without this, Stripe is payment without product effect.

8. **Command palette**  
   Global search for orgs, projects, settings, members using existing `cmdk` primitives.

### Tier 3 — Trust and polish

9. **RLS + critical-path E2E tests**  
   Invite → accept → role change → project access. Builds buyer confidence beyond unit RBAC helpers.

10. **Broader audit coverage**  
   Project edits, security events, billing changes — reuse existing `app_events` plumbing.

11. **Avatar in account settings**  
   Small consistency fix after onboarding upload.

12. **Legal + export/delete (GDPR-ish)**  
   Privacy/Terms pages plus org data export / account deletion flows.

---

## 6. Explicitly Deprioritized (for now)

Do not treat these as near-term roadmap items unless a concrete product need appears:

| Item | Why deprioritize |
|---|---|
| Full i18n | English-only is fine for the kit; large maintenance cost |
| CMS / blog / changelog | Marketing polish, not core tenancy value |
| Generic feature-flag service | Premature without real experiment needs |
| Zustand / global client store | RSC + Server Actions + thin `OrgProvider` already fit; Zustand only helps for complex shared *UI* state later |
| Client data cache (e.g. TanStack Query) as default | Conflicts with RSC-first data model unless a clear client-heavy surface appears |
| Public project visibility as-is | Metadata without behavior; either implement properly or remove from UI |

### Zustand decision (context)

Zustand was evaluated and **not** recommended as a default dependency. Server data and auth stay on the server (claims + RLS). Local `useState` / Context bridges are enough today. Reconsider only for transversal client UI state (command palette, multi-step panels, ephemeral drafts) that becomes painful with Context alone.

---

## 7. Recommended Build Order

If maximizing impact with limited time:

1. Billing (Stripe)  
2. Notifications (DB + header + settings)  
3. Security (MFA / sessions)  
4. Entitlements (plan limits)  
5. API keys / webhooks  

Emails and audit expansion can land alongside those features as each domain ships events.

---

## 8. Implementation Notes When Picking Up Work

- Follow existing feature-slice patterns under `features/[domain]/`.
- Keep multi-tenant boundaries correct: org scope, membership roles, RLS as source of truth.
- Prefer replacing mocks in place (settings templates + header bell) rather than adding parallel UIs.
- Use `supabase.auth.getClaims()` / `claims.sub` on the server — never `getUser()` as the auth identity pattern.
- Avoid over-abstraction; ship the vertical slice end-to-end (schema → RLS → repository → service → action → UI).

---

## 9. Related Docs

- `documentation/project-overview.md` — what the template is and how it is structured  
- `documentation/how-to-implement-github-signup.md`  
- `documentation/how-to-implement-google-signup.md`
