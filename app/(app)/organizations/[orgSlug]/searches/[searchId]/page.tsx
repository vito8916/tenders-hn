import { Suspense } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getOrganizationBySlugService } from "@/features/organizations/services";
import { getUserOrgRoleService } from "@/features/memberships/services";
import { canManageSearches } from "@/features/saved-searches/rbac";
import { getSavedSearchService, getSearchLimitsService } from "@/features/saved-searches/services";
import { SearchCriteria } from "@/features/saved-searches/components/search-criteria";
import { getSearchResultsService } from "@/features/search-runs/services";
import { isRunActive, type SearchRun } from "@/features/search-runs/schemas";
import { RunSearchButton } from "@/features/search-runs/components/run-search-button";
import { RunStatus } from "@/features/search-runs/components/run-status";
import { MatchList } from "@/features/search-runs/components/match-list";

const dateTime = new Intl.DateTimeFormat("es-HN", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Tegucigalpa" });
const relativeTime = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

/** "hace 2 horas": how old the data a new run would use is (spec §12.1). */
function ingestionAge(finishedAt: string) {
    const minutes = Math.round((new Date(finishedAt).getTime() - Date.now()) / 60_000);
    return Math.abs(minutes) < 90 ? relativeTime.format(minutes, "minute") : relativeTime.format(Math.round(minutes / 60), "hour");
}

function Results({ latestRun, shownRun, matchCount }: { latestRun: SearchRun | null; shownRun: SearchRun | null; matchCount: number }) {
    if (!shownRun) {
        return latestRun ? null : <p className="text-sm text-muted-foreground">Esta búsqueda todavía no se ha ejecutado.</p>;
    }
    if (matchCount === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                La ejecución del {dateTime.format(new Date(shownRun.createdAt))} examinó {shownRun.processesExamined ?? 0} procesos abiertos y no
                encontró candidatos. Pruebe con otros términos o menos filtros.
            </p>
        );
    }
    return shownRun.id === latestRun?.id ? null : (
        <p className="text-sm text-muted-foreground">
            Se muestran los resultados de la ejecución del {dateTime.format(new Date(shownRun.createdAt))}.
        </p>
    );
}

async function SearchContent({ params }: { params: Promise<{ orgSlug: string; searchId: string }> }) {
    const { orgSlug, searchId } = await params;
    const [{ sub: userId }, organization] = await Promise.all([getCurrentUser(), getOrganizationBySlugService(orgSlug)]);

    if (!organization) {
        redirect("/organizations");
    }

    const [role, search, limits] = await Promise.all([
        getUserOrgRoleService({ userId, orgId: organization.id }),
        getSavedSearchService({ orgId: organization.id, searchId }),
        getSearchLimitsService(organization.id),
    ]);
    if (!role) {
        redirect("/organizations");
    }
    if (!search) {
        notFound();
    }

    const { latestRun, shownRun, matches, latestIngestionAt } = await getSearchResultsService(search.id);
    const runActive = latestRun !== null && isRunActive(latestRun.status);

    return (
        <>
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-background">
                        <Search className="size-5" />
                    </div>
                    <h1 className="text-2xl font-semibold">{search.name}</h1>
                    {search.isActive ? null : <Badge variant="outline">Pausada</Badge>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {canManageSearches(role) ? (
                        <Button variant="outline" asChild>
                            <Link href={`/organizations/${orgSlug}/searches/${search.id}/edit`}>Editar</Link>
                        </Button>
                    ) : null}
                    {search.isActive && limits.hasActivePlan ? (
                        <RunSearchButton searchId={search.id} orgSlug={orgSlug} disabled={runActive} />
                    ) : null}
                </div>
            </div>

            <section className="max-w-3xl space-y-3 rounded-lg border p-4">
                <SearchCriteria search={search} />
                {latestIngestionAt ? (
                    <p className="text-sm text-muted-foreground">
                        «Ejecutar ahora» usa la última sincronización completa con HonduCompras, terminada {ingestionAge(latestIngestionAt)}.
                    </p>
                ) : null}
            </section>

            {latestRun ? <RunStatus run={latestRun} /> : null}
            <Results latestRun={latestRun} shownRun={shownRun} matchCount={matches.length} />
            {matches.length > 0 ? <MatchList matches={matches} /> : null}
        </>
    );
}

export default function SearchPage({ params }: { params: Promise<{ orgSlug: string; searchId: string }> }) {
    return (
        <div className="flex flex-1 flex-col gap-6 p-4 px-4 lg:p-6 lg:px-8">
            <Suspense fallback={<Skeleton className="h-64 w-full max-w-3xl" />}>
                <SearchContent params={params} />
            </Suspense>
        </div>
    );
}
