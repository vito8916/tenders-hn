-- UNSPSC terms: class and product embeddings with consistent codes, one per
-- text and model; service role only.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, aud, role, raw_user_meta_data)
values ('11111111-1111-4111-8111-111111111111', 'member@test.local', 'authenticated', 'authenticated', '{}');

create function pg_temp.vec() returns extensions.halfvec language sql as $$
  select ('[1' || repeat(',0', 1023) || ']')::extensions.halfvec
$$;

insert into public.unspsc_terms (kind, code, text, embedding_model, embedding) values
  ('class', '531027', 'Ropa › Uniformes', 'test/model', pg_temp.vec()),
  ('product', '53102701', 'Uniformes escolares', 'test/model', pg_temp.vec());

select throws_ok(
  $$insert into public.unspsc_terms (kind, code, text, embedding_model, embedding) values ('class', '53102701', 'Uniformes', 'test/model', pg_temp.vec())$$,
  '23514', null, 'a class code has 6 digits'
);
select throws_ok(
  $$insert into public.unspsc_terms (kind, code, text, embedding_model, embedding) values ('product', '531027', 'Uniformes', 'test/model', pg_temp.vec())$$,
  '23514', null, 'a product code has 8 digits'
);
select throws_ok(
  $$insert into public.unspsc_terms (kind, code, text, embedding_model, embedding) values ('product', '53102701', 'Uniformes escolares', 'test/model', pg_temp.vec())$$,
  '23505', null, 'a text is embedded once per code and model'
);

select private.enqueue_catalog_embedding();
select private.enqueue_catalog_embedding();
select is(
  (select count(*)::int from pgmq.q_docs where message ->> 'type' = 'embed_catalog'),
  1,
  'only one embedding pass is queued at a time'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select throws_ok('select * from public.unspsc_terms', '42501', null, 'members cannot read the embeddings');
reset role;

select * from finish();
rollback;
