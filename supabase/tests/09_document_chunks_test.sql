-- Document chunks: one set per version and embedding model, 1024-dimension
-- embeddings, Spanish full-text search; readable by organization members only.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Start from empty source tables (a local database may hold synced data); the test rolls back.
delete from public.procurement_processes;

-- Fixtures: owner (in an org), outsider (in no org)
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'owner@test.local', 'authenticated', 'authenticated', '{}'),
  ('33333333-3333-4333-8333-333333333333', 'outsider@test.local', 'authenticated', 'authenticated', '{}');
insert into public.organizations (id, name, slug, owner_id)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Test Org', 'test-org-pgtap', '11111111-1111-4111-8111-111111111111');

insert into public.procurement_processes (id, source, source_process_key, expediente, buyer_entity, title, detail_url)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'honducompras_v1', '117:1:LPN-008-2026', 'LPN-008-2026', 'IHSS', 'Soporte SAP', 'http://example.test/detail');
insert into public.source_documents (id, process_id, source_url, title, kind)
values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'http://example.test/pliego.pdf', 'Pliego', 'pliego');
insert into public.document_versions (id, document_id, sha256, byte_size, mime_type, storage_path)
values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'sha-1', 1, 'application/pdf', 'x');

-- Unit vectors along the first two axes: the query below is closer to the first.
insert into public.document_chunks (document_version_id, embedding_model, ordinal, page_start, page_end, content, embedding) values
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'voyage/voyage-4', 0, 1, 2, 'Adquisición de soporte funcional SAP',
   ('[1' || repeat(',0', 1023) || ']')::extensions.halfvec),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'voyage/voyage-4', 1, 2, 2, 'Garantía de mantenimiento de oferta',
   ('[0,1' || repeat(',0', 1022) || ']')::extensions.halfvec);

-- ---------- Integrity ----------
select throws_ok(
  $$insert into public.document_chunks (document_version_id, embedding_model, ordinal, page_start, page_end, content, embedding)
    values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'voyage/voyage-4', 0, 1, 1, 'again', ('[1' || repeat(',0', 1023) || ']')::extensions.halfvec)$$,
  '23505', null, 'one chunk per ordinal for a version and model'
);
select lives_ok(
  $$insert into public.document_chunks (document_version_id, embedding_model, ordinal, page_start, page_end, content, embedding)
    values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'voyage/voyage-4-large', 0, 1, 1, 'x', ('[1' || repeat(',0', 1023) || ']')::extensions.halfvec)$$,
  'another model can build its chunks beside the current ones'
);
select throws_ok(
  $$insert into public.document_chunks (document_version_id, embedding_model, ordinal, page_start, page_end, content, embedding)
    values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'other/model', 0, 1, 1, 'x', ('[1' || repeat(',0', 511) || ']')::extensions.halfvec)$$,
  '22000', null, 'embeddings must have 1024 dimensions'
);
select throws_ok(
  $$insert into public.document_chunks (document_version_id, embedding_model, ordinal, page_start, page_end, content, embedding)
    values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'other/model', 1, 3, 2, 'x', ('[1' || repeat(',0', 1023) || ']')::extensions.halfvec)$$,
  '23514', null, 'a chunk cannot end before it starts'
);

-- ---------- Search ----------
select is(
  (select ordinal from public.document_chunks
   where embedding_model = 'voyage/voyage-4'
   order by embedding operator(extensions.<=>) ('[0.9,0.1' || repeat(',0', 1022) || ']')::extensions.halfvec
   limit 1),
  0,
  'cosine distance ranks the nearest chunk first'
);
select is(
  (select ordinal from public.document_chunks
   where embedding_model = 'voyage/voyage-4' and tsv @@ websearch_to_tsquery('spanish', 'adquisicion SAP')),
  0,
  'full-text search ignores accents'
);

-- ---------- Access ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select is((select count(*)::int from public.document_chunks), 3, 'members read chunks');
select throws_ok($$delete from public.document_chunks$$, '42501', null, 'members cannot delete chunks');

select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
select is((select count(*)::int from public.document_chunks), 0, 'users outside every organization see no chunks');
reset role;

set local role anon;
select throws_ok('select * from public.document_chunks', '42501', null, 'anon cannot read chunks');
reset role;

select * from finish();
rollback;
