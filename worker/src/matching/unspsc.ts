// UNSPSC classes for a line of business, taken from how Honduran institutions
// actually code their purchases: product lines whose description matches the
// line's keywords, grouped by class. Institutions sometimes leave codes out or
// use wrong or generic ones, so a class needs several processes and a fair
// share of the matches before it is proposed, and codes remain a supporting
// signal next to keywords and semantic search.
import type { Pool } from "pg";

const MIN_PROCESSES = 3;
const MIN_SHARE = 0.05;
const MAX_CLASSES = 6;
const EXAMPLES_PER_CLASS = 3;

export interface DerivedClass {
    code: string;
    // From the CUBS catalog; null when the catalog does not list the class.
    name: string | null;
    processes: number;
    share: number;
    examples: string[];
}

/** Classes of the product lines that match any keyword, most used first. */
export async function deriveClasses(pool: Pool, keywords: string[]): Promise<DerivedClass[]> {
    const { rows } = await pool.query<{ code: string; name: string | null; processes: number; share: number; examples: string[] }>(
        `with query as (
           select string_agg('(' || tq::text || ')', ' | ')::tsquery as tq
           from (select websearch_to_tsquery('spanish'::regconfig, private.immutable_unaccent(keyword)) as tq
                 from unnest($1::text[]) as keyword) terms
           where numnode(tq) > 0
         ),
         matches as (
           select p.id as process_id, left(item ->> 'unspsc', 6) as code, item ->> 'description' as description
           from public.procurement_processes p
           join public.process_versions v on v.id = p.current_version_id
           cross join lateral jsonb_array_elements(coalesce(v.detail -> 'products', '[]'::jsonb)) as item
           cross join query
           where item ->> 'unspsc' ~ '^[0-9]{8}$'
             and to_tsvector('spanish'::regconfig, private.immutable_unaccent(item ->> 'description')) @@ query.tq
         ),
         classes as (
           select code, count(distinct process_id)::int as processes
           from matches group by code
         ),
         examples as (
           select code, array_agg(description order by lines desc) filter (where position <= $2) as examples
           from (
             select code, description, count(*) as lines,
                    row_number() over (partition by code order by count(*) desc) as position
             from matches group by code, description
           ) ranked
           group by code
         )
         select c.code, catalog.name, c.processes,
                round(c.processes::numeric / nullif((select count(distinct process_id) from matches), 0), 3)::float8 as share,
                e.examples
         from classes c
         join examples e using (code)
         left join public.unspsc_catalog catalog on catalog.code = c.code
         order by c.processes desc`,
        [keywords, EXAMPLES_PER_CLASS],
    );

    return rows.filter((row) => row.processes >= MIN_PROCESSES && row.share >= MIN_SHARE).slice(0, MAX_CLASSES);
}

/** The catalog name of each code, or null for a code the catalog does not list. */
export async function catalogNames(pool: Pool, codes: string[]): Promise<Record<string, string | null>> {
    const { rows } = await pool.query<{ code: string; name: string | null }>(
        `select code, catalog.name
         from unnest($1::text[]) as code
         left join public.unspsc_catalog catalog using (code)`,
        [codes],
    );
    return Object.fromEntries(rows.map((row) => [row.code, row.name]));
}
