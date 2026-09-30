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

### 6.1.1 Spanish UI conventions (D1)

- Formal «usted», sentence case (no English-style title case), opening «¿» and «¡», short sentences. Dates with `es-HN` / date-fns `es`, times in `America/Tegucigalpa`; dates inside notification and email text as `DD/MM/YYYY`.
- Brand: **Tenders HN**. Terms, used everywhere:

| English | Español | English | Español |
|---|---|---|---|
| Dashboard | Inicio | Organization | Organización |
| Members / member | Miembros / miembro | Owner / admin / member / viewer | Propietario / Administrador / Miembro / Observador |
| Invite, invitation | Invitar, invitación | Pending invitations | Invitaciones pendientes |
| Revoke | Revocar | Expires / expired | Vence / vencida |
| Settings | Configuración | Account / profile / appearance | Cuenta / perfil / apariencia |
| Theme: light / dark / system | Tema: claro / oscuro / sistema | Password | Contraseña |
| Security / billing / integrations | Seguridad / facturación / integraciones | Notifications | Notificaciones |
| Audit log | Registro de actividad | In-app / email (channel) | En la aplicación / correo electrónico |
| Sign in / sign up / sign out | Iniciar sesión / crear cuenta / cerrar sesión | Forgot password? | ¿Olvidó su contraseña? |
| Reset password | Restablecer contraseña | Email (field) | Correo electrónico |
| Save / saving… | Guardar / guardando… | Cancel / delete / remove | Cancelar / eliminar / quitar |
| Leave (organization) | Salir de la organización | Transfer ownership | Transferir la propiedad |
| Danger zone | Zona de riesgo | Slug | Identificador en la URL |
| Seats | Usuarios (del plan) | Plan / credits | Plan / créditos |
| Next / previous / back / finish | Siguiente / anterior / volver / finalizar | Search / loading / close | Buscar / cargando / cerrar |
| Mark all as read | Marcar todo como leído | Something went wrong / try again | Algo salió mal / intentar de nuevo |
| (you) / unnamed user / unknown user | (usted) / usuario sin nombre / usuario desconocido | System / someone | Sistema / alguien |
| Opportunity / tender | Oportunidad / proceso | Search / run | Búsqueda / ejecución |

### 6.2 Open

