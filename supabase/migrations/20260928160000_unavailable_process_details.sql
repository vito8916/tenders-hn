-- Some processes are listed by the portal but their detail page comes back
-- with an empty process table. That is a state of the process, not a parser
-- failure: retrying cannot make the portal publish it, and treating it as a
-- failure retried it on every sync and hourly recheck.
--
-- The worker records when it last saw the empty page (cleared on the next
-- successful read), and syncs and rechecks wait 6 hours before asking again.
-- source_health counts these processes so a portal-wide problem stands out.

alter table public.procurement_processes
  add column detail_unavailable_at timestamptz;

create or replace view public.source_health
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
  ) as failed_runs_last_24h,
  -- A jump here means the portal serves empty detail pages broadly, not just
  -- for a few unpublished processes.
  (
    select count(*)::integer
    from public.procurement_processes p
    where p.source = sources.source and p.detail_unavailable_at is not null
  ) as processes_without_detail
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
