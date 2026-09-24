import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import type { Pool } from "pg";
import { z } from "zod";
import { goToResultsPage, searchByStartDate } from "../honducompras/client";
import { ParserHealthError, parseSearchPage, SOURCE, type ListingRow, type SearchPage } from "../honducompras/parse";
import { errorMessage, log } from "../log";
import type { JobHandler } from "../queue";
import { storage } from "../storage";

// Overlap with earlier syncs so late publications and edits are caught (spec §6).
const WINDOW_DAYS = 7;
const RAW_PAGE_BUCKET = "source-pages";
const RAW_PAGE_RETENTION = "14 days";
const SYNC_LOCK = `ingest.sync_window:${SOURCE}`;

const isoDate = z.iso.date();
const syncMessageSchema = z.object({ from: isoDate.optional(), to: isoDate.optional() });

/** yyyy-mm-dd in Honduras, where the portal's dates live. */
function hondurasDate(date: Date): string {
    return date.toLocaleDateString("en-CA", { timeZone: "America/Tegucigalpa" });
}

interface SyncStats {
    pagesExpected: number;
    pagesFetched: number;
    seen: Set<string>;
    new: number;
    changed: number;
}

/**
 * Searches HonduCompras by start date (default: the last 7 days), walks every
 * results page, keeps each page's raw HTML, upserts the processes it lists,
 * and enqueues a detail fetch for new or changed ones. One sync at a time per
 * source, across all worker replicas.
 */
export const syncWindow: JobHandler = async (message, { pool }) => {
    const today = new Date();
    const { from = hondurasDate(new Date(today.getTime() - WINDOW_DAYS * 86_400_000)), to = hondurasDate(today) } =
        syncMessageSchema.parse(message);

    const lockClient = await pool.connect();
    try {
        const { rows } = await lockClient.query<{ locked: boolean }>("select pg_try_advisory_lock(hashtext($1)) as locked", [SYNC_LOCK]);
        if (!rows[0].locked) {
            log("info", "A sync is already running, skipping", { source: SOURCE });
            return;
        }

        try {
            await runSync(pool, from, to);
        } finally {
            await lockClient.query("select pg_advisory_unlock(hashtext($1))", [SYNC_LOCK]);
        }
    } finally {
        lockClient.release();
    }
};

async function runSync(pool: Pool, from: string, to: string) {
    // Holding the lock means any "running" row belongs to a worker that died mid-sync.
    await pool.query(
        `update public.source_sync_runs
         set status = 'failed', error = 'Interrupted before finishing', finished_at = now()
         where source = $1 and status = 'running'`,
        [SOURCE],
    );

    const {
        rows: [run],
    } = await pool.query<{ id: string }>(
        "insert into public.source_sync_runs (source, window_start, window_end) values ($1, $2, $3) returning id",
        [SOURCE, from, to],
    );
    const stats: SyncStats = { pagesExpected: 1, pagesFetched: 0, seen: new Set(), new: 0, changed: 0 };
    log("info", "Sync started", { syncRunId: run.id, from, to });

    try {
        let html = await searchByStartDate(from, to);

        for (let pageNumber = 1; ; pageNumber++) {
            const page = await recordPage(pool, run.id, pageNumber, html);

            for (const row of page.rows) {
                stats.seen.add(row.processKey);
                const outcome = await upsertListingRow(pool, row);
                if (outcome === "new") stats.new++;
                if (outcome === "changed") stats.changed++;
                if (outcome !== "unchanged") await enqueueDetailFetch(pool, row.processKey);
            }

            stats.pagesFetched = pageNumber;
            stats.pagesExpected = Math.max(stats.pagesExpected, ...page.pageNumbers);
            await updateRun(pool, run.id, "running", stats);

            if (!page.pageNumbers.includes(pageNumber + 1)) break;
            html = await goToResultsPage(page.formFields, pageNumber + 1);
        }

        if (stats.seen.size === 0) {
            // A 7-day window always has publications; an empty result means the search did not work.
            throw new Error("The search returned no processes");
        }

        await updateRun(pool, run.id, "succeeded", stats);
        log("info", "Sync finished", { syncRunId: run.id, pages: stats.pagesFetched, seen: stats.seen.size, new: stats.new, changed: stats.changed });
    } catch (error) {
        // Partial only when some processes were stored before the failure.
        await updateRun(pool, run.id, stats.seen.size > 0 ? "partial" : "failed", stats, errorMessage(error));
        throw error;
    }

    await removeExpiredRawPages(pool);
}

async function updateRun(pool: Pool, runId: string, status: string, stats: SyncStats, error: string | null = null) {
    await pool.query(
        `update public.source_sync_runs
         set status = $2, pages_expected = $3, pages_fetched = $4, processes_seen = $5,
             processes_new = $6, processes_changed = $7, error = $8,
             finished_at = case when $2 = 'running' then null else now() end
         where id = $1`,
        [runId, status, stats.pagesExpected, stats.pagesFetched, stats.seen.size, stats.new, stats.changed, error],
    );
}

