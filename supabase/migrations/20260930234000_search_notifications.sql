-- Report emails and change alerts (spec §7, plan Phase 4).
--
-- search_run.completed: when a run finishes, private.notify_search_run tells
-- every member about the run's relevant opportunities that this search has
-- not reported yet, or that changed (another process version) since it did.
-- It respects the search's «enviar por correo» (deliver_by_email; otherwise
-- the results only stay on the Home) and «enviar incluso sin coincidencias»
-- (email_when_empty). opportunity_notifications remembers what each search
-- reported, so an opportunity never repeats unless it changed. The email
-- lists the opportunities: the outbox gains a template and its payload.
--
-- opportunity.updated: a change to a process (deadline, documents, stage)
-- that an organization marked «Me interesa» alerts its members, when one of
-- the organization's searches that found it has «avisar cambios»
-- (alert_on_changes). It is a separate alert, not a repeat of the report.

alter table public.notification_types drop constraint notification_types_category_check;
alter table public.notification_types add constraint notification_types_category_check
  check (category in ('organization', 'billing', 'searches'));

insert into public.notification_types (id, label, category, description, default_in_app, default_email) values
  ('search_run.completed', 'Reportes de búsquedas', 'searches', 'Una búsqueda encontró oportunidades nuevas o con cambios.', true, true),
  ('opportunity.updated', 'Cambios en oportunidades', 'searches', 'Cambió una oportunidad marcada con «Me interesa».', true, true);

alter table public.notification_deliveries
  -- How the dispatcher renders the email; null is the plain title, body, and button.
  add column template text constraint notification_deliveries_template_check check (template in ('search_run_report')),
  add column payload jsonb not null default '{}'::jsonb;

-- Set once the run's report went out, so a redelivered search_run job does not send it again.
alter table public.search_runs add column notified_at timestamptz;

