-- Tracking (plan D7, slice 2; spec 0.4 §5): «Me interesa» / «No me interesa» become one
-- status per organization and process, from a fixed set, with an assignee and, when
-- discarded, an optional reason. No row means «Nueva». The team's notes go in
-- opportunity_notes, kept when the opportunity goes back to «Nueva». Status changes go to
-- the activity log, and change alerts follow every tracked opportunity but the discarded ones.

alter table public.opportunity_feedback rename to opportunity_tracking;
alter table public.opportunity_tracking rename column decision to status;
alter table public.opportunity_tracking rename column reason to discard_reason;
alter table public.opportunity_tracking rename column decided_by to updated_by;
alter table public.opportunity_tracking rename column decided_at to updated_at;

alter table public.opportunity_tracking drop constraint opportunity_feedback_decision_check;
update public.opportunity_tracking
set status = case status when 'interesa' then 'en_evaluacion' when 'no_interesa' then 'descartada' else status end;
alter table public.opportunity_tracking add constraint opportunity_tracking_status_check
  check (status in ('en_evaluacion', 'preparando_oferta', 'presentada', 'ganada', 'perdida', 'descartada'));

alter table public.opportunity_tracking rename constraint opportunity_feedback_reason_check to opportunity_tracking_discard_reason_check;
alter table public.opportunity_tracking rename constraint opportunity_feedback_pkey to opportunity_tracking_pkey;
alter table public.opportunity_tracking rename constraint opportunity_feedback_org_id_fkey to opportunity_tracking_org_id_fkey;
alter table public.opportunity_tracking rename constraint opportunity_feedback_process_id_fkey to opportunity_tracking_process_id_fkey;
alter table public.opportunity_tracking rename constraint opportunity_feedback_decided_by_fkey to opportunity_tracking_updated_by_fkey;
alter index public.opportunity_feedback_process_idx rename to opportunity_tracking_process_idx;
alter index public.opportunity_feedback_decided_by_idx rename to opportunity_tracking_updated_by_idx;

alter table public.opportunity_tracking add column assigned_to uuid constraint opportunity_tracking_assigned_to_fkey references auth.users (id) on delete set null;
create index opportunity_tracking_assigned_to_idx on public.opportunity_tracking using btree (assigned_to);

-- The assignee is a member of the organization who can act on it (not a viewer).
drop policy "Members read their organization's feedback" on public.opportunity_tracking;
drop policy "Members other than viewers decide" on public.opportunity_tracking;
drop policy "Members other than viewers change a decision" on public.opportunity_tracking;
drop policy "Members other than viewers clear a decision" on public.opportunity_tracking;

create policy "Members read their organization's tracking" on public.opportunity_tracking
  for select to authenticated using ((select private.user_org_role(org_id)) is not null);
create policy "Members other than viewers track" on public.opportunity_tracking
  for insert to authenticated
  with check (
    (select private.user_org_role(org_id)) in ('owner', 'admin', 'member')
    and updated_by = (select auth.uid())
    and (assigned_to is null or exists (
      select 1 from public.organization_members m where m.org_id = opportunity_tracking.org_id and m.user_id = assigned_to and m.role <> 'viewer'
    ))
  );
create policy "Members other than viewers change tracking" on public.opportunity_tracking
  for update to authenticated
  using ((select private.user_org_role(org_id)) in ('owner', 'admin', 'member'))
  with check (
    (select private.user_org_role(org_id)) in ('owner', 'admin', 'member')
    and updated_by = (select auth.uid())
    and (assigned_to is null or exists (
      select 1 from public.organization_members m where m.org_id = opportunity_tracking.org_id and m.user_id = assigned_to and m.role <> 'viewer'
    ))
  );
create policy "Members other than viewers clear tracking" on public.opportunity_tracking
  for delete to authenticated using ((select private.user_org_role(org_id)) in ('owner', 'admin', 'member'));

-- A member who leaves, is removed, or becomes a viewer stops being anyone's assignee.
create function private.tg_unassign_removed_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.role <> 'viewer' then
    return null;
  end if;
  update public.opportunity_tracking set assigned_to = null where org_id = old.org_id and assigned_to = old.user_id;
  return null;
end;
$$;