/** Keeps the raw HTML (even when parsing fails, for debugging) and parses it. */
async function recordPage(pool: Pool, runId: string, pageNumber: number, html: string): Promise<SearchPage> {
    const storagePath = `${SOURCE}/${runId}/page-${String(pageNumber).padStart(3, "0")}.html.gz`;
    const { error } = await storage
        .from(RAW_PAGE_BUCKET)
        .upload(storagePath, gzipSync(html), { contentType: "application/gzip", upsert: true });
    if (error) {
        throw new Error(`Could not store raw page ${pageNumber}: ${error.message}`);
    }

    let page: SearchPage | null = null;
    let parseError: unknown = null;
    try {
        page = parseSearchPage(html);
        if (page.currentPage !== pageNumber) {
            throw new ParserHealthError(`Asked for page ${pageNumber}, the portal returned page ${page.currentPage}`);
        }
    } catch (error) {
        parseError = error;
    }

    await pool.query(
        `insert into public.source_pages (sync_run_id, page_number, status, row_count, html_sha256, storage_path)
         values ($1, $2, $3, $4, $5, $6)`,
        [runId, pageNumber, page && !parseError ? "parsed" : "failed", page?.rows.length ?? null, createHash("sha256").update(html).digest("hex"), storagePath],
    );

    if (parseError || !page) {
        throw parseError;
    }
    return page;
}

const HONDURAS_MIDNIGHT = "T00:00:00-06:00";

/**
 * Listing values only fill a process until its detail page has been read; the
 * detail is authoritative (full object, times). Returns whether the detail
 * needs fetching.
 */
async function upsertListingRow(pool: Pool, row: ListingRow): Promise<"new" | "changed" | "unchanged"> {
    const { rows } = await pool.query<{ id: string; has_detail: boolean; stage: string | null; close_date: string | null }>(
        `select id, current_version_id is not null as has_detail, stage,
                to_char(closes_at at time zone 'America/Tegucigalpa', 'YYYY-MM-DD') as close_date
         from public.procurement_processes
         where source = $1 and source_process_key = $2`,
        [SOURCE, row.processKey],
    );
    const existing = rows[0];
    const listingValues = [
        row.expediente,
        row.buyerEntity,
        row.purchaseUnit,
        row.title,
        row.stage,
        row.modality,
        row.startDate + HONDURAS_MIDNIGHT,
        row.closeDate && row.closeDate + HONDURAS_MIDNIGHT,
        row.detailUrl,
    ];

    if (!existing) {
        await pool.query(
            `insert into public.procurement_processes
               (source, source_process_key, expediente, buyer_entity, purchase_unit, title, stage, modality,
                source_start_at, closes_at, detail_url)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             on conflict (source, source_process_key) do nothing`,
            [SOURCE, row.processKey, ...listingValues],
        );
        return "new";
    }

    if (!existing.has_detail) {
        await pool.query(
            `update public.procurement_processes
             set expediente = $2, buyer_entity = $3, purchase_unit = $4, title = $5, stage = $6, modality = $7,
                 source_start_at = $8, closes_at = $9, detail_url = $10, last_seen_at = now()
             where id = $1`,
            [existing.id, ...listingValues],
        );
        return "changed";
    }

    await pool.query("update public.procurement_processes set detail_url = $2, last_seen_at = now() where id = $1", [
        existing.id,
        row.detailUrl,
    ]);
    return existing.stage !== row.stage || existing.close_date !== row.closeDate ? "changed" : "unchanged";
}

/** Skips the enqueue when a fetch for this process is already waiting. */
async function enqueueDetailFetch(pool: Pool, processKey: string) {
    await pool.query(
        `select pgmq.send('ingest', jsonb_build_object('type', 'fetch_detail', 'processId', p.id))
         from public.procurement_processes p
         where p.source = $1 and p.source_process_key = $2
           and not exists (
             select 1 from pgmq.q_ingest q
             where q.message ->> 'type' = 'fetch_detail' and q.message ->> 'processId' = p.id::text
           )`,
        [SOURCE, processKey],
    );
}

async function removeExpiredRawPages(pool: Pool) {
    const { rows } = await pool.query<{ id: string; storage_path: string }>(
        `select id, storage_path from public.source_pages
         where storage_path is not null and fetched_at < now() - $1::interval
         limit 1000`,
        [RAW_PAGE_RETENTION],
    );
    if (rows.length === 0) return;

    const { error } = await storage.from(RAW_PAGE_BUCKET).remove(rows.map((row) => row.storage_path));
    if (error) {
        log("warn", "Could not remove expired raw pages", { error: error.message });
        return;
    }
    await pool.query("update public.source_pages set storage_path = null where id = any($1::bigint[])", [rows.map((row) => row.id)]);
}
