-- Billing with Paddle (plan D5, §7.5).
--
--   plans                      Básico, Estándar, and Pro are the plans for
--                              sale; Piloto is archived (pilots are Paddle
--                              discount codes on a plan now).
--   plan_prices                which Paddle price is which plan, per
--                              environment (sandbox and live ids differ).
--   organization_subscriptions mirrors the organization's Paddle
--                              subscription: Paddle's statuses, ids, the
--                              scheduled change, and when it became past_due.
--   paddle_webhook_events      every verified Paddle event, once.
--
-- The web app's webhook route verifies each event's signature and passes it
-- to record_paddle_event, which stores it and applies subscription events.
-- Every limit keeps reading private.active_plan_id, which now also allows 3
-- days after the period for a late renewal and 7 days of past_due grace
-- (O11). Manual rows written before this change keep working until they end;
-- nothing writes new ones.

-- ============================================================
-- Plans for sale
-- ============================================================

insert into public.plans (id, name, description, max_members, max_active_searches, min_schedule_interval, history_months, monthly_ai_credits, sort_order)
values
  ('basic', 'Básico', 'Una línea de negocio, reportes diarios.', 3, 2, interval '1 day', 3, 100, 1),
  ('estandar', 'Estándar', 'Varias líneas de negocio, reportes diarios.', 5, 5, interval '1 day', 12, 500, 2),
  ('pro', 'Pro', 'Varias líneas de negocio, reportes varias veces al día.', 10, 10, interval '6 hours', 12, 1000, 3)
-- Existing plans keep their limits (the admin app edits them); names, descriptions, and order match the Paddle products.
on conflict (id) do update set name = excluded.name, description = excluded.description, sort_order = excluded.sort_order;

update public.plans set is_archived = true where id = 'pilot';

