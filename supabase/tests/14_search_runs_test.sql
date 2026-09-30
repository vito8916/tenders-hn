-- Company profiles and search runs: owners and admins save the profile
-- through save_company_profile, the owner starts a run for it through
-- request_search_run, members read their organization's rows, and only the
-- worker writes results.
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

create function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

-- ---------- Saving the profile ----------
set local role authenticated;
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');

select throws_ok(
  $$select public.request_search_run('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
  'P0001', 'no_profile', 'a run needs a saved profile'
);
select is(
  public.save_company_profile(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '  Venta de software  ',
    array[' Licencias SAP ', '', 'licencias sap', 'Soporte funcional'], array['Impresoras'], array['Cortés']
  ),
  1,
  'the owner saves the profile as version 1'
);
select results_eq(
  $$select description, offerings, exclusions, locations from public.company_profiles$$,
  $$values ('Venta de software'::text, array['Licencias SAP', 'Soporte funcional'], array['Impresoras'], array['Cortés'])$$,
  'text is trimmed and blank or repeated items are dropped'
);
select results_eq(
  $$select version, description, offerings from public.company_profile_versions$$,
  $$values (1, 'Venta de software'::text, array['Licencias SAP', 'Soporte funcional'])$$,
  'the version is kept'
);
select throws_ok(
  $$select public.save_company_profile('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '   ')$$,
  'P0001', 'empty_profile', 'an empty description is rejected'
);
select throws_ok(
  $$select public.save_company_profile('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Venta de software', '{}', '{}', array['Narnia'])$$,
  '23514', null, 'only departments of Honduras are locations'
);
select throws_ok(
  $$update public.company_profiles set description = 'Otra cosa'$$,
  '42501', null, 'members cannot write the profile directly'
);
reset role;

select is(
  (select metadata from public.app_events where event_name = 'company_profile.updated' and org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  '{"version": 1}'::jsonb,
  'saving a new version is logged'
);

-- ---------- Versions and extraction ----------
update public.company_profiles set extracted_profile = '{"linesOfBusiness": []}', extraction_version = 'v2';

set local role authenticated;
select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
select is(
  public.save_company_profile(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Venta de software',
    array['Licencias SAP', 'Soporte funcional'], array['Impresoras'], array['Cortés']
  ),
  1,
  'an admin can save; an unchanged profile keeps its version'
);
select is(
  public.save_company_profile(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Venta de software',
    array['Licencias SAP', 'Soporte funcional'], array['Impresoras', 'Tóner'], array['Cortés', 'Yoro']
  ),
  2,
  'new exclusions or locations are a new version'
);
select ok(
  (select extracted_profile is not null from public.company_profiles),
  'the extraction is kept when only exclusions or locations change'
);
select is(
  public.save_company_profile(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Venta de software',
    array['Licencias SAP', 'Soporte funcional', 'Desarrollo de integraciones'], array['Impresoras', 'Tóner'], array['Cortés', 'Yoro']
  ),
  3,
  'new offerings are a new version'
);
select ok(
  (select extracted_profile is null and extraction_version is null from public.company_profiles),
  'new offerings clear the extraction'
);
select is((select count(*)::int from public.company_profile_versions), 3, 'every version is kept');

select pg_temp.act_as('44444444-4444-4444-8444-444444444444');
select throws_ok(
  $$select public.save_company_profile('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Otra cosa')$$,
  'P0001', 'insufficient_role', 'members cannot save the profile'
);
select is((select count(*)::int from public.company_profile_versions), 3, 'members read the profile versions');

-- ---------- Requesting a run ----------
select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
select throws_ok(
  $$select public.request_search_run('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
  'P0001', 'not_owner', 'only the owner starts a run while the inbox is internal'
);

select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select lives_ok(
  $$select public.request_search_run('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
  'the owner starts a run'
);
select results_eq(
  $$select status, profile_version, trigger from public.search_runs$$,
  $$values ('queued'::text, 3, 'manual'::text)$$,
  'the run is queued for the current version'
);
select throws_ok(
  $$select public.request_search_run('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
  'P0001', 'run_in_progress', 'a second run cannot start while one is queued'
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

-- ---------- Verifiable exclusions ----------
insert into public.procurement_processes (id, source, source_process_key, expediente, buyer_entity, title, detail_url, products_text) values
  ('c0000000-0000-4000-8000-00000000000a', 'honducompras_v1', 'k:a', 'CM-1', 'IHSS', 'Compra de impresora láser', 'http://x', null),
  ('c0000000-0000-4000-8000-00000000000b', 'honducompras_v1', 'k:b', 'CM-2', 'IHSS', 'Adquisición de equipo informático', 'http://x', 'Impresoras; Computadoras'),
  ('c0000000-0000-4000-8000-00000000000c', 'honducompras_v1', 'k:c', 'CM-3', 'IHSS', 'Tóner y cartuchos para impresoras', 'http://x', null);

select results_eq(
  $$select process_id, matched_exclusions from public.match_exclusions(
      array['c0000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-00000000000b', 'c0000000-0000-4000-8000-00000000000c']::uuid[],
      array['Impresoras', 'toner']
    ) order by process_id$$,
  $$values ('c0000000-0000-4000-8000-00000000000a'::uuid, array['Impresoras']),
           ('c0000000-0000-4000-8000-00000000000c'::uuid, array['Impresoras', 'toner'])$$,
  'exclusions match the object with stemming and without accents, never the product lines'
);

-- ---------- Other organizations ----------
set local role authenticated;
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select throws_ok(
  $$select public.save_company_profile('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Otra cosa')$$,
  'P0001', 'insufficient_role', 'other organizations cannot save the profile'
);
select throws_ok(
  $$select public.request_search_run('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
  'P0001', 'not_owner', 'other organizations cannot start a run'
);
select is((select count(*)::int from public.company_profiles), 0, 'other organizations cannot read the profile');
select is((select count(*)::int from public.company_profile_versions), 0, 'other organizations cannot read the versions');
select is((select count(*)::int from public.search_runs), 0, 'other organizations cannot read the runs');
select throws_ok(
  $$select * from public.match_exclusions(array[]::uuid[], array['x'])$$,
  '42501', null, 'only the worker matches exclusions'
);
reset role;

select * from finish();
rollback;
