-- Membership notifications, email outbox, preferences, read state, and cascades.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'owner@test.local', 'authenticated', 'authenticated', '{"full_name":"Olga Owner"}'),
  ('22222222-2222-4222-8222-222222222222', 'member@test.local', 'authenticated', 'authenticated', '{"full_name":"Mia Member"}');
insert into public.plans (id, name, max_members) values ('test_plan', 'Test', 5);
insert into public.organizations (id, name, slug, owner_id)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Test Org', 'test-org-pgtap', '11111111-1111-4111-8111-111111111111');
insert into public.organization_subscriptions (org_id, plan_id, status, current_period_end)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'test_plan', 'active', now() + interval '30 days');
insert into public.organization_members (org_id, user_id, role)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'member');

-- ---------- Role change ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
update public.organization_members set role = 'admin'
where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and user_id = '22222222-2222-4222-8222-222222222222';
reset role;

select ok(
  exists (select 1 from public.notifications where user_id = '22222222-2222-4222-8222-222222222222' and type_id = 'organization.role_changed'),
  'the member is notified in-app of a role change'
);
select ok(
  exists (select 1 from public.notification_deliveries where user_id = '22222222-2222-4222-8222-222222222222' and type_id = 'organization.role_changed' and status = 'pending'),
  'the role change is queued as an email'
);
select ok(
  not exists (select 1 from public.notifications where user_id = '11111111-1111-4111-8111-111111111111' and type_id = 'organization.role_changed'),
  'the actor is not notified of their own action'
);

-- ---------- Preferences and read state ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
insert into public.notification_preferences (user_id, type_id, in_app, email)
values ('22222222-2222-4222-8222-222222222222', 'organization.role_changed', true, false);
select is(
  (select bool_and(user_id = '22222222-2222-4222-8222-222222222222') from public.notifications),
  true,
  'a member only reads their own notifications'
);
update public.notifications set read_at = now() where read_at is null;
select is((select count(*)::int from public.notifications where read_at is null), 0, 'a member marks all as read');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
update public.organization_members set role = 'member'
where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and user_id = '22222222-2222-4222-8222-222222222222';
reset role;

select is(
  (select count(*)::int from public.notifications where user_id = '22222222-2222-4222-8222-222222222222' and type_id = 'organization.role_changed'),
  2,
  'each role change is notified in-app'
);
select is(
  (select count(*)::int from public.notification_deliveries where user_id = '22222222-2222-4222-8222-222222222222' and type_id = 'organization.role_changed'),
  1,
  'an email opt-out stops further emails'
);

-- ---------- Ownership transfer and removal ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select public.transfer_organization_ownership('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222');
reset role;

select ok(
  exists (select 1 from public.notifications where user_id = '22222222-2222-4222-8222-222222222222' and type_id = 'organization.ownership_transferred'),
  'the new owner is notified'
);
select ok(
  not exists (select 1 from public.notifications where user_id = '11111111-1111-4111-8111-111111111111' and type_id = 'organization.role_changed'),
  'the previous owner is not told about their own demotion'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
delete from public.organization_members
where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and user_id = '11111111-1111-4111-8111-111111111111';
reset role;

select ok(
  exists (select 1 from public.notifications where user_id = '11111111-1111-4111-8111-111111111111' and type_id = 'organization.member_removed'),
  'a removed member is notified'
);

-- ---------- Cascades ----------
select lives_ok(
  $$delete from auth.users where id = '22222222-2222-4222-8222-222222222222'$$,
  'deleting a user account with memberships and notifications succeeds'
);
select ok(
  not exists (select 1 from public.organizations where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'deleting the owner account deletes the organization'
);
select ok(
  not exists (select 1 from public.organization_subscriptions where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'the organization''s subscription is removed with it'
);

select * from finish();
rollback;
