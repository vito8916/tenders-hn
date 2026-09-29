-- Phase 3: UNSPSC classes proposed by meaning, not by exact words.
--
--   unspsc_terms  embeddings of every CUBS class name (with its family) and of
--                 every distinct product description HonduCompras product
--                 lines carry, with their code
--
-- A company's line of business is embedded and the nearest classes and
-- product descriptions propose its UNSPSC classes, so a line named differently
-- from the catalog («reactivos de hematología») still finds its class and the
-- line's context tells zippers from door locks. Written by the `embed_catalog`
-- job on the `docs` queue, which embeds only what is missing: daily for new
-- product descriptions, and after the monthly catalog walk.

create table public.unspsc_terms (
  id bigint generated always as identity primary key,
  kind text not null constraint unspsc_terms_kind_check check (kind in ('class', 'product')),
  -- 6 digits for a class, 8 for a product.
  code text not null,
  text text not null,
  embedding_model text not null,
  embedding extensions.halfvec(1024) not null,
  created_at timestamptz not null default now(),
  constraint unspsc_terms_code_check check (
    (kind = 'class' and code ~ '^[0-9]{6}$') or (kind = 'product' and code ~ '^[0-9]{8}$')
  ),
  constraint unspsc_terms_kind_code_text_model_key unique (kind, code, text, embedding_model)
);

create index unspsc_terms_embedding_idx
  on public.unspsc_terms using hnsw (embedding extensions.halfvec_cosine_ops);

grant select, insert, update, delete on public.unspsc_terms to service_role;

alter table public.unspsc_terms enable row level security;

-- Enqueue an embedding pass only when none is waiting.
create or replace function private.enqueue_catalog_embedding()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from pgmq.q_docs q where q.message ->> 'type' = 'embed_catalog'
  ) then
    perform pgmq.send('docs', jsonb_build_object('type', 'embed_catalog', 'enqueued_at', now()));
  end if;
end;
$$;

-- 03:40 Honduras daily: after the 1st-of-month catalog walk (02:15) has had time to finish.
select cron.schedule('enqueue-catalog-embedding', '40 9 * * *', 'select private.enqueue_catalog_embedding()');

select private.enqueue_catalog_embedding();
