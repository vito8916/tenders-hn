import { z } from "zod";
import { log } from "../log";
import type { JobHandler } from "../queue";
import { renderReportXlsx } from "../reports/report-xlsx";
import { storage } from "../storage";
import { loadRunOpportunities, REPORT_BUCKET } from "./render-report";

const renderOrgReportMessageSchema = z.object({ reportId: z.uuid() });

interface ReportRunRow {
    id: string;
    completed_at: Date | null;
    search_name: string;
}

/**
 * A finished report of an organization (plan D6): its Excel file, one sheet
 * per search, as <org_id>/reports/<report_id>.xlsx, then the email to the
 * members (private.notify_org_report, once). Enqueued when the report's last
 * run finishes; a redelivery overwrites the file and sends nothing twice.
 */
export const renderOrgReport: JobHandler = async (message, { pool }) => {
    const { reportId } = renderOrgReportMessageSchema.parse(message);

    const { rows: reports } = await pool.query<{ org_id: string }>("select org_id from public.org_reports where id = $1", [reportId]);
    const report = reports[0];
    if (!report) {
        log("warn", "Organization report skipped: it no longer exists", { reportId });
        return;
    }

    const { rows: runs } = await pool.query<ReportRunRow>(
        `select r.id, r.completed_at, s.name as search_name
         from public.search_runs r
         join public.saved_searches s on s.id = r.saved_search_id
         where r.report_id = $1 and r.status in ('completed', 'partial')
         order by s.is_default desc, s.name`,
        [reportId],
    );

    if (runs.length > 0) {
        const sheets = [];
        for (const run of runs) {
            const opportunities = await loadRunOpportunities(pool, run.id, run.completed_at);
            sheets.push({ searchName: run.search_name, opportunities: opportunities.filter((match) => match.relevance !== "descartada") });
        }
        const xlsx = await renderReportXlsx(sheets);
        const path = `${report.org_id}/reports/${reportId}.xlsx`;
        const { error } = await storage.from(REPORT_BUCKET).upload(path, xlsx, {
            contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            upsert: true,
        });
        if (error) throw error;
        await pool.query("update public.org_reports set excel_path = $2 where id = $1", [reportId, path]);
        log("info", "Organization report rendered", { reportId, sheets: sheets.length, bytes: xlsx.length });
    }

    await pool.query("select private.notify_org_report($1)", [reportId]);
};
