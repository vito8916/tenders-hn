-- Phase 4: saved searches and their runs (spec §5, §7, §9, §12.1; plan §7.2, §7.4).
--
--   saved_searches   what an organization looks for: the company profile or a
--                    description of its own, extra keywords and exclusions,
--                    filters by institution, modality, and acquisition type,
--                    a schedule, and delivery preferences.
--   search_runs      now belong to a search, at most one in flight per search,
--                    and record the ingestion they used.
--
-- Owners and admins write saved_searches directly (RLS); a trigger enforces
-- the plan (active plan, max_active_searches, min_schedule_interval), tidies
-- the lists, and keeps next_run_at. Any member runs a search now through
-- request_search_run; pg_cron queues the searches that are due. Delivery
-- preferences are stored here; the emails come with the report (plan, Phase 4).

-- ============================================================
-- Schedules
-- ============================================================

-- Hours of the day (Honduras time) when a schedule runs. They sit a while
-- after the 3-hourly syncs (06:00, 09:00, 12:00, 15:00 in Honduras), so each
-- run reads a fresh ingestion. 'manual' runs only on request.
create function private.search_schedule_hours(schedule text)
returns integer[]
language sql
immutable
set search_path = ''
as $$
  select case schedule
    when 'daily' then array[7]
    when 'twice_daily' then array[7, 13]
    when 'four_times_daily' then array[7, 10, 13, 16]
  end;
$$;

-- The schedule's frequency as the plan limit reads it: a day divided by its
-- runs per day, so twice a day counts as every 12 hours. Null for 'manual'.
create function private.search_schedule_interval(schedule text)
returns interval
language sql
immutable
set search_path = ''
as $$
  select interval '1 day' / cardinality(private.search_schedule_hours(schedule));
$$;

-- The first scheduled time after a moment, or null for 'manual'.
create function private.next_search_run_at(schedule text, after timestamptz)
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
    cross join unnest(private.search_schedule_hours(schedule)) as hour
  ) slots
  where slot > after;
$$;

-- ============================================================
-- Saved searches
-- ============================================================

create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null constraint saved_searches_name_check check (length(btrim(name)) between 1 and 80),
  -- True: the search uses the company profile. False: it uses its own description.
  inherits_profile boolean not null default true,
  description text,
  keywords text[] not null default '{}',
  exclusions text[] not null default '{}',
  -- Filters on the process; empty means any.
  entities text[] not null default '{}',
  modalities text[] not null default '{}',
  acquisition_types text[] not null default '{}',
  schedule text not null default 'daily' constraint saved_searches_schedule_check
    check (schedule in ('manual', 'daily', 'twice_daily', 'four_times_daily')),
  -- Null when the search is paused or runs only on request.
  next_run_at timestamptz,
  deliver_by_email boolean not null default true,
  email_when_empty boolean not null default false,
  alert_on_changes boolean not null default true,
  is_active boolean not null default true,
  -- Lines of business the worker extracts from description (worker/src/matching/profile.ts);
  -- cleared when the description changes.
  extracted_profile jsonb,
  extraction_version text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint saved_searches_description_check check (
    inherits_profile or length(btrim(coalesce(description, ''))) > 0
  )
);

create unique index saved_searches_org_name_key on public.saved_searches using btree (org_id, lower(name));
create index saved_searches_due_idx on public.saved_searches using btree (next_run_at) where next_run_at is not null;

-- Enforces the plan and tidies the row on every write from the app. The
-- worker's and scheduler's columns (extraction, next_run_at) are not in the
-- trigger's column list, so their updates skip it.
create function private.tg_saved_searches_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan public.plans%rowtype;
  becomes_active boolean := new.is_active and (tg_op = 'INSERT' or not old.is_active);
  schedule_changed boolean := tg_op = 'INSERT' or new.schedule is distinct from old.schedule;
