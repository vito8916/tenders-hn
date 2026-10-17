-- Links to a run's results point to its page, /organizations/<org>/updates/<run> (plan D7, slice 1):
-- the report email's opportunities and the «Cambió …» notification used the Home's
-- ?busqueda=&ejecucion= query, which the Home still redirects for links already sent.

CREATE OR REPLACE FUNCTION private.notify_org_report(target_report uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
                            'path', home_url || '/updates/' || run.id || '?detalle=' || u.process_id
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
$function$

;

CREATE OR REPLACE FUNCTION private.tg_notify_opportunity_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
        '/organizations/' || target.slug || '/updates/' || target.run_id
          || '?detalle=' || new.process_id,
        jsonb_build_object('process_id', new.process_id, 'event_id', new.id),
        'opportunity.updated:' || new.id
      );
    end loop;
  end loop;

  return null;
end;
$function$

;
