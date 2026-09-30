-- «Mejorar con IA» on the company profile: 3 improvements per field per user
-- per day, claimed before the model runs; failed calls give the claim back.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'owner@test.local', 'authenticated', 'authenticated', '{}'),
  ('22222222-2222-4222-8222-222222222222', 'member@test.local', 'authenticated', 'authenticated', '{}');
insert into public.organizations (id, name, slug, owner_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Test Org', 'test-org-pgtap', '11111111-1111-4111-8111-111111111111');
insert into public.organization_members (org_id, user_id, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'member');

create function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

-- Users cannot read ai_usage_events, so event ids are looked up as postgres.
create function pg_temp.remember_event(event_id bigint) returns void language sql as $$
  select set_config('test.event_id', event_id::text, true);
$$;
create function pg_temp.remembered_event() returns bigint language sql as $$
  select current_setting('test.event_id')::bigint;
$$;
grant execute on function pg_temp.remembered_event() to authenticated;

set local role authenticated;
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');

select results_eq(
  $$select field, remaining from public.profile_improvements_remaining() order by field$$,
  $$values ('description'::text, 3), ('exclusions', 3), ('offerings', 3)$$,
  'a user starts the day with 3 improvements per field'
);

-- Onboarding: no organization yet.
select is((select remaining from public.claim_profile_improvement('description', 'openai/gpt-6-luna')), 2, 'the first claim leaves 2');
select is(
  (select remaining from public.claim_profile_improvement('description', 'openai/gpt-6-luna', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')),
  1,
  'claims in settings count toward the same daily limit'
);

-- A failed call gives its claim back.
reset role;
select pg_temp.remember_event((select max(id) from public.ai_usage_events where user_id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222')));
set local role authenticated;
select public.finish_profile_improvement(pg_temp.remembered_event(), false, null, null, null, 120, 'gateway timeout');
select is(
  (select remaining from public.profile_improvements_remaining() where field = 'description'),
  2,
  'a failed call does not count'
);

select public.claim_profile_improvement('description', 'openai/gpt-6-luna');
select is((select remaining from public.claim_profile_improvement('description', 'openai/gpt-6-luna')), 0, 'the third claim leaves 0');
select throws_ok(
  $$select public.claim_profile_improvement('description', 'openai/gpt-6-luna')$$,
  'P0001', 'improvement_limit_reached', 'a fourth improvement of the same field is refused'
);
select is(
  (select remaining from public.claim_profile_improvement('offerings', 'openai/gpt-6-luna')),
  2,
  'each field has its own limit'
);
select throws_ok(
  $$select public.claim_profile_improvement('name', 'openai/gpt-6-luna')$$,
  'P0001', 'invalid_field', 'only the profile text fields can be improved'
);
select throws_ok(
  $$select * from public.ai_usage_events$$,
  '42501', null, 'users cannot read usage events directly'
);
reset role;

select results_eq(
  $$select status, count(*)::int from public.ai_usage_events where user_id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222') group by status order by status$$,
  $$values ('failed'::text, 1), ('pending', 4)$$,
  'claims are recorded as pending until finished'
);

select pg_temp.remember_event((select max(id) from public.ai_usage_events where user_id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222')));
set local role authenticated;
select public.finish_profile_improvement(pg_temp.remembered_event(), true, 'openai/gpt-6-luna-2026-09', 900, 150, 800, null);
reset role;
select results_eq(
  $$select status, model, input_tokens, output_tokens from public.ai_usage_events where user_id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222') order by id desc limit 1$$,
  $$values ('succeeded'::text, 'openai/gpt-6-luna-2026-09'::text, 900, 150)$$,
  'a finished call records the returned model and usage'
);

-- ---------- Other users ----------
set local role authenticated;
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select throws_ok(
  $$select public.claim_profile_improvement('description', 'openai/gpt-6-luna', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
  'P0001', 'insufficient_role', 'members who cannot edit the profile cannot improve it'
);
select is(
  (select remaining from public.profile_improvements_remaining() where field = 'description'),
  3,
  'limits are per user'
);
reset role;
select pg_temp.remember_event((select min(id) from public.ai_usage_events where user_id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222') and status = 'pending'));
set local role authenticated;
select public.finish_profile_improvement(pg_temp.remembered_event(), true);
reset role;
select is(
  (select count(*)::int from public.ai_usage_events where user_id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222') and status = 'pending'),
  3,
  'a user cannot finish another user''s call'
);

select * from finish();
rollback;
