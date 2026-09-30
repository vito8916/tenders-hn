import type { Pool } from "pg";
import { z } from "zod";
import { modelForRole } from "@/lib/ai/models";
import { buildReasons } from "@/lib/matching/reasons";
import { composeRelevance } from "@/lib/matching/relevance";
import { errorMessage, log } from "../log";
import { evaluateMatch, QUESTIONS_VERSION } from "../matching/evaluate";
import { EXTRACTION_VERSION, extractProfile, type ExtractedProfile } from "../matching/profile";
import { retrieveForLines, type Candidate, type RetrievalLine } from "../matching/retrieve";
import { deriveClasses } from "../matching/unspsc";
import type { JobHandler } from "../queue";

const searchRunMessageSchema = z.object({ runId: z.uuid() });

// Candidates Jev evaluates: the labeled set's top 100 of the extracted profile held 95% of core processes.
const CANDIDATE_CUTOFF = 100;
const EVALUATION_CONCURRENCY = 4;

type StoredProfile = ExtractedProfile & { linesOfBusiness: RetrievalLine[] };

/**
 * Runs matching for an organization's profile over the open processes:
 * extracts the profile's lines of business when needed, retrieves candidates,
 * evaluates the top ones with Jev, and stores each with its relevance and
 * reasons. A failed evaluation leaves its candidate `pendiente` and the run
 * `partial`; any other failure marks the run `failed` so a new one can start.
 */
export const searchRun: JobHandler = async (message, { pool }) => {
    const { runId } = searchRunMessageSchema.parse(message);

    const { rows } = await pool.query<{
        org_id: string;
        description: string;
        extracted_profile: StoredProfile | null;
        extraction_version: string | null;
    }>(
        `update public.search_runs r
         set status = 'running', started_at = coalesce(r.started_at, now())
         from public.company_profiles p
         where r.id = $1 and p.org_id = r.org_id and r.status in ('queued', 'running')
         returning r.org_id, p.description, p.extracted_profile, p.extraction_version`,
        [runId],
    );
    const run = rows[0];
    if (!run) {
        log("warn", "Search run is not pending, skipping", { runId });
        return;
    }

    try {
        const profile =
            run.extracted_profile && run.extraction_version === EXTRACTION_VERSION
                ? run.extracted_profile
                : await extractAndStore(pool, run.org_id, run.description);

        const embedModel = modelForRole("embed");
        const candidates = (await retrieveForLines(pool, { lines: profile.linesOfBusiness, model: embedModel })).slice(0, CANDIDATE_CUTOFF);
        const evaluated = await evaluateAll(pool, run.description, candidates);

        const failedEvaluations = evaluated.filter((item) => item.inScope === null).length;
        const client = await pool.connect();
        try {
            await client.query("begin");
            // A redelivered message starts over; evaluations are reused, so this is cheap.
            await client.query("delete from public.search_run_matches where run_id = $1", [runId]);
            await client.query(
                `insert into public.search_run_matches
                   (run_id, org_id, process_id, process_version_id, retrieval_rank, relevance, in_scope, reasons, evaluation_id,
                    expediente, title, buyer_entity, modality, stage, closes_at, detail_url)
                 select $1, $2, p.id, p.current_version_id, m.retrieval_rank, m.relevance, m.in_scope, m.reasons, m.evaluation_id,
                        p.expediente, p.title, p.buyer_entity, p.modality, p.stage, p.closes_at, p.detail_url
                 from jsonb_to_recordset($3::jsonb) as m
                   (process_id uuid, retrieval_rank integer, relevance text, in_scope double precision, reasons jsonb, evaluation_id uuid)
                 join public.procurement_processes p on p.id = m.process_id`,
                [
                    runId,
                    run.org_id,
                    JSON.stringify(
                        evaluated.map((item, index) => ({
                            process_id: item.candidate.process_id,
                            retrieval_rank: index + 1,
                            relevance: composeRelevance(item.inScope),
                            in_scope: item.inScope,
                            reasons: buildReasons(item.candidate),
                            evaluation_id: item.evaluationId,
                        })),
                    ),
                ],
            );
            await client.query(
                `update public.search_runs
                 set status = $2, candidates = $3,
                     matches_count = (select count(*) from public.search_run_matches
                                      where run_id = $1 and relevance in ('muy_relevante', 'posible')),
                     coverage = $4, config_snapshot = $5, completed_at = now(), error = null
                 where id = $1`,
                [
                    runId,
                    failedEvaluations > 0 ? "partial" : "completed",
                    candidates.length,
                    { failedEvaluations },
                    {
                        profile,
                        candidateCutoff: CANDIDATE_CUTOFF,
                        models: { embed: embedModel, evaluate: modelForRole("evaluate") },
                        questionsVersion: QUESTIONS_VERSION,
                    },
                ],
            );
            await client.query("commit");
        } catch (error) {
            await client.query("rollback");
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        await pool.query("update public.search_runs set status = 'failed', error = $2, completed_at = now() where id = $1", [
            runId,
            errorMessage(error),
        ]);
        log("error", "Search run failed", { runId, error: errorMessage(error) });
    }
};

async function extractAndStore(pool: Pool, orgId: string, description: string): Promise<StoredProfile> {
    const result = await extractProfile(description);
    await pool.query(
        `insert into public.ai_usage_events (org_id, role, model, input_tokens, output_tokens, latency_ms, status, reference)
         values ($1, 'extract', $2, $3, $4, $5, 'succeeded', $6)`,
        [orgId, result.model, result.inputTokens ?? null, result.outputTokens ?? null, result.latencyMs, { type: "company_profile", orgId }],
    );

    const lines = [];
    for (const line of result.profile.linesOfBusiness) {
        const { proposed } = await deriveClasses(pool, line);
        lines.push({ ...line, unspscClasses: proposed });
    }
    const profile = { ...result.profile, linesOfBusiness: lines };

    await pool.query(
        "update public.company_profiles set extracted_profile = $2, extraction_version = $3 where org_id = $1 and description = $4",
        [orgId, profile, EXTRACTION_VERSION, description],
    );
    return profile;
}

async function evaluateAll(pool: Pool, description: string, candidates: Candidate[]) {
    const evaluated: { candidate: Candidate; inScope: number | null; evaluationId: string | null }[] = candidates.map((candidate) => ({
        candidate,
        inScope: null,
        evaluationId: null,
    }));

    let next = 0;
    const evaluateNext = async (): Promise<void> => {
        const item = evaluated[next++];
        if (!item) return;
        try {
            const result = await evaluateMatch(pool, {
                processId: item.candidate.process_id,
                // The labeled-set thresholds were read with the corporate purpose alone.
                profile: { description, offerings: [], exclusions: [] },
                match: { terms: item.candidate.matched_terms, fields: item.candidate.matched_fields, unspsc: item.candidate.matched_unspsc },
                chunkIds: item.candidate.fragments.map((fragment) => fragment.chunk_id),
            });
            if (result) {
                const { rows } = await pool.query<{ in_scope: number | null }>(
                    "select (answers -> 'in_scope' ->> 'probability')::float8 as in_scope from public.match_evaluations where id = $1",
                    [result.evaluationId],
                );
                item.evaluationId = result.evaluationId;
                item.inScope = rows[0]?.in_scope ?? null;
            }
        } catch (error) {
            log("warn", "Evaluation failed; the candidate stays pending", { processId: item.candidate.process_id, error: errorMessage(error) });
        }
        return evaluateNext();
    };
    await Promise.all(Array.from({ length: EVALUATION_CONCURRENCY }, evaluateNext));
    return evaluated;
}
