-- Phase 4: notifications in Spanish (D1).
--
-- The notification catalog and every function that writes notification
-- titles, bodies, and email subjects switch to Spanish: formal «usted», roles
-- as Propietario / Administrador / Miembro / Observador, and dates as
-- DD/MM/YYYY. Only the text changes; signatures, security settings,
-- search_path, and grants stay as they were. Notifications and queued emails
-- already stored keep their English text.
--
-- Definitions copied from:
--   private.display_name, private.tg_notify_membership_changes,
--   private.tg_notify_invitation_created  20260923211855_notifications.sql
--   private.tg_subscription_changed       20260923211856_billing_and_entitlements.sql
--   private.warn_expiring_subscriptions   20260923211858_scheduled_jobs.sql

-- ============================================================
-- Notification catalog
-- ============================================================

update public.notification_types as t
set label = v.label, description = v.description
from (values
  ('organization.member_joined', 'Nuevos miembros', 'Alguien se unió a una organización que usted administra.'),
  ('organization.member_removed', 'Retiro de una organización', 'Ya no es miembro de una organización.'),
  ('organization.role_changed', 'Cambios de rol', 'Su rol en una organización cambió.'),
  ('organization.ownership_transferred', 'Transferencias de propiedad', 'Ahora es el propietario de una organización.'),
  ('invitation.received', 'Invitaciones', 'Recibió una invitación para unirse a una organización.'),
  ('subscription.activated', 'Plan activado', 'Se activó un plan en una organización que usted administra.'),
  ('subscription.renewed', 'Plan renovado', 'Se renovó el plan de una organización que usted administra.'),
  ('subscription.plan_changed', 'Cambio de plan', 'Cambió el plan de una organización que usted administra.'),
  ('subscription.expiring_soon', 'Plan por vencer', 'Un plan vence en los próximos 7 días.'),
  ('subscription.expired', 'Plan vencido', 'Un plan venció y la organización quedó en modo de solo lectura.'),
  ('subscription.canceled', 'Plan cancelado', 'Se canceló un plan y la organización quedó en modo de solo lectura.')
) as v (id, label, description)
where t.id = v.id;

-- ============================================================
-- Display name fallback
-- ============================================================

create or replace function private.display_name(target_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(btrim(p.full_name), ''), p.email, 'Alguien')
  from public.profiles p
  where p.id = target_user;
$$;

-- ============================================================
-- Memberships and invitations
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
  new_role_label text := case new.role
    when 'owner' then 'Propietario'
    when 'admin' then 'Administrador'
    when 'member' then 'Miembro'
    when 'viewer' then 'Observador'
    else new.role
  end;
  old_role_label text := case old.role
    when 'owner' then 'Propietario'
    when 'admin' then 'Administrador'
    when 'member' then 'Miembro'
    when 'viewer' then 'Observador'
    else old.role
  end;
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
      private.display_name(new.user_id) || ' se unió a ' || org.name,
      'Se unió como ' || new_role_label || '.',
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
          'Ahora es el propietario de ' || org.name,
          private.display_name(actor_id) || ' le transfirió la propiedad de la organización.',
          '/organizations/' || org.slug || '/settings/organization',
          jsonb_build_object('previous_owner_id', actor_id),
          'ownership_transferred:' || new.id::text || ':' || extract(epoch from clock_timestamp())::text
        );
      end if;
    -- The previous owner is demoted to admin as part of their own transfer.
    elsif old.role <> 'owner' and new.user_id is distinct from actor_id then
      perform private.notify(
        new.user_id,
        org.id,
        'organization.role_changed',
        'Su rol en ' || org.name || ' ahora es ' || new_role_label,
        'Su rol cambió de ' || old_role_label || ' a ' || new_role_label || '.',
        '/organizations/' || org.slug,
        jsonb_build_object('previous_role', old.role, 'role', new.role),
        'role_changed:' || new.id::text || ':' || extract(epoch from clock_timestamp())::text
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
      'Ya no es miembro de ' || org.name,
      'Ya no tiene acceso a esta organización.',
      '/organizations',
      jsonb_build_object('role', old.role),
      'member_removed:' || old.id::text
    );
  end if;

  return null;
end;
$$;

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
  role_label text := case new.role
    when 'owner' then 'Propietario'
    when 'admin' then 'Administrador'
    when 'member' then 'Miembro'
    when 'viewer' then 'Observador'
    else new.role
  end;
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
    'Recibió una invitación para unirse a ' || org_name,
    'Se le invitó como ' || role_label || '.',
    '/invitations/' || new.token,
    jsonb_build_object('invitation_id', new.id, 'org_id', new.org_id, 'role', new.role),
    'invitation:' || new.id::text
  );

  return null;
end;
$$;

-- ============================================================
-- Subscriptions
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
    'hasta el ' || to_char(new.current_period_end at time zone 'America/Tegucigalpa', 'DD/MM/YYYY'),
    'sin fecha de vencimiento'
  );

  title := case event_type
    when 'subscription.activated' then org.name || ' ahora tiene el plan ' || plan_name
    when 'subscription.renewed' then 'Se renovó el plan de ' || org.name
    when 'subscription.plan_changed' then org.name || ' cambió al plan ' || plan_name
    when 'subscription.canceled' then 'Se canceló la suscripción de ' || org.name
    when 'subscription.expired' then 'Venció la suscripción de ' || org.name
  end;

  body := case event_type
    when 'subscription.activated' then 'El plan está activo ' || period_end_label || '.'
    when 'subscription.renewed' then 'El plan ' || plan_name || ' está activo ' || period_end_label || '.'
    when 'subscription.plan_changed' then 'El plan está activo ' || period_end_label || '.'
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
      || coalesce(extract(epoch from new.current_period_end)::bigint::text, 'open')
  );

  if new.status = 'active' then
    perform private.ensure_ai_credit_grant(new.org_id);
  end if;

  return null;
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
