import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { History } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getUserOrgRoleService } from "@/features/memberships/services";
import { getOrganizationBySlugService } from "@/features/organizations/services";
import { RunStatusBadge } from "@/features/search-runs/components/run-status";
import { isRunFinished, TRIGGER_LABELS } from "@/features/search-runs/schemas";
import { getRunHistoryService } from "@/features/search-runs/services";

const dateTime = new Intl.DateTimeFormat("es-HN", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Tegucigalpa" });

type HistoryParams = Promise<{ orgSlug: string }>;
type HistorySearchParams = Promise<{ pagina?: string }>;

async function HistoryContent({ params, searchParams }: { params: HistoryParams; searchParams: HistorySearchParams }) {
    const [{ orgSlug }, { pagina }] = await Promise.all([params, searchParams]);
    const [{ sub: userId }, organization] = await Promise.all([getCurrentUser(), getOrganizationBySlugService(orgSlug)]);
    if (!organization) {
        redirect("/organizations");
    }

    const role = await getUserOrgRoleService({ userId, orgId: organization.id });
    if (!role) {
        redirect("/organizations");
    }

    const requestedPage = Number.parseInt(pagina ?? "1");
    const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const { runs, historyMonths, pageCount } = await getRunHistoryService({ orgId: organization.id, page });
    const orgHref = `/organizations/${orgSlug}`;
    const historyHref = (target: number) => `${orgHref}/updates${target > 1 ? `?pagina=${target}` : ""}`;

    return (
        <>
            <p className="text-sm text-muted-foreground">
                {historyMonths === null
                    ? "Su plan conserva todo el historial."
                    : `Su plan conserva ${historyMonths} meses de historial; las actualizaciones anteriores no se muestran.`}
            </p>

            {runs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todavía no hay actualizaciones.</p>
            ) : (
                <div className="overflow-x-auto rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Actualización</TableHead>
                                <TableHead>Lista</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Datos de HonduCompras</TableHead>
                                <TableHead className="text-right">Examinados</TableHead>
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
                                            <Link href={`${orgHref}/updates/${run.id}`} className="font-medium hover:underline">
                                                {dateTime.format(new Date(run.createdAt))}
                                            </Link>
                                            <span className="block text-xs text-muted-foreground">{TRIGGER_LABELS[run.trigger]}</span>
                                        </TableCell>
                                        <TableCell>{run.search?.name ?? "—"}</TableCell>
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
                                                <a href={`${orgHref}/updates/${run.id}/csv?alcance=todos`} download className="text-primary hover:underline">
                                                    CSV
                                                </a>
                                            ) : null}
                                            {run.reportPath ? (
                                                <a href={`${orgHref}/updates/${run.id}/pdf`} className="text-primary hover:underline">
                                                    PDF
                                                </a>
                                            ) : null}
                                            {run.excelPath ? (
                                                <a href={`${orgHref}/updates/${run.id}/xlsx`} className="text-primary hover:underline">
                                                    Excel
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

export const metadata = { title: "Historial" };

/** The history (spec 0.4 §12.4): every update of Recomendadas and the lists within the plan's history, with its results and downloads. */
export default function HistoryPage({ params, searchParams }: { params: HistoryParams; searchParams: HistorySearchParams }) {
    return (
        <div className="flex w-full flex-1 flex-col gap-6 p-4 px-4 lg:p-6 lg:px-8">
            <PageHeader icon={History} title="Historial" description="Cada actualización de «Recomendadas» y de sus listas, con sus resultados y descargas." />
            <Suspense fallback={<Skeleton className="h-64 w-full max-w-5xl" />}>
                <HistoryContent params={params} searchParams={searchParams} />
            </Suspense>
        </div>
    );
}
