-- Chat with sources: a turn reserves credits, finishing charges its usage
-- once, failing gives them back; conversations are read only by their
-- author; retrieval returns the context's current passages.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- A 1024-dimension vector that starts with the given values.
create function pg_temp.vec(head float8[]) returns extensions.halfvec language sql as $$
  select ('[' || array_to_string(head || array_fill(0::float8, array[1024 - cardinality(head)]), ',') || ']')::extensions.halfvec
$$;

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'owner@test.local', 'authenticated', 'authenticated', '{}'),
  ('22222222-2222-4222-8222-222222222222', 'member@test.local', 'authenticated', 'authenticated', '{}'),
  ('33333333-3333-4333-8333-333333333333', 'viewer@test.local', 'authenticated', 'authenticated', '{}'),
  ('44444444-4444-4444-8444-444444444444', 'outsider@test.local', 'authenticated', 'authenticated', '{}');
insert into public.plans (id, name, max_members, monthly_ai_credits) values ('test_chat', 'Chat', 5, 3);
insert into public.organizations (id, name, slug, owner_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Test Org', 'test-org-pgtap', '11111111-1111-4111-8111-111111111111'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Other Org', 'other-org-pgtap', '44444444-4444-4444-8444-444444444444');
insert into public.organization_members (org_id, user_id, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'member'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', 'viewer');
insert into public.organization_subscriptions (org_id, plan_id, status, source, current_period_start, current_period_end)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'test_chat', 'active', 'manual', now(), now() + interval '1 month'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'test_chat', 'active', 'manual', now(), now() + interval '1 month');
insert into public.ai_model_rates (model, credits_per_1k_input, credits_per_1k_output)
values ('test/chat', 0.1, 1) on conflict (model) do nothing;

insert into public.procurement_processes (id, source, source_process_key, expediente, buyer_entity, title, detail_url) values
  ('c0000000-0000-4000-8000-00000000000a', 'honducompras_v1', 'k:a', 'LPN-008-2026', 'IHSS', 'Soporte SAP', 'http://x/a'),
  ('c0000000-0000-4000-8000-00000000000b', 'honducompras_v1', 'k:b', 'CM-1', 'SESAL', 'Guantes', 'http://x/b');
insert into public.saved_searches (id, org_id, name) values
  ('5eeeeeee-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Ajena');
