-- Phase 2: candidate retrieval (spec §5, step 4).
--
-- Combines five signals, each ranked on its own and fused by reciprocal rank
-- (score = sum of 1 / (60 + rank)), so no single signal's scale dominates and
-- a process found several ways ranks first:
--
--   1. search terms (keywords, synonyms, offerings) in the process fields:
--      object, entity, purchase unit, and product descriptions
--   2. search terms in document chunks (pliego, anexos, ...)
--   3. semantic similarity of document chunks to the query embedding
--   4. semantic similarity of the process object to the query embedding
--   5. UNSPSC codes, by prefix (a family code matches its commodities)
--
-- Retrieval favors recall: every term or code match is returned, plus the
-- nearest chunks and objects. Jev and the composition step decide fit.
-- Each candidate comes with the terms, fields, codes, and fragments that
-- matched, so evidence and reasons can cite them.

-- ============================================================
-- Product data on the process, searchable
-- ============================================================

alter table public.procurement_processes
  add column products_text text,
  add column unspsc_codes text[] not null default '{}',
  -- The process object (title, entity, products) embedded with the `embed` role.
  add column object_embedding extensions.halfvec(1024),
  add column object_embedding_model text;

update public.procurement_processes p
set products_text = (
      select string_agg(item ->> 'description', '; ' order by position)
      from jsonb_array_elements(v.detail -> 'products') with ordinality as product (item, position)
    ),
    unspsc_codes = coalesce((
      select array_agg(distinct item ->> 'unspsc')
      from jsonb_array_elements(v.detail -> 'products') as product (item)
      where item ->> 'unspsc' is not null
    ), '{}')
from public.process_versions v
where v.id = p.current_version_id;

-- Rebuilt to include product descriptions (drops its index with it).
alter table public.procurement_processes drop column search_tsv;
alter table public.procurement_processes add column search_tsv tsvector generated always as (
  to_tsvector(
    'spanish'::regconfig,
    private.immutable_unaccent(
      coalesce(title, '') || ' ' || coalesce(buyer_entity, '') || ' ' || coalesce(purchase_unit, '') || ' ' || coalesce(products_text, '')
    )
  )
) stored;

create index procurement_processes_search_idx
  on public.procurement_processes using gin (search_tsv);
create index procurement_processes_object_embedding_idx
  on public.procurement_processes using hnsw (object_embedding extensions.halfvec_cosine_ops);

-- ============================================================
-- Retrieval
-- ============================================================

