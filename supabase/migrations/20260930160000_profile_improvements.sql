-- «Mejorar con IA» on the company profile's text fields: the web app asks
-- the `rewrite` model to improve one field. Each user gets 3 improvements
-- per field per day (Honduras time), in onboarding (before the organization exists) and in settings.
--
-- Calls are recorded in ai_usage_events, which now carries the user. A call
-- is claimed as `pending` before the model runs, so parallel clicks cannot
-- pass the limit, and finished as `succeeded` or `failed`; failed calls do
-- not count.

alter table public.ai_usage_events
  add column user_id uuid references auth.users (id) on delete set null;

alter table public.ai_usage_events drop constraint ai_usage_events_role_check;
alter table public.ai_usage_events add constraint ai_usage_events_role_check
  check (role in ('evaluate', 'chat', 'embed', 'rerank', 'vision', 'extract', 'rewrite'));

alter table public.ai_usage_events drop constraint ai_usage_events_status_check;
alter table public.ai_usage_events add constraint ai_usage_events_status_check
  check (status in ('pending', 'succeeded', 'failed'));

create index ai_usage_events_user_created_idx
  on public.ai_usage_events using btree (user_id, created_at desc)
  where user_id is not null;

-- Improvements of one field the user has left today; pending ones count as used.
create function private.profile_improvements_left(target_user uuid, target_field text)
returns integer
language sql
stable
set search_path = ''
as $$
  select greatest(3 - count(*)::integer, 0)
  from public.ai_usage_events
  where user_id = target_user
    and role = 'rewrite'
    and status <> 'failed'
    and reference ->> 'type' = 'profile_improvement'
    and reference ->> 'field' = target_field
    and created_at >= (date_trunc('day', now() at time zone 'America/Tegucigalpa') at time zone 'America/Tegucigalpa');
$$;

-- Improvements left today for each field.
create function public.profile_improvements_remaining()
returns table (field text, remaining integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  return query
  select f.field, private.profile_improvements_left(auth.uid(), f.field)
  from unnest(array['description', 'offerings', 'exclusions']) as f (field);
end;
$$;

-- Claims one improvement of a field for the current user and returns the
-- usage event to finish. target_org is null during onboarding; otherwise the
-- user must be able to edit the organization's profile.
-- Raises improvement_limit_reached when today's improvements are used up.
create function public.claim_profile_improvement(target_field text, used_model text, target_org uuid default null)
returns table (event_id bigint, remaining integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  left_today integer;
  new_event_id bigint;
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;
  if target_field not in ('description', 'offerings', 'exclusions') then
    raise exception 'invalid_field';
  end if;
  if target_org is not null and coalesce(private.user_org_role(target_org), '') not in ('owner', 'admin') then
    raise exception 'insufficient_role';
  end if;

  -- Serializes claims for the same user and field.
  perform pg_advisory_xact_lock(hashtextextended('profile_improvement:' || current_user_id::text || ':' || target_field, 0));

  left_today := private.profile_improvements_left(current_user_id, target_field);
  if left_today = 0 then
    raise exception 'improvement_limit_reached';
  end if;

  insert into public.ai_usage_events (org_id, user_id, role, model, status, reference)
  values (
    target_org,
    current_user_id,
    'rewrite',
    used_model,
    'pending',
    jsonb_build_object('type', 'profile_improvement', 'field', target_field)
  )
  returning id into new_event_id;

  return query select new_event_id, left_today - 1;
end;
$$;

-- Records how a claimed improvement ended. A failed one gives the claim back.
create function public.finish_profile_improvement(
  target_event bigint,
  succeeded boolean,
  response_model text default null,
  used_input_tokens integer default null,
  used_output_tokens integer default null,
  used_latency_ms integer default null,
  error_message text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  update public.ai_usage_events
  set status = case when succeeded then 'succeeded' else 'failed' end,
      model = coalesce(response_model, model),
      input_tokens = used_input_tokens,
      output_tokens = used_output_tokens,
      latency_ms = used_latency_ms,
      error = left(error_message, 1000)
  where id = target_event
    and user_id = auth.uid()
    and role = 'rewrite'
    and status = 'pending';
end;
$$;

revoke execute on function public.profile_improvements_remaining() from public, anon;
revoke execute on function public.claim_profile_improvement(text, text, uuid) from public, anon;
revoke execute on function public.finish_profile_improvement(bigint, boolean, text, integer, integer, integer, text) from public, anon;
grant execute on function public.profile_improvements_remaining() to authenticated;
grant execute on function public.claim_profile_improvement(text, text, uuid) to authenticated;
grant execute on function public.finish_profile_improvement(bigint, boolean, text, integer, integer, integer, text) to authenticated;