create trigger organization_members_unassign
  after delete or update of role on public.organization_members
  for each row when (old.role <> 'viewer')
  execute function private.tg_unassign_removed_member();

-- Status changes, including back to «Nueva» (the row deleted), in the activity log.
create function private.tg_opportunity_tracking_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tracking public.opportunity_tracking := case when tg_op = 'DELETE' then old else new end;
  status_from text := case when tg_op = 'INSERT' then 'nueva' else old.status end;
  status_to text := case when tg_op = 'DELETE' then 'nueva' else new.status end;
begin
  if status_from = status_to then
    return null;
  end if;

  insert into public.app_events (event_name, org_id, user_id, metadata)
  select 'opportunity.status_changed', tracking.org_id, auth.uid(),
    jsonb_build_object('process_id', tracking.process_id, 'expediente', p.expediente, 'status_from', status_from, 'status_to', status_to)
  from public.procurement_processes p
  where p.id = tracking.process_id;
  return null;
end;
$$;

create trigger opportunity_tracking_log
  after insert or delete or update of status on public.opportunity_tracking
  for each row execute function private.tg_opportunity_tracking_log();

-- The team's notes on an opportunity, with author and date. Members read them; members
-- other than viewers write their own and delete their own, and owners and admins any.
create table public.opportunity_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  process_id uuid not null references public.procurement_processes (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  body text not null constraint opportunity_notes_body_check check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index opportunity_notes_org_process_idx on public.opportunity_notes using btree (org_id, process_id, created_at);
create index opportunity_notes_process_idx on public.opportunity_notes using btree (process_id);
create index opportunity_notes_author_idx on public.opportunity_notes using btree (author_id);

grant select, delete on public.opportunity_notes to authenticated;
grant insert (org_id, process_id, author_id, body) on public.opportunity_notes to authenticated;
grant select, insert, update, delete on public.opportunity_notes to service_role;

alter table public.opportunity_notes enable row level security;

create policy "Members read their organization's notes" on public.opportunity_notes
  for select to authenticated using ((select private.user_org_role(org_id)) is not null);
create policy "Members other than viewers write notes" on public.opportunity_notes
  for insert to authenticated
  with check ((select private.user_org_role(org_id)) in ('owner', 'admin', 'member') and author_id = (select auth.uid()));
create policy "Authors, owners, and admins delete notes" on public.opportunity_notes
  for delete to authenticated
  using (
    ((select private.user_org_role(org_id)) in ('owner', 'admin', 'member') and author_id = (select auth.uid()))
    or (select private.user_org_role(org_id)) in ('owner', 'admin')
  );

-- «En seguimiento» keeps an opportunity after its process closes, when the latest runs no
-- longer have it: the most recent finished run of the organization that found each process.
create function public.latest_process_matches(target_org uuid, target_processes uuid[])
returns table (run_id uuid, saved_search_id uuid, process_id uuid)
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct on (m.process_id) m.run_id, r.saved_search_id, m.process_id
  from public.search_run_matches m
  join public.search_runs r on r.id = m.run_id
  where m.org_id = target_org and m.process_id = any (target_processes) and r.status in ('completed', 'partial')
  order by m.process_id, r.created_at desc
$$;

revoke execute on function public.latest_process_matches(uuid, uuid[]) from public, anon;
grant execute on function public.latest_process_matches(uuid, uuid[]) to authenticated;

-- Change alerts follow every tracked opportunity but the discarded ones.
update public.notification_types
set description = 'Cambió una oportunidad en seguimiento.'
where id = 'opportunity.updated';

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

  -- Each organization tracking it (any status but descartada), with the latest run of a search that found it and alerts on changes.
  for target in
    select distinct on (t.org_id) t.org_id, o.slug, r.id as run_id, r.saved_search_id
    from public.opportunity_tracking t
    join public.organizations o on o.id = t.org_id
    join public.search_runs r on r.org_id = t.org_id
    join public.search_run_matches m on m.run_id = r.id and m.process_id = t.process_id
    join public.saved_searches s on s.id = r.saved_search_id
    where t.process_id = new.process_id and t.status <> 'descartada' and s.alert_on_changes
    order by t.org_id, r.created_at desc
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
$function$;
