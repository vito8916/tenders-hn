-- Lists with followers (plan D7, slice 3; spec 0.4 §5, §7): the organization's extra
-- searches are «listas», and each member chooses which ones to follow. Everyone follows
-- «Recomendadas», which has no rows here. A report email holds, for each member,
-- «Recomendadas» and the lists they follow, with an Excel file of those lists only.
-- Plan limits count lists: «Recomendadas» no longer counts, so 2/5/10 active searches
-- become 1/4/9 lists.

create table public.list_followers (
  saved_search_id uuid not null references public.saved_searches (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (saved_search_id, user_id)
);

create index list_followers_user_idx on public.list_followers using btree (user_id);
create index list_followers_org_idx on public.list_followers using btree (org_id);

grant select, delete on public.list_followers to authenticated;
grant insert (saved_search_id, user_id, org_id) on public.list_followers to authenticated;
grant select, insert, update, delete on public.list_followers to service_role;

alter table public.list_followers enable row level security;

-- Members see who follows each list; each member, viewers included, follows and unfollows only for themselves.
create policy "Members read their organization's followers" on public.list_followers
  for select to authenticated using ((select private.user_org_role(org_id)) is not null);
create policy "Members follow lists" on public.list_followers
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select private.user_org_role(org_id)) is not null
    and exists (
      select 1 from public.saved_searches s
      where s.id = list_followers.saved_search_id and s.org_id = list_followers.org_id and not s.is_default
    )
  );
create policy "Members unfollow lists" on public.list_followers
  for delete to authenticated using (user_id = (select auth.uid()));

-- A member who leaves or is removed stops following the organization's lists.
create function private.tg_unfollow_removed_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.list_followers where org_id = old.org_id and user_id = old.user_id;
  return null;
end;
$$;

create trigger organization_members_unfollow
  after delete on public.organization_members
  for each row execute function private.tg_unfollow_removed_member();

-- Every member follows every list that exists today, so reports keep sending what they sent before.
insert into public.list_followers (saved_search_id, user_id, org_id)
select s.id, m.user_id, s.org_id
from public.saved_searches s
join public.organization_members m on m.org_id = s.org_id
where not s.is_default;

-- ============================================================
-- Plan limits count lists
-- ============================================================

update public.plans set max_active_searches = max_active_searches - 1 where max_active_searches > 0;

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

    -- «Recomendadas» is not a list and does not count.
    if becomes_active and not new.is_default and plan.max_active_searches is not null and (
      select count(*) from public.saved_searches s
      where s.org_id = new.org_id and s.is_active and not s.is_default and s.id <> new.id
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

-- What the organization's plan allows now: whether lists can be written or
-- run, how many lists can be active (besides «Recomendadas»), and how many
-- report times a day.
create or replace function public.saved_search_limits(target_org uuid)
returns table (has_active_plan boolean, max_active_searches integer, active_searches integer, max_daily_reports integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id is not null,
    p.max_active_searches,
    (select count(*) from public.saved_searches s where s.org_id = target_org and s.is_active and not s.is_default)::integer,
    case when p.id is null then 0 else coalesce(p.max_daily_reports, cardinality(private.report_hours())) end
  from (select private.active_plan_id(target_org) as plan_id) active
  left join public.plans p on p.id = active.plan_id
  where private.user_org_role(target_org) is not null;
$$;

-- What stops the organization from moving to a plan now: 'members' (members
-- plus pending invitations over the plan's limit), 'searches' (more active
-- lists), 'report_times' (more report times a day than the plan allows).
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
      select count(*) from public.saved_searches s where s.org_id = target_org and s.is_active and not s.is_default
    ) > p.max_active_searches then 'searches' end,
    case when p.max_daily_reports is not null and (
      select cardinality(r.hours) from public.report_schedules r where r.org_id = target_org
    ) > p.max_daily_reports then 'report_times' end
  ], null)
  from public.plans p
  where p.id = target_plan
    and private.user_org_role(target_org) is not null;
$$;

-- ============================================================
-- Each member's report
-- ============================================================

comment on column public.org_reports.excel_path is
  'Folder of the report''s Excel files in the reports bucket, <org_id>/reports/<report_id>: one <user_id>.xlsx per member with «Recomendadas» and the lists they follow.';

-- The report's runs whose search a member receives: «Recomendadas» and the lists they follow.
create function private.member_report_runs(target_report uuid, member_id uuid)
returns setof public.search_runs
language sql
stable
security definer
set search_path = ''
as $$
  select run.*
  from public.search_runs run
  join public.saved_searches s on s.id = run.saved_search_id
  where run.report_id = target_report
    and run.status in ('completed', 'partial')
    and (s.is_default or exists (
      select 1 from public.list_followers f where f.saved_search_id = s.id and f.user_id = member_id
    ));
$$;

revoke execute on function private.member_report_runs(uuid, uuid) from public, anon, authenticated;

create or replace function private.notify_org_report(target_report uuid)
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
  excel_path text;
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

  -- Each member receives «Recomendadas» and the lists they follow.
  for member_id in select m.user_id from public.organization_members m where m.org_id = report.org_id loop
    select count(*), count(*) filter (where u.state = 'nueva'), count(*) filter (where u.state = 'actualizada')
      into reported_count, new_count, updated_count
    from private.member_report_runs(target_report, member_id) run
    cross join lateral private.unreported_matches(run.id) u;

    if reported_count = 0 and not report.email_when_empty then
      continue;
    end if;

    select coalesce(sum(run.processes_examined), 0), max(run.source_synced_at) into examined, synced_at
    from private.member_report_runs(target_report, member_id) run;
    -- The member's Excel file, when the worker rendered one (it renders one for each member with a finished run).
    excel_path := report.excel_path || '/' || member_id || '.xlsx';
    if not exists (select 1 from storage.objects o where o.bucket_id = 'reports' and o.name = excel_path) then
      excel_path := null;
    end if;

    -- Each list with what it found, up to 20 opportunities over the whole email; the rest are in the Excel file.
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
      from private.member_report_runs(target_report, member_id) run
      join public.saved_searches s on s.id = run.saved_search_id
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
      'excelPath', excel_path,
      'excelName', 'licitaly-reporte-' || to_char(report.created_at at time zone 'America/Tegucigalpa', 'YYYY-MM-DD-HH24MI') || '.xlsx'
    );

    perform private.notify(member_id, report.org_id, 'search_run.completed', title, body, home_url,
                           jsonb_build_object('report_id', target_report), dedupe);
    update public.notification_deliveries
    set template = 'org_report', payload = report_payload
    where idempotency_key = member_id::text || ':' || dedupe and status = 'pending';
  end loop;

  -- What the report found is reported for the organization, whoever follows each list.
  select count(*) into reported_count
  from public.search_runs run
  cross join lateral private.unreported_matches(run.id) u
  where run.report_id = target_report and run.status in ('completed', 'partial');

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
