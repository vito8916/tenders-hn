// Retrieval + Jev arm of the evaluation harness (plan, Phase 3). For each
// labeled profile, evaluates retrieval's top candidates with Jev (the same
// evaluateMatch the evaluate_match job runs) and measures, per threshold,
// how many relevant processes Jev would drop against how many irrelevant
// ones it removes. Evaluations are stored in match_evaluations, so a rerun
// with the same model and questions reuses them instead of calling Jev.
//
//   DATABASE_URL=<production> pnpm --filter worker eval:jev [--top=100] [--concurrency=4]
import { mkdir, writeFile } from "node:fs/promises";
import { Pool } from "pg";
import { modelForRole } from "@/lib/ai/models";
import { env } from "../env";
import { errorMessage } from "../log";
import { evaluateMatch, QUESTIONS_VERSION } from "../matching/evaluate";
import { countDecisions, type JudgedCandidate } from "./classification";
import { embedProfile, loadLabeledSet, loadPopulation, retrieveCandidates } from "./labeled-set";

const numberArgument = (name: string, fallback: number) =>
    Number(process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback);
const top = numberArgument("top", 100);
const concurrency = numberArgument("concurrency", 4);

const IN_SCOPE_THRESHOLDS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7];
const STRENGTH_THRESHOLDS = [0.5, 1, 1.5, 2];

const { profiles, pools, labels } = await loadLabeledSet();
const embedModel = modelForRole("embed");
const pool = new Pool({ connectionString: env.DATABASE_URL, max: concurrency + 1 });
const { populationIds } = await loadPopulation(pool, pools, labels, embedModel);

interface EvaluatedCandidate extends JudgedCandidate {
    profile: string;
    rank: number;
    evaluationId: string | null;
    reused: boolean;
    error: string | null;
}

const evaluated: EvaluatedCandidate[] = [];
const relevantBeyondTop: Record<string, string[]> = {};

for (const profile of profiles) {
    const embedding = await embedProfile(profile, embedModel);
    const candidates = (
        await retrieveCandidates(pool, { terms: profile.terms, model: embedModel, embedding, unspsc: profile.unspsc, populationIds })
    ).slice(0, top);
    const labelById = new Map(labels[profile.key].map((item) => [item.processId, item]));
    const candidateIds = new Set(candidates.map((candidate) => candidate.process_id));
    relevantBeyondTop[profile.key] = labels[profile.key]
        .filter((item) => item.label === "relevant" && !candidateIds.has(item.processId))
        .map((item) => item.expediente);

    const { rows: expedientes } = await pool.query<{ id: string; expediente: string }>(
        "select id, expediente from public.procurement_processes where id = any($1::uuid[])",
        [[...candidateIds]],
    );
    const expedienteById = new Map(expedientes.map((row) => [row.id, row.expediente]));

    let next = 0;
    const evaluateNext = async (): Promise<void> => {
        const index = next++;
        const candidate = candidates[index];
        if (!candidate) return;

        const base = {
            profile: profile.key,
            rank: index + 1,
            expediente: expedienteById.get(candidate.process_id) ?? candidate.process_id,
            label: labelById.get(candidate.process_id)?.label,
            inScope: null,
            strength: null,
            insufficient: null,
        };
        try {
            const result = await evaluateMatch(pool, {
                processId: candidate.process_id,
                profile: { description: profile.description, offerings: profile.terms, exclusions: [] },
                match: { terms: candidate.matched_terms, fields: candidate.matched_fields, unspsc: candidate.matched_unspsc },
                chunkIds: candidate.fragments.map((fragment) => fragment.chunk_id),
            });
            evaluated.push({ ...base, evaluationId: result?.evaluationId ?? null, reused: result?.reused ?? false, error: result ? null : "no detail" });
        } catch (error) {
            evaluated.push({ ...base, evaluationId: null, reused: false, error: errorMessage(error) });
        }
        return evaluateNext();
    };
    await Promise.all(Array.from({ length: concurrency }, evaluateNext));
    console.log(`${profile.key}: evaluated ${candidates.length} candidates`);
}

const evaluationIds = evaluated.flatMap((candidate) => candidate.evaluationId ?? []);
const { rows: answerRows } = await pool.query<{
    id: string;
    in_scope: number;
    strength: number;
    insufficient: number;
    input_tokens: number | null;
    output_tokens: number | null;
    latency_ms: number | null;
    evidence: { fragmentsLeftOut: number; productsLeftOut: number };
}>(
    `select id,
            (answers -> 'in_scope' ->> 'probability')::float8 as in_scope,
            (answers -> 'match_strength' ->> 'score')::float8 as strength,
            (answers -> 'insufficient_evidence' ->> 'probability')::float8 as insufficient,
            input_tokens, output_tokens, latency_ms, evidence
     from public.match_evaluations where id = any($1::uuid[])`,
    [evaluationIds],
);
await pool.end();

