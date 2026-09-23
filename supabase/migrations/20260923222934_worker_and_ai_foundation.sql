-- Phase 0 foundation for the background worker and the AI layer.
--
-- Extensions used by later phases (retrieval, queues) are enabled here so
-- local, staging, and production share one baseline.
--
-- Queues (pgmq) are consumed by the `worker/` package over a direct Postgres
-- connection. pg_cron only enqueues; the worker never schedules itself.
--
-- AI tables:
--   ai_usage_events  one row per model call (role, model, tokens, latency, status)
--   ai_model_rates   credits per 1K tokens per model id, edited by the admin app

-- ============================================================
-- Extensions
-- ============================================================

create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pgmq;

-- Queues are internal: only the worker (postgres role) and service_role use them.
revoke all on schema pgmq from anon, authenticated;

-- ============================================================
-- Queues
-- ============================================================

select pgmq.create('maintenance');

-- ============================================================
-- Worker liveness
-- ============================================================

create table public.worker_heartbeats (
  worker_id text primary key,
  version text,
  started_at timestamptz not null,
  last_heartbeat_at timestamptz not null default now()
);

grant select, insert, update, delete on public.worker_heartbeats to service_role;
alter table public.worker_heartbeats enable row level security;
-- No policies: read by the admin app with the service role.

-- Enqueue a heartbeat only when none is waiting, so a stopped worker does
-- not come back to a backlog of stale heartbeats.
create or replace function private.enqueue_worker_heartbeat()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from pgmq.q_maintenance q where q.message ->> 'type' = 'heartbeat'
  ) then
    perform pgmq.send('maintenance', jsonb_build_object('type', 'heartbeat', 'enqueued_at', now()));
  end if;
end;
$$;

select cron.schedule('enqueue-worker-heartbeat', '* * * * *', 'select private.enqueue_worker_heartbeat()');

-- ============================================================
-- AI usage and pricing
-- ============================================================

create table public.ai_usage_events (
  id bigint generated always as identity primary key,
  org_id uuid references public.organizations (id) on delete set null,
  role text not null constraint ai_usage_events_role_check
    check (role in ('evaluate', 'chat', 'embed', 'rerank', 'vision', 'extract')),
  model text not null,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  status text not null constraint ai_usage_events_status_check
    check (status in ('succeeded', 'failed')),
  error text,
  -- What the call was for, e.g. {"type": "chat_message", "id": "..."}
  reference jsonb,
  created_at timestamptz not null default now()
);

create index ai_usage_events_org_created_idx
  on public.ai_usage_events using btree (org_id, created_at desc);
create index ai_usage_events_role_model_created_idx
  on public.ai_usage_events using btree (role, model, created_at desc);

create table public.ai_model_rates (
  model text primary key,
  credits_per_1k_input numeric(10, 4) not null
    constraint ai_model_rates_input_check check (credits_per_1k_input >= 0),
  credits_per_1k_output numeric(10, 4) not null
    constraint ai_model_rates_output_check check (credits_per_1k_output >= 0),
  is_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create trigger ai_model_rates_set_updated_at
  before update on public.ai_model_rates
  for each row execute function private.tg_set_updated_at();

grant select, insert, update, delete on public.ai_usage_events, public.ai_model_rates to service_role;
-- Rates are not secret: the UI shows estimated credit costs before a request.
grant select on public.ai_model_rates to authenticated;

alter table public.ai_usage_events enable row level security;
alter table public.ai_model_rates enable row level security;

-- ai_usage_events: no policies; written by the worker and server code with the
-- service role, read by the admin app.

create policy "AI model rates readable"
on public.ai_model_rates for select to authenticated
using (true);
