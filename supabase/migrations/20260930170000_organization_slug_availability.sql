-- The slug check in onboarding and on the create-organization page read
-- public.organizations through RLS, which shows users only their own
-- organizations, so a slug taken by any other organization looked available
-- until the insert failed on organizations_slug_key at the last step.
-- This answers only whether a slug is taken, for any organization.
create function public.is_organization_slug_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.organizations where slug = candidate);
$$;

revoke execute on function public.is_organization_slug_available(text) from public, anon;
grant execute on function public.is_organization_slug_available(text) to authenticated;
