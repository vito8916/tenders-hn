-- Local development seed. Runs on `supabase start` / `supabase db reset`.
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
