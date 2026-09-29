// Retrieval-only arm of the evaluation harness (plan, Phase 3). Runs
// retrieve_candidates for each labeled profile, restricted to the processes
// that were open when the labeled set was drawn, and scores the ranking
// against the labels. Besides the full retrieval it runs each signal alone
// (terms, semantic, UNSPSC codes) to show what each one contributes.
//
// The labeled set comes from production, so run it against production:
//   DATABASE_URL=<production> pnpm --filter worker eval:retrieval [--arms full,terms]
// AI_MODEL_EMBED selects the embedding model; its chunks must already exist.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { embed } from "ai";
import { Pool } from "pg";
import { EMBEDDING_DIMENSIONS, modelForRole } from "@/lib/ai/models";
import { env } from "../env";
import { scoreRetrieval, type LabeledProcess, type PoolItem, type RetrievalScore } from "./retrieval";

interface Profile {
    key: string;
    name: string;
    description: string;
    terms: string[];
    unspsc: string[];
}

interface Pools {
    generatedAt: string;
    profiles: Record<string, { population: number; notRetrieved: number; sampleWeight: number; items: PoolItem[] }>;
}

const ARMS = {
    full: { terms: true, semantic: true, codes: true },
    terms: { terms: true, semantic: false, codes: false },
    semantic: { terms: false, semantic: true, codes: false },
    codes: { terms: false, semantic: false, codes: true },
} as const;

type Arm = keyof typeof ARMS;

const labeledSetUrl = new URL("./labeled-set/", import.meta.url);
const readJson = async <T>(file: string): Promise<T> => JSON.parse(await readFile(new URL(file, labeledSetUrl), "utf8"));

const profiles = await readJson<Profile[]>("profiles.json");
const pools = await readJson<Pools>("pools.json");
const { profiles: labels } = await readJson<{ profiles: Record<string, LabeledProcess[]> }>("labels.json");

const armsArgument = process.argv.find((arg) => arg.startsWith("--arms="))?.slice("--arms=".length);
const arms = (armsArgument?.split(",") ?? Object.keys(ARMS)) as Arm[];
const unknownArm = arms.find((arm) => !(arm in ARMS));
if (unknownArm) {
    console.error(`Unknown arm "${unknownArm}". Arms: ${Object.keys(ARMS).join(", ")}`);
    process.exit(1);
}

const model = modelForRole("embed");
const pool = new Pool({ connectionString: env.DATABASE_URL, max: 1 });

// Labeled processes are always included: a closing date moved earlier after
// the snapshot must not drop a label from the population.
const labeledIds = [...new Set(Object.values(labels).flatMap((items) => items.map((item) => item.processId)))];
const { rows: populationRows } = await pool.query<{ id: string }>(
    `select id from public.procurement_processes
     where (first_seen_at <= $1 and (closes_at is null or closes_at > $1)) or id = any($2::uuid[])`,
    [pools.generatedAt, labeledIds],
);
const populationIds = populationRows.map((row) => row.id);

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
    `Population: ${populationIds.length} processes (${pools.profiles.software.population} when labeled). ` +
        `Model ${model}: ${coverage.embedded_processes} process objects and ${coverage.chunks} chunks embedded.`,
);
const populationIdSet = new Set(populationIds);
if (labeledIds.some((id) => !populationIdSet.has(id)) || coverage.embedded_processes === 0) {
    console.error("This database does not hold the labeled population. Point DATABASE_URL at production.");
    process.exit(1);
}

const results: { arm: Arm; profile: string; latencyMs: number; score: RetrievalScore }[] = [];

for (const profile of profiles) {
    const { embedding } = await embed({
        model,
        value: profile.description,
        providerOptions: { voyage: { inputType: "query", outputDimension: EMBEDDING_DIMENSIONS } },
    });
    const profilePool = pools.profiles[profile.key];

    for (const arm of arms) {
        const signals = ARMS[arm];
        const startedAt = performance.now();
        const { rows } = await pool.query<{ process_id: string }>(
            `select process_id from public.retrieve_candidates(
               search_terms => $1, model => $2, query_embedding => $3::extensions.halfvec,
               unspsc_prefixes => $4, open_only => false, process_ids => $5::uuid[]
             )`,
            [
                signals.terms ? profile.terms : [],
                model,
                signals.semantic ? JSON.stringify(embedding) : null,
                signals.codes ? profile.unspsc : [],
                populationIds,
            ],
        );

        results.push({
            arm,
            profile: profile.key,
            latencyMs: Math.round(performance.now() - startedAt),
            score: scoreRetrieval({
                ranked: rows.map((row) => row.process_id),
                labels: labels[profile.key],
                pool: profilePool.items,
                sampleWeight: profilePool.sampleWeight,
            }),
        });
    }
}

await pool.end();

const foundAt = (score: RetrievalScore, cutoff: number) =>
    `${score.cutoffs.find((item) => item.cutoff === cutoff)?.relevantFound}/${score.relevant}`;

console.table(
    results.map(({ arm, profile, latencyMs, score }) => ({
        arm,
        profile,
        returned: score.returned,
        "@10": foundAt(score, 10),
        "@25": foundAt(score, 25),
        "@50": foundAt(score, 50),
        "@100": foundAt(score, 100),
        "@150": foundAt(score, 150),
        "P@25": score.cutoffs.find((item) => item.cutoff === 25)?.precision?.toFixed(2),
        lastRelevant: score.lastRelevantRank ?? `missing ${score.relevantNotReturned.length}`,
        unlabeledAbove: score.unlabeledAboveLastRelevant,
        ms: latencyMs,
    })),
);

const resultsUrl = new URL("./results/", import.meta.url);
await mkdir(resultsUrl, { recursive: true });
const reportUrl = new URL(`retrieval-${new Date().toISOString().slice(0, 10)}-${model.replaceAll("/", "_")}.json`, resultsUrl);
await writeFile(
    reportUrl,
    JSON.stringify(
        { ranAt: new Date().toISOString(), model, labeledAt: pools.generatedAt, population: populationIds.length, coverage, results },
        null,
        1,
    ) + "\n",
);
console.log(`Report: ${reportUrl.pathname}`);
