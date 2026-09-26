-- Document files and page text: stored once per content hash, readable by
-- organization members only, written only by the worker.
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
values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'sha-1', 972781, 'application/pdf', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/sha-1.pdf');
update public.source_documents set current_version_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
insert into public.document_pages (document_version_id, page_number, text, method, ocr_confidence) values
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 1, 'Adquisición de soporte funcional SAP', 'text_layer', null),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 2, 'Aviso de Licitación Pública', 'ocr', 86.23);

-- ---------- Integrity ----------
select is(
  (select extraction_status from public.document_versions where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
  'pending',
  'a new version waits for extraction'
);
select throws_ok(
  $$insert into public.document_versions (document_id, sha256, byte_size, mime_type, storage_path)
    values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'sha-1', 1, 'application/pdf', 'x')$$,
  '23505', null, 'a file is stored once per content hash'
);
select lives_ok(
  $$insert into public.document_versions (document_id, sha256, byte_size, mime_type, storage_path)
    values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'sha-2', 1, 'application/pdf', 'x')$$,
  'a replaced file is a new version of the same link'
);
select throws_ok(
  $$insert into public.document_pages (document_version_id, page_number, text, method)
    values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 1, 'again', 'text_layer')$$,
  '23505', null, 'one text row per page'
);
select throws_ok(
  $$update public.document_versions set extraction_status = 'done' where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'$$,
  '23514', null, 'extraction status is one of the known states'
);
select ok(exists (select 1 from pgmq.list_queues() where queue_name = 'docs'), 'extraction has its own queue');
select ok(
  (select not public from storage.buckets where id = 'source-documents'),
  'document files live in a private bucket'
);

-- ---------- Organization member ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

select is((select count(*)::int from public.document_versions), 2, 'members read document versions');
select is((select count(*)::int from public.document_pages), 2, 'members read page text');
select throws_ok(
  $$update public.document_pages set text = 'x'$$,
  '42501', null, 'members cannot change page text'
);
select throws_ok(
  $$insert into public.document_versions (document_id, sha256, byte_size, mime_type, storage_path)
    values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'sha-3', 1, 'application/pdf', 'x')$$,
  '42501', null, 'members cannot add versions'
);

-- ---------- User in no organization ----------
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
select is((select count(*)::int from public.document_versions), 0, 'users outside every organization see no versions');
select is((select count(*)::int from public.document_pages), 0, 'users outside every organization see no page text');
reset role;

-- ---------- Anonymous ----------
set local role anon;
select throws_ok('select * from public.document_pages', '42501', null, 'anon cannot read page text');
reset role;

select * from finish();
rollback;
