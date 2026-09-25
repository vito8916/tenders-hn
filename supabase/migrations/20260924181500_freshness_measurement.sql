-- Freshness measurement (spec §14.1): how late processes appear on the portal
-- relative to their start date, and whether the 7-day sync window misses any.
--
-- The regular sync only sees processes whose start date is within the last 7
-- days, so a process that appears with an older start date is invisible to
-- it. A daily 30-day sync catches those within a day of their appearance.
--
--   process_arrivals  one row per process that appeared after an earlier
--                     successful sync had already covered its start date;
--                     processes that predate the first sync covering their
--                     start date are backfill, not arrivals, and are left out

-- ============================================================
-- Daily wide sync
-- ============================================================

create or replace function private.enqueue_ingest_wide_sync(window_days integer default 30)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'America/Tegucigalpa')::date;
begin
  if not exists (
    select 1 from pgmq.q_ingest q
    where q.message ->> 'type' = 'sync_window' and q.message ? 'from'
  ) then
    perform pgmq.send('ingest', jsonb_build_object(
      'type', 'sync_window',
      'from', today - window_days,
      'to', today,
      'enqueued_at', now()
    ));
  end if;
end;
$$;

-- 04:00 in Honduras: between the 03:00 and 06:00 regular syncs, before the
-- :30 open-process recheck.
select cron.schedule('enqueue-ingest-wide-sync', '0 10 * * *', 'select private.enqueue_ingest_wide_sync()');

-- ============================================================
-- Arrivals
-- ============================================================

create view public.process_arrivals
with (security_invoker = true)
as
select
  p.id as process_id,
  p.source,
  p.expediente,
  p.source_start_at,
  p.first_seen_at,
  p.first_seen_at - p.source_start_at as appearance_lag,
  -- Days between the start date and the day it was first seen, in Honduras.
  -- More than the regular window (7) means only the wide sync could see it.
  (p.first_seen_at at time zone 'America/Tegucigalpa')::date
    - (p.source_start_at at time zone 'America/Tegucigalpa')::date as start_days_before_first_seen,
  found_by.id as first_seen_run_id,
  found_by.window_end - found_by.window_start as first_seen_run_window_days
from public.procurement_processes p
left join lateral (
  select r.id, r.window_start, r.window_end
  from public.source_sync_runs r
  where r.source = p.source and r.started_at <= p.first_seen_at
  order by r.started_at desc
  limit 1
) found_by on true
where exists (
  select 1
  from public.source_sync_runs earlier
  where earlier.source = p.source
    and earlier.status = 'succeeded'
    and earlier.finished_at < p.first_seen_at
    and (p.source_start_at at time zone 'America/Tegucigalpa')::date
      between earlier.window_start and earlier.window_end
);

grant select on public.process_arrivals to service_role;
