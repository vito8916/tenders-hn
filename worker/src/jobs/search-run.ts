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

// The search's criteria as request_search_run froze them in config_snapshot.
const searchSnapshotSchema = z.object({
    name: z.string(),
    inheritsProfile: z.boolean(),
    description: z.string().nullable(),
    keywords: z.array(z.string()),
    exclusions: z.array(z.string()),
    entities: z.array(z.string()),
    modalities: z.array(z.string()),
    acquisitionTypes: z.array(z.string()),
});
type SearchSnapshot = z.infer<typeof searchSnapshotSchema>;

// Candidates Jev evaluates: the labeled set's top 100 of the extracted profile held 95% of core processes.
const CANDIDATE_CUTOFF = 100;
const EVALUATION_CONCURRENCY = 4;

type StoredProfile = ExtractedProfile & { linesOfBusiness: RetrievalLine[] };

/** What the run matches against: the company profile or the search's own description, plus the search's additions. */
interface MatchingProfile {
    description: string;
    offerings: string[];
    exclusions: string[];
}

/** Where the extracted lines of business are cached: the profile version or the search's current description. */
type ExtractionSource =
    | { kind: "profile"; orgId: string; version: number; text: string; stored: StoredProfile | null; storedVersion: string | null }
    | { kind: "search"; searchId: string; description: string; text: string; stored: StoredProfile | null; storedVersion: string | null };

/**
 * Runs matching for a saved search over the open processes, with the
 * criteria frozen when the run was requested: the company profile version
 * (or the search's own description), extra keywords, exclusions, and filters
 * by institution, modality, and acquisition type. Extracts the lines of
 * business when needed, retrieves candidates, evaluates the top ones with
 * Jev, and stores each with its relevance and reasons. A process whose object
 * matches one of the exclusions is `descartada`. A failed evaluation leaves
 * its candidate `pendiente` and the run `partial`; any other failure marks
 * the run `failed` so a new one can start.
 */
