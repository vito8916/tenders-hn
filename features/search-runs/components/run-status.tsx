import { Badge } from "@/components/ui/badge";
import { isRunActive, isRunStale, type SearchRun, type SearchRunStatus } from "../schemas";
import { RefreshWhileActive } from "@/components/shared/refresh-while-active";

export const RUN_STATUS_LABELS: Record<SearchRunStatus, string> = {
    queued: "En cola",
    running: "En curso",
    completed: "Completada",
    partial: "Completada con pendientes",
    failed: "Falló",
};

export const STALE_RUN_NOTICE = "Está tardando más de lo normal; vuelva a cargar la página más tarde.";

const dateTime = new Intl.DateTimeFormat("es-HN", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Tegucigalpa" });

export function RunStatusBadge({ status }: { status: SearchRunStatus }) {
    return (
        <Badge variant={status === "failed" ? "destructive" : isRunActive(status) ? "secondary" : "outline"}>
            {RUN_STATUS_LABELS[status]}
        </Badge>
    );
}

export function RunStatus({ run }: { run: SearchRun }) {
    const active = isRunActive(run.status);

    return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <RunStatusBadge status={run.status} />
            <span className="text-muted-foreground">
                {run.trigger === "schedule" ? "Programada" : "Iniciada"} el {dateTime.format(new Date(run.createdAt))}
            </span>
            {run.sourceSyncedAt ? (
                <span className="text-muted-foreground">Datos de HonduCompras del {dateTime.format(new Date(run.sourceSyncedAt))}</span>
            ) : null}
            {run.candidates !== null ? (
                <span className="text-muted-foreground">
                    {run.processesExamined !== null ? `${run.processesExamined} procesos abiertos, ` : ""}
                    {run.candidates} candidatos evaluados, {run.matchesCount ?? 0} relevantes o posibles
                </span>
            ) : null}
            {run.failedEvaluations > 0 ? <span className="text-muted-foreground">{run.failedEvaluations} sin evaluar por errores</span> : null}
            {run.status === "failed" ? <span className="text-destructive">No se pudo completar. Intente actualizar de nuevo.</span> : null}
            {active && isRunStale(run) ? <span className="text-muted-foreground">{STALE_RUN_NOTICE}</span> : null}
            {active && !isRunStale(run) ? (
                <>
                    <span className="text-muted-foreground">La página se actualiza sola; puede tardar unos minutos.</span>
                    <RefreshWhileActive />
                </>
            ) : null}
        </div>
    );
}
