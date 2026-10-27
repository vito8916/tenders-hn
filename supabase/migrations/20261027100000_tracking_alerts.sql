-- More alerts (plan D7, slice 4; spec 0.4 §5, §7): reminders before a tracked opportunity
-- closes, and an alert to whoever is made its assignee. Both use the plain email (title,
-- body, button) and can be turned off in Configuración › Notificaciones.

insert into public.notification_types (id, label, category, description, default_in_app, default_email) values
  ('opportunity.closing_soon', 'Cierres próximos', 'searches', 'Una oportunidad en evaluación o preparando oferta cierra en 3 días o mañana.', true, true),
  ('opportunity.assigned', 'Asignaciones', 'searches', 'Le asignaron una oportunidad.', true, true);

-- The assignee hears about it, unless they assigned it to themselves.
create function private.tg_notify_opportunity_assigned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  process record;
  org_slug text;
begin
  if new.assigned_to is null
    or (tg_op = 'UPDATE' and new.assigned_to is not distinct from old.assigned_to)
    or new.assigned_to = auth.uid() then
    return null;
  end if;

  select p.expediente, p.title, p.closes_at into process from public.procurement_processes p where p.id = new.process_id;
  select o.slug into org_slug from public.organizations o where o.id = new.org_id;

  perform private.notify(
    new.assigned_to, new.org_id, 'opportunity.assigned',
    'Le asignaron «' || process.expediente || '»',
    coalesce(private.display_name(auth.uid()), 'Alguien') || ' le asignó esta oportunidad. '
      || coalesce('Cierra el ' || to_char(process.closes_at at time zone 'America/Tegucigalpa', 'DD/MM/YYYY "a las" HH24:MI') || '. ', '')
      || left(process.title, 200),
    '/organizations/' || org_slug || '/opportunities/tracking?detalle=' || new.process_id,
    jsonb_build_object('process_id', new.process_id)
  );
  return null;
end;
$$;

create trigger opportunity_tracking_notify_assigned
  after insert or update of assigned_to on public.opportunity_tracking
  for each row execute function private.tg_notify_opportunity_assigned();

-- Each morning, opportunities «En evaluación» or «Preparando oferta» that close in 3 days or
-- tomorrow (Honduras dates) remind their assignee or, without one, every member but viewers.
-- The deadline is the process's current one; an extension that moves it reminds again.
create function private.remind_closing_opportunities()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'America/Tegucigalpa')::date;
  target record;
  member_id uuid;
  reminded integer := 0;
begin
  for target in
    select t.org_id, t.process_id, t.assigned_to, t.status, o.slug, p.expediente, p.title, p.closes_at,
      (p.closes_at at time zone 'America/Tegucigalpa')::date - today as days_left
    from public.opportunity_tracking t
    join public.procurement_processes p on p.id = t.process_id
    join public.organizations o on o.id = t.org_id
    where t.status in ('en_evaluacion', 'preparando_oferta')
      and p.closes_at > now()
      and (p.closes_at at time zone 'America/Tegucigalpa')::date - today in (1, 3)
  loop
    for member_id in
      select m.user_id from public.organization_members m
      where m.org_id = target.org_id
        and case when target.assigned_to is null then m.role <> 'viewer' else m.user_id = target.assigned_to end
    loop
      perform private.notify(
        member_id, target.org_id, 'opportunity.closing_soon',
        case target.days_left when 1 then 'Cierra mañana: «' else 'Cierra en 3 días: «' end || target.expediente || '»',
        'La fecha límite es el ' || to_char(target.closes_at at time zone 'America/Tegucigalpa', 'DD/MM/YYYY "a las" HH24:MI')
          || ' y está «' || case target.status when 'en_evaluacion' then 'En evaluación' else 'Preparando oferta' end || '». '
          || left(target.title, 200),
        '/organizations/' || target.slug || '/opportunities/tracking?detalle=' || target.process_id,
        jsonb_build_object('process_id', target.process_id, 'closes_at', target.closes_at),
        'opportunity.closing_soon:' || target.org_id || ':' || target.process_id || ':'
          || extract(epoch from target.closes_at)::bigint || ':' || target.days_left
      );
      reminded := reminded + 1;
    end loop;
  end loop;
  return reminded;
end;
$$;

-- 07:00 in Honduras.
select cron.schedule('remind-closing-opportunities', '0 13 * * *', 'select private.remind_closing_opportunities()');
