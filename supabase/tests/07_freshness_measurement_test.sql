-- Freshness measurement: processes that appeared after an earlier sync had
-- covered their start date, and the daily wide sync; service role only.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Start from empty tables (a local database may hold synced data); the test rolls back.
delete from public.procurement_processes;
delete from public.source_sync_runs;
delete from pgmq.q_ingest;

-- Runs: a regular baseline, a failed wide sync, the first wide sync, the next regular sync, the next wide sync.
insert into public.source_sync_runs (id, source, window_start, window_end, status, started_at, finished_at)
overriding system value
values
  (901, 'honducompras_v1', '2026-09-17', '2026-09-24', 'succeeded', '2026-09-24 12:00+00', '2026-09-24 12:05+00'),
  (902, 'honducompras_v1', '2026-08-25', '2026-09-24', 'failed', '2026-09-24 13:00+00', '2026-09-24 13:01+00'),
  (903, 'honducompras_v1', '2026-08-25', '2026-09-24', 'succeeded', '2026-09-24 14:00+00', '2026-09-24 14:10+00'),
  (904, 'honducompras_v1', '2026-09-17', '2026-09-24', 'succeeded', '2026-09-24 15:00+00', '2026-09-24 15:06+00'),
  (905, 'honducompras_v1', '2026-08-26', '2026-09-25', 'succeeded', '2026-09-25 10:00+00', '2026-09-25 10:10+00');

insert into public.procurement_processes (source, source_process_key, expediente, buyer_entity, title, detail_url, source_start_at, first_seen_at)
values
  -- Seen by the baseline: backfill.
  ('honducompras_v1', 'k:baseline', 'BASE', 'E', 'In the first sync', 'http://x', '2026-09-20 15:00+00', '2026-09-24 12:02+00'),
  -- Start date covered earlier only by the failed wide sync, first seen by the next one: backfill.
  ('honducompras_v1', 'k:backfill', 'FILL', 'E', 'Before the first window', 'http://x', '2026-09-01 15:00+00', '2026-09-24 14:05+00'),
  -- Appeared after the baseline with a start date at its window edge.
  ('honducompras_v1', 'k:edge', 'EDGE', 'E', 'At the window edge', 'http://x', '2026-09-17 20:43+00', '2026-09-24 15:03+00'),
  -- Appeared after the first wide sync with a start date 21 days back; only a wide sync can see it.
  ('honducompras_v1', 'k:missed', 'MISS', 'E', 'Beyond the regular window', 'http://x', '2026-09-04 15:00+00', '2026-09-25 10:05+00');

-- ---------- Arrivals ----------
select results_eq(
  $$select expediente, start_days_before_first_seen, first_seen_run_id, first_seen_run_window_days
    from public.process_arrivals order by expediente$$,
  $$values ('EDGE'::text, 7, 904::bigint, 7), ('MISS'::text, 21, 905::bigint, 30)$$,
  'arrivals are processes whose start date an earlier successful sync already covered'
);
select is(
  (select appearance_lag from public.process_arrivals where expediente = 'EDGE'),
  interval '6 days 18 hours 20 minutes',
  'the appearance lag runs from the start date to the first sighting'
);

-- ---------- Daily wide sync ----------
select ok(exists (select 1 from cron.job where jobname = 'enqueue-ingest-wide-sync'), 'the wide sync is scheduled');
select private.enqueue_ingest_sync();
select private.enqueue_ingest_wide_sync();
select private.enqueue_ingest_wide_sync();
select results_eq(
  $$select (message ->> 'to')::date - (message ->> 'from')::date, (message ->> 'to')::date
    from pgmq.q_ingest where message ? 'from'$$,
  $$values (30, (now() at time zone 'America/Tegucigalpa')::date)$$,
  'one 30-day sync ending today in Honduras is enqueued, never twice'
);
select is(
  (select count(*)::int from pgmq.q_ingest where message ->> 'type' = 'sync_window'),
  2,
  'a waiting regular sync does not block the wide one'
);

-- ---------- Access ----------
set local role authenticated;
select throws_ok('select * from public.process_arrivals', '42501', null, 'members cannot read arrivals');
reset role;
set local role anon;
select throws_ok('select * from public.process_arrivals', '42501', null, 'anon cannot read arrivals');
reset role;
set local role service_role;
select is((select count(*)::int from public.process_arrivals), 2, 'the service role reads arrivals');
reset role;

select * from finish();
rollback;
