-- «Recomendadas», every organization's default search (plan §6.1 D6).
--
-- A new organization used to land on an empty Home after onboarding: the
-- company profile was saved, but no search existed until someone created one.
-- Now each organization has one default search that follows the company
-- profile. It cannot be deleted, paused, renamed, or given its own
-- description. Its first run (trigger 'first') starts as soon as the
-- organization has both an active plan and a company profile, whichever
-- comes last, so the first visit to the Home shows results being prepared.

alter table public.saved_searches add column is_default boolean not null default false;

create unique index saved_searches_one_default_idx on public.saved_searches using btree (org_id) where is_default;

alter table public.search_runs drop constraint search_runs_trigger_check;
alter table public.search_runs add constraint search_runs_trigger_check
  check (trigger in ('schedule', 'manual', 'first'));

-- ============================================================
-- Plan checks skip the default search
-- ============================================================

-- Same as before, except that creating the default search skips the plan
-- checks: it is created by the system (users cannot set is_default), counts
-- toward the plan's searches afterwards, and must exist even when the
-- organization is already at its limit.
create or replace function private.tg_saved_searches_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan public.plans%rowtype;
  becomes_active boolean := new.is_active and (tg_op = 'INSERT' or not old.is_active);
  schedule_changed boolean := tg_op = 'INSERT' or new.schedule is distinct from old.schedule;
  creates_default boolean := tg_op = 'INSERT' and new.is_default;
begin
  perform private.lock_org(new.org_id, 'searches');

  if not creates_default then
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

-- ============================================================
-- The default search stays as it is
-- ============================================================

-- Keywords, exclusions, filters, and delivery can change; what makes it the
-- organization's default cannot. Deleting it is refused unless the
-- organization itself is being deleted.
create function private.tg_default_search_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_default and exists (select 1 from public.organizations o where o.id = old.org_id) then
      raise exception 'default_search_locked';
    end if;
    return old;
  end if;

  if old.is_default and (
    not new.is_default or not new.is_active or not new.inherits_profile or new.name is distinct from old.name
  ) then
    raise exception 'default_search_locked';
  end if;
  return new;
end;
$$;

create trigger saved_searches_default_guard
  before update or delete on public.saved_searches
  for each row execute function private.tg_default_search_guard();

-- Deleting an organization deletes its searches, and the change log then
-- pointed at an organization that no longer exists, so the deletion failed
-- for any organization with a search (every one, now that each has
-- «Recomendadas»). A search deleted with its organization is not logged.
create or replace function private.tg_saved_searches_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  search public.saved_searches := case when tg_op = 'DELETE' then old else new end;
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.organizations o where o.id = search.org_id) then
    return null;
  end if;

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

-- ============================================================
-- Creating it and its first run
-- ============================================================

-- The organization's default search, created when missing.
create function private.ensure_default_search(target_org uuid)
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

  insert into public.saved_searches (org_id, name, is_default, inherits_profile, schedule, created_by)
  select o.id, 'Recomendadas', true, true, 'daily', o.owner_id
  from public.organizations o
  where o.id = target_org
  returning id into default_id;

  return default_id;
end;
$$;

revoke execute on function private.ensure_default_search(uuid) from public, anon, authenticated;

-- Starts the default search's first run once the organization has an active
-- plan and a company profile, and has never run a search. Safe to call
-- repeatedly: it does nothing once any run exists.
create function private.start_first_run(target_org uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  default_id uuid;
begin
  if private.active_plan_id(target_org) is null
     or not exists (select 1 from public.company_profiles where org_id = target_org)
     or exists (select 1 from public.search_runs where org_id = target_org) then
    return null;
  end if;

  default_id := private.ensure_default_search(target_org);
  return private.create_search_run(default_id, 'first', null);
exception when raise_exception then
  if sqlerrm in ('no_profile', 'run_in_progress') then
    return null;
  end if;
  raise;
end;
$$;

revoke execute on function private.start_first_run(uuid) from public, anon, authenticated;

create function private.tg_subscription_start_first_run()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    perform private.ensure_default_search(new.org_id);
    perform private.start_first_run(new.org_id);
  end if;
  return null;
end;
$$;

create trigger organization_subscriptions_start_first_run
  after insert or update of status on public.organization_subscriptions
  for each row execute function private.tg_subscription_start_first_run();

-- A profile saved after the plan was activated starts the first run too.
create function private.tg_company_profile_start_first_run()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.start_first_run(new.org_id);
  return null;
end;
$$;

create trigger company_profiles_start_first_run
  after insert on public.company_profiles
  for each row execute function private.tg_company_profile_start_first_run();

-- ============================================================
-- Existing organizations
-- ============================================================

-- The oldest active search that follows the profile becomes «Recomendadas»
-- (the backfilled «Perfil de la empresa» search, where there is one);
-- organizations without one get a new default search. Written as the
-- migration owner, outside the plan checks and the change log.
alter table public.saved_searches disable trigger saved_searches_before_write;
alter table public.saved_searches disable trigger saved_searches_log;

update public.saved_searches s
set is_default = true,
    name = case
      when exists (
        select 1 from public.saved_searches other
        where other.org_id = s.org_id and other.id <> s.id and lower(other.name) = 'recomendadas'
      ) then s.name
      else 'Recomendadas'
    end
where s.id in (
  select distinct on (org_id) id
  from public.saved_searches
  where inherits_profile and is_active
  order by org_id, created_at, id
);

insert into public.saved_searches (org_id, name, is_default, inherits_profile, schedule, created_by)
select o.id,
       case when exists (
         select 1 from public.saved_searches other where other.org_id = o.id and lower(other.name) = 'recomendadas'
       ) then 'Recomendadas (perfil)' else 'Recomendadas' end,
       true, true, 'daily', o.owner_id
from public.organizations o
where not exists (select 1 from public.saved_searches s where s.org_id = o.id and s.is_default);

alter table public.saved_searches enable trigger saved_searches_before_write;
alter table public.saved_searches enable trigger saved_searches_log;

-- Due times for the new daily searches (the trigger that keeps them was off).
update public.saved_searches
set next_run_at = private.next_search_run_at(schedule, now())
where is_default and is_active and schedule <> 'manual' and next_run_at is null;
