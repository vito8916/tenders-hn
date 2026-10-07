-- Saved searches and their runs: owners and admins write searches within
-- their plan, any member runs one now,
-- and other organizations see nothing.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'owner@test.local', 'authenticated', 'authenticated', '{}'),
  ('22222222-2222-4222-8222-222222222222', 'other@test.local', 'authenticated', 'authenticated', '{}'),
  ('33333333-3333-4333-8333-333333333333', 'admin@test.local', 'authenticated', 'authenticated', '{}'),
  ('44444444-4444-4444-8444-444444444444', 'member@test.local', 'authenticated', 'authenticated', '{}');
insert into public.organizations (id, name, slug, owner_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Test Org', 'test-org-pgtap', '11111111-1111-4111-8111-111111111111'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Other Org', 'other-org-pgtap', '22222222-2222-4222-8222-222222222222');
insert into public.organization_members (org_id, user_id, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', 'admin'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '44444444-4444-4444-8444-444444444444', 'member');
insert into public.plans (id, name, max_members, max_active_searches, min_schedule_interval, monthly_ai_credits)
values ('test_searches', 'Test', 5, 3, null, 0);
insert into public.source_sync_runs (id, source, window_start, window_end, status, started_at, finished_at)
overriding system value values
  (901, 'honducompras_v1', '2026-09-20', '2026-09-27', 'succeeded', now() - interval '3 hours', now() - interval '170 minutes'),
  (902, 'honducompras_v1', '2026-09-23', '2026-09-30', 'succeeded', now() - interval '10 minutes', now()),
  (903, 'honducompras_v1', '2026-09-23', '2026-09-30', 'failed', now() - interval '5 minutes', now());

create function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;
-- The app never chooses ids, so searches are found by name (as the current user sees them).
create function pg_temp.search_id(search_name text) returns uuid language sql as $$
  select id from public.saved_searches where name = search_name;
$$;

-- ---------- Plan ----------
set local role authenticated;
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');

select throws_ok(
  $$insert into public.saved_searches (org_id, name) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Software')$$,
  'P0001', 'subscription_inactive', 'searches need an active plan'
);
reset role;
insert into public.organization_subscriptions (org_id, plan_id, status, current_period_end)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'test_searches', 'active', now() + interval '30 days');
-- Activating the plan created «Recomendadas», which counts toward the plan's three searches.

-- ---------- Writing searches ----------
set local role authenticated;
select pg_temp.act_as('33333333-3333-4333-8333-333333333333');

select lives_ok(
  $$insert into public.saved_searches (org_id, name, keywords, entities)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '  Software  ',
            array[' SAP ', '', 'sap', 'Licencias'], array['IHSS'])$$,
  'an admin creates a search'
);
select results_eq(
  $$select name, keywords, entities, created_by from public.saved_searches where not is_default$$,
  $$values ('Software'::text, array['SAP', 'Licencias'], array['IHSS'], '33333333-3333-4333-8333-333333333333'::uuid)$$,
  'names and lists are tidied'
);
select throws_ok(
  $$insert into public.saved_searches (org_id, name) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'SOFTWARE')$$,
  '23505', null, 'names are unique in the organization, ignoring case'
);
select throws_ok(
  $$insert into public.saved_searches (org_id, name, inherits_profile) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Cómputo', false)$$,
  '23514', null, 'a search that does not inherit the profile needs a description'
);
select lives_ok(
  $$insert into public.saved_searches (org_id, name, inherits_profile, description)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Cómputo', false, 'Computadoras y equipo de red')$$,
  'a search with its own description is created'
);
select throws_ok(
  $$insert into public.saved_searches (org_id, name) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Tercera')$$,
  'P0001', 'search_limit_reached', 'the plan limits active searches'
);
select lives_ok(
  $$insert into public.saved_searches (org_id, name, is_active)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Tercera', false)$$,
  'paused searches do not count'
);
select throws_ok(
  $$update public.saved_searches set is_active = true where id = pg_temp.search_id('Tercera')$$,
  'P0001', 'search_limit_reached', 'activating one past the limit is rejected'
);

select throws_ok(
  $$update public.saved_searches set extracted_profile = '{}' where id = pg_temp.search_id('Cómputo')$$,
  '42501', null, 'only the worker writes the extraction'
);
reset role;
update public.saved_searches set extracted_profile = '{}', extraction_version = 'v2' where id = pg_temp.search_id('Cómputo');
set local role authenticated;
select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
update public.saved_searches set keywords = array['Redes'] where id = pg_temp.search_id('Cómputo');
select ok(
  (select extracted_profile is not null from public.saved_searches where id = pg_temp.search_id('Cómputo')),
  'the extraction is kept when the description does not change'
);
update public.saved_searches set description = 'Computadoras portátiles' where id = pg_temp.search_id('Cómputo');
select ok(
  (select extracted_profile is null and updated_by = '33333333-3333-4333-8333-333333333333'
   from public.saved_searches where id = pg_temp.search_id('Cómputo')),
  'a new description clears the extraction'
);

