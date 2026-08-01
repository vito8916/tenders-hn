-- Project membership: assign specific org members to specific projects.
--
-- Read/update access to a project is no longer "any org member" - it now
-- depends on role and assignment:
--   owner/admin        -> all projects
--   member             -> projects they created or are assigned to (read+write)
--   viewer             -> projects they are assigned to (read only)
--
-- is_project_member mirrors user_org_role: SECURITY DEFINER to avoid RLS
-- recursion when projects/project_members policies reference each other.

-- ============================================================
-- Table
-- ============================================================

create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create index project_members_org_idx on public.project_members using btree (org_id);
create index project_members_project_idx on public.project_members using btree (project_id);
create index project_members_user_idx on public.project_members using btree (user_id);

-- ============================================================
-- Authorization helper
-- ============================================================

create or replace function public.is_project_member(target_project uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from project_members
    where project_id = target_project
      and user_id = auth.uid()
  );
$$;

revoke execute on function public.is_project_member(uuid) from anon, public;
grant execute on function public.is_project_member(uuid) to authenticated;

-- ============================================================
-- Trigger: auto-assign the creator to their own project
-- ============================================================

create or replace function public.tg_assign_project_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.project_members (org_id, project_id, user_id, created_at)
  values (new.org_id, new.id, new.owner_id, now())
  on conflict (project_id, user_id) do nothing;

  return new;
end;
$$;

create trigger projects_assign_owner
  after insert on public.projects
  for each row execute function public.tg_assign_project_owner();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.project_members enable row level security;

create policy "Project members read by org owner/admin, self, or teammates"
on public.project_members for select to authenticated
using (
  public.user_org_role(org_id) in ('owner', 'admin')
  or user_id = auth.uid()
  or public.is_project_member(project_id)
);

create policy "Project members assign by org owner/admin"
on public.project_members for insert to authenticated
with check (public.user_org_role(org_id) in ('owner', 'admin'));

create policy "Project members unassign by org owner/admin"
on public.project_members for delete to authenticated
using (public.user_org_role(org_id) in ('owner', 'admin'));

-- ============================================================
-- Update projects RLS: gate read/update by role or assignment
-- ============================================================

drop policy "Projects read by org members" on public.projects;

create policy "Projects read by owner/admin/creator/assignee"
on public.projects for select to authenticated
using (
  public.user_org_role(org_id) in ('owner', 'admin')
  or owner_id = auth.uid()
  or public.is_project_member(id)
);

drop policy "Projects update by owner/admin/member" on public.projects;

create policy "Projects update by owner/admin/assignee"
on public.projects for update to authenticated
using (
  public.user_org_role(org_id) in ('owner', 'admin')
  or (
    public.user_org_role(org_id) = 'member'
    and (owner_id = auth.uid() or public.is_project_member(id))
  )
);
