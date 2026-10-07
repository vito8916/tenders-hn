"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { userErrorMessage } from "@/lib/errors";
import { reportScheduleInputSchema, type ReportScheduleInput } from "./schemas";
import { saveReportScheduleService } from "./services";

const saveReportScheduleActionSchema = reportScheduleInputSchema.extend({
    orgId: z.uuid(),
    orgSlug: z.string().min(1),
});

/**
 * Server Action that saves the organization's report times
 */
export async function saveReportScheduleAction(
    input: ReportScheduleInput & { orgId: string; orgSlug: string },
): Promise<{ success: boolean; error?: string }> {
    try {
        await getCurrentUser();

        const parsed = saveReportScheduleActionSchema.safeParse(input);
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message ?? "Los datos ingresados no son válidos." };
        }

        const { orgId, orgSlug, ...scheduleInput } = parsed.data;
        await saveReportScheduleService({ orgId, input: scheduleInput });

        revalidatePath(`/organizations/${orgSlug}/settings/reports`);

        return { success: true };
    } catch (error) {
        console.error("Error saving report schedule:", error);
        return { success: false, error: userErrorMessage(error, "No se pudieron guardar los horarios. Intente de nuevo.") };
    }
}
