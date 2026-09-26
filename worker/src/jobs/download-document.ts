import { createHash } from "node:crypto";
import { z } from "zod";
import { fetchDocument } from "../honducompras/client";
import { log } from "../log";
import type { JobHandler } from "../queue";
import { storage } from "../storage";

const DOCUMENT_BUCKET = "source-documents";

const downloadMessageSchema = z.object({ documentId: z.uuid() });

/**
 * Downloads a document link and stores each distinct file once. After the
 * first download an unchanged file costs a conditional request (304); a new
 * file under the same link is recorded as a replaced document. New files are
 * queued for text extraction.
 */
export const downloadDocument: JobHandler = async (message, { pool }) => {
    const { documentId } = downloadMessageSchema.parse(message);

    const { rows } = await pool.query<{
        process_id: string;
        source_url: string;
        title: string;
        etag: string | null;
        last_modified: string | null;
        current_version_id: string | null;
        current_sha256: string | null;
    }>(
        `select d.process_id, d.source_url, d.title, d.etag, d.last_modified, d.current_version_id, v.sha256 as current_sha256
         from public.source_documents d
         left join public.document_versions v on v.id = d.current_version_id
         where d.id = $1 and d.removed_at is null`,
        [documentId],
    );
    const document = rows[0];
    if (!document) {
        log("info", "Document link removed, skipping download", { documentId });
        return;
    }

    const response = await fetchDocument(
        document.source_url,
        document.current_version_id ? { etag: document.etag, lastModified: document.last_modified } : null,
    );

    if (response.status !== "downloaded") {
        // A missing file is a state of the link, not a job failure; the next recheck tries again.
        await pool.query("update public.source_documents set last_checked_at = now(), download_error = $2 where id = $1", [
            documentId,
            response.status === "unavailable" ? response.reason : null,
        ]);
        return;
    }

    const { validators } = response;
    const sha256 = createHash("sha256").update(response.bytes).digest("hex");
    if (sha256 === document.current_sha256) {
        await pool.query(
            `update public.source_documents
             set etag = $2, last_modified = $3, last_checked_at = now(), download_error = null
             where id = $1`,
            [documentId, validators.etag, validators.lastModified],
        );
        return;
    }

    const extension = new URL(document.source_url).pathname.match(/\.([a-z0-9]+)$/i)?.[1].toLowerCase() ?? "bin";
    const storagePath = `${document.process_id}/${sha256}.${extension}`;
    const { error } = await storage
        .from(DOCUMENT_BUCKET)
        .upload(storagePath, response.bytes, { contentType: response.mimeType, upsert: true });
    if (error) {
        throw new Error(`Could not store document ${documentId}: ${error.message}`);
    }

    const client = await pool.connect();
    try {
        await client.query("begin");

        const inserted = await client.query<{ id: string }>(
            `insert into public.document_versions (document_id, sha256, byte_size, mime_type, storage_path)
             values ($1, $2, $3, $4, $5)
             on conflict (document_id, sha256) do nothing
             returning id`,
            [documentId, sha256, response.bytes.length, response.mimeType, storagePath],
        );
        // The link can go back to a file it served before; that version is already stored.
        const versionId =
            inserted.rows[0]?.id ??
            (
                await client.query<{ id: string }>("select id from public.document_versions where document_id = $1 and sha256 = $2", [
                    documentId,
                    sha256,
                ])
            ).rows[0].id;

        await client.query(
            `update public.source_documents
             set current_version_id = $2, etag = $3, last_modified = $4, last_checked_at = now(), download_error = null
             where id = $1`,
            [documentId, versionId, validators.etag, validators.lastModified],
        );

        if (document.current_version_id) {
            await client.query(
                "insert into public.process_events (process_id, kind, before, after) values ($1, 'document_replaced', $2, $3)",
                [
                    document.process_id,
                    { title: document.title, url: document.source_url, sha256: document.current_sha256 },
                    { title: document.title, url: document.source_url, sha256 },
                ],
            );
        }

        if (inserted.rows[0]) {
            await client.query("select pgmq.send('docs', jsonb_build_object('type', 'extract_document', 'versionId', $1::uuid))", [
                versionId,
            ]);
        }

        await client.query("commit");
    } catch (error) {
        await client.query("rollback");
        throw error;
    } finally {
        client.release();
    }
};
