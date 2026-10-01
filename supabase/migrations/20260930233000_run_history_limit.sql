-- Plans keep history_months of runs (spec §9; null = all): members read the
-- runs created since then, and their matches and reports, and nothing older.
-- The limit follows the organization's plan, active or not, so a lapsed plan
-- keeps the history it had. Rows are kept; a better plan shows them again.

create function private.history_cutoff(target_org uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select case when p.history_months is null then '-infinity'::timestamptz
                  else now() - make_interval(months => p.history_months) end
      from public.organization_subscriptions s
      join public.plans p on p.id = s.plan_id
      where s.org_id = target_org
    ),
    '-infinity'::timestamptz
  );
$$;

revoke execute on function private.history_cutoff(uuid) from public, anon;
grant execute on function private.history_cutoff(uuid) to authenticated;

drop policy "Members read their organization's runs" on public.search_runs;
create policy "Members read their organization's runs within the plan's history" on public.search_runs
  for select to authenticated
  using ((select private.user_org_role(org_id)) is not null and created_at >= private.history_cutoff(org_id));

drop policy "Members read their organization's matches" on public.search_run_matches;
create policy "Members read the matches of runs within the plan's history" on public.search_run_matches
  for select to authenticated
  using (
    (select private.user_org_role(org_id)) is not null
    and exists (select 1 from public.search_runs r where r.id = run_id and r.created_at >= private.history_cutoff(r.org_id))
  );

drop policy "Reports read by org members" on storage.objects;
create policy "Reports read by org members within the plan's history"
on storage.objects for select to authenticated
using (
  bucket_id = 'reports'
  and private.user_org_role(((storage.foldername(name))[1])::uuid) is not null
  and exists (
    select 1 from public.search_runs r
    where r.report_path = name and r.created_at >= private.history_cutoff(r.org_id)
  )
);

-- The reports policy finds the run by its file.
create index search_runs_report_path_idx on public.search_runs using btree (report_path) where report_path is not null;
