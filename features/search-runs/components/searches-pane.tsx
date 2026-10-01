import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SavedSearch } from "@/features/saved-searches/schemas";
import { isRunFinished, type SearchRun } from "../schemas";
import { RUN_STATUS_LABELS } from "./run-status";

const runDate = new Intl.DateTimeFormat("es-HN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Tegucigalpa" });

export type SearchPaneItem = { search: SavedSearch; latestRun: SearchRun | null; newMatches: number };

function RunList({ homeHref, searchId, runs, shownRunId }: { homeHref: string; searchId: string; runs: SearchRun[]; shownRunId: string | null }) {
    return (
        <ul className="mt-1 ml-3 space-y-0.5 border-l pl-2">
            {runs.map((run) => (
                <li key={run.id}>
                    <Link
                        href={`${homeHref}?busqueda=${searchId}&ejecucion=${run.id}`}
                        aria-current={run.id === shownRunId ? "page" : undefined}
                        className={cn(
                            "flex items-center justify-between gap-2 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted",
                            run.id === shownRunId && "bg-muted font-medium text-foreground",
                        )}
                    >
                        <span>{runDate.format(new Date(run.createdAt))}</span>
                        <span>{isRunFinished(run.status) ? `${run.matchesCount ?? 0} relevantes` : RUN_STATUS_LABELS[run.status]}</span>
                    </Link>
                </li>
            ))}
        </ul>
    );
}

/**
 * The Home's left pane (spec §12.1): «Nueva búsqueda», the searches most
 * recently run first with their new matches, and the selected search's
 * recent runs.
 */
export function SearchesPane({
    orgSlug,
    items,
    selectedSearchId,
    recentRuns,
    shownRunId,
    canCreate,
}: {
    orgSlug: string;
    items: SearchPaneItem[];
    selectedSearchId: string | null;
    recentRuns: SearchRun[];
    shownRunId: string | null;
    canCreate: boolean;
}) {
    const homeHref = `/organizations/${orgSlug}`;

    return (
        <div className="space-y-2 p-2">
            <div className="flex items-center justify-between gap-2 px-2 py-2">
                <h2 className="text-sm font-semibold">Búsquedas</h2>
                {canCreate ? (
                    <Button size="sm" asChild>
                        <Link href={`${homeHref}/searches/new`}>Nueva búsqueda</Link>
                    </Button>
                ) : null}
            </div>
            <nav aria-label="Búsquedas guardadas">
                <ul className="space-y-0.5">
                    {items.map(({ search, latestRun, newMatches }) => {
                        const isSelected = search.id === selectedSearchId;
                        return (
                            <li key={search.id}>
                                <Link
                                    href={`${homeHref}?busqueda=${search.id}`}
                                    aria-current={isSelected ? "page" : undefined}
                                    className={cn("flex flex-col gap-0.5 rounded-md px-3 py-2 hover:bg-muted", isSelected && "bg-muted")}
                                >
                                    <span className="flex items-center justify-between gap-2">
                                        <span className="truncate text-sm font-medium">{search.name}</span>
                                        {newMatches > 0 ? <Badge className="shrink-0">{newMatches === 1 ? "1 nueva" : `${newMatches} nuevas`}</Badge> : null}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {latestRun
                                            ? formatDistanceToNow(new Date(latestRun.createdAt), { addSuffix: true, locale: es })
                                            : "Sin ejecutar"}
                                        {search.isActive ? "" : " · Pausada"}
                                    </span>
                                </Link>
                                {isSelected && recentRuns.length > 0 ? (
                                    <RunList homeHref={homeHref} searchId={search.id} runs={recentRuns} shownRunId={shownRunId} />
                                ) : null}
                            </li>
                        );
                    })}
                </ul>
            </nav>
        </div>
    );
}
