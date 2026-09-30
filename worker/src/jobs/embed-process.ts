import { embed } from "ai";
import { z } from "zod";
import { EMBEDDING_DIMENSIONS, modelForRole } from "@/lib/ai/models";
import { errorMessage } from "../log";
import type { JobHandler } from "../queue";

const embedProcessMessageSchema = z.object({ processId: z.uuid() });

/**
 * Embeds a process's object (title, entity, product descriptions) so retrieval
 * can find it semantically even when it has no documents. Queued when a new
 * detail version is stored. Specifications are searchable by text but left out
 * here: many open with submission instructions, which pulled relevant
 * processes down in the 30 Sep retrieval eval.
 */
export const embedProcess: JobHandler = async (message, { pool }) => {
    const { processId } = embedProcessMessageSchema.parse(message);
    const model = modelForRole("embed");

    const { rows } = await pool.query<{ title: string; buyer_entity: string; purchase_unit: string | null; product_descriptions: string | null }>(
        `select p.title, p.buyer_entity, p.purchase_unit,
                (select string_agg(item ->> 'description', '; ' order by position)
                 from jsonb_array_elements(v.detail -> 'products') with ordinality as product (item, position)) as product_descriptions
         from public.procurement_processes p
         left join public.process_versions v on v.id = p.current_version_id
         where p.id = $1`,
        [processId],
    );
    const process = rows[0];
    if (!process) {
        return;
    }

    const value = [
        process.title,
        `Entidad: ${[process.buyer_entity, process.purchase_unit].filter(Boolean).join(" · ")}`,
        process.product_descriptions && `Productos: ${process.product_descriptions}`,
    ]
        .filter(Boolean)
        .join("\n");

    const startedAt = performance.now();
    let embedding: number[];
    let tokens: number;
    try {
        const result = await embed({
            model,
            value,
            // Ignored by providers other than Voyage.
            providerOptions: { voyage: { inputType: "document", outputDimension: EMBEDDING_DIMENSIONS } },
        });
        embedding = result.embedding;
        tokens = result.usage.tokens;
    } catch (error) {
        await pool.query(
            `insert into public.ai_usage_events (role, model, latency_ms, status, error, reference)
             values ('embed', $1, $2, 'failed', $3, $4)`,
            [model, Math.round(performance.now() - startedAt), errorMessage(error), { type: "process", id: processId }],
        );
        throw error;
    }

    await pool.query(
        `with usage as (
           insert into public.ai_usage_events (role, model, input_tokens, latency_ms, status, reference)
           values ('embed', $2, $3, $4, 'succeeded', $5)
         )
         update public.procurement_processes
         set object_embedding = $6::extensions.halfvec, object_embedding_model = $2
         where id = $1`,
        [processId, model, tokens, Math.round(performance.now() - startedAt), { type: "process", id: processId }, JSON.stringify(embedding)],
    );
};
