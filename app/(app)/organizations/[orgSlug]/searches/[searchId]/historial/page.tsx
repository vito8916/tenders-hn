import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getUserOrgRoleService } from "@/features/memberships/services";
import { getOrganizationBySlugService } from "@/features/organizations/services";
import { getSavedSearchService } from "@/features/saved-searches/services";
import { RunStatusBadge } from "@/features/search-runs/components/run-status";
import { isRunFinished, TRIGGER_LABELS } from "@/features/search-runs/schemas";
import { getRunHistoryService } from "@/features/search-runs/services";

const dateTime = new Intl.DateTimeFormat("es-HN", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Tegucigalpa" });

type HistoryParams = Promise<{ orgSlug: string; searchId: string }>;
type HistorySearchParams = Promise<{ pagina?: string }>;

async function HistoryContent({ params, searchParams }: { params: HistoryParams; searchParams: HistorySearchParams }) {
    const [{ orgSlug, searchId }, { pagina }] = await Promise.all([params, searchParams]);
    const [{ sub: userId }, organization] = await Promise.all([getCurrentUser(), getOrganizationBySlugService(orgSlug)]);
    if (!organization) {
        redirect("/organizations");
    }

    const [role, search] = await Promise.all([
        getUserOrgRoleService({ userId, orgId: organization.id }),
        getSavedSearchService({ orgId: organization.id, searchId }),
    ]);
    if (!role) {
        redirect("/organizations");
    }
    if (!search) {
        notFound();
    }

    const requestedPage = Number.parseInt(pagina ?? "1");
    const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const { runs, historyMonths, pageCount } = await getRunHistoryService({ orgId: organization.id, searchId, page });
    const homeHref = `/organizations/${orgSlug}`;
    const historyHref = (target: number) => `${homeHref}/searches/${searchId}/historial${target > 1 ? `?pagina=${target}` : ""}`;

    return (
        <>
            <div className="space-y-2">
                <Button variant="ghost" size="sm" asChild className="-ml-2">
                    <Link href={`${homeHref}?busqueda=${searchId}`}>
                        <ChevronLeft />
                        {search.name}
                    </Link>
                </Button>
                <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-background">
                        <History className="size-5" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-semibold">Historial de ejecuciones</h1>
                        <p className="text-sm text-muted-foreground">
                            {historyMonths === null
                                ? "Su plan conserva todo el historial."
                                : `Su plan conserva ${historyMonths} meses de historial; las ejecuciones anteriores no se muestran.`}
                        </p>
                    </div>
                </div>
            </div>

            {runs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Esta búsqueda todavía no se ha ejecutado.</p>
            ) : (
                <div className="overflow-hidden rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Ejecución</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Datos de HonduCompras</TableHead>
                                <TableHead className="text-right">Procesos examinados</TableHead>
                                <TableHead className="text-right">Relevantes</TableHead>
                                <TableHead className="text-right">Nuevas</TableHead>
                                <TableHead>Descargas</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {runs.map((run) => {
                                const finished = isRunFinished(run.status);
                                return (
                                    <TableRow key={run.id}>
                                        <TableCell>
                                            <Link href={`${homeHref}?busqueda=${searchId}&ejecucion=${run.id}`} className="font-medium hover:underline">
                                                {dateTime.format(new Date(run.createdAt))}
                                            </Link>
                                            <span className="block text-xs text-muted-foreground">{TRIGGER_LABELS[run.trigger]}</span>
                                        </TableCell>
                                        <TableCell>
                                            <RunStatusBadge status={run.status} />
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {run.sourceSyncedAt ? dateTime.format(new Date(run.sourceSyncedAt)) : "—"}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">{run.processesExamined ?? "—"}</TableCell>
                                        <TableCell className="text-right tabular-nums">{finished ? (run.matchesCount ?? 0) : "—"}</TableCell>
                                        <TableCell className="text-right tabular-nums">{finished ? (run.newMatchesCount ?? "—") : "—"}</TableCell>
                                        <TableCell className="space-x-3 text-sm">
                                            {finished ? (
                                                <a href={`${homeHref}/runs/${run.id}/csv?alcance=todos`} download className="text-primary hover:underline">
                                                    CSV
                                                </a>
                                            ) : null}
                                            {run.reportPath ? (
                                                <a href={`${homeHref}/runs/${run.id}/pdf`} className="text-primary hover:underline">
                                                    PDF
                                                </a>
                                            ) : null}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}

            {pageCount > 1 ? (
                <nav aria-label="Páginas del historial" className="flex items-center justify-between gap-2 text-sm">
                    <Button variant="outline" size="sm" asChild className={page <= 1 ? "pointer-events-none opacity-50" : undefined}>
                        <Link href={historyHref(page - 1)}>Anterior</Link>
                    </Button>
                    <span className="text-muted-foreground">
                        Página {Math.min(page, pageCount)} de {pageCount}
                    </span>
                    <Button variant="outline" size="sm" asChild className={page >= pageCount ? "pointer-events-none opacity-50" : undefined}>
                        <Link href={historyHref(page + 1)}>Siguiente</Link>
                    </Button>
                </nav>
            ) : null}
        </>
    );
}

export const metadata = { title: "Historial de ejecuciones" };

/** «Historial completo» (spec §12.4): every run of a search within the plan's history, with its results and downloads. */
export default function RunHistoryPage({ params, searchParams }: { params: HistoryParams; searchParams: HistorySearchParams }) {
    return (
        <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
            <Suspense fallback={<Skeleton className="h-64 w-full max-w-5xl" />}>
                <HistoryContent params={params} searchParams={searchParams} />
            </Suspense>
        </div>
    );
}
