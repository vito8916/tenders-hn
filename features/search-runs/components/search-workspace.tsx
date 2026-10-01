import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshWhileActive } from "@/components/shared/refresh-while-active";
import { SearchCriteria } from "@/features/saved-searches/components/search-criteria";
import type { SavedSearch } from "@/features/saved-searches/schemas";
import { isRunActive, isRunFinished, type SearchRun, type SearchRunMatch } from "../schemas";
import { MatchList } from "./match-list";
import { RunSearchButton } from "./run-search-button";
import { RunStatus } from "./run-status";

const dateTime = new Intl.DateTimeFormat("es-HN", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Tegucigalpa" });
const relativeTime = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

/** "hace 2 horas": how old the data a new run would use is (spec §12.1). */
function ingestionAge(finishedAt: string) {
    const minutes = Math.round((new Date(finishedAt).getTime() - Date.now()) / 60_000);
    return Math.abs(minutes) < 90 ? relativeTime.format(minutes, "minute") : relativeTime.format(Math.round(minutes / 60), "hour");
}

function RunNotices({
    homeHref,
    searchId,
    latestRun,
    shownRun,
    latestFinished,
}: {
    homeHref: string;
    searchId: string;
    latestRun: SearchRun | null;
    shownRun: SearchRun | null;
    latestFinished: SearchRun | null;
}) {
    const runInProgress = latestRun !== null && isRunActive(latestRun.status) && latestRun.id !== shownRun?.id;
    const viewingOlderRun = shownRun !== null && latestFinished !== null && shownRun.id !== latestFinished.id;

    if (!runInProgress && !viewingOlderRun) return null;
    return (
        <div className="space-y-1 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            {runInProgress ? (
                <p>
                    Hay una ejecución en curso desde el {dateTime.format(new Date(latestRun.createdAt))}. Sus resultados aparecen aquí al terminar.
                    <RefreshWhileActive />
                </p>
            ) : null}
            {viewingOlderRun ? (
                <p>
                    Está viendo los resultados de una ejecución anterior.{" "}
                    <Link href={`${homeHref}?busqueda=${searchId}`} className="text-primary hover:underline">
                        Ver la más reciente
                    </Link>
                </p>
            ) : null}
        </div>
    );
}

function Results({
    shownRun,
    matches,
    editHref,
}: {
    shownRun: SearchRun | null;
    matches: SearchRunMatch[];
    editHref: string | null;
}) {
    if (!shownRun) {
        return <p className="text-sm text-muted-foreground">Esta búsqueda todavía no tiene resultados.</p>;
    }
    if (!isRunFinished(shownRun.status)) {
        return null;
    }

    const relevant = matches.filter((match) => match.relevance === "muy_relevante" || match.relevance === "posible");
    return (
        <>
            {relevant.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    Esta ejecución examinó {shownRun.processesExamined ?? 0} procesos abiertos
                    {shownRun.sourceSyncedAt ? ` con datos de HonduCompras del ${dateTime.format(new Date(shownRun.sourceSyncedAt))}` : ""} y no
                    encontró oportunidades relevantes.{" "}
                    {editHref ? (
                        <Link href={editHref} className="text-primary hover:underline">
                            Ajustar los criterios
                        </Link>
                    ) : null}
                </p>
            ) : null}
            {matches.length > 0 ? <MatchList matches={matches} /> : null}
        </>
    );
}

/**
 * The Home's right side (spec §12.1): the selected search with its criteria,
 * «Ejecutar ahora» and the age of the data it would use, the status of the
 * shown run, and its results.
 */
export function SearchWorkspace({
    orgSlug,
    search,
    latestRun,
    shownRun,
    latestFinished,
    matches,
    latestIngestionAt,
    canManage,
    hasActivePlan,
}: {
    orgSlug: string;
    search: SavedSearch;
    latestRun: SearchRun | null;
    shownRun: SearchRun | null;
    latestFinished: SearchRun | null;
    matches: SearchRunMatch[];
    latestIngestionAt: string | null;
    canManage: boolean;
    hasActivePlan: boolean;
}) {
    const homeHref = `/organizations/${orgSlug}`;
    const editHref = canManage ? `${homeHref}/searches/${search.id}/edit` : null;
    const canRun = search.isActive && hasActivePlan;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                        <h1 className="truncate text-2xl font-semibold">{search.name}</h1>
                        {search.isActive ? null : <Badge variant="outline">Pausada</Badge>}
                    </div>
                    {canRun && latestIngestionAt ? (
                        <p className="text-sm text-muted-foreground">
                            «Ejecutar ahora» usa la última sincronización completa con HonduCompras, terminada {ingestionAge(latestIngestionAt)}.
                        </p>
                    ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {editHref ? (
                        <Button variant="outline" asChild>
                            <Link href={editHref}>Editar</Link>
                        </Button>
                    ) : null}
                    {canRun ? (
                        <RunSearchButton searchId={search.id} orgSlug={orgSlug} disabled={latestRun !== null && isRunActive(latestRun.status)} />
                    ) : null}
                </div>
            </div>

            <details className="rounded-lg border p-4">
                <summary className="cursor-pointer text-sm font-medium">Criterios de la búsqueda</summary>
                <div className="mt-3">
                    <SearchCriteria search={search} />
                </div>
            </details>

            <RunNotices homeHref={homeHref} searchId={search.id} latestRun={latestRun} shownRun={shownRun} latestFinished={latestFinished} />
            {shownRun ? <RunStatus run={shownRun} /> : null}
            <Results shownRun={shownRun} matches={matches} editHref={editHref} />
        </div>
    );
}