export const searchRun: JobHandler = async (message, { pool }) => {
    const { runId } = searchRunMessageSchema.parse(message);

    const { rows } = await pool.query<{ org_id: string; saved_search_id: string; profile_version: number | null; search: unknown }>(
        `update public.search_runs r
         set status = 'running', started_at = coalesce(r.started_at, now())
         where r.id = $1 and r.status in ('queued', 'running')
         returning r.org_id, r.saved_search_id, r.profile_version, r.config_snapshot -> 'search' as search`,
        [runId],
    );
    const run = rows[0];
    if (!run) {
        log("warn", "Search run is not pending, skipping", { runId });
        return;
    }

    try {
        const search = searchSnapshotSchema.parse(run.search);
        const { matching, extraction } = await loadMatchingProfile(pool, run, search);
        const extracted =
            extraction.stored && extraction.storedVersion === EXTRACTION_VERSION ? extraction.stored : await extractAndStore(pool, run.org_id, extraction);
        const lines: RetrievalLine[] = [
            ...extracted.linesOfBusiness,
            // The search's own keywords are one more query, named after the search.
            ...(search.keywords.length > 0 ? [{ name: search.name, description: "", keywords: search.keywords, unspscClasses: [] }] : []),
        ];

        const { rows: openRows } = await pool.query<{ id: string }>(
            `select id from public.procurement_processes
             where (closes_at is null or closes_at > now())
               and (cardinality($1::text[]) = 0 or buyer_entity = any ($1))
               and (cardinality($2::text[]) = 0 or modality = any ($2))
               and (cardinality($3::text[]) = 0 or acquisition_type = any ($3))`,
            [search.entities, search.modalities, search.acquisitionTypes],
        );
        const filtered = search.entities.length > 0 || search.modalities.length > 0 || search.acquisitionTypes.length > 0;

        const embedModel = modelForRole("embed");
        const candidates =
            filtered && openRows.length === 0
                ? []
                : (
                      await retrieveForLines(pool, {
                          lines,
                          model: embedModel,
                          processIds: filtered ? openRows.map((row) => row.id) : null,
                      })
                  ).slice(0, CANDIDATE_CUTOFF);
        const evaluated = await evaluateAll(pool, matching, candidates);
        const { rows: exclusionRows } = await pool.query<{ process_id: string; matched_exclusions: string[] }>(
            "select process_id, matched_exclusions from public.match_exclusions($1::uuid[], $2::text[])",
            [candidates.map((candidate) => candidate.process_id), matching.exclusions],
        );
        const matchedExclusions = new Map(exclusionRows.map((row) => [row.process_id, row.matched_exclusions]));

        const failedEvaluations = evaluated.filter((item) => item.inScope === null).length;
        const client = await pool.connect();
        try {
            await client.query("begin");
            // A redelivered message starts over; evaluations are reused, so this is cheap.
            await client.query("delete from public.search_run_matches where run_id = $1", [runId]);
            await client.query(
                `insert into public.search_run_matches
                   (run_id, org_id, process_id, process_version_id, retrieval_rank, relevance, in_scope, reasons, evaluation_id,
                    expediente, title, buyer_entity, modality, stage, closes_at, detail_url,
                    acquisition_type, starts_at, detected_at, documents_count)
                 select $1, $2, p.id, p.current_version_id, m.retrieval_rank, m.relevance, m.in_scope, m.reasons, m.evaluation_id,
                        p.expediente, p.title, p.buyer_entity, p.modality, p.stage, p.closes_at, p.detail_url,
                        p.acquisition_type, p.source_start_at, p.first_seen_at,
                        (select count(*) from public.source_documents d where d.process_id = p.id and d.removed_at is null)
                 from jsonb_to_recordset($3::jsonb) as m
                   (process_id uuid, retrieval_rank integer, relevance text, in_scope double precision, reasons jsonb, evaluation_id uuid)
                 join public.procurement_processes p on p.id = m.process_id`,
                [
                    runId,
                    run.org_id,
                    JSON.stringify(
                        evaluated.map((item, index) => {
                            const exclusions = matchedExclusions.get(item.candidate.process_id) ?? [];
                            return {
                                process_id: item.candidate.process_id,
                                retrieval_rank: index + 1,
                                relevance: composeRelevance(item.inScope, { excluded: exclusions.length > 0 }),
                                in_scope: item.inScope,
                                reasons: buildReasons(item.candidate, exclusions),
                                evaluation_id: item.evaluationId,
                            };
                        }),
                    ),
                ],
            );
            // nueva / actualizada / conocida against the search's earlier runs, and the run's count of new matches.
            await client.query("select private.set_match_states($1)", [runId]);
            await client.query(
                `update public.search_runs
                 set status = $2, candidates = $3, processes_examined = $6,
                     matches_count = (select count(*) from public.search_run_matches
                                      where run_id = $1 and relevance in ('muy_relevante', 'posible')),
                     coverage = $4, config_snapshot = config_snapshot || $5::jsonb, completed_at = now(), error = null
                 where id = $1`,
                [
                    runId,
                    failedEvaluations > 0 ? "partial" : "completed",
                    candidates.length,
                    { failedEvaluations },
                    {
                        profile: extracted,
                        candidateCutoff: CANDIDATE_CUTOFF,
                        models: { embed: embedModel, evaluate: modelForRole("evaluate") },
                        questionsVersion: QUESTIONS_VERSION,
                    },
                    openRows.length,
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

async function loadMatchingProfile(
    pool: Pool,
    run: { org_id: string; saved_search_id: string; profile_version: number | null },
    search: SearchSnapshot,
): Promise<{ matching: MatchingProfile; extraction: ExtractionSource }> {
    if (!search.inheritsProfile) {
        const description = search.description ?? "";
        const { rows } = await pool.query<{ extracted_profile: StoredProfile | null; extraction_version: string | null }>(
            // The stored extraction belongs to the search's current description; a run for an older one extracts its own.
            "select extracted_profile, extraction_version from public.saved_searches where id = $1 and description = $2",
            [run.saved_search_id, description],
        );
        return {
            matching: { description, offerings: search.keywords, exclusions: search.exclusions },
            extraction: {
                kind: "search",
                searchId: run.saved_search_id,
                description,
                text: description,
                stored: rows[0]?.extracted_profile ?? null,
                storedVersion: rows[0]?.extraction_version ?? null,
            },
        };
    }

    const { rows } = await pool.query<{
        version: number;
        description: string;
        offerings: string[];
        exclusions: string[];
        extracted_profile: StoredProfile | null;
        extraction_version: string | null;
    }>(
        `select v.version, v.description, v.offerings, v.exclusions,
                -- The stored extraction belongs to the current version; a run for an older one extracts its own.
                case when p.version = v.version then p.extracted_profile end as extracted_profile, p.extraction_version
         from public.company_profile_versions v
         join public.company_profiles p on p.org_id = v.org_id
         where v.org_id = $1 and v.version = $2`,
        [run.org_id, run.profile_version],
    );
    const profile = rows[0];
    if (!profile) {
        throw new Error(`Profile version ${run.profile_version} of organization ${run.org_id} not found`);
    }
    return {
        matching: {
            description: profile.description,
            offerings: [...profile.offerings, ...search.keywords],
            exclusions: [...profile.exclusions, ...search.exclusions],
        },
        extraction: {
            kind: "profile",
            orgId: run.org_id,
            version: profile.version,
            // The offerings are the customer's own words for what it sells; the extraction reads them as part of the text.
            text:
                profile.offerings.length > 0
                    ? `${profile.description}\n\nEjemplos concretos de lo que ofrece:\n${profile.offerings.map((offering) => `- ${offering}`).join("\n")}`
                    : profile.description,
            stored: profile.extracted_profile,
            storedVersion: profile.extraction_version,
        },
    };
}

async function extractAndStore(pool: Pool, orgId: string, source: ExtractionSource): Promise<StoredProfile> {
    const result = await extractProfile(source.text);
    await pool.query(
        `insert into public.ai_usage_events (org_id, role, model, input_tokens, output_tokens, latency_ms, status, reference)
         values ($1, 'extract', $2, $3, $4, $5, 'succeeded', $6)`,
        [
            orgId,
            result.model,
            result.inputTokens ?? null,
            result.outputTokens ?? null,
            result.latencyMs,
            source.kind === "profile" ? { type: "company_profile", orgId } : { type: "saved_search", searchId: source.searchId },
        ],
    );

    const lines = [];
    for (const line of result.profile.linesOfBusiness) {
        const { proposed } = await deriveClasses(pool, line);
        lines.push({ ...line, unspscClasses: proposed });
    }
    const profile = { ...result.profile, linesOfBusiness: lines };

    if (source.kind === "profile") {
        await pool.query(
            "update public.company_profiles set extracted_profile = $2, extraction_version = $3 where org_id = $1 and version = $4",
            [source.orgId, profile, EXTRACTION_VERSION, source.version],
        );
    } else {
        await pool.query(
            "update public.saved_searches set extracted_profile = $2, extraction_version = $3 where id = $1 and description = $4",
            [source.searchId, profile, EXTRACTION_VERSION, source.description],
        );
    }
    return profile;
}

async function evaluateAll(pool: Pool, matching: MatchingProfile, candidates: Candidate[]) {
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
                // Without offerings or exclusions this is the state the labeled-set thresholds were read with.
                profile: matching,
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
