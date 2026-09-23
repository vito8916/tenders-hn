-- Notifications: in-app inbox, per-user preferences, and an email outbox.
--
-- Flow:
--   domain trigger -> private.notify()
--     -> notifications row        (if the recipient wants it in-app)
--     -> notification_deliveries  (if the recipient wants it by email)
--   pg_cron -> edge function `send-notification-emails` drains the outbox.
--
-- Notifications are only created by SECURITY DEFINER code, never by clients.
-- A dedupe_key makes each logical notification idempotent per recipient.

-- ============================================================
-- Tables
-- ============================================================

create table public.notification_types (
  id text primary key,
  label text not null,
  category text not null constraint notification_types_category_check
    check (category in ('organization', 'billing')),
  description text not null,
  default_in_app boolean not null default true,
  default_email boolean not null default false
);

create table public.notification_preferences (
  user_id uuid not null references auth.users (id) on delete cascade,
  type_id text not null references public.notification_types (id) on delete cascade,
  in_app boolean not null,
  email boolean not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, type_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  org_id uuid references public.organizations (id) on delete cascade,
  type_id text not null references public.notification_types (id),
  title text not null,
  body text,
  action_url text,
  data jsonb not null default '{}'::jsonb,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx
  on public.notifications using btree (user_id, created_at desc);
create index notifications_user_unread_idx
  on public.notifications using btree (user_id) where read_at is null;
create index notifications_org_idx on public.notifications using btree (org_id);
create unique index notifications_user_dedupe_uidx
  on public.notifications using btree (user_id, dedupe_key);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references public.notifications (id) on delete set null,
  user_id uuid not null references auth.users (id) on delete cascade,
  org_id uuid references public.organizations (id) on delete cascade,
  type_id text not null references public.notification_types (id),
  channel text not null default 'email' constraint notification_deliveries_channel_check
    check (channel in ('email')),
  recipient text not null,
  subject text not null,
  title text not null,
  body text,
  action_url text,
  status text not null default 'pending' constraint notification_deliveries_status_check
    check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  provider_message_id text,
  idempotency_key text not null unique,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index notification_deliveries_due_idx
  on public.notification_deliveries using btree (next_attempt_at)
  where status in ('pending', 'sending');
create index notification_deliveries_user_idx
  on public.notification_deliveries using btree (user_id);
create index notification_deliveries_org_idx
  on public.notification_deliveries using btree (org_id);
create index notification_deliveries_notification_idx
  on public.notification_deliveries using btree (notification_id);

-- ============================================================
-- Notification catalog (organization events; billing types are
-- added by the billing migration)
-- ============================================================

insert into public.notification_types (id, label, category, description, default_in_app, default_email)
values
  ('organization.member_joined', 'New members', 'organization', 'Someone joined an organization you manage.', true, false),
  ('organization.member_removed', 'Removed from an organization', 'organization', 'You were removed from an organization.', true, true),
  ('organization.role_changed', 'Role changes', 'organization', 'Your role in an organization changed.', true, true),
  ('organization.ownership_transferred', 'Ownership transfers', 'organization', 'You became the owner of an organization.', true, true),
  ('invitation.received', 'Invitations', 'organization', 'You were invited to join an organization.', true, false);

-- ============================================================
-- Table privileges
-- ============================================================

grant select on public.notification_types to authenticated;
grant select, insert, update, delete on public.notification_preferences to authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

grant select, insert, update, delete on
  public.notification_types,
  public.notification_preferences,
  public.notifications,
  public.notification_deliveries
to service_role;

-- ============================================================
-- Core: private.notify
-- ============================================================

create or replace function private.notify(
  p_user_id uuid,
  p_org_id uuid,
  p_type_id text,
  p_title text,
  p_body text default null,
  p_action_url text default null,
  p_data jsonb default '{}'::jsonb,
  p_dedupe_key text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  wants_in_app boolean;
  wants_email boolean;
  recipient_email text;
  created_notification_id uuid;
begin
  select
    coalesce(pref.in_app, t.default_in_app),
    coalesce(pref.email, t.default_email)
  into wants_in_app, wants_email
  from public.notification_types t
  left join public.notification_preferences pref
    on pref.type_id = t.id and pref.user_id = p_user_id
  where t.id = p_type_id;

  if not found then
    raise exception 'unknown_notification_type: %', p_type_id;
  end if;

  if wants_in_app then
    insert into public.notifications (user_id, org_id, type_id, title, body, action_url, data, dedupe_key)
    values (p_user_id, p_org_id, p_type_id, p_title, p_body, p_action_url, p_data, p_dedupe_key)
    on conflict (user_id, dedupe_key) do nothing
    returning id into created_notification_id;
  end if;

  if wants_email then
    select u.email into recipient_email
    from auth.users u
    where u.id = p_user_id;

    if recipient_email is not null then
      insert into public.notification_deliveries (
        notification_id, user_id, org_id, type_id, recipient,
        subject, title, body, action_url, idempotency_key
      )
      values (
        created_notification_id, p_user_id, p_org_id, p_type_id, recipient_email,
        p_title, p_title, p_body, p_action_url,
        p_user_id::text || ':' || coalesce(p_dedupe_key, gen_random_uuid()::text)
      )
      on conflict (idempotency_key) do nothing;
    end if;
  end if;
end;
$$;

-- Owners and admins of an organization, optionally excluding one user
-- (usually the actor, who does not need to be told about their own action).
create or replace function private.notify_org_managers(
  p_org_id uuid,
  p_type_id text,
  p_title text,
  p_body text default null,
  p_action_url text default null,
  p_data jsonb default '{}'::jsonb,
  p_dedupe_key text default null,
  p_exclude_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  manager_id uuid;
begin
  for manager_id in
    select m.user_id
    from public.organization_members m
    where m.org_id = p_org_id
      and m.role in ('owner', 'admin')
      and m.user_id is distinct from p_exclude_user_id
  loop
    perform private.notify(
      manager_id, p_org_id, p_type_id, p_title, p_body, p_action_url, p_data, p_dedupe_key
    );
  end loop;
end;
$$;

create or replace function private.display_name(target_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(btrim(p.full_name), ''), p.email, 'Someone')
  from public.profiles p
  where p.id = target_user;
$$;

-- ============================================================
-- Outbox RPC for the email dispatcher (service_role only)
-- ============================================================

-- Claims due deliveries with SKIP LOCKED so concurrent dispatcher runs never
-- send the same row twice. Rows stuck in 'sending' for 10 minutes (crashed
-- dispatcher) are reclaimed; the provider idempotency key prevents duplicates.
create or replace function public.claim_notification_deliveries(batch_size integer default 25)
returns setof public.notification_deliveries
language sql
set search_path = ''
as $$
  update public.notification_deliveries d
  set status = 'sending',
      attempts = d.attempts + 1,
      locked_at = now()
  where d.id in (
    select candidate.id
    from public.notification_deliveries candidate
    where candidate.attempts < 5
      and (
        (candidate.status = 'pending' and candidate.next_attempt_at <= now())
        or (candidate.status = 'sending' and candidate.locked_at < now() - interval '10 minutes')
      )
    order by candidate.next_attempt_at
    limit batch_size
    for update skip locked
  )
  returning d.*;
$$;

revoke execute on function public.claim_notification_deliveries(integer) from public, anon, authenticated;
grant execute on function public.claim_notification_deliveries(integer) to service_role;

-- ============================================================
-- Domain triggers: memberships and invitations
-- ============================================================

create or replace function private.tg_notify_membership_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  org record;
begin
  select o.id, o.name, o.slug into org
  from public.organizations o
  where o.id = coalesce(new.org_id, old.org_id);

  -- Organization is being deleted (cascade): nothing to announce.
  if org.id is null then
    return null;
  end if;

  if tg_op = 'INSERT' and new.role <> 'owner' then
    perform private.notify_org_managers(
      org.id,
      'organization.member_joined',
      private.display_name(new.user_id) || ' joined ' || org.name,
      'They joined as ' || new.role || '.',
      '/organizations/' || org.slug || '/members',
      jsonb_build_object('member_user_id', new.user_id, 'role', new.role),
      'member_joined:' || new.id::text,
      new.user_id
    );

  elsif tg_op = 'UPDATE' and new.role is distinct from old.role then
    if new.role = 'owner' then
      if new.user_id is distinct from actor_id then
        perform private.notify(
          new.user_id,
          org.id,
          'organization.ownership_transferred',
          'You are now the owner of ' || org.name,
          private.display_name(actor_id) || ' transferred ownership of the organization to you.',
          '/organizations/' || org.slug || '/settings/organization',
          jsonb_build_object('previous_owner_id', actor_id),
          'ownership_transferred:' || new.id::text || ':' || extract(epoch from now())::bigint::text
        );
      end if;
    -- The previous owner is demoted to admin as part of their own transfer.
    elsif old.role <> 'owner' and new.user_id is distinct from actor_id then
      perform private.notify(
        new.user_id,
        org.id,
        'organization.role_changed',
        'Your role in ' || org.name || ' is now ' || new.role,
        'Your role changed from ' || old.role || ' to ' || new.role || '.',
        '/organizations/' || org.slug,
        jsonb_build_object('previous_role', old.role, 'role', new.role),
        'role_changed:' || new.id::text || ':' || extract(epoch from now())::bigint::text
      );
    end if;

  -- Skipped when the membership disappears because the user account is deleted.
  elsif tg_op = 'DELETE'
    and old.user_id is distinct from actor_id
    and exists (select 1 from auth.users u where u.id = old.user_id)
  then
    perform private.notify(
      old.user_id,
      org.id,
      'organization.member_removed',
      'You were removed from ' || org.name,
      'You no longer have access to this organization.',
      '/organizations',
      jsonb_build_object('role', old.role),
      'member_removed:' || old.id::text
    );
  end if;

  return null;
end;
$$;

create trigger organization_members_notify
  after insert or update of role or delete on public.organization_members
  for each row execute function private.tg_notify_membership_changes();

-- Invitees who already have an account also get an in-app notification.
-- The invitation email itself is sent by the app (features/invitations).
create or replace function private.tg_notify_invitation_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitee_id uuid;
  org_name text;
begin
  select u.id into invitee_id
  from auth.users u
  where lower(u.email) = lower(new.email::text);

  if invitee_id is null then
    return null;
  end if;

  select o.name into org_name
  from public.organizations o
  where o.id = new.org_id;

  perform private.notify(
    invitee_id,
    null,
    'invitation.received',
    'You were invited to join ' || org_name,
    'You were invited as ' || new.role || '.',
    '/invitations/' || new.token,
    jsonb_build_object('invitation_id', new.id, 'org_id', new.org_id, 'role', new.role),
    'invitation:' || new.id::text
  );

  return null;
end;
$$;

create trigger organization_invitations_notify
  after insert on public.organization_invitations
  for each row execute function private.tg_notify_invitation_created();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.notification_types enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_deliveries enable row level security;

create policy "Notification types readable"
on public.notification_types for select to authenticated
using (true);

create policy "Notification preferences manage own"
on public.notification_preferences for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Notifications read own"
on public.notifications for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Notifications mark own as read"
on public.notifications for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Notifications delete own"
on public.notifications for delete to authenticated
using ((select auth.uid()) = user_id);

-- notification_deliveries: no policies; only service_role touches the outbox.

-- ============================================================
-- Realtime: live updates for the header bell (RLS still applies)
-- ============================================================

alter publication supabase_realtime add table public.notifications;
