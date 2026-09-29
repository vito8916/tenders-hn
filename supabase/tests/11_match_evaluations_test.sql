-- Match evaluations: one row per distinct input, service role only; the
-- `match` queue exists for the evaluate_match job.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Start from empty source tables (a local database may hold synced data); the test rolls back.
delete from public.procurement_processes;

insert into auth.users (id, email, aud, role, raw_user_meta_data)
values ('11111111-1111-4111-8111-111111111111', 'owner@test.local', 'authenticated', 'authenticated', '{}');
insert into public.organizations (id, name, slug, owner_id)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Test Org', 'test-org-pgtap', '11111111-1111-4111-8111-111111111111');

insert into public.procurement_processes (id, source, source_process_key, expediente, buyer_entity, title, detail_url)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'honducompras_v1', '117:1:LPN-008-2026', 'LPN-008-2026', 'IHSS', 'Soporte SAP', 'http://example.test/detail');
insert into public.process_versions (id, process_id, content_sha256, detail)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'sha-1', '{}');

insert into public.match_evaluations
  (input_hash, process_id, process_version_id, model, questions_version, request, evidence, status)
values
  ('hash-1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'typesafe-ai/jev', 'v1', '{}', '{}', 'succeeded');

select throws_ok(
  $$insert into public.match_evaluations
      (input_hash, process_id, process_version_id, model, questions_version, request, evidence, status)
    values ('hash-1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'typesafe-ai/jev', 'v1', '{}', '{}', 'succeeded')$$,
  '23505', null, 'an input is evaluated once'
);
select throws_ok(
  $$insert into public.match_evaluations
      (input_hash, process_id, process_version_id, model, questions_version, request, evidence, status)
    values ('hash-2', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'typesafe-ai/jev', 'v1', '{}', '{}', 'pending')$$,
  '23514', null, 'status is succeeded or failed'
);
select ok(
  exists (select 1 from pgmq.list_queues() where queue_name = 'match'),
  'the match queue exists'
);

-- ---------- Access ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select throws_ok('select * from public.match_evaluations', '42501', null, 'members cannot read evaluations');
reset role;
set local role service_role;
select is((select count(*)::int from public.match_evaluations), 1, 'the service role reads evaluations');
reset role;

select * from finish();
rollback;
