# MVP Implementation Plan — Tenders HN

> Snapshot — 23 September 2026 (rev. 2: AI SDK + AI Gateway, multi-provider models, Railway, Spanish UI)
> Companion to `documentation/MVP_Specification.md` (v0.3). The spec says **what** the product does; this document says **how and in which order** we build it on top of the current codebase. Section references like §6 point to the spec.

---

## 1. How to Use This Document

- Build phase by phase (section 8). Each phase ends with acceptance criteria taken from spec §13; a phase is done when those pass locally and in staging.
- Section 6 separates decisions already made from open ones. Resolve each open decision before its phase starts; the recommendation is the default if nobody objects.
- When a phase changes the plan, update this file in the same PR.

**Product rule (spec §15):** success is not capturing many processes; it is helping a company find, in time, the few opportunities worth its review. When a trade-off appears, favor fewer missed relevant opportunities (false negatives) over fewer false positives.

---

## 2. Where We Are

The multi-tenant foundation is in place. Everything below is committed and running locally.

| Area | Status | Where |
|---|---|---|
| Auth, onboarding, organizations, memberships, invitations, ownership transfer | Done | `features/*`, baseline migration |
| Audit log (`app_events`) with filters and pagination | Done | `features/events` |
| Plans, organization subscriptions, read-only mode without a plan | Done (backend) | `*_billing_and_entitlements.sql` |
| Seat limits (members + pending invitations) | Done, enforced in DB | invitation trigger, `accept_invitation` |
| AI credit ledger with reserve / commit / release (idempotent, service-role only) | Done (backend) | same migration |
| Notifications: catalog, preferences, in-app inbox (Realtime), email outbox + edge function dispatcher | Done | `features/notifications`, `*_notifications.sql`, `supabase/functions/send-notification-emails` |
| Scheduled jobs (pg_cron): expiry, expiry warnings, monthly credits, reservation cleanup, email dispatch, retention | Done | `*_scheduled_jobs.sql` |
| Local dev isolated from other projects (ports 553xx, app on 3001, own auth cookie) | Done | `supabase/config.toml`, `lib/supabase/auth-cookie.ts` |
| Projects feature (template demo) | Removed | — |
| Phase 0: worker, queues, AI layer (Jev + chat via AI Gateway verified), pgTAP tests, CI | Done | `worker/`, `lib/ai/`, `supabase/tests/`, `.github/workflows/ci.yml` |
| Phase 1 spike: HonduCompras search, paging, and details reproduced over HTTP | Done | section 8, Phase 1; fixtures in `worker/src/honducompras/__fixtures__/` |
| Phase 1: source tables, `ingest.sync_window`, `ingest.fetch_detail`, parser tests | Done | `*_source_data.sql`, `worker/src/honducompras/`, `worker/src/jobs/` |

Still template-grade and to be replaced during the phases below: billing settings page (mock), security and integrations settings (mock), marketing pages, English UI text.

**Not in this repo:** the platform admin panel (plan activation, ingestion monitoring, support, AI model rates) is a separate project. It reads and writes this database with the service role; this repo owns the schema and migrations.

---

## 3. Architectural Principles

1. **Supabase is the system of record and the coordination layer.** Postgres holds processes, documents, matches, runs, and queues (pgmq). Storage holds files. No second database, no external queue service.
2. **Heavy work runs in a long-lived Node worker, not in Next.js or Edge Functions.** Scraping, PDF download, OCR, embeddings, Jev calls, and PDF report rendering take minutes and need system tools (poppler, Tesseract). The existing email dispatcher stays an Edge Function (short, bursty work).
3. **Every job is idempotent and retryable.** Natural keys and unique constraints make repeated work a no-op (spec §10, §13): one row per source process, one document version per content hash, one evaluation per (candidate, inputs, model) combination, one run in flight per saved search.
4. **Shared public data vs private org data.** Procurement processes and documents are public, captured once, shared by all organizations. Profiles, searches, runs, matches, feedback, and chat are private per organization and protected by RLS.
5. **Runs are frozen snapshots.** A `search_run` stores its configuration, profile version, the ingestion state it used, the models it used, and a denormalized copy of each matched process as it was at that moment (spec §7). Later changes never rewrite history.
6. **Verifiable evidence over generated text.** Relevance reasons are built from retrieved fields and document fragments (file + page). Every citation a model produces is checked against the passages it was actually given before it reaches the UI (spec §5.6, §8).
7. **Provider-agnostic AI.** All model calls go through the AI SDK and Vercel AI Gateway, addressed by task role (evaluate, chat, embed, rerank, vision) rather than by vendor. Model ids are configuration; every AI output records the model that produced it; a model becomes the default for a role only after it wins on our evaluation sets.
8. **Limits live in the database.** Plan limits are enforced by triggers, RLS, and service-role-only RPCs, exactly like seats and credits today. The UI reads `get_organization_entitlements` to explain limits but is never the only guard.
9. **Follow the existing slice pattern.** New domains go in `features/[domain]/` with `schemas → repository → services → actions → components`; server-side reads in RSC; claims-based auth.

---

## 4. Target Architecture

