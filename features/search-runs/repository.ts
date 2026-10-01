import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";
import { searchRunMatchSchema, searchRunSchema, type SearchRun, type SearchRunMatch } from "./schemas";

const SEARCH_RUN_COLUMNS =
    "id, saved_search_id, trigger, status, processes_examined, candidates, matches_count, new_matches_count, coverage, source_synced_at, error, created_at, completed_at";

type SearchRunRow = Pick<
    Tables<"search_runs">,
    | "id"
    | "saved_search_id"
    | "trigger"
    | "status"
    | "processes_examined"
    | "candidates"
    | "matches_count"
    | "new_matches_count"
    | "coverage"
    | "source_synced_at"
    | "error"
    | "created_at"
    | "completed_at"
>;

// ========== MAPPERS ==========

function mapSearchRunRow(row: SearchRunRow): SearchRun {
    const coverage = row.coverage as { failedEvaluations?: number } | null;
    return searchRunSchema.parse({
        id: row.id,
        savedSearchId: row.saved_search_id,
        trigger: row.trigger,
        status: row.status,
        processesExamined: row.processes_examined,
        candidates: row.candidates,
        matchesCount: row.matches_count,
        newMatchesCount: row.new_matches_count,
        failedEvaluations: coverage?.failedEvaluations ?? 0,
        sourceSyncedAt: row.source_synced_at,
        error: row.error,
        createdAt: row.created_at,
        completedAt: row.completed_at,
    });
}

// ========== QUERIES ==========

/** The most recent run of each of the organization's searches that has one. */
export async function listLatestRuns(orgId: string): Promise<SearchRun[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("saved_searches")
        .select(`search_runs (${SEARCH_RUN_COLUMNS})`)
        .eq("org_id", orgId)
        .order("created_at", { referencedTable: "search_runs", ascending: false })
        .limit(1, { referencedTable: "search_runs" });

    if (error) throw error;
    return data.flatMap((search) => search.search_runs.map(mapSearchRunRow));
}

/** The latest finished run of each of the organization's searches that has one: its new matches feed the Home's indicator. */
export async function listLatestFinishedRuns(orgId: string): Promise<SearchRun[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("saved_searches")
        .select(`search_runs (${SEARCH_RUN_COLUMNS})`)
        .eq("org_id", orgId)
        .in("search_runs.status", ["completed", "partial"])
        .order("created_at", { referencedTable: "search_runs", ascending: false })
        .limit(1, { referencedTable: "search_runs" });

    if (error) throw error;
    return data.flatMap((search) => search.search_runs.map(mapSearchRunRow));
}

/** The search's most recent runs, newest first. */
export async function listRecentRuns(searchId: string, limit: number): Promise<SearchRun[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("search_runs")
        .select(SEARCH_RUN_COLUMNS)
        .eq("saved_search_id", searchId)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error) throw error;
    return data.map(mapSearchRunRow);
}

/** A run of the search, or null when the id belongs to another search (a hand-edited URL). */
export async function getSearchRun(searchId: string, runId: string): Promise<SearchRun | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("search_runs")
        .select(SEARCH_RUN_COLUMNS)
        .eq("saved_search_id", searchId)
        .eq("id", runId)
        .maybeSingle();

    if (error) throw error;
    return data ? mapSearchRunRow(data) : null;
}

/**
 * The search's latest run, and its latest finished one (completed or
 * partial), which is the one whose results are shown: a run in progress
 * never replaces finished results (spec §12.1).
 */
export async function getLatestRuns(searchId: string): Promise<{ latest: SearchRun | null; finished: SearchRun | null }> {
    const supabase = await createClient();
    const [latest, finished] = await Promise.all([
        supabase.from("search_runs").select(SEARCH_RUN_COLUMNS).eq("saved_search_id", searchId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase
            .from("search_runs")
            .select(SEARCH_RUN_COLUMNS)
            .eq("saved_search_id", searchId)
            .in("status", ["completed", "partial"])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
    ]);

    if (latest.error) throw latest.error;
    if (finished.error) throw finished.error;
    return {
        latest: latest.data ? mapSearchRunRow(latest.data) : null,
        finished: finished.data ? mapSearchRunRow(finished.data) : null,
    };
}

/** When the latest complete ingestion finished: what «Ejecutar ahora» would use. */
export async function getLatestIngestionAt(): Promise<string | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("source_sync_runs")
        .select("finished_at")
        .eq("status", "succeeded")
        .order("finished_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw error;
    return data?.finished_at ?? null;
}

export async function listSearchRunMatches(runId: string): Promise<SearchRunMatch[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("search_run_matches")
        .select("process_id, retrieval_rank, relevance, match_state, reasons, expediente, title, buyer_entity, modality, stage, closes_at, detail_url, acquisition_type, starts_at, detected_at, documents_count")
        .eq("run_id", runId)
        // Within each relevance level, the ones closing soonest first (plan, Phase 3).
        .order("closes_at", { ascending: true, nullsFirst: false })
        .order("retrieval_rank");

    if (error) throw error;

    return data.map((row) =>
        searchRunMatchSchema.parse({
            processId: row.process_id,
            retrievalRank: row.retrieval_rank,
            relevance: row.relevance,
            matchState: row.match_state,
            reasons: row.reasons,
            expediente: row.expediente,
            title: row.title,
            buyerEntity: row.buyer_entity,
            modality: row.modality,
            stage: row.stage,
            closesAt: row.closes_at,
            detailUrl: row.detail_url,
            acquisitionType: row.acquisition_type,
            startsAt: row.starts_at,
            detectedAt: row.detected_at,
            documentsCount: row.documents_count,
        }),
    );
}

// ========== MUTATIONS ==========

/** Queues a run of the search; raises search_not_found, search_inactive, subscription_inactive, no_profile, or run_in_progress. */
export async function requestSearchRun(searchId: string): Promise<string> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("request_search_run", { target_search: searchId });

    if (error) throw error;
    return data;
}