| # | Decision | Recommendation | Needed by |
|---|---|---|---|
| O1 | Gateway | **Vercel AI Gateway.** It serves Jev (`typesafe-ai/jev`) plus chat, embedding, and rerank models under one key, adds no markup to token prices, and has budgets, fallbacks, and request logs. OpenRouter has no Jev, so it would mean a second integration for matching. | Phase 0 |
| O2 | OCR | Text layer first (`pdftotext`), Tesseract `spa` for pages without usable text; add the `vision` role only if measured OCR quality blocks matching. | Phase 2 |
| O3 | Embedding model | **Provisional default `voyage/voyage-4` at 1024 dimensions (28 Sep 2026)**: multilingual, $0.06 per million tokens, and Voyage 4 models share one embedding space, so voyage-4-lite or voyage-4-large can replace it without re-embedding. Confirm by retrieval recall on the labeled set. The column is `halfvec(1024)`, so any other model must output 1024 dimensions and means re-embedding (tracked by `embedding_model`). | Phase 2 |
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
- Empty detail pages (fixed 28 Sep 2026): the portal lists some processes (mostly in Elaboración or Recepción de Ofertas) but serves their detail page with an empty process table. Treated as parser failures, 16 such processes were retried on every sync and hourly recheck: 581 archived jobs and about 1,700 wasted requests in four days. The parser now returns no detail for an empty table; the worker records `detail_unavailable_at` (cleared on the next successful read), keeps the last version, and syncs and rechecks wait 6 hours. `source_health.processes_without_detail` makes a portal-wide problem visible.
- ~~`ingest.recheck_open` schedule~~ **Done (24 Sep 2026).** pg_cron runs `private.enqueue_open_rechecks()` every hour at :30 and enqueues ordinary `fetch_detail` jobs for up to 300 processes that are open (closing in the future or within the last day) and were not checked in the last 6 hours, oldest check first, skipping any already queued. This covers processes outside the moving window and annexes on processes inside it, which the results list does not show. The batch is sized so syncs never wait long behind it on the shared consumer.
- Politeness and safety: one session at a time, 2–3 s between requests, bounded retries with backoff, a parser-health check (expected headers/fields present) that marks the run `failed` instead of storing garbage.
- Freshness measurement (spec §14.1): **set up 24 Sep 2026, runs until 1 Oct 2026.** The first production syncs showed processes appearing with start dates 1, 6, and 7 days old, so the 7-day window can miss processes that appear later than that. pg_cron now also enqueues a 30-day sync every day at 04:00 Honduras (`private.enqueue_ingest_wide_sync`), and the service-role view `process_arrivals` lists every process that appeared after an earlier successful sync had covered its start date (backfill is left out), with `appearance_lag`, `start_days_before_first_seen`, and the window size of the sync that found it. The first wide sync backfills about three weeks of processes and their detail pages (a few hours on the single consumer), delaying that morning's regular syncs once. At the end of the week:
  - Misses of the regular window: `select * from process_arrivals where start_days_before_first_seen > 7`. None → drop the daily wide sync; some → keep it (or widen the regular window) and size it from the largest lag.
  - Cadence: arrivals per run and per Honduras hour, `select date_trunc('hour', first_seen_at at time zone 'America/Tegucigalpa'), count(*) from process_arrivals group by 1 order by 1`, and `processes_new` per run in `source_sync_runs`. Record the decision in O6.
- ~~Source health read model for the admin project~~ **Done (24 Sep 2026).** `source_health` is a view over `source_sync_runs` with one row per source: the latest run (status, pages, error), the last successful sync with its age, pages, and processes, and failed or partial runs in the last 24 hours. The pgmq archive keeps no error, so the worker also records each job that exhausts its attempts (and each unknown message) in `worker_job_failures` with the error, in the same statement that archives it. Both are service role only.

**Done when (spec §13):** a dated search reproduces the full set of pages and processes page 2+ without losing the filter; repeated syncs create no duplicate processes or documents; `LPN-008-2026` (IHSS) shows its three document links; `CM 39-019-2026` is stored with no documents as a valid state; a portal failure is recorded and never reported as "no new opportunities".

### Phase 2 — Documents and retrieval index (M) — spec §5.3, §6

