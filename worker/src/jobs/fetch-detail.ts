import { createHash } from "node:crypto";
import { z } from "zod";
import { fetchDetailPage } from "../honducompras/client";
import { diffDetails } from "../honducompras/events";
import { parseDetailPage, type ProcessDetail } from "../honducompras/parse";
import { log } from "../log";
import type { JobHandler } from "../queue";

const fetchDetailMessageSchema = z.object({ processId: z.uuid() });

/**
 * Reads a process's detail page, stores a new version when its content
 * changed, records what changed as events, keeps the document list in sync,
 * and queues a download check for each of its files. An unchanged page only
 * updates last_checked_at and re-checks the files.
 */
export const fetchDetail: JobHandler = async (message, { pool }) => {
    const { processId } = fetchDetailMessageSchema.parse(message);

    const { rows } = await pool.query<{ detail_url: string; current_version_id: string | null; previous_detail: ProcessDetail | null }>(
        `select p.detail_url, p.current_version_id, v.detail as previous_detail
         from public.procurement_processes p
         left join public.process_versions v on v.id = p.current_version_id
         where p.id = $1`,
        [processId],
    );
    const process = rows[0];
    if (!process) {
        log("warn", "Process no longer exists, skipping detail fetch", { processId });
        return;
    }

    const detail = parseDetailPage(await fetchDetailPage(process.detail_url));
    const contentSha256 = createHash("sha256").update(JSON.stringify(detail)).digest("hex");

    const client = await pool.connect();
    try {
        await client.query("begin");

        const inserted = await client.query<{ id: string }>(
            `insert into public.process_versions (process_id, content_sha256, detail)
             values ($1, $2, $3)
             on conflict (process_id, content_sha256) do nothing
             returning id`,
            [processId, contentSha256, detail],
        );
        const versionId =
            inserted.rows[0]?.id ??
            (
                await client.query<{ id: string }>(
                    "select id from public.process_versions where process_id = $1 and content_sha256 = $2",
                    [processId, contentSha256],
                )
            ).rows[0].id;

        await client.query(
            `update public.procurement_processes
             set expediente = $2, buyer_entity = $3, purchase_unit = $4, title = $5, stage = $6, modality = $7,
                 acquisition_type = $8, source_start_at = $9, closes_at = $10, current_version_id = $11,
                 last_checked_at = now()
             where id = $1`,
            [
                processId,
                detail.expediente,
                detail.buyerEntity,
                detail.purchaseUnit,
                detail.object,
                detail.stage,
                detail.modality,
                detail.acquisitionType,
                detail.startsAt,
                detail.bidsDueAt,
                versionId,
            ],
        );

        if (versionId !== process.current_version_id) {
            for (const event of diffDetails(process.previous_detail, detail)) {
                await client.query(
                    "insert into public.process_events (process_id, version_id, kind, before, after) values ($1, $2, $3, $4, $5)",
                    [processId, versionId, event.kind, event.before, event.after],
                );
            }
        }

        for (const document of detail.documents) {
            await client.query(
                `insert into public.source_documents (process_id, source_url, title, kind)
                 values ($1, $2, $3, $4)
                 on conflict (process_id, source_url) do update
                 set title = excluded.title, kind = excluded.kind, last_seen_at = now(), removed_at = null`,
                [processId, document.url, document.title, document.kind],
            );
        }
        await client.query(
            `update public.source_documents set removed_at = now()
             where process_id = $1 and removed_at is null and not (source_url = any($2::text[]))`,
            [processId, detail.documents.map((document) => document.url)],
        );
        // Conditional requests make re-checking unchanged files cheap, so every
        // detail fetch also checks the process's files for new or replaced content.
        await client.query(
            `select pgmq.send('ingest', jsonb_build_object('type', 'download_document', 'documentId', d.id))
             from public.source_documents d
             where d.process_id = $1 and d.removed_at is null
               and not exists (
                 select 1 from pgmq.q_ingest q
                 where q.message ->> 'type' = 'download_document' and q.message ->> 'documentId' = d.id::text
               )`,
            [processId],
        );

        await client.query("commit");
    } catch (error) {
        await client.query("rollback");
        throw error;
    } finally {
        client.release();
    }
};