select pg_temp.act_as('44444444-4444-4444-8444-444444444444');
select is((select count(*)::int from public.saved_searches), 4, 'members read the searches');
select throws_ok(
  $$insert into public.saved_searches (org_id, name, is_active) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Miembro', false)$$,
  '42501', null, 'members cannot create searches'
);
update public.saved_searches set name = 'Cambiado' where id = pg_temp.search_id('Software');
select is(
  (select name from public.saved_searches where id = pg_temp.search_id('Software')),
  'Software',
  'members cannot edit searches'
);
select throws_ok(
  $$update public.saved_searches set is_default = true where id = pg_temp.search_id('Software')$$,
  '42501', null, 'which search is the default is not writable'
);
reset role;

select is(
  (select array_agg(event_name order by id) from public.app_events where metadata ->> 'search_id' = pg_temp.search_id('Cómputo')::text),
  array['saved_search.created', 'saved_search.updated', 'saved_search.updated'],
  'changes to a search are logged'
);

set local role authenticated;
select pg_temp.act_as('44444444-4444-4444-8444-444444444444');
select results_eq(
  $$select has_active_plan, max_active_searches, active_searches, max_daily_reports
    from public.saved_search_limits('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
  $$values (true, 3, 3, 8)$$,
  'members see what the plan allows'
);
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select is(
  (select count(*)::int from public.saved_search_limits('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')),
  0,
  'other organizations do not'
);
reset role;

-- ---------- Running now ----------
set local role authenticated;
select pg_temp.act_as('44444444-4444-4444-8444-444444444444');

select throws_ok(
  $$select public.request_search_run(pg_temp.search_id('Software'))$$,
  'P0001', 'no_profile', 'a search that inherits the profile needs one'
);
select throws_ok(
  $$select public.request_search_run(pg_temp.search_id('Tercera'))$$,
  'P0001', 'search_inactive', 'paused searches do not run'
);
select lives_ok(
  $$select public.request_search_run(pg_temp.search_id('Cómputo'))$$,
  'a member runs a search with its own description'
);
select results_eq(
  $$select trigger, status, profile_version, sync_run_id, created_by, config_snapshot -> 'search' ->> 'description'
    from public.search_runs where saved_search_id = pg_temp.search_id('Cómputo')$$,
  $$values ('manual'::text, 'queued'::text, null::integer, 902::bigint, '44444444-4444-4444-8444-444444444444'::uuid,
            'Computadoras portátiles'::text)$$,
  'the run freezes the criteria and uses the latest complete ingestion'
);
select throws_ok(
  $$select public.request_search_run(pg_temp.search_id('Cómputo'))$$,
  'P0001', 'run_in_progress', 'a second run of the same search cannot start'
);

select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select lives_ok(
  $$select public.save_company_profile('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Venta de software')$$,
  'the owner saves the profile'
);
select lives_ok(
  $$select public.request_search_run(pg_temp.search_id('Software'))$$,
  'another search runs while the first is in flight'
);
select is(
  (select profile_version from public.search_runs where saved_search_id = pg_temp.search_id('Software')),
  1,
  'a search that inherits the profile records its version'
);
select throws_ok(
  $$insert into public.search_runs (org_id, saved_search_id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', pg_temp.search_id('Software'))$$,
  '42501', null, 'members cannot write runs directly'
);
reset role;

select is(
  (select count(*)::int from pgmq.q_match q join public.search_runs r on r.id = (q.message ->> 'runId')::uuid
   where q.message ->> 'type' = 'search_run'),
  2,
  'both runs are queued for the worker'
);

-- ---------- Without a plan ----------
update public.search_runs set status = 'completed';
update public.organization_subscriptions set status = 'expired' where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

set local role authenticated;
select pg_temp.act_as('44444444-4444-4444-8444-444444444444');
select throws_ok(
  $$select public.request_search_run(pg_temp.search_id('Cómputo'))$$,
  'P0001', 'subscription_inactive', 'without an active plan searches do not run now either'
);

-- ---------- Other organizations ----------
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select is((select count(*)::int from public.saved_searches), 0, 'other organizations cannot read the searches');
select is((select count(*)::int from public.search_runs), 0, 'other organizations cannot read the runs');
select throws_ok(
  $$select public.request_search_run(pg_temp.search_id('Software'))$$,
  'P0001', 'search_not_found', 'other organizations cannot run the searches'
);
delete from public.saved_searches;
reset role;
select is(
  (select count(*)::int from public.saved_searches where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  4,
  'other organizations cannot delete the searches'
);

-- ---------- Deleting ----------
set local role authenticated;
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
delete from public.saved_searches where id = pg_temp.search_id('Cómputo');
reset role;
select is(
  (select count(*)::int from public.search_runs where saved_search_id = pg_temp.search_id('Cómputo')),
  0,
  'deleting a search deletes its runs'
);

select * from finish();
rollback;
