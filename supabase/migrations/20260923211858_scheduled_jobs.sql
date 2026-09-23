-- Scheduled jobs (pg_cron) and the email dispatcher trigger (pg_net).
--
-- The dispatcher reads two Vault secrets, created per environment and never
-- committed to migrations:
--   project_url              base URL the database uses to reach the API gateway
--   email_dispatcher_secret  shared secret checked by the edge function
-- Local values are created by supabase/seed.sql. For a hosted project:
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select vault.create_secret('<random secret>', 'email_dispatcher_secret');
-- and set EMAIL_DISPATCHER_SECRET to the same value in the function secrets.
--
-- Times are UTC; Honduras is UTC-6 all year.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- ============================================================
-- Subscriptions
-- ============================================================

-- The status change fires tg_subscription_changed, which notifies managers.
create or replace function private.expire_subscriptions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired_count integer;
begin
  update public.organization_subscriptions
  set status = 'expired'
  where status = 'active'
    and current_period_end <= now();

  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$;

-- One warning per subscription period, sent once the end is within 7 days.
create or replace function private.warn_expiring_subscriptions()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  subscription record;
begin
  for subscription in
    select s.org_id, s.current_period_end, o.name as org_name, o.slug as org_slug, p.name as plan_name
    from public.organization_subscriptions s
    join public.organizations o on o.id = s.org_id
    join public.plans p on p.id = s.plan_id
    where s.status = 'active'
      and s.current_period_end > now()
      and s.current_period_end <= now() + interval '7 days'
  loop
    perform private.notify_org_managers(
      subscription.org_id,
      'subscription.expiring_soon',
      subscription.org_name || ' plan expires on '
        || to_char(subscription.current_period_end at time zone 'America/Tegucigalpa', 'FMMonth FMDD'),
      'The ' || subscription.plan_name || ' plan ends on '
        || to_char(subscription.current_period_end at time zone 'America/Tegucigalpa', 'FMMonth FMDD, YYYY')
        || '. After that the organization becomes read-only.',
      '/organizations/' || subscription.org_slug || '/settings/billing',
      jsonb_build_object('current_period_end', subscription.current_period_end),
      'subscription.expiring_soon:' || subscription.org_id::text || ':'
        || extract(epoch from subscription.current_period_end)::bigint::text
    );
  end loop;
end;
$$;

-- ============================================================
-- AI credits
-- ============================================================

create or replace function private.grant_monthly_ai_credits()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_org uuid;
begin
  for target_org in
    select s.org_id
    from public.organization_subscriptions s
    where s.status = 'active'
  loop
    perform private.ensure_ai_credit_grant(target_org);
  end loop;
end;
$$;

-- Reservations whose AI operation never committed or released (crashed worker).
create or replace function private.release_expired_ai_credit_reservations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  released_count integer;
begin
  update public.ai_credit_reservations
  set status = 'released', settled_at = now()
  where status = 'reserved'
    and expires_at <= now();

  get diagnostics released_count = row_count;
  return released_count;
end;
$$;

-- ============================================================
-- Email dispatcher
-- ============================================================

-- Calls the edge function only when there is due work, so idle minutes cost nothing.
create or replace function private.dispatch_notification_emails()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_url text;
  dispatcher_secret text;
begin
  if not exists (
    select 1
    from public.notification_deliveries d
    where d.attempts < 5
      and (
        (d.status = 'pending' and d.next_attempt_at <= now())
        or (d.status = 'sending' and d.locked_at < now() - interval '10 minutes')
      )
  ) then
    return;
  end if;

  select decrypted_secret into project_url
  from vault.decrypted_secrets
  where name = 'project_url';

  select decrypted_secret into dispatcher_secret
  from vault.decrypted_secrets
  where name = 'email_dispatcher_secret';

  if project_url is null or dispatcher_secret is null then
    raise warning 'dispatch_notification_emails: missing vault secrets project_url / email_dispatcher_secret';
    return;
  end if;

  perform net.http_post(
    url := project_url || '/functions/v1/send-notification-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-dispatcher-secret', dispatcher_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;

-- ============================================================
-- Retention
-- ============================================================

create or replace function private.purge_old_records()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notifications
  where created_at < now() - interval '180 days';

  delete from public.notification_deliveries
  where status in ('sent', 'failed')
    and created_at < now() - interval '90 days';

  delete from cron.job_run_details
  where end_time < now() - interval '14 days';
end;
$$;

-- ============================================================
-- Schedules (cron.schedule upserts by job name)
-- ============================================================

select cron.schedule('expire-subscriptions', '*/15 * * * *', 'select private.expire_subscriptions()');
select cron.schedule('warn-expiring-subscriptions', '0 14 * * *', 'select private.warn_expiring_subscriptions()');
select cron.schedule('grant-monthly-ai-credits', '5 * * * *', 'select private.grant_monthly_ai_credits()');
select cron.schedule('release-expired-ai-credit-reservations', '*/5 * * * *', 'select private.release_expired_ai_credit_reservations()');
select cron.schedule('dispatch-notification-emails', '* * * * *', 'select private.dispatch_notification_emails()');
select cron.schedule('purge-old-records', '30 9 * * *', 'select private.purge_old_records()');
