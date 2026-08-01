-- Ownership transfer + pending invitations lookup for the current user.
--
-- transfer_organization_ownership: the owner hands the org to another member.
-- Runs as SECURITY DEFINER because it must update two membership rows and
-- organizations.owner_id atomically, which the RLS policies intentionally
-- do not allow (role changes to 'owner' are forbidden for direct updates).
--
-- list_my_pending_invitations: a just-signed-up user has no memberships yet,
-- so RLS hides their invitations; this lists the ones addressed to their
-- own verified email.

create or replace function public.transfer_organization_ownership(
  target_org uuid,
  new_owner_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  caller_role text;
  target_role text;
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if new_owner_user_id = current_user_id then
    raise exception 'transfer_to_self';
  end if;

  select role into caller_role
  from organization_members
  where org_id = target_org and user_id = current_user_id
  for update;

  if caller_role is null or caller_role <> 'owner' then
    raise exception 'not_owner';
  end if;

  select role into target_role
  from organization_members
  where org_id = target_org and user_id = new_owner_user_id
  for update;

  if target_role is null then
    raise exception 'target_not_member';
  end if;

  update organization_members
  set role = 'owner'
  where org_id = target_org and user_id = new_owner_user_id;

  update organization_members
  set role = 'admin'
  where org_id = target_org and user_id = current_user_id;

  update organizations
  set owner_id = new_owner_user_id
  where id = target_org;
end;
$$;

revoke execute on function public.transfer_organization_ownership(uuid, uuid) from anon, public;
grant execute on function public.transfer_organization_ownership(uuid, uuid) to authenticated;

create or replace function public.list_my_pending_invitations()
returns table (
  id uuid,
  org_id uuid,
  org_name text,
  org_slug text,
  email text,
  role text,
  token text,
  expires_at timestamptz,
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
    i.token,
    i.expires_at,
    i.created_at
  from organization_invitations i
  join organizations o on o.id = i.org_id
  where lower(i.email::text) = (
      select lower(u.email) from auth.users u where u.id = auth.uid()
    )
    and i.accepted_at is null
    and i.expires_at > now()
  order by i.created_at desc;
$$;

revoke execute on function public.list_my_pending_invitations() from anon, public;
grant execute on function public.list_my_pending_invitations() to authenticated;