begin
  perform private.lock_org(new.org_id, 'searches');

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

  if schedule_changed and new.schedule <> 'manual' and plan.min_schedule_interval is not null
     and private.search_schedule_interval(new.schedule) < plan.min_schedule_interval then
    raise exception 'schedule_interval_not_allowed';
  end if;

  new.name := btrim(new.name);
  new.description := nullif(btrim(coalesce(new.description, '')), '');
  new.keywords := private.clean_text_list(new.keywords);
  new.exclusions := private.clean_text_list(new.exclusions);
  new.entities := private.clean_text_list(new.entities);
  new.modalities := private.clean_text_list(new.modalities);
  new.acquisition_types := private.clean_text_list(new.acquisition_types);

  if not new.is_active or new.schedule = 'manual' then
    new.next_run_at := null;
  elsif becomes_active or schedule_changed then
    new.next_run_at := private.next_search_run_at(new.schedule, now());
  end if;

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
    acquisition_types, schedule, deliver_by_email, email_when_empty, alert_on_changes, is_active
  on public.saved_searches
  for each row execute function private.tg_saved_searches_before_write();

create function private.tg_saved_searches_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  search public.saved_searches := case when tg_op = 'DELETE' then old else new end;
begin
  insert into public.app_events (event_name, org_id, user_id, metadata)
  values (
    'saved_search.' || case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end,
    search.org_id,
    auth.uid(),
    jsonb_build_object('search_id', search.id, 'name', search.name)
  );
  return null;
end;
$$;

create trigger saved_searches_log
  after insert or delete or update of name, inherits_profile, description, keywords, exclusions, entities, modalities,
    acquisition_types, schedule, deliver_by_email, email_when_empty, alert_on_changes, is_active
  on public.saved_searches
  for each row execute function private.tg_saved_searches_log();

grant select, delete on public.saved_searches to authenticated;
grant insert (org_id, name, inherits_profile, description, keywords, exclusions, entities, modalities, acquisition_types,
              schedule, deliver_by_email, email_when_empty, alert_on_changes, is_active)
  on public.saved_searches to authenticated;
grant update (name, inherits_profile, description, keywords, exclusions, entities, modalities, acquisition_types,
              schedule, deliver_by_email, email_when_empty, alert_on_changes, is_active)
  on public.saved_searches to authenticated;
grant select, insert, update, delete on public.saved_searches to service_role;

alter table public.saved_searches enable row level security;

create policy "Members read their organization's searches" on public.saved_searches
  for select to authenticated using (private.user_org_role(org_id) is not null);
create policy "Owners and admins create searches" on public.saved_searches
  for insert to authenticated with check (private.user_org_role(org_id) in ('owner', 'admin'));
create policy "Owners and admins update searches" on public.saved_searches
  for update to authenticated
  using (private.user_org_role(org_id) in ('owner', 'admin'))
  with check (private.user_org_role(org_id) in ('owner', 'admin'));
create policy "Owners and admins delete searches" on public.saved_searches
  for delete to authenticated using (private.user_org_role(org_id) in ('owner', 'admin'));

-- ============================================================
-- Runs belong to a search
-- ============================================================

alter table public.search_runs
  add column saved_search_id uuid references public.saved_searches (id) on delete cascade,
  -- The latest complete ingestion when the run was requested (spec §12.1).
  add column sync_run_id bigint references public.source_sync_runs (id) on delete set null,
  add column source_synced_at timestamptz,
  -- Open processes the run considered after the search's filters.
  add column processes_examined integer,
  -- Null when the search does not inherit the company profile.
  alter column profile_version drop not null;

-- Runs from the internal inbox used the company profile: they become the
-- runs of a search that inherits it. It is created as the organization
-- owner, outside the plan checks, since those runs already happened.
alter table public.saved_searches disable trigger saved_searches_before_write;
alter table public.saved_searches disable trigger saved_searches_log;
insert into public.saved_searches (org_id, name, schedule, created_by)
select o.id, 'Perfil de la empresa', 'manual', o.owner_id
from public.organizations o
where exists (select 1 from public.search_runs r where r.org_id = o.id);
alter table public.saved_searches enable trigger saved_searches_before_write;
alter table public.saved_searches enable trigger saved_searches_log;

update public.search_runs r
set saved_search_id = s.id
from public.saved_searches s
where s.org_id = r.org_id;

alter table public.search_runs alter column saved_search_id set not null;

