-- Candidate retrieval: terms in process fields and documents, UNSPSC
-- prefixes, and semantic similarity, fused into one ranked list with the
-- evidence that matched; service role only.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Start from empty source tables (a local database may hold synced data); the test rolls back.
delete from public.procurement_processes;

-- A 1024-dimension vector that starts with the given values.
create function pg_temp.vec(head float8[]) returns extensions.halfvec language sql as $$
  select ('[' || array_to_string(head || array_fill(0::float8, array[1024 - cardinality(head)]), ',') || ']')::extensions.halfvec
$$;

insert into auth.users (id, email, aud, role, raw_user_meta_data)
values ('11111111-1111-4111-8111-111111111111', 'owner@test.local', 'authenticated', 'authenticated', '{}');
insert into public.organizations (id, name, slug, owner_id)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Test Org', 'test-org-pgtap', '11111111-1111-4111-8111-111111111111');

insert into public.procurement_processes
  (id, source, source_process_key, expediente, buyer_entity, title, detail_url, closes_at, products_text, unspsc_codes, object_embedding, object_embedding_model)
values
  -- Named in the object, coded under the wanted family, and semantically nearest.
  ('c0000000-0000-4000-8000-00000000000a', 'honducompras_v1', 'k:a', 'LPN-008-2026', 'IHSS', 'Adquisición de soporte funcional SAP', 'http://x',
   now() + interval '30 days', 'Software de gestión de recursos humanos', '{43231505}', pg_temp.vec(array[1]), 'test/model'),
  -- Unrelated in every way.
  ('c0000000-0000-4000-8000-00000000000b', 'honducompras_v1', 'k:b', 'CM-1', 'SESAL', 'Compra de medicamentos', 'http://x',
   now() + interval '30 days', 'Paracetamol', '{51101500}', pg_temp.vec(array[0, 1]), 'test/model'),
  -- Would match, but already closed.
  ('c0000000-0000-4000-8000-00000000000c', 'honducompras_v1', 'k:c', 'LPN-001-2025', 'IHSS', 'Soporte SAP del año anterior', 'http://x',
   now() - interval '30 days', null, '{}', null, null),
  -- Only its pliego mentions what the company does.
  ('c0000000-0000-4000-8000-00000000000d', 'honducompras_v1', 'k:d', 'LPR-7', 'ENEE', 'Servicios varios de tecnología', 'http://x',
   now() + interval '10 days', null, '{}', null, null),
  -- Only semantically close.
  ('c0000000-0000-4000-8000-00000000000e', 'honducompras_v1', 'k:e', 'CM-9', 'UNAH', 'Licencias de plataforma empresarial', 'http://x',
   now() + interval '5 days', null, '{}', pg_temp.vec(array[0.95, 0.05]), 'test/model');

insert into public.source_documents (id, process_id, source_url, title, kind)
values ('d0000000-0000-4000-8000-00000000000d', 'c0000000-0000-4000-8000-00000000000d', 'http://x/pliego.pdf', 'Pliego', 'pliego');
insert into public.document_versions (id, document_id, sha256, byte_size, mime_type, storage_path)
values ('e0000000-0000-4000-8000-00000000000d', 'd0000000-0000-4000-8000-00000000000d', 'sha', 1, 'application/pdf', 'x');
update public.source_documents set current_version_id = 'e0000000-0000-4000-8000-00000000000d' where id = 'd0000000-0000-4000-8000-00000000000d';
insert into public.document_chunks (document_version_id, embedding_model, ordinal, page_start, page_end, content, embedding) values
  ('e0000000-0000-4000-8000-00000000000d', 'test/model', 0, 1, 1, 'Instrucciones a los oferentes', pg_temp.vec(array[0, 0, 1])),
  ('e0000000-0000-4000-8000-00000000000d', 'test/model', 1, 12, 12, 'Mesa de ayuda y soporte para el ERP SAP de la institución', pg_temp.vec(array[0.5, 0, 0.5])),
  -- The same passage embedded by another model must not show up twice.
  ('e0000000-0000-4000-8000-00000000000d', 'other/model', 0, 12, 12, 'Mesa de ayuda y soporte para el ERP SAP de la institución', pg_temp.vec(array[1]));

create temp table results as
select * from public.retrieve_candidates(
  search_terms => array['soporte SAP', 'mesa de ayuda', 'de la'],
  model => 'test/model',
  query_embedding => pg_temp.vec(array[1, 0, 0.2]),
  unspsc_prefixes => array['4323'],
  vector_chunk_limit => 1,
  vector_process_limit => 2
);

-- ---------- Candidates ----------
select results_eq(
  $$select p.expediente from results r join public.procurement_processes p on p.id = r.process_id order by r.score desc$$,
  $$values ('LPN-008-2026'::text), ('LPR-7'), ('CM-9')$$,
  'term, code, and semantic matches are returned, strongest first; unrelated and closed processes are not'
);
select results_eq(
  $$select matched_terms, matched_fields, matched_unspsc from results where process_id = 'c0000000-0000-4000-8000-00000000000a'$$,
  $$values (array['soporte SAP'], array['object'], array['43231505'])$$,
  'a candidate lists the terms, fields, and codes that matched'
);
select ok(
  (select object_similarity > 0.9 from results where process_id = 'c0000000-0000-4000-8000-00000000000a'),
  'a candidate found semantically carries its similarity'
);

-- ---------- Evidence from documents ----------
select results_eq(
  $$select matched_terms, matched_fields from results where process_id = 'c0000000-0000-4000-8000-00000000000d'$$,
  $$values (array['mesa de ayuda', 'soporte SAP'], array['documents'])$$,
  'a process that only mentions the terms in its pliego is a candidate'
);
select results_eq(
  $$select f ->> 'document_title', (f ->> 'page_start')::int, f -> 'matched_terms'
    from results, jsonb_array_elements(fragments) f
    where process_id = 'c0000000-0000-4000-8000-00000000000d'$$,
  $$values ('Pliego'::text, 12, '["mesa de ayuda", "soporte SAP"]'::jsonb)$$,
  'its fragment names the file and page, once, for the query model only'
);
select is(
  (select fragments from results where process_id = 'c0000000-0000-4000-8000-00000000000e'),
  '[]'::jsonb,
  'a candidate without documents has no fragments'
);

-- ---------- Filters ----------
select ok(
  exists (
    select 1 from public.retrieve_candidates(array['soporte SAP'], 'test/model', open_only => false)
    where process_id = 'c0000000-0000-4000-8000-00000000000c'
  ),
  'closed processes are included when asked'
);
select is(
  (select count(*)::int from public.retrieve_candidates(array['de la'], 'test/model')),
  0,
  'terms made only of stop words match nothing'
);

-- ---------- Access ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select throws_ok(
  $$select * from public.retrieve_candidates(array['SAP'], 'test/model')$$,
  '42501', null, 'members cannot run retrieval directly'
);
reset role;
set local role service_role;
select ok(
  (select count(*) > 0 from public.retrieve_candidates(array['SAP'], 'test/model')),
  'the service role runs retrieval'
);
reset role;

select * from finish();
rollback;
