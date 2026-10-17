import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, History, MessageSquareText } from "lucide-react";
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
import { homeViewPath, type HomeView, type Opportunity } from "../opportunities";
import { applyResultView, hasFilters, parseResultView, withParams, type SearchParamsRecord } from "../results";
import { isRunActive, isRunStale, type SearchRun } from "../schemas";
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
    if (Math.abs(minutes) < 90) return relativeTime.format(minutes, "minute");
    if (Math.abs(minutes) < 48 * 60) return relativeTime.format(Math.round(minutes / 60), "hour");
    return relativeTime.format(Math.round(minutes / (24 * 60)), "day");
}

// Syncs run every three hours (spec §6); older data means the source or the worker is failing.
const STALE_SOURCE_MS = 12 * 60 * 60_000;

const isSourceStale = (latestIngestionAt: string | null) =>
    latestIngestionAt === null || Date.now() - new Date(latestIngestionAt).getTime() > STALE_SOURCE_MS;

/** Old HonduCompras data, said plainly (spec §6): new processes and changed deadlines may be missing. */
function StaleSourceNotice({ latestIngestionAt }: { latestIngestionAt: string | null }) {
    if (!isSourceStale(latestIngestionAt)) return null;
    return (
        <p role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            {latestIngestionAt
                ? `Última sincronización con HonduCompras: ${dateTime.format(new Date(latestIngestionAt))}`
                : "Todavía no hay datos de HonduCompras."}{" "}
            Puede haber procesos nuevos o fechas límite cambiadas que aún no se ven aquí.
        </p>
    );
}

/** The search behind a view (Recomendadas or a list) with its latest and latest finished run. */
export type ViewSearch = { search: SavedSearch; latestRun: SearchRun | null; latestFinished: SearchRun | null };

/** A newer run in progress, or one that failed, while the view keeps showing the latest finished one. */
function RunNotices({ latestRun, latestFinished }: { latestRun: SearchRun | null; latestFinished: SearchRun | null }) {
    if (!latestRun || latestRun.id === latestFinished?.id) return null;

    if (isRunActive(latestRun.status)) {
        return (
            <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                Hay una actualización en curso desde el {dateTime.format(new Date(latestRun.createdAt))}.{" "}
                {isRunStale(latestRun) ? (
                    STALE_RUN_NOTICE
                ) : (
                    <>
                        Los resultados cambian aquí al terminar.
                        <RefreshWhileActive />
                    </>
                )}
            </p>
        );
    }
    if (latestRun.status === "failed") {
        return (
            <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                La actualización del {dateTime.format(new Date(latestRun.createdAt))} no se pudo completar.
                {latestFinished ? " Se muestran los resultados anteriores." : " Intente actualizar de nuevo."}
            </p>
        );
    }
    return null;
}

/** «Recomendadas»'s first run, while it has no results yet: right after onboarding, the first thing the Home shows. */
function FirstRunInProgress({ stale }: { stale: boolean }) {
    return (
        <Empty className="border">
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <Spinner />
                </EmptyMedia>
                <EmptyTitle>Preparando sus oportunidades</EmptyTitle>
                <EmptyDescription>
                    Estamos revisando los procesos abiertos de HonduCompras con lo que vende su empresa.{" "}
                    {stale ? STALE_RUN_NOTICE : "Suele tardar uno o dos minutos; esta página se actualiza sola."}
                </EmptyDescription>
            </EmptyHeader>
            {stale ? null : <RefreshWhileActive />}
        </Empty>
    );
}