drop index public.search_runs_one_active_idx;
-- One run in flight per search, so «Ejecutar ahora» cannot double-start (spec §12.1).
create unique index search_runs_one_active_idx on public.search_runs using btree (saved_search_id)
  where status in ('queued', 'running');
create index search_runs_search_created_idx on public.search_runs using btree (saved_search_id, created_at desc);

-- Creates a run of a search with its criteria frozen in config_snapshot and
-- queues it. Raises no_profile when the search inherits a profile that does
-- not exist and run_in_progress when the search already has one in flight.
create function private.create_search_run(target_search uuid, run_trigger text, requested_by uuid)
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
    insert into public.search_runs (org_id, saved_search_id, trigger, profile_version, sync_run_id, source_synced_at, config_snapshot, created_by)
    values (
      search.org_id, search.id, run_trigger, used_profile_version, latest_sync.id, latest_sync.finished_at,
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

drop function public.request_search_run(uuid);

-- «Ejecutar ahora»: any member runs an active search while the organization
-- has an active plan. Raises search_not_found, search_inactive,
-- subscription_inactive, no_profile, or run_in_progress.
create function public.request_search_run(target_search uuid)
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

revoke execute on function public.request_search_run(uuid) from public, anon;
grant execute on function public.request_search_run(uuid) to authenticated;

-- Queues a run for every active search that is due and moves it to its next
-- time. Organizations without an active plan and searches that inherit a
-- missing profile are skipped until their next time; a search whose previous
-- run is still in flight waits for the next one.
create function private.enqueue_due_searches()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  search record;
  queued integer := 0;
begin
  for search in
    update public.saved_searches s
    set next_run_at = private.next_search_run_at(s.schedule, now())
    where s.id in (
      select id from public.saved_searches
      where next_run_at <= now()
      order by next_run_at
      limit 200
      for update skip locked
    )
    returning s.id, s.org_id
  loop
    continue when private.active_plan_id(search.org_id) is null;
    begin
      perform private.create_search_run(search.id, 'schedule', null);
      queued := queued + 1;
    exception when raise_exception then
      if sqlerrm not in ('no_profile', 'run_in_progress') then
        raise;
      end if;
    end;
  end loop;
  return queued;
end;
$$;

select cron.schedule('enqueue-due-searches', '*/5 * * * *', 'select private.enqueue_due_searches()');

-- ============================================================
-- Filter options
-- ============================================================

-- Institutions, modalities, and acquisition types a search can filter by,
-- with how many open processes each has now.
create function public.search_filter_options()
returns table (kind text, value text, open_processes integer)
language sql
stable
set search_path = ''
as $$
  select facet.kind, facet.value, count(*) filter (where p.closes_at is null or p.closes_at > now())::integer
  from public.procurement_processes p
  cross join lateral (
    values ('entity', p.buyer_entity), ('modality', p.modality), ('acquisition_type', p.acquisition_type)
  ) as facet (kind, value)
  where facet.value is not null and btrim(facet.value) <> ''
  group by facet.kind, facet.value
  order by facet.kind, facet.value;
$$;

revoke execute on function public.search_filter_options() from public, anon;
grant execute on function public.search_filter_options() to authenticated;

-- ============================================================
-- Limits for the search form
-- ============================================================

-- What the organization's plan allows now: whether searches can be written
-- or run, how many can be active, and which schedules are within the plan.
create function public.saved_search_limits(target_org uuid)
returns table (has_active_plan boolean, max_active_searches integer, active_searches integer, allowed_schedules text[])
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id is not null,
    p.max_active_searches,
    (select count(*) from public.saved_searches s where s.org_id = target_org and s.is_active)::integer,
    array(
      select schedule
      from unnest(array['manual', 'daily', 'twice_daily', 'four_times_daily']) with ordinality as t (schedule, position)
      where p.id is not null
        and (schedule = 'manual' or p.min_schedule_interval is null
             or private.search_schedule_interval(schedule) >= p.min_schedule_interval)
      order by position
    )
  from (select private.active_plan_id(target_org) as plan_id) active
  left join public.plans p on p.id = active.plan_id
  where private.user_org_role(target_org) is not null;
$$;

revoke execute on function public.saved_search_limits(uuid) from public, anon;
grant execute on function public.saved_search_limits(uuid) to authenticated;