```
                         ┌──────────────────── Supabase Cloud ─────────────────────┐
                         │ Postgres                                                 │
                         │  ├─ shared: procurement_processes, process_versions,    │
                         │  │          documents, document_chunks (FTS + pgvector), │
                         │  │          source_sync_runs, ai_usage_events            │
                         │  ├─ private: company_profiles, saved_searches,          │
                         │  │           search_runs, search_run_matches,           │
                         │  │           match_evaluations, feedback, chat (RLS)    │
                         │  ├─ pgmq queues ◄── pg_cron (schedules, due searches)   │
                         │  └─ notifications + outbox (existing)                  │
                         │ Storage: source-documents (shared), reports (per org)   │
                         │ Edge Function: send-notification-emails (existing)      │
                         └─────────▲──────────────────────────────▲────────────────┘
                                   │ service role / direct PG      │ user session (RLS)
 HonduCompras ◄── HTTP ──┐         │                               │
               ┌─────────┴─────────┴──────────┐    ┌───────────────┴────────────┐
   Railway     │ worker (Node, Docker)        │    │ web: Next.js (`next start`)│
   project     │  ingest · documents · OCR    │    │  Home, searches, results,  │
               │  embeddings · matching       │    │  detail, chat, settings    │
               │  report PDF · search runs    │    └───────────────┬────────────┘
               └──────────────┬───────────────┘                    │
                              │         AI SDK (`ai`)              │
                              └──────────────┬─────────────────────┘
                                             ▼
                              ┌──────── Vercel AI Gateway ────────┐
                              │ typesafe-ai/jev   (evaluate)       │
                              │ chat models: Claude, GPT-6 Luna,   │
                              │   DeepSeek, … (by role config)     │
                              │ embedding + rerank models          │
                              │ budgets · fallbacks · request logs │
                              └────────────────────────────────────┘
   Platform admin app (separate project) ──service role──► Supabase
```

| Component | Responsibility | Tech |
|---|---|---|
| `web` (Railway service) | The Next.js app: UI, Server Actions, route handlers (chat streaming, CSV) | `next start` on Node; AI SDK `streamText` + `@ai-sdk/react` `useChat` for chat |
| `worker` (Railway service) | Queue consumers for ingestion, documents, matching, reports, search runs | Node 24 + TypeScript, `pg` for queues/SQL, `@supabase/supabase-js` (service role) for Storage, `cheerio` for HTML, `poppler-utils` + Tesseract (`spa`) in its Docker image, AI SDK for embeddings / Jev / rerank |
| Queues | Durable, retryable jobs with visibility timeouts | Supabase Queues (pgmq), one queue per job type |
| Scheduling | Central sync cadence, open-process rechecks, due searches, housekeeping | pg_cron enqueues into pgmq (the worker never schedules itself; Railway cron is not needed) |
| AI access | One key, one bill, one log for every model | Vercel AI Gateway via API key (`AI_GATEWAY_API_KEY`); works from Railway, no Vercel hosting required |
| Retrieval | Candidate recall | Postgres FTS (`spanish` + `unaccent`), `pg_trgm`, UNSPSC codes, pgvector; optional rerank model |
| Matching | Semantic fit of candidates | Jev, `typesafe-ai/jev`, through AI SDK `experimental_evaluate` |
| Chat | Answers grounded in documents, with page citations | AI SDK + gateway chat model (configurable), citations enforced by our own verified scheme (section 5.4) |
| Reports | Frozen PDF per run, CSV on demand | PDF rendered by the worker (`@react-pdf/renderer`); CSV streamed by a Next.js route handler |
| Email | Report and change alerts | Existing notification outbox + dispatcher, extended with templates |

### 4.1 What the `worker/` package is

A second program in this repository that runs permanently next to the web app and does the slow background work: walking HonduCompras page by page, downloading and reading PDFs (OCR for scans), embedding text, asking Jev whether candidates fit a company, running scheduled searches, and rendering report PDFs. It pulls jobs from Supabase queues, retries failures, and resumes after restarts. It has no UI; users see its results through the database.

It is separate from Next.js because this work takes minutes (hundreds of polite requests, OCR), needs system tools inside its container, and must survive deploys and crashes without losing jobs.

### 4.2 Repo layout

- Next.js stays at the root. `worker/` is a second pnpm workspace package (`packages: [".", "worker"]` in `pnpm-workspace.yaml`), started locally with `pnpm --filter worker dev`.
- Shared code the worker imports through a TS path alias: `types/database.types.ts`, Zod schemas that describe shared data, and `lib/ai/` (the model registry and AI helpers, section 5).
- Pure logic (parsers, retrieval scoring, relevance composition, citation validation) lives in plain modules with Vitest tests.
- Railway deploys both services from this repo: `web` builds the root app; `worker` builds `worker/Dockerfile` (adds poppler and Tesseract `spa`).

---

## 5. AI Layer

### 5.1 Task roles and the model registry

Code never names a vendor model inline. It asks `lib/ai/models.ts` for the model assigned to a role:

| Role | Used by | Default for now | How the default is chosen |
|---|---|---|---|
| `evaluate` | Matching (Phase 3) | `typesafe-ai/jev` | Spec requires Jev; compared against rules-only and an LLM-classifier arm on the labeled set |
| `chat` | Chat with sources (Phase 5) | To be chosen among Claude, GPT-6 Luna, DeepSeek, and others on the gateway | Chat evaluation set (5.5) |
| `embed` | Chunk and query embeddings (Phase 2) | Chosen on retrieval recall | Retrieval evaluation on the labeled set |
| `rerank` | Optional candidate ordering before Jev (Phase 3) | Off until it proves it reduces misses or Jev calls | Labeled set |
| `vision` | OCR fallback for pages Tesseract cannot read (Phase 2) | Off until measured OCR quality requires it | Fixture scans |
| `extract` | Later: structured requirement extraction from pliegos (spec §1) | Not in MVP scope unless time allows | — |

- Defaults live in code; each role can be overridden per environment (`AI_MODEL_CHAT`, `AI_MODEL_EMBED`, ...), so trying a new provider in staging is a config change.
- Gateway model fallbacks are configured per role (e.g. chat falls back to a second provider) so an outage does not take the feature down.
- Every AI call records role, model id as returned by the response, token usage, latency, and status in `ai_usage_events` (spec §10), with `org_id` when the work belongs to an organization. This is the data for cost measurement (spec §14.3) and credit pricing.

