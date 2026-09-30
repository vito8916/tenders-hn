-- ============================================================
-- Process embeddings back to product descriptions
-- ============================================================
-- 20260930040000 re-embedded processes with their specifications, which often
-- open with submission instructions; retrieval found fewer relevant processes.
-- embed_process now embeds product descriptions only (specifications stay in
-- products_text for text search). Re-embed every process whose products_text
-- differs from its descriptions, i.e. whose embedding included specifications.

select pgmq.send('docs', jsonb_build_object('type', 'embed_process', 'processId', p.id))
from public.procurement_processes p
join public.process_versions v on v.id = p.current_version_id
where p.products_text is distinct from (
  select string_agg(item ->> 'description', '; ' order by position)
  from jsonb_array_elements(v.detail -> 'products') with ordinality as product (item, position)
);
