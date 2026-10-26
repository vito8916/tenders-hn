-- Organization reports and change alerts (plan §6.1 D6): a report finishes
-- when its last run does, and then tells every member, once, about the
-- opportunities each search has not reported (or that changed since);
-- report times are chosen within the plan and queue one report per due
-- organization; a change to a tracked process (any status but descartada) alerts the
-- members once per change.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'owner@test.local', 'authenticated', 'authenticated', '{}'),
  ('22222222-2222-4222-8222-222222222222', 'member@test.local', 'authenticated', 'authenticated', '{}'),
  ('33333333-3333-4333-8333-333333333333', 'other@test.local', 'authenticated', 'authenticated', '{}');
insert into public.organizations (id, name, slug, owner_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Test Org', 'test-org-pgtap', '11111111-1111-4111-8111-111111111111'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Other Org', 'other-org-pgtap', '33333333-3333-4333-8333-333333333333');
insert into public.organization_members (org_id, user_id, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'viewer');
insert into public.organization_subscriptions (org_id, plan_id, status, source, current_period_start, current_period_end) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'pro', 'active', 'manual', now(), now() + interval '1 month'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'pro', 'active', 'manual', now(), now() + interval '1 month');
insert into public.saved_searches (id, org_id, name, inherits_profile, description) values
  ('5eeeeeee-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Software', false, 'Software'),
  ('5eeeeeee-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Redes', false, 'Redes'),
  ('5eeeeeee-0000-4000-8000-000000000003', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Otra', false, 'Otra');

insert into public.procurement_processes (id, source, source_process_key, expediente, buyer_entity, title, detail_url, closes_at) values
  ('a0000000-0000-4000-8000-00000000000a', 'honducompras_v1', 'a', 'A-1', 'IHSS', 'Soporte SAP', 'https://example.test/a', now() + interval '10 days'),
  ('a0000000-0000-4000-8000-00000000000b', 'honducompras_v1', 'b', 'B-1', 'IHSS', 'Impresoras', 'https://example.test/b', null),
  ('a0000000-0000-4000-8000-00000000000c', 'honducompras_v1', 'c', 'C-1', 'SEDUC', 'Licencias', 'https://example.test/c', null);
insert into public.process_versions (id, process_id, content_sha256, detail) values
  ('b0000000-0000-4000-8000-0000000000a1', 'a0000000-0000-4000-8000-00000000000a', 'a1', '{}'),
  ('b0000000-0000-4000-8000-0000000000a2', 'a0000000-0000-4000-8000-00000000000a', 'a2', '{}');

create function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.report(report_id uuid, target_org uuid) returns void language sql as $$
  insert into public.org_reports (id, org_id, trigger) values (report_id, target_org, 'schedule');
$$;
-- A run in flight; finishing it is an update of its status, as the worker does.
create function pg_temp.run(run_id uuid, search_id uuid, report_id uuid, created timestamptz) returns void language sql as $$
  insert into public.search_runs (id, org_id, saved_search_id, report_id, status, created_at, processes_examined, source_synced_at)
  select run_id, s.org_id, search_id, report_id, 'running', created, 120, created - interval '1 hour' from public.saved_searches s where s.id = search_id;
$$;
create function pg_temp.match(target_run uuid, target_process uuid, version uuid, match_relevance text) returns void language sql as $$
  insert into public.search_run_matches (run_id, org_id, process_id, process_version_id, retrieval_rank, relevance, expediente, title, buyer_entity, detail_url)
  select target_run, r.org_id, target_process, version, 1, match_relevance, p.expediente, p.title, p.buyer_entity, p.detail_url
  from public.search_runs r, public.procurement_processes p where r.id = target_run and p.id = target_process;
$$;
create function pg_temp.finish(target_run uuid, run_status text default 'completed') returns void language sql as $$
  update public.search_runs set status = run_status, completed_at = now() where id = target_run;
$$;
create function pg_temp.queued_renders(target_report uuid) returns integer language sql as $$
  select count(*)::int from pgmq.q_match where message ->> 'type' = 'render_org_report' and message ->> 'reportId' = target_report::text;
$$;
create function pg_temp.told(target_report uuid) returns integer language sql as $$
  select count(*)::int from public.notifications where type_id = 'search_run.completed' and data ->> 'report_id' = target_report::text;
$$;

-- ---------- A report finishes with its last run ----------
select pg_temp.report('d0000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select pg_temp.run('c0000000-0000-4000-8000-000000000001', '5eeeeeee-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', now() - interval '3 days');
select pg_temp.run('c0000000-0000-4000-8000-000000000002', '5eeeeeee-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', now() - interval '3 days');
select pg_temp.match('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', 'b0000000-0000-4000-8000-0000000000a1', 'muy_relevante');
select pg_temp.match('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000b', null, 'descartada');
select pg_temp.match('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-00000000000c', null, 'posible');

select pg_temp.finish('c0000000-0000-4000-8000-000000000001');
select is((select finished_at from public.org_reports where id = 'd0000000-0000-4000-8000-000000000001'), null, 'a report waits for all its runs');
select is(pg_temp.queued_renders('d0000000-0000-4000-8000-000000000001'), 0, 'and is not rendered yet');
select pg_temp.finish('c0000000-0000-4000-8000-000000000002');
select isnt((select finished_at from public.org_reports where id = 'd0000000-0000-4000-8000-000000000001'), null, 'the last run finishes it');
select is(pg_temp.queued_renders('d0000000-0000-4000-8000-000000000001'), 1, 'and queues its Excel file and email once');

-- ---------- The email ----------
select is(private.notify_org_report('d0000000-0000-4000-8000-000000000001'), 2, 'the report tells the relevant opportunities of both searches');
select is(pg_temp.told('d0000000-0000-4000-8000-000000000001'), 2, 'to every member, viewers included');
select is(
  (select title from public.notifications where data ->> 'report_id' = 'd0000000-0000-4000-8000-000000000001' limit 1),
  '2 oportunidades nuevas', 'the title counts what is new'
);
select results_eq(
  $$select template, jsonb_path_query_array(payload, '$.sections[*].searchName'), jsonb_path_query_array(payload, '$.sections[*].opportunities[*].expediente')
    from public.notification_deliveries where recipient = 'owner@test.local' and type_id = 'search_run.completed'$$,
  $$values ('org_report'::text, '["Redes", "Software"]'::jsonb, '["C-1", "A-1"]'::jsonb)$$,
  'one email lists each search with its relevant opportunities, not the discarded one'
);
select ok(
  (select bool_and(path #>> '{}' like '/organizations/%/updates/%?detalle=%')
     from public.notification_deliveries d, jsonb_path_query(d.payload, '$.sections[*].opportunities[*].path') as path
    where d.recipient = 'owner@test.local' and d.type_id = 'search_run.completed'),
  'and each opportunity links to its update''s page'
);
select is(private.notify_org_report('d0000000-0000-4000-8000-000000000001'), 0, 'a redelivered report sends nothing more');
select is(pg_temp.told('d0000000-0000-4000-8000-000000000001'), 2, 'and nobody is told twice');

-- A unchanged and C new for «Software» (Redes already reported C).
select pg_temp.report('d0000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select pg_temp.run('c0000000-0000-4000-8000-000000000003', '5eeeeeee-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', now() - interval '2 days');
select pg_temp.match('c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-00000000000a', 'b0000000-0000-4000-8000-0000000000a1', 'muy_relevante');
select pg_temp.match('c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-00000000000c', null, 'posible');
select pg_temp.finish('c0000000-0000-4000-8000-000000000003');
select is(private.notify_org_report('d0000000-0000-4000-8000-000000000002'), 1, 'what a search already reported does not repeat');

-- A changed version.
select pg_temp.report('d0000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select pg_temp.run('c0000000-0000-4000-8000-000000000004', '5eeeeeee-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003', now() - interval '1 day');
select pg_temp.match('c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-00000000000a', 'b0000000-0000-4000-8000-0000000000a2', 'muy_relevante');
select pg_temp.finish('c0000000-0000-4000-8000-000000000004');
select is(private.notify_org_report('d0000000-0000-4000-8000-000000000003'), 1, 'a changed opportunity reappears');
select is(
  (select title from public.notifications where data ->> 'report_id' = 'd0000000-0000-4000-8000-000000000003' limit 1),
  '1 oportunidad actualizada', 'as updated'
);

-- Nothing new, a failed run, and the organization does not want empty emails.
select pg_temp.report('d0000000-0000-4000-8000-000000000004', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select pg_temp.run('c0000000-0000-4000-8000-000000000005', '5eeeeeee-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000004', now());
select pg_temp.run('c0000000-0000-4000-8000-000000000006', '5eeeeeee-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000004', now());
select pg_temp.match('c0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-00000000000c', null, 'posible');
select pg_temp.finish('c0000000-0000-4000-8000-000000000005');
select pg_temp.finish('c0000000-0000-4000-8000-000000000006', 'failed');
select is(pg_temp.queued_renders('d0000000-0000-4000-8000-000000000004'), 1, 'a failed run still finishes its report');
select is(private.notify_org_report('d0000000-0000-4000-8000-000000000004'), 0, 'a report with nothing new reports nothing');
select is(pg_temp.told('d0000000-0000-4000-8000-000000000004'), 0, 'and tells nobody unless the organization wants empty reports');

-- The other organization wants them.
update public.report_schedules set email_when_empty = true where org_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
select pg_temp.report('d0000000-0000-4000-8000-000000000005', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
select pg_temp.run('c0000000-0000-4000-8000-000000000007', '5eeeeeee-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000005', now());
select pg_temp.finish('c0000000-0000-4000-8000-000000000007');
select is(private.notify_org_report('d0000000-0000-4000-8000-000000000005'), 0, 'an empty report has nothing to report');
select is(
  (select title from public.notifications where data ->> 'report_id' = 'd0000000-0000-4000-8000-000000000005'),
  'Sin oportunidades nuevas en su reporte', 'but says so when the organization wants empty reports'
);

-- A run outside any report («Ejecutar ahora») only refreshes the Home.
select pg_temp.run('c0000000-0000-4000-8000-000000000008', '5eeeeeee-0000-4000-8000-000000000001', null, now());
select pg_temp.finish('c0000000-0000-4000-8000-000000000008');
select is(
  (select count(*)::int from pgmq.q_match q join public.org_reports o on o.id = (q.message ->> 'reportId')::uuid
   where q.message ->> 'type' = 'render_org_report'
     and o.org_id in ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')),
  5, 'a run outside a report queues no report'
);

-- ---------- Report times ----------
select is(
  (select hours from public.report_schedules where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  array[7, 10, 13, 16, 19], 'activating Pro sets five report times'
);
select is(private.default_report_hours(2), array[7, 13], 'Básico starts at 7 and 13');
select is(private.default_report_hours(3), array[7, 13, 16], 'Estándar adds 16');
select is(
  private.next_report_at(array[7, 13], '2026-10-07 14:00-06'),
  '2026-10-08 07:00-06'::timestamptz, 'after the last time of the day comes the first one tomorrow'
);

set local role authenticated;
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select lives_ok(
  $$select public.set_report_schedule('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', array[13, 7, 7, 22], true)$$,
  'the owner chooses report times'
);
select results_eq(
  $$select hours, email_when_empty, next_report_at > now() from public.report_schedules where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  $$values (array[7, 13, 22], true, true)$$,
  'sorted and without repeats, with the next time'
);
select throws_ok(
  $$select public.set_report_schedule('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', array[8], false)$$,
  'P0001', 'invalid_report_hours', 'only the hours after a sync can be chosen'
);
select throws_ok(
  $$select public.set_report_schedule('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '{}', false)$$,
  'P0001', 'invalid_report_hours', 'at least one'
);
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select throws_ok(
  $$select public.set_report_schedule('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', array[7], false)$$,
  'P0001', 'insufficient_role', 'viewers cannot change them'
);
select is(
  (select hours from public.report_schedules where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  array[7, 13, 22], 'but read them'
);
select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
select is((select count(*)::int from public.report_schedules), 1, 'other organizations see only their own');
select is((select count(*)::int from public.org_reports), 1, 'and only their own reports');
reset role;

update public.organization_subscriptions set plan_id = 'basic' where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select throws_ok(
  $$select public.set_report_schedule('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', array[7, 13, 16], false)$$,
  'P0001', 'report_limit_reached', 'Básico allows two'
);
reset role;

-- ---------- Due reports ----------
-- Básico with three times (chosen on Pro): only the first two of the day run.
update public.report_schedules set next_report_at = '2026-10-06 22:00-06' where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
update public.report_schedules set next_report_at = now() + interval '1 hour' where org_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
select is(private.enqueue_due_reports(), 0, 'a time beyond the plan''s limit is skipped');
select ok(
  (select next_report_at > now() from public.report_schedules where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'and moves to the next time'
);

update public.organization_subscriptions set plan_id = 'pro' where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
update public.report_schedules set next_report_at = now() - interval '1 minute' where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select is(private.enqueue_due_reports(), 1, 'a due organization gets a report');
select results_eq(
  $$select s.name, r.trigger, r.status from public.search_runs r join public.saved_searches s on s.id = r.saved_search_id
    where r.org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and r.report_id is not null and r.status = 'queued'
    order by s.name$$,
  $$values ('Redes'::text, 'schedule'::text, 'queued'::text), ('Software', 'schedule', 'queued')$$,
  'with a run of each active search («Recomendadas» has no profile to follow yet)'
);
select ok(
  (select next_report_at > now() from public.report_schedules where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'and moves to its next time'
);

update public.report_schedules set next_report_at = now() - interval '1 minute' where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select is(private.enqueue_due_reports(), 0, 'searches with a run in flight leave no report to make');
select is(
  (select count(*)::int from public.org_reports where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  5, 'and no empty report is kept'
);

update public.search_runs set status = 'completed';
update public.report_schedules set next_report_at = now() - interval '1 minute' where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
update public.organization_subscriptions set status = 'expired' where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select is(private.enqueue_due_reports(), 0, 'organizations without an active plan are skipped');

-- ---------- Change alerts ----------
update public.organization_subscriptions set status = 'active' where org_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
insert into public.opportunity_tracking (org_id, process_id, status, updated_by)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a0000000-0000-4000-8000-00000000000a', 'en_evaluacion', '11111111-1111-4111-8111-111111111111');
insert into public.process_events (process_id, kind, before, after)
values ('a0000000-0000-4000-8000-00000000000a', 'deadline_changed', '{"bidsDueAt": "2026-10-10T10:00:00-06:00"}', '{"bidsDueAt": "2026-10-20T10:00:00-06:00"}');
select is(
  (select count(*)::int from public.notifications where type_id = 'opportunity.updated'),
  2, 'a deadline change to a tracked opportunity alerts both members'
);
select is(
  (select body from public.notifications where type_id = 'opportunity.updated' limit 1),
  'La fecha límite ahora es 20/10/2026 10:00. Soporte SAP', 'with the new deadline in Honduras time'
);
select ok(
  (select action_url from public.notifications where type_id = 'opportunity.updated' limit 1) like '/organizations/%/updates/%?detalle=a0000000-0000-4000-8000-00000000000a',
  'and a link that opens the opportunity on its update''s page'
);
insert into public.process_events (process_id, kind, after)
values ('a0000000-0000-4000-8000-00000000000c', 'document_added', '{"title": "Aclaratoria"}');
select is((select count(*)::int from public.notifications where type_id = 'opportunity.updated'), 2, 'a process nobody tracks alerts nobody');

update public.opportunity_tracking set status = 'descartada' where process_id = 'a0000000-0000-4000-8000-00000000000a';
insert into public.process_events (process_id, kind, after)
values ('a0000000-0000-4000-8000-00000000000a', 'document_added', '{"title": "Anexo"}');
select is((select count(*)::int from public.notifications where type_id = 'opportunity.updated'), 2, 'a discarded opportunity alerts nobody');
update public.opportunity_tracking set status = 'presentada' where process_id = 'a0000000-0000-4000-8000-00000000000a';

update public.saved_searches set alert_on_changes = false where id = '5eeeeeee-0000-4000-8000-000000000001';
insert into public.process_events (process_id, kind, after)
values ('a0000000-0000-4000-8000-00000000000a', 'document_added', '{"title": "Enmienda"}');
select is((select count(*)::int from public.notifications where type_id = 'opportunity.updated'), 2, 'nor when the searches that found it do not alert on changes');

-- Compra Menor titles name the products.
select is(
  private.process_display_title('Compra Menor', '{"products": [{"description": "Selladores"}, {"description": "Selladores"}, {"description": "Brochas"}]}'),
  'Compra menor: Selladores, Brochas', 'a Compra Menor is titled by its distinct products, in order'
);
select is(private.process_display_title('Compra Menor', '{}'), 'Compra Menor', 'without products the title stays');
select is(private.process_display_title('Soporte SAP', null), 'Soporte SAP', 'other titles stay');

select * from finish();
rollback;
