-- The frozen PDF of a run (spec §7): the worker renders it once the run
-- finishes and stores it in the private reports bucket as
-- <org_id>/<run_id>.pdf; members of the organization read it, and only the
-- service role writes.

alter table public.search_runs
  -- Path in the reports bucket; null until the worker has rendered it.
  add column report_path text;

insert into storage.buckets (id, name, public)
values ('reports', 'reports', false)
on conflict (id) do nothing;

create policy "Reports read by org members"
on storage.objects for select to authenticated
using (
  bucket_id = 'reports'
  and private.user_org_role(((storage.foldername(name))[1])::uuid) is not null
);
