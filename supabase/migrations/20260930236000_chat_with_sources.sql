-- Phase 5: chat with sources (spec §8).
--
--   chat_threads   one conversation per user and context: an opportunity
--                  (a process) or a report (a search run). Only its author
--                  reads it; other members, admins included, do not.
--   chat_messages  the user's questions and the answers, with the citations
--                  validated by the server (plan §5.4) and what each answer cost.
--
-- The web app writes through three RPCs that run as the user:
--   start_chat_turn   stores the question, reserves the estimated credits
--                     (rate × estimated tokens, at least 1), and creates the
--                     pending answer
--   finish_chat_turn  stores the answer, charges its real usage (never more
--                     than reserved), and records it in ai_usage_events
--   fail_chat_turn    gives the credits back
-- A turn that never finishes is released with its reservation by the
-- release-expired-ai-credit-reservations job, and its answer marked failed.
--
-- retrieve_chat_passages picks the document passages for a question.

-- ============================================================
-- Tables
-- ============================================================

create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  context_type text not null constraint chat_threads_context_type_check
    check (context_type in ('opportunity', 'report')),
  process_id uuid references public.procurement_processes (id) on delete cascade,
  search_run_id uuid references public.search_runs (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_threads_context_check check (
    (context_type = 'opportunity' and process_id is not null and search_run_id is null)
    or (context_type = 'report' and search_run_id is not null and process_id is null)
  )
);

create unique index chat_threads_opportunity_key
  on public.chat_threads using btree (org_id, user_id, process_id)
  where context_type = 'opportunity';
create unique index chat_threads_report_key
  on public.chat_threads using btree (org_id, user_id, search_run_id)
  where context_type = 'report';
create index chat_threads_user_idx on public.chat_threads using btree (user_id);
create index chat_threads_process_idx on public.chat_threads using btree (process_id);
create index chat_threads_run_idx on public.chat_threads using btree (search_run_id);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null constraint chat_messages_role_check check (role in ('user', 'assistant')),
  -- The id useChat gave the question; sending it twice is refused.
  client_message_id text,
  content text not null default '',
  status text not null default 'completed' constraint chat_messages_status_check
    check (status in ('pending', 'completed', 'failed')),
  -- [{ id, kind, processId, documentId, documentVersionId, title, pageStart, pageEnd, url }]
  citations jsonb not null default '[]',
  -- The answer cited an unknown source or no source at all.
  unverified boolean not null default false,
  model text,
  input_tokens integer,
  output_tokens integer,
  credits_charged integer,
  credit_reservation_id uuid references public.ai_credit_reservations (id) on delete set null,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint chat_messages_thread_client_id_key unique (thread_id, client_message_id)
);

create index chat_messages_thread_created_idx on public.chat_messages using btree (thread_id, created_at);
create index chat_messages_org_idx on public.chat_messages using btree (org_id);
create index chat_messages_user_idx on public.chat_messages using btree (user_id);
create index chat_messages_reservation_idx on public.chat_messages using btree (credit_reservation_id);

create trigger chat_threads_set_updated_at
  before update on public.chat_threads
  for each row execute function private.tg_set_updated_at();

grant select on public.chat_threads, public.chat_messages to authenticated;
grant select, insert, update, delete on public.chat_threads, public.chat_messages to service_role;

alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;

create policy "Authors read their conversations" on public.chat_threads
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.user_org_role(org_id)) is not null);

create policy "Authors read their messages" on public.chat_messages
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.user_org_role(org_id)) is not null);

-- ============================================================
-- Credits for the chat model: about 1 credit per US$0.01 of model cost
-- (decided 30 Sep 2026, provisional). GPT-6 Luna on the AI Gateway costs
-- US$0.10 per million input tokens and US$0.50 per million output tokens.
-- The admin app owns this table; existing rows are left as they are.
-- ============================================================

