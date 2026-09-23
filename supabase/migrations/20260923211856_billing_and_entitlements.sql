-- Billing and entitlements without a payment provider.
--
-- plans                      catalog of limits (null limit = unlimited)
-- organization_subscriptions one row per org; written only by service_role
--                            (the platform admin app now, a Stripe webhook later)
-- ai_credit_reservations     credits held while an AI operation runs
-- ai_credit_ledger           append-only grants, usage, and adjustments
--
-- An organization without an active subscription is read-only: it keeps its
-- data but cannot add seats or spend AI credits. Limits for searches, schedule
-- frequency and history are stored on plans now and enforced by the tables
-- that introduce those features.
--
-- AI credits are a monthly allowance: each cycle starts on the subscription's
-- period start day, gets one grant, and unused credits do not roll over.

-- ============================================================
-- Tables
-- ============================================================

create table public.plans (
  id text primary key constraint plans_id_check check (id ~ '^[a-z0-9][a-z0-9_-]*$'),
  name text not null,
  description text,
  max_members integer constraint plans_max_members_check check (max_members > 0),
  max_active_searches integer constraint plans_max_active_searches_check check (max_active_searches >= 0),
  min_schedule_interval interval,
  history_months integer constraint plans_history_months_check check (history_months > 0),
  monthly_ai_credits integer not null default 0
    constraint plans_monthly_ai_credits_check check (monthly_ai_credits >= 0),
  is_archived boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_subscriptions (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  plan_id text not null references public.plans (id),
  status text not null constraint organization_subscriptions_status_check
    check (status in ('active', 'canceled', 'expired')),
  current_period_start timestamptz not null default now(),
  -- null = open-ended (e.g. a pilot without an end date)
  current_period_end timestamptz,
  source text not null default 'manual' constraint organization_subscriptions_source_check
    check (source in ('manual', 'stripe')),
  stripe_customer_id text,
  stripe_subscription_id text unique,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_subscriptions_period_check
    check (current_period_end is null or current_period_end > current_period_start)
);

create index organization_subscriptions_plan_idx
  on public.organization_subscriptions using btree (plan_id);
create index organization_subscriptions_active_end_idx
  on public.organization_subscriptions using btree (current_period_end)
  where status = 'active';

create table public.ai_credit_reservations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  cycle_start timestamptz not null,
  amount integer not null constraint ai_credit_reservations_amount_check check (amount > 0),
  status text not null default 'reserved' constraint ai_credit_reservations_status_check
    check (status in ('reserved', 'committed', 'released')),
  purpose text not null,
  metadata jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  expires_at timestamptz not null,
  settled_at timestamptz,
  created_at timestamptz not null default now()
);

create index ai_credit_reservations_org_cycle_idx
  on public.ai_credit_reservations using btree (org_id, cycle_start)
  where status = 'reserved';
create index ai_credit_reservations_expiry_idx
  on public.ai_credit_reservations using btree (expires_at)
  where status = 'reserved';
create index ai_credit_reservations_user_idx
  on public.ai_credit_reservations using btree (user_id);

