import { embedMany } from "ai";
import type { Pool } from "pg";
import { z } from "zod";
import { EMBEDDING_DIMENSIONS, modelForRole } from "@/lib/ai/models";
import { chunkPages } from "../documents/chunk";
import { errorMessage, log } from "../log";
import type { JobHandler } from "../queue";

// Chunks per gateway call, well under Voyage's per-request token limit.
const EMBED_BATCH_SIZE = 64;

const embedMessageSchema = z.object({ versionId: z.uuid() });

/**
 * Splits a document version's page text into chunks and embeds them with the
 * `embed` role's model. Runs once per version and model: chunks already
 * stored for the current model mean the job is done.
 */
export const embedDocument: JobHandler = async (message, { pool }) => {
    const { versionId } = embedMessageSchema.parse(message);
    const model = modelForRole("embed");

    const { rows } = await pool.query<{ document_title: string; expediente: string; process_title: string; embedded: boolean }>(
        `select d.title as document_title, p.expediente, p.title as process_title,
                exists (
                  select 1 from public.document_chunks c
                  where c.document_version_id = v.id and c.embedding_model = $2
                ) as embedded
         from public.document_versions v
         join public.source_documents d on d.id = v.document_id
         join public.procurement_processes p on p.id = d.process_id
         where v.id = $1`,
        [versionId, model],
    );
    const version = rows[0];
    if (!version || version.embedded) {
        return;
    }

    const { rows: pages } = await pool.query<{ page_number: number; text: string }>(
        "select page_number, text from public.document_pages where document_version_id = $1 order by page_number",
        [versionId],
    );
    const chunks = chunkPages(pages.map((page) => ({ pageNumber: page.page_number, text: page.text })));
    if (chunks.length === 0) {
        log("info", "Document has no text to embed", { versionId });
        return;
    }

    // An annex page rarely names its tender; leading with the document and
    // process gives every chunk that context. Only the chunk text is stored.
    const context = `${version.document_title} · ${version.expediente}: ${version.process_title.slice(0, 300)}`;
    const embeddings: number[][] = [];

    for (let start = 0; start < chunks.length; start += EMBED_BATCH_SIZE) {
        const batch = chunks.slice(start, start + EMBED_BATCH_SIZE);
        const startedAt = performance.now();
        try {
            const result = await embedMany({
                model,
                values: batch.map((chunk) => `${context}\n\n${chunk.content}`),
                // Ignored by providers other than Voyage.
                providerOptions: { voyage: { inputType: "document", outputDimension: EMBEDDING_DIMENSIONS } },
            });
            await recordUsage(pool, model, versionId, performance.now() - startedAt, { tokens: result.usage.tokens });
            embeddings.push(...result.embeddings);
        } catch (error) {
            await recordUsage(pool, model, versionId, performance.now() - startedAt, { error: errorMessage(error) });
            throw error;
        }
    }

    await pool.query(
        `insert into public.document_chunks
           (document_version_id, embedding_model, ordinal, page_start, page_end, content, embedding)
         select $1, $2, chunk.ordinal, chunk.page_start, chunk.page_end, chunk.content, chunk.embedding::extensions.halfvec
         from unnest($3::int[], $4::int[], $5::int[], $6::text[], $7::text[])
           as chunk (ordinal, page_start, page_end, content, embedding)
         on conflict (document_version_id, embedding_model, ordinal) do nothing`,
        [
            versionId,
            model,
            chunks.map((chunk) => chunk.ordinal),
            chunks.map((chunk) => chunk.pageStart),
            chunks.map((chunk) => chunk.pageEnd),
            chunks.map((chunk) => chunk.content),
            embeddings.map((embedding) => JSON.stringify(embedding)),
        ],
    );
    log("info", "Document embedded", { versionId, model, chunks: chunks.length });
};

async function recordUsage(
    pool: Pool,
    model: string,
    versionId: string,
    latencyMs: number,
    outcome: { tokens: number } | { error: string },
) {
    await pool.query(
        `insert into public.ai_usage_events (role, model, input_tokens, latency_ms, status, error, reference)
         values ('embed', $1, $2, $3, $4, $5, $6)`,
        [
            model,
            "tokens" in outcome ? outcome.tokens : null,
            Math.round(latencyMs),
            "tokens" in outcome ? "succeeded" : "failed",
            "error" in outcome ? outcome.error : null,
            { type: "document_version", id: versionId },
        ],
    );
}
