-- HonduCompras publishes «Compra Menor» as the object of most Compra Menor
-- processes (6,005 of 6,552 on 30 Sep 2026); what they buy is only in the
-- product lines. A run's matches carry a title people can tell apart, in the
-- table, the PDF, and the report email: «Compra menor: » and the products'
-- descriptions. The search_run job writes it; existing matches are backfilled.

create function private.process_display_title(title text, detail jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when title <> 'Compra Menor' then title
    else coalesce(
      'Compra menor: ' || nullif(left((
        select string_agg(description, ', ' order by position)
        from (
          select distinct on (product ->> 'description') product ->> 'description' as description, position
          from jsonb_array_elements(coalesce(detail -> 'products', '[]'::jsonb)) with ordinality as products (product, position)
          where nullif(btrim(product ->> 'description'), '') is not null
          order by product ->> 'description', position
        ) descriptions
      ), 200), ''),
      title
    )
  end;
$$;

update public.search_run_matches m
set title = private.process_display_title(m.title, v.detail)
from public.process_versions v
where v.id = m.process_version_id and m.title = 'Compra Menor';
