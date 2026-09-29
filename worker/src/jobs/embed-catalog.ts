import { embedMany } from "ai";
import { EMBEDDING_DIMENSIONS, modelForRole } from "@/lib/ai/models";
import { errorMessage, log } from "../log";
import type { JobHandler } from "../queue";

// Texts per job; a larger backlog continues in a follow-up job so one run
// stays well inside the queue's visibility timeout.
const TEXTS_PER_JOB = 5_000;
const TEXTS_PER_CALL = 128;

/**
 * Embeds CUBS class names (with their family) and the distinct product
 * descriptions on HonduCompras product lines that have no embedding for the
 * `embed` role's model yet, into unspsc_terms.
 */
export const embedCatalog: JobHandler = async (_message, { pool }) => {
    const model = modelForRole("embed");
    const { rows } = await pool.query<{ kind: "class" | "product"; code: string; text: string }>(
        `with wanted as (
           select 'class' as kind, c.code, f.name || ' › ' || c.name as text
           from public.unspsc_catalog c
           join public.unspsc_catalog f on f.code = c.parent_code
           where c.level = 3
           union
           select 'product', item ->> 'unspsc', btrim(item ->> 'description')
           from public.procurement_processes p
           join public.process_versions v on v.id = p.current_version_id
           cross join lateral jsonb_array_elements(coalesce(v.detail -> 'products', '[]'::jsonb)) as item
           where item ->> 'unspsc' ~ '^[0-9]{8}$' and btrim(coalesce(item ->> 'description', '')) <> ''
         )
         select w.kind, w.code, w.text
         from wanted w
         where not exists (
           select 1 from public.unspsc_terms t
           where t.kind = w.kind and t.code = w.code and t.text = w.text and t.embedding_model = $1
         )
         limit $2`,
        [model, TEXTS_PER_JOB],
    );
    if (!rows.length) {
        return;
    }

    for (let start = 0; start < rows.length; start += TEXTS_PER_CALL) {
        const batch = rows.slice(start, start + TEXTS_PER_CALL);
        const startedAt = performance.now();
        let result: Awaited<ReturnType<typeof embedMany>>;
        try {
            result = await embedMany({
                model,
                values: batch.map((row) => row.text),
                providerOptions: { voyage: { inputType: "document", outputDimension: EMBEDDING_DIMENSIONS } },
            });
        } catch (error) {
            await pool.query(
                `insert into public.ai_usage_events (role, model, latency_ms, status, error, reference)
                 values ('embed', $1, $2, 'failed', $3, $4)`,
                [model, Math.round(performance.now() - startedAt), errorMessage(error), { type: "catalog" }],
            );
            throw error;
        }

        await pool.query(
            `with usage as (
               insert into public.ai_usage_events (role, model, input_tokens, latency_ms, status, reference)
               values ('embed', $1, $2, $3, 'succeeded', $4)
             )
             insert into public.unspsc_terms (kind, code, text, embedding_model, embedding)
             select term.kind, term.code, term.text, $1, term.embedding::extensions.halfvec
             from jsonb_to_recordset($5::jsonb) as term (kind text, code text, text text, embedding text)
             on conflict do nothing`,
            [
                model,
                result.usage.tokens,
                Math.round(performance.now() - startedAt),
                { type: "catalog", texts: batch.length },
                JSON.stringify(batch.map((row, index) => ({ ...row, embedding: JSON.stringify(result.embeddings[index]) }))),
            ],
        );
    }

    if (rows.length === TEXTS_PER_JOB) {
        await pool.query("select pgmq.send('docs', jsonb_build_object('type', 'embed_catalog'))");
    }
    log("info", "Catalog terms embedded", { texts: rows.length, model });
};