function Pager({ page, pageCount, params, viewHref }: { page: number; pageCount: number; params: SearchParamsRecord; viewHref: string }) {
    if (pageCount <= 1) return null;
    const href = (target: number) => `${viewHref}${withParams(params, { pagina: target === 1 ? null : String(target) })}`;
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
    viewHref,
    rows,
    detailPool,
    run,
    emptyMessage,
    params,
    canDecide,
}: {
    orgId: string;
    orgSlug: string;
    /** The view's page: its links keep the reader on it, and its CSV route hangs under it. */
    viewHref: string;
    rows: Opportunity[];
    /** Where the detail panel finds its opportunity: an opportunity that just left this view keeps its panel open. */
    detailPool: Opportunity[];
    /** The run behind the view (Recomendadas, a list, or a snapshot): its PDF, Excel, and report chat. */
    run: SearchRun | null;
    emptyMessage: ReactNode;
    params: SearchParamsRecord;
    canDecide: boolean;
}) {
    const view = parseResultView(params);
    const { filtered, rows: pageRows, page, pageCount, facets } = applyResultView(rows, view);
    const filters = hasFilters(view);
    const detail = typeof params.detalle === "string" ? detailPool.find((row) => row.processId === params.detalle) : undefined;

    return (
        <section className="space-y-4" aria-label="Oportunidades">
            {rows.length === 0 ? (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
            ) : (
                <>
                    <ResultsToolbar view={view} facets={facets} filtered={filters} />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-muted-foreground">
                            {filters ? `${filtered.length} de ${rows.length} oportunidades` : `${rows.length} oportunidades`}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                            {run ? (
                                <Button variant="outline" size="sm" asChild>
                                    <Link href={`${viewHref}${withParams(params, { preguntar: "reporte" })}`} scroll={false}>
                                        <MessageSquareText />
                                        Preguntar sobre el reporte
                                    </Link>
                                </Button>
                            ) : null}
                            <DownloadMenu
                                csvHref={`${viewHref}/csv`}
                                params={params}
                                total={rows.length}
                                filtered={filters ? filtered.length : null}
                                run={run ? { href: `/organizations/${orgSlug}/updates/${run.id}`, reportReady: run.reportPath !== null, excelReady: run.excelPath !== null } : null}
                            />
                        </div>
                    </div>
                    {pageRows.length > 0 ? (
                        <ResultsTable rows={pageRows} params={params} viewHref={viewHref} />
                    ) : (
                        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Ningún resultado con estos filtros.</p>
                    )}
                    <Pager page={page} pageCount={pageCount} params={params} viewHref={viewHref} />
                </>
            )}
            {params.preguntar === "reporte" && run && rows.length > 0 ? (
                <ReportChatSheet>
                    <Suspense key={run.id} fallback={<DetailSkeleton />}>
                        <ContextChat orgId={orgId} orgSlug={orgSlug} context={{ type: "report", runId: run.id }} />
                    </Suspense>
                </ReportChatSheet>
            ) : null}
            {detail ? (
                <DetailSheet title={formatOpportunityTitle(detail.title)}>
                    <Suspense key={detail.processId} fallback={<DetailSkeleton />}>
                        <OpportunityDetail orgId={orgId} orgSlug={orgSlug} runId={detail.runId} match={detail} canDecide={canDecide} />
                    </Suspense>
                </DetailSheet>
            ) : null}
        </section>
    );
}

const VIEW_COPY: Record<"recomendadas" | "todas" | "descartadas", { title: string; description: string }> = {
    recomendadas: { title: "Recomendadas", description: "Las oportunidades abiertas muy relevantes para lo que vende su empresa." },
    todas: { title: "Todas", description: "Todo lo que coincide con su empresa o con sus listas, incluidas las posibles." },
    descartadas: {
        title: "Descartadas",
        description: "Lo que Licitaly clasificó como no relevante y lo que su equipo marcó «No me interesa». Puede volver a revisarlas.",
    },
};

function emptyMessage(view: HomeView, viewSearch: ViewSearch | null, editHref: string | null): ReactNode {
    if (view.kind === "update") return "Esta actualización no encontró oportunidades.";
    if (view.kind === "descartadas") return "No hay oportunidades descartadas.";
    if (view.kind === "todas") return "No hay oportunidades abiertas que coincidan con su empresa o sus listas.";
    if (!viewSearch?.latestFinished) return "Todavía no hay resultados. Aparecen aquí después de la primera actualización.";

    const run = viewSearch.latestFinished;
    const examined = `La última actualización examinó ${run.processesExamined ?? 0} procesos abiertos`;
    if (view.kind === "recomendadas") return `${examined} y no hay oportunidades muy relevantes abiertas. Revise «Todas» para ver las posibles.`;
    return (
        <>
            {examined} y esta lista no tiene oportunidades abiertas.{" "}
            {editHref ? (
                <Link href={editHref} className="text-primary hover:underline">
                    Ajustar los criterios
                </Link>
            ) : null}
        </>
    );
}

/**
 * The Home's right side (plan D7, spec 0.4 §12.1): the view's title, when it was last updated and with which
 * HonduCompras data, «Actualizar ahora» for Recomendadas and the lists, and its opportunities. A run's snapshot
 * (from the history, report emails, and notifications) shows that run's frozen results instead.
 */
