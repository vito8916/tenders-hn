-- Match states: a match is «nueva» for its search until a finished run of
-- that search found it relevant, «actualizada» when the process changed
-- since then, and «conocida» otherwise; runs count their new relevant matches.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'owner@test.local', 'authenticated', 'authenticated', '{}');
insert into public.organizations (id, name, slug, owner_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Test Org', 'test-org-pgtap', '11111111-1111-4111-8111-111111111111');
insert into public.organization_subscriptions (org_id, plan_id, status, source, current_period_start, current_period_end)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'pro', 'active', 'manual', now(), now() + interval '1 month');
insert into public.saved_searches (id, org_id, name) values
  ('5eeeeeee-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Software'),
  ('5eeeeeee-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Otra');

-- Processes A (unchanged), B (changes version), C (discarded before), D (first seen in run 2).
insert into public.procurement_processes (id, source, source_process_key, expediente, buyer_entity, title, detail_url) values
  ('a0000000-0000-4000-8000-00000000000a', 'honducompras_v1', 'a', 'A-1', 'IHSS', 'A', 'https://example.test/a'),
  ('a0000000-0000-4000-8000-00000000000b', 'honducompras_v1', 'b', 'B-1', 'IHSS', 'B', 'https://example.test/b'),
  ('a0000000-0000-4000-8000-00000000000c', 'honducompras_v1', 'c', 'C-1', 'IHSS', 'C', 'https://example.test/c'),
  ('a0000000-0000-4000-8000-00000000000d', 'honducompras_v1', 'd', 'D-1', 'IHSS', 'D', 'https://example.test/d');
insert into public.process_versions (id, process_id, content_sha256, detail) values
  ('b0000000-0000-4000-8000-0000000000a1', 'a0000000-0000-4000-8000-00000000000a', 'a1', '{}'),
  ('b0000000-0000-4000-8000-0000000000b1', 'a0000000-0000-4000-8000-00000000000b', 'b1', '{}'),
  ('b0000000-0000-4000-8000-0000000000b2', 'a0000000-0000-4000-8000-00000000000b', 'b2', '{}');

insert into public.search_runs (id, org_id, saved_search_id, status, created_at) values
  ('c0000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '5eeeeeee-0000-4000-8000-000000000001', 'completed', now() - interval '2 days'),
  ('c0000000-0000-4000-8000-000000000009', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '5eeeeeee-0000-4000-8000-000000000001', 'failed', now() - interval '36 hours'),
  ('c0000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '5eeeeeee-0000-4000-8000-000000000001', 'completed', now() - interval '1 day'),
  ('c0000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '5eeeeeee-0000-4000-8000-000000000002', 'completed', now());

create function pg_temp.add_match(run uuid, process uuid, version uuid, relevance text) returns void language sql as $$
  insert into public.search_run_matches (run_id, org_id, process_id, process_version_id, retrieval_rank, relevance, expediente, title, buyer_entity, detail_url)
  values (run, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', process, version, 1, relevance, 'X', 'X', 'IHSS', 'https://example.test');
$$;
create function pg_temp.state(run uuid, process uuid) returns text language sql as $$
  select match_state from public.search_run_matches where run_id = run and process_id = process;
$$;

-- Run 1: A and B relevant, C discarded.
select pg_temp.add_match('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', 'b0000000-0000-4000-8000-0000000000a1', 'muy_relevante');
select pg_temp.add_match('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-0000000000b1', 'posible');
select pg_temp.add_match('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000c', null, 'descartada');
-- A failed run in between found D relevant; it does not count.
select pg_temp.add_match('c0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-00000000000d', null, 'posible');
select private.set_match_states('c0000000-0000-4000-8000-000000000001');

select is(pg_temp.state('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a'), 'nueva', 'the first run finds everything new');
select is((select new_matches_count from public.search_runs where id = 'c0000000-0000-4000-8000-000000000001'), 2, 'the first run counts its new relevant matches, not the discarded one');

-- Run 2: A unchanged, B with a new version, C now relevant, D new.
select pg_temp.add_match('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-00000000000a', 'b0000000-0000-4000-8000-0000000000a1', 'muy_relevante');
select pg_temp.add_match('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-0000000000b2', 'muy_relevante');
select pg_temp.add_match('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-00000000000c', null, 'posible');
select pg_temp.add_match('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-00000000000d', null, 'posible');
select private.set_match_states('c0000000-0000-4000-8000-000000000002');

select is(pg_temp.state('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-00000000000a'), 'conocida', 'an unchanged process found before is known');
select is(pg_temp.state('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-00000000000b'), 'actualizada', 'a process with a new version is updated');
select is(pg_temp.state('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-00000000000c'), 'nueva', 'a process that was only discarded before is new');
select is(pg_temp.state('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-00000000000d'), 'nueva', 'a failed run does not make a process known');
select is((select new_matches_count from public.search_runs where id = 'c0000000-0000-4000-8000-000000000002'), 2, 'the second run counts C and D');

-- Another search of the same organization starts from scratch.
select pg_temp.add_match('c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-00000000000a', 'b0000000-0000-4000-8000-0000000000a1', 'posible');
select private.set_match_states('c0000000-0000-4000-8000-000000000003');
select is(pg_temp.state('c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-00000000000a'), 'nueva', 'states are per search');

-- Recomputing a redelivered run gives the same answer.
select private.set_match_states('c0000000-0000-4000-8000-000000000002');
select is(pg_temp.state('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-00000000000b'), 'actualizada', 'recomputing is stable');

set local role authenticated;
select throws_ok(
  $$select private.set_match_states('c0000000-0000-4000-8000-000000000002')$$,
  '42501', null, 'users cannot compute match states'
);
reset role;

select * from finish();
rollback;
