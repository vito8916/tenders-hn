"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { SettingsSectionBody, SettingsSectionFooter } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { saveReportScheduleAction } from "../actions";
import { REPORT_HOURS, type ReportSchedule } from "../schemas";

export function ReportScheduleForm({
    orgId,
    orgSlug,
    schedule,
    maxDailyReports,
    canEdit,
}: {
    orgId: string;
    orgSlug: string;
    schedule: ReportSchedule;
    maxDailyReports: number;
    canEdit: boolean;
}) {
    const router = useRouter();
    const [hours, setHours] = useState(schedule.hours);
    const [emailWhenEmpty, setEmailWhenEmpty] = useState(schedule.emailWhenEmpty);
    const [isSaving, setIsSaving] = useState(false);

    const toggleHour = (hour: number) =>
        setHours((current) => (current.includes(hour) ? current.filter((chosen) => chosen !== hour) : [...current, hour]));

    async function save() {
        setIsSaving(true);
        const result = await saveReportScheduleAction({ orgId, orgSlug, hours, emailWhenEmpty });
        setIsSaving(false);
        if (!result.success) {
            toast.error(result.error ?? "No se pudieron guardar los horarios.");
            return;
        }
        toast.success("Se guardaron los horarios de los reportes.");
        router.refresh();
    }

    const limitReached = hours.length >= maxDailyReports;

    return (
        <>
            <SettingsSectionBody className="space-y-6">
                <div className="space-y-3">
                    <p className="text-sm font-medium">Horarios (hora de Honduras)</p>
                    <div className="flex flex-wrap gap-2">
                        {REPORT_HOURS.map((hour) => {
                            const chosen = hours.includes(hour);
                            return (
                                <Button
                                    key={hour}
                                    type="button"
                                    variant={chosen ? "default" : "outline"}
                                    size="sm"
                                    aria-pressed={chosen}
                                    className={cn("w-16 tabular-nums", !chosen && "font-normal")}
                                    disabled={!canEdit || isSaving || (!chosen && limitReached)}
                                    onClick={() => toggleHour(hour)}
                                >
                                    {hour}:00
                                </Button>
                            );
                        })}
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {hours.length} de {maxDailyReports} reportes al día elegidos.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Switch id="email-when-empty" checked={emailWhenEmpty} disabled={!canEdit || isSaving} onCheckedChange={setEmailWhenEmpty} />
                    <Label htmlFor="email-when-empty" className="font-normal">
                        Enviar el correo aunque no haya oportunidades nuevas
                    </Label>
                </div>
            </SettingsSectionBody>
            {canEdit ? (
                <SettingsSectionFooter>
                    <Button type="button" disabled={isSaving || hours.length === 0} onClick={save}>
                        {isSaving ? (
                            <>
                                <LoaderCircle className="mr-2 size-4 animate-spin" />
                                Guardando…
                            </>
                        ) : (
                            "Guardar"
                        )}
                    </Button>
                </SettingsSectionFooter>
            ) : null}
        </>
    );
}
