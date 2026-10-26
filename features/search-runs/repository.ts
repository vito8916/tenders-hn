import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database, Tables } from "@/types/database.types";
import { searchRunMatchSchema, searchRunSchema, type SearchRun, type SearchRunMatch } from "./schemas";

const SEARCH_RUN_COLUMNS =
    "id, saved_search_id, trigger, status, processes_examined, candidates, matches_count, new_matches_count, coverage, source_synced_at, report_path, excel_path, error, created_at, completed_at";

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
    | "report_path"
    | "excel_path"
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
        reportPath: row.report_path,
        excelPath: row.excel_path,
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

/** One page of the organization's runs, newest first (RLS keeps them within the plan's history). */
export async function listRunsPage(orgId: string, page: number, pageSize: number): Promise<{ runs: SearchRun[]; total: number }> {
    const supabase = await createClient();
    const { data, count, error } = await supabase
        .from("search_runs")
        .select(SEARCH_RUN_COLUMNS, { count: "exact" })
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) throw error;
    return { runs: data.map(mapSearchRunRow), total: count ?? 0 };
}

/** Months of runs the organization's plan keeps; null for all of them. */
export async function getHistoryMonths(orgId: string): Promise<number | null> {
    const supabase = await createClient();
    const { data, error } = await supabase.from("organization_subscriptions").select("plans (history_months)").eq("org_id", orgId).maybeSingle();

    if (error) throw error;
    const plan = Array.isArray(data?.plans) ? data.plans[0] : data?.plans;
    return plan?.history_months ?? null;
}

/** A run of the organization with its search's name, or null (another organization's run or a hand-edited URL). */
export async function getOrgRun(orgId: string, runId: string): Promise<{ run: SearchRun; searchName: string } | null> {
    const supabase = await createClient();
    const { data, error } = await supabase.from("search_runs").select(SEARCH_RUN_COLUMNS).eq("org_id", orgId).eq("id", runId).maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const { data: search, error: searchError } = await supabase.from("saved_searches").select("name").eq("id", data.saved_search_id).single();
    if (searchError) throw searchError;
    return { run: mapSearchRunRow(data), searchName: search.name };
}

/** When the latest complete ingestion finished: what «Actualizar ahora» would use. */
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

const MATCH_COLUMNS =
    "run_id, process_id, process_version_id, retrieval_rank, relevance, match_state, reasons, expediente, title, buyer_entity, modality, stage, closes_at, detail_url, acquisition_type, starts_at, detected_at, documents_count, procurement_processes (closes_at)";

/** A run's match with the process's deadline today, which an extension may have moved since the run. */
export type MatchWithCurrentDeadline = SearchRunMatch & { currentClosesAt: string | null };

/** The matches of each run, keyed by run id, in one query. */
export async function listMatchesForRuns(runIds: string[]): Promise<Map<string, MatchWithCurrentDeadline[]>> {
    const byRun = new Map<string, MatchWithCurrentDeadline[]>(runIds.map((runId) => [runId, []]));
    if (runIds.length === 0) return byRun;

    const supabase = await createClient();
    const { data, error } = await supabase
        .from("search_run_matches")
        .select(MATCH_COLUMNS)
        .in("run_id", runIds)
        // Within each relevance level, the ones closing soonest first (plan, Phase 3).
        .order("closes_at", { ascending: true, nullsFirst: false })
        .order("retrieval_rank");

    if (error) throw error;

    for (const row of data) {
        byRun.get(row.run_id)?.push({
            ...searchRunMatchSchema.parse({
                processId: row.process_id,
                processVersionId: row.process_version_id,
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
            currentClosesAt: (Array.isArray(row.procurement_processes) ? row.procurement_processes[0] : row.procurement_processes)?.closes_at ?? null,
        });
    }
    return byRun;
}

/**
 * The latest finished run's match for each of these processes among the organization's runs, with the run
 * and its search: «En seguimiento» keeps a process the latest runs no longer find.
 */
export async function listLatestProcessMatches(orgId: string, processIds: string[]) {
    if (processIds.length === 0) return [];

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("latest_process_matches", { target_org: orgId, target_processes: processIds });
    if (error) throw error;

    type Row = Database["public"]["Functions"]["latest_process_matches"]["Returns"][number];
    const latest = (data ?? []) as Row[];

    const byRun = await listMatchesForRuns([...new Set(latest.map((row) => row.run_id))]);
    return latest.flatMap((row) => {
        const match = byRun.get(row.run_id)?.find((candidate) => candidate.processId === row.process_id);
        return match ? [{ ...match, runId: row.run_id, searchId: row.saved_search_id }] : [];
    });
}

export async function listSearchRunMatches(runId: string): Promise<MatchWithCurrentDeadline[]> {
    return (await listMatchesForRuns([runId])).get(runId) ?? [];
}

/** A short-lived link to a run's PDF or Excel file, signed with the user's session so the bucket's policy applies. */
export async function createReportUrl(path: string, fileName: string): Promise<string> {
    const supabase = await createClient();
    const { data, error } = await supabase.storage.from("reports").createSignedUrl(path, 60, { download: fileName });

    if (error) throw error;
    return data.signedUrl;
}

// ========== MUTATIONS ==========

/** Queues a run of the search; raises search_not_found, search_inactive, subscription_inactive, no_profile, or run_in_progress. */
export async function requestSearchRun(searchId: string): Promise<string> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("request_search_run", { target_search: searchId });

    if (error) throw error;
    return data;
}