- ~~`docs.download` job~~ **Done (24 Sep 2026)** as `download_document` on the `ingest` queue: `sicc` (portal) and `h1` (documents) resolve to the same server, so downloads share the single consumer that keeps it at one request at a time. Every detail fetch queues a check of the process's files; files are stored under `source-documents/<process_id>/<sha256>.<ext>`, one `document_versions` row per hash. The server sends `ETag`/`Last-Modified`, so rechecks of unchanged files are 304s; a new hash under the same link records `document_replaced` (spec §14.2). A missing file (e.g. 404) or one over 50 MB is recorded in `source_documents.download_error` without failing the job.
- ~~`docs.extract` job~~ **Done (24 Sep 2026)** as `extract_document` on its own `docs` queue (CPU only, so OCR never delays a sync): `pdftotext` per page; pages under 100 visible characters are rendered at 300 dpi and read by Tesseract `spa`; images are OCR'd directly; `document_pages` records the method and mean word confidence; `extraction_status` is `text`, `ocr`, `partial` (some pages failed), `failed`, or `unsupported` (docx/xlsx/doc, about 4% of links). Pages are stored as they finish, so an interrupted job resumes. The `vision` role stays off (O2). Verified on LPN-008-2026: the pliego (52 pages) reads from its text layer; the aviso and anexos are scans, OCR'd at 86% and 92% mean confidence (about 3 s per page), and "soporte funcional SAP" matches pages in all three. Pages are rendered at 300 dpi but at most 4200 px on the long side: five press notices were phone photos placed on 25x37 in pages, which rendered at 85 megapixels and timed out; capped, they OCR in seconds at 94%.
- ~~`docs.chunk_embed` job~~ **Done (28 Sep 2026)** as `embed_document` on the `docs` queue, queued when extraction finishes. Pages are packed into chunks of about 2,000 characters (≈500 tokens; short pages merged, long pages split at paragraph or word breaks, 300 characters of overlap), each with `page_start`/`page_end` for citations. The embedded text leads with the document and process title so annex pages carry their tender's context; only the chunk text is stored. `halfvec(1024)` with an HNSW cosine index, GIN on `tsv`, unique per version, model, and ordinal. Verified on LPN-008-2026: 98 chunks, 49k tokens; paraphrased questions retrieve the right pliego pages, and a phrase found only in the scanned anexo is retrieved with its file and pages.
- ~~Candidate retrieval function~~ **Done (28 Sep 2026)**: `public.retrieve_candidates` (service role). Five signals ranked separately and fused by reciprocal rank (1 / (60 + rank)): terms (keywords, synonyms, offerings) in the process fields, terms in document chunks, chunk similarity, object similarity, and UNSPSC prefixes (a family code matches its commodities). Every term or code match is returned plus the nearest 200 chunks and 100 objects, so recall wins (spec §5.4); open processes only by default. Each candidate carries its matched terms, fields (`object`, `buyer_entity`, `purchase_unit`, `products`, `documents`), codes, object similarity, and up to 5 fragments with file, version, and pages. Two additions made it work: product descriptions and UNSPSC codes are copied onto the process (many objects are just "Compra Menor"; the products carry the meaning), and each process object is embedded (`embed_process`) so processes without documents are found semantically (spec §5 step 4: "búsqueda semántica sobre objeto y fragmentos"). Trigram on names was left out: FTS with `unaccent` covered entity and product names in testing. Verified locally: a software/SAP profile ranks LPN-008-2026 first with terms, UNSPSC 43231505, and pliego pages 21, 22, 27, and also finds an IHSS software maintenance subscription that shares no search term (via UNSPSC and similarity); a medical-supplies profile ranks medical processes first.
- Choose the embedding model (O3) by recall on a first slice of the labeled set; measure document volume, sizes, OCR time, and embedding cost per day (spec §14.3).

**Done when:** every downloadable document of the IHSS example is stored once, extracted, and searchable; a term that appears only inside a pliego or anexo is retrieved as a candidate with its file and page.

### Phase 3 — Matching with Jev and a test inbox (L) — spec §5, §14.4

