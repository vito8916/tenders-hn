-- Company profiles and search runs: the owner saves the profile and starts a
-- run through request_search_run; members read their organization's rows;
-- only the worker writes results.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'owner@test.local', 'authenticated', 'authenticated', '{}'),
  ('22222222-2222-4222-8222-222222222222', 'other@test.local', 'authenticated', 'authenticated', '{}');
insert into public.organizations (id, name, slug, owner_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Test Org', 'test-org-pgtap', '11111111-1111-4111-8111-111111111111'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Other Org', 'other-org-pgtap', '22222222-2222-4222-8222-222222222222');

create function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

-- ---------- Requesting a run ----------
set local role authenticated;
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');

select lives_ok(
  $$select public.request_search_run('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '  Venta de software  ')$$,
  'the owner saves the profile and starts a run'
);
select results_eq(
  $$select description, version from public.company_profiles$$,
  $$values ('Venta de software'::text, 1)$$,
  'the profile is saved trimmed, as version 1'
);
select results_eq(
  $$select status, profile_version, trigger from public.search_runs$$,
  $$values ('queued'::text, 1, 'manual'::text)$$,
  'the run is queued for that version'
);
select throws_ok(
  $$select public.request_search_run('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Venta de software')$$,
  'P0001', 'run_in_progress', 'a second run cannot start while one is queued'
);
select throws_ok(
  $$select public.request_search_run('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '   ')$$,
  'P0001', 'empty_profile', 'an empty profile is rejected'
);
select throws_ok(
  $$insert into public.search_runs (org_id, profile_version) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1)$$,
  '42501', null, 'members cannot write runs directly'
);
reset role;

select ok(
  exists (
    select 1 from pgmq.q_match q join public.search_runs r on r.id = (q.message ->> 'runId')::uuid
    where q.message ->> 'type' = 'search_run'
  ),
  'the run is queued for the worker'
);

-- ---------- Profile versions ----------
update public.search_runs set status = 'completed';
update public.company_profiles set extracted_profile = '{"linesOfBusiness": []}', extraction_version = 'v2';

set local role authenticated;
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select public.request_search_run('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Venta de software');
select results_eq(
  $$select version, extracted_profile is not null from public.company_profiles$$,
  $$values (1, true)$$,
  'an unchanged description keeps its version and extraction'
);
reset role;
update public.search_runs set status = 'completed';

set local role authenticated;
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select public.request_search_run('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Venta de software y licencias');
select results_eq(
  $$select version, extracted_profile is null from public.company_profiles$$,
  $$values (2, true)$$,
  'a changed description is a new version, to be extracted again'
);
select is(
  (select profile_version from public.search_runs where status = 'queued'),
  2,
  'the new run uses the new version'
);

-- ---------- Other organizations ----------
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select throws_ok(
  $$select public.request_search_run('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Otra cosa')$$,
  'P0001', 'not_owner', 'only the owner starts a run'
);
select is((select count(*)::int from public.company_profiles), 0, 'other organizations cannot read the profile');
select is((select count(*)::int from public.search_runs), 0, 'other organizations cannot read the runs');
reset role;

select * from finish();
rollback;
