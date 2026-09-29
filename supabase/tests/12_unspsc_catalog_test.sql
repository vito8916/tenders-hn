-- CUBS catalog: segments, families, and classes with consistent codes and
-- parents; readable by signed-in users, written by the service role only.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

delete from public.unspsc_catalog;

insert into auth.users (id, email, aud, role, raw_user_meta_data)
values ('11111111-1111-4111-8111-111111111111', 'member@test.local', 'authenticated', 'authenticated', '{}');

insert into public.unspsc_catalog (code, level, name, parent_code) values
  ('43', 1, 'Telecomunicaciones y radiodifusión de tecnología de la información', null),
  ('4323', 2, 'Software', '43'),
  ('432316', 3, 'Software de planificación de recursos empresariales (ERP) y contabilidad financiera', '4323');

select throws_ok(
  $$insert into public.unspsc_catalog (code, level, name, parent_code) values ('4321', 3, 'Equipo informático', '43')$$,
  '23514', null, 'the level matches the length of the code'
);
select throws_ok(
  $$insert into public.unspsc_catalog (code, level, name, parent_code) values ('4321', 2, 'Equipo informático', null)$$,
  '23514', null, 'families and classes have a parent'
);
select throws_ok(
  $$insert into public.unspsc_catalog (code, level, name, parent_code) values ('4411', 2, 'Suministros de oficina', '44')$$,
  '23503', null, 'the parent must exist'
);

-- A walk already waiting is not queued twice.
select private.enqueue_catalog_sync();
select private.enqueue_catalog_sync();
select is(
  (select count(*)::int from pgmq.q_ingest where message ->> 'type' = 'sync_catalog'),
  1,
  'only one catalog walk is queued at a time'
);

-- ---------- Access ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select is((select name from public.unspsc_catalog where code = '4323'), 'Software', 'signed-in users read the catalog');
select throws_ok(
  $$insert into public.unspsc_catalog (code, level, name, parent_code) values ('4321', 2, 'Equipo informático', '43')$$,
  '42501', null, 'signed-in users cannot change the catalog'
);
reset role;
set local role anon;
select throws_ok('select * from public.unspsc_catalog', '42501', null, 'anonymous visitors cannot read the catalog');
reset role;

select * from finish();
rollback;