- **Labeled set first.** 3–5 test company profiles (including a software/SAP profile and an unrelated one) × a few hundred real processes labeled relevant / not relevant, stored as fixtures in the repo.
  - **In progress (28 Sep 2026).** Four profiles, the landing page's business types (`worker/src/eval/labeled-set/profiles.json`): enterprise software, clinical lab supplies, road construction, uniforms and PPE; each is the unrelated profile for the others. Pools (`pools.json`) come from the 556 open processes on production: the top 150 by `retrieve_candidates` (road construction returned 130) plus a random 60 of the rest, shuffled, labeled blind (the labeler never sees which stratum or rank an item came from). The random stratum estimates misses: each sampled relevant label stands for `sampleWeight` (about 6.8) not-retrieved processes. Labels are collected on a private labeling page (relevant / not relevant / unsure, with an optional note) and then written into the repo next to the pools.
  - **Labeled (29 Sep 2026).** 820 labels in `labels.json` (99 relevant, 685 not relevant, 36 unsure). Labeling rules settled on review: supervision of road works counts as relevant for road construction; surgical and general medical supplies (gloves, masks, probes, surgical instruments) are not clinical lab supplies; sterilization towels and ID bracelets are not uniforms. Relevant among retrieved: software 19, lab 18, roads 42, uniforms 20; none in any random sample, so no miss was observed, but 0 of 60 only bounds the miss rate at about 5% of the not-retrieved (roughly 20 processes per profile). Every relevant process ranked 91 or better. Most unsure labels are "Compra Menor" processes with no product lines and no documents. The labeling page also showed product specifications, quantities, PDF links and pliego excerpts (read from production on 28 Sep); 169 of 442 processes have no product lines on HonduCompras.
  - **Labeled set v2 (29 Sep 2026).** v1's narrow profiles and labels carried our own judgment (e.g. "surgical supplies are not lab supplies"). v2 uses four real corporate purposes (objeto social) supplied by the product owner, stored verbatim in `labeled-set/v2/profiles.json`, labeled core / adjacent / not relevant / unsure against that text on the same labeling page (collections `pools_v2`, `labels_v2`; v1 labels untouched). Pools come from the same 29 Sep population, joining three retrievals so none of the compared methods is favored: the whole text, each paragraph fused, and each line of business of the extracted profile fused, plus 60 random processes each (1,140 items, 496 processes). Profile extraction (`extract` role, `openai/gpt-6-luna`, `worker/src/matching/profile.ts`) turns a corporate purpose into lines of business with a proposed tier (primary / secondary / optional, confirmed by the customer), keywords, and UNSPSC classes proposed by meaning from the CUBS catalog (`unspsc_catalog`, walked monthly from HonduCompras) and HonduCompras product descriptions (`unspsc_terms`). Codes the model recalled from memory were often wrong (4200, 7800, and 7214/7215, which CUBS does not have: Honduran works are coded 7210xx/7213xx), and UNSPSC is applied unevenly by institutions, so codes stay a supporting signal next to keywords and semantic search.
  - **Labeled v2 (29 Sep 2026).** 1,140 labels in `labeled-set/v2/labels.json`, one per pool item. The labeler is a software developer, not an expert in lab supplies, construction or textiles, so a blind second opinion checked every label: `eval:second-opinion` gives a model the page's rules and the same process information, without the human label. Opus 5.5 through the AI Gateway judged 550 (software and lab, $10.48, stopped by the key's $10 budget); Fable 5.1 sub-agents in a Claude Code session then judged all 1,140 (`--export` / `--import`, no gateway cost). The two models agreed on 539 of the 550 they both judged. The labeler reviewed the 196 disagreements with Fable's reasoning on the labeling page and took Fable's label in 194, including 74 of 75 in software, the labeler's own field. Most changes were rubric reading rather than trade knowledge: peripherals and cables are adjacent for software because the purpose lists them; licences and cybersecurity are core because the first paragraph names them; «Compra Menor» processes with nothing published are unsure, not not relevant. So the final labels are the model's reading confirmed by the labeler, not independent human judgment: `firstLabel` keeps the blind label wherever the review changed it, and an arm that uses a Claude model to classify should also be scored against the blind labels.
    - Final counts: 133 core, 147 adjacent, 771 not relevant, 89 unsure. Core / adjacent: software 22 / 48, lab 17 / 27, roads 83 / 54, uniforms 11 / 18.
    - Misses: the random samples now hold relevant processes. Roads had 8 in 60 (2 core, 6 adjacent), so about 49 relevant roads processes (12 core) were not retrieved by any of the three methods (`sampleWeight` 6.1); software and lab had 1 adjacent each (about 6 each); uniforms none. Roads retrieval needs work before thresholds are set.
    - Methods: of the 270 core or adjacent processes retrieved, the extracted profile's lines of business found 260 within their top 150, the paragraphs 233 and the whole text 213; 24 were found by the extracted profile alone (19 roads), 5 by the paragraphs alone and 3 by the whole text alone.
  - Phase 2 volume after the embedding backfill: 742 document versions, 33,489 chunks, 5,829 process objects, 19.1M tokens (about $1.15 at $0.06 per million), database 401 MB; the embedding provider accepted about 500K tokens per minute.
