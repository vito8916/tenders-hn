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
    saved_search_id: string;
    is_default: boolean;
}

/**
 * A finished report of an organization (plan D6, D7): an Excel file for each
 * member, one sheet for «Recomendadas» and each list they follow, as
 * <org_id>/reports/<report_id>/<user_id>.xlsx, then the email to the members
 * (private.notify_org_report, once). Enqueued when the report's last run
 * finishes; a redelivery overwrites the files and sends nothing twice.
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
        `select r.id, r.completed_at, s.name as search_name, r.saved_search_id, s.is_default
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
            sheets.push({ run, searchName: run.search_name, opportunities: opportunities.filter((match) => match.relevance !== "descartada") });
        }

        const { rows: members } = await pool.query<{ user_id: string; followed: string[] }>(
            `select m.user_id, coalesce(array_agg(f.saved_search_id::text) filter (where f.saved_search_id is not null), '{}') as followed
             from public.organization_members m
             left join public.list_followers f on f.user_id = m.user_id and f.org_id = m.org_id
             where m.org_id = $1
             group by m.user_id`,
            [report.org_id],
        );

        const folder = `${report.org_id}/reports/${reportId}`;
        for (const member of members) {
            const memberSheets = sheets.filter(({ run }) => run.is_default || member.followed.includes(run.saved_search_id));
            if (memberSheets.length === 0) continue;
            const xlsx = await renderReportXlsx(memberSheets);
            const { error } = await storage.from(REPORT_BUCKET).upload(`${folder}/${member.user_id}.xlsx`, xlsx, {
                contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                upsert: true,
            });
            if (error) throw error;
        }
        await pool.query("update public.org_reports set excel_path = $2 where id = $1", [reportId, folder]);
        log("info", "Organization report rendered", { reportId, sheets: sheets.length, members: members.length });
    }

    await pool.query("select private.notify_org_report($1)", [reportId]);
};
