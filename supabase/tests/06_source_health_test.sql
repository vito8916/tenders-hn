-- Source health read model: latest run, last success and its age, recent
-- failures, and failed jobs; readable only with the service role.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Start from empty tables (a local database may hold synced data); the test rolls back.
delete from public.source_sync_runs;
delete from public.worker_job_failures;

-- Fixtures: owner (in an org) to check customers cannot read health data.
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'owner@test.local', 'authenticated', 'authenticated', '{}');
insert into public.organizations (id, name, slug, owner_id)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Test Org', 'test-org-pgtap', '11111111-1111-4111-8111-111111111111');

insert into public.source_sync_runs
  (source, window_start, window_end, status, pages_expected, pages_fetched, processes_seen, error, started_at, finished_at)
values
  ('honducompras_v1', '2026-09-15', '2026-09-22', 'succeeded', 12, 12, 330, null, now() - interval '3 days', now() - interval '3 days'),
  ('honducompras_v1', '2026-09-16', '2026-09-23', 'failed', 1, 0, 0, 'Portal returned 500', now() - interval '2 days', now() - interval '2 days'),
  ('honducompras_v1', '2026-09-17', '2026-09-24', 'succeeded', 12, 12, 335, null, now() - interval '5 hours 10 minutes', now() - interval '5 hours'),
  ('honducompras_v1', '2026-09-17', '2026-09-24', 'partial', 12, 4, 120, 'Parser health: result headers changed', now() - interval '2 hours', now() - interval '1 hour 55 minutes'),
  ('honducompras_v1', '2026-09-17', '2026-09-24', 'running', 12, 3, 90, null, now() - interval '10 minutes', null),
  ('other_source', '2026-09-17', '2026-09-24', 'failed', null, 0, 0, 'Search form not found', now() - interval '1 hour', now() - interval '1 hour');

-- ---------- Source health ----------
select is((select count(*)::int from public.source_health), 2, 'one row per source');

select results_eq(
  $$select latest_run_status, latest_run_pages_expected, latest_run_pages_fetched, latest_run_finished_at is null
    from public.source_health where source = 'honducompras_v1'$$,
  $$values ('running'::text, 12, 3, true)$$,
  'the latest run is the most recently started one, even while running'
);
select results_eq(
  $$select last_success_at = now() - interval '5 hours', last_success_age, last_success_pages, last_success_processes
    from public.source_health where source = 'honducompras_v1'$$,
  $$values (true, interval '5 hours', 12, 335)$$,
  'the last success is the newest succeeded run, with its age, pages, and processes'
);
select is(
  (select failed_runs_last_24h from public.source_health where source = 'honducompras_v1'),
  1,
  'failed and partial runs of the last 24 hours are counted; older ones are not'
);
select results_eq(
  $$select latest_run_status, latest_run_error, last_success_at, last_success_age
    from public.source_health where source = 'other_source'$$,
  $$values ('failed'::text, 'Search form not found'::text, null::timestamptz, null::interval)$$,
  'a source that never succeeded has no last success'
);

-- ---------- Failed jobs ----------
insert into public.worker_job_failures (queue, msg_id, message, attempts, error, enqueued_at)
values ('ingest', 42, '{"type": "fetch_detail", "processId": "x"}', 3, 'Detail table not found', now() - interval '1 hour');

select is(
  (select job_type from public.worker_job_failures where msg_id = 42),
  'fetch_detail',
  'the job type is read from the message'
);
select throws_ok(
  $$insert into public.worker_job_failures (queue, msg_id, message, attempts, error, enqueued_at)
    values ('ingest', 42, '{}', 3, 'again', now())$$,
  '23505', null, 'one failure row per queue message'
);
select lives_ok(
  $$insert into public.worker_job_failures (queue, msg_id, message, attempts, error, enqueued_at)
    values ('maintenance', 42, '{"type": "heartbeat"}', 3, 'x', now())$$,
  'message ids repeat across queues'
);

-- ---------- Access ----------
set local role service_role;
select is((select count(*)::int from public.source_health), 2, 'the service role reads source health');
select is((select count(*)::int from public.worker_job_failures), 2, 'the service role reads failed jobs');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select throws_ok('select * from public.source_health', '42501', null, 'members cannot read source health');
select throws_ok('select * from public.worker_job_failures', '42501', null, 'members cannot read failed jobs');
reset role;

set local role anon;
select throws_ok('select * from public.source_health', '42501', null, 'anon cannot read source health');
select throws_ok('select * from public.worker_job_failures', '42501', null, 'anon cannot read failed jobs');
reset role;

select * from finish();
rollback;
