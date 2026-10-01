import { z } from "zod";
import { log } from "../log";
import type { JobHandler } from "../queue";
import { renderReportPdf, type ReportOpportunity, type ReportRelevance } from "../reports/report-pdf";
import { storage } from "../storage";

const REPORT_BUCKET = "reports";
const renderReportMessageSchema = z.object({ runId: z.uuid() });

interface RunRow {
    org_id: string;
    status: string;
    created_at: Date;
    completed_at: Date | null;
    source_synced_at: Date | null;
    processes_examined: number | null;
    candidates: number | null;
    coverage: { failedEvaluations?: number } | null;
    search_name: string;
    org_name: string;
}

interface MatchRow {
    relevance: ReportRelevance;
    match_state: ReportOpportunity["matchState"];
    expediente: string;
    title: string;
    buyer_entity: string;
    modality: string | null;
    stage: string | null;
    starts_at: Date | null;
    closes_at: Date | null;
    detail_url: string;
    reasons: { text: string }[];
    documents: string[];
}

/**
 * Renders the finished run's PDF (spec §7) into the reports bucket as
 * <org_id>/<run_id>.pdf and records its path. Enqueued by the search_run job
 * in the transaction that finishes the run; a redelivery overwrites the file.
 */
export const renderReport: JobHandler = async (message, { pool }) => {
    const { runId } = renderReportMessageSchema.parse(message);

    const { rows } = await pool.query<RunRow>(
        `select r.org_id, r.status, r.created_at, r.completed_at, r.source_synced_at, r.processes_examined, r.candidates, r.coverage,
                s.name as search_name, o.name as org_name
         from public.search_runs r
         join public.saved_searches s on s.id = r.saved_search_id
         join public.organizations o on o.id = r.org_id
         where r.id = $1`,
        [runId],
    );
    const run = rows[0];
    if (!run || (run.status !== "completed" && run.status !== "partial")) {
        log("warn", "Report skipped: the run is missing or not finished", { runId });
        return;
    }

    const { rows: matches } = await pool.query<MatchRow>(
        `select m.relevance, m.match_state, m.expediente, m.title, m.buyer_entity, m.modality, m.stage, m.starts_at, m.closes_at,
                m.detail_url, m.reasons,
                -- The documents published by the time the run finished.
                coalesce(array(
                  select d.title from public.source_documents d
                  where d.process_id = m.process_id and d.first_seen_at <= coalesce($2, now())
                    and (d.removed_at is null or d.removed_at > coalesce($2, now()))
                  order by d.first_seen_at
                ), '{}') as documents
         from public.search_run_matches m
         where m.run_id = $1
         order by array_position(array['muy_relevante', 'posible', 'pendiente', 'descartada'], m.relevance),
                  m.closes_at nulls last, m.retrieval_rank`,
        [runId, run.completed_at],
    );

    const counts: Record<ReportRelevance, number> = { muy_relevante: 0, posible: 0, pendiente: 0, descartada: 0 };
    for (const match of matches) counts[match.relevance] += 1;

    const pdf = await renderReportPdf({
        orgName: run.org_name,
        searchName: run.search_name,
        runCreatedAt: run.created_at,
        generatedAt: new Date(),
        sourceSyncedAt: run.source_synced_at,
        processesExamined: run.processes_examined,
        candidates: run.candidates,
        failedEvaluations: run.coverage?.failedEvaluations ?? 0,
        counts,
        opportunities: matches
            .filter((match) => match.relevance !== "descartada")
            .map((match) => ({
                relevance: match.relevance,
                matchState: match.match_state,
                expediente: match.expediente,
                title: match.title,
                buyerEntity: match.buyer_entity,
                modality: match.modality,
                stage: match.stage,
                startsAt: match.starts_at,
                closesAt: match.closes_at,
                detailUrl: match.detail_url,
                reasons: match.reasons.map((reason) => reason.text),
                documents: match.documents,
            })),
    });

    const path = `${run.org_id}/${runId}.pdf`;
    const { error } = await storage.from(REPORT_BUCKET).upload(path, pdf, { contentType: "application/pdf", upsert: true });
    if (error) throw error;

    await pool.query("update public.search_runs set report_path = $2 where id = $1", [runId, path]);
    log("info", "Report rendered", { runId, bytes: pdf.length });
};
