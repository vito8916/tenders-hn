-- Seat limits (members + pending invitations), invitation acceptance, and read-only mode.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'owner@test.local', 'authenticated', 'authenticated', '{"full_name":"Olga Owner"}'),
  ('22222222-2222-4222-8222-222222222222', 'member@test.local', 'authenticated', 'authenticated', '{"full_name":"Mia Member"}'),
  ('33333333-3333-4333-8333-333333333333', 'late@test.local', 'authenticated', 'authenticated', '{}');
-- Owner + 2 seats
insert into public.plans (id, name, max_members) values ('test_plan', 'Test', 3);
insert into public.organizations (id, name, slug, owner_id)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Test Org', 'test-org-pgtap', '11111111-1111-4111-8111-111111111111');
insert into public.organization_subscriptions (org_id, plan_id, status, current_period_end)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'test_plan', 'active', now() + interval '30 days');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.organization_invitations (org_id, email, role, token, expires_at)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'member@test.local', 'member', 'tok-member', now() + interval '7 days'),
           ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'late@test.local', 'member', 'tok-late', now() + interval '7 days')$$,
  'owner fills the remaining seats in one statement'
);
select throws_ok(
  $$insert into public.organization_invitations (org_id, email, role, token, expires_at)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'extra@test.local', 'member', 'tok-extra', now() + interval '7 days')$$,
  'P0001', 'seat_limit_reached', 'an invitation beyond the plan limit is rejected'
);
select results_eq(
  $$select seats_used, max_members, is_active from public.get_organization_entitlements('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
  $$values (3, 3, true)$$,
  'entitlements count pending invitations as seats'
);
reset role;

select ok(
  exists (select 1 from public.notifications where user_id = '22222222-2222-4222-8222-222222222222' and type_id = 'invitation.received'),
  'an invitee with an account gets an in-app invitation'
);

-- Member accepts
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select is(
  (select org_slug from public.accept_invitation('tok-member')),
  'test-org-pgtap',
  'the invitee accepts the invitation'
);
reset role;

select ok(
  exists (select 1 from public.organization_members where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and user_id = '22222222-2222-4222-8222-222222222222'),
  'accepting creates the membership'
);
select ok(
  exists (select 1 from public.notifications where user_id = '11111111-1111-4111-8111-111111111111' and type_id = 'organization.member_joined' and title like 'Mia Member joined%'),
  'the owner is told who joined'
);

-- Plan ends: the organization becomes read-only
update public.organization_subscriptions
set status = 'expired'
where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
select throws_ok(
  $$select * from public.accept_invitation('tok-late')$$,
  'P0001', 'subscription_inactive', 'an invitation cannot be accepted without an active plan'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
delete from public.organization_invitations where token = 'tok-late';
select throws_ok(
  $$insert into public.organization_invitations (org_id, email, role, token, expires_at)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'new@test.local', 'member', 'tok-new', now() + interval '7 days')$$,
  'P0001', 'subscription_inactive', 'no invitations without an active plan'
);
select results_eq(
  $$select is_active, subscription_status from public.get_organization_entitlements('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
  $$values (false, 'expired')$$,
  'entitlements report the inactive plan'
);
reset role;

select * from finish();
rollback;
