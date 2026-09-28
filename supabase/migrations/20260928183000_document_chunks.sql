-- Phase 2: searchable chunks of document text.
--
--   document_chunks  passages of about 2,000 characters built from a document
--                    version's pages (short pages are merged, long ones split
--                    with overlap), with the pages they came from, Spanish
--                    full-text search, and an embedding
--
-- Embeddings are halfvec(1024): the `embed` role's default (voyage/voyage-4)
-- at 1024 dimensions, stored at half precision. One index serves one
-- dimension, so every embed model must produce 1024. Chunks are keyed by
-- model, so a new model's chunks can be built beside the old ones before
-- retrieval switches. Written by the `embed_document` job on the `docs` queue.

create table public.document_chunks (
  id bigint generated always as identity primary key,
  document_version_id uuid not null references public.document_versions (id) on delete cascade,
  embedding_model text not null,
  ordinal integer not null,
  page_start integer not null,
  page_end integer not null,
  content text not null,
  embedding extensions.halfvec(1024) not null,
  tsv tsvector generated always as (
    to_tsvector('spanish'::regconfig, private.immutable_unaccent(content))
  ) stored,
  constraint document_chunks_version_model_ordinal_key unique (document_version_id, embedding_model, ordinal),
  constraint document_chunks_pages_check check (page_start <= page_end)
);

create index document_chunks_embedding_idx
  on public.document_chunks using hnsw (embedding extensions.halfvec_cosine_ops);
create index document_chunks_tsv_idx
  on public.document_chunks using gin (tsv);

grant select, insert, update, delete on public.document_chunks to service_role;
grant select on public.document_chunks to authenticated;

alter table public.document_chunks enable row level security;

create policy "Document chunks readable by organization members"
on public.document_chunks for select to authenticated
using ((select private.is_org_member()));
