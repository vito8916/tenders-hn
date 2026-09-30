// Retrieval-only arm of the evaluation harness (plan, Phase 3). Runs
// retrieve_candidates for each labeled profile, restricted to the processes
// that were open when the labeled set was drawn, and scores the ranking
// against the labels.
//   v1  the profile as one query, with all signals and with each signal alone
//       (terms, semantic, UNSPSC codes) to show what each one contributes
//   v2  the three methods the pools were built from (whole text, paragraphs,
//       extracted profile), and the extracted profile with each signal alone
//
// The labeled set comes from production, so run it against production:
//   DATABASE_URL=<production> pnpm --filter worker eval:retrieval [--set=v2] [--view=relevant] [--arms=whole,profile]
// --view picks the labels the table shows (labeled-set.ts: relevant, core,
// blind); the report scores every view. The query embeddings cost a fraction
// of a cent on the AI Gateway. AI_MODEL_EMBED selects the embedding model; its
// chunks must already exist.
import { mkdir, writeFile } from "node:fs/promises";
import { Pool } from "pg";
import { modelForRole } from "@/lib/ai/models";
import { env } from "../env";
import {
    ALL_SIGNALS,
    LABEL_VIEWS,
    loadExtractedLines,
    loadLabeledSet,
    loadPopulation,
    retrieveByMethod,
    type LabeledSetVersion,
    type LabelView,
    type RetrievalMethod,
    type Signals,
} from "./labeled-set";
import { scoreRetrieval, type RetrievalScore } from "./retrieval";

const only = (signal: keyof Signals): Signals => ({ terms: false, semantic: false, codes: false, [signal]: true });
const ARMS: Record<LabeledSetVersion, Record<string, { method: RetrievalMethod; signals: Signals }>> = {
    v1: {
        full: { method: "whole", signals: ALL_SIGNALS },
        terms: { method: "whole", signals: only("terms") },
        semantic: { method: "whole", signals: only("semantic") },
        codes: { method: "whole", signals: only("codes") },
    },
    v2: {
        whole: { method: "whole", signals: ALL_SIGNALS },
        paragraphs: { method: "paragraphs", signals: ALL_SIGNALS },
        profile: { method: "profile", signals: ALL_SIGNALS },
        "profile-terms": { method: "profile", signals: only("terms") },
        "profile-semantic": { method: "profile", signals: only("semantic") },
        "profile-codes": { method: "profile", signals: only("codes") },
    },
};

const argument = (name: string) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const set = (argument("set") ?? "v2") as LabeledSetVersion;
const view = (argument("view") ?? "relevant") as LabelView;
const setArms = ARMS[set];
const arms = argument("arms")?.split(",") ?? Object.keys(setArms ?? {});
if (!setArms || !LABEL_VIEWS.includes(view) || arms.some((arm) => !(arm in setArms))) {
    console.error(`Sets: v1, v2. Views: ${LABEL_VIEWS.join(", ")}. Arms for ${set}: ${Object.keys(setArms ?? {}).join(", ")}.`);
    process.exit(1);
}

const { profiles, pools, labels } = await loadLabeledSet(set);
const { lines } = await loadExtractedLines(set);
const model = modelForRole("embed");
const pool = new Pool({ connectionString: env.DATABASE_URL, max: 1 });
const { populationIds, coverage } = await loadPopulation(pool, pools, labels.relevant, model);

const results: { arm: string; profile: string; latencyMs: number; scores: Record<LabelView, RetrievalScore> }[] = [];

for (const profile of profiles) {
    const profilePool = pools.profiles[profile.key];

    for (const arm of arms) {
        const startedAt = performance.now();
        const candidates = await retrieveByMethod(pool, { ...setArms[arm], profile, lines: lines[profile.key] ?? [], model, populationIds });
        const ranked = candidates.map((candidate) => candidate.process_id);

        results.push({
            arm,
            profile: profile.key,
            latencyMs: Math.round(performance.now() - startedAt),
            scores: Object.fromEntries(
                LABEL_VIEWS.map((labelView) => [
                    labelView,
                    scoreRetrieval({ ranked, labels: labels[labelView][profile.key], pool: profilePool.items, sampleWeight: profilePool.sampleWeight }),
                ]),
            ) as Record<LabelView, RetrievalScore>,
        });
    }
}

await pool.end();

const foundAt = (score: RetrievalScore, cutoff: number) =>
    `${score.cutoffs.find((item) => item.cutoff === cutoff)?.relevantFound}/${score.relevant}`;

console.log(`\nLabels: ${view} view. @N = relevant found in the top N / relevant labeled.`);
console.table(
    results.map(({ arm, profile, latencyMs, scores }) => {
        const score = scores[view];
        return {
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
            estMissed: score.estimatedMissesBeyondCutoffs,
            ms: latencyMs,
        };
    }),
);

const resultsUrl = new URL("./results/", import.meta.url);
await mkdir(resultsUrl, { recursive: true });
const reportUrl = new URL(`retrieval-${new Date().toISOString().slice(0, 10)}-${set}-${model.replaceAll("/", "_")}.json`, resultsUrl);
await writeFile(
    reportUrl,
    JSON.stringify(
        { ranAt: new Date().toISOString(), set, model, labeledAt: pools.generatedAt, population: populationIds.length, coverage, results },
        null,
        1,
    ) + "\n",
);
console.log(`Report: ${reportUrl.pathname}`);
