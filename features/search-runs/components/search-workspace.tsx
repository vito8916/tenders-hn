import { Suspense } from "react";
import Link from "next/link";
import { ChevronDown, MessageSquareText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ContextChat } from "@/features/chat/components/context-chat";
import { ReportChatSheet } from "@/features/chat/components/report-chat-sheet";
import { DetailSheet } from "@/features/opportunities/components/detail-sheet";
import { formatOpportunityTitle } from "@/features/opportunities/title";
import { OpportunityDetail } from "@/features/opportunities/components/opportunity-detail";
import { RefreshWhileActive } from "@/components/shared/refresh-while-active";
import { SearchCriteria } from "@/features/saved-searches/components/search-criteria";
import type { SavedSearch } from "@/features/saved-searches/schemas";
import { applyResultView, hasFilters, parseResultView, withParams, type SearchParamsRecord } from "../results";
import { isRunActive, isRunFinished, isRunStale, type SearchRun, type SearchRunMatch } from "../schemas";
import { DownloadMenu } from "./download-menu";
import { ResultsTable } from "./results-table";
import { ResultsToolbar } from "./results-toolbar";
import { RunSearchButton } from "./run-search-button";
import { RunStatus, STALE_RUN_NOTICE } from "./run-status";

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
                    Hay una ejecución en curso desde el {dateTime.format(new Date(latestRun.createdAt))}.{" "}
                    {isRunStale(latestRun) ? (
                        STALE_RUN_NOTICE
                    ) : (
                        <>
                            Sus resultados aparecen aquí al terminar.
                            <RefreshWhileActive />
                        </>
                    )}
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

/** A search's first run, while it has no results yet: right after onboarding, the first thing the Home shows. */
function FirstRunInProgress({ isDefault, stale }: { isDefault: boolean; stale: boolean }) {
    return (
        <Empty className="border">
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <Spinner />
                </EmptyMedia>
                <EmptyTitle>Preparando sus oportunidades</EmptyTitle>
                <EmptyDescription>
                    {isDefault
                        ? "Estamos revisando los procesos abiertos de HonduCompras con lo que vende su empresa."
                        : "Estamos revisando los procesos abiertos de HonduCompras con los criterios de esta búsqueda."}{" "}
                    {stale ? STALE_RUN_NOTICE : "Suele tardar uno o dos minutos; esta página se actualiza sola."}
                </EmptyDescription>
            </EmptyHeader>
            {stale ? null : <RefreshWhileActive />}
        </Empty>
    );
}

function Pager({ page, pageCount, params, homeHref }: { page: number; pageCount: number; params: SearchParamsRecord; homeHref: string }) {
    if (pageCount <= 1) return null;
    const href = (target: number) => `${homeHref}${withParams(params, { pagina: target === 1 ? null : String(target) })}`;
    return (
        <nav aria-label="Páginas de resultados" className="flex items-center justify-between gap-2 text-sm">
            <Button variant="outline" size="sm" asChild className={page === 1 ? "pointer-events-none opacity-50" : undefined}>
                <Link href={href(page - 1)} scroll={false} aria-disabled={page === 1}>
                    Anterior
                </Link>
            </Button>
            <span className="text-muted-foreground">
                Página {page} de {pageCount}
            </span>
            <Button variant="outline" size="sm" asChild className={page === pageCount ? "pointer-events-none opacity-50" : undefined}>
                <Link href={href(page + 1)} scroll={false} aria-disabled={page === pageCount}>
                    Siguiente
                </Link>
            </Button>
        </nav>
    );
}

function DetailSkeleton() {
    return (
        <div className="space-y-4 p-6">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-40 w-full" />
        </div>
    );
}