create or replace function public.retrieve_candidates(
  search_terms text[],
  -- The embedding model the query was embedded with; selects the chunk set.
  model text,
  query_embedding extensions.halfvec(1024) default null,
  unspsc_prefixes text[] default '{}',
  open_only boolean default true,
  vector_chunk_limit integer default 200,
  vector_process_limit integer default 100,
  fragments_per_process integer default 5
)
returns table (
  process_id uuid,
  score double precision,
  matched_terms text[],
  matched_fields text[],
  matched_unspsc text[],
  object_similarity double precision,
  fragments jsonb
)
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_column
begin
  -- Lets the HNSW scans continue past rows the filters drop (closed
  -- processes, removed documents), so they still return their limit.
  perform set_config('hnsw.iterative_scan', 'relaxed_order', true);

  return query
  with terms as (
    select t.term, websearch_to_tsquery('spanish'::regconfig, private.immutable_unaccent(t.term)) as tq
    from unnest(search_terms) as t (term)
  ),
  usable_terms as (
    -- A term made only of stop words has no query.
    select term, tq from terms where numnode(tq) > 0
  ),
  any_term as (
    select string_agg('(' || tq::text || ')', ' | ')::tsquery as tq from usable_terms
  ),
  process_term_hits as (
    select p.id as process_id, t.term, ts_rank(p.search_tsv, t.tq) as rank
    from usable_terms t
    join public.procurement_processes p on p.search_tsv @@ t.tq
    where not open_only or p.closes_at is null or p.closes_at > now()
  ),
  chunk_term_hits as (
    select d.process_id, c.id as chunk_id, t.term, ts_rank(c.tsv, t.tq) as rank
    from usable_terms t
    join public.document_chunks c on c.tsv @@ t.tq and c.embedding_model = model
    join public.source_documents d on d.current_version_id = c.document_version_id and d.removed_at is null
    join public.procurement_processes p on p.id = d.process_id
    where not open_only or p.closes_at is null or p.closes_at > now()
  ),
  vector_chunk_hits as (
    select d.process_id, c.id as chunk_id, 1 - (c.embedding operator(extensions.<=>) query_embedding) as similarity
    from public.document_chunks c
    join public.source_documents d on d.current_version_id = c.document_version_id and d.removed_at is null
    join public.procurement_processes p on p.id = d.process_id
    where query_embedding is not null
      and c.embedding_model = model
      and (not open_only or p.closes_at is null or p.closes_at > now())
    order by c.embedding operator(extensions.<=>) query_embedding
    limit vector_chunk_limit
  ),
  vector_process_hits as (
    select p.id as process_id, 1 - (p.object_embedding operator(extensions.<=>) query_embedding) as similarity
    from public.procurement_processes p
    where query_embedding is not null
      and p.object_embedding_model = model
      and (not open_only or p.closes_at is null or p.closes_at > now())
    order by p.object_embedding operator(extensions.<=>) query_embedding
    limit vector_process_limit
  ),
  unspsc_hits as (
    select p.id as process_id, array_agg(distinct code order by code) as codes
    from public.procurement_processes p
    cross join lateral unnest(p.unspsc_codes) as code
    join unnest(unspsc_prefixes) as prefix on code like prefix || '%'
    where not open_only or p.closes_at is null or p.closes_at > now()
    group by p.id
  ),
  arm_ranks as (
    select process_id, row_number() over (order by sum(rank) desc) as rank
    from process_term_hits group by process_id
    union all
    select process_id, row_number() over (order by count(distinct term) desc, max(rank) desc)
    from chunk_term_hits group by process_id
    union all
    select process_id, row_number() over (order by max(similarity) desc)
    from vector_chunk_hits group by process_id
    union all
    select process_id, row_number() over (order by similarity desc)
    from vector_process_hits
    union all
    select process_id, 1 from unspsc_hits
  ),
  scored as (
    select process_id, sum(1.0 / (60 + rank))::double precision as score
    from arm_ranks group by process_id
  ),
  process_terms as (
    select process_id, array_agg(distinct term order by term) as terms
    from (
      select process_id, term from process_term_hits
      union
      select process_id, term from chunk_term_hits
    ) hits
    group by process_id
  ),
  chunk_text_hits as (
    select process_id, chunk_id, array_agg(distinct term order by term) as terms, max(rank) as text_rank
    from chunk_term_hits group by process_id, chunk_id
  ),
  fragment_hits as (
    select coalesce(t.process_id, v.process_id) as process_id,
           coalesce(t.chunk_id, v.chunk_id) as chunk_id,
           t.terms, t.text_rank, v.similarity
    from chunk_text_hits t
    full join vector_chunk_hits v on v.chunk_id = t.chunk_id
  ),
  fragment_orders as (
    -- Fragments are ordered within their process the same way candidates are:
    -- reciprocal rank over the text match and the semantic match.
    select f.*,
           coalesce(1.0 / (60 + case when f.text_rank is not null
             then row_number() over (partition by f.process_id order by f.text_rank desc nulls last) end), 0)
           + coalesce(1.0 / (60 + case when f.similarity is not null
             then row_number() over (partition by f.process_id order by f.similarity desc nulls last) end), 0)
             as fragment_score
    from fragment_hits f
  ),
  top_fragments as (
    select o.process_id,
           jsonb_agg(jsonb_build_object(
             'chunk_id', c.id,
             'document_id', d.id,
             'document_version_id', c.document_version_id,
             'document_title', d.title,
             'page_start', c.page_start,
             'page_end', c.page_end,
             'matched_terms', coalesce(o.terms, '{}'),
             'similarity', round(o.similarity::numeric, 4)
           ) order by o.fragment_score desc) as fragments
    from (
      select fo.*, row_number() over (partition by fo.process_id order by fo.fragment_score desc) as position
      from fragment_orders fo
    ) o
    join public.document_chunks c on c.id = o.chunk_id
    join public.source_documents d on d.current_version_id = c.document_version_id
    where o.position <= fragments_per_process
    group by o.process_id
  )
  select
    s.process_id,
    s.score,
    coalesce(pt.terms, '{}'),
    array_remove(array[
      case when to_tsvector('spanish'::regconfig, private.immutable_unaccent(coalesce(p.title, ''))) @@ q.tq then 'object' end,
      case when to_tsvector('spanish'::regconfig, private.immutable_unaccent(coalesce(p.buyer_entity, ''))) @@ q.tq then 'buyer_entity' end,
      case when to_tsvector('spanish'::regconfig, private.immutable_unaccent(coalesce(p.purchase_unit, ''))) @@ q.tq then 'purchase_unit' end,
      case when to_tsvector('spanish'::regconfig, private.immutable_unaccent(coalesce(p.products_text, ''))) @@ q.tq then 'products' end,
      case when exists (select 1 from chunk_text_hits t where t.process_id = s.process_id) then 'documents' end
    ], null),
    coalesce(u.codes, '{}'),
    vp.similarity,
    coalesce(tf.fragments, '[]'::jsonb)
  from scored s
  join public.procurement_processes p on p.id = s.process_id
  cross join any_term q
  left join process_terms pt on pt.process_id = s.process_id
  left join unspsc_hits u on u.process_id = s.process_id
  left join vector_process_hits vp on vp.process_id = s.process_id
  left join top_fragments tf on tf.process_id = s.process_id
  order by s.score desc;
end;
$$;

-- Functions are executable by PUBLIC unless revoked; this one is for the worker and server code only.
revoke execute on function public.retrieve_candidates(text[], text, extensions.halfvec, text[], boolean, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.retrieve_candidates(text[], text, extensions.halfvec, text[], boolean, integer, integer, integer) to service_role;
