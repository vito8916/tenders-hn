-- Slug availability sees every organization, not only the user's own.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'owner@test.local', 'authenticated', 'authenticated', '{}'),
  ('22222222-2222-4222-8222-222222222222', 'new@test.local', 'authenticated', 'authenticated', '{}');
insert into public.organizations (id, name, slug, owner_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Test Org', 'test-org-pgtap', '11111111-1111-4111-8111-111111111111');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-4222-8222-222222222222', 'role', 'authenticated')::text, true);

select is((select count(*)::int from public.organizations where slug = 'test-org-pgtap'), 0, 'RLS hides other organizations');
select ok(not public.is_organization_slug_available('test-org-pgtap'), 'a slug taken by another organization is not available');
select ok(public.is_organization_slug_available('free-slug-pgtap'), 'an unused slug is available');
reset role;

set local role anon;
select throws_ok($$select public.is_organization_slug_available('x')$$, '42501', null, 'anonymous users cannot check slugs');
reset role;

select * from finish();
rollback;
