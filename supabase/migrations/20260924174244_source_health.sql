-- Source health read model for the platform admin app (separate project).
--
--   source_health        one row per source: the latest run, the last
--                        successful sync and its age, and recent failures
--   worker_job_failures  one row per job that exhausted its attempts, with
--                        the error; written by the worker when it archives
--                        the message (the pgmq archive keeps no error)
--
-- Both are service role only: operational data, never shown to customers.
-- Customers read freshness from source_sync_runs directly.

-- ============================================================
-- Source health
-- ============================================================

create view public.source_health
with (security_invoker = true)
as
select
  sources.source,
  latest.id as latest_run_id,
  latest.status as latest_run_status,
  latest.started_at as latest_run_started_at,
  latest.finished_at as latest_run_finished_at,
  latest.pages_expected as latest_run_pages_expected,
  latest.pages_fetched as latest_run_pages_fetched,
  latest.error as latest_run_error,
  success.id as last_success_run_id,
  success.finished_at as last_success_at,
  now() - success.finished_at as last_success_age,
  success.pages_fetched as last_success_pages,
  success.processes_seen as last_success_processes,
  (
    select count(*)::integer
    from public.source_sync_runs r
    where r.source = sources.source
      and r.status in ('failed', 'partial')
      and r.started_at > now() - interval '24 hours'
  ) as failed_runs_last_24h
from (select distinct source from public.source_sync_runs) sources
left join lateral (
  select r.*
  from public.source_sync_runs r
  where r.source = sources.source
  order by r.started_at desc, r.id desc
  limit 1
) latest on true
left join lateral (
  select r.*
  from public.source_sync_runs r
  where r.source = sources.source and r.status = 'succeeded'
  order by r.started_at desc, r.id desc
  limit 1
) success on true;

-- ============================================================
-- Failed jobs
-- ============================================================

create table public.worker_job_failures (
  id bigint generated always as identity primary key,
  queue text not null,
  msg_id bigint not null,
  message jsonb,
  job_type text generated always as (message ->> 'type') stored,
  attempts integer not null,
  error text not null,
  enqueued_at timestamptz not null,
  failed_at timestamptz not null default now(),
  constraint worker_job_failures_queue_msg_key unique (queue, msg_id)
);

create index worker_job_failures_failed_at_idx
  on public.worker_job_failures using btree (failed_at desc);

-- ============================================================
-- Grants and RLS
-- ============================================================

grant select on public.source_health to service_role;
grant select, insert, update, delete on public.worker_job_failures to service_role;

alter table public.worker_job_failures enable row level security;
-- No policies: written by the worker, read by the admin app with the service role.