create table public.ai_credit_ledger (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  cycle_start timestamptz not null,
  kind text not null constraint ai_credit_ledger_kind_check
    check (kind in ('grant', 'usage', 'adjustment')),
  amount integer not null constraint ai_credit_ledger_amount_check check (
    amount <> 0
    and (kind <> 'grant' or amount > 0)
    and (kind <> 'usage' or amount < 0)
  ),
  reservation_id uuid references public.ai_credit_reservations (id) on delete set null,
  description text,
  created_by uuid references auth.users (id) on delete set null,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create index ai_credit_ledger_org_cycle_idx
  on public.ai_credit_ledger using btree (org_id, cycle_start);
create index ai_credit_ledger_reservation_idx
  on public.ai_credit_ledger using btree (reservation_id);
create index ai_credit_ledger_created_by_idx
  on public.ai_credit_ledger using btree (created_by);

create trigger plans_set_updated_at
  before update on public.plans
  for each row execute function private.tg_set_updated_at();

create trigger organization_subscriptions_set_updated_at
  before update on public.organization_subscriptions
  for each row execute function private.tg_set_updated_at();

-- ============================================================
-- Notification catalog for billing
-- ============================================================

insert into public.notification_types (id, label, category, description, default_in_app, default_email)
values
  ('subscription.activated', 'Plan activated', 'billing', 'A plan was activated for an organization you manage.', true, true),
  ('subscription.renewed', 'Plan renewed', 'billing', 'A plan was renewed for an organization you manage.', true, true),
  ('subscription.plan_changed', 'Plan changed', 'billing', 'The plan of an organization you manage changed.', true, true),
  ('subscription.expiring_soon', 'Plan expiring soon', 'billing', 'A plan ends within 7 days.', true, true),
  ('subscription.expired', 'Plan expired', 'billing', 'A plan expired and the organization is read-only.', true, true),
  ('subscription.canceled', 'Plan canceled', 'billing', 'A plan was canceled and the organization is read-only.', true, true);

-- ============================================================
-- Table privileges: customers only read; writes come from service_role
-- or the SECURITY DEFINER functions below.
-- ============================================================

grant select on
  public.plans,
  public.organization_subscriptions,
  public.ai_credit_reservations,
  public.ai_credit_ledger
to authenticated;

grant select, insert, update, delete on
  public.plans,
  public.organization_subscriptions,
  public.ai_credit_reservations,
  public.ai_credit_ledger
to service_role;

-- ============================================================
-- Entitlement helpers
-- ============================================================

-- Plan id when the org's subscription is active right now (null otherwise).
-- Checks the period directly so access ends on time even if the expiry job lags.
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
    and s.status = 'active'
    and s.current_period_start <= now()
    and (s.current_period_end is null or s.current_period_end > now());
$$;

-- Serializes seat and credit checks per org so concurrent requests cannot
-- both pass a count-then-insert check.
create or replace function private.lock_org(target_org uuid, scope text)
returns void
language sql
set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtextextended(scope || ':' || target_org::text, 0));
$$;

create or replace function private.credit_cycle_start(period_start timestamptz, at timestamptz)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select period_start + make_interval(
    months => (
      extract(year from age(at, period_start)) * 12
      + extract(month from age(at, period_start))
    )::integer
  );
$$;

grant execute on function private.active_plan_id(uuid) to authenticated, service_role;
grant execute on function private.credit_cycle_start(timestamptz, timestamptz) to authenticated, service_role;

-- ============================================================
-- Seat limits: members + pending invitations count as seats
-- ============================================================

create or replace function private.org_seats_used(target_org uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.organization_members m where m.org_id = target_org)::integer
    + (
      select count(*)
      from public.organization_invitations i
      where i.org_id = target_org
        and i.accepted_at is null
        and i.expires_at > now()
    )::integer;
$$;

create or replace function private.tg_enforce_invitation_seats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  seat_limit integer;
begin
  perform private.lock_org(new.org_id, 'seats');

  select p.max_members into seat_limit
  from public.plans p
  where p.id = private.active_plan_id(new.org_id);

  if not found then
    raise exception 'subscription_inactive';
  end if;

  if seat_limit is not null and private.org_seats_used(new.org_id) >= seat_limit then
    raise exception 'seat_limit_reached';
  end if;

  return new;
end;
$$;

create trigger organization_invitations_enforce_seats
  before insert on public.organization_invitations
  for each row execute function private.tg_enforce_invitation_seats();

