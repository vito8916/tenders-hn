-- Local development seed. Runs on `pnpm db:start` (first run) and `pnpm db:reset`.
-- Creates the test account shown on the login form:
--   email: test@mtsupanextkit.app  /  password: 12345678
-- The on_auth_user_created trigger creates the matching profile row.

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change,
  email_change_token_new
)
values (
  '00000000-0000-0000-0000-000000000000',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  'authenticated',
  'authenticated',
  'test@mtsupanextkit.app',
  extensions.crypt('12345678', extensions.gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Test User"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
)
on conflict (id) do nothing;

insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
values (
  gen_random_uuid(),
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  '{"sub": "f47ac10b-58cc-4372-a567-0e02b2c3d479", "email": "test@mtsupanextkit.app", "email_verified": true}',
  'email',
  now(),
  now(),
  now()
)
on conflict (provider_id, provider) do nothing;

-- The seeded user lands directly in the seeded organization.
update public.profiles
set full_name = 'Test User',
    onboarding_completed_at = now()
where id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

-- Paddle sandbox prices (created 30 Sep 2026; live ids differ and are set per environment).
insert into public.plan_prices (paddle_price_id, plan_id, billing_interval) values
  ('pri_01m3sxrnnkk4scnem6e2fp0p1n', 'basic', 'month'),
  ('pri_01m3sxrnvayctvxhdb085eg2cp', 'estandar', 'month'),
  ('pri_01m3sxrp4a8bffa5hebjhejpww', 'pro', 'month')
on conflict (paddle_price_id) do nothing;

-- Test organization on the Estándar plan (created by the Paddle billing
-- migration) through a manual subscription, so local development needs no
-- Paddle checkout. The org trigger creates the owner membership; the
-- subscription trigger grants this cycle's AI credits.
insert into public.organizations (id, name, slug, owner_id)
values (
  '5b1f7a3e-2c4d-4e6f-8a9b-0c1d2e3f4a5b',
  'Test Organization',
  'test-organization',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'
)
on conflict (id) do nothing;

insert into public.organization_subscriptions (org_id, plan_id, status, current_period_start, current_period_end)
values (
  '5b1f7a3e-2c4d-4e6f-8a9b-0c1d2e3f4a5b',
  'estandar',
  'active',
  now(),
  now() + interval '1 year'
)
on conflict (org_id) do nothing;

-- Vault secrets for the email dispatcher (pg_net -> edge function).
-- `kong` is the API gateway's hostname inside the local Docker network;
-- the dispatcher secret matches EMAIL_DISPATCHER_SECRET in config.toml.
select vault.create_secret('http://kong:8000', 'project_url');
select vault.create_secret('local-email-dispatcher-secret', 'email_dispatcher_secret');
