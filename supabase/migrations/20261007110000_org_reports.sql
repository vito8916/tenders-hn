-- Reports per organization (plan §6.1 D6, slice 2).
--
-- Schedules move from each search to the organization. A «reporte» runs every
-- active search of the organization on the latest sync, so the Home's
-- results refresh, and sends one email with an Excel file (one sheet per
-- search). An organization picks its report times among the hours one hour
-- after each 3-hourly sync (1, 4, 7, 10, 13, 16, 19, 22 in Honduras); its plan
-- limits how many (plans.max_daily_reports: Básico 2, Estándar 3, Pro all 8).
--
--   report_schedules   the organization's report times and «enviar aunque no
--                      haya nuevas»; written through set_report_schedule.
--   org_reports        one per report: its runs (search_runs.report_id), its
--                      Excel file, and when it was emailed.
--
-- When the last run of a report finishes, the worker renders the Excel file
-- (render_org_report) and calls private.notify_org_report, which emails the
-- members once. Runs outside a report («Ejecutar ahora») refresh the Home
-- without an email; what they found is still reported by the next report.
-- The first run after the plan activates is a report of its own, so the
-- first email arrives with it.
--
-- The per-search schedule and delivery settings, enqueue_due_searches, and
-- notify_search_run go away. «Avisar cambios» stays on each search.

-- ============================================================
-- Plans
-- ============================================================

alter table public.plans
  -- Report times a day the organization can choose; null = every one of them.
  add column max_daily_reports integer constraint plans_max_daily_reports_check check (max_daily_reports between 1 and 8);

update public.plans set max_daily_reports = 2 where id = 'basic';
update public.plans set max_daily_reports = 3 where id = 'estandar';
update public.plans set max_daily_reports = null where id = 'pro';
update public.plans set description = 'Una línea de negocio, 2 reportes al día.' where id = 'basic';
update public.plans set description = 'Varias líneas de negocio, 3 reportes al día.' where id = 'estandar';
update public.plans set description = 'Varias líneas de negocio, un reporte en cada actualización.' where id = 'pro';

-- ============================================================
-- Report times
-- ============================================================

-- The hours (Honduras time) a report can run: one hour after each 3-hourly
-- sync (enqueue-ingest-sync runs at 0, 3, …, 21 UTC, that is 18, 21, 0, 3,
-- 6, 9, 12, and 15 in Honduras), so each report reads a fresh ingestion.
create function private.report_hours()
returns integer[]
language sql
immutable
set search_path = ''
as $$
  select array[1, 4, 7, 10, 13, 16, 19, 22];
$$;

-- The hours a new organization starts with: the first ones of this order
-- that its plan allows, so Básico gets 7 and 13, Estándar 7, 13, and 16, and
-- Pro 7, 10, 13, 16, and 19.
create function private.default_report_hours(max_reports integer)
returns integer[]
language sql
immutable
set search_path = ''
as $$
  select array(select hour from unnest(array[7, 13, 16, 10, 19]) with ordinality as t (hour, position)
               where position <= coalesce(max_reports, 5) order by hour);
$$;

-- The first of the given hours (Honduras time) after a moment, or null for none.
create function private.next_report_at(hours integer[], after timestamptz)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select min(slot)
  from (
    select ((local_day + day_offset) + make_interval(hours => hour)) at time zone 'America/Tegucigalpa' as slot
    from (select (after at time zone 'America/Tegucigalpa')::date as local_day) today
    cross join unnest(array[0, 1]) as day_offset
    cross join unnest(hours) as hour
  ) slots
  where slot > after;
$$;