-- Replaces the baseline version: same checks plus the plan's seat limit,
-- re-checked at acceptance in case the plan changed after inviting.
create or replace function public.accept_invitation(invite_token text)
returns table (org_id uuid, org_slug text, org_name text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  current_user_id uuid := auth.uid();
  current_user_email text;
  invitation record;
  seat_limit integer;
  member_count integer;
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select u.email into current_user_email
  from auth.users u
  where u.id = current_user_id;

  select i.* into invitation
  from public.organization_invitations i
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

  perform private.lock_org(invitation.org_id, 'seats');

  select p.max_members into seat_limit
  from public.plans p
  where p.id = private.active_plan_id(invitation.org_id);

  if not found then
    raise exception 'subscription_inactive';
  end if;

  select count(*) into member_count
  from public.organization_members m
  where m.org_id = invitation.org_id;

  if seat_limit is not null and member_count >= seat_limit then
    raise exception 'seat_limit_reached';
  end if;

  insert into public.organization_members (org_id, user_id, role, created_at)
  values (invitation.org_id, current_user_id, invitation.role, now())
  on conflict (org_id, user_id) do nothing;

  update public.organization_invitations
  set accepted_at = now()
  where public.organization_invitations.id = invitation.id;

  return query
  select o.id, o.slug, o.name
  from public.organizations o
  where o.id = invitation.org_id;
end;
$$;

-- ============================================================
-- AI credits
-- ============================================================

-- Grants the current cycle's allowance once (idempotent) and returns the
-- cycle start, or null when the org has no active subscription.
create or replace function private.ensure_ai_credit_grant(target_org uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  period_start timestamptz;
  monthly_credits integer;
  plan_name text;
  cycle timestamptz;
begin
  select s.current_period_start, p.monthly_ai_credits, p.name
  into period_start, monthly_credits, plan_name
  from public.organization_subscriptions s
  join public.plans p on p.id = s.plan_id
  where s.org_id = target_org
    and p.id = private.active_plan_id(target_org);

  if not found then
    return null;
  end if;

  cycle := private.credit_cycle_start(period_start, now());

  if monthly_credits > 0 then
    insert into public.ai_credit_ledger (org_id, cycle_start, kind, amount, description, idempotency_key)
    values (
      target_org,
      cycle,
      'grant',
      monthly_credits,
      'Monthly allowance (' || plan_name || ')',
      'grant:' || target_org::text || ':' || extract(epoch from cycle)::bigint::text
    )
    on conflict (idempotency_key) do nothing;
  end if;

  return cycle;
end;
$$;

create or replace function private.ai_credits_available(target_org uuid, cycle timestamptz)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((
      select sum(l.amount)
      from public.ai_credit_ledger l
      where l.org_id = target_org and l.cycle_start = cycle
    ), 0)::integer
    - coalesce((
      select sum(r.amount)
      from public.ai_credit_reservations r
      where r.org_id = target_org and r.cycle_start = cycle and r.status = 'reserved'
    ), 0)::integer;
$$;

-- Server-side only (service_role): the app authorizes the request, then holds
-- credits before calling the AI provider. Repeating the same idempotency key
-- returns the original reservation instead of holding credits twice.
create or replace function public.reserve_ai_credits(
  p_org_id uuid,
  p_user_id uuid,
  p_amount integer,
  p_purpose text,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb,
  p_ttl interval default interval '15 minutes'
)
returns public.ai_credit_reservations
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.ai_credit_reservations;
  created public.ai_credit_reservations;
  member_role text;
  cycle timestamptz;
begin
  select r.* into existing
  from public.ai_credit_reservations r
  where r.idempotency_key = p_idempotency_key;

  if found then
    return existing;
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  select m.role into member_role
  from public.organization_members m
  where m.org_id = p_org_id and m.user_id = p_user_id;

  if member_role is null or member_role not in ('owner', 'admin', 'member') then
    raise exception 'insufficient_role';
  end if;

  perform private.lock_org(p_org_id, 'ai_credits');

  cycle := private.ensure_ai_credit_grant(p_org_id);

  if cycle is null then
    raise exception 'subscription_inactive';
  end if;

  if private.ai_credits_available(p_org_id, cycle) < p_amount then
    raise exception 'insufficient_credits';
  end if;

  insert into public.ai_credit_reservations (
    org_id, user_id, cycle_start, amount, purpose, metadata, idempotency_key, expires_at
  )
  values (
    p_org_id, p_user_id, cycle, p_amount, p_purpose, p_metadata, p_idempotency_key, now() + p_ttl
  )
  returning * into created;

  return created;
end;
$$;

-- Charges the actual usage (defaults to the reserved amount, never more).
-- Committing twice is a no-op.
create or replace function public.commit_ai_credits(
  p_reservation_id uuid,
  p_amount integer default null
)
returns public.ai_credit_reservations
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation public.ai_credit_reservations;
  charged integer;
begin
  select r.* into reservation
  from public.ai_credit_reservations r
  where r.id = p_reservation_id
  for update;

  if not found then
    raise exception 'reservation_not_found';
  end if;

  if reservation.status = 'committed' then
    return reservation;
  end if;

  if reservation.status = 'released' then
    raise exception 'reservation_released';
  end if;

  charged := coalesce(p_amount, reservation.amount);

  if charged < 0 or charged > reservation.amount then
    raise exception 'invalid_amount';
  end if;

  if charged > 0 then
    insert into public.ai_credit_ledger (
      org_id, cycle_start, kind, amount, reservation_id, description, created_by, idempotency_key
    )
    values (
      reservation.org_id,
      reservation.cycle_start,
      'usage',
      -charged,
      reservation.id,
      reservation.purpose,
      reservation.user_id,
      'usage:' || reservation.id::text
    );
  end if;

  update public.ai_credit_reservations
  set status = 'committed', settled_at = now()
  where id = reservation.id
  returning * into reservation;

  return reservation;
end;
$$;

-- Returns held credits when the AI operation failed. Releasing twice is a no-op.
create or replace function public.release_ai_credits(p_reservation_id uuid)
returns public.ai_credit_reservations
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation public.ai_credit_reservations;
begin
  update public.ai_credit_reservations
  set status = 'released', settled_at = now()
  where id = p_reservation_id and status = 'reserved'
  returning * into reservation;

  if not found then
    select r.* into reservation
    from public.ai_credit_reservations r
    where r.id = p_reservation_id;

    if not found then
      raise exception 'reservation_not_found';
    end if;
  end if;

  return reservation;
end;
$$;

revoke execute on function public.reserve_ai_credits(uuid, uuid, integer, text, text, jsonb, interval) from public, anon, authenticated;
revoke execute on function public.commit_ai_credits(uuid, integer) from public, anon, authenticated;
revoke execute on function public.release_ai_credits(uuid) from public, anon, authenticated;
grant execute on function public.reserve_ai_credits(uuid, uuid, integer, text, text, jsonb, interval) to service_role;
grant execute on function public.commit_ai_credits(uuid, integer) to service_role;
grant execute on function public.release_ai_credits(uuid) to service_role;

-- ============================================================
-- Read RPCs for the app (SECURITY INVOKER: RLS decides visibility)
-- ============================================================

create or replace function public.get_organization_entitlements(target_org uuid)
returns table (
  org_id uuid,
  plan_id text,
  plan_name text,
  subscription_status text,
  is_active boolean,
  current_period_start timestamptz,
  current_period_end timestamptz,
  max_members integer,
  seats_used integer,
  max_active_searches integer,
  min_schedule_interval interval,
  history_months integer,
  monthly_ai_credits integer
)
language sql
stable
set search_path = ''
as $$
  select
    o.id,
    s.plan_id,
    p.name,
    s.status,
    private.active_plan_id(o.id) is not null,
    s.current_period_start,
    s.current_period_end,
    p.max_members,
    (
      (select count(*) from public.organization_members m where m.org_id = o.id)
      + (
        select count(*)
        from public.organization_invitations i
        where i.org_id = o.id and i.accepted_at is null and i.expires_at > now()
      )
    )::integer,
    p.max_active_searches,
    p.min_schedule_interval,
    p.history_months,
    p.monthly_ai_credits
  from public.organizations o
  left join public.organization_subscriptions s on s.org_id = o.id
  left join public.plans p on p.id = s.plan_id
  where o.id = target_org;
$$;

create or replace function public.get_ai_credit_balance(target_org uuid)
returns table (
  cycle_start timestamptz,
  cycle_end timestamptz,
  granted integer,
  used integer,
  reserved integer,
  available integer
)
language sql
stable
set search_path = ''
as $$
  with cycle as (
    select private.credit_cycle_start(s.current_period_start, now()) as start
    from public.organization_subscriptions s
    where s.org_id = target_org
      and private.active_plan_id(target_org) is not null
  ),
  totals as (
    select
      coalesce(sum(l.amount) filter (where l.amount > 0), 0)::integer as granted,
      coalesce(-sum(l.amount) filter (where l.amount < 0), 0)::integer as used
    from public.ai_credit_ledger l, cycle
    where l.org_id = target_org and l.cycle_start = cycle.start
  ),
  held as (
    select coalesce(sum(r.amount), 0)::integer as reserved
    from public.ai_credit_reservations r, cycle
    where r.org_id = target_org and r.cycle_start = cycle.start and r.status = 'reserved'
  )
  select
    cycle.start,
    cycle.start + interval '1 month',
    totals.granted,
    totals.used,
    held.reserved,
    totals.granted - totals.used - held.reserved
  from cycle, totals, held;
$$;

revoke execute on function public.get_organization_entitlements(uuid) from public, anon;
revoke execute on function public.get_ai_credit_balance(uuid) from public, anon;
grant execute on function public.get_organization_entitlements(uuid) to authenticated, service_role;
grant execute on function public.get_ai_credit_balance(uuid) to authenticated, service_role;

-- ============================================================
-- Subscription changes: audit log, notifications, credit grant
-- ============================================================

create or replace function private.tg_subscription_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_type text;
  org record;
  plan_name text;
  period_end_label text;
  title text;
  body text;
begin
  if tg_op = 'INSERT' then
    if new.status = 'active' then
      event_type := 'subscription.activated';
    end if;
  elsif new.status is distinct from old.status then
    event_type := case new.status
      when 'active' then 'subscription.activated'
      when 'canceled' then 'subscription.canceled'
      when 'expired' then 'subscription.expired'
    end;
  elsif new.status = 'active' and new.plan_id is distinct from old.plan_id then
    event_type := 'subscription.plan_changed';
  elsif new.status = 'active' and new.current_period_end is distinct from old.current_period_end then
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

  period_end_label := coalesce(
    to_char(new.current_period_end at time zone 'America/Tegucigalpa', 'FMMonth FMDD, YYYY'),
    'no end date'
  );

  title := case event_type
    when 'subscription.activated' then org.name || ' is now on the ' || plan_name || ' plan'
    when 'subscription.renewed' then org.name || ' plan renewed'
    when 'subscription.plan_changed' then org.name || ' moved to the ' || plan_name || ' plan'
    when 'subscription.canceled' then org.name || ' subscription canceled'
    when 'subscription.expired' then org.name || ' subscription expired'
  end;

  body := case event_type
    when 'subscription.activated' then 'The plan is active until ' || period_end_label || '.'
    when 'subscription.renewed' then 'The ' || plan_name || ' plan is now active until ' || period_end_label || '.'
    when 'subscription.plan_changed' then 'The plan is active until ' || period_end_label || '.'
    else 'The organization is read-only until a plan is activated again.'
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
    event_type || ':' || new.org_id::text || ':' || extract(epoch from now())::bigint::text
  );

  if new.status = 'active' then
    perform private.ensure_ai_credit_grant(new.org_id);
  end if;

  return null;
end;
$$;

create trigger organization_subscriptions_changed
  after insert or update on public.organization_subscriptions
  for each row execute function private.tg_subscription_changed();

create or replace function private.tg_subscription_set_canceled_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'canceled' and old.status is distinct from 'canceled' then
    new.canceled_at := now();
  elsif new.status <> 'canceled' then
    new.canceled_at := null;
  end if;
  return new;
end;
$$;

create trigger organization_subscriptions_set_canceled_at
  before update of status on public.organization_subscriptions
  for each row execute function private.tg_subscription_set_canceled_at();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.plans enable row level security;
alter table public.organization_subscriptions enable row level security;
alter table public.ai_credit_reservations enable row level security;
alter table public.ai_credit_ledger enable row level security;

create policy "Plans readable"
on public.plans for select to authenticated
using (true);

create policy "Subscriptions read by org members"
on public.organization_subscriptions for select to authenticated
using (private.user_org_role(org_id) is not null);

create policy "Credit reservations read by org members"
on public.ai_credit_reservations for select to authenticated
using (private.user_org_role(org_id) is not null);

create policy "Credit ledger read by org members"
on public.ai_credit_ledger for select to authenticated
using (private.user_org_role(org_id) is not null);
