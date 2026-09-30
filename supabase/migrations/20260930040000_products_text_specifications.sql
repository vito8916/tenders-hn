-- ============================================================
-- Product specifications in products_text
-- ============================================================
-- A product line's description is its catalog name, which in Compra Menor is
-- often generic or wrong; its specifications say what is bought. products_text
-- now carries each line as "description: specifications" (the first 600
-- characters, as Jev reads them), the same text fetch-detail.ts builds.
-- search_tsv regenerates; each changed process is queued for embed_process.

with rebuilt as (
  select p.id,
         (
           select string_agg(
                    case
                      when item ->> 'specifications' is not null
                        and lower(item ->> 'specifications') <> lower(item ->> 'description')
                      then (item ->> 'description') || ': ' || left(item ->> 'specifications', 600)
                      else item ->> 'description'
                    end,
                    '; ' order by position
                  )
           from jsonb_array_elements(v.detail -> 'products') with ordinality as product (item, position)
         ) as products_text
  from public.procurement_processes p
  join public.process_versions v on v.id = p.current_version_id
),
changed as (
  update public.procurement_processes p
  set products_text = rebuilt.products_text
  from rebuilt
  where p.id = rebuilt.id and p.products_text is distinct from rebuilt.products_text
  returning p.id
)
select pgmq.send('docs', jsonb_build_object('type', 'embed_process', 'processId', changed.id))
from changed;
