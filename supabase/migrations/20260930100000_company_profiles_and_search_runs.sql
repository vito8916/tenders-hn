-- Phase 3: company profiles, search runs, and their matches (plan §7.2).
--
--   company_profiles     what an organization sells, as its corporate purpose
--                        or a free description, and the lines of business the
--                        worker extracts from it.
--   search_runs          one matching run over the open processes for a
--                        profile version, with what it used and how it went.
--   search_run_matches   each candidate the run evaluated: relevance, reasons,
--                        and a snapshot of the process as it was then.
--
-- The internal inbox is the first user of these tables. They carry the
-- plan's columns that matching needs today; Phase 4 adds saved searches,
-- schedules, profile versions, and delivery. Members read their
-- organization's rows; the owner saves the profile and starts a run through
-- request_search_run; only the worker (service role) writes results.

create table public.company_profiles (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  description text not null constraint company_profiles_description_check check (length(btrim(description)) > 0),
  -- Lines of business with keywords and UNSPSC classes (worker/src/matching/profile.ts);
  -- null until the worker extracts them for the current version.
  extracted_profile jsonb,
  extraction_version text,
  -- Incremented whenever the description changes.
  version integer not null default 1,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.search_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  trigger text not null default 'manual' constraint search_runs_trigger_check
    check (trigger in ('schedule', 'manual')),
  status text not null default 'queued' constraint search_runs_status_check
    check (status in ('queued', 'running', 'completed', 'partial', 'failed')),
  profile_version integer not null,
  -- The profile, models, and candidate cutoff the run used.
  config_snapshot jsonb not null default '{}',
  candidates integer,
  matches_count integer,
  -- What the run could not cover, e.g. evaluations that failed.
  coverage jsonb not null default '{}',
  error text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index search_runs_org_created_idx on public.search_runs using btree (org_id, created_at desc);
-- One run in flight per organization, so starting twice cannot double the work.
create unique index search_runs_one_active_idx on public.search_runs using btree (org_id)
  where status in ('queued', 'running');

create table public.search_run_matches (
  run_id uuid not null references public.search_runs (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  process_id uuid not null references public.procurement_processes (id) on delete cascade,
  process_version_id uuid references public.process_versions (id) on delete set null,
  -- Position in the fused retrieval ranking, from 1.
  retrieval_rank integer not null,
  relevance text not null constraint search_run_matches_relevance_check
    check (relevance in ('muy_relevante', 'posible', 'descartada', 'pendiente')),
  -- Jev's probability for in_scope; null when the evaluation failed.
  in_scope double precision,
  -- [{ text, source }] from lib/matching/reasons.ts.
  reasons jsonb not null default '[]',
  evaluation_id uuid references public.match_evaluations (id) on delete set null,
  -- The process as it was when the run evaluated it.
  expediente text not null,
  title text not null,
  buyer_entity text not null,
  modality text,
  stage text,
  closes_at timestamptz,
  detail_url text not null,
  primary key (run_id, process_id)
);

create index search_run_matches_org_idx on public.search_run_matches using btree (org_id);

grant select on public.company_profiles, public.search_runs, public.search_run_matches to authenticated;
grant select, insert, update, delete on public.company_profiles, public.search_runs, public.search_run_matches to service_role;

alter table public.company_profiles enable row level security;
alter table public.search_runs enable row level security;
alter table public.search_run_matches enable row level security;

create policy "Members read their organization's profile" on public.company_profiles
  for select to authenticated using (private.user_org_role(org_id) is not null);
create policy "Members read their organization's runs" on public.search_runs
  for select to authenticated using (private.user_org_role(org_id) is not null);
create policy "Members read their organization's matches" on public.search_run_matches
  for select to authenticated using (private.user_org_role(org_id) is not null);

-- ============================================================
-- Saving the profile and starting a run
-- ============================================================

-- Saves the organization's profile (a new version when the description
-- changed) and queues a manual run for it. Owner only while the inbox is
-- internal. Raises run_in_progress when a run is already queued or running.
create function public.request_search_run(target_org uuid, profile_description text)
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
  if length(btrim(coalesce(profile_description, ''))) = 0 then
    raise exception 'empty_profile';
  end if;

  insert into public.company_profiles (org_id, description, updated_by)
  values (target_org, btrim(profile_description), current_user_id)
  on conflict (org_id) do update
    set description = excluded.description,
        extracted_profile = null,
        extraction_version = null,
        version = public.company_profiles.version + 1,
        updated_by = excluded.updated_by,
        updated_at = now()
    where public.company_profiles.description is distinct from excluded.description;

  select version into saved_version from public.company_profiles where org_id = target_org;

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

revoke execute on function public.request_search_run(uuid, text) from public, anon;
grant execute on function public.request_search_run(uuid, text) to authenticated;
