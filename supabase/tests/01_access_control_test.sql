-- Data API exposure, RLS isolation between organizations, and service-role-only paths.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Fixtures: owner (in the org), outsider (in no org)
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'owner@test.local', 'authenticated', 'authenticated', '{"full_name":"Olga Owner"}'),
  ('33333333-3333-4333-8333-333333333333', 'outsider@test.local', 'authenticated', 'authenticated', '{}');
insert into public.plans (id, name, max_members, monthly_ai_credits) values ('test_plan', 'Test', 3, 100);
insert into public.organizations (id, name, slug, owner_id)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Test Org', 'test-org-pgtap', '11111111-1111-4111-8111-111111111111');
insert into public.organization_subscriptions (org_id, plan_id, status, current_period_end)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'test_plan', 'active', now() + interval '30 days');

-- ---------- Grants ----------
select is(
  (select count(*)::int from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public'),
  0,
  'anon has no privileges on public tables'
);
select ok(not has_schema_privilege('authenticated', 'pgmq', 'usage'), 'authenticated cannot use the queue schema');
select ok(not has_schema_privilege('anon', 'pgmq', 'usage'), 'anon cannot use the queue schema');

set local role anon;
select throws_ok('select * from public.organizations', '42501', null, 'anon cannot read organizations');
reset role;

-- ---------- Owner ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

select is((select count(*)::int from public.organizations), 1, 'owner sees their organization');
select throws_ok(
  $$update public.organizations set owner_id = '33333333-3333-4333-8333-333333333333'$$,
  '42501', null, 'owner_id cannot be updated directly'
);
select throws_ok(
  $$insert into public.organization_subscriptions (org_id, plan_id, status) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'test_plan', 'active')$$,
  '42501', null, 'members cannot write subscriptions'
);
select throws_ok('select * from public.notification_deliveries', '42501', null, 'the email outbox is hidden from users');
select throws_ok('select * from public.ai_usage_events', '42501', null, 'AI usage events are hidden from users');
select throws_ok('update public.notifications set title = $$x$$', '42501', null, 'notification titles are not updatable');
select throws_ok(
  $$select public.reserve_ai_credits('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 1, 'chat', 'k')$$,
  '42501', null, 'users cannot call reserve_ai_credits'
);
select throws_ok(
  $$insert into public.notification_preferences (user_id, type_id, in_app, email)
    values ('33333333-3333-4333-8333-333333333333', 'organization.role_changed', false, false)$$,
  '42501', null, 'users cannot write another user''s preferences'
);
select is((select count(*)::int from public.ai_credit_ledger), 1, 'members see their organization''s credit ledger');
reset role;

-- ---------- Outsider ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);

select is((select count(*)::int from public.organizations), 0, 'outsider sees no organizations');
select is((select count(*)::int from public.notifications), 0, 'outsider sees no notifications of others');
select is((select count(*)::int from public.organization_subscriptions), 0, 'outsider sees no subscriptions');
select is((select count(*)::int from public.ai_credit_ledger), 0, 'outsider sees no credit ledger');
select is(
  (select count(*)::int from public.get_organization_entitlements('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')),
  0,
  'outsider gets no entitlements row'
);
reset role;

select * from finish();
rollback;
