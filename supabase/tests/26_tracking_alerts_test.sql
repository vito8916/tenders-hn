-- Tracking alerts: the assignee hears they were assigned (not when they assign
-- themselves); opportunities «En evaluación» or «Preparando oferta» closing in
-- 3 days or tomorrow remind their assignee or, without one, every member but
-- viewers, once per deadline; another organization hears nothing.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'owner@test.local', 'authenticated', 'authenticated', '{"full_name":"Olga Owner"}'),
  ('22222222-2222-4222-8222-222222222222', 'member@test.local', 'authenticated', 'authenticated', '{"full_name":"Mia Member"}'),
  ('33333333-3333-4333-8333-333333333333', 'viewer@test.local', 'authenticated', 'authenticated', '{}'),
  ('44444444-4444-4444-8444-444444444444', 'other@test.local', 'authenticated', 'authenticated', '{}');
insert into public.organizations (id, name, slug, owner_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Test Org', 'test-org-pgtap', '11111111-1111-4111-8111-111111111111'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Other Org', 'other-org-pgtap', '44444444-4444-4444-8444-444444444444');
insert into public.organization_members (org_id, user_id, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'member'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', 'viewer');

-- Deadlines at noon in Honduras, 1, 3, and 2 days from today there.
create function pg_temp.closes_in(days integer) returns timestamptz language sql as $$
  select (((now() at time zone 'America/Tegucigalpa')::date + days) + time '12:00') at time zone 'America/Tegucigalpa';
$$;
insert into public.procurement_processes (id, source, source_process_key, expediente, buyer_entity, title, detail_url, closes_at) values
  ('a0000000-0000-4000-8000-00000000000a', 'honducompras_v1', 'pgtap-a', 'A-1', 'IHSS', 'Licencias', 'https://example.test/a', pg_temp.closes_in(1)),
  ('a0000000-0000-4000-8000-00000000000b', 'honducompras_v1', 'pgtap-b', 'B-1', 'IHSS', 'Soporte', 'https://example.test/b', pg_temp.closes_in(3)),
  ('a0000000-0000-4000-8000-00000000000c', 'honducompras_v1', 'pgtap-c', 'C-1', 'IHSS', 'Equipos', 'https://example.test/c', pg_temp.closes_in(2)),
  ('a0000000-0000-4000-8000-00000000000d', 'honducompras_v1', 'pgtap-d', 'D-1', 'IHSS', 'Redes', 'https://example.test/d', pg_temp.closes_in(1));

create function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.count_of(type_id text, user_id uuid) returns integer language sql as $$
  select count(*)::int from public.notifications n
  where n.type_id = count_of.type_id and n.user_id = count_of.user_id
    and n.org_id in ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
$$;

-- ---------- Assignment ----------
set local role authenticated;
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
insert into public.opportunity_tracking (org_id, process_id, status, assigned_to, updated_by) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a0000000-0000-4000-8000-00000000000a', 'en_evaluacion', '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a0000000-0000-4000-8000-00000000000b', 'preparando_oferta', null, '11111111-1111-4111-8111-111111111111'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a0000000-0000-4000-8000-00000000000c', 'en_evaluacion', null, '11111111-1111-4111-8111-111111111111'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a0000000-0000-4000-8000-00000000000d', 'presentada', '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111');
reset role;

select is(pg_temp.count_of('opportunity.assigned', '22222222-2222-4222-8222-222222222222'), 1, 'the assignee hears they were assigned');
select is(
  (select title || ' | ' || body from public.notifications where type_id = 'opportunity.assigned' and user_id = '22222222-2222-4222-8222-222222222222'),
  'Le asignaron «A-1» | Olga Owner le asignó esta oportunidad. Cierra el '
    || to_char(pg_temp.closes_in(1) at time zone 'America/Tegucigalpa', 'DD/MM/YYYY') || ' a las 12:00. Licencias',
  'with who assigned it, the deadline, and the object'
);
select ok(
  (select action_url from public.notifications where type_id = 'opportunity.assigned' and user_id = '22222222-2222-4222-8222-222222222222')
    = '/organizations/test-org-pgtap/opportunities/tracking?detalle=a0000000-0000-4000-8000-00000000000a',
  'linking to the opportunity in «En seguimiento»'
);
select ok(
  exists (select 1 from public.notification_deliveries where type_id = 'opportunity.assigned' and user_id = '22222222-2222-4222-8222-222222222222'),
  'and by email'
);
select is(pg_temp.count_of('opportunity.assigned', '11111111-1111-4111-8111-111111111111'), 0, 'assigning oneself alerts nobody');

set local role authenticated;
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
update public.opportunity_tracking set status = 'preparando_oferta', updated_by = '11111111-1111-4111-8111-111111111111'
where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and process_id = 'a0000000-0000-4000-8000-00000000000a';
reset role;
select is(pg_temp.count_of('opportunity.assigned', '22222222-2222-4222-8222-222222222222'), 1, 'a change that keeps the assignee alerts nobody again');

-- ---------- Closing reminders ----------
select is(
  (select title from public.notifications where type_id = 'opportunity.closing_soon' and org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' limit 1),
  null, 'no reminder before the morning job'
);
select private.remind_closing_opportunities();

select is(pg_temp.count_of('opportunity.closing_soon', '22222222-2222-4222-8222-222222222222'), 2, 'the member is reminded of the one assigned to them and the one without an assignee');
select is(pg_temp.count_of('opportunity.closing_soon', '11111111-1111-4111-8111-111111111111'), 1, 'the owner only of the one without an assignee');
select is(pg_temp.count_of('opportunity.closing_soon', '33333333-3333-4333-8333-333333333333'), 0, 'viewers are not reminded');
select is(
  (select title || ' | ' || body from public.notifications where type_id = 'opportunity.closing_soon' and user_id = '22222222-2222-4222-8222-222222222222' and data ->> 'process_id' = 'a0000000-0000-4000-8000-00000000000a'),
  'Cierra mañana: «A-1» | La fecha límite es el '
    || to_char(pg_temp.closes_in(1) at time zone 'America/Tegucigalpa', 'DD/MM/YYYY') || ' a las 12:00 y está «Preparando oferta». Licencias',
  'tomorrow, with the deadline and status'
);
select is(
  (select title from public.notifications where type_id = 'opportunity.closing_soon' and user_id = '11111111-1111-4111-8111-111111111111'),
  'Cierra en 3 días: «B-1»', 'or in 3 days'
);
select ok(
  not exists (select 1 from public.notifications where type_id = 'opportunity.closing_soon' and data ->> 'process_id' in ('a0000000-0000-4000-8000-00000000000c', 'a0000000-0000-4000-8000-00000000000d')),
  'nothing closing in 2 days, nor what was already presented'
);

select private.remind_closing_opportunities();
select is(pg_temp.count_of('opportunity.closing_soon', '22222222-2222-4222-8222-222222222222'), 2, 'running again repeats nothing');

update public.procurement_processes set closes_at = pg_temp.closes_in(3) + interval '2 hours' where id = 'a0000000-0000-4000-8000-00000000000a';
select private.remind_closing_opportunities();
select is(pg_temp.count_of('opportunity.closing_soon', '22222222-2222-4222-8222-222222222222'), 3, 'an extension reminds again for the new deadline');

update public.opportunity_tracking set status = 'descartada'
where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and process_id = 'a0000000-0000-4000-8000-00000000000b';
update public.procurement_processes set closes_at = pg_temp.closes_in(1) where id = 'a0000000-0000-4000-8000-00000000000b';
select private.remind_closing_opportunities();
select is(pg_temp.count_of('opportunity.closing_soon', '11111111-1111-4111-8111-111111111111'), 1, 'a discarded opportunity is not reminded');

select is(pg_temp.count_of('opportunity.closing_soon', '44444444-4444-4444-8444-444444444444'), 0, 'another organization hears nothing');

select * from finish();
rollback;
