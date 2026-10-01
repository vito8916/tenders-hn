-- The results table (spec §12.2) filters and sorts by acquisition type, start
-- date, detection date, and whether documents exist. Like the rest of a match,
-- they are kept as the run saw them, so a run's table and downloads stay its
-- historical snapshot.

alter table public.search_run_matches
  add column acquisition_type text,
  add column starts_at timestamptz,
  -- When the platform first saw the process.
  add column detected_at timestamptz,
  -- Documents published for the process when the run evaluated it.
  add column documents_count integer not null default 0;

update public.search_run_matches m
set acquisition_type = p.acquisition_type,
    starts_at = p.source_start_at,
    detected_at = p.first_seen_at,
    documents_count = (
      select count(*) from public.source_documents d where d.process_id = p.id and d.removed_at is null
    )
from public.procurement_processes p
where p.id = m.process_id;
