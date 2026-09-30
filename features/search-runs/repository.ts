import "server-only";
import { createClient } from "@/lib/supabase/server";
import { searchRunMatchSchema, searchRunSchema, type SearchRun, type SearchRunMatch } from "./schemas";

// ========== QUERIES ==========

export async function getLatestSearchRun(orgId: string): Promise<SearchRun | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("search_runs")
        .select("id, status, profile_version, candidates, matches_count, coverage, error, created_at, completed_at")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const coverage = data.coverage as { failedEvaluations?: number } | null;
    return searchRunSchema.parse({
        id: data.id,
        status: data.status,
        profileVersion: data.profile_version,
        candidates: data.candidates,
        matchesCount: data.matches_count,
        failedEvaluations: coverage?.failedEvaluations ?? 0,
        error: data.error,
        createdAt: data.created_at,
        completedAt: data.completed_at,
    });
}

export async function listSearchRunMatches(runId: string): Promise<SearchRunMatch[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("search_run_matches")
        .select("process_id, retrieval_rank, relevance, in_scope, reasons, expediente, title, buyer_entity, modality, stage, closes_at, detail_url")
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
            inScope: row.in_scope,
            reasons: row.reasons,
            expediente: row.expediente,
            title: row.title,
            buyerEntity: row.buyer_entity,
            modality: row.modality,
            stage: row.stage,
            closesAt: row.closes_at,
            detailUrl: row.detail_url,
        }),
    );
}

// ========== MUTATIONS ==========

/** Queues a run for the saved profile; raises not_owner, no_profile, or run_in_progress. */
export async function requestSearchRun(orgId: string): Promise<string> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("request_search_run", { target_org: orgId });

    if (error) throw error;
    return data;
}
