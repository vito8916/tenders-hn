-- «Me interesa» / «No me interesa»: one decision per organization and
-- process; members and up decide for themselves, viewers and other
-- organizations cannot.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'owner@test.local', 'authenticated', 'authenticated', '{}'),
  ('22222222-2222-4222-8222-222222222222', 'viewer@test.local', 'authenticated', 'authenticated', '{}'),
  ('33333333-3333-4333-8333-333333333333', 'other@test.local', 'authenticated', 'authenticated', '{}');
insert into public.organizations (id, name, slug, owner_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Test Org', 'test-org-pgtap', '11111111-1111-4111-8111-111111111111'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Other Org', 'other-org-pgtap', '33333333-3333-4333-8333-333333333333');
insert into public.organization_members (org_id, user_id, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'viewer');
insert into public.procurement_processes (id, source, source_process_key, expediente, buyer_entity, title, detail_url) values
  ('a0000000-0000-4000-8000-00000000000a', 'honducompras_v1', 'a', 'A-1', 'IHSS', 'A', 'https://example.test/a');

create function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select lives_ok(
  $$insert into public.opportunity_feedback (org_id, process_id, decision, reason, decided_by)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a0000000-0000-4000-8000-00000000000a', 'no_interesa', 'No vendemos eso',
            '11111111-1111-4111-8111-111111111111')$$,
  'the owner decides'
);
select throws_ok(
  $$insert into public.opportunity_feedback (org_id, process_id, decision, decided_by)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a0000000-0000-4000-8000-00000000000a', 'interesa', '11111111-1111-4111-8111-111111111111')$$,
  '23505', null, 'one decision per organization and process'
);
select lives_ok(
  $$update public.opportunity_feedback set decision = 'interesa', reason = null where process_id = 'a0000000-0000-4000-8000-00000000000a'$$,
  'the owner changes the decision'
);
select throws_ok(
  $$insert into public.opportunity_feedback (org_id, process_id, decision, decided_by)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'a0000000-0000-4000-8000-00000000000a', 'interesa', '11111111-1111-4111-8111-111111111111')$$,
  '42501', null, 'nobody decides for another organization'
);

select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select is((select decision from public.opportunity_feedback), 'interesa', 'a viewer reads the decision');
-- RLS hides the row from a viewer's update, so nothing changes.
update public.opportunity_feedback set decision = 'no_interesa', decided_by = '22222222-2222-4222-8222-222222222222';
select is((select decision from public.opportunity_feedback), 'interesa', 'a viewer cannot change the decision');
select throws_ok(
  $$insert into public.opportunity_feedback (org_id, process_id, decision, decided_by)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a0000000-0000-4000-8000-00000000000a', 'interesa', '22222222-2222-4222-8222-222222222222')
    on conflict (org_id, process_id) do nothing$$,
  '42501', null, 'a viewer cannot decide'
);

select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
select is((select count(*)::int from public.opportunity_feedback), 0, 'another organization sees nothing');

reset role;
select * from finish();
rollback;