const answersById = new Map(answerRows.map((row) => [row.id, row]));
for (const candidate of evaluated) {
    const answers = candidate.evaluationId ? answersById.get(candidate.evaluationId) : undefined;
    if (answers) {
        Object.assign(candidate, { inScope: answers.in_scope, strength: answers.strength, insufficient: answers.insufficient });
    }
}

const relevantTotal = profiles.reduce((sum, profile) => sum + labels[profile.key].filter((item) => item.label === "relevant").length, 0);
const beyondTop = Object.values(relevantBeyondTop).flat().length;
const notRelevantRetrieved = evaluated.filter((candidate) => candidate.label === "not_relevant").length;

const sweepRow = (name: string, keep: (candidate: JudgedCandidate) => boolean) => {
    const counts = countDecisions(evaluated, keep);
    const perProfile = Object.fromEntries(
        profiles.map((profile) => [
            profile.key,
            countDecisions(
                evaluated.filter((candidate) => candidate.profile === profile.key),
                keep,
            ).relevantDropped + relevantBeyondTop[profile.key].length,
        ]),
    );
    return {
        rule: name,
        kept: counts.kept,
        "relevant kept": `${counts.relevantKept}/${relevantTotal}`,
        missed: counts.relevantDropped + beyondTop,
        ...perProfile,
        "not relevant kept": `${counts.notRelevantKept}/${notRelevantRetrieved}`,
        "unsure kept": counts.unsureKept,
        "unlabeled kept": counts.unlabeledKept,
    };
};

console.log(`\nTop ${top} per profile, questions ${QUESTIONS_VERSION}. Missed = dropped by the rule + relevant outside the top ${top}.`);
console.table([
    sweepRow("retrieval only", () => true),
    ...IN_SCOPE_THRESHOLDS.map((threshold) => sweepRow(`in_scope >= ${threshold}`, (c) => (c.inScope ?? 1) >= threshold)),
    ...STRENGTH_THRESHOLDS.map((threshold) => sweepRow(`strength >= ${threshold}`, (c) => (c.strength ?? 3) >= threshold)),
]);

const round = (value: number | null) => (value === null ? null : Math.round(value * 100) / 100);
const inspectionRow = (candidate: EvaluatedCandidate) => ({
    profile: candidate.profile,
    expediente: candidate.expediente,
    rank: candidate.rank,
    in_scope: round(candidate.inScope),
    strength: round(candidate.strength),
    insufficient: round(candidate.insufficient),
});
const byInScope = (a: EvaluatedCandidate, b: EvaluatedCandidate) => (a.inScope ?? 1) - (b.inScope ?? 1);

console.log("\nRelevant candidates Jev is least sure of:");
console.table(evaluated.filter((c) => c.label === "relevant").sort(byInScope).slice(0, 12).map(inspectionRow));
console.log("Not relevant candidates Jev is most sure of:");
console.table(evaluated.filter((c) => c.label === "not_relevant").sort(byInScope).reverse().slice(0, 12).map(inspectionRow));

const latencies = answerRows.flatMap((row) => row.latency_ms ?? []).sort((a, b) => a - b);
const percentile = (p: number) => latencies[Math.min(latencies.length - 1, Math.floor(p * latencies.length))];
const usage = {
    candidates: evaluated.length,
    new: evaluated.filter((c) => c.evaluationId && !c.reused).length,
    reused: evaluated.filter((c) => c.reused).length,
    failed: evaluated.filter((c) => c.error).length,
    inputTokens: answerRows.reduce((sum, row) => sum + (row.input_tokens ?? 0), 0),
    outputTokens: answerRows.reduce((sum, row) => sum + (row.output_tokens ?? 0), 0),
    latencyP50Ms: percentile(0.5),
    latencyP95Ms: percentile(0.95),
    withEvidenceLeftOut: answerRows.filter((row) => row.evidence.fragmentsLeftOut || row.evidence.productsLeftOut).length,
};
console.log("Usage:", usage);
const failures = evaluated.filter((c) => c.error);
if (failures.length) {
    console.table(failures.slice(0, 10).map((c) => ({ profile: c.profile, expediente: c.expediente, error: c.error })));
}

const resultsUrl = new URL("./results/", import.meta.url);
await mkdir(resultsUrl, { recursive: true });
const reportUrl = new URL(`jev-${new Date().toISOString().slice(0, 10)}-${QUESTIONS_VERSION}-top${top}.json`, resultsUrl);
await writeFile(
    reportUrl,
    JSON.stringify(
        {
            ranAt: new Date().toISOString(),
            evaluateModel: modelForRole("evaluate"),
            embedModel,
            questionsVersion: QUESTIONS_VERSION,
            top,
            usage,
            relevantBeyondTop,
            candidates: evaluated.map(({ evaluationId, profile, rank, expediente, label, inScope, strength, insufficient, error }) => ({
                profile,
                rank,
                expediente,
                label: label ?? null,
                inScope,
                strength,
                insufficient,
                evaluationId,
                error,
            })),
        },
        null,
        1,
    ) + "\n",
);
console.log(`Report: ${reportUrl.pathname}`);
