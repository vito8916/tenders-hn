-- Report emails and change alerts: a finished run tells every member about
-- the opportunities its search has not reported (or that changed since),
-- once, following the search's delivery settings; a change to a process
-- marked «Me interesa» alerts the members once per change.
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
insert into public.saved_searches (id, org_id, name, deliver_by_email, email_when_empty) values
  ('5eeeeeee-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Software', true, false),
  ('5eeeeeee-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Solo guardar', false, false),
  ('5eeeeeee-0000-4000-8000-000000000003', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Otra', true, true);

insert into public.procurement_processes (id, source, source_process_key, expediente, buyer_entity, title, detail_url, closes_at) values
  ('a0000000-0000-4000-8000-00000000000a', 'honducompras_v1', 'a', 'A-1', 'IHSS', 'Soporte SAP', 'https://example.test/a', now() + interval '10 days'),
  ('a0000000-0000-4000-8000-00000000000b', 'honducompras_v1', 'b', 'B-1', 'IHSS', 'Impresoras', 'https://example.test/b', null),
  ('a0000000-0000-4000-8000-00000000000c', 'honducompras_v1', 'c', 'C-1', 'SEDUC', 'Licencias', 'https://example.test/c', null);
insert into public.process_versions (id, process_id, content_sha256, detail) values
  ('b0000000-0000-4000-8000-0000000000a1', 'a0000000-0000-4000-8000-00000000000a', 'a1', '{}'),
  ('b0000000-0000-4000-8000-0000000000a2', 'a0000000-0000-4000-8000-00000000000a', 'a2', '{}');

create function pg_temp.run(run_id uuid, search_id uuid, created timestamptz, run_status text default 'completed') returns void language sql as $$
  insert into public.search_runs (id, org_id, saved_search_id, status, created_at, processes_examined, source_synced_at)
  select run_id, s.org_id, search_id, run_status, created, 120, created - interval '1 hour' from public.saved_searches s where s.id = search_id;
$$;
create function pg_temp.match(target_run uuid, target_process uuid, version uuid, match_relevance text) returns void language sql as $$
  insert into public.search_run_matches (run_id, org_id, process_id, process_version_id, retrieval_rank, relevance, expediente, title, buyer_entity, detail_url)
  select target_run, r.org_id, target_process, version, 1, match_relevance, p.expediente, p.title, p.buyer_entity, p.detail_url
  from public.search_runs r, public.procurement_processes p where r.id = target_run and p.id = target_process;
$$;
create function pg_temp.reports(run uuid) returns integer language sql as $$
  select count(*)::int from public.notifications where type_id = 'search_run.completed' and data ->> 'run_id' = run::text;
$$;

-- Run 1: A relevant, B discarded.
select pg_temp.run('c0000000-0000-4000-8000-000000000001', '5eeeeeee-0000-4000-8000-000000000001', now() - interval '2 days');
select pg_temp.match('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', 'b0000000-0000-4000-8000-0000000000a1', 'muy_relevante');
select pg_temp.match('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000b', null, 'descartada');
select is(private.notify_search_run('c0000000-0000-4000-8000-000000000001'), 1, 'the first run reports its one relevant opportunity');
select is(pg_temp.reports('c0000000-0000-4000-8000-000000000001'), 2, 'every member is told, viewers included');
select is(
  (select title from public.notifications where data ->> 'run_id' = 'c0000000-0000-4000-8000-000000000001' limit 1),
  '1 oportunidad nueva en «Software»', 'the title counts the new opportunity'
);
select is(
  (select template from public.notification_deliveries where recipient = 'owner@test.local' and type_id = 'search_run.completed'),
  'search_run_report', 'the email uses the report template'
);
select is(
  (select jsonb_path_query_array(payload, '$.opportunities[*].expediente') from public.notification_deliveries
   where recipient = 'owner@test.local' and type_id = 'search_run.completed'),
  '["A-1"]'::jsonb, 'the email lists the relevant opportunity, not the discarded one'
);
select is(private.notify_search_run('c0000000-0000-4000-8000-000000000001'), 0, 'a redelivered run reports nothing more');
select is(pg_temp.reports('c0000000-0000-4000-8000-000000000001'), 2, 'and nobody is told twice');

-- Run 2: A unchanged and C new.
select pg_temp.run('c0000000-0000-4000-8000-000000000002', '5eeeeeee-0000-4000-8000-000000000001', now() - interval '1 day');
select pg_temp.match('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-00000000000a', 'b0000000-0000-4000-8000-0000000000a1', 'muy_relevante');
select pg_temp.match('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-00000000000c', null, 'posible');
select is(private.notify_search_run('c0000000-0000-4000-8000-000000000002'), 1, 'an opportunity already reported does not repeat');

-- Run 3: A changed version; nothing else.
select pg_temp.run('c0000000-0000-4000-8000-000000000003', '5eeeeeee-0000-4000-8000-000000000001', now());
select pg_temp.match('c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-00000000000a', 'b0000000-0000-4000-8000-0000000000a2', 'muy_relevante');
select pg_temp.match('c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-00000000000c', null, 'posible');
select is(private.notify_search_run('c0000000-0000-4000-8000-000000000003'), 1, 'a changed opportunity reappears');
select is(
  (select title from public.notifications where data ->> 'run_id' = 'c0000000-0000-4000-8000-000000000003' limit 1),
  '1 oportunidad actualizada en «Software»', 'as updated'
);

-- Run 4: nothing new, and the search does not email empty runs.
select pg_temp.run('c0000000-0000-4000-8000-000000000004', '5eeeeeee-0000-4000-8000-000000000001', now() + interval '1 minute');
select pg_temp.match('c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-00000000000c', null, 'posible');
select is(private.notify_search_run('c0000000-0000-4000-8000-000000000004'), 0, 'a run with nothing new reports nothing');
select is(pg_temp.reports('c0000000-0000-4000-8000-000000000004'), 0, 'and tells nobody when the search does not email empty runs');

-- «Solo guardar» and an unfinished run.
select pg_temp.run('c0000000-0000-4000-8000-000000000005', '5eeeeeee-0000-4000-8000-000000000002', now());
select pg_temp.match('c0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-00000000000b', null, 'posible');
select is(private.notify_search_run('c0000000-0000-4000-8000-000000000005'), 0, 'a search that only saves results tells nobody');
select pg_temp.run('c0000000-0000-4000-8000-000000000006', '5eeeeeee-0000-4000-8000-000000000001', now(), 'failed');
select is(private.notify_search_run('c0000000-0000-4000-8000-000000000006'), 0, 'a failed run tells nobody');

-- Another organization's search emails even an empty run.
select pg_temp.run('c0000000-0000-4000-8000-000000000007', '5eeeeeee-0000-4000-8000-000000000003', now());
select is(private.notify_search_run('c0000000-0000-4000-8000-000000000007'), 0, 'an empty run has nothing to report');
select is(
  (select title from public.notifications where data ->> 'run_id' = 'c0000000-0000-4000-8000-000000000007'),
  'Sin oportunidades nuevas en «Otra»', 'but a search that emails empty runs says so'
);

-- Change alerts: the organization marks A «Me interesa».
insert into public.opportunity_feedback (org_id, process_id, decision, decided_by)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a0000000-0000-4000-8000-00000000000a', 'interesa', '11111111-1111-4111-8111-111111111111');
insert into public.process_events (process_id, kind, before, after)
values ('a0000000-0000-4000-8000-00000000000a', 'deadline_changed', '{"bidsDueAt": "2026-10-10T10:00:00-06:00"}', '{"bidsDueAt": "2026-10-20T10:00:00-06:00"}');
select is(
  (select count(*)::int from public.notifications where type_id = 'opportunity.updated'),
  2, 'a deadline change to an opportunity marked «Me interesa» alerts both members'
);
select is(
  (select body from public.notifications where type_id = 'opportunity.updated' limit 1),
  'La fecha límite ahora es 20/10/2026 10:00. Soporte SAP', 'with the new deadline in Honduras time'
);
select ok(
  (select action_url from public.notifications where type_id = 'opportunity.updated' limit 1) like '%&detalle=a0000000-0000-4000-8000-00000000000a',
  'and a link that opens the opportunity'
);
insert into public.process_events (process_id, kind, after)
values ('a0000000-0000-4000-8000-00000000000c', 'document_added', '{"title": "Aclaratoria"}');
select is((select count(*)::int from public.notifications where type_id = 'opportunity.updated'), 2, 'a process nobody marked alerts nobody');

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
