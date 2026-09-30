-- Billing with Paddle: record_paddle_event mirrors subscription events into
-- organization_subscriptions once, in order, and private.active_plan_id
-- applies the renewal margin and the past_due grace. Only the service role
-- records events.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'owner@test.local', 'authenticated', 'authenticated', '{}');
insert into public.organizations (id, name, slug, owner_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Test Org', 'test-org-pgtap', '11111111-1111-4111-8111-111111111111'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Other Org', 'other-org-pgtap', '11111111-1111-4111-8111-111111111111');
insert into public.plan_prices (paddle_price_id, plan_id, billing_interval) values
  ('pri_basic000000000000000000000', 'basic', 'month'),
  ('pri_pro00000000000000000000000', 'pro', 'month');

-- A subscription event as Paddle sends it (snake_case), with only the fields the mirror reads.
create function pg_temp.event(
  event_id text, event_type text, occurred timestamptz, status text,
  price_id text default 'pri_basic000000000000000000000',
  org uuid default 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  subscription_id text default 'sub_01',
  period_end timestamptz default now() + interval '1 month',
  scheduled jsonb default 'null'
) returns jsonb language sql as $$
  select jsonb_build_object(
    'event_id', event_id,
    'event_type', event_type,
    'occurred_at', occurred,
    'data', jsonb_build_object(
      'id', subscription_id,
      'status', status,
      'customer_id', 'ctm_01',
      'custom_data', jsonb_build_object('org_id', org),
      'items', jsonb_build_array(jsonb_build_object('price', jsonb_build_object('id', price_id))),
      'current_billing_period', jsonb_build_object('starts_at', period_end - interval '1 month', 'ends_at', period_end),
      'next_billed_at', period_end,
      'scheduled_change', scheduled
    )
  );
$$;

create function pg_temp.notified(type_id text) returns integer language sql as $$
  select count(*)::int from public.notifications n
  where n.org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and n.type_id = notified.type_id;
$$;

-- ---------- Plans ----------
select results_eq(
  $$select id from public.plans where id in ('basic', 'estandar', 'pro') and not is_archived order by id$$,
  $$values ('basic'::text), ('estandar'), ('pro')$$,
  'Básico, Estándar, and Pro are for sale'
);
select ok(not exists (select 1 from public.plans where id = 'pilot' and not is_archived), 'Piloto is not for sale');

