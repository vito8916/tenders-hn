-- Phase 3: the product catalog HonduCompras codes purchases with.
--
--   unspsc_catalog  segments (2 digits), families (4), and classes (6) of
--                   CUBS, ONCAE's adaptation of UNSPSC, with their Spanish
--                   names. Company profiles are checked against it, and
--                   onboarding shows categories by name.
--
-- CUBS has no download: the `sync_catalog` job on the `ingest` queue walks its
-- dropdowns (about 420 requests), one `sync_catalog_segment` job per segment
-- so syncs interleave with it. It runs once on deploy and then monthly.
-- Products (8 digits) are not stored: product lines carry their own code and
-- name.

create table public.unspsc_catalog (
  code text primary key constraint unspsc_catalog_code_check check (code ~ '^[0-9]{2}([0-9]{2}){0,2}$'),
  level smallint not null constraint unspsc_catalog_level_check check (level between 1 and 3),
  name text not null,
  parent_code text references public.unspsc_catalog (code),
  first_seen_at timestamptz not null default now(),
  -- A code the catalog no longer lists keeps its last sighting.
  last_seen_at timestamptz not null default now(),
  constraint unspsc_catalog_level_length_check check (length(code) = level * 2),
  constraint unspsc_catalog_parent_check check ((level = 1) = (parent_code is null))
);

create index unspsc_catalog_parent_idx on public.unspsc_catalog using btree (parent_code);

grant select, insert, update, delete on public.unspsc_catalog to service_role;
grant select on public.unspsc_catalog to authenticated;

alter table public.unspsc_catalog enable row level security;

create policy "Catalog readable by signed-in users"
on public.unspsc_catalog for select to authenticated
using (true);

-- Enqueue a catalog walk only when none is waiting or in progress.
create or replace function private.enqueue_catalog_sync()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from pgmq.q_ingest q where q.message ->> 'type' in ('sync_catalog', 'sync_catalog_segment')
  ) then
    perform pgmq.send('ingest', jsonb_build_object('type', 'sync_catalog', 'enqueued_at', now()));
  end if;
end;
$$;

-- 02:15 Honduras on the 1st, between the 00:00 and 03:00 syncs.
select cron.schedule('enqueue-catalog-sync', '15 8 1 * *', 'select private.enqueue_catalog_sync()');

select private.enqueue_catalog_sync();
