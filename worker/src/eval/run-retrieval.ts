// Retrieval-only arm of the evaluation harness (plan, Phase 3). Runs
// retrieve_candidates for each labeled profile, restricted to the processes
// that were open when the labeled set was drawn, and scores the ranking
// against the labels. Besides the full retrieval it runs each signal alone
// (terms, semantic, UNSPSC codes) to show what each one contributes.
//
// The labeled set comes from production, so run it against production:
//   DATABASE_URL=<production> pnpm --filter worker eval:retrieval [--arms=full,terms]
// AI_MODEL_EMBED selects the embedding model; its chunks must already exist.
import { mkdir, writeFile } from "node:fs/promises";
import { Pool } from "pg";
import { modelForRole } from "@/lib/ai/models";
import { env } from "../env";
import { embedProfile, loadLabeledSet, loadPopulation, retrieveCandidates } from "./labeled-set";
import { scoreRetrieval, type RetrievalScore } from "./retrieval";

const ARMS = {
    full: { terms: true, semantic: true, codes: true },
    terms: { terms: true, semantic: false, codes: false },
    semantic: { terms: false, semantic: true, codes: false },
    codes: { terms: false, semantic: false, codes: true },
} as const;

type Arm = keyof typeof ARMS;

const armsArgument = process.argv.find((arg) => arg.startsWith("--arms="))?.slice("--arms=".length);
const arms = (armsArgument?.split(",") ?? Object.keys(ARMS)) as Arm[];
const unknownArm = arms.find((arm) => !(arm in ARMS));
if (unknownArm) {
    console.error(`Unknown arm "${unknownArm}". Arms: ${Object.keys(ARMS).join(", ")}`);
    process.exit(1);
}

const { profiles, pools, labels } = await loadLabeledSet("v1");
const model = modelForRole("embed");
const pool = new Pool({ connectionString: env.DATABASE_URL, max: 1 });
const { populationIds, coverage } = await loadPopulation(pool, pools, labels, model);

const results: { arm: Arm; profile: string; latencyMs: number; score: RetrievalScore }[] = [];

for (const profile of profiles) {
    const embedding = await embedProfile(profile, model);
    const profilePool = pools.profiles[profile.key];

    for (const arm of arms) {
        const signals = ARMS[arm];
        const startedAt = performance.now();
        const candidates = await retrieveCandidates(pool, {
            terms: signals.terms ? profile.offerings : [],
            model,
            embedding: signals.semantic ? embedding : null,
            unspsc: signals.codes ? profile.unspsc : [],
            populationIds,
        });

        results.push({
            arm,
            profile: profile.key,
            latencyMs: Math.round(performance.now() - startedAt),
            score: scoreRetrieval({
                ranked: candidates.map((candidate) => candidate.process_id),
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
