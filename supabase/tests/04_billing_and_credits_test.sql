-- Subscription lifecycle, AI credit reservations, and scheduled billing jobs.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'owner@test.local', 'authenticated', 'authenticated', '{"full_name":"Olga Owner"}'),
  ('22222222-2222-4222-8222-222222222222', 'viewer@test.local', 'authenticated', 'authenticated', '{}'),
  ('33333333-3333-4333-8333-333333333333', 'outsider@test.local', 'authenticated', 'authenticated', '{}');
insert into public.plans (id, name, max_members, monthly_ai_credits) values ('test_plan', 'Test', 5, 100);
insert into public.organizations (id, name, slug, owner_id)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Test Org', 'test-org-pgtap', '11111111-1111-4111-8111-111111111111');
insert into public.organization_members (org_id, user_id, role)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'viewer');

-- ---------- Activation ----------
insert into public.organization_subscriptions (org_id, plan_id, status, current_period_end)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'test_plan', 'active', now() + interval '30 days');

select results_eq(
  $$select kind, amount from public.ai_credit_ledger where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  $$values ('grant', 100)$$,
  'activation grants the monthly credits once'
);
select ok(
  exists (select 1 from public.notifications where user_id = '11111111-1111-4111-8111-111111111111' and type_id = 'subscription.activated'),
  'activation notifies the owner'
);
select ok(
  exists (select 1 from public.app_events where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and event_name = 'subscription.activated'),
  'activation is written to the audit log'
);

-- ---------- Credits (service role) ----------
set local role service_role;

create temp table held on commit drop as
select * from public.reserve_ai_credits('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 30, 'chat', 'op-1');

select is((select status from held), 'reserved', 'credits are reserved');
select is(
  (select id from public.reserve_ai_credits('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 30, 'chat', 'op-1')),
  (select id from held),
  'the same idempotency key returns the same reservation'
);
select throws_ok(
  $$select public.reserve_ai_credits('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 80, 'chat', 'op-2')$$,
  'P0001', 'insufficient_credits', 'a reservation beyond the available balance (70) is rejected'
);
select throws_ok(
  $$select public.reserve_ai_credits('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 1, 'chat', 'op-3')$$,
  'P0001', 'insufficient_role', 'viewers cannot spend credits'
);
select throws_ok(
  $$select public.reserve_ai_credits('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', 1, 'chat', 'op-4')$$,
  'P0001', 'insufficient_role', 'non-members cannot spend credits'
);

select public.commit_ai_credits((select id from held), 20);
select public.commit_ai_credits((select id from held), 20);
select results_eq(
  $$select count(*)::int, sum(amount)::int from public.ai_credit_ledger where kind = 'usage'$$,
  $$values (1, -20)$$,
  'committing twice charges the actual usage once'
);
select is(
  (select status from public.release_ai_credits((select id from held))),
  'committed',
  'releasing a committed reservation is a no-op'
);
select results_eq(
  $$select granted, used, reserved, available from public.get_ai_credit_balance('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
  $$values (100, 20, 0, 80)$$,
  'the balance reflects grants, usage, and holds'
);

create temp table abandoned on commit drop as
select * from public.reserve_ai_credits('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 10, 'chat', 'op-5');
update public.ai_credit_reservations set expires_at = now() - interval '1 minute' where id = (select id from abandoned);
reset role;

select is(private.release_expired_ai_credit_reservations(), 1, 'the job releases abandoned reservations');

-- ---------- Expiry ----------
update public.organization_subscriptions
set current_period_start = now() - interval '31 days', current_period_end = now() - interval '1 minute'
where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select is(private.expire_subscriptions(), 1, 'the job expires ended subscriptions');
select ok(
  exists (select 1 from public.notifications where user_id = '11111111-1111-4111-8111-111111111111' and type_id = 'subscription.expired'),
  'expiry notifies the owner'
);

set local role service_role;
select throws_ok(
  $$select public.reserve_ai_credits('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 1, 'chat', 'op-6')$$,
  'P0001', 'subscription_inactive', 'no credits without an active plan'
);
reset role;

-- ---------- Renewal and expiry warning ----------
update public.organization_subscriptions
set status = 'active', current_period_start = now(), current_period_end = now() + interval '3 days'
where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select is(
  (select count(*)::int from public.notifications where user_id = '11111111-1111-4111-8111-111111111111' and type_id = 'subscription.activated'),
  2,
  'reactivation notifies again'
);

select private.warn_expiring_subscriptions();
select private.warn_expiring_subscriptions();

update public.organization_subscriptions set status = 'active'
where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select is(
  (select count(*)::int from public.notifications where user_id = '11111111-1111-4111-8111-111111111111' and type_id = 'subscription.activated'),
  2,
  'a no-op retried write does not notify again'
);
select is(
  (select count(*)::int from public.notifications where user_id = '11111111-1111-4111-8111-111111111111' and type_id = 'subscription.expiring_soon'),
  1,
  'the expiry warning is sent once per period'
);

select * from finish();
rollback;
