-- Phase 4: the company profile customers edit in onboarding and settings
-- (spec §5, plan §7.2).
--
--   company_profiles          gains concrete offerings, exclusions, and the
--                             departments where the company works.
--   company_profile_versions  an immutable copy of every version, so a run
--                             can be read against exactly what it evaluated.
--
-- Owners and admins save the profile through save_company_profile; it needs
-- no active plan, because onboarding saves it before any plan exists.
-- request_search_run no longer takes the description: runs use the saved
-- profile. match_exclusions finds the exclusions a process's object matches,
-- the verifiable exclusions of spec §5.

alter table public.company_profiles
  add column offerings text[] not null default '{}',
  add column exclusions text[] not null default '{}',
  -- Departments of Honduras where the company delivers or works; empty means the whole country.
  add column locations text[] not null default '{}'
    constraint company_profiles_locations_check check (locations <@ array[
      'Atlántida', 'Choluteca', 'Colón', 'Comayagua', 'Copán', 'Cortés', 'El Paraíso', 'Francisco Morazán',
      'Gracias a Dios', 'Intibucá', 'Islas de la Bahía', 'La Paz', 'Lempira', 'Ocotepeque', 'Olancho',
      'Santa Bárbara', 'Valle', 'Yoro'
    ]::text[]);

create table public.company_profile_versions (
  org_id uuid not null references public.organizations (id) on delete cascade,
  version integer not null,
  description text not null,
  offerings text[] not null,
  exclusions text[] not null,
  locations text[] not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (org_id, version)
);

-- Earlier versions were not kept; the current one is the first on record.
insert into public.company_profile_versions (org_id, version, description, offerings, exclusions, locations, created_by, created_at)
select org_id, version, description, offerings, exclusions, locations, updated_by, updated_at
from public.company_profiles;

grant select on public.company_profile_versions to authenticated;
grant select, insert, update, delete on public.company_profile_versions to service_role;

alter table public.company_profile_versions enable row level security;

create policy "Members read their organization's profile versions" on public.company_profile_versions
  for select to authenticated using (private.user_org_role(org_id) is not null);

-- ============================================================
-- Saving the profile
-- ============================================================

-- Trims each item, drops blank ones, and removes repeats ignoring case, keeping the first.
create function private.clean_text_list(items text[])
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(item order by position), '{}')
  from (
    select distinct on (lower(btrim(t.item))) btrim(t.item) as item, t.position
    from unnest(items) with ordinality as t (item, position)
    where btrim(coalesce(t.item, '')) <> ''
    order by lower(btrim(t.item)), t.position
  ) cleaned;
$$;

-- Saves the organization's profile and returns its version. A change to any
-- field is a new version; a change to the description or the offerings, which
-- the worker reads to extract the lines of business, also clears the
-- extraction so the next run extracts again.
create function public.save_company_profile(
  target_org uuid,
  profile_description text,
  profile_offerings text[] default '{}',
  profile_exclusions text[] default '{}',
  profile_locations text[] default '{}'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  changed_version integer;
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;
  if coalesce(private.user_org_role(target_org), '') not in ('owner', 'admin') then
    raise exception 'insufficient_role';
  end if;
  if length(btrim(coalesce(profile_description, ''))) = 0 then
    raise exception 'empty_profile';
  end if;

  insert into public.company_profiles as p (org_id, description, offerings, exclusions, locations, updated_by)
  values (
    target_org,
    btrim(profile_description),
    private.clean_text_list(profile_offerings),
    private.clean_text_list(profile_exclusions),
    private.clean_text_list(profile_locations),
    current_user_id
  )
  on conflict (org_id) do update
    set description = excluded.description,
        offerings = excluded.offerings,
        exclusions = excluded.exclusions,
        locations = excluded.locations,
        extracted_profile = case when (p.description, p.offerings) is distinct from (excluded.description, excluded.offerings)
                                 then null else p.extracted_profile end,
        extraction_version = case when (p.description, p.offerings) is distinct from (excluded.description, excluded.offerings)
                                  then null else p.extraction_version end,
        version = p.version + 1,
        updated_by = excluded.updated_by,
        updated_at = now()
    where (p.description, p.offerings, p.exclusions, p.locations)
          is distinct from (excluded.description, excluded.offerings, excluded.exclusions, excluded.locations)
  returning p.version into changed_version;

  if changed_version is null then
    return (select version from public.company_profiles where org_id = target_org);
  end if;

  insert into public.company_profile_versions (org_id, version, description, offerings, exclusions, locations, created_by)
  select org_id, version, description, offerings, exclusions, locations, updated_by
  from public.company_profiles
  where org_id = target_org;

  insert into public.app_events (event_name, org_id, user_id, metadata)
  values ('company_profile.updated', target_org, current_user_id, jsonb_build_object('version', changed_version));

  return changed_version;
end;
$$;

revoke execute on function public.save_company_profile(uuid, text, text[], text[], text[]) from public, anon;
grant execute on function public.save_company_profile(uuid, text, text[], text[], text[]) to authenticated;

-- ============================================================
-- Starting a run with the saved profile
-- ============================================================

drop function public.request_search_run(uuid, text);

-- Queues a manual run for the organization's saved profile. Owner only while
-- the inbox is internal. Raises no_profile when none is saved and
-- run_in_progress when a run is already queued or running.
create function public.request_search_run(target_org uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  saved_version integer;
  new_run_id uuid;
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;
  if private.user_org_role(target_org) is distinct from 'owner' then
    raise exception 'not_owner';
  end if;

  select version into saved_version from public.company_profiles where org_id = target_org;
  if saved_version is null then
    raise exception 'no_profile';
  end if;

  begin
    insert into public.search_runs (org_id, profile_version, created_by)
    values (target_org, saved_version, current_user_id)
    returning id into new_run_id;
  exception when unique_violation then
    raise exception 'run_in_progress';
  end;

  perform pgmq.send('match', jsonb_build_object('type', 'search_run', 'runId', new_run_id));
  return new_run_id;
end;
$$;

revoke execute on function public.request_search_run(uuid) from public, anon;
grant execute on function public.request_search_run(uuid) to authenticated;

-- ============================================================
-- Verifiable exclusions
-- ============================================================

-- The exclusions each process's object (title) matches as a phrase, with the
-- same Spanish stemming and accent folding as retrieval, so "impresora" also
-- matches "Compra de impresoras". Only the object counts: product lines are
-- often generic catalog names, and a tender that lists an excluded item next
-- to wanted ones should reach review, not be discarded by one line.
create function public.match_exclusions(process_ids uuid[], exclusions text[])
returns table (process_id uuid, matched_exclusions text[])
language sql
stable
set search_path = ''
as $$
  select p.id, array_agg(e.term order by e.position)
  from public.procurement_processes p
  cross join unnest(exclusions) with ordinality as e (term, position)
  where p.id = any (process_ids)
    and to_tsvector('spanish'::regconfig, private.immutable_unaccent(p.title))
        @@ phraseto_tsquery('spanish'::regconfig, private.immutable_unaccent(e.term))
  group by p.id;
$$;

revoke execute on function public.match_exclusions(uuid[], text[]) from public, anon, authenticated;
grant execute on function public.match_exclusions(uuid[], text[]) to service_role;
