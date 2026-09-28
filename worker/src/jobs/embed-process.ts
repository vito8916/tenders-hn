import { embed } from "ai";
import { z } from "zod";
import { EMBEDDING_DIMENSIONS, modelForRole } from "@/lib/ai/models";
import { errorMessage } from "../log";
import type { JobHandler } from "../queue";

const embedProcessMessageSchema = z.object({ processId: z.uuid() });

/**
 * Embeds a process's object (title, entity, products) so retrieval can find
 * it semantically even when it has no documents. Queued when a new detail
 * version is stored.
 */
export const embedProcess: JobHandler = async (message, { pool }) => {
    const { processId } = embedProcessMessageSchema.parse(message);
    const model = modelForRole("embed");

    const { rows } = await pool.query<{ title: string; buyer_entity: string; purchase_unit: string | null; products_text: string | null }>(
        "select title, buyer_entity, purchase_unit, products_text from public.procurement_processes where id = $1",
        [processId],
    );
    const process = rows[0];
    if (!process) {
        return;
    }

    const value = [
        process.title,
        `Entidad: ${[process.buyer_entity, process.purchase_unit].filter(Boolean).join(" · ")}`,
        process.products_text && `Productos: ${process.products_text}`,
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