create table public.report_schedules (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  hours integer[] not null constraint report_schedules_hours_check
    check (cardinality(hours) between 1 and 8 and hours <@ private.report_hours()),
  -- «Enviar aunque no haya oportunidades nuevas».
  email_when_empty boolean not null default false,
  next_report_at timestamptz,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index report_schedules_due_idx on public.report_schedules using btree (next_report_at) where next_report_at is not null;
create index report_schedules_updated_by_idx on public.report_schedules using btree (updated_by);

grant select on public.report_schedules to authenticated;
grant select, insert, update, delete on public.report_schedules to service_role;
alter table public.report_schedules enable row level security;
create policy "Members read their organization's report times" on public.report_schedules
  for select to authenticated using (private.user_org_role(org_id) is not null);

-- The organization's report times, created with its plan's defaults when missing.
create function private.ensure_report_schedule(target_org uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  default_hours integer[];
begin
  select private.default_report_hours(p.max_daily_reports) into default_hours
  from public.plans p where p.id = private.active_plan_id(target_org);

  insert into public.report_schedules (org_id, hours, next_report_at)
  values (
    target_org,
    coalesce(default_hours, private.default_report_hours(2)),
    private.next_report_at(coalesce(default_hours, private.default_report_hours(2)), now())
  )
  on conflict (org_id) do nothing;
end;
$$;

revoke execute on function private.ensure_report_schedule(uuid) from public, anon, authenticated;

-- Owners and admins choose the report times within the plan. Raises
-- insufficient_role, subscription_inactive, invalid_report_hours, or
-- report_limit_reached.
create function public.set_report_schedule(target_org uuid, report_hours integer[], send_when_empty boolean)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  plan public.plans%rowtype;
  chosen integer[] := array(select distinct hour from unnest(report_hours) as hour order by hour);
  next_at timestamptz;
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;
  if coalesce(private.user_org_role(target_org), '') not in ('owner', 'admin') then
    raise exception 'insufficient_role';
  end if;
  select p.* into plan from public.plans p where p.id = private.active_plan_id(target_org);
  if not found then
    raise exception 'subscription_inactive';
  end if;
  if cardinality(chosen) = 0 or not chosen <@ private.report_hours() then
    raise exception 'invalid_report_hours';
  end if;
  if plan.max_daily_reports is not null and cardinality(chosen) > plan.max_daily_reports then
    raise exception 'report_limit_reached';
  end if;

  next_at := private.next_report_at(chosen, now());
  insert into public.report_schedules (org_id, hours, email_when_empty, next_report_at, updated_by, updated_at)
  values (target_org, chosen, send_when_empty, next_at, current_user_id, now())
  on conflict (org_id) do update
    set hours = excluded.hours, email_when_empty = excluded.email_when_empty, next_report_at = excluded.next_report_at,
        updated_by = excluded.updated_by, updated_at = now();

  insert into public.app_events (event_name, org_id, user_id, metadata)
  values ('report_schedule.updated', target_org, current_user_id, jsonb_build_object('hours', chosen, 'email_when_empty', send_when_empty));

  return next_at;
end;
$$;

revoke execute on function public.set_report_schedule(uuid, integer[], boolean) from public, anon;
grant execute on function public.set_report_schedule(uuid, integer[], boolean) to authenticated;

-- ============================================================
-- Reports
-- ============================================================

create table public.org_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  trigger text not null constraint org_reports_trigger_check check (trigger in ('schedule', 'first')),
  created_at timestamptz not null default now(),
  -- When its last run finished; the Excel file and the email follow.
  finished_at timestamptz,
  -- Path of the Excel file in the reports bucket: <org_id>/reports/<report_id>.xlsx.
  excel_path text,
  -- Set once the email went out, so a redelivered job does not send it again.
  notified_at timestamptz
);

create index org_reports_org_created_idx on public.org_reports using btree (org_id, created_at desc);

grant select on public.org_reports to authenticated;
grant select, insert, update, delete on public.org_reports to service_role;
alter table public.org_reports enable row level security;
create policy "Members read their organization's reports" on public.org_reports
  for select to authenticated using (private.user_org_role(org_id) is not null);

alter table public.search_runs
  add column report_id uuid references public.org_reports (id) on delete set null,
  -- The run's Excel file in the reports bucket, next to its PDF: <org_id>/<run_id>.xlsx.
  add column excel_path text;

create index search_runs_report_idx on public.search_runs using btree (report_id);
create index search_runs_excel_path_idx on public.search_runs using btree (excel_path) where excel_path is not null;

-- Members read a run's PDF and Excel file within the plan's history.
drop policy "Reports read by org members within the plan's history" on storage.objects;
create policy "Reports read by org members within the plan's history"
on storage.objects for select to authenticated
using (
  bucket_id = 'reports'
  and private.user_org_role(((storage.foldername(name))[1])::uuid) is not null
  and exists (
    select 1 from public.search_runs r
    where (r.report_path = name or r.excel_path = name) and r.created_at >= private.history_cutoff(r.org_id)
  )
);

-- ============================================================
-- Runs belong to a report
-- ============================================================

drop function private.create_search_run(uuid, text, uuid);

-- Creates a run of a search with its criteria frozen in config_snapshot and
-- queues it, as part of a report when one is given. Raises no_profile when
-- the search follows a profile that does not exist and run_in_progress when
-- the search already has one in flight.
create function private.create_search_run(target_search uuid, run_trigger text, requested_by uuid, target_report uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  search public.saved_searches;
  used_profile_version integer;
  latest_sync record;
  new_run_id uuid;
begin
  select * into strict search from public.saved_searches where id = target_search;

  if search.inherits_profile then
    select version into used_profile_version from public.company_profiles where org_id = search.org_id;
    if used_profile_version is null then
      raise exception 'no_profile';
    end if;
  end if;

  select id, finished_at into latest_sync
  from public.source_sync_runs
  where status = 'succeeded'
  order by finished_at desc
  limit 1;

  begin
    insert into public.search_runs (org_id, saved_search_id, report_id, trigger, profile_version, sync_run_id, source_synced_at, config_snapshot, created_by)
    values (
      search.org_id, search.id, target_report, run_trigger, used_profile_version, latest_sync.id, latest_sync.finished_at,
      jsonb_build_object('search', jsonb_build_object(
        'name', search.name,
        'inheritsProfile', search.inherits_profile,
        'description', search.description,
        'keywords', search.keywords,
        'exclusions', search.exclusions,
        'entities', search.entities,
        'modalities', search.modalities,
        'acquisitionTypes', search.acquisition_types
      )),
      requested_by
    )
    returning id into new_run_id;
  exception when unique_violation then
    raise exception 'run_in_progress';
  end;

  perform pgmq.send('match', jsonb_build_object('type', 'search_run', 'runId', new_run_id));
  return new_run_id;
end;
$$;

revoke execute on function private.create_search_run(uuid, text, uuid, uuid) from public, anon, authenticated;

-- A report of the organization: one run per active search. Searches with a
-- run in flight, or that follow a missing profile, are left out; a report
-- with no run is not kept. Returns the report, or null.
create function private.create_org_report(target_org uuid, report_trigger text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_report_id uuid;
  search record;
  runs integer := 0;
begin
  insert into public.org_reports (org_id, trigger) values (target_org, report_trigger) returning id into new_report_id;

  for search in
    select id from public.saved_searches where org_id = target_org and is_active order by is_default desc, name
  loop
    begin
      perform private.create_search_run(search.id, case when report_trigger = 'first' then 'first' else 'schedule' end, null, new_report_id);
      runs := runs + 1;
    exception when raise_exception then
      if sqlerrm not in ('no_profile', 'run_in_progress') then
        raise;
      end if;
    end;
  end loop;

  if runs = 0 then
    delete from public.org_reports where id = new_report_id;
    return null;
  end if;
  return new_report_id;
end;
$$;

revoke execute on function private.create_org_report(uuid, text) from public, anon, authenticated;

-- «Ejecutar ahora»: same rules as before; the run is outside any report.
create or replace function public.request_search_run(target_search uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  search public.saved_searches;
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select * into search from public.saved_searches where id = target_search;
  if not found or private.user_org_role(search.org_id) is null then
    raise exception 'search_not_found';
  end if;
  if not search.is_active then
    raise exception 'search_inactive';
  end if;
  if private.active_plan_id(search.org_id) is null then
    raise exception 'subscription_inactive';
  end if;

  return private.create_search_run(search.id, 'manual', current_user_id);
end;
$$;

-- The organization's first report: once it has an active plan and a
-- company profile, and has never run a search. Returns the report, or null.
create or replace function private.start_first_run(target_org uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.active_plan_id(target_org) is null
     or not exists (select 1 from public.company_profiles where org_id = target_org)
     or exists (select 1 from public.search_runs where org_id = target_org) then
    return null;
  end if;

  perform private.ensure_default_search(target_org);
  return private.create_org_report(target_org, 'first');
end;
$$;

create or replace function private.tg_subscription_start_first_run()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    perform private.ensure_default_search(new.org_id);
    perform private.ensure_report_schedule(new.org_id);
    perform private.start_first_run(new.org_id);
  end if;
  return null;
end;
$$;

-- Queues a report for every organization whose report time has come, and
-- moves it to its next time. Organizations without an active plan are
-- skipped until their next time. A plan that allows fewer times than the
-- organization chose (after a downgrade) runs only its first ones.
create function private.enqueue_due_reports()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  due record;
  queued integer := 0;
begin
  for due in
    with picked as (
      select org_id, hours, next_report_at as due_at
      from public.report_schedules
      where next_report_at <= now()
      order by next_report_at
      limit 200
      for update skip locked
    ),
    moved as (
      update public.report_schedules s
      set next_report_at = private.next_report_at(s.hours, now())
      from picked
      where s.org_id = picked.org_id
      returning s.org_id
    )
    select picked.org_id, picked.hours, picked.due_at from picked join moved using (org_id)
  loop
    continue when private.active_plan_id(due.org_id) is null;
    continue when (
      select p.max_daily_reports is not null
             and extract(hour from due.due_at at time zone 'America/Tegucigalpa')::integer
                 <> all (due.hours[1:p.max_daily_reports])
      from public.plans p where p.id = private.active_plan_id(due.org_id)
    );
    if private.create_org_report(due.org_id, 'schedule') is not null then
      queued := queued + 1;
    end if;
  end loop;
  return queued;
end;
$$;

revoke execute on function private.enqueue_due_reports() from public, anon, authenticated;

select cron.unschedule('enqueue-due-searches');
select cron.schedule('enqueue-due-reports', '*/5 * * * *', 'select private.enqueue_due_reports()');
drop function private.enqueue_due_searches();

-- When the last run of a report finishes (or fails), the worker renders its
-- Excel file and then emails it (render_org_report → notify_org_report).
create function private.tg_search_run_finish_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.report_id is null or new.status not in ('completed', 'partial', 'failed') or old.status = new.status then
    return null;
  end if;

  perform 1 from public.org_reports where id = new.report_id for update;
  if exists (select 1 from public.search_runs where report_id = new.report_id and status in ('queued', 'running')) then
    return null;
  end if;

  update public.org_reports set finished_at = now() where id = new.report_id and finished_at is null;
  if found then
    perform pgmq.send('match', jsonb_build_object('type', 'render_org_report', 'reportId', new.report_id));
  end if;
  return null;
end;
$$;

create trigger search_runs_finish_report
  after update of status on public.search_runs
  for each row execute function private.tg_search_run_finish_report();

-- ============================================================
-- The report email
-- ============================================================

update public.notification_types
set label = 'Reportes', description = 'Llegó un reporte con oportunidades nuevas o con cambios, con su Excel.'
where id = 'search_run.completed';

alter table public.notification_deliveries drop constraint notification_deliveries_template_check;
alter table public.notification_deliveries add constraint notification_deliveries_template_check
  check (template in ('search_run_report', 'org_report'));

-- Emails a finished report once: to every member, the relevant
-- opportunities of each run that its search has not reported, or that
-- changed since it did, with the Excel file attached. Skipped (but marked)
-- when nothing is new, unless the organization asked for it anyway.
-- Returns how many opportunities it reported.
create function private.notify_org_report(target_report uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  report record;
  sections jsonb;
  reported_count integer;
  new_count integer;
  updated_count integer;
  examined integer;
  synced_at timestamptz;
  home_url text;
  title text;
  body text;
  report_payload jsonb;
  member_id uuid;
  dedupe text := 'org_report:' || target_report;
begin
  select r.id, r.org_id, r.trigger, r.created_at, r.finished_at, r.excel_path, r.notified_at, o.slug,
         coalesce(s.email_when_empty, false) as email_when_empty
    into report
  from public.org_reports r
  join public.organizations o on o.id = r.org_id
  left join public.report_schedules s on s.org_id = r.org_id
  where r.id = target_report
  for update of r;

  if report.id is null or report.finished_at is null or report.notified_at is not null then
    return 0;
  end if;
  update public.org_reports set notified_at = now() where id = target_report;

  home_url := '/organizations/' || report.slug;

  select count(*), count(*) filter (where u.state = 'nueva'), count(*) filter (where u.state = 'actualizada')
    into reported_count, new_count, updated_count
  from public.search_runs run
  cross join lateral private.unreported_matches(run.id) u
  where run.report_id = target_report and run.status in ('completed', 'partial');

  select coalesce(sum(processes_examined), 0), max(source_synced_at) into examined, synced_at
  from public.search_runs where report_id = target_report and status in ('completed', 'partial');

  if reported_count > 0 or report.email_when_empty then
    -- Each search with what it found, up to 20 opportunities over the whole email; the rest are in the Excel file.
    select coalesce(jsonb_agg(section order by is_default desc, search_name), '[]'::jsonb) into sections
    from (
      select s.is_default, s.name as search_name,
             jsonb_build_object(
               'searchName', s.name,
               'total', (select count(*) from private.unreported_matches(run.id)),
               'opportunities', coalesce((
                 select jsonb_agg(item order by position) from (
                   select jsonb_build_object(
                            'expediente', u.expediente,
                            'title', u.title,
                            'buyerEntity', u.buyer_entity,
                            'relevance', u.relevance,
                            'state', u.state,
                            'closesAt', to_char(u.closes_at at time zone 'America/Tegucigalpa', 'DD/MM/YYYY HH24:MI'),
                            'path', home_url || '?busqueda=' || s.id || '&ejecucion=' || run.id || '&detalle=' || u.process_id
                          ) as item,
                          row_number() over (
                            order by array_position(array['muy_relevante', 'posible'], u.relevance), u.closes_at nulls last, u.expediente
                          ) as position
                   from private.unreported_matches(run.id) u
                 ) ranked
                 where position <= 20
               ), '[]'::jsonb)
             ) as section
      from public.search_runs run
      join public.saved_searches s on s.id = run.saved_search_id
      where run.report_id = target_report and run.status in ('completed', 'partial')
    ) per_search;

    title := case
      when report.trigger = 'first' and reported_count > 0 then
        reported_count || case when reported_count = 1 then ' oportunidad para su empresa' else ' oportunidades para su empresa' end
      when reported_count = 0 then 'Sin oportunidades nuevas en su reporte'
      when updated_count = 0 then
        new_count || case when new_count = 1 then ' oportunidad nueva' else ' oportunidades nuevas' end
      when new_count = 0 then
        updated_count || case when updated_count = 1 then ' oportunidad actualizada' else ' oportunidades actualizadas' end
      else new_count || case when new_count = 1 then ' nueva' else ' nuevas' end
        || ' y ' || updated_count || case when updated_count = 1 then ' actualizada' else ' actualizadas' end
    end;
    body := 'Revisamos ' || examined || ' procesos abiertos'
      || coalesce(' con datos de HonduCompras del ' || to_char(synced_at at time zone 'America/Tegucigalpa', 'DD/MM/YYYY HH24:MI'), '')
      || case when reported_count = 0 then ' y no encontramos oportunidades que no le hayamos enviado antes.'
              else '. El Excel adjunto tiene todos los resultados.' end;
    report_payload := jsonb_build_object(
      'total', reported_count,
      'newCount', new_count,
      'updatedCount', updated_count,
      'sections', sections,
      'excelPath', report.excel_path,
      'excelName', 'licitaly-reporte-' || to_char(report.created_at at time zone 'America/Tegucigalpa', 'YYYY-MM-DD-HH24MI') || '.xlsx'
    );

    for member_id in select m.user_id from public.organization_members m where m.org_id = report.org_id loop
      perform private.notify(member_id, report.org_id, 'search_run.completed', title, body, home_url,
                             jsonb_build_object('report_id', target_report), dedupe);
      update public.notification_deliveries
      set template = 'org_report', payload = report_payload
      where idempotency_key = member_id::text || ':' || dedupe and status = 'pending';
    end loop;
  end if;

  insert into public.opportunity_notifications (saved_search_id, process_id, org_id, process_version_id, run_id)
  select run.saved_search_id, u.process_id, report.org_id, u.process_version_id, run.id
  from public.search_runs run
  cross join lateral private.unreported_matches(run.id) u
  where run.report_id = target_report and run.status in ('completed', 'partial')
  on conflict (saved_search_id, process_id) do update
  set process_version_id = excluded.process_version_id, run_id = excluded.run_id, notified_at = now();

  return reported_count;
end;
$$;

revoke execute on function private.notify_org_report(uuid) from public, anon, authenticated;

drop function private.notify_search_run(uuid);
alter table public.search_runs drop column notified_at;

-- ============================================================
-- Searches lose their schedule and delivery settings
-- ============================================================

drop trigger saved_searches_before_write on public.saved_searches;
drop trigger saved_searches_log on public.saved_searches;
drop index public.saved_searches_due_idx;

alter table public.saved_searches
  drop column schedule,
  drop column next_run_at,
  drop column deliver_by_email,
  drop column email_when_empty;

create or replace function private.tg_saved_searches_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan public.plans%rowtype;
  becomes_active boolean := new.is_active and (tg_op = 'INSERT' or not old.is_active);
begin
  perform private.lock_org(new.org_id, 'searches');

  -- The default search is created by the system and must exist even at the plan's limit.
  if not (tg_op = 'INSERT' and new.is_default) then
    select p.* into plan from public.plans p where p.id = private.active_plan_id(new.org_id);
    if not found then
      raise exception 'subscription_inactive';
    end if;

    if becomes_active and plan.max_active_searches is not null and (
      select count(*) from public.saved_searches s
      where s.org_id = new.org_id and s.is_active and s.id <> new.id
    ) >= plan.max_active_searches then
      raise exception 'search_limit_reached';
    end if;
  end if;

  new.name := btrim(new.name);
  new.description := nullif(btrim(coalesce(new.description, '')), '');
  new.keywords := private.clean_text_list(new.keywords);
  new.exclusions := private.clean_text_list(new.exclusions);
  new.entities := private.clean_text_list(new.entities);
  new.modalities := private.clean_text_list(new.modalities);
  new.acquisition_types := private.clean_text_list(new.acquisition_types);

  if tg_op = 'UPDATE' then
    if new.description is distinct from old.description then
      new.extracted_profile := null;
      new.extraction_version := null;
    end if;
    new.updated_by := auth.uid();
    new.updated_at := now();
  end if;

  return new;
end;
$$;

create trigger saved_searches_before_write
  before insert or update of name, inherits_profile, description, keywords, exclusions, entities, modalities,
    acquisition_types, alert_on_changes, is_active
  on public.saved_searches
  for each row execute function private.tg_saved_searches_before_write();

create trigger saved_searches_log
  after insert or delete or update of name, inherits_profile, description, keywords, exclusions, entities, modalities,
    acquisition_types, alert_on_changes, is_active
  on public.saved_searches
  for each row execute function private.tg_saved_searches_log();

create or replace function private.ensure_default_search(target_org uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  default_id uuid;
begin
  select id into default_id from public.saved_searches where org_id = target_org and is_default;
  if default_id is not null then
    return default_id;
  end if;

  insert into public.saved_searches (org_id, name, is_default, inherits_profile, created_by)
  select o.id, 'Recomendadas', true, true, o.owner_id
  from public.organizations o
  where o.id = target_org
  returning id into default_id;

  return default_id;
end;
$$;

drop function public.saved_search_limits(uuid);

-- What the organization's plan allows now: whether searches can be written
-- or run, how many can be active, and how many report times a day.
create function public.saved_search_limits(target_org uuid)
returns table (has_active_plan boolean, max_active_searches integer, active_searches integer, max_daily_reports integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id is not null,
    p.max_active_searches,
    (select count(*) from public.saved_searches s where s.org_id = target_org and s.is_active)::integer,
    case when p.id is null then 0 else coalesce(p.max_daily_reports, cardinality(private.report_hours())) end
  from (select private.active_plan_id(target_org) as plan_id) active
  left join public.plans p on p.id = active.plan_id
  where private.user_org_role(target_org) is not null;
$$;

revoke execute on function public.saved_search_limits(uuid) from public, anon;
grant execute on function public.saved_search_limits(uuid) to authenticated;

-- What stops the organization from moving to a plan now: 'members' (members
-- plus pending invitations over the plan's limit), 'searches' (more active
-- searches), 'report_times' (more report times a day than the plan allows).
-- Empty when it fits; null for non-members or an unknown plan.
create or replace function public.plan_change_blockers(target_org uuid, target_plan text)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select array_remove(array[
    case when p.max_members is not null and private.org_seats_used(target_org) > p.max_members then 'members' end,
    case when p.max_active_searches is not null and (
      select count(*) from public.saved_searches s where s.org_id = target_org and s.is_active
    ) > p.max_active_searches then 'searches' end,
    case when p.max_daily_reports is not null and (
      select cardinality(r.hours) from public.report_schedules r where r.org_id = target_org
    ) > p.max_daily_reports then 'report_times' end
  ], null)
  from public.plans p
  where p.id = target_plan
    and private.user_org_role(target_org) is not null;
$$;

drop function private.next_search_run_at(text, timestamptz);
drop function private.search_schedule_interval(text);
drop function private.search_schedule_hours(text);

-- ============================================================
-- Existing organizations
-- ============================================================

insert into public.report_schedules (org_id, hours, next_report_at)
select o.id, private.default_report_hours(p.max_daily_reports), private.next_report_at(private.default_report_hours(p.max_daily_reports), now())
from public.organizations o
join public.plans p on p.id = private.active_plan_id(o.id)
on conflict (org_id) do nothing;