-- ---------- Subscribing ----------
select is(
  public.record_paddle_event(pg_temp.event('evt_1', 'subscription.created', now() - interval '10 minutes', 'active')),
  true,
  'a new subscription event is applied'
);
select results_eq(
  $$select plan_id, status, source, paddle_subscription_id, paddle_customer_id, billing_interval
    from public.organization_subscriptions where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  $$values ('basic'::text, 'active'::text, 'paddle'::text, 'sub_01'::text, 'ctm_01'::text, 'month'::text)$$,
  'the organization in custom_data gets the price''s plan'
);
select is(private.active_plan_id('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'basic', 'the plan gives access');
select is(pg_temp.notified('subscription.activated'), 1, 'the owner is told the plan is active');
select ok(
  exists (select 1 from public.ai_credit_ledger where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and kind = 'grant'),
  'the month''s AI credits are granted'
);

select is(
  public.record_paddle_event(pg_temp.event('evt_1', 'subscription.created', now() - interval '10 minutes', 'active')),
  false,
  'a retried event is recognized'
);
select is(
  public.record_paddle_event(pg_temp.event('evt_0', 'subscription.updated', now() - interval '1 hour', 'past_due')),
  true,
  'an older event arriving late is recorded'
);
select is(
  (select status from public.organization_subscriptions where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'active',
  'but does not overwrite a newer state'
);

-- ---------- Changing plan ----------
select lives_ok(
  $$select public.record_paddle_event(pg_temp.event('evt_2', 'subscription.updated', now() - interval '9 minutes', 'active', 'pri_pro00000000000000000000000'))$$,
  'a plan change is applied'
);
select is(private.active_plan_id('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'pro', 'the new plan gives access');
select is(pg_temp.notified('subscription.plan_changed'), 1, 'the owner is told about the change');

-- ---------- Failed payments ----------
select public.record_paddle_event(pg_temp.event('evt_3', 'subscription.past_due', now() - interval '8 minutes', 'past_due', 'pri_pro00000000000000000000000'));
select is(pg_temp.notified('subscription.payment_failed'), 1, 'the owner is told the payment failed');
select is(private.active_plan_id('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'pro', 'past_due keeps access during the grace');
select public.record_paddle_event(pg_temp.event('evt_4', 'subscription.updated', now() - interval '7 minutes', 'past_due', 'pri_pro00000000000000000000000'));
select is(
  (select past_due_since from public.organization_subscriptions where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  now() - interval '8 minutes',
  'the grace counts from the first failed renewal'
);
update public.organization_subscriptions set past_due_since = now() - interval '8 days' where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select is(private.active_plan_id('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), null, 'after 7 days past_due is read-only');

select public.record_paddle_event(pg_temp.event('evt_5', 'subscription.updated', now() - interval '6 minutes', 'active', 'pri_pro00000000000000000000000'));
select ok(
  (select past_due_since is null from public.organization_subscriptions where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  and private.active_plan_id('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') = 'pro',
  'a recovered payment restores access'
);
select is(pg_temp.notified('subscription.renewed'), 1, 'and is announced as a renewal');

-- ---------- Late renewals ----------
update public.organization_subscriptions set current_period_start = now() - interval '1 month', current_period_end = now() - interval '2 days' where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select is(private.active_plan_id('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'pro', 'a renewal up to 3 days late keeps access');
update public.organization_subscriptions set current_period_end = now() - interval '4 days' where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select is(private.active_plan_id('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), null, 'a missing renewal ends access');
select is(private.expire_subscriptions(), 0, 'Paddle rows never expire locally');

-- ---------- Cancelling ----------
select public.record_paddle_event(pg_temp.event(
  'evt_6', 'subscription.updated', now() - interval '5 minutes', 'active', 'pri_pro00000000000000000000000',
  scheduled => jsonb_build_object('action', 'cancel', 'effective_at', now() + interval '1 month')
));
select is(pg_temp.notified('subscription.cancel_scheduled'), 1, 'a scheduled cancellation is announced');
select is(private.active_plan_id('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'pro', 'and access continues until then');

select public.record_paddle_event(jsonb_set(
  pg_temp.event('evt_7', 'subscription.canceled', now() - interval '4 minutes', 'canceled', 'pri_pro00000000000000000000000'),
  '{data,current_billing_period}', 'null'
));
select ok(
  (select canceled_at is not null and current_period_end is not null from public.organization_subscriptions
   where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  and private.active_plan_id('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') is null,
  'a canceled subscription is read-only and keeps its last period on record'
);
select is(pg_temp.notified('subscription.canceled'), 1, 'the owner is told');

select lives_ok(
  $$select public.record_paddle_event(pg_temp.event('evt_8', 'subscription.created', now() - interval '3 minutes', 'active', subscription_id => 'sub_02'))$$,
  'a canceled organization can subscribe again'
);

-- ---------- Rejected events ----------
select throws_ok(
  $$select public.record_paddle_event(pg_temp.event('evt_9', 'subscription.created', now(), 'active', subscription_id => 'sub_03'))$$,
  'P0001', 'organization_has_subscription', 'a second live subscription for the same organization is rejected'
);
select throws_ok(
  $$select public.record_paddle_event(pg_temp.event('evt_10', 'subscription.created', now(), 'active', 'pri_unknown0000000000000000000', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'sub_04'))$$,
  'P0001', 'unknown_price', 'an unknown price is rejected'
);
select throws_ok(
  $$select public.record_paddle_event(pg_temp.event('evt_11', 'subscription.created', now(), 'active', org => 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', subscription_id => 'sub_05'))$$,
  'P0001', 'unknown_organization', 'an event for no known organization is rejected'
);
select ok(
  not exists (select 1 from public.paddle_webhook_events where event_id in ('evt_9', 'evt_10', 'evt_11')),
  'a rejected event is not stored, so Paddle''s retry applies it once fixed'
);
select is(
  public.record_paddle_event(jsonb_build_object('event_id', 'evt_12', 'event_type', 'transaction.completed', 'occurred_at', now(), 'data', '{}'::jsonb)),
  true,
  'other events are stored without changes'
);

-- ---------- Access ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

select is(public.plan_change_blockers('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'basic'), '{}'::text[], 'an organization that fits the plan has no blockers');
reset role;
insert into auth.users (id, email, aud, role) values
  ('22222222-2222-4222-8222-222222222222', 'a@test.local', 'authenticated', 'authenticated'),
  ('33333333-3333-4333-8333-333333333333', 'b@test.local', 'authenticated', 'authenticated'),
  ('44444444-4444-4444-8444-444444444444', 'c@test.local', 'authenticated', 'authenticated');
insert into public.organization_members (org_id, user_id, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'member'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', 'member'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '44444444-4444-4444-8444-444444444444', 'member');
-- On Pro now, so the fixture's searches fit; the question is whether they fit Básico.
update public.organization_subscriptions set plan_id = 'pro' where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
insert into public.saved_searches (org_id, name, schedule)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Uno', 'four_times_daily'), ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Dos', 'daily'),
       ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Tres', 'daily');
set local role authenticated;
select is(
  public.plan_change_blockers('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'basic'),
  array['members', 'searches', 'schedules'],
  'a downgrade lists what does not fit: members, active searches, and schedules'
);
select is(public.plan_change_blockers('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'pro'), '{}'::text[], 'an upgrade fits');
select throws_ok(
  $$select public.record_paddle_event('{}')$$,
  '42501', null, 'users cannot record Paddle events'
);
select throws_ok($$select * from public.paddle_webhook_events$$, '42501', null, 'users cannot read Paddle events');
select is((select count(*)::int from public.plan_prices where paddle_price_id like 'pri\_basic%' or paddle_price_id like 'pri\_pro0%'), 2, 'users read the prices');
select throws_ok(
  $$insert into public.plan_prices (paddle_price_id, plan_id, billing_interval) values ('pri_x0000000000000000000000000', 'basic', 'month')$$,
  '42501', null, 'users cannot write prices'
);
reset role;

select * from finish();
rollback;
