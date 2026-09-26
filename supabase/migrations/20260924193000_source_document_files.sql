-- Phase 2: document files and their text.
--
--   document_versions  one row per distinct file content behind a document
--                      link, stored once in the private source-documents
--                      bucket; a new hash under the same URL is a replaced
--                      document
--   document_pages     text per page, from the PDF text layer or OCR
--
-- Downloads run on the `ingest` queue (`download_document`): the documents
-- live on the same server as the portal, and that queue's single consumer
-- keeps it to one request at a time. Extraction is CPU only and runs on its
-- own `docs` queue (`extract_document`) so OCR never delays a sync.

select pgmq.create('docs');

-- ============================================================
-- Versions and pages
-- ============================================================

create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.source_documents (id) on delete cascade,
  sha256 text not null,
  byte_size bigint not null,
  mime_type text not null,
  storage_path text not null,
  page_count integer,
  extraction_status text not null default 'pending' constraint document_versions_extraction_status_check
    check (extraction_status in ('pending', 'text', 'ocr', 'partial', 'failed', 'unsupported')),
  extraction_error text,
  downloaded_at timestamptz not null default now(),
  extracted_at timestamptz,
  constraint document_versions_document_sha256_key unique (document_id, sha256)
);

create table public.document_pages (
  document_version_id uuid not null references public.document_versions (id) on delete cascade,
  page_number integer not null,
  text text not null,
  method text not null constraint document_pages_method_check
    check (method in ('text_layer', 'ocr', 'vision')),
  -- Mean Tesseract word confidence (0-100); null for the text layer.
  ocr_confidence numeric(5, 2),
  primary key (document_version_id, page_number)
);

-- The link's current file and the validators for conditional re-downloads.
alter table public.source_documents
  add column current_version_id uuid references public.document_versions (id) on delete set null,
  add column etag text,
  add column last_modified text,
  add column last_checked_at timestamptz,
  -- Why the link could not be downloaded (e.g. HTTP 404); cleared on success.
  add column download_error text;

create index source_documents_current_version_idx
  on public.source_documents using btree (current_version_id);

-- ============================================================
-- Grants and RLS
-- ============================================================

grant select, insert, update, delete on public.document_versions, public.document_pages to service_role;
grant select on public.document_versions, public.document_pages to authenticated;

alter table public.document_versions enable row level security;
alter table public.document_pages enable row level security;

create policy "Document versions readable by organization members"
on public.document_versions for select to authenticated
using ((select private.is_org_member()));

create policy "Document pages readable by organization members"
on public.document_pages for select to authenticated
using ((select private.is_org_member()));

-- ============================================================
-- Storage: document files (service role only; the app serves signed URLs)
-- ============================================================

insert into storage.buckets (id, name, public)
values ('source-documents', 'source-documents', false)
on conflict (id) do nothing;