### 5.2 Jev through AI SDK

- Called with `experimental_evaluate({ model: 'typesafe-ai/jev', state, questions })` from `ai`. Question types in the AI SDK are `boolean` (Jev's "Noul"), `score`, and `choice`.
- The function is experimental: pin the `ai` version and keep every call in one module (`worker/src/matching/evaluate.ts`) so an API change touches one file.
- Jev's context window is **32K tokens**. The `state` (company offering, exclusions, process object, metadata, fragments labeled by file/page) must fit a fixed budget; fragments are added in retrieval-score order and anything left out is recorded as partial evidence in the run's coverage.
- Price listed on the gateway: $0.042 per 1M input tokens, so evaluation cost is small next to OCR and chat; still recorded per call.

### 5.3 Credits across providers

Credits stay provider-neutral. A new table `ai_model_rates` (managed from the admin app) holds credits per 1K input/output tokens per model id. Chat flow: estimate → `reserve_ai_credits` → stream → `commit_ai_credits` with credits computed from actual usage and the model's rate → `release_ai_credits` on error or abort. Switching the chat model never double-charges and never needs a code change to pricing. Matching (Jev), embeddings, and report generation are included in the plan and never charge credits (spec §9).

### 5.4 Citations that work with any model

Provider-native citation features are not available uniformly across models or through the AI SDK, so the product uses one scheme for all of them:

1. Retrieval selects passages and gives each a source id: `[S3] Pliego LPN-008-2026.pdf, pág. 12`.
2. The chat model is instructed to answer in Spanish and cite source ids inline.
3. After the response, the server validates every cited id against the passages sent; unknown ids are removed and the message is flagged; answers with no valid citation for a factual claim are shown with a clear "sin fuente verificada" notice.
4. `chat_messages.citations` stores the validated ids with document, version, and page, so the UI links each citation to the file page and the official source.

This satisfies spec §8 ("citar documento y página") and §5.6 (no citation shown without verification) independently of the provider.

### 5.5 Evaluation sets decide models

- **Matching:** the labeled set from Phase 3 (profiles × processes). Metric: missed relevant opportunities first, then false positives, latency, cost.
- **Retrieval/embeddings:** recall of the labeled relevant processes and pages at the candidate cutoff.
- **Chat:** a golden set of Spanish questions over real processes (including `LPN-008-2026` with documents and `CM 39-019-2026` without) with expected pages. Metrics: citation validity, answer correctness, refusal to speculate on eligibility, Spanish quality, latency, cost per answer. Each candidate model (Claude, GPT-6 Luna, DeepSeek, others) runs the same set before it can become the `chat` default.

### 5.6 Data handling

Company profiles and chat questions are private customer data. Before a provider is allowed for a role, check its data-retention and training terms and restrict routing with the gateway's provider controls; public procurement text has fewer constraints than customer questions. Keep an allowlist of providers per role in the registry.

---

## 6. Decisions

### 6.1 Decided

| # | Decision | Consequence |
|---|---|---|
| D1 | **Spanish-only UI** | No i18n framework. Translate existing screens, Zod messages, SQL notification texts, email templates, and Supabase auth emails at the start of Phase 4; dates with `date-fns` `es`; FTS uses the `spanish` config. |
| D2 | **Railway** for the `web` and `worker` services; **Supabase Cloud** for database, auth, storage, Realtime, pg_cron, Vault | Self-hosting Supabase on Railway is possible but adds backups, upgrades, and Auth/Realtime operations for no product gain. Railway PR environments point at a staging Supabase project. |
| D3 | **AI SDK** for every model call | `streamText`/`useChat` for chat, `embedMany` for embeddings, `rerank`, `experimental_evaluate` for Jev. |
| D4 | **Multi-provider by design** | Role-based registry, per-environment overrides, `ai_usage_events`, provider-neutral credits and citations (section 5). |

### 6.2 Open

| # | Decision | Recommendation | Needed by |
|---|---|---|---|
| O1 | Gateway | **Vercel AI Gateway.** It serves Jev (`typesafe-ai/jev`) plus chat, embedding, and rerank models under one key, adds no markup to token prices, and has budgets, fallbacks, and request logs. OpenRouter has no Jev, so it would mean a second integration for matching. | Phase 0 |
| O2 | OCR | Text layer first (`pdftotext`), Tesseract `spa` for pages without usable text; add the `vision` role only if measured OCR quality blocks matching. | Phase 2 |
| O3 | Embedding model | Pick by retrieval recall on the labeled set. pgvector indexes need a fixed dimension, so one active embedding model at a time; changing it means re-embedding (tracked by `embedding_model`). | Phase 2 |
| O4 | Jev version pinning | Record the model version returned on every evaluation; ask TypeSafe/Vercel whether versioned ids exist and pin during calibration so thresholds stay valid. | Phase 3 |
| O5 | Default chat model | Chosen by the chat evaluation set (5.5) among Claude, GPT-6 Luna, DeepSeek, and others, subject to 5.6. | Phase 5 |
| O6 | Central sync cadence | Start every **3 hours** with a 7-day overlap window (spec §6) plus a daily 30-day sync while measuring; adjust after the measurement ends on 1 Oct 2026. | Phase 1 |
| O7 | Access and content use | Review HonduCompras terms and attribution before operating commercially (spec §14.5). Always link the official source. | Before the pilot |
| O8 | Retention | Keep source documents and texts during the pilot; define the deletion policy before commercial launch (spec §10). | Phase 6 |

---

## 7. Data Model

New tables follow the current conventions: `org_id` for org-scoped rows, explicit grants per table, RLS on every table, SECURITY DEFINER helpers in `private`, service-role-only write paths for anything computed by the worker.

### 7.1 Shared source data (written by the worker only; readable by any member of an organization)

| Table | Key columns and constraints |
|---|---|
| `source_sync_runs` | `id`, `source` (`honducompras_v1`), `window_start`, `window_end`, `status` (`running`/`succeeded`/`failed`/`partial`), `pages_expected`, `pages_fetched`, `processes_seen`, `processes_new`, `processes_changed`, `error`, `started_at`, `finished_at`. The latest `succeeded` row is "última ingesta completa". |
| `source_pages` | `sync_run_id`, `page_number`, `status`, `row_count`, `html_sha256`, `storage_path` (raw HTML kept for debugging/parser changes), `fetched_at`. Unique `(sync_run_id, page_number)`. |
| `procurement_processes` | `id`, `source`, `source_process_key` (decoded `Id0:Id1:Id2` from the detail link, e.g. `117:1:LPN-008-2026`), `expediente` (display only), `ocid` (nullable), `buyer_entity`, `purchase_unit`, `title`, `stage`, `modality`, `acquisition_type`, `source_start_at`, `closes_at`, `detail_url`, `current_version_id`, `first_seen_at`, `last_seen_at`, `last_checked_at`, `is_open`. Unique `(source, source_process_key)`. FTS `tsvector` generated from title + entity + object; trigram index on `expediente`. |
| `process_versions` | `id`, `process_id`, `content_sha256`, `detail` (jsonb: full object, dates with times, source of funds, UNSPSC items and quantities, place of bid reception, bid document value, contact name/phone/email — kept by decision), `observed_at`. Unique `(process_id, content_sha256)`. |
| `process_events` | `process_id`, `version_id`, `kind` (`created`, `stage_changed`, `deadline_changed`, `document_added`, `document_replaced`, `document_removed`), `before`, `after`, `observed_at`. Drives "actualizada" and change alerts. |
| `source_documents` | `id`, `process_id`, `source_url`, `title`, `kind` (aviso, pliego, anexo, other), `first_seen_at`, `last_seen_at`, `removed_at`. Unique `(process_id, source_url)`. |
| `document_versions` | `id`, `document_id`, `sha256`, `byte_size`, `mime_type`, `storage_path`, `page_count`, `extraction_status` (`pending`/`text`/`ocr`/`partial`/`failed`), `extraction_error`, `downloaded_at`. Unique `(document_id, sha256)` — downloaded once per version (spec §6). |
| `document_pages` | `document_version_id`, `page_number`, `text`, `method` (`text_layer`/`ocr`/`vision`), `ocr_confidence`. Unique `(document_version_id, page_number)`. |
| `document_chunks` | `id`, `document_version_id`, `page_start`, `page_end`, `ordinal`, `content`, `tsv` (FTS), `embedding vector(N)`, `embedding_model`. HNSW index on `embedding`, GIN on `tsv`. |

RLS: `select` for authenticated users who belong to at least one organization; no client writes. Storage bucket `source-documents` is private; the app serves files through short-lived signed URLs and always offers the official link too.

### 7.2 Org-private data

| Table | Key columns and constraints |
|---|---|
| `company_profiles` | `org_id` (PK), `description`, `offerings` (text[] of concrete examples), `keywords`, `synonyms`, `exclusions`, `unspsc_codes`, `locations`, `preferred_entities`, `preferred_modalities`, `version` (incremented on every change), `updated_by`, `updated_at`. |
| `company_profile_versions` | Immutable copy per `version` so runs can reference exactly what was evaluated. |
| `saved_searches` | `id`, `org_id`, `name`, `inherits_profile` (bool), extra `keywords`, `exclusions`, `entities`, `modalities`, `acquisition_types`, `schedule` (interval or preset), `next_run_at`, `delivery` (jsonb: `save_only`, `email`, `email_when_empty`, `alert_on_changes`), `is_active`, `created_by`. |
| `search_runs` | `id`, `org_id`, `saved_search_id`, `trigger` (`schedule`/`manual`), `status` (`queued`/`running`/`completed`/`partial`/`failed`), `config_snapshot` jsonb (includes the models used per role), `profile_version`, `sync_run_id` (ingestion used), `source_synced_at`, `processes_examined`, `candidates`, `matches_count`, `coverage` jsonb (OCR gaps, pending evaluations, truncated evidence, caps applied), `report_path`, `created_by`, `started_at`, `completed_at`. **Partial unique index on `saved_search_id` where status in (`queued`,`running`)** → "Ejecutar ahora" cannot double-start (spec §12.1). |
| `search_run_matches` | `run_id`, `org_id`, `process_id`, `process_version_id`, `relevance` (`muy_relevante`/`posible`/`descartada`/`pendiente`), `match_state` (`nueva`/`actualizada`/`conocida`), `score` (composite), `reasons` jsonb (each with source field or document/page), `evaluation_id`, plus a denormalized snapshot (`expediente`, `title`, `buyer_entity`, `modality`, `stage`, `closes_at`, `has_documents`, `first_seen_at`) for fast facets and frozen history. Unique `(run_id, process_id)`. |
| `match_evaluations` | `id`, `process_version_id`, `input_hash` (profile/search version + fragments + questions version + model id), `model` (as returned), `questions_version`, `request` jsonb, `answers` jsonb (values + probabilities), `usage`, `latency_ms`, `status` (`succeeded`/`failed`/`pending`), `attempts`, `error`. Unique `input_hash` → identical inputs are never evaluated twice, and comparing models never overwrites each other's results. Service-role only; users see results through `search_run_matches`. |
| `opportunity_feedback` | `org_id`, `process_id`, `saved_search_id`, `decision` (`interesa`/`no_interesa`), `reason`, `user_id`, `created_at`. Unique `(org_id, process_id, user_id)`. |
| `opportunity_notifications` | `org_id`, `saved_search_id`, `process_id`, `last_notified_version_id`, `last_notified_at`. Prevents re-sending the same opportunity unless it changed (spec §7). |
| `chat_threads` / `chat_messages` | Thread: `org_id`, `context_type` (`opportunity`/`report`), `process_id` or `search_run_id`, `created_by`. Message: `role`, `content`, `citations` jsonb (validated source ids → document version + page), `model`, `usage`, `credits_charged`, `credit_reservation_id`. |

### 7.3 AI operations (service role only; readable by the admin project)

| Table | Key columns and constraints |
|---|---|
| `ai_usage_events` | `id`, `org_id` (nullable for shared work), `role`, `model`, `input_tokens`, `output_tokens`, `latency_ms`, `status`, `error`, `reference` (evaluation, chat message, document version…), `created_at`. |
| `ai_model_rates` | `model` (PK), `credits_per_1k_input`, `credits_per_1k_output`, `is_enabled`, `updated_at`. Read by the chat flow to compute credits; edited from the admin app. |

### 7.4 Entitlements for the new tables

| Plan limit | Enforcement |
|---|---|
| `max_active_searches` | BEFORE INSERT/UPDATE trigger on `saved_searches` when `is_active`, with the same per-org advisory lock pattern as seats. |
| `min_schedule_interval` | Same trigger rejects schedules shorter than the plan allows (`schedule_interval_not_allowed`). |
| `history_months` | RLS on `search_runs` / `search_run_matches`: visible when `created_at >= now() - history_months` of the org's current (or last) plan. |
| Read-only without plan | Insert policies on `saved_searches`, `search_runs` (manual), `chat_messages` require `private.active_plan_id(org_id) is not null`; scheduled runs are skipped for inactive orgs. |
| AI credits | Chat and requested document analysis: `reserve_ai_credits` → model via AI Gateway → `commit_ai_credits` (credits from usage × `ai_model_rates`) or `release_ai_credits`. Matching, embeddings, and reports never charge credits (spec §9). |

---

## 8. Phases

Rough sizes: **S** ≤ 3 days, **M** 1–2 weeks, **L** 2–4 weeks, for one developer. Each phase lists what "done" means.

### Phase 0 — Groundwork (S)

- Scaffold `worker/`: package, TS config, env loading, pgmq consumer loop with graceful shutdown, structured logging, `pnpm --filter worker dev` against the local stack (`postgresql://postgres:postgres@127.0.0.1:55322/postgres`), `worker/Dockerfile` with poppler and Tesseract `spa`.
- AI layer scaffold: install `ai` (pinned), `lib/ai/models.ts` role registry with env overrides, `AI_GATEWAY_API_KEY` in `.env.local` / worker env, `ai_usage_events` and `ai_model_rates` tables, and a smoke script that calls each enabled role once (including `experimental_evaluate` on Jev).
- Migration: enable `vector`, `pg_trgm`, `unaccent`, `pgmq`; create queues.
- Convert the ad-hoc backend verification script into pgTAP tests under `supabase/tests` (`supabase test db`), and keep adding tests per phase.
- CI: lint, type-check, Vitest, `supabase db reset` + `supabase test db` + `supabase db advisors --fail-on warn`.
- Railway project with `web` and `worker` services, staging Supabase project, PR environments (can wait until Phase 1 produces data).

**Done when:** the worker consumes a no-op job enqueued by pg_cron locally; the AI smoke script reaches Jev and one chat model through the gateway and logs both in `ai_usage_events`; CI runs the DB tests.

### Phase 1 — Ingestion prototype (M) — spec §2, §6

- ~~Spike~~ **Done (23 Sep 2026).** Findings the implementation must follow:
  - **User-Agent:** send `Mozilla/5.0 (compatible; TendersHN/0.1)`. An unrecognized UA gets ASP.NET "downlevel" handling and the date filter is silently ignored (unfiltered results, inputs echo "(Todas)"). No contact info in the UA (owner's choice); never impersonate a specific browser.
  - **Search:** GET the form, then POST every hidden field it returned (`__VIEWSTATE`, `__EVENTVALIDATION`, …) plus `ctl00$cphCuerpo$wpParametros$wdInicio_hidden` / `wdFin_hidden` = `<DateChooser Value="2026x9x22"></DateChooser>` **already URL-encoded** (JS `escape` style, `/` kept; the form encoding then encodes it again), the visible `ctl00_cphCuerpo_wpParametros_wdInicio_input` / `wdFin_input` = `22/09/2026`, and `ctl00$cphCuerpo$wpParametros$btnBuscar=Buscar`. Sending the XML raw returns HTTP 500 (request validation).
  - **Paging:** POST the previous page's form with `__EVENTTARGET=ctl00$cphCuerpo$gvResultados` and `__EVENTARGUMENT=Page$N`; the date filter is preserved. 30 rows per page; 22–23 Sep 2026 had 12 pages. No session cookie; state lives in ViewState.
  - **Rows:** expediente, entity, purchase unit, object (truncated), stage, modality, start and close dates, and a detail link.
  - **Detail links:** `ProcesoHistorico.aspx?Id0=…&Id1=…&Id2=…`; each value is base64 of UTF-32LE text plus `-<signature>`. Decoded: `Id0` institution code (117 = IHSS, also in PDF names), `Id1` small integer, `Id2` expediente. The key is the decoded triple; the signatures cannot be generated, so store and follow the portal's links.
  - **Detail page:** full object, start / bid reception / clarification deadline with times, source of funds, modality, stage, acquisition type, place of bid reception, bid document value, contact (name, phone, email — stored), UNSPSC products with quantities, and a documents table with PDFs on `http://h1.honducompras.gob.hn/Docs/`. `LPN-008-2026` has 3 PDFs; `CM 39-019-2026` has none.
  - **Fixtures** (captured that day, used by parser tests): `worker/src/honducompras/__fixtures__/` — search form, window 22–23 Sep pages 1–2, both detail pages.
- ~~`ingest.sync_window` job~~ **Done (24 Sep 2026).** Submits the window (today − 7 days → today, Honduras time), walks every page, stores each page's gzipped HTML in the private `source-pages` bucket (kept 14 days), upserts `procurement_processes`, and enqueues `ingest.fetch_detail` for new or changed rows (skipped when one is already waiting). Listing values only fill a process until its detail has been read. Verified live on 22–23 Sep: 12/12 pages, 335 processes, all start dates inside the window.
- ~~`ingest.fetch_detail` job~~ **Done (24 Sep 2026).** Parses the full object, dates with times, funding, acquisition type, products/UNSPSC, contact, and document links; writes `process_versions` on content change; emits `process_events`; syncs `source_documents` (`removed_at` when a link disappears). Enqueuing downloads waits for the `docs.download` consumer in Phase 2; a document replaced under the same URL (`document_replaced`) is detected there by content hash.
- Implementation notes: both jobs share the `ingest` queue with a single consumer, so the portal sees one request at a time (2–3 s apart, two retries with backoff per request, three attempts per job). A page that fails the parser-health checks (form state, result headers, row layout, detail table, product and document grids) fails the job and marks the run `failed`/`partial`; its raw HTML is still stored. `is_open` was dropped in favor of `closes_at` (a stored flag goes stale); `source_pages` is service-role only. The worker needs `SUPABASE_URL` and `SUPABASE_SECRET_KEY` for Storage.
- ~~`ingest.recheck_open` schedule~~ **Done (24 Sep 2026).** pg_cron runs `private.enqueue_open_rechecks()` every hour at :30 and enqueues ordinary `fetch_detail` jobs for up to 300 processes that are open (closing in the future or within the last day) and were not checked in the last 6 hours, oldest check first, skipping any already queued. This covers processes outside the moving window and annexes on processes inside it, which the results list does not show. The batch is sized so syncs never wait long behind it on the shared consumer.
- Politeness and safety: one session at a time, 2–3 s between requests, bounded retries with backoff, a parser-health check (expected headers/fields present) that marks the run `failed` instead of storing garbage.
- Freshness measurement (spec §14.1): **set up 24 Sep 2026, runs until 1 Oct 2026.** The first production syncs showed processes appearing with start dates 1, 6, and 7 days old, so the 7-day window can miss processes that appear later than that. pg_cron now also enqueues a 30-day sync every day at 04:00 Honduras (`private.enqueue_ingest_wide_sync`), and the service-role view `process_arrivals` lists every process that appeared after an earlier successful sync had covered its start date (backfill is left out), with `appearance_lag`, `start_days_before_first_seen`, and the window size of the sync that found it. The first wide sync backfills about three weeks of processes and their detail pages (a few hours on the single consumer), delaying that morning's regular syncs once. At the end of the week:
  - Misses of the regular window: `select * from process_arrivals where start_days_before_first_seen > 7`. None → drop the daily wide sync; some → keep it (or widen the regular window) and size it from the largest lag.
  - Cadence: arrivals per run and per Honduras hour, `select date_trunc('hour', first_seen_at at time zone 'America/Tegucigalpa'), count(*) from process_arrivals group by 1 order by 1`, and `processes_new` per run in `source_sync_runs`. Record the decision in O6.
- ~~Source health read model for the admin project~~ **Done (24 Sep 2026).** `source_health` is a view over `source_sync_runs` with one row per source: the latest run (status, pages, error), the last successful sync with its age, pages, and processes, and failed or partial runs in the last 24 hours. The pgmq archive keeps no error, so the worker also records each job that exhausts its attempts (and each unknown message) in `worker_job_failures` with the error, in the same statement that archives it. Both are service role only.

**Done when (spec §13):** a dated search reproduces the full set of pages and processes page 2+ without losing the filter; repeated syncs create no duplicate processes or documents; `LPN-008-2026` (IHSS) shows its three document links; `CM 39-019-2026` is stored with no documents as a valid state; a portal failure is recorded and never reported as "no new opportunities".

### Phase 2 — Documents and retrieval index (M) — spec §5.3, §6

- ~~`docs.download` job~~ **Done (24 Sep 2026)** as `download_document` on the `ingest` queue: `sicc` (portal) and `h1` (documents) resolve to the same server, so downloads share the single consumer that keeps it at one request at a time. Every detail fetch queues a check of the process's files; files are stored under `source-documents/<process_id>/<sha256>.<ext>`, one `document_versions` row per hash. The server sends `ETag`/`Last-Modified`, so rechecks of unchanged files are 304s; a new hash under the same link records `document_replaced` (spec §14.2). A missing file (e.g. 404) or one over 50 MB is recorded in `source_documents.download_error` without failing the job.
- ~~`docs.extract` job~~ **Done (24 Sep 2026)** as `extract_document` on its own `docs` queue (CPU only, so OCR never delays a sync): `pdftotext` per page; pages under 100 visible characters are rendered at 300 dpi and read by Tesseract `spa`; images are OCR'd directly; `document_pages` records the method and mean word confidence; `extraction_status` is `text`, `ocr`, `partial` (some pages failed), `failed`, or `unsupported` (docx/xlsx/doc, about 4% of links). Pages are stored as they finish, so an interrupted job resumes. The `vision` role stays off (O2). Verified on LPN-008-2026: the pliego (52 pages) reads from its text layer; the aviso and anexos are scans, OCR'd at 86% and 92% mean confidence (about 3 s per page), and "soporte funcional SAP" matches pages in all three.
- `docs.chunk_embed` job: chunk by page with overlap, fill `tsv`, embed with `embedMany` using the `embed` role, store `embedding_model`.
- Candidate retrieval function (SQL, service role): FTS (`spanish` + `unaccent`) over process fields and chunks, profile keywords and synonyms, trigram on names, UNSPSC matches, and vector similarity; returns candidates with the fields and fragments that matched. Recall threshold favors inclusion (spec §5.4).
- Choose the embedding model (O3) by recall on a first slice of the labeled set; measure document volume, sizes, OCR time, and embedding cost per day (spec §14.3).

**Done when:** every downloadable document of the IHSS example is stored once, extracted, and searchable; a term that appears only inside a pliego or anexo is retrieved as a candidate with its file and page.

### Phase 3 — Matching with Jev and a test inbox (L) — spec §5, §14.4

- **Labeled set first.** 3–5 test company profiles (including a software/SAP profile and an unrelated one) × a few hundred real processes labeled relevant / not relevant, stored as fixtures in the repo.
- `match.evaluate` job per candidate: one `experimental_evaluate` call to `typesafe-ai/jev` with a `state` built within the 32K budget (section 5.2) and three questions in the same request:
  - `in_scope` — `boolean`: does the requested scope correspond to what the company sells?
  - `match_strength` — `score` with defined levels (none / weak / partial / strong).
  - `insufficient_evidence` — `boolean`: is the evidence too thin to classify safely?
  Store request, answers, probabilities, returned model, questions version, usage, latency; identical inputs reuse the stored evaluation.
- Composition in code (not in the model): verifiable exclusions can discard; AI-inferred incompatibility never hides an opportunity without review; uncertain → `posible`; failure → retry, then `pendiente` and the run is marked partial (spec §5). Order by relevance level, then closing date proximity and stage.
- Reasons: short Spanish sentences generated from matched fields and fragments (e.g. «Menciona "soporte funcional SAP" en el objeto y en el pliego, pág. 12»), each linked to its source.
- Evaluation harness (`worker/src/eval`) with comparison arms on the same labeled set: retrieval only, retrieval + rules, retrieval + Jev, and optionally retrieval + an LLM classifier (any gateway chat model via `generateObject`) and retrieval + rerank. Reports missed relevant opportunities (primary), false positives, latency, and cost; sets thresholds (spec §13).
- Internal inbox page (owner-only, behind a flag) to review results for a test company before the customer UI exists.

**Done when (spec §13):** the software profile finds the IHSS SAP opportunity with visible evidence; the unrelated profile does not get it as high relevance; Jev decisions are stored with model, questions, probabilities, and inputs; uncertain cases stay `posible`, failed ones `pendiente`; the Jev vs no-Jev comparison is documented with miss rate, false positives, latency, and cost.

### Phase 4 — Product: profiles, searches, runs, Home, reports, email (L) — spec §4, §7, §12

Start with the Spanish pass (D1) over existing screens, validation messages, notification texts, and auth emails, so everything new is written in Spanish from the start.

- **Company profile** in onboarding and settings (natural-language description, concrete offerings, exclusions, geography; UNSPSC optional).
- **Saved searches**: create/edit, inherit profile, extra criteria, schedule, delivery preferences; entitlement triggers from 7.4.
- **Search runs**: `search.due` pg_cron job finds due searches (active plan only) and enqueues runs; "Ejecutar ahora" creates a manual run using the latest complete ingestion and shows its age; the partial unique index prevents duplicates; progress is visible through Realtime on `search_runs`.
- **Home (mail-style layout, §12.1)**: left sidebar with "Nueva búsqueda", searches ordered by last run with new-match indicators, recent runs of the selected search, link to full history; right side with search summary, run/sync timestamps, status, "Ejecutar ahora", downloads, and results. Opens the most recent completed run by default; an in-progress run never replaces completed results.
- **Results table (§12.2)**: columns from the spec, sorting, pagination, facets with counts, text search, "Limpiar filtros". Filters live in the URL and never modify the saved search.
- **Detail panel (§12.3)**: keeps search/run/filters and scroll position; evidence, process data and change history, documents, official link, «Me interesa» / «No me interesa» with optional reason.
- **Downloads**: CSV "todos" and "solo filtrados" streamed from a route handler with the user's session (counts shown on the buttons); frozen PDF rendered by the worker after the run completes, stored in the `reports` bucket per org.
- **Email**: new notification types (`search_run.completed`, `opportunity.updated`) through the existing `private.notify()`; extend the outbox with a `template` + `payload` so the dispatcher can render the report email. `opportunity_notifications` enforces "no repeated opportunity unless it changed".
- **Billing page**: replace the mock with the real plan, period, seats, searches, schedule, history, and credit balance from `get_organization_entitlements` / `get_ai_credit_balance`.

**Done when (spec §13):** a run produces PDF, CSV, and history with ingestion date and coverage; selecting a search and run updates the table without losing history; "Ejecutar ahora" shows progress and never duplicates; facets do not change the saved search; "Descargar todos" includes all pages and "solo filtrados" respects facets; a date change or new annex creates an update alert without repeating the original alert; plan limits apply per organization.

### Phase 5 — Chat with sources (M) — spec §8

- Contexts: one opportunity (detail + all processed documents) or one report (its opportunities). Threads are org-private.
- Route handler with `streamText` and the `chat` role; `useChat` in the detail panel. Retrieval picks relevant pages and builds the numbered sources (section 5.4); structured data (dates, stage) comes from the latest process version, and the answer says when it differs from the frozen report.
- Cache-friendly prompt layout (stable instructions and sources first, question last) so providers with prompt caching reuse it across turns; provider-specific cache options go through `providerOptions` only in the registry.
- System instructions (Spanish): document text is content to analyze, never instructions; no eligibility verdicts, legal commitments, or unsupported figures; say clearly when a process has no documents or when documents were not processed.
- Citation validation after each response (section 5.4) before the message is stored and rendered.
- Credits per section 5.3; the UI shows estimated cost, balance, and a clear state when credits run out.
- Run the chat evaluation set across candidate models and set the `chat` default (O5).

**Done when (spec §13):** answers show verified sources and respect the chosen context; `CM 39-019-2026` chat says it only has the process detail; the chat never claims to have read unprocessed documents; retries and aborted streams never double-charge credits; at least two providers have been evaluated on the golden set and the choice is documented.

### Phase 6 — Pilot readiness (M)

- Deploy: Supabase Cloud (migrations, Vault secrets, function secrets, pg_cron); Railway `web` and `worker` with health checks and separate staging/production environments; AI Gateway key per environment with budgets and role fallbacks.
- Observability: sync health, pages/processes per run, download and OCR errors, analysis latency, AI usage and cost per role and model, failed deliveries; alerts to the team when the source fails or goes stale.
- Admin project integration: plan activation (already supported), sync monitoring views, `ai_model_rates` editing, support lookups.
- Legal/access review (O7), retention policy (O8), provider data-handling review (5.6), Spanish marketing site and pricing copy (prices still out of scope).
- Pilot plans configured from the admin app; first customers onboarded manually.

---

## 9. Background Jobs Summary

| Queue / job | Trigger | Idempotency key |
|---|---|---|
| `ingest.sync_window` | pg_cron every 3 h (O6) | one running sync per source (advisory lock) |
| `ingest.fetch_detail` | enqueued by sync / recheck | `(source, source_process_key)` + content hash |
| `ingest.recheck_open` | pg_cron hourly at :30, up to 300 processes | per process: open, not checked in 6 h, not already queued |
| `docs.download` | new document link | `(document_id, sha256)` |
| `docs.extract` | new document version | `document_version_id` |
| `docs.chunk_embed` | extraction finished | `document_version_id` + `embedding_model` |
| `search.due` | pg_cron every 5 min | partial unique index on active runs |
| `search.run` | due or manual | `search_run_id` |
| `match.evaluate` | candidate in a run | `input_hash` (includes model id) |
| `reports.render` | run completed | `search_run_id` |
| email dispatch | existing, every minute | `notification_deliveries.idempotency_key` |

Failed jobs retry with backoff via pgmq visibility timeouts; after N attempts they are archived and recorded with their error in `worker_job_failures`, which the admin app reads. A job never reports success for work it could not verify (spec §6, §13).

---

## 10. Testing and Quality

- **Database:** pgTAP tests for RLS isolation between organizations, entitlement triggers, idempotency constraints, and service-role-only RPCs. `supabase db advisors` in CI.
- **Scraper:** saved HTML fixtures (listing pages, IHSS detail, no-documents detail) with parser unit tests; a parser change must pass all fixtures.
- **Documents:** fixture PDFs (text layer, scanned, mixed) for extraction and chunking tests.
- **AI:** unit tests for the registry, state budgeting for Jev, credit computation from usage, and citation validation (known ids, unknown ids, missing citations). Evaluation sets (5.5) run before changing thresholds, prompts, questions, or any model assignment.
- **App:** Vitest for schemas and pure helpers; Playwright for the critical flows (sign in → profile → search → run → results → download → chat) once Phase 4 lands.

---

## 11. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| HonduCompras HTML or flow changes | Ingestion silently wrong | Parser-health checks, raw HTML kept per page, fixtures, failed runs visible, last good data shown with its age |
| Portal blocks or throttles automated access | No fresh data | Polite rate, single session, backoff, cadence measured before promising frequency; O7 review |
| Scanned PDFs with poor OCR | Missed matches inside documents | Per-page method/confidence, `partial` coverage shown in runs and PDF, `vision` role as escalation |
| Jev performance in Spanish procurement text is unproven | Misranked opportunities | Labeled set, comparison arms, uncertain → `posible`, never auto-hide on inferred incompatibility |
| Jev 32K context too small for long pliegos | Evidence left out | Retrieval-ordered fragment budget, truncation recorded in coverage, harness checks misses caused by truncation |
| `experimental_evaluate` API changes | Matching breaks on upgrade | Pinned `ai` version, one wrapper module, smoke test in CI |
| Model quality varies by provider (citations, Spanish, refusals) | Inconsistent answers when switching | Role registry, golden sets per role, citation validation independent of the model |
| Customer data sent to third-party providers | Privacy and trust | Provider allowlist per role, gateway routing controls, data-handling review before enabling a provider |
| Dependence on one gateway | Outage stops AI features | Gateway fallbacks across providers; AI SDK allows switching a role to a direct provider package if needed |
| Cost of OCR, embeddings, and chat grows with volume | Margin | `ai_usage_events` per role/model, evaluation reuse by `input_hash`, embeddings once per document version, gateway budgets, measured costs before fixing plan limits |
| Duplicate work or emails from retries | Noise, cost | Unique constraints, idempotency keys, outbox dedupe, `opportunity_notifications` |
| Chat hallucinating eligibility or figures | Trust, liability | Verified citations, instructions against verdicts, structured data for dates/status, explicit "no documents" handling |

---

## 12. Out of Scope for the MVP (spec §3)

Submitting offers, automatic eligibility claims, sources other than HonduCompras 1.0, real-time promises before measuring latency, WhatsApp/SMS/CRM/webhooks, award prediction and competitor analysis, automatic recurring billing before choosing a payment provider (pilots are activated from the admin app).