insert into public.ai_model_rates (model, credits_per_1k_input, credits_per_1k_output)
values ('openai/gpt-6-luna', 0.0100, 0.0500)
on conflict (model) do nothing;

-- Credits for a number of tokens at a model's rate: rounded up, at least 1.
create function private.chat_credits(rates public.ai_model_rates, input_tokens integer, output_tokens integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select greatest(
    1,
    ceil(coalesce(input_tokens, 0) / 1000.0 * rates.credits_per_1k_input
       + coalesce(output_tokens, 0) / 1000.0 * rates.credits_per_1k_output)::integer
  );
$$;

-- ============================================================
-- Turns
-- ============================================================

-- Stores a question, reserves its estimated credits, and returns the pending
-- answer to finish. target_context is 'opportunity' (target_id: a process)
-- or 'report' (target_id: a search run of the organization within the plan's
-- history). Owners, admins, and members chat; viewers do not, as with every
-- use of credits. Raises not_authenticated, insufficient_role,
-- invalid_question, chat_context_not_found, chat_model_unavailable,
-- chat_turn_exists, subscription_inactive, or insufficient_credits.
create function public.start_chat_turn(
  target_org uuid,
  target_context text,
  target_id uuid,
  question text,
  client_message_id text,
  used_model text,
  estimated_input_tokens integer,
  max_output_tokens integer
)
returns table (thread_id uuid, user_message_id uuid, assistant_message_id uuid, reserved_credits integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  rates public.ai_model_rates;
  estimate integer;
  the_thread uuid;
  the_question uuid;
  the_answer uuid;
  reservation public.ai_credit_reservations;
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;
  if coalesce(private.user_org_role(target_org), '') not in ('owner', 'admin', 'member') then
    raise exception 'insufficient_role';
  end if;
  if length(btrim(coalesce(question, ''))) = 0 or length(question) > 2000 or length(coalesce(client_message_id, '')) = 0 then
    raise exception 'invalid_question';
  end if;

  if target_context = 'opportunity' then
    perform 1 from public.procurement_processes where id = target_id;
  elsif target_context = 'report' then
    perform 1 from public.search_runs
    where id = target_id and org_id = target_org and created_at >= private.history_cutoff(target_org);
  end if;
  if target_context not in ('opportunity', 'report') or not found then
    raise exception 'chat_context_not_found';
  end if;

  select r.* into rates from public.ai_model_rates r where r.model = used_model and r.is_enabled;
  if not found then
    raise exception 'chat_model_unavailable';
  end if;
  estimate := private.chat_credits(rates, estimated_input_tokens, max_output_tokens);

  insert into public.chat_threads (org_id, user_id, context_type, process_id, search_run_id)
  values (
    target_org,
    current_user_id,
    target_context,
    case when target_context = 'opportunity' then target_id end,
    case when target_context = 'report' then target_id end
  )
  on conflict do nothing;

  select t.id into the_thread
  from public.chat_threads t
  where t.org_id = target_org
    and t.user_id = current_user_id
    and t.context_type = target_context
    and coalesce(t.process_id, t.search_run_id) = target_id;

  insert into public.chat_messages (thread_id, org_id, user_id, role, client_message_id, content)
  values (the_thread, target_org, current_user_id, 'user', client_message_id, btrim(question))
  on conflict on constraint chat_messages_thread_client_id_key do nothing
  returning id into the_question;

  if the_question is null then
    raise exception 'chat_turn_exists';
  end if;

  reservation := public.reserve_ai_credits(
    target_org,
    current_user_id,
    estimate,
    'chat',
    'chat:' || the_question::text,
    jsonb_build_object('thread_id', the_thread, 'message_id', the_question)
  );

  insert into public.chat_messages (thread_id, org_id, user_id, role, status, model, credit_reservation_id)
  values (the_thread, target_org, current_user_id, 'assistant', 'pending', used_model, reservation.id)
  returning id into the_answer;

  update public.chat_threads set updated_at = now() where id = the_thread;

  return query select the_thread, the_question, the_answer, estimate;
end;
$$;

-- Stores the answer and charges what it used at the model's rate, capped at
-- the reservation. Finishing an answer twice raises chat_turn_not_pending, so
-- a turn is charged once. Returns the credits charged and those left.
create function public.finish_chat_turn(
  target_message uuid,
  answer text,
  answer_citations jsonb,
  answer_unverified boolean,
  response_model text,
  used_input_tokens integer,
  used_output_tokens integer,
  used_latency_ms integer,
  query_embedding_model text default null,
  query_embedding_tokens integer default null
)
returns table (credits_charged integer, credits_available integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  answer_row public.chat_messages;
  reservation public.ai_credit_reservations;
  rates public.ai_model_rates;
  charged integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select m.* into answer_row
  from public.chat_messages m
  where m.id = target_message and m.user_id = auth.uid() and m.role = 'assistant' and m.status = 'pending'
  for update;
  if not found then
    raise exception 'chat_turn_not_pending';
  end if;

  select r.* into reservation from public.ai_credit_reservations r where r.id = answer_row.credit_reservation_id;
  select r.* into rates from public.ai_model_rates r where r.model = answer_row.model;

  charged := case
    when used_input_tokens is null or used_output_tokens is null or rates.model is null then reservation.amount
    else least(reservation.amount, private.chat_credits(rates, used_input_tokens, used_output_tokens))
  end;

  -- An expired reservation was already released: the answer is kept, uncharged.
  if reservation.status = 'reserved' then
    perform public.commit_ai_credits(reservation.id, charged);
  elsif reservation.status = 'released' then
    charged := 0;
  end if;

  update public.chat_messages
  set content = answer,
      citations = coalesce(answer_citations, '[]'::jsonb),
      unverified = coalesce(answer_unverified, false),
      status = 'completed',
      model = coalesce(response_model, model),
      input_tokens = used_input_tokens,
      output_tokens = used_output_tokens,
      credits_charged = charged,
      completed_at = now()
  where id = answer_row.id;

  insert into public.ai_usage_events (org_id, user_id, role, model, input_tokens, output_tokens, latency_ms, status, reference)
  values (
    answer_row.org_id, answer_row.user_id, 'chat', coalesce(response_model, answer_row.model),
    used_input_tokens, used_output_tokens, used_latency_ms, 'succeeded',
    jsonb_build_object('type', 'chat_message', 'id', answer_row.id)
  );

  if query_embedding_model is not null then
    insert into public.ai_usage_events (org_id, user_id, role, model, input_tokens, status, reference)
    values (
      answer_row.org_id, answer_row.user_id, 'embed', query_embedding_model, query_embedding_tokens, 'succeeded',
      jsonb_build_object('type', 'chat_question', 'id', answer_row.id)
    );
  end if;

  return query select charged, private.ai_credits_available(answer_row.org_id, reservation.cycle_start);
end;
$$;

-- The answer failed: its credits go back and the failure is recorded.
create function public.fail_chat_turn(target_message uuid, error_message text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  answer_row public.chat_messages;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  update public.chat_messages
  set status = 'failed', error = left(error_message, 1000), completed_at = now()
  where id = target_message and user_id = auth.uid() and role = 'assistant' and status = 'pending'
  returning * into answer_row;
  if not found then
    return;
  end if;

  if answer_row.credit_reservation_id is not null then
    perform public.release_ai_credits(answer_row.credit_reservation_id);
  end if;

  insert into public.ai_usage_events (org_id, user_id, role, model, status, error, reference)
  values (
    answer_row.org_id, answer_row.user_id, 'chat', answer_row.model, 'failed', left(error_message, 1000),
    jsonb_build_object('type', 'chat_message', 'id', answer_row.id)
  );
end;
$$;

revoke execute on function private.chat_credits(public.ai_model_rates, integer, integer) from public, anon;
revoke execute on function public.start_chat_turn(uuid, text, uuid, text, text, text, integer, integer) from public, anon;
revoke execute on function public.finish_chat_turn(uuid, text, jsonb, boolean, text, integer, integer, integer, text, integer) from public, anon;
revoke execute on function public.fail_chat_turn(uuid, text) from public, anon;
grant execute on function public.start_chat_turn(uuid, text, uuid, text, text, text, integer, integer) to authenticated;
grant execute on function public.finish_chat_turn(uuid, text, jsonb, boolean, text, integer, integer, integer, text, integer) to authenticated;
grant execute on function public.fail_chat_turn(uuid, text) to authenticated;

-- Reservations whose AI operation never committed or released (crashed
-- worker or web server); a chat answer left pending with one is failed.
create or replace function private.release_expired_ai_credit_reservations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  released_count integer;
begin
  with released as (
    update public.ai_credit_reservations
    set status = 'released', settled_at = now()
    where status = 'reserved'
      and expires_at <= now()
    returning id
  ),
  failed_answers as (
    update public.chat_messages m
    set status = 'failed', error = 'The answer did not finish before its credit reservation expired', completed_at = now()
    from released
    where m.credit_reservation_id = released.id and m.status = 'pending'
  )
  select count(*) into released_count from released;

  return released_count;
end;
$$;

-- ============================================================
-- Retrieval
-- ============================================================

-- The passages of the given processes' current documents that best answer a
-- question: nearest chunks by embedding and chunks sharing any of the
-- question's words, fused by reciprocal rank (as retrieve_candidates).
-- Runs as the caller, so it reads only what RLS lets a member read.
create function public.retrieve_chat_passages(
  target_processes uuid[],
  query_text text,
  query_embedding extensions.halfvec(1024),
  target_model text,
  max_passages integer default 12
)
returns table (
  chunk_id bigint,
  process_id uuid,
  document_id uuid,
  document_version_id uuid,
  document_title text,
  document_kind text,
  source_url text,
  page_start integer,
  page_end integer,
  content text,
  score double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  with chunks as (
    select c.id, c.embedding, c.tsv, d.process_id, d.id as document_id, c.document_version_id,
           d.title, d.kind, d.source_url, c.page_start, c.page_end, c.content
    from public.source_documents d
    join public.document_chunks c on c.document_version_id = d.current_version_id and c.embedding_model = target_model
    where d.process_id = any (target_processes) and d.removed_at is null
  ),
  -- Any of the question's words, so a long question still finds passages.
  question as (
    select nullif(replace(plainto_tsquery('spanish'::regconfig, private.immutable_unaccent(query_text))::text, '&', '|'), '')::tsquery as tq
  ),
  semantic as (
    select c.id, row_number() over (order by c.embedding operator(extensions.<=>) query_embedding) as rank
    from chunks c
    order by c.embedding operator(extensions.<=>) query_embedding
    limit 40
  ),
  lexical as (
    select c.id, row_number() over (order by ts_rank_cd(c.tsv, q.tq) desc) as rank
    from chunks c, question q
    where q.tq is not null and c.tsv @@ q.tq
    order by ts_rank_cd(c.tsv, q.tq) desc
    limit 40
  ),
  fused as (
    select id, sum(1.0 / (60 + rank)) as score
    from (select id, rank from semantic union all select id, rank from lexical) ranked
    group by id
  )
  select c.id, c.process_id, c.document_id, c.document_version_id, c.title, c.kind, c.source_url,
         c.page_start, c.page_end, c.content, f.score::double precision
  from fused f
  join chunks c on c.id = f.id
  order by f.score desc, c.id
  limit greatest(1, least(max_passages, 40));
$$;

revoke execute on function public.retrieve_chat_passages(uuid[], text, extensions.halfvec, text, integer) from public, anon;
grant execute on function public.retrieve_chat_passages(uuid[], text, extensions.halfvec, text, integer) to authenticated;
