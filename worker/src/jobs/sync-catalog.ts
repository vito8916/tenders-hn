import type { Pool } from "pg";
import { z } from "zod";
import { parseCatalogPage, type CatalogOption } from "../honducompras/catalog";
import { fetchCatalogPage, selectCatalogOption } from "../honducompras/client";
import { log } from "../log";
import type { JobHandler } from "../queue";

// Segments, families, and classes of CUBS, the catalog HonduCompras codes
// product lines with. Products (18,000+) are left out: the product lines we
// store already carry their product code and name. Runs on the `ingest`
// queue, one job per segment, so the portal sees one request at a time and
// syncs interleave with the walk.

async function upsertCatalog(pool: Pool, level: 1 | 2 | 3, parentCode: string | null, options: CatalogOption[]) {
    if (!options.length) return;
    await pool.query(
        `insert into public.unspsc_catalog (code, level, name, parent_code)
         select parent || option.value, $2, option.name, nullif(parent, '')
         from jsonb_to_recordset($3::jsonb) as option (value text, name text), coalesce($1::text, '') as parent
         on conflict (code) do update
         set name = excluded.name, level = excluded.level, parent_code = excluded.parent_code, last_seen_at = now()`,
        [parentCode, level, JSON.stringify(options)],
    );
}

/** Lists the segments and queues one sync_catalog_segment job for each. */
export const syncCatalog: JobHandler = async (_message, { pool }) => {
    const page = parseCatalogPage(await fetchCatalogPage());
    await upsertCatalog(pool, 1, null, page.segments);
    await pool.query(
        `select pgmq.send('ingest', jsonb_build_object('type', 'sync_catalog_segment', 'segment', segment))
         from unnest($1::text[]) as segment`,
        [page.segments.map((segment) => segment.value)],
    );
    log("info", "Catalog sync queued", { segments: page.segments.length });
};

const segmentMessageSchema = z.object({ segment: z.string().regex(/^\d{2}$/) });

/** Stores one segment's families and each family's classes. */
export const syncCatalogSegment: JobHandler = async (message, { pool }) => {
    const { segment } = segmentMessageSchema.parse(message);

    let page = parseCatalogPage(await selectCatalogOption(parseCatalogPage(await fetchCatalogPage()), "segment", segment));
    if (page.selected.segment !== segment) {
        throw new Error(`The catalog did not select segment ${segment}`);
    }
    const families = page.families;
    await upsertCatalog(pool, 2, segment, families);

    for (const family of families) {
        // Selecting a segment already shows its first family's classes.
        if (page.selected.family !== family.value) {
            page = parseCatalogPage(await selectCatalogOption(page, "family", family.value));
            if (page.selected.family !== family.value) {
                throw new Error(`The catalog did not select family ${segment}${family.value}`);
            }
        }
        await upsertCatalog(pool, 3, segment + family.value, page.classes);
    }

    log("info", "Catalog segment synced", { segment, families: families.length });
};