- `match.evaluate` job per candidate: one `experimental_evaluate` call to `typesafe-ai/jev` with a `state` built within the 32K budget (section 5.2) and three questions in the same request:
  - `in_scope` — `boolean`: does the requested scope correspond to what the company sells?
  - `match_strength` — `score` with defined levels (none / weak / partial / strong).
  - `insufficient_evidence` — `boolean`: is the evidence too thin to classify safely?
  Store request, answers, probabilities, returned model, questions version, usage, latency; identical inputs reuse the stored evaluation.
- Composition in code (not in the model): verifiable exclusions can discard; AI-inferred incompatibility never hides an opportunity without review; uncertain → `posible`; failure → retry, then `pendiente` and the run is marked partial (spec §5). Order by relevance level, then closing date proximity and stage.
- ~~Composition in code~~ **Done (30 Sep 2026)**: `lib/matching/relevance.ts` applies the revised proposal (`in_scope >= 0.8` muy relevante, `< 0.3` descartada, else posible, failed → pendiente); the thresholds are provisional constants. Verifiable exclusions come with the company profile (Phase 4).
- ~~Reasons~~ **Done (30 Sep 2026)**: `lib/matching/reasons.ts` builds short Spanish sentences, each tied to one source (a process field, a document page range, UNSPSC codes, or similarity), e.g. «Coincide con "soporte SAP" en el objeto.» and «Coincide con "soporte SAP" en Pliego o Terminos de Referencia, págs. 21–22.». They say "Coincide con", not "Menciona", because text search matches a term's words, not the exact phrase. `retrieve_candidates` now returns `field_terms` (migration `20260930080000_retrieve_candidates_field_terms`), so a field reason never names a term found only in a document.
- Evaluation harness (`worker/src/eval`) with comparison arms on the same labeled set: retrieval only, retrieval + rules, retrieval + Jev, and optionally retrieval + an LLM classifier (any gateway chat model via `generateObject`) and retrieval + rerank. Reports missed relevant opportunities (primary), false positives, latency, and cost; sets thresholds (spec §13).
  - **Retrieval-only arm done (29 Sep 2026)**: `pnpm --filter worker eval:retrieval` against production (the labels come from there). `retrieve_candidates` takes `process_ids`, so the harness ranks within the 29 Sep snapshot (568 processes: the 556 open then plus labeled ones whose dates moved) however many processes have closed or arrived since. It runs full retrieval and each signal alone, prints relevant found at 10/25/50/100/150, precision among labeled, and the rank of the last relevant process, and writes a report to `worker/src/eval/results/`.
  - Baseline with `voyage/voyage-4`: full retrieval finds all 99 relevant processes, the last at rank 47 (software), 94 (lab), 74 (roads), 59 (uniforms); precision at 25 is 0.48–1.00. Alone, terms miss 20 of 99 and codes miss 59; semantic alone finds 98, each profile's last within rank 74, and ranks the hard cases higher than the fusion does (lab's last relevant is 52 alone vs 94 fused: term matches such as "reactivos" pull medical-supply processes above lab processes found only semantically). Its one miss, a software process, is found only by terms, so every signal stays. Candidate cutoff for Jev: **top 100** covers every known relevant process; weighting the semantic signal in the fusion is a later experiment, to judge on more profiles than four. O3: voyage-4 is kept; a second model can be compared by embedding its chunks and running with `AI_MODEL_EMBED`. First queries on a cold connection took up to 19 s, the rest 0.2–5 s.
  - **Retrieval + Jev arm done (29 Sep 2026)**: `pnpm --filter worker eval:jev` evaluates each profile's top 100 with `evaluateMatch` (the `evaluate_match` job's code; results stored in `match_evaluations`, reused on reruns) and sweeps thresholds. Questions `v1`: 400 evaluations, 1.05M input tokens (about $0.04), p50 286 ms, p95 482 ms, no failures, no evidence left out by the budget.
  - Jev alone is not a safe filter: `in_scope >= 0.5` drops 21 of 99 relevant processes, and even `>= 0.1` drops 2. Its uncertainty answer rescues them: both misses had `insufficient_evidence` 0.37–0.43. Dropping only `in_scope < 0.2 and insufficient_evidence < 0.35` removes 97 of 289 not-relevant candidates (34%) and no relevant one. At the top, `match_strength >= 2` keeps 60 candidates, 55 relevant and 3 not relevant (precision 0.95, 56% of relevant), and ranking by strength puts 53 relevant in each profile's top 15 against 46 by retrieval rank.
  - Proposed composition (to confirm on more profiles; thresholds were read off this same set, so expect them to be optimistic): **muy relevante** `match_strength >= 2`; **descartada** `in_scope < 0.2 and insufficient_evidence < 0.35`, still reviewable, never hidden (spec §5); **posible** everything else; **pendiente** failed evaluations. Before fixing thresholds, review the not-relevant candidates Jev is most sure of (e.g. LP-002-2026-RSN4-SESAL, labeled relevant for uniforms and not relevant for lab, `in_scope` 0.93 for lab): some may be label errors or mixed tenders.
  - **v2 runs (30 Sep 2026)**: both arms read labeled set v2 (`--set`, default v2) in three label views (`--view`): **relevant** (core or adjacent, final labels), **core** (adjacent left out), **blind** (the labeler's labels before the second-opinion review; the independent check for arms that classify with a Claude model). Reports: `results/retrieval-2026-09-30-v2-voyage_voyage-4.json`, `results/jev-2026-09-30-v2-profile-v1-top100.json`.
  - Retrieval v2, summed over the four profiles (found in the top 100 / 150): **extracted profile** 126 / 131 of 133 core, 220 / 260 of 280 relevant, 168 / 196 of 203 blind; paragraphs 115 / 129 core, 203 / 234 relevant; whole text 111 / 117 core, 182 / 213 relevant. The extracted profile leads in every view. Its semantic signal alone finds slightly more adjacent processes (227 / 263 relevant) but fewer core (115 / 129): keywords and classes pull core processes up. Keywords alone are noisy for lab and uniforms (precision at 25 of 0.16 and 0.08); classes alone are precise but reach 127 of 280. Top 100 of the extracted profile stays the Jev cutoff (95% of core). The random samples put about 49 relevant roads processes (12 core) and about 12 elsewhere outside every method's top 150; since the pools came from these same methods, recall within the top 150 is optimistic.
  - Jev v2 on the extracted profile's top 100: 400 evaluations, 3.53M input tokens (about $0.15; the corporate purposes make each state about 8,800 tokens), p50 333 ms, p95 587 ms, no failures, 33 with evidence left out by the budget. `in_scope >= 0.3` drops no relevant process in any view and removes 85 of 174 not-relevant candidates (49%); `>= 0.4` drops one adjacent (no core, none by blind labels) and removes 60%; `>= 0.5` drops 3 adjacent and removes 76%. `match_strength` does not carry over: `>= 2` keeps 14 candidates and `>= 1` misses 149 of 280, so it cannot mark the top tier. A high `in_scope` can: `>= 0.8` keeps 117, of which 116 relevant (98 by blind labels, 10 not relevant).
  - Revised composition proposal (thresholds read off this set, so optimistic): **muy relevante** `in_scope >= 0.8`; **descartada** `in_scope < 0.3`, still reviewable, never hidden; **posible** everything else; **pendiente** failed evaluations. Confirm on profiles not used to pick them before fixing in code.
  - **Specifications made searchable (30 Sep 2026)**: `products_text`, which feeds `search_tsv` and the process embedding, held only each product line's description, which is its catalog name. On 29 Sep, 357 of 482 open processes (74%; 329 of the 335 open Compra Menor) had no searchable document and specifications that add to the catalog name. In a sample of 50 of them, the catalog name was wrong in 10 (e.g. "Supervisión de proyectos" for paving and storm-drain works, "Refrescos" for lunches) and partial in 13, so for about 46% the specifications were the only correct or full description of the purchase. `products_text` now reads "description: specifications" per line (specifications cut at 600 characters, as Jev reads them). Migration `20260930040000_products_text_specifications` backfills it and re-embedded the 5,476 processes whose text changed (production: 5,468, about 1.09M tokens, about $0.065). Result (`results/retrieval-2026-09-30-v2-voyage_voyage-4-specs.json`): terms alone found more (179 vs 167 of 280 relevant in the top 150) but semantic alone found fewer (253 vs 263), and the fused extracted profile lost (251 vs 260 in the top 150; 122 vs 126 of 133 core in the top 100). Many specifications open with submission instructions, so their first 600 characters say nothing about the purchase (ENP-COM-012-2026 fell from rank 67 to 171). The eval also cannot credit what specifications surface: 41 never-labeled processes entered the top 150. Decision: specifications stay in text search only; `embed_process` embeds product descriptions again (migration `20260930060000_embed_process_descriptions`, about 0.23M tokens). A separate specifications embedding is an idea for later, only after the processes it surfaces are labeled.
- ~~Internal inbox page~~ **Built (30 Sep 2026)**: `/organizations/<org>/inbox`, owner-only behind `INTERNAL_INBOX=true`, in Spanish. The owner pastes the corporate purpose; `request_search_run` saves it in `company_profiles` (a new version when it changes) and queues a `search_run` job on the `match` queue (one run in flight per organization). The job extracts the lines of business when the version has none, retrieves by lines of business over the open processes (`worker/src/matching/retrieve.ts`, shared with the eval), evaluates the top 100 with Jev (4 at a time, stored evaluations reused), and writes each candidate to `search_run_matches` with its relevance, reasons, and a snapshot of the process. A failed evaluation leaves the candidate `pendiente` and the run `partial`; any other failure marks the run `failed`. The page groups matches by relevance (descartadas collapsed) and refreshes itself while a run is active. `company_profiles`, `search_runs`, and `search_run_matches` are minimal versions of the section 7.2 tables; Phase 4 adds saved searches, schedules, profile versions, and delivery. Cost per run: about $0.04 of Jev for 100 new evaluations, about a cent for extraction when the profile changed, and under a cent of embeddings.

**Done when (spec §13):** the software profile finds the IHSS SAP opportunity with visible evidence; the unrelated profile does not get it as high relevance; Jev decisions are stored with model, questions, probabilities, and inputs; uncertain cases stay `posible`, failed ones `pendiente`; the Jev vs no-Jev comparison is documented with miss rate, false positives, latency, and cost.

**Status (30 Sep 2026): done.**
- IHSS SAP: the software profile's inbox run finds LPN-008-2026 at retrieval position 29, muy relevante, with pliego pages 23–24, 27–28 and 51 and UNSPSC 43231505 as reasons. Its `in_scope` sits at the threshold (0.80 locally, 0.69 in the 30 Sep production eval, which makes it posible), so its level is borderline while it is always found.
- Unrelated profiles: LPN-008-2026 is outside the top 100 for lab, roads, and uniforms (30 Sep Jev report), so they never show it.
- Stored decisions: every `match_evaluations` row keeps the requested and returned model, questions version, full request, evidence, per-question probabilities, tokens, and latency.
- `posible` / `pendiente`: `composeRelevance` and its tests; the `search_run` job leaves a failed evaluation `pendiente` and the run `partial`.
- Jev vs no-Jev on labeled set v2 (extracted profile, top 100 per profile): without Jev, all 400 candidates go to review, with 220 of 280 relevant among them and 174 labeled not relevant. With Jev, `descartada` (`in_scope < 0.3`) removes 85 of those 174 (49%) and no relevant process in any label view, and `muy relevante` (`in_scope >= 0.8`) is 116 relevant of 117. Misses are retrieval's, not Jev's: the 60 relevant outside the top 100 never reach it. Latency p50 333 ms, p95 587 ms per evaluation; a full inbox run with 100 new evaluations took 42 s locally. Cost about $0.04 per run of 100 new evaluations (8,800 input tokens each at $0.042 per million); stored evaluations are reused.
- Matches are ordered by relevance level, then by closing date, soonest first.
- Deferred: the retrieval + rules arm and verifiable exclusions need the profile's exclusions (Phase 4); O4 still needs the answer from TypeSafe/Vercel on versioned Jev ids (`response_model` returns `typesafe-ai/jev` without a version); the thresholds stay provisional until profiles not used to pick them are labeled.

### Phase 4 — Product: profiles, searches, runs, Home, reports, email (L) — spec §4, §7, §12

Start with the Spanish pass (D1) over existing screens, validation messages, notification texts, and auth emails, so everything new is written in Spanish from the start.

- ~~Spanish pass~~ **Done (30 Sep 2026)** with the conventions in 6.1.1: every screen outside the marketing site, the UI kit's screen-reader labels, validation and action messages, activity-log labels, dates (`es` / `es-HN`), the invitation email, the notification email, and the local Supabase auth emails (confirmation, and a new recovery template). Migration `20260930120000_spanish_notifications` rewrites notification types and the texts the triggers write; notifications already stored stay in English. Database error codes (`lib/errors.ts`) and Supabase Auth error codes (`features/auth/errors.ts`) map to Spanish messages; raw error text no longer reaches the UI. Template leftovers removed or fixed: the kit brand, the login test account, unused app-shell files, the user menu's broken links, the password-reset redirect to `/dashboard`, and OAuth logins that ended on `/error?error=NEXT_REDIRECT`.
  - Emails share one design (white card, Tenders HN wordmark, one black button, fallback link, footer) across `emails/organization-invitation.tsx`, `supabase/templates/*.html`, and the `send-notification-emails` function. The hosted Supabase project has the confirmation and recovery templates (30 Sep 2026).
  - Found, not fixed: a new organization has no subscription, so invitations sent while creating it fail with `subscription_inactive` after the organization exists (now shown in Spanish). Settle with plan activation in onboarding.

- **Company profile** in onboarding and settings (natural-language description, concrete offerings, exclusions, geography; UNSPSC optional).
- **Saved searches**: create/edit, inherit profile, extra criteria, schedule, delivery preferences; entitlement triggers from 7.4.
- **Search runs**: `search.due` pg_cron job finds due searches (active plan only) and enqueues runs; "Ejecutar ahora" creates a manual run using the latest complete ingestion and shows its age; the partial unique index prevents duplicates; progress is visible through Realtime on `search_runs`.
- **Home (mail-style layout, §12.1)**: left sidebar with "Nueva búsqueda", searches ordered by last run with new-match indicators, recent runs of the selected search, link to full history; right side with search summary, run/sync timestamps, status, "Ejecutar ahora", downloads, and results. Opens the most recent completed run by default; an in-progress run never replaces completed results.
- **Results table (§12.2)**: columns from the spec, sorting, pagination, facets with counts, text search, "Limpiar filtros". Filters live in the URL and never modify the saved search.
- **Detail panel (§12.3)**: keeps search/run/filters and scroll position; evidence, process data and change history, documents, official link, «Me interesa» / «No me interesa» with optional reason. Show the bid deadline with its time, the place of bid reception, and the contact prominently, and each product line's specifications in full from the process version (not `products_text`, which is capped). In Compra Menor the specifications often hold the only submission instructions: where or to which email to deliver, the reception hours, and what to present (161 of 482 open processes on 29 Sep 2026 mention a deadline there; the date matched `closes_at` in every case checked).
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
