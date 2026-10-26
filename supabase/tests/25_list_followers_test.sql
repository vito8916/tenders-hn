-- List followers: every member, viewers included, follows and unfollows the
-- organization's lists for themselves only; «Recomendadas» is followed by
-- everyone and has no followers to choose; other organizations see nothing;
-- a member who leaves stops following.
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
insert into public.organization_subscriptions (org_id, plan_id, status, source, current_period_start, current_period_end) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'pro', 'active', 'manual', now(), now() + interval '1 month'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'pro', 'active', 'manual', now(), now() + interval '1 month');
insert into public.saved_searches (id, org_id, name) values
  ('5eeeeeee-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Software'),
  ('5eeeeeee-0000-4000-8000-000000000003', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Otra');

create function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select lives_ok(
  $$insert into public.list_followers (saved_search_id, user_id, org_id)
    values ('5eeeeeee-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
  'a viewer follows a list'
);
select throws_ok(
  $$insert into public.list_followers (saved_search_id, user_id, org_id)
    values ('5eeeeeee-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
  '42501', null, 'but not for someone else'
);
select throws_ok(
  $$insert into public.list_followers (saved_search_id, user_id, org_id)
    select id, '22222222-2222-4222-8222-222222222222', org_id from public.saved_searches
    where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and is_default$$,
  '42501', null, 'nor «Recomendadas», which everyone follows'
);
select throws_ok(
  $$insert into public.list_followers (saved_search_id, user_id, org_id)
    values ('5eeeeeee-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
  '42501', null, 'nor another organization''s list under their own'
);

select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select lives_ok(
  $$insert into public.list_followers (saved_search_id, user_id, org_id)
    values ('5eeeeeee-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
  'the owner follows it too'
);
select is((select count(*)::int from public.list_followers), 2, 'members see who follows each list');
delete from public.list_followers where user_id = '22222222-2222-4222-8222-222222222222';
select is((select count(*)::int from public.list_followers), 2, 'nobody unfollows for someone else');

select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
select is((select count(*)::int from public.list_followers), 0, 'another organization sees no followers');
select throws_ok(
  $$insert into public.list_followers (saved_search_id, user_id, org_id)
    values ('5eeeeeee-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
  '42501', null, 'nor follows its lists'
);

select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select lives_ok($$delete from public.list_followers where user_id = '11111111-1111-4111-8111-111111111111'$$, 'a member unfollows');
select is((select count(*)::int from public.list_followers), 1, 'only their own row');

reset role;
delete from public.organization_members where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and user_id = '22222222-2222-4222-8222-222222222222';
select is(
  (select count(*)::int from public.list_followers where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  0, 'a removed member stops following the organization''s lists'
);

select * from finish();
rollback;
