import "server-only";
import { createClient } from "@/lib/supabase/server";
import { reportScheduleSchema, type ReportSchedule, type ReportScheduleInput } from "./schemas";

// ========== QUERIES ==========

/** Null while the organization has no plan: its report times are created when the plan activates. */
export async function getReportSchedule(orgId: string): Promise<ReportSchedule | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("report_schedules")
        .select("hours, email_when_empty, next_report_at")
        .eq("org_id", orgId)
        .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return reportScheduleSchema.parse({ hours: data.hours, emailWhenEmpty: data.email_when_empty, nextReportAt: data.next_report_at });
}

// ========== MUTATIONS ==========

/** Raises insufficient_role, subscription_inactive, invalid_report_hours, or report_limit_reached; returns the next report time. */
export async function setReportSchedule(orgId: string, input: ReportScheduleInput): Promise<string> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("set_report_schedule", {
        target_org: orgId,
        report_hours: input.hours,
        send_when_empty: input.emailWhenEmpty,
    });

    if (error) throw error;
    return data;
}
