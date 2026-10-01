-- The plan's history_months: members read runs, matches, and reports created
-- within it; older ones stay stored but hidden, and unlimited plans see all.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'owner@test.local', 'authenticated', 'authenticated', '{}');
insert into public.organizations (id, name, slug, owner_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Test Org', 'test-org-pgtap', '11111111-1111-4111-8111-111111111111');
insert into public.plans (id, name, max_members, max_active_searches, min_schedule_interval, history_months, monthly_ai_credits)
values ('test_short', 'Corto', 5, 5, interval '1 day', 3, 0), ('test_all', 'Todo', 5, 5, interval '1 day', null, 0);
insert into public.organization_subscriptions (org_id, plan_id, status, source, current_period_start, current_period_end)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'test_short', 'active', 'manual', now(), now() + interval '1 month');
insert into public.saved_searches (id, org_id, name) values
  ('5eeeeeee-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Software');
insert into public.procurement_processes (id, source, source_process_key, expediente, buyer_entity, title, detail_url) values
  ('a0000000-0000-4000-8000-00000000000a', 'honducompras_v1', 'a', 'A-1', 'IHSS', 'A', 'https://example.test/a');
insert into public.search_runs (id, org_id, saved_search_id, status, created_at, report_path) values
  ('c0000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '5eeeeeee-0000-4000-8000-000000000001', 'completed',
   now() - interval '4 months', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/c0000000-0000-4000-8000-000000000001.pdf'),
  ('c0000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '5eeeeeee-0000-4000-8000-000000000001', 'completed',
   now() - interval '2 months', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/c0000000-0000-4000-8000-000000000002.pdf');
insert into public.search_run_matches (run_id, org_id, process_id, retrieval_rank, relevance, expediente, title, buyer_entity, detail_url)
select id, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a0000000-0000-4000-8000-00000000000a', 1, 'posible', 'A-1', 'A', 'IHSS', 'https://example.test/a'
from public.search_runs;
insert into storage.objects (bucket_id, name) values
  ('reports', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/c0000000-0000-4000-8000-000000000001.pdf'),
  ('reports', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/c0000000-0000-4000-8000-000000000002.pdf');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

select is((select array_agg(id::text) from public.search_runs), array['c0000000-0000-4000-8000-000000000002'], 'a 3-month plan shows the run from 2 months ago, not 4');
select is((select count(*)::int from public.search_run_matches), 1, 'and only that run''s matches');
select is((select count(*)::int from storage.objects where bucket_id = 'reports'), 1, 'and only that run''s report');

reset role;
update public.organization_subscriptions set plan_id = 'test_all' where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
select is((select count(*)::int from public.search_runs), 2, 'an unlimited plan shows every run');

reset role;
update public.organization_subscriptions set plan_id = 'test_short', status = 'canceled' where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
select is((select count(*)::int from public.search_runs), 1, 'a lapsed plan keeps its history limit');

reset role;
select * from finish();
rollback;
