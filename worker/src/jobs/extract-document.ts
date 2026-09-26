import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Pool } from "pg";
import { z } from "zod";
import { extractPdfPage, ocrImage, pdfPageCount, type ExtractedPage } from "../documents/extract";
import { errorMessage, log } from "../log";
import type { JobHandler } from "../queue";
import { storage } from "../storage";

const DOCUMENT_BUCKET = "source-documents";

const extractMessageSchema = z.object({ versionId: z.uuid() });

/**
 * Writes the text of every page of a stored document version: the PDF text
 * layer, or Spanish OCR for scanned pages and images. Pages already stored
 * are skipped, so a job interrupted mid-document resumes where it stopped.
 * Formats other than PDF and images are marked unsupported.
 */
export const extractDocument: JobHandler = async (message, { pool }) => {
    const { versionId } = extractMessageSchema.parse(message);

    const { rows } = await pool.query<{ storage_path: string; mime_type: string }>(
        "select storage_path, mime_type from public.document_versions where id = $1",
        [versionId],
    );
    const version = rows[0];
    if (!version) {
        log("warn", "Document version no longer exists, skipping extraction", { versionId });
        return;
    }

    const format = version.mime_type === "application/pdf" ? "pdf" : version.mime_type.startsWith("image/") ? "image" : null;
    if (!format) {
        await finishExtraction(pool, versionId, { status: "unsupported", pageCount: null, error: null });
        return;
    }

    const { data, error } = await storage.from(DOCUMENT_BUCKET).download(version.storage_path);
    if (error) {
        throw new Error(`Could not read stored document ${version.storage_path}: ${error.message}`);
    }

    const workDir = await mkdtemp(path.join(tmpdir(), "extract-"));
    try {
        const file = path.join(workDir, "source");
        await writeFile(file, Buffer.from(await data.arrayBuffer()));

        let pageCount = 1;
        if (format === "pdf") {
            try {
                pageCount = await pdfPageCount(file);
            } catch (error) {
                // A damaged or protected file fails the same way on every retry.
                await finishExtraction(pool, versionId, { status: "failed", pageCount: null, error: `Unreadable PDF: ${errorMessage(error)}` });
                return;
            }
        }

        const { rows: stored } = await pool.query<{ page_number: number }>(
            "select page_number from public.document_pages where document_version_id = $1",
            [versionId],
        );
        const storedPages = new Set(stored.map((row) => row.page_number));
        const failures: string[] = [];

        for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
            if (storedPages.has(pageNumber)) continue;

            let page: ExtractedPage;
            try {
                page = format === "pdf" ? await extractPdfPage(file, pageNumber, workDir) : await ocrImage(file, workDir);
            } catch (error) {
                failures.push(`page ${pageNumber}: ${errorMessage(error)}`);
                continue;
            }
            await pool.query(
                `insert into public.document_pages (document_version_id, page_number, text, method, ocr_confidence)
                 values ($1, $2, $3, $4, $5)
                 on conflict (document_version_id, page_number) do nothing`,
                [versionId, pageNumber, page.text, page.method, page.ocrConfidence],
            );
        }

        const {
            rows: [summary],
        } = await pool.query<{ pages: number; any_ocr: boolean }>(
            `select count(*)::int as pages, coalesce(bool_or(method = 'ocr'), false) as any_ocr
             from public.document_pages where document_version_id = $1`,
            [versionId],
        );
        const status = summary.pages === 0 ? "failed" : summary.pages < pageCount ? "partial" : summary.any_ocr ? "ocr" : "text";
        await finishExtraction(pool, versionId, { status, pageCount, error: failures.join("; ") || null });
        log("info", "Document extracted", { versionId, status, pages: pageCount, failedPages: failures.length });
    } finally {
        await rm(workDir, { recursive: true, force: true });
    }
};

async function finishExtraction(pool: Pool, versionId: string, result: { status: string; pageCount: number | null; error: string | null }) {
    await pool.query(
        `update public.document_versions
         set extraction_status = $2, page_count = $3, extraction_error = $4, extracted_at = now()
         where id = $1`,
        [versionId, result.status, result.pageCount, result.error],
    );
}
