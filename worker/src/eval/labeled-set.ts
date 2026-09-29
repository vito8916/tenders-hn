// Loads the labeled set and rebuilds the population it was drawn from, for
// the harness arms. The labels come from production, so the arms run there.
import { readFile } from "node:fs/promises";
import { embed } from "ai";
import type { Pool } from "pg";
import { EMBEDDING_DIMENSIONS } from "@/lib/ai/models";
import type { LabeledProcess, PoolItem } from "./retrieval";

export interface Profile {
    key: string;
    name: string;
    description: string;
    // Concrete examples of what the company offers; retrieval searches for them as terms.
    offerings: string[];
    unspsc: string[];
}

// Labeled sets live in labeled-set/<version>/. v1 (29 Sep 2026): narrow
// profiles, relevant / not relevant. v2: corporate-purpose profiles labeled
// core / adjacent / not relevant.
export type LabeledSetVersion = "v1" | "v2";

export interface Pools {
    generatedAt: string;
    profiles: Record<string, { population: number; notRetrieved: number; sampleWeight: number; items: PoolItem[] }>;
}

export interface Candidate {
    process_id: string;
    matched_terms: string[];
    matched_fields: string[];
    matched_unspsc: string[];
    fragments: { chunk_id: number }[];
}

export const labeledSetUrl = (version: LabeledSetVersion) => new URL(`./labeled-set/${version}/`, import.meta.url);
const readJson = async <T>(version: LabeledSetVersion, file: string): Promise<T> =>
    JSON.parse(await readFile(new URL(file, labeledSetUrl(version)), "utf8"));

// v1 profiles named their offerings `terms`.
export const loadProfiles = async (version: LabeledSetVersion) =>
    (await readJson<(Profile & { terms?: string[] })[]>(version, "profiles.json")).map(({ terms, ...profile }) => ({
        ...profile,
        offerings: profile.offerings ?? terms ?? [],
    }));

export async function loadLabeledSet(version: LabeledSetVersion) {
    const [profiles, pools, { profiles: labels }] = await Promise.all([
        loadProfiles(version),
        readJson<Pools>(version, "pools.json"),
        readJson<{ profiles: Record<string, LabeledProcess[]> }>(version, "labels.json"),
    ]);
    return { profiles, pools, labels };
}

/**
 * The processes open when the labeled set was drawn, plus every labeled
 * process (a closing date moved earlier must not drop a label).
 * Exits when the database does not hold the labeled processes or has no
 * embeddings for `model`.
 */
export async function loadPopulation(pool: Pool, pools: Pools, labels: Record<string, LabeledProcess[]>, model: string) {
    const labeledIds = [...new Set(Object.values(labels).flatMap((items) => items.map((item) => item.processId)))];
    const { rows } = await pool.query<{ id: string }>(
        `select id from public.procurement_processes
         where (first_seen_at <= $1 and (closes_at is null or closes_at > $1)) or id = any($2::uuid[])`,
        [pools.generatedAt, labeledIds],
    );
    const populationIds = rows.map((row) => row.id);

    const { rows: coverageRows } = await pool.query<{ embedded_processes: number; chunks: number }>(
        `select
           (select count(*)::int from public.procurement_processes where id = any($1::uuid[]) and object_embedding_model = $2) as embedded_processes,
           (select count(*)::int from public.document_chunks c
              join public.source_documents d on d.current_version_id = c.document_version_id
              where d.process_id = any($1::uuid[]) and c.embedding_model = $2) as chunks`,
        [populationIds, model],
    );
    const coverage = coverageRows[0];

    console.log(
        `Population: ${populationIds.length} processes (${pools.profiles[Object.keys(pools.profiles)[0]].population} when labeled). ` +
            `Model ${model}: ${coverage.embedded_processes} process objects and ${coverage.chunks} chunks embedded.`,
    );
    const populationIdSet = new Set(populationIds);
    if (labeledIds.some((id) => !populationIdSet.has(id)) || coverage.embedded_processes === 0) {
        console.error("This database does not hold the labeled population. Point DATABASE_URL at production.");
        process.exit(1);
    }

    return { populationIds, coverage };
}

export async function embedProfile(profile: Profile, model: string) {
    const { embedding } = await embed({
        model,
        value: profile.description,
        providerOptions: { voyage: { inputType: "query", outputDimension: EMBEDDING_DIMENSIONS } },
    });
    return embedding;
}

/** retrieve_candidates within the population, best first. Empty inputs switch a signal off. */
export async function retrieveCandidates(
    pool: Pool,
    { terms, model, embedding, unspsc, populationIds }: { terms: string[]; model: string; embedding: number[] | null; unspsc: string[]; populationIds: string[] },
) {
    const { rows } = await pool.query<Candidate>(
        `select process_id, matched_terms, matched_fields, matched_unspsc, fragments
         from public.retrieve_candidates(
           search_terms => $1, model => $2, query_embedding => $3::extensions.halfvec,
           unspsc_prefixes => $4, open_only => false, process_ids => $5::uuid[]
         )`,
        [terms, model, embedding && JSON.stringify(embedding), unspsc, populationIds],
    );
    return rows;
}
