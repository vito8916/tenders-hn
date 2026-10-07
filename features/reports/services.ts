import "server-only";
import { getSubscription } from "@/features/billing/repository";
import { getSearchLimits } from "@/features/saved-searches/repository";
import { getReportSchedule, setReportSchedule } from "./repository";
import type { ReportScheduleInput } from "./schemas";

/** The organization's report times with what its plan allows. */
export async function getReportSettingsService(orgId: string) {
    const [schedule, limits, subscription] = await Promise.all([getReportSchedule(orgId), getSearchLimits(orgId), getSubscription(orgId)]);
    return {
        schedule,
        hasActivePlan: limits.hasActivePlan,
        maxDailyReports: limits.maxDailyReports,
        planName: subscription?.planName ?? null,
    };
}

/** Owners and admins within the plan's limit; set_report_schedule enforces both. */
export async function saveReportScheduleService(params: { orgId: string; input: ReportScheduleInput }) {
    return setReportSchedule(params.orgId, params.input);
}