insert into public.search_runs (id, org_id, saved_search_id, status) values
  ('d0000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '5eeeeeee-0000-4000-8000-000000000001', 'completed');

insert into public.source_documents (id, process_id, source_url, title, kind) values
  ('d0000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-00000000000a', 'http://x/pliego.pdf', 'Pliego', 'pliego'),
  ('d0000000-0000-4000-8000-00000000000b', 'c0000000-0000-4000-8000-00000000000b', 'http://x/otro.pdf', 'Otro', 'pliego');
insert into public.document_versions (id, document_id, sha256, byte_size, mime_type, storage_path) values
  ('e0000000-0000-4000-8000-00000000000a', 'd0000000-0000-4000-8000-00000000000a', 'old', 1, 'application/pdf', 'x'),
  ('e0000000-0000-4000-8000-00000000000c', 'd0000000-0000-4000-8000-00000000000a', 'new', 1, 'application/pdf', 'x'),
  ('e0000000-0000-4000-8000-00000000000b', 'd0000000-0000-4000-8000-00000000000b', 'sha', 1, 'application/pdf', 'x');
update public.source_documents set current_version_id = 'e0000000-0000-4000-8000-00000000000c' where id = 'd0000000-0000-4000-8000-00000000000a';
update public.source_documents set current_version_id = 'e0000000-0000-4000-8000-00000000000b' where id = 'd0000000-0000-4000-8000-00000000000b';
insert into public.document_chunks (document_version_id, embedding_model, ordinal, page_start, page_end, content, embedding) values
  ('e0000000-0000-4000-8000-00000000000c', 'test/model', 0, 3, 3, 'La garantía de mantenimiento de oferta es del 2%', pg_temp.vec(array[1])),
  ('e0000000-0000-4000-8000-00000000000c', 'test/model', 1, 9, 9, 'Plazo de entrega de 30 días', pg_temp.vec(array[0, 1])),
  -- The replaced version and another process's document are not the context.
  ('e0000000-0000-4000-8000-00000000000a', 'test/model', 0, 3, 3, 'La garantía de mantenimiento de oferta es del 5%', pg_temp.vec(array[1])),
  ('e0000000-0000-4000-8000-00000000000b', 'test/model', 0, 1, 1, 'La garantía de guantes', pg_temp.vec(array[1]));

create function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

-- ---------- Retrieval ----------
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select results_eq(
  $$select page_start, document_title from public.retrieve_chat_passages(
      array['c0000000-0000-4000-8000-00000000000a']::uuid[], '¿Cuál es la garantía?', pg_temp.vec(array[1]), 'test/model', 5)$$,
  $$values (3, 'Pliego'), (9, 'Pliego')$$,
  'retrieval reads only the current version of the context''s documents, best passage first'
);

-- ---------- Starting a turn ----------
select throws_ok(
  $$select * from public.start_chat_turn('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'opportunity', 'c0000000-0000-4000-8000-00000000000a',
      '¿Hola?', 'm0', 'unknown/model', 1000, 500)$$,
  'P0001', 'chat_model_unavailable', 'a model without a rate cannot answer'
);
select throws_ok(
  $$select * from public.start_chat_turn('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'report', 'd0000000-0000-4000-8000-000000000001',
      '¿Hola?', 'm0', 'test/chat', 1000, 500)$$,
  'P0001', 'chat_context_not_found', 'another organization''s run is not a context'
);
select throws_ok(
  $$select * from public.start_chat_turn('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'opportunity', 'c0000000-0000-4000-8000-00000000000a',
      '   ', 'm0', 'test/chat', 1000, 500)$$,
  'P0001', 'invalid_question', 'an empty question is refused'
);

-- 10K input × 0.1 + 1K output × 1 = 2 credits reserved of 3.
select results_eq(
  $$select reserved_credits from public.start_chat_turn('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'opportunity',
      'c0000000-0000-4000-8000-00000000000a', '¿Cuál es la garantía?', 'm1', 'test/chat', 10000, 1000)$$,
  $$values (2)$$,
  'a turn reserves the estimate at the model''s rate'
);
select throws_ok(
  $$select * from public.start_chat_turn('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'opportunity', 'c0000000-0000-4000-8000-00000000000a',
      '¿Cuál es la garantía?', 'm1', 'test/chat', 10000, 1000)$$,
  'P0001', 'chat_turn_exists', 'sending the same question twice is refused'
);
select throws_ok(
  $$select * from public.start_chat_turn('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'opportunity', 'c0000000-0000-4000-8000-00000000000a',
      '¿Y el plazo?', 'm2', 'test/chat', 10000, 1000)$$,
  'P0001', 'insufficient_credits', 'a turn needs the credits it may use'
);
select is((select count(*)::int from public.chat_messages), 2, 'a refused turn leaves no message behind');

-- ---------- Finishing ----------
select results_eq(
  $$select credits_charged, credits_available from public.finish_chat_turn(
      (select id from public.chat_messages where role = 'assistant'), 'Es del 2% [S1].',
      '[{"id": "S1"}]', false, 'test/chat-2026', 2000, 300, 900, 'test/model', 12)$$,
  $$values (1, 2)$$,
  'finishing charges the real usage, at least 1 credit'
);
select throws_ok(
  $$select * from public.finish_chat_turn((select id from public.chat_messages where role = 'assistant'), 'otra', '[]', false, null, 1, 1, 1)$$,
  'P0001', 'chat_turn_not_pending', 'an answer is charged once'
);
select results_eq(
  $$select status, content, credits_charged, model from public.chat_messages where role = 'assistant'$$,
  $$values ('completed', 'Es del 2% [S1].', 1, 'test/chat-2026')$$,
  'the answer is stored with its cost and the model that answered'
);

-- ---------- Failing ----------
select lives_ok(
  $$select * from public.start_chat_turn('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'opportunity', 'c0000000-0000-4000-8000-00000000000a',
      '¿Y el plazo?', 'm2', 'test/chat', 1000, 1000)$$,
  'a second question goes to the same conversation'
);
select public.fail_chat_turn((select id from public.chat_messages where status = 'pending'), 'gateway down');
select public.fail_chat_turn((select id from public.chat_messages where status = 'failed'), 'again');
select is(
  (select available from public.get_ai_credit_balance('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')), 2,
  'a failed answer gives its credits back'
);
select is((select count(*)::int from public.chat_threads), 1, 'one conversation per user and opportunity');

-- ---------- Who reads it ----------
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select is((select count(*)::int from public.chat_messages), 0, 'the owner does not read a member''s conversation');
select is((select count(*)::int from public.chat_threads), 0, 'nor its thread');
select throws_ok(
  $$select * from public.finish_chat_turn((select id from public.chat_messages limit 1), 'x', '[]', false, null, 1, 1, 1)$$,
  'P0001', 'chat_turn_not_pending', 'nobody finishes another user''s answer'
);
select throws_ok(
  $$insert into public.chat_messages (thread_id, org_id, user_id, role, content)
    select id, org_id, user_id, 'user', 'x' from public.chat_threads$$,
  '42501', null, 'messages are written only through the turn functions'
);

select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
select throws_ok(
  $$select * from public.start_chat_turn('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'opportunity', 'c0000000-0000-4000-8000-00000000000a',
      '¿Hola?', 'v1', 'test/chat', 1000, 500)$$,
  'P0001', 'insufficient_role', 'viewers do not chat'
);

select pg_temp.act_as('44444444-4444-4444-8444-444444444444');
select throws_ok(
  $$select * from public.start_chat_turn('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'opportunity', 'c0000000-0000-4000-8000-00000000000a',
      '¿Hola?', 'o1', 'test/chat', 1000, 500)$$,
  'P0001', 'insufficient_role', 'outsiders do not chat in the organization'
);

-- ---------- Expired reservations ----------
reset role;
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
set local role authenticated;
select * from public.start_chat_turn('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'opportunity', 'c0000000-0000-4000-8000-00000000000a',
  '¿Y la fianza?', 'm3', 'test/chat', 1000, 500);
reset role;
update public.ai_credit_reservations set expires_at = now() - interval '1 minute' where status = 'reserved';
select private.release_expired_ai_credit_reservations();
select is((select count(*)::int from public.chat_messages where status = 'pending'), 0, 'an answer whose reservation expired is failed');

select * from finish();
rollback;
