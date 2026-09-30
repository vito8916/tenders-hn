import { Badge } from "@/components/ui/badge";
import type { SearchRun, SearchRunStatus } from "../schemas";
import { RefreshWhileActive } from "./refresh-while-active";

const STATUS_LABELS: Record<SearchRunStatus, string> = {
    queued: "En cola",
    running: "En curso",
    completed: "Completada",
    partial: "Completada con pendientes",
    failed: "Falló",
};

const dateTime = new Intl.DateTimeFormat("es-HN", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Tegucigalpa" });

export function RunStatus({ run }: { run: SearchRun }) {
    const active = run.status === "queued" || run.status === "running";

    return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <Badge variant={run.status === "failed" ? "destructive" : active ? "secondary" : "outline"}>{STATUS_LABELS[run.status]}</Badge>
            <span className="text-muted-foreground">Iniciada el {dateTime.format(new Date(run.createdAt))}</span>
            {run.candidates !== null ? (
                <span className="text-muted-foreground">
                    {run.candidates} candidatos evaluados, {run.matchesCount ?? 0} relevantes o posibles
                </span>
            ) : null}
            {run.failedEvaluations > 0 ? (
                <span className="text-muted-foreground">{run.failedEvaluations} sin evaluar por errores</span>
            ) : null}
            {run.error ? <span className="text-destructive">{run.error}</span> : null}
            {active ? (
                <>
                    <span className="text-muted-foreground">La página se actualiza sola; puede tardar unos minutos.</span>
                    <RefreshWhileActive />
                </>
            ) : null}
        </div>
    );
}
