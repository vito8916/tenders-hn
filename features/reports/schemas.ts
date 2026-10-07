import { z } from "zod";

// Must match private.report_hours: one hour after each 3-hourly sync, Honduras time.
export const REPORT_HOURS = [1, 4, 7, 10, 13, 16, 19, 22] as const;

export const reportScheduleSchema = z.object({
    hours: z.array(z.number().int()),
    emailWhenEmpty: z.boolean(),
    nextReportAt: z.string().nullable(),
});
export type ReportSchedule = z.infer<typeof reportScheduleSchema>;

export const reportScheduleInputSchema = z.object({
    hours: z
        .array(z.number().refine((hour) => (REPORT_HOURS as readonly number[]).includes(hour), "Ese horario de reporte no está disponible."))
        .min(1, "Elija al menos un horario de reporte."),
    emailWhenEmpty: z.boolean(),
});
export type ReportScheduleInput = z.infer<typeof reportScheduleInputSchema>;
