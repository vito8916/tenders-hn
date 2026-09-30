-- Phase 3: reasons need to know which term matched which field.
--
-- matched_fields says which fields matched any term, and matched_terms mixes
-- field and document matches, so a reason such as «Menciona "SAP" en el
-- objeto» could name a term found only in the pliego. field_terms maps each
-- process field to the terms found in it; only terms that already hit the
-- process's search_tsv are checked. Everything else is unchanged.

drop function public.retrieve_candidates(text[], text, extensions.halfvec, text[], boolean, integer, integer, integer, uuid[]);

create function public.retrieve_candidates(
  search_terms text[],
  -- The embedding model the query was embedded with; selects the chunk set.
  model text,
  query_embedding extensions.halfvec(1024) default null,
  unspsc_prefixes text[] default '{}',
  open_only boolean default true,
  vector_chunk_limit integer default 200,
  vector_process_limit integer default 100,
  fragments_per_process integer default 5,
  -- Restricts retrieval to these processes (null: no restriction). The
  -- evaluation harness passes the population a labeled set was drawn from.
  process_ids uuid[] default null
)
returns table (
  process_id uuid,
  score double precision,
  matched_terms text[],
  matched_fields text[],
  -- {"object": [...], "products": [...]}: the terms found in each process field.
  field_terms jsonb,
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
    where (not open_only or p.closes_at is null or p.closes_at > now())
      and (process_ids is null or p.id = any(process_ids))
  ),
  chunk_term_hits as (
    select d.process_id, c.id as chunk_id, t.term, ts_rank(c.tsv, t.tq) as rank
    from usable_terms t
    join public.document_chunks c on c.tsv @@ t.tq and c.embedding_model = model
    join public.source_documents d on d.current_version_id = c.document_version_id and d.removed_at is null
    join public.procurement_processes p on p.id = d.process_id
    where (not open_only or p.closes_at is null or p.closes_at > now())
      and (process_ids is null or p.id = any(process_ids))
  ),
  vector_chunk_hits as (
    select d.process_id, c.id as chunk_id, 1 - (c.embedding operator(extensions.<=>) query_embedding) as similarity
    from public.document_chunks c
    join public.source_documents d on d.current_version_id = c.document_version_id and d.removed_at is null
    join public.procurement_processes p on p.id = d.process_id
    where query_embedding is not null
      and c.embedding_model = model
      and (not open_only or p.closes_at is null or p.closes_at > now())
      and (process_ids is null or p.id = any(process_ids))
    order by c.embedding operator(extensions.<=>) query_embedding
    limit vector_chunk_limit
  ),
  vector_process_hits as (
    select p.id as process_id, 1 - (p.object_embedding operator(extensions.<=>) query_embedding) as similarity
    from public.procurement_processes p
    where query_embedding is not null
      and p.object_embedding_model = model
      and (not open_only or p.closes_at is null or p.closes_at > now())
      and (process_ids is null or p.id = any(process_ids))
    order by p.object_embedding operator(extensions.<=>) query_embedding
    limit vector_process_limit
  ),
  unspsc_hits as (
    select p.id as process_id, array_agg(distinct code order by code) as codes
    from public.procurement_processes p
    cross join lateral unnest(p.unspsc_codes) as code
    join unnest(unspsc_prefixes) as prefix on code like prefix || '%'
    where (not open_only or p.closes_at is null or p.closes_at > now())
      and (process_ids is null or p.id = any(process_ids))
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
    coalesce(ft.field_terms, '{}'::jsonb),
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
  left join lateral (
    select jsonb_object_agg(per_field.field, per_field.terms) as field_terms
    from (
      select v.field, array_agg(t.term order by t.term) as terms
      from process_term_hits h
      join usable_terms t on t.term = h.term
      cross join lateral (values
        ('object', p.title), ('buyer_entity', p.buyer_entity), ('purchase_unit', p.purchase_unit), ('products', p.products_text)
      ) as v (field, value)
      where h.process_id = s.process_id
        and to_tsvector('spanish'::regconfig, private.immutable_unaccent(coalesce(v.value, ''))) @@ t.tq
      group by v.field
    ) per_field
  ) ft on true
  order by s.score desc;
end;
$$;

-- Functions are executable by PUBLIC unless revoked; this one is for the worker and server code only.
revoke execute on function public.retrieve_candidates(text[], text, extensions.halfvec, text[], boolean, integer, integer, integer, uuid[]) from public, anon, authenticated;
grant execute on function public.retrieve_candidates(text[], text, extensions.halfvec, text[], boolean, integer, integer, integer, uuid[]) to service_role;
