import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { RunSearchButton } from "@/features/search-runs/components/run-search-button";
import { RunStatusBadge } from "@/features/search-runs/components/run-status";
import { isRunActive, type SearchRun } from "@/features/search-runs/schemas";
import { SCHEDULE_LABELS, type SavedSearch } from "../schemas";

const dateTime = new Intl.DateTimeFormat("es-HN", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Tegucigalpa" });

function LatestRun({ run }: { run: SearchRun | undefined }) {
    if (!run) {
        return <span>Todavía no se ha ejecutado</span>;
    }
    return (
        <span className="flex flex-wrap items-center gap-2">
            <RunStatusBadge status={run.status} />
            {dateTime.format(new Date(run.createdAt))}
            {run.matchesCount !== null ? ` · ${run.matchesCount} relevantes o posibles` : ""}
        </span>
    );
}

export function SavedSearchList({
    orgSlug,
    searches,
    latestRuns,
    canRun,
}: {
    orgSlug: string;
    searches: SavedSearch[];
    latestRuns: SearchRun[];
    canRun: boolean;
}) {
    const latestRunBySearch = new Map(latestRuns.map((run) => [run.savedSearchId, run]));

    return (
        <ul className="divide-y rounded-lg border">
            {searches.map((search) => {
                const latestRun = latestRunBySearch.get(search.id);
                return (
                    <li key={search.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                                <Link href={`/organizations/${orgSlug}?busqueda=${search.id}`} className="font-medium hover:underline">
                                    {search.name}
                                </Link>
                                {search.isActive ? null : <Badge variant="outline">Pausada</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {search.inheritsProfile ? "Perfil de la empresa" : "Descripción propia"}
                                {search.isActive ? ` · ${SCHEDULE_LABELS[search.schedule]}` : ""}
                            </p>
                            <div className="text-sm text-muted-foreground">
                                <LatestRun run={latestRun} />
                            </div>
                        </div>
                        {search.isActive && canRun ? (
                            <RunSearchButton
                                searchId={search.id}
                                orgSlug={orgSlug}
                                size="sm"
                                disabled={latestRun !== undefined && isRunActive(latestRun.status)}
                            />
                        ) : null}
                    </li>
                );
            })}
        </ul>
    );
}
