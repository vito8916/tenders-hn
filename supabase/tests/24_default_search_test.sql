-- «Recomendadas»: every organization's default search (plan §6.1 D6). It is
-- created when the plan activates, its first run starts once the
-- organization has both a plan and a profile, it cannot be deleted, paused,
-- renamed, or detached from the profile, and deleting the organization still
-- deletes it.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'owner@test.local', 'authenticated', 'authenticated', '{}'),
  ('22222222-2222-4222-8222-222222222222', 'owner2@test.local', 'authenticated', 'authenticated', '{}');
insert into public.organizations (id, name, slug, owner_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Profile First', 'profile-first-pgtap', '11111111-1111-4111-8111-111111111111'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Plan First', 'plan-first-pgtap', '22222222-2222-4222-8222-222222222222');
insert into public.plans (id, name, max_members, max_active_searches, min_schedule_interval, monthly_ai_credits)
values ('test_default', 'Test', 5, 1, interval '1 day', 0);

create function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.default_search(target_org uuid) returns uuid language sql as $$
  select id from public.saved_searches where org_id = target_org and is_default;
$$;

-- ---------- Profile, then plan (onboarding) ----------
set local role authenticated;
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select lives_ok(
  $$select public.save_company_profile('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Venta de software')$$,
  'the profile is saved before the plan exists'
);
reset role;
select is(pg_temp.default_search('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), null, 'without a plan there is no default search yet');
select is((select count(*)::int from public.search_runs where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 0, 'nor a run');

insert into public.organization_subscriptions (org_id, plan_id, status, current_period_end)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'test_default', 'active', now() + interval '30 days');

select results_eq(
  $$select name, inherits_profile, is_active, created_by from public.saved_searches
    where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  $$values ('Recomendadas'::text, true, true, '11111111-1111-4111-8111-111111111111'::uuid)$$,
  'activating the plan creates «Recomendadas» for the owner, following the profile'
);
select results_eq(
  $$select trigger, status, profile_version, created_by from public.search_runs
    where saved_search_id = pg_temp.default_search('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
  $$values ('first'::text, 'queued'::text, 1, null::uuid)$$,
  'and starts its first run on the saved profile'
);
select is(
  (select r.trigger from public.org_reports r join public.search_runs run on run.report_id = r.id
   where run.org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'first',
  'as a report of its own, so its email goes out with the first results'
);
select is(
  (select count(*)::int from pgmq.q_match
   where message ->> 'runId' = (select id::text from public.search_runs where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')),
  1,
  'the first run is queued for the worker'
);

update public.search_runs set status = 'completed' where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
update public.organization_subscriptions set status = 'past_due' where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
update public.organization_subscriptions set status = 'active' where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select is(
  (select count(*)::int from public.search_runs where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  1,
  'a later activation neither runs it again'
);
select is(
  (select count(*)::int from public.saved_searches where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  1,
  'nor creates another default search'
);

-- ---------- Plan, then profile ----------
insert into public.organization_subscriptions (org_id, plan_id, status, current_period_end)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'test_default', 'active', now() + interval '30 days');
select isnt(pg_temp.default_search('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), null, 'a plan without a profile creates the search');
select is((select count(*)::int from public.search_runs where org_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 0, 'but cannot run it yet');

set local role authenticated;
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select public.save_company_profile('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Uniformes');
reset role;
select is(
  (select trigger from public.search_runs where saved_search_id = pg_temp.default_search('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')),
  'first',
  'saving the profile then starts the first run'
);

-- ---------- It stays as it is ----------
set local role authenticated;
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select throws_ok(
  $$delete from public.saved_searches where id = pg_temp.default_search('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
  'P0001', 'default_search_locked', 'it cannot be deleted'
);
select throws_ok(
  $$update public.saved_searches set is_active = false where id = pg_temp.default_search('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
  'P0001', 'default_search_locked', 'or paused'
);
select throws_ok(
  $$update public.saved_searches set name = 'Mía' where id = pg_temp.default_search('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
  'P0001', 'default_search_locked', 'or renamed'
);
select throws_ok(
  $$update public.saved_searches set inherits_profile = false, description = 'Otra cosa'
    where id = pg_temp.default_search('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
  'P0001', 'default_search_locked', 'or detached from the profile'
);
select throws_ok(
  $$update public.saved_searches set is_default = false where id = pg_temp.default_search('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
  '42501', null, 'users cannot change which search is the default'
);
select lives_ok(
  $$update public.saved_searches set keywords = array['SAP'], entities = array['IHSS']
    where id = pg_temp.default_search('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
  'its keywords and filters can change'
);
select lives_ok(
  $$insert into public.saved_searches (org_id, name) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Otra')$$,
  'it does not count toward the plan''s lists'
);
select throws_ok(
  $$insert into public.saved_searches (org_id, name) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Tercera')$$,
  'P0001', 'search_limit_reached', 'which still limits the lists'
);
reset role;

-- ---------- Deleting the organization ----------
select lives_ok(
  $$delete from public.organizations where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'deleting the organization deletes its default search'
);
select is(
  (select count(*)::int from public.saved_searches where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  0,
  'and nothing of it is left'
);

select * from finish();
rollback;