function Results({
    orgId,
    orgSlug,
    shownRun,
    matches,
    params,
    homeHref,
    editHref,
    canDecide,
}: {
    orgId: string;
    orgSlug: string;
    shownRun: SearchRun | null;
    matches: SearchRunMatch[];
    params: SearchParamsRecord;
    homeHref: string;
    editHref: string | null;
    canDecide: boolean;
}) {
    if (!shownRun) {
        return <p className="text-sm text-muted-foreground">Esta búsqueda todavía no tiene resultados.</p>;
    }
    if (!isRunFinished(shownRun.status)) {
        return null;
    }

    const view = parseResultView(params);
    const { filtered, rows, page, pageCount, facets } = applyResultView(matches, view);
    const relevant = matches.filter((match) => match.relevance === "muy_relevante" || match.relevance === "posible");
    const filters = hasFilters(view);
    // Only an opportunity of the shown run opens, so a stale or edited link just closes the panel.
    const detailMatch = typeof params.detalle === "string" ? matches.find((match) => match.processId === params.detalle) : undefined;

    return (
        <section className="space-y-4" aria-label="Resultados">
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
            {matches.length > 0 ? (
                <>
                    <ResultsToolbar view={view} facets={facets} filtered={filters} />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-muted-foreground">
                            {filters ? `${filtered.length} de ${matches.length} oportunidades` : `${matches.length} oportunidades`}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                            {relevant.length > 0 ? (
                                <Button variant="outline" asChild>
                                    <Link href={`${homeHref}${withParams(params, { preguntar: "reporte" })}`} scroll={false}>
                                        <MessageSquareText />
                                        Preguntar sobre el reporte
                                    </Link>
                                </Button>
                            ) : null}
                            <DownloadMenu
                                runHref={`${homeHref}/runs/${shownRun.id}`}
                                reportReady={shownRun.reportPath !== null}
                                excelReady={shownRun.excelPath !== null}
                                reportCount={matches.filter((match) => match.relevance !== "descartada").length}
                                params={params}
                                total={matches.length}
                                filtered={filters ? filtered.length : null}
                            />
                        </div>
                    </div>
                    {rows.length > 0 ? (
                        <ResultsTable rows={rows} params={params} homeHref={homeHref} />
                    ) : (
                        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Ningún resultado con estos filtros.</p>
                    )}
                    <Pager page={page} pageCount={pageCount} params={params} homeHref={homeHref} />
                </>
            ) : null}
            {params.preguntar === "reporte" && relevant.length > 0 ? (
                <ReportChatSheet>
                    <Suspense key={shownRun.id} fallback={<DetailSkeleton />}>
                        <ContextChat orgId={orgId} orgSlug={orgSlug} context={{ type: "report", runId: shownRun.id }} />
                    </Suspense>
                </ReportChatSheet>
            ) : null}
            {detailMatch ? (
                <DetailSheet title={formatOpportunityTitle(detailMatch.title)}>
                    <Suspense key={detailMatch.processId} fallback={<DetailSkeleton />}>
                        <OpportunityDetail orgId={orgId} orgSlug={orgSlug} runId={shownRun.id} match={detailMatch} canDecide={canDecide} />
                    </Suspense>
                </DetailSheet>
            ) : null}
        </section>
    );
}

/**
 * The Home's right side (spec §12.1): the selected search with its criteria,
 * «Ejecutar ahora» and the age of the data it would use, the status of the
 * shown run, and its results.
 */
export function SearchWorkspace({
    orgId,
    orgSlug,
    search,
    latestRun,
    shownRun,
    latestFinished,
    matches,
    params,
    latestIngestionAt,
    canManage,
    canDecide,
    hasActivePlan,
}: {
    orgId: string;
    orgSlug: string;
    search: SavedSearch;
    latestRun: SearchRun | null;
    shownRun: SearchRun | null;
    latestFinished: SearchRun | null;
    matches: SearchRunMatch[];
    /** The page's query: the shown run's filters, sort, page, and detail. */
    params: SearchParamsRecord;
    latestIngestionAt: string | null;
    canManage: boolean;
    /** Whether the user may mark opportunities («Me interesa»). */
    canDecide: boolean;
    hasActivePlan: boolean;
}) {
    const homeHref = `/organizations/${orgSlug}`;
    const editHref = canManage ? `${homeHref}/searches/${search.id}/edit` : null;
    const canRun = search.isActive && hasActivePlan;
    const firstRunInProgress = latestFinished === null && latestRun !== null && isRunActive(latestRun.status);

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

            <Collapsible className="group/criteria rounded-lg border">
                <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-lg px-4 py-3 text-sm font-medium hover:bg-muted/50">
                    Criterios de la búsqueda
                    <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]/criteria:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="border-t px-4 py-3">
                    <SearchCriteria search={search} />
                </CollapsibleContent>
            </Collapsible>

            {firstRunInProgress ? (
                <FirstRunInProgress isDefault={search.isDefault} stale={isRunStale(latestRun)} />
            ) : (
                <RunNotices homeHref={homeHref} searchId={search.id} latestRun={latestRun} shownRun={shownRun} latestFinished={latestFinished} />
            )}
            {shownRun ? <RunStatus run={shownRun} /> : null}
            {firstRunInProgress ? null : (
                <Results
                    orgId={orgId}
                    orgSlug={orgSlug}
                    shownRun={shownRun}
                    matches={matches}
                    params={params}
                    homeHref={homeHref}
                    editHref={editHref}
                    canDecide={canDecide}
                />
            )}
        </div>
    );
}
