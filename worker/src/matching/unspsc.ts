// UNSPSC classes for a line of business, by meaning: the line (name,
// description, keywords) is embedded and compared with CUBS class names and
// with the product descriptions HonduCompras product lines carry
// (unspsc_terms). A line named differently from the catalog still finds its
// class, and its context tells zippers from door locks. Institutions
// sometimes leave codes out or use wrong or generic ones, so codes stay a
// supporting signal next to keywords and semantic search, and the customer
// confirms the classes.
import { embed } from "ai";
import type { Pool } from "pg";
import { EMBEDDING_DIMENSIONS, modelForRole } from "@/lib/ai/models";
import type { LineOfBusiness } from "./profile";

const NEAREST_TERMS = 40;
// Below this, proposals were mostly wrong in the first review (29 Sep 2026):
// good matches scored 0.68-0.78, wrong ones 0.52-0.63.
const MIN_SIMILARITY = 0.65;
// Classes within this much of the best match are proposed with it.
const SIMILARITY_MARGIN = 0.08;
const MAX_CLASSES = 8;
const EXAMPLES_PER_CLASS = 3;

export interface TermHit {
    kind: "class" | "product";
    code: string;
    text: string;
    similarity: number;
}

export interface RankedClass {
    code: string;
    similarity: number;
    // The nearest product descriptions under the class, best first.
    examples: string[];
}

export interface DerivedClass extends RankedClass {
    // From the CUBS catalog; null when the catalog does not list the class.
    name: string | null;
    // Processes whose product lines use the class.
    processes: number;
}

/** Groups term hits by class, scores each class by its best hit, and keeps those close enough to the line and to the best class. */
export function rankClasses(hits: TermHit[]): RankedClass[] {
    const classes = new Map<string, RankedClass>();
    for (const hit of [...hits].sort((a, b) => b.similarity - a.similarity)) {
        const code = hit.code.slice(0, 6);
        const ranked = classes.get(code) ?? { code, similarity: hit.similarity, examples: [] };
        if (hit.kind === "product" && ranked.examples.length < EXAMPLES_PER_CLASS && !ranked.examples.includes(hit.text)) {
            ranked.examples.push(hit.text);
        }
        classes.set(code, ranked);
    }
    const sorted = [...classes.values()].sort((a, b) => b.similarity - a.similarity);
    const best = sorted[0]?.similarity ?? 0;
    return sorted.filter((ranked) => ranked.similarity >= MIN_SIMILARITY && ranked.similarity >= best - SIMILARITY_MARGIN);
}

export const lineQueryText = (line: Pick<LineOfBusiness, "name" | "description" | "keywords">) =>
    `${line.name}. ${line.description} Palabras clave: ${line.keywords.join(", ")}.`;

/**
 * UNSPSC classes for a line of business, nearest first, with catalog names and
 * how many processes use each. `proposed` are classes some process uses;
 * `unused` exist in the catalog but no process uses them, so they would match
 * nothing and are only shown for reference.
 */
export async function deriveClasses(
    pool: Pool,
    line: Pick<LineOfBusiness, "name" | "description" | "keywords">,
): Promise<{ proposed: DerivedClass[]; unused: DerivedClass[] }> {
    const model = modelForRole("embed");
    const { embedding } = await embed({
        model,
        value: lineQueryText(line),
        providerOptions: { voyage: { inputType: "query", outputDimension: EMBEDDING_DIMENSIONS } },
    });

    const { rows: hits } = await pool.query<TermHit>(
        `select kind, code, text, 1 - (embedding operator(extensions.<=>) $1::extensions.halfvec) as similarity
         from public.unspsc_terms
         where embedding_model = $2
         order by embedding operator(extensions.<=>) $1::extensions.halfvec
         limit $3`,
        [JSON.stringify(embedding), model, NEAREST_TERMS],
    );
    const ranked = rankClasses(hits);

    const { rows: details } = await pool.query<{ code: string; name: string | null; processes: number }>(
        `select code, catalog.name,
                (select count(distinct p.id)::int
                 from public.procurement_processes p
                 join public.process_versions v on v.id = p.current_version_id
                 cross join lateral jsonb_array_elements(coalesce(v.detail -> 'products', '[]'::jsonb)) as item
                 where item ->> 'unspsc' like code || '%') as processes
         from unnest($1::text[]) as code
         left join public.unspsc_catalog catalog using (code)`,
        [ranked.map((item) => item.code)],
    );
    const detailByCode = new Map(details.map((row) => [row.code, row]));

    const derived = ranked.map((item) => ({
        ...item,
        name: detailByCode.get(item.code)?.name ?? null,
        processes: detailByCode.get(item.code)?.processes ?? 0,
    }));
    return {
        proposed: derived.filter((item) => item.processes > 0).slice(0, MAX_CLASSES),
        unused: derived.filter((item) => item.processes === 0),
    };
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