create table public.plan_prices (
  paddle_price_id text primary key constraint plan_prices_id_check check (paddle_price_id ~ '^pri_[a-z0-9]{26}$'),
  plan_id text not null references public.plans (id),
  billing_interval text not null constraint plan_prices_interval_check check (billing_interval in ('month', 'year')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index plan_prices_plan_idx on public.plan_prices using btree (plan_id);

grant select on public.plan_prices to authenticated;
grant select, insert, update, delete on public.plan_prices to service_role;
alter table public.plan_prices enable row level security;
create policy "Prices readable" on public.plan_prices for select to authenticated using (true);

-- ============================================================
-- Subscription mirror
-- ============================================================

alter table public.organization_subscriptions
  drop constraint organization_subscriptions_status_check,
  add constraint organization_subscriptions_status_check
    check (status in ('trialing', 'active', 'past_due', 'paused', 'canceled', 'expired')),
  drop constraint organization_subscriptions_source_check,
  add constraint organization_subscriptions_source_check check (source in ('manual', 'paddle')),
  drop column stripe_customer_id,
  drop column stripe_subscription_id,
  add column paddle_customer_id text,
  add column paddle_subscription_id text unique,
  add column paddle_price_id text references public.plan_prices (paddle_price_id),
  add column billing_interval text,
  -- { "action": "cancel" | "pause", "effective_at": ... } while a change is pending.
  add column scheduled_change jsonb,
  add column next_billed_at timestamptz,
  add column past_due_since timestamptz,
  -- occurred_at of the last applied event, so an older event arriving late is ignored.
  add column paddle_updated_at timestamptz,
  add constraint organization_subscriptions_paddle_check
    check (source <> 'paddle' or (paddle_subscription_id is not null and paddle_customer_id is not null));

-- Plan id when the organization's subscription gives access right now (null
-- otherwise). Paddle rows: active or trialing until 3 days after the period
-- (a renewal webhook can arrive late; a missed one still ends access), and
-- past_due for 7 days (O11). Manual rows: active within their period.
create or replace function private.active_plan_id(target_org uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.plan_id
  from public.organization_subscriptions s
  where s.org_id = target_org
    and case s.source
      when 'paddle' then
        (s.status in ('active', 'trialing') and (s.current_period_end is null or s.current_period_end + interval '3 days' > now()))
        or (s.status = 'past_due' and s.past_due_since + interval '7 days' > now())
      else
        s.status = 'active'
        and s.current_period_start <= now()
        and (s.current_period_end is null or s.current_period_end > now())
    end;
$$;

-- Only manual rows expire here; Paddle says when its subscriptions end.
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
  where source = 'manual'
    and status = 'active'
    and current_period_end <= now();

  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$;

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
    where s.status in ('active', 'trialing', 'past_due')
  loop
    -- Grants only while private.active_plan_id gives access.
    perform private.ensure_ai_credit_grant(target_org);
  end loop;
end;
$$;

-- ============================================================
-- Notifications
-- ============================================================

insert into public.notification_types (id, label, category, description, default_in_app, default_email)
values
  ('subscription.payment_failed', 'Pago rechazado', 'billing',
   'No se pudo cobrar el plan de una organización que usted administra.', true, true),
  ('subscription.cancel_scheduled', 'Cancelación programada', 'billing',
   'Se programó la cancelación del plan de una organización que usted administra.', true, true);

create or replace function private.tg_subscription_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  has_access_now boolean := new.status in ('active', 'trialing');
  had_access boolean := tg_op = 'UPDATE' and old.status in ('active', 'trialing', 'past_due');
  cancel_date timestamptz := (new.scheduled_change ->> 'effective_at')::timestamptz;
  event_type text;
  org record;
  plan_name text;
  period_end_label text;
  title text;
  body text;
begin
  if has_access_now and not had_access then
    event_type := 'subscription.activated';
  elsif tg_op = 'INSERT' then
    event_type := null;
  elsif new.status is distinct from old.status then
    event_type := case new.status
      -- A failed renewal that Paddle later collected.
      when 'active' then case when old.status = 'past_due' then 'subscription.renewed' end
      when 'past_due' then 'subscription.payment_failed'
      when 'canceled' then 'subscription.canceled'
      when 'paused' then 'subscription.canceled'
      when 'expired' then 'subscription.expired'
    end;
  elsif new.scheduled_change ->> 'action' = 'cancel'
        and old.scheduled_change is distinct from new.scheduled_change then
    event_type := 'subscription.cancel_scheduled';
  elsif has_access_now and new.plan_id is distinct from old.plan_id then
    event_type := 'subscription.plan_changed';
  elsif has_access_now and new.current_period_end is distinct from old.current_period_end then
    event_type := 'subscription.renewed';
  end if;

  if event_type is null then
    return null;
  end if;

  select o.id, o.name, o.slug into org
  from public.organizations o
  where o.id = new.org_id;

  select p.name into plan_name
  from public.plans p
  where p.id = new.plan_id;

  period_end_label := case
    when new.source = 'paddle' and new.next_billed_at is not null
      then 'y se renueva el ' || to_char(new.next_billed_at at time zone 'America/Tegucigalpa', 'DD/MM/YYYY')
    else coalesce(
      'hasta el ' || to_char(new.current_period_end at time zone 'America/Tegucigalpa', 'DD/MM/YYYY'),
      'sin fecha de vencimiento'
    )
  end;

  title := case event_type
    when 'subscription.activated' then org.name || ' ahora tiene el plan ' || plan_name
    when 'subscription.renewed' then 'Se renovó el plan de ' || org.name
    when 'subscription.plan_changed' then org.name || ' cambió al plan ' || plan_name
    when 'subscription.payment_failed' then 'No se pudo cobrar el plan de ' || org.name
    when 'subscription.cancel_scheduled' then 'El plan de ' || org.name || ' se cancelará el '
      || to_char(cancel_date at time zone 'America/Tegucigalpa', 'DD/MM/YYYY')
    when 'subscription.canceled' then 'Se canceló la suscripción de ' || org.name
    when 'subscription.expired' then 'Venció la suscripción de ' || org.name
  end;

  body := case event_type
    when 'subscription.activated' then 'El plan está activo ' || period_end_label || '.'
    when 'subscription.renewed' then 'El plan ' || plan_name || ' está activo ' || period_end_label || '.'
    when 'subscription.plan_changed' then 'El plan está activo ' || period_end_label || '.'
    when 'subscription.payment_failed' then 'Actualice la tarjeta en Configuración › Facturación. Si el cobro sigue sin '
      || 'realizarse, la organización quedará en modo de solo lectura en 7 días.'
    when 'subscription.cancel_scheduled' then 'La organización mantiene el plan ' || plan_name
      || ' hasta esa fecha. Después quedará en modo de solo lectura.'
    else 'La organización queda en modo de solo lectura hasta que se vuelva a activar un plan.'
  end;

  insert into public.app_events (event_name, org_id, user_id, metadata)
  values (
    event_type,
    new.org_id,
    auth.uid(),
    jsonb_build_object(
      'plan_id', new.plan_id,
      'status', new.status,
      'source', new.source,
      'current_period_start', new.current_period_start,
      'current_period_end', new.current_period_end
    )
  );

  perform private.notify_org_managers(
    new.org_id,
    event_type,
    title,
    body,
    '/organizations/' || org.slug || '/settings/billing',
    jsonb_build_object('plan_id', new.plan_id, 'current_period_end', new.current_period_end),
    -- Keyed by the resulting state: a retried write dedupes, any real change notifies.
    event_type || ':' || new.org_id::text || ':' || new.plan_id || ':'
      || extract(epoch from new.current_period_start)::bigint::text || ':'
      || coalesce(extract(epoch from new.current_period_end)::bigint::text, 'open') || ':'
      || coalesce(extract(epoch from cancel_date)::bigint::text, '')
  );

  if has_access_now then
    perform private.ensure_ai_credit_grant(new.org_id);
  end if;

  return null;
end;
$$;

-- Manual rows: warn 7 days before the end. Paddle rows renew by themselves;
-- a scheduled cancellation is announced when it is scheduled.
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
    where s.source = 'manual'
      and s.status = 'active'
      and s.current_period_end > now()
      and s.current_period_end <= now() + interval '7 days'
  loop
    perform private.notify_org_managers(
      subscription.org_id,
      'subscription.expiring_soon',
      'El plan de ' || subscription.org_name || ' vence el '
        || to_char(subscription.current_period_end at time zone 'America/Tegucigalpa', 'DD/MM/YYYY'),
      'El plan ' || subscription.plan_name || ' termina el '
        || to_char(subscription.current_period_end at time zone 'America/Tegucigalpa', 'DD/MM/YYYY')
        || '. Después, la organización quedará en modo de solo lectura.',
      '/organizations/' || subscription.org_slug || '/settings/billing',
      jsonb_build_object('current_period_end', subscription.current_period_end),
      'subscription.expiring_soon:' || subscription.org_id::text || ':'
        || extract(epoch from subscription.current_period_end)::bigint::text
    );
  end loop;
end;
$$;

-- ============================================================
-- Webhook events
-- ============================================================

create table public.paddle_webhook_events (
  event_id text primary key,
  event_type text not null,
  occurred_at timestamptz not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

create index paddle_webhook_events_occurred_idx on public.paddle_webhook_events using btree (occurred_at desc);

grant select, insert, update, delete on public.paddle_webhook_events to service_role;
alter table public.paddle_webhook_events enable row level security;

-- Stores a verified Paddle event once and, for subscription events, mirrors
-- the subscription into its organization's row. Returns false for an event
-- already stored (a retry). Raises, so the webhook answers 500 and Paddle
-- retries, when the event cannot be applied: unknown_price,
-- unknown_organization, or organization_has_subscription (a second live
-- subscription for the same organization).
create function public.record_paddle_event(event jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  sub jsonb := event -> 'data';
  occurred timestamptz := (event ->> 'occurred_at')::timestamptz;
  target_org uuid;
  existing public.organization_subscriptions;
  price public.plan_prices;
  new_status text;
begin
  insert into public.paddle_webhook_events (event_id, event_type, occurred_at, payload)
  values (event ->> 'event_id', event ->> 'event_type', occurred, event)
  on conflict (event_id) do nothing;
  if not found then
    return false;
  end if;

  if event ->> 'event_type' not like 'subscription.%' then
    return true;
  end if;

  select * into existing from public.organization_subscriptions where paddle_subscription_id = sub ->> 'id';
  target_org := coalesce(existing.org_id, (sub -> 'custom_data' ->> 'org_id')::uuid);
  if target_org is null or not exists (select 1 from public.organizations where id = target_org) then
    raise exception 'unknown_organization';
  end if;
  if existing.paddle_updated_at > occurred then
    return true;
  end if;

  select * into price from public.plan_prices where paddle_price_id = sub -> 'items' -> 0 -> 'price' ->> 'id';
  if not found then
    raise exception 'unknown_price';
  end if;

  if existing.org_id is null then
    select * into existing from public.organization_subscriptions where org_id = target_org;
    if existing.org_id is not null
       and existing.source = 'paddle'
       and existing.status not in ('canceled', 'expired') then
      raise exception 'organization_has_subscription';
    end if;
  end if;

  new_status := sub ->> 'status';

  insert into public.organization_subscriptions as s (
    org_id, plan_id, status, source, current_period_start, current_period_end,
    paddle_customer_id, paddle_subscription_id, paddle_price_id, billing_interval,
    scheduled_change, next_billed_at, past_due_since, paddle_updated_at
  )
  values (
    target_org,
    price.plan_id,
    new_status,
    'paddle',
    coalesce((sub -> 'current_billing_period' ->> 'starts_at')::timestamptz, existing.current_period_start, now()),
    (sub -> 'current_billing_period' ->> 'ends_at')::timestamptz,
    sub ->> 'customer_id',
    sub ->> 'id',
    price.paddle_price_id,
    price.billing_interval,
    nullif(sub -> 'scheduled_change', 'null'::jsonb),
    (sub ->> 'next_billed_at')::timestamptz,
    case when new_status = 'past_due' then occurred end,
    occurred
  )
  on conflict (org_id) do update set
    plan_id = excluded.plan_id,
    status = excluded.status,
    source = excluded.source,
    current_period_start = excluded.current_period_start,
    -- A paused or canceled subscription has no billing period; keep the last one on record.
    current_period_end = coalesce(excluded.current_period_end, s.current_period_end),
    paddle_customer_id = excluded.paddle_customer_id,
    paddle_subscription_id = excluded.paddle_subscription_id,
    paddle_price_id = excluded.paddle_price_id,
    billing_interval = excluded.billing_interval,
    scheduled_change = excluded.scheduled_change,
    next_billed_at = excluded.next_billed_at,
    -- The grace counts from the first failed renewal, not from each retry.
    past_due_since = case
      when excluded.status <> 'past_due' then null
      when s.status = 'past_due' and s.paddle_subscription_id = excluded.paddle_subscription_id then s.past_due_since
      else excluded.past_due_since
    end,
    paddle_updated_at = excluded.paddle_updated_at;

  return true;
end;
$$;

revoke execute on function public.record_paddle_event(jsonb) from public, anon, authenticated;
grant execute on function public.record_paddle_event(jsonb) to service_role;

-- ============================================================
-- Changing plan
-- ============================================================

-- What stops the organization from moving to a plan now: 'members' (members
-- plus pending invitations over the plan's limit), 'searches' (more active
-- searches), 'schedules' (an active search runs more often than the plan
-- allows). Empty when it fits; null for non-members or an unknown plan.
create function public.plan_change_blockers(target_org uuid, target_plan text)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select array_remove(array[
    case when p.max_members is not null and private.org_seats_used(target_org) > p.max_members then 'members' end,
    case when p.max_active_searches is not null and (
      select count(*) from public.saved_searches s where s.org_id = target_org and s.is_active
    ) > p.max_active_searches then 'searches' end,
    case when p.min_schedule_interval is not null and exists (
      select 1 from public.saved_searches s
      where s.org_id = target_org and s.is_active and s.schedule <> 'manual'
        and private.search_schedule_interval(s.schedule) < p.min_schedule_interval
    ) then 'schedules' end
  ], null)
  from public.plans p
  where p.id = target_plan
    and private.user_org_role(target_org) is not null;
$$;

revoke execute on function public.plan_change_blockers(uuid, text) from public, anon;
grant execute on function public.plan_change_blockers(uuid, text) to authenticated;