export function OpportunitiesWorkspace({
    orgId,
    orgSlug,
    view,
    viewSearch,
    rows,
    detailPool,
    snapshotRun,
    updatedAt,
    firstRun,
    params,
    latestIngestionAt,
    canManage,
    canDecide,
    hasActivePlan,
}: {
    orgId: string;
    orgSlug: string;
    view: HomeView;
    /** Recomendadas's or the list's search; null for Todas and Descartadas. */
    viewSearch: ViewSearch | null;
    rows: Opportunity[];
    detailPool: Opportunity[];
    snapshotRun: SearchRun | null;
    /** When the shown results were computed: the latest finished run behind the view. */
    updatedAt: string | null;
    /** «Recomendadas»'s first run in progress, which Recomendadas and Todas wait for. */
    firstRun: SearchRun | null;
    params: SearchParamsRecord;
    latestIngestionAt: string | null;
    canManage: boolean;
    /** Whether the user may mark opportunities («Me interesa»). */
    canDecide: boolean;
    hasActivePlan: boolean;
}) {
    const orgHref = `/organizations/${orgSlug}`;
    const viewHref = homeViewPath(orgSlug, view);
    const search = viewSearch?.search ?? null;
    const isList = search !== null && !search.isDefault;
    const editHref = canManage && isList ? `${orgHref}/lists/${search.id}/edit` : null;
    const canRun = search !== null && search.isActive && hasActivePlan && view.kind !== "update";

    const { title, description } = snapshotRun
        ? { title: `Actualización del ${dateTime.format(new Date(snapshotRun.createdAt))}`, description: search?.name ?? null }
        : view.kind === "lista" || view.kind === "update"
          ? { title: search?.name ?? "", description: null }
          : VIEW_COPY[view.kind];
    const waitsForFirstRun = firstRun !== null && (view.kind === "recomendadas" || view.kind === "todas");
    const latestRun = viewSearch?.latestRun ?? null;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                        <h1 className="truncate text-2xl font-semibold">{title}</h1>
                        {search && !search.isActive ? <Badge variant="outline">Pausada</Badge> : null}
                    </div>
                    {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
                    {updatedAt && view.kind !== "update" ? (
                        <p className="text-sm text-muted-foreground">
                            Actualizado el {dateTime.format(new Date(updatedAt))}
                            {canRun && latestIngestionAt ? ` · HonduCompras sincronizado ${ingestionAge(latestIngestionAt)}` : ""}
                        </p>
                    ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {search && view.kind !== "update" ? (
                        <Button variant="ghost" asChild>
                            <Link href={`${orgHref}/updates`}>
                                <History />
                                Historial
                            </Link>
                        </Button>
                    ) : null}
                    {view.kind === "recomendadas" && canManage ? (
                        <Button variant="outline" asChild>
                            <Link href={`${orgHref}/settings/company`}>Perfil de la empresa</Link>
                        </Button>
                    ) : null}
                    {editHref ? (
                        <Button variant="outline" asChild>
                            <Link href={editHref}>Editar</Link>
                        </Button>
                    ) : null}
                    {canRun ? (
                        <RunSearchButton
                            searchId={search.id}
                            orgSlug={orgSlug}
                            disabled={latestRun !== null && isRunActive(latestRun.status)}
                        />
                    ) : null}
                </div>
            </div>

            {isList && search ? (
                <Collapsible className="group/criteria rounded-lg border">
                    <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-lg px-4 py-3 text-sm font-medium hover:bg-muted/50">
                        Criterios de la lista
                        <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]/criteria:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="border-t px-4 py-3">
                        <SearchCriteria search={search} />
                    </CollapsibleContent>
                </Collapsible>
            ) : null}

            {snapshotRun ? null : <StaleSourceNotice latestIngestionAt={latestIngestionAt} />}

            {snapshotRun ? (
                <div className="space-y-3">
                    <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                        Resultados tal como quedaron en esta actualización, incluidos los descartados y los procesos ya cerrados.{" "}
                        <Link
                            href={homeViewPath(orgSlug, search?.isDefault ? { kind: "recomendadas" } : { kind: "lista", searchId: snapshotRun.savedSearchId })}
                            className="text-primary hover:underline"
                        >
                            Ver lo más reciente
                        </Link>
                    </p>
                    <RunStatus run={snapshotRun} />
                </div>
            ) : viewSearch ? (
                <RunNotices latestRun={viewSearch.latestRun} latestFinished={viewSearch.latestFinished} />
            ) : null}

            {waitsForFirstRun ? (
                <FirstRunInProgress stale={isRunStale(firstRun)} />
            ) : (
                <Results
                    orgId={orgId}
                    orgSlug={orgSlug}
                    viewHref={viewHref}
                    rows={rows}
                    detailPool={detailPool}
                    run={snapshotRun ?? (viewSearch?.latestFinished && view.kind !== "todas" && view.kind !== "descartadas" ? viewSearch.latestFinished : null)}
                    emptyMessage={emptyMessage(view, viewSearch, editHref)}
                    params={params}
                    canDecide={canDecide}
                />
            )}
        </div>
    );
}
