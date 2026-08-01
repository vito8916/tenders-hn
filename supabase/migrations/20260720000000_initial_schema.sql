-- Multi-Tenant SupaNext Kit initial schema
-- Single source of truth for the multi-tenant data model:
-- tables, triggers, RLS policies, RPCs, and storage buckets.
--
-- Security model:
--   authentication -> trusted actor (auth.uid())
--   app RBAC       -> features/*/rbac.ts (mirrors these policies)
--   RLS            -> final authority, enforced here
-- Membership rows are only ever created by SECURITY DEFINER paths
-- (org-creation trigger, accept_invitation) so roles cannot be forged.

-- ============================================================
-- Extensions
-- ============================================================

create extension if not exists citext with schema extensions;

-- ============================================================
-- Default privileges
-- ============================================================
-- Migrations run as `postgres`, whose default ACL on new relations does
-- not include arwd for anon/authenticated/service_role (only
-- supabase_admin-owned relations get that by default). RLS policies below
-- are the real access control; these grants just make the base table
-- privileges match what RLS expects to filter.

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;

-- ============================================================
-- Enums
-- ============================================================

create type public.project_status as enum (
  'active',
  'inactive',
  'completed',
  'canceled',
  'archived'
);

create type public.project_visibility as enum (
  'private',
  'public'
);

-- ============================================================
-- Tables
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  bio text,
  status text default 'active',
  email text,
  phone text,
  stripe_customer_id text,
  stripe_subscription_id text,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_email_idx on public.profiles using btree (lower(email));
create index profiles_status_idx on public.profiles using btree (status);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null constraint organizations_name_check check (length(btrim(name)) > 0),
  slug text not null unique,
  owner_id uuid not null references auth.users (id) on delete cascade,
  org_logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null constraint organization_members_role_check
    check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now()
);

create unique index organization_members_org_user_uidx
  on public.organization_members using btree (org_id, user_id);

create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  email extensions.citext not null,
  role text not null constraint organization_invitations_role_check
    check (role in ('admin', 'member', 'viewer')),
  token text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index organization_invitations_email_idx
  on public.organization_invitations using btree (lower(email::text));
create index organization_invitations_org_idx
  on public.organization_invitations using btree (org_id);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null constraint projects_name_check check (length(btrim(name)) > 0),
  slug text,
  description text,
  owner_id uuid not null references auth.users (id) on delete cascade,
  visibility public.project_visibility not null default 'private',
  status public.project_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_org_idx on public.projects using btree (org_id);
create index projects_owner_idx on public.projects using btree (owner_id);
create index projects_status_idx on public.projects using btree (status);
create index projects_visibility_idx on public.projects using btree (visibility);

create table public.project_favorites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, project_id)
);

create index project_favorites_org_idx on public.project_favorites using btree (org_id);
create index project_favorites_project_idx on public.project_favorites using btree (project_id);
create index project_favorites_user_idx on public.project_favorites using btree (user_id);

create table public.app_events (
  id bigint generated always as identity primary key,
  org_id uuid references public.organizations (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  event_name text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index app_events_event_name_idx on public.app_events using btree (event_name);
create index app_events_org_idx on public.app_events using btree (org_id);
create index app_events_user_idx on public.app_events using btree (user_id);

-- ============================================================
-- Trigger functions
-- ============================================================

create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Auto-create a profile when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, email, created_at, updated_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', null),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', null),
    new.email,
    now(),
    now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Auto-create the owner membership when an organization is created.
-- SECURITY DEFINER: organization_members has no INSERT policy on purpose.
create or replace function public.tg_create_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.organization_members (org_id, user_id, role, created_at)
  values (new.id, new.owner_id, 'owner', now())
  on conflict (org_id, user_id) do nothing;

  return new;
end;
$$;

-- ============================================================
-- Triggers
-- ============================================================

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger organizations_create_owner_membership
  after insert on public.organizations
  for each row execute function public.tg_create_owner_membership();

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.tg_set_updated_at();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.tg_set_updated_at();

-- ============================================================
-- Authorization helpers (SECURITY DEFINER avoids RLS recursion)
-- ============================================================

create or replace function public.user_org_role(target_org uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from organization_members
  where org_id = target_org
    and user_id = auth.uid();
$$;

revoke execute on function public.user_org_role(uuid) from anon, public;
grant execute on function public.user_org_role(uuid) to authenticated;

create or replace function public.shares_org_with(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from organization_members mine
    join organization_members theirs on theirs.org_id = mine.org_id
    where mine.user_id = auth.uid()
      and theirs.user_id = target_user
  );
$$;

revoke execute on function public.shares_org_with(uuid) from anon, public;
grant execute on function public.shares_org_with(uuid) to authenticated;

-- ============================================================
-- Invitation RPCs (token holders are not members yet, so these
-- bypass RLS with explicit checks)
-- ============================================================

create or replace function public.get_invitation_by_token(invite_token text)
returns table (
  id uuid,
  org_id uuid,
  org_name text,
  org_slug text,
  email text,
  role text,
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.id,
    i.org_id,
    o.name as org_name,
    o.slug as org_slug,
    i.email::text,
    i.role,
    i.expires_at,
    i.accepted_at,
    i.created_at
  from organization_invitations i
  join organizations o on o.id = i.org_id
  where i.token = invite_token;
$$;

revoke execute on function public.get_invitation_by_token(text) from anon, public;
grant execute on function public.get_invitation_by_token(text) to authenticated;

create or replace function public.accept_invitation(invite_token text)
returns table (org_id uuid, org_slug text, org_name text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  current_user_id uuid := auth.uid();
  current_user_email text;
  invitation record;
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select u.email into current_user_email
  from auth.users u
  where u.id = current_user_id;

  select i.* into invitation
  from organization_invitations i
  where i.token = invite_token
  for update;

  if invitation is null then
    raise exception 'invitation_not_found';
  end if;

  if invitation.accepted_at is not null then
    raise exception 'invitation_already_accepted';
  end if;

  if invitation.expires_at < now() then
    raise exception 'invitation_expired';
  end if;

  if lower(invitation.email::text) <> lower(current_user_email) then
    raise exception 'invitation_email_mismatch';
  end if;

  insert into organization_members (org_id, user_id, role, created_at)
  values (invitation.org_id, current_user_id, invitation.role, now())
  on conflict (org_id, user_id) do nothing;

  update organization_invitations
  set accepted_at = now()
  where organization_invitations.id = invitation.id;

  return query
  select o.id, o.slug, o.name
  from organizations o
  where o.id = invitation.org_id;
end;
$$;

revoke execute on function public.accept_invitation(text) from anon, public;
grant execute on function public.accept_invitation(text) to authenticated;

-- ============================================================
-- Audit log RPC
-- ============================================================

create or replace function public.log_app_event(
  p_event_name text,
  p_org_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into app_events (event_name, org_id, user_id, metadata, created_at)
  values (p_event_name, p_org_id, auth.uid(), p_metadata, now());
$$;

revoke execute on function public.log_app_event(text, uuid, jsonb) from anon, public;
grant execute on function public.log_app_event(text, uuid, jsonb) to authenticated;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.projects enable row level security;
alter table public.project_favorites enable row level security;
alter table public.app_events enable row level security;

-- ----- profiles -----

create policy "Profiles read own"
on public.profiles for select to authenticated
using (auth.uid() = id);

create policy "Profiles read by shared org members"
on public.profiles for select to authenticated
using (public.shares_org_with(id));

create policy "Profiles update own"
on public.profiles for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- ----- organizations -----

create policy "Org create"
on public.organizations for insert to authenticated
with check (owner_id = auth.uid());

create policy "Org read by members"
on public.organizations for select to authenticated
using (
  owner_id = auth.uid()
  or public.user_org_role(id) is not null
);

create policy "Org update by owner/admin"
on public.organizations for update to authenticated
using (public.user_org_role(id) in ('owner', 'admin'));

create policy "Org delete by owner"
on public.organizations for delete to authenticated
using (public.user_org_role(id) = 'owner');

-- ----- organization_members -----
-- No INSERT policy: memberships are created only by SECURITY DEFINER
-- paths (org-creation trigger and accept_invitation), so a user can
-- never insert or forge their own role.

create policy "Org members read by org members"
on public.organization_members for select to authenticated
using (public.user_org_role(org_id) is not null);

-- Only the owner changes roles, never their own row, and never to 'owner'
create policy "Org members role change by owner"
on public.organization_members for update to authenticated
using (
  public.user_org_role(org_id) = 'owner'
  and user_id <> auth.uid()
  and role <> 'owner'
)
with check (role in ('admin', 'member', 'viewer'));

-- A member can leave (except the owner); owner/admin can remove
-- other members (but never the owner)
create policy "Org members delete by self or manager"
on public.organization_members for delete to authenticated
using (
  (user_id = auth.uid() and role <> 'owner')
  or (
    public.user_org_role(org_id) in ('owner', 'admin')
    and user_id <> auth.uid()
    and role <> 'owner'
  )
);

-- ----- organization_invitations -----

create policy "Org invitations create by owner/admin"
on public.organization_invitations for insert to authenticated
with check (public.user_org_role(org_id) in ('owner', 'admin'));

create policy "Org invitations read by members"
on public.organization_invitations for select to authenticated
using (public.user_org_role(org_id) is not null);

create policy "Org invitations update by owner/admin"
on public.organization_invitations for update to authenticated
using (public.user_org_role(org_id) in ('owner', 'admin'));

create policy "Org invitations delete by owner/admin"
on public.organization_invitations for delete to authenticated
using (public.user_org_role(org_id) in ('owner', 'admin'));

-- ----- projects -----

create policy "Projects read by org members"
on public.projects for select to authenticated
using (public.user_org_role(org_id) is not null);

create policy "Projects create by owner/admin/member"
on public.projects for insert to authenticated
with check (
  public.user_org_role(org_id) in ('owner', 'admin', 'member')
  and owner_id = auth.uid()
);

create policy "Projects update by owner/admin/member"
on public.projects for update to authenticated
using (public.user_org_role(org_id) in ('owner', 'admin', 'member'));

create policy "Projects delete by owner/admin"
on public.projects for delete to authenticated
using (public.user_org_role(org_id) in ('owner', 'admin'));

-- ----- project_favorites -----

create policy "Favorites read own"
on public.project_favorites for select to authenticated
using (
  user_id = auth.uid()
  and public.user_org_role(org_id) is not null
);

create policy "Favorites insert own"
on public.project_favorites for insert to authenticated
with check (
  user_id = auth.uid()
  and public.user_org_role(org_id) is not null
);

create policy "Favorites delete own"
on public.project_favorites for delete to authenticated
using (user_id = auth.uid());

-- ----- app_events -----
-- Writes go through log_app_event (SECURITY DEFINER); no INSERT policy.

create policy "App events read by org owner/admin"
on public.app_events for select to authenticated
using (
  org_id is not null
  and public.user_org_role(org_id) in ('owner', 'admin')
);

-- ============================================================
-- Storage: buckets and policies
-- Paths are "<owner_id>/<file>" so the first folder identifies
-- the owning user (profile-pictures) or org (organization-logos).
-- ============================================================

insert into storage.buckets (id, name, public)
values
  ('profile-pictures', 'profile-pictures', false),
  ('organization-logos', 'organization-logos', false)
on conflict (id) do nothing;

-- ----- profile-pictures -----

create policy "Avatars manage own"
on storage.objects for all to authenticated
using (
  bucket_id = 'profile-pictures'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-pictures'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Avatars read by shared org members"
on storage.objects for select to authenticated
using (
  bucket_id = 'profile-pictures'
  and public.shares_org_with(((storage.foldername(name))[1])::uuid)
);

-- ----- organization-logos -----

create policy "Org logos read by members"
on storage.objects for select to authenticated
using (
  bucket_id = 'organization-logos'
  and public.user_org_role(((storage.foldername(name))[1])::uuid) is not null
);

create policy "Org logos write by owner/admin"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'organization-logos'
  and public.user_org_role(((storage.foldername(name))[1])::uuid) in ('owner', 'admin')
);

create policy "Org logos update by owner/admin"
on storage.objects for update to authenticated
using (
  bucket_id = 'organization-logos'
  and public.user_org_role(((storage.foldername(name))[1])::uuid) in ('owner', 'admin')
);

create policy "Org logos delete by owner/admin"
on storage.objects for delete to authenticated
using (
  bucket_id = 'organization-logos'
  and public.user_org_role(((storage.foldername(name))[1])::uuid) in ('owner', 'admin')
);
