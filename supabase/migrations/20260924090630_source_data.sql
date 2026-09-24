-- Phase 1: shared source data captured from HonduCompras.
--
-- Written only by the worker (postgres role over DATABASE_URL). Processes,
-- versions, events, documents, and sync runs are public procurement data, so
-- any member of an organization can read them; clients never write.
--
--   source_sync_runs       one row per date-window sync; the latest succeeded
--                          row is the "última ingesta completa"
--   source_pages           one row per results page, raw HTML in Storage
--   procurement_processes  one row per portal process (Id0:Id1:Id2 key)
--   process_versions       detail page content, one row per distinct content
--   process_events         created / stage / deadline / document changes
--   source_documents       document links per process
--
-- Queue `ingest` carries `sync_window` and `fetch_detail` jobs. One consumer
-- reads it one message at a time, so the portal only ever sees one session.

-- ============================================================
-- Queue and helpers
-- ============================================================

select pgmq.create('ingest');

-- Any organization member may read shared source data.
create or replace function private.is_org_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members where user_id = (select auth.uid())
  );
$$;

-- unaccent() is only STABLE; generated columns need an IMMUTABLE wrapper
-- that pins the dictionary.
create or replace function private.immutable_unaccent(value text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, value);
$$;

-- ============================================================
-- Sync runs and raw pages
-- ============================================================

create table public.source_sync_runs (
  id bigint generated always as identity primary key,
  source text not null,
  window_start date not null,
  window_end date not null,
  status text not null default 'running' constraint source_sync_runs_status_check
    check (status in ('running', 'succeeded', 'failed', 'partial')),
  pages_expected integer,
  pages_fetched integer not null default 0,
  processes_seen integer not null default 0,
  processes_new integer not null default 0,
  processes_changed integer not null default 0,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint source_sync_runs_window_check check (window_start <= window_end)
);

create index source_sync_runs_source_status_started_idx
  on public.source_sync_runs using btree (source, status, started_at desc);

create table public.source_pages (
  id bigint generated always as identity primary key,
  sync_run_id bigint not null references public.source_sync_runs (id) on delete cascade,
  page_number integer not null,
  status text not null constraint source_pages_status_check
    check (status in ('parsed', 'failed')),
  row_count integer,
  html_sha256 text not null,
  -- Gzipped raw HTML in the source-pages bucket; cleared when retention removes the file.
  storage_path text,
  fetched_at timestamptz not null default now(),
  constraint source_pages_run_page_key unique (sync_run_id, page_number)
);

-- ============================================================
-- Processes, versions, events, documents
-- ============================================================

create table public.procurement_processes (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  -- Decoded Id0:Id1:Id2 from the portal's detail link, e.g. 117:1:LPN-008-2026.
  source_process_key text not null,
  expediente text not null,
  ocid text,
  buyer_entity text not null,
  purchase_unit text,
  title text not null,
  stage text,
  modality text,
  acquisition_type text,
  source_start_at timestamptz,
  -- Bid reception deadline ("Fecha Recepción Ofertas").
  closes_at timestamptz,
  detail_url text not null,
  current_version_id uuid,
  -- Observations by this platform, not official publication times.
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_checked_at timestamptz,
  search_tsv tsvector generated always as (
    to_tsvector(
      'spanish'::regconfig,
      private.immutable_unaccent(
        coalesce(title, '') || ' ' || coalesce(buyer_entity, '') || ' ' || coalesce(purchase_unit, '')
      )
    )
  ) stored,
  constraint procurement_processes_source_key unique (source, source_process_key)
);

create index procurement_processes_search_idx
  on public.procurement_processes using gin (search_tsv);
create index procurement_processes_expediente_trgm_idx
  on public.procurement_processes using gin (expediente extensions.gin_trgm_ops);
create index procurement_processes_closes_at_idx
  on public.procurement_processes using btree (closes_at);
create index procurement_processes_first_seen_idx
  on public.procurement_processes using btree (first_seen_at desc);

create table public.process_versions (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.procurement_processes (id) on delete cascade,
  content_sha256 text not null,
  -- Parsed detail page: full object, dates with times, funding, UNSPSC items,
  -- place of bid reception, bid document price, contact, documents.
  detail jsonb not null,
  observed_at timestamptz not null default now(),
  constraint process_versions_process_content_key unique (process_id, content_sha256)
);

alter table public.procurement_processes
  add constraint procurement_processes_current_version_fkey
  foreign key (current_version_id) references public.process_versions (id) on delete set null;

create index procurement_processes_current_version_idx
  on public.procurement_processes using btree (current_version_id);

create table public.process_events (
  id bigint generated always as identity primary key,
  process_id uuid not null references public.procurement_processes (id) on delete cascade,
  version_id uuid references public.process_versions (id) on delete set null,
  kind text not null constraint process_events_kind_check
    check (kind in ('created', 'stage_changed', 'deadline_changed', 'document_added', 'document_replaced', 'document_removed')),
  before jsonb,
  after jsonb,
  observed_at timestamptz not null default now()
);

create index process_events_process_observed_idx
  on public.process_events using btree (process_id, observed_at desc);
create index process_events_observed_idx
  on public.process_events using btree (observed_at desc);
create index process_events_version_idx
  on public.process_events using btree (version_id);

create table public.source_documents (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.procurement_processes (id) on delete cascade,
  source_url text not null,
  title text not null,
  kind text not null constraint source_documents_kind_check
    check (kind in ('aviso', 'pliego', 'anexo', 'other')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  removed_at timestamptz,
  constraint source_documents_process_url_key unique (process_id, source_url)
);

-- ============================================================
-- Grants and RLS
-- ============================================================

grant select, insert, update, delete on
  public.source_sync_runs,
  public.source_pages,
  public.procurement_processes,
  public.process_versions,
  public.process_events,
  public.source_documents
to service_role;

grant select on
  public.source_sync_runs,
  public.procurement_processes,
  public.process_versions,
  public.process_events,
  public.source_documents
to authenticated;

alter table public.source_sync_runs enable row level security;
alter table public.source_pages enable row level security;
alter table public.procurement_processes enable row level security;
alter table public.process_versions enable row level security;
alter table public.process_events enable row level security;
alter table public.source_documents enable row level security;

-- source_pages: no policies; raw capture bookkeeping for the worker and admin app.

create policy "Sync runs readable by organization members"
on public.source_sync_runs for select to authenticated
using ((select private.is_org_member()));

create policy "Processes readable by organization members"
on public.procurement_processes for select to authenticated
using ((select private.is_org_member()));

create policy "Process versions readable by organization members"
on public.process_versions for select to authenticated
using ((select private.is_org_member()));

create policy "Process events readable by organization members"
on public.process_events for select to authenticated
using ((select private.is_org_member()));

create policy "Source documents readable by organization members"
on public.source_documents for select to authenticated
using ((select private.is_org_member()));

-- ============================================================
-- Storage: raw result pages (service role only, no policies)
-- ============================================================

insert into storage.buckets (id, name, public)
values ('source-pages', 'source-pages', false)
on conflict (id) do nothing;

-- ============================================================
-- Schedule
-- ============================================================

-- Enqueue a sync only when none is waiting, so a stopped worker does not
-- come back to a backlog of syncs.
create or replace function private.enqueue_ingest_sync()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from pgmq.q_ingest q where q.message ->> 'type' = 'sync_window'
  ) then
    perform pgmq.send('ingest', jsonb_build_object('type', 'sync_window', 'enqueued_at', now()));
  end if;
end;
$$;

select cron.schedule('enqueue-ingest-sync', '0 */3 * * *', 'select private.enqueue_ingest_sync()');
