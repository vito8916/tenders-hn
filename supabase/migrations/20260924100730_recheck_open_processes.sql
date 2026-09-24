-- ingest.recheck_open: re-read the detail page of processes that are still
-- open, including those outside the 7-day sync window.
--
-- The results list only shows stage and close date, so new annexes, deadline
-- times, and stage changes after a process leaves the window are only seen on
-- its detail page. Every hour this enqueues ordinary `fetch_detail` jobs for a
-- bounded batch of open processes, oldest check first. Detail fetches share
-- the single `ingest` consumer with syncs, so the batch stays small (about 12
-- minutes of requests at 2-3 s each) to keep syncs from waiting behind it.

create index procurement_processes_last_checked_idx
  on public.procurement_processes using btree (last_checked_at nulls first);

create or replace function private.enqueue_open_rechecks(batch_size integer default 300)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  enqueued integer;
begin
  with due as (
    select p.id
    from public.procurement_processes p
    -- A day of grace catches last-minute extensions and stage changes.
    where p.closes_at > now() - interval '1 day'
      and (p.last_checked_at is null or p.last_checked_at < now() - interval '6 hours')
      and not exists (
        select 1 from pgmq.q_ingest q
        where q.message ->> 'type' = 'fetch_detail' and q.message ->> 'processId' = p.id::text
      )
    order by p.last_checked_at nulls first
    limit batch_size
  )
  select count(*)
  into enqueued
  from (
    select pgmq.send('ingest', jsonb_build_object('type', 'fetch_detail', 'processId', due.id))
    from due
  ) sent;

  return enqueued;
end;
$$;

select cron.schedule('enqueue-open-rechecks', '30 * * * *', 'select private.enqueue_open_rechecks()');