create table public.opportunity_notifications (
  saved_search_id uuid not null references public.saved_searches (id) on delete cascade,
  process_id uuid not null references public.procurement_processes (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  -- The version the search reported; another one makes the opportunity «actualizada».
  process_version_id uuid references public.process_versions (id) on delete set null,
  run_id uuid references public.search_runs (id) on delete set null,
  notified_at timestamptz not null default now(),
  primary key (saved_search_id, process_id)
);

create index opportunity_notifications_process_idx on public.opportunity_notifications using btree (process_id);
create index opportunity_notifications_org_idx on public.opportunity_notifications using btree (org_id);
create index opportunity_notifications_version_idx on public.opportunity_notifications using btree (process_version_id);
create index opportunity_notifications_run_idx on public.opportunity_notifications using btree (run_id);

grant select, insert, update, delete on public.opportunity_notifications to service_role;
-- Written only by private.notify_search_run; no policies, so users read nothing.
alter table public.opportunity_notifications enable row level security;

-- ============================================================
-- Report of a finished run
-- ============================================================

-- The run's relevant opportunities its search has not reported, or reported at another version of the process.
create function private.unreported_matches(target_run uuid)
returns table (
  process_id uuid, process_version_id uuid, relevance text, expediente text, title text, buyer_entity text, closes_at timestamptz, state text
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.process_id, m.process_version_id, m.relevance, m.expediente, m.title, m.buyer_entity, m.closes_at,
         case when n.process_id is null then 'nueva' else 'actualizada' end
  from public.search_run_matches m
  join public.search_runs r on r.id = m.run_id
  left join public.opportunity_notifications n on n.saved_search_id = r.saved_search_id and n.process_id = m.process_id
  where m.run_id = target_run
    and m.relevance in ('muy_relevante', 'posible')
    and (n.process_id is null or n.process_version_id is distinct from m.process_version_id);
$$;

revoke execute on function private.unreported_matches(uuid) from public, anon, authenticated;

create function private.notify_search_run(target_run uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  run record;
  reported_count integer;
  new_count integer;
  updated_count integer;
  listed jsonb;
  run_url text;
  title text;
  body text;
  report_payload jsonb;
  member_id uuid;
  dedupe text := 'search_run.completed:' || target_run;
begin
  select r.id, r.org_id, r.saved_search_id, r.status, r.created_at, r.source_synced_at, r.processes_examined, r.notified_at,
         s.name as search_name, s.deliver_by_email, s.email_when_empty, o.slug
    into run
  from public.search_runs r
  join public.saved_searches s on s.id = r.saved_search_id
  join public.organizations o on o.id = r.org_id
  where r.id = target_run;

  if run.id is null or run.status not in ('completed', 'partial') or run.notified_at is not null then
    return 0;
  end if;
  update public.search_runs set notified_at = now() where id = target_run;
  if not run.deliver_by_email then
    return 0;
  end if;

  select count(*), count(*) filter (where state = 'nueva'), count(*) filter (where state = 'actualizada')
    into reported_count, new_count, updated_count
  from private.unreported_matches(target_run);

  if reported_count = 0 and not run.email_when_empty then
    return 0;
  end if;

  run_url := '/organizations/' || run.slug || '?busqueda=' || run.saved_search_id || '&ejecucion=' || target_run;

  select coalesce(jsonb_agg(item order by position), '[]'::jsonb) into listed
  from (
    select jsonb_build_object(
             'expediente', r.expediente,
             'title', r.title,
             'buyerEntity', r.buyer_entity,
             'relevance', r.relevance,
             'state', r.state,
             'closesAt', to_char(r.closes_at at time zone 'America/Tegucigalpa', 'DD/MM/YYYY HH24:MI'),
             'path', run_url || '&detalle=' || r.process_id
           ) as item,
           row_number() over (
             order by array_position(array['muy_relevante', 'posible'], r.relevance), r.closes_at nulls last, r.expediente
           ) as position
    from private.unreported_matches(target_run) r
  ) ranked
  -- The email lists the first 20; the rest are on the Home.
  where position <= 20;

  title := case
    when reported_count = 0 then 'Sin oportunidades nuevas en «' || run.search_name || '»'
    when updated_count = 0 then
      new_count || case when new_count = 1 then ' oportunidad nueva' else ' oportunidades nuevas' end || ' en «' || run.search_name || '»'
    when new_count = 0 then
      updated_count || case when updated_count = 1 then ' oportunidad actualizada' else ' oportunidades actualizadas' end
        || ' en «' || run.search_name || '»'
    else new_count || case when new_count = 1 then ' nueva' else ' nuevas' end
      || ' y ' || updated_count || case when updated_count = 1 then ' actualizada' else ' actualizadas' end
      || ' en «' || run.search_name || '»'
  end;
  body := 'La ejecución del ' || to_char(run.created_at at time zone 'America/Tegucigalpa', 'DD/MM/YYYY HH24:MI')
    || ' revisó ' || coalesce(run.processes_examined, 0) || ' procesos abiertos'
    || coalesce(' con datos de HonduCompras del ' || to_char(run.source_synced_at at time zone 'America/Tegucigalpa', 'DD/MM/YYYY HH24:MI'), '')
    || case when reported_count = 0 then ' y no encontró oportunidades que no le hayamos enviado antes.' else '.' end;
  report_payload := jsonb_build_object(
    'searchName', run.search_name,
    'total', reported_count,
    'newCount', new_count,
    'updatedCount', updated_count,
    'opportunities', listed,
    'runPath', run_url
  );

  for member_id in select m.user_id from public.organization_members m where m.org_id = run.org_id loop
    perform private.notify(member_id, run.org_id, 'search_run.completed', title, body, run_url,
                           jsonb_build_object('run_id', target_run, 'search_id', run.saved_search_id), dedupe);
    update public.notification_deliveries
    set template = 'search_run_report', payload = report_payload
    where idempotency_key = member_id::text || ':' || dedupe and status = 'pending';
  end loop;

  insert into public.opportunity_notifications (saved_search_id, process_id, org_id, process_version_id, run_id)
  select run.saved_search_id, r.process_id, run.org_id, r.process_version_id, target_run from private.unreported_matches(target_run) r
  on conflict (saved_search_id, process_id) do update
  set process_version_id = excluded.process_version_id, run_id = excluded.run_id, notified_at = now();

  return reported_count;
end;
$$;

revoke execute on function private.notify_search_run(uuid) from public, anon, authenticated;

-- ============================================================
-- Changes to opportunities marked «Me interesa»
-- ============================================================

create function private.tg_notify_opportunity_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  process record;
  summary text;
  target record;
  member_id uuid;
begin
  if new.kind not in ('deadline_changed', 'document_added', 'document_replaced', 'document_removed', 'stage_changed') then
    return null;
  end if;

  select p.expediente, p.title into process from public.procurement_processes p where p.id = new.process_id;
  summary := case new.kind
    when 'deadline_changed' then 'La fecha límite ahora es '
      || coalesce(to_char((new.after ->> 'bidsDueAt')::timestamptz at time zone 'America/Tegucigalpa', 'DD/MM/YYYY HH24:MI'), 'desconocida') || '.'
    when 'document_added' then 'Se publicó un documento: ' || coalesce(new.after ->> 'title', 'sin título') || '.'
    when 'document_replaced' then 'Se reemplazó el documento ' || coalesce(new.after ->> 'title', 'sin título') || '.'
    when 'document_removed' then 'Se retiró el documento ' || coalesce(new.before ->> 'title', 'sin título') || '.'
    when 'stage_changed' then 'La etapa ahora es ' || coalesce(new.after ->> 'stage', 'desconocida') || '.'
  end;

  -- Each organization that marked it «Me interesa», with the latest run of a search that found it and alerts on changes.
  for target in
    select distinct on (f.org_id) f.org_id, o.slug, r.id as run_id, r.saved_search_id
    from public.opportunity_feedback f
    join public.organizations o on o.id = f.org_id
    join public.search_runs r on r.org_id = f.org_id
    join public.search_run_matches m on m.run_id = r.id and m.process_id = f.process_id
    join public.saved_searches s on s.id = r.saved_search_id
    where f.process_id = new.process_id and f.decision = 'interesa' and s.alert_on_changes
    order by f.org_id, r.created_at desc
  loop
    for member_id in select m.user_id from public.organization_members m where m.org_id = target.org_id loop
      perform private.notify(
        member_id, target.org_id, 'opportunity.updated',
        'Cambió «' || process.expediente || '»',
        summary || ' ' || left(process.title, 200),
        '/organizations/' || target.slug || '?busqueda=' || target.saved_search_id || '&ejecucion=' || target.run_id
          || '&detalle=' || new.process_id,
        jsonb_build_object('process_id', new.process_id, 'event_id', new.id),
        'opportunity.updated:' || new.id
      );
    end loop;
  end loop;

  return null;
end;
$$;

create trigger process_events_notify_opportunity_change
after insert on public.process_events
for each row execute function private.tg_notify_opportunity_change();
