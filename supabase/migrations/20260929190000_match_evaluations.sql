-- Phase 3: Jev evaluations of retrieved candidates (spec §5, step 5).
--
--   match_evaluations  one row per distinct evaluation input: the company
--                      profile, the process version, the evidence sent, the
--                      questions version, and the model. Identical inputs are
--                      evaluated once, and comparing models or question
--                      versions never overwrites earlier results.
--
-- Written by the `evaluate_match` job on its own `match` queue, so Jev calls
-- never wait behind OCR or a sync. Service role only: organizations will see
-- the outcome through their runs' matches, not the raw evaluations.

select pgmq.create('match');

create table public.match_evaluations (
  id uuid primary key default gen_random_uuid(),
  -- sha256 of the model, questions version, and state (profile + process + evidence).
  input_hash text not null constraint match_evaluations_input_hash_key unique,
  process_id uuid not null references public.procurement_processes (id) on delete cascade,
  process_version_id uuid not null references public.process_versions (id) on delete cascade,
  -- As requested from the registry, and as the provider reported it (decision O4).
  model text not null,
  response_model text,
  questions_version text not null,
  -- The state and questions exactly as sent.
  request jsonb not null,
  -- What went into the state and what the token budget left out.
  evidence jsonb not null,
  -- Per question: value (probability or score) and the probabilities returned.
  answers jsonb,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  status text not null constraint match_evaluations_status_check
    check (status in ('succeeded', 'failed')),
  attempts integer not null default 1,
  error text,
  created_at timestamptz not null default now(),
  evaluated_at timestamptz not null default now()
);

create index match_evaluations_process_idx
  on public.match_evaluations using btree (process_id, evaluated_at desc);

grant select, insert, update, delete on public.match_evaluations to service_role;

alter table public.match_evaluations enable row level security;
