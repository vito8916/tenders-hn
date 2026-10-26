-- Tracking: one status per organization and process, with an assignee who
-- is a member able to act on it; members and up track and write notes,
-- viewers and other organizations cannot; status changes go to the
-- activity log, and a removed member or one who becomes a viewer stops
-- being the assignee.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'owner@test.local', 'authenticated', 'authenticated', '{}'),
  ('22222222-2222-4222-8222-222222222222', 'viewer@test.local', 'authenticated', 'authenticated', '{}'),
  ('33333333-3333-4333-8333-333333333333', 'other@test.local', 'authenticated', 'authenticated', '{}'),
  ('44444444-4444-4444-8444-444444444444', 'member@test.local', 'authenticated', 'authenticated', '{}');
insert into public.organizations (id, name, slug, owner_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Test Org', 'test-org-pgtap', '11111111-1111-4111-8111-111111111111'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Other Org', 'other-org-pgtap', '33333333-3333-4333-8333-333333333333');
insert into public.organization_members (org_id, user_id, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'viewer'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '44444444-4444-4444-8444-444444444444', 'member');
insert into public.procurement_processes (id, source, source_process_key, expediente, buyer_entity, title, detail_url) values
  ('a0000000-0000-4000-8000-00000000000a', 'honducompras_v1', 'a', 'A-1', 'IHSS', 'A', 'https://example.test/a');

create function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select lives_ok(
  $$insert into public.opportunity_tracking (org_id, process_id, status, updated_by)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a0000000-0000-4000-8000-00000000000a', 'en_evaluacion', '11111111-1111-4111-8111-111111111111')$$,
  'the owner tracks an opportunity'
);
select throws_ok(
  $$insert into public.opportunity_tracking (org_id, process_id, status, updated_by)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a0000000-0000-4000-8000-00000000000a', 'presentada', '11111111-1111-4111-8111-111111111111')$$,
  '23505', null, 'one status per organization and process'
);
select throws_ok(
  $$update public.opportunity_tracking set status = 'interesa' where process_id = 'a0000000-0000-4000-8000-00000000000a'$$,
  '23514', null, 'only the fixed statuses'
);
select lives_ok(
  $$update public.opportunity_tracking set status = 'preparando_oferta', assigned_to = '44444444-4444-4444-8444-444444444444'
    where process_id = 'a0000000-0000-4000-8000-00000000000a'$$,
  'the owner changes the status and assigns a member'
);
select throws_ok(
  $$update public.opportunity_tracking set assigned_to = '22222222-2222-4222-8222-222222222222' where process_id = 'a0000000-0000-4000-8000-00000000000a'$$,
  '42501', null, 'a viewer cannot be the assignee'
);
select throws_ok(
  $$update public.opportunity_tracking set assigned_to = '33333333-3333-4333-8333-333333333333' where process_id = 'a0000000-0000-4000-8000-00000000000a'$$,
  '42501', null, 'nor someone from another organization'
);
select throws_ok(
  $$insert into public.opportunity_tracking (org_id, process_id, status, updated_by)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'a0000000-0000-4000-8000-00000000000a', 'en_evaluacion', '11111111-1111-4111-8111-111111111111')$$,
  '42501', null, 'nobody tracks for another organization'
);
select lives_ok(
  $$insert into public.opportunity_notes (org_id, process_id, author_id, body)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a0000000-0000-4000-8000-00000000000a', '11111111-1111-4111-8111-111111111111', 'Pedir el pliego')$$,
  'the owner writes a note'
);
select throws_ok(
  $$insert into public.opportunity_notes (org_id, process_id, author_id, body)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a0000000-0000-4000-8000-00000000000a', '11111111-1111-4111-8111-111111111111', '   ')$$,
  '23514', null, 'a note is not empty'
);

select pg_temp.act_as('44444444-4444-4444-8444-444444444444');
select throws_ok(
  $$insert into public.opportunity_notes (org_id, process_id, author_id, body)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a0000000-0000-4000-8000-00000000000a', '11111111-1111-4111-8111-111111111111', 'Firmada por otro')$$,
  '42501', null, 'a member writes notes only as themselves'
);
delete from public.opportunity_notes;
select is((select count(*)::int from public.opportunity_notes), 1, 'a member cannot delete someone else''s note');

select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select is((select status from public.opportunity_tracking), 'preparando_oferta', 'a viewer reads the status');
select is((select count(*)::int from public.opportunity_notes), 1, 'and the notes');
-- RLS hides the rows from a viewer's update and delete, so nothing changes.
update public.opportunity_tracking set status = 'descartada', updated_by = '22222222-2222-4222-8222-222222222222';
delete from public.opportunity_notes;
select is((select status from public.opportunity_tracking), 'preparando_oferta', 'a viewer cannot change the status');
select is((select count(*)::int from public.opportunity_notes), 1, 'nor delete notes');
select throws_ok(
  $$insert into public.opportunity_notes (org_id, process_id, author_id, body)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a0000000-0000-4000-8000-00000000000a', '22222222-2222-4222-8222-222222222222', 'Hola')$$,
  '42501', null, 'nor write them'
);

select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
select is((select count(*)::int from public.opportunity_tracking), 0, 'another organization sees no tracking');
select is((select count(*)::int from public.opportunity_notes), 0, 'nor notes');

select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select lives_ok($$delete from public.opportunity_tracking$$, 'the owner returns it to «Nueva»');

reset role;
select results_eq(
  $$select metadata ->> 'status_from', metadata ->> 'status_to', metadata ->> 'expediente' from public.app_events
    where event_name = 'opportunity.status_changed' and org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' order by id$$,
  $$values ('nueva', 'en_evaluacion', 'A-1'), ('en_evaluacion', 'preparando_oferta', 'A-1'), ('preparando_oferta', 'nueva', 'A-1')$$,
  'each status change is in the activity log'
);
select is((select count(*)::int from public.opportunity_notes where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 1, 'the notes stay when it returns to «Nueva»');

insert into public.opportunity_tracking (org_id, process_id, status, assigned_to, updated_by)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a0000000-0000-4000-8000-00000000000a', 'presentada',
        '44444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111');
update public.organization_members set role = 'viewer' where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and user_id = '44444444-4444-4444-8444-444444444444';
select is((select assigned_to from public.opportunity_tracking where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), null, 'a member who becomes a viewer stops being the assignee');

update public.organization_members set role = 'member' where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and user_id = '44444444-4444-4444-8444-444444444444';
update public.opportunity_tracking set assigned_to = '44444444-4444-4444-8444-444444444444' where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
delete from public.organization_members where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and user_id = '44444444-4444-4444-8444-444444444444';
select is((select assigned_to from public.opportunity_tracking where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), null, 'a removed member stops being the assignee');

select * from finish();
rollback;
