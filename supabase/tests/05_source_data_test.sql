-- Shared source data: readable by organization members only, written only by
-- the worker, and one row per portal process, content version, and document.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Start from empty source tables (a local database may hold synced data); the test rolls back.
delete from public.procurement_processes;
delete from public.source_sync_runs;
delete from pgmq.q_ingest;

-- Fixtures: owner (in an org), outsider (in no org)
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'owner@test.local', 'authenticated', 'authenticated', '{}'),
  ('33333333-3333-4333-8333-333333333333', 'outsider@test.local', 'authenticated', 'authenticated', '{}');
insert into public.organizations (id, name, slug, owner_id)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Test Org', 'test-org-pgtap', '11111111-1111-4111-8111-111111111111');

insert into public.procurement_processes (id, source, source_process_key, expediente, buyer_entity, title, detail_url)
values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'honducompras_v1', '117:1:LPN-008-2026', 'LPN-008-2026',
  'Instituto Hondureño de Seguridad Social (IHSS)', 'Adquisición de soporte funcional SAP', 'http://example.test/detail'
);
insert into public.process_versions (process_id, content_sha256, detail)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'sha-1', '{"stage": "Recepción de Ofertas"}');
insert into public.source_documents (process_id, source_url, title, kind)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'http://example.test/pliego.pdf', 'Pliego', 'pliego');
insert into public.source_sync_runs (source, window_start, window_end) values ('honducompras_v1', '2026-09-22', '2026-09-23');

-- ---------- Idempotency ----------
select throws_ok(
  $$insert into public.procurement_processes (source, source_process_key, expediente, buyer_entity, title, detail_url)
    values ('honducompras_v1', '117:1:LPN-008-2026', 'LPN-008-2026', 'IHSS', 'Duplicate', 'http://example.test/other')$$,
  '23505', null, 'one row per source process key'
);
select lives_ok(
  $$insert into public.procurement_processes (source, source_process_key, expediente, buyer_entity, title, detail_url)
    values ('honducompras_v1', '999:1:LPN-008-2026', 'LPN-008-2026', 'Otra entidad', 'Same expediente', 'http://example.test/other')$$,
  'the same expediente from another institution is a different process'
);
select throws_ok(
  $$insert into public.process_versions (process_id, content_sha256, detail)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'sha-1', '{}')$$,
  '23505', null, 'one version per distinct content'
);
select throws_ok(
  $$insert into public.source_documents (process_id, source_url, title, kind)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'http://example.test/pliego.pdf', 'Pliego again', 'pliego')$$,
  '23505', null, 'one document row per link'
);

-- ---------- Search ----------
select ok(
  (select search_tsv @@ websearch_to_tsquery('spanish', 'adquisicion soporte hondureno')
   from public.procurement_processes where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  'full-text search ignores accents'
);

-- ---------- Organization member ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

select is((select count(*)::int from public.procurement_processes), 2, 'members read processes');
select is((select count(*)::int from public.process_versions), 1, 'members read process versions');
select is((select count(*)::int from public.source_documents), 1, 'members read documents');
select is((select count(*)::int from public.source_sync_runs), 1, 'members read sync runs');
select throws_ok('select * from public.source_pages', '42501', null, 'members cannot read raw page bookkeeping');
select throws_ok(
  $$update public.procurement_processes set title = 'x'$$,
  '42501', null, 'members cannot change processes'
);
select throws_ok(
  $$insert into public.process_events (process_id, kind) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'created')$$,
  '42501', null, 'members cannot write events'
);

-- ---------- User in no organization ----------
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
select is((select count(*)::int from public.procurement_processes), 0, 'users outside every organization see no processes');
select is((select count(*)::int from public.source_documents), 0, 'users outside every organization see no documents');
reset role;

-- ---------- Anonymous ----------
set local role anon;
select throws_ok('select * from public.procurement_processes', '42501', null, 'anon cannot read processes');
reset role;

-- ---------- Schedule ----------
select ok(exists (select 1 from cron.job where jobname = 'enqueue-ingest-sync'), 'syncs are scheduled');
select private.enqueue_ingest_sync();
select private.enqueue_ingest_sync();
select is(
  (select count(*)::int from pgmq.q_ingest where message ->> 'type' = 'sync_window'),
  1,
  'a waiting sync is not enqueued twice'
);

-- ---------- Rechecking open processes ----------
delete from pgmq.q_ingest;
insert into public.procurement_processes (id, source, source_process_key, expediente, buyer_entity, title, detail_url, closes_at, last_checked_at)
values
  ('c0000000-0000-4000-8000-000000000001', 'honducompras_v1', 'k:open-stale', 'A', 'E', 'Open, checked long ago', 'http://x', now() + interval '20 days', now() - interval '2 days'),
  ('c0000000-0000-4000-8000-000000000002', 'honducompras_v1', 'k:open-fresh', 'B', 'E', 'Open, checked recently', 'http://x', now() + interval '20 days', now() - interval '1 hour'),
  ('c0000000-0000-4000-8000-000000000003', 'honducompras_v1', 'k:closed', 'C', 'E', 'Closed a week ago', 'http://x', now() - interval '7 days', now() - interval '2 days'),
  ('c0000000-0000-4000-8000-000000000004', 'honducompras_v1', 'k:just-closed', 'D', 'E', 'Closed an hour ago', 'http://x', now() - interval '1 hour', now() - interval '2 days'),
  ('c0000000-0000-4000-8000-000000000005', 'honducompras_v1', 'k:queued', 'F', 'E', 'Open, already queued', 'http://x', now() + interval '20 days', now() - interval '2 days');
-- Keep the earlier fixtures out of the batch.
update public.procurement_processes set closes_at = now() - interval '30 days' where source_process_key not like 'k:%';
select pgmq.send('ingest', '{"type": "fetch_detail", "processId": "c0000000-0000-4000-8000-000000000005"}');

select is(private.enqueue_open_rechecks(), 2, 'open processes not checked for 6 hours are enqueued');
select results_eq(
  $$select message ->> 'processId' from pgmq.q_ingest where message ->> 'type' = 'fetch_detail' order by 1$$,
  $$values ('c0000000-0000-4000-8000-000000000001'), ('c0000000-0000-4000-8000-000000000004'), ('c0000000-0000-4000-8000-000000000005')$$,
  'recently checked, long-closed, and already queued processes are skipped'
);
select is(private.enqueue_open_rechecks(), 0, 'a second run does not enqueue them twice');
select ok(exists (select 1 from cron.job where jobname = 'enqueue-open-rechecks'), 'rechecks are scheduled');

select * from finish();
rollback;
