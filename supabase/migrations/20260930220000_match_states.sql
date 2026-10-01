-- Each match says whether it is new to its search, updated since the search
-- last found it, or already known (spec §12.2), and each run counts its new
-- relevant matches for the Home's indicator (spec §12.1).
--
-- A match is judged against the search's earlier finished runs in which the
-- process was relevant (muy_relevante or posible): never there is «nueva»;
-- there with another version of the process is «actualizada»; otherwise
-- «conocida». The search_run job calls private.set_match_states when it
-- writes a run's matches.

alter table public.search_run_matches
  add column match_state text constraint search_run_matches_match_state_check
    check (match_state in ('nueva', 'actualizada', 'conocida'));

alter table public.search_runs add column new_matches_count integer;

-- The lookup of a process's earlier matches.
create index search_run_matches_process_idx on public.search_run_matches using btree (process_id);

create function private.set_match_states(target_run uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  with run as (
    select id, saved_search_id, created_at from public.search_runs where id = target_run
  ),
  states as (
    select
      m.process_id,
      case
        when previous.run_id is null then 'nueva'
        when previous.process_version_id is distinct from m.process_version_id then 'actualizada'
        else 'conocida'
      end as state
    from public.search_run_matches m
    cross join run
    left join lateral (
      select pm.run_id, pm.process_version_id
      from public.search_run_matches pm
      join public.search_runs pr on pr.id = pm.run_id
      where pm.process_id = m.process_id
        and pr.saved_search_id = run.saved_search_id
        and pr.id <> run.id
        and pr.created_at < run.created_at
        and pr.status in ('completed', 'partial')
        and pm.relevance in ('muy_relevante', 'posible')
      order by pr.created_at desc
      limit 1
    ) previous on true
    where m.run_id = target_run
  )
  update public.search_run_matches m
  set match_state = states.state
  from states
  where m.run_id = target_run and m.process_id = states.process_id;

  update public.search_runs
  set new_matches_count = (
    select count(*) from public.search_run_matches
    where run_id = target_run and match_state = 'nueva' and relevance in ('muy_relevante', 'posible')
  )
  where id = target_run;
$$;

revoke execute on function private.set_match_states(uuid) from public, anon, authenticated;

-- Runs finished before this migration.
do $$
declare
  finished record;
begin
  for finished in select id from public.search_runs where status in ('completed', 'partial') loop
    perform private.set_match_states(finished.id);
  end loop;
end
$$;
