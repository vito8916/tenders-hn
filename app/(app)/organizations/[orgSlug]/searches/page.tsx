import { Suspense } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/shared/page-header";
import { PageSectionSkeleton } from "@/components/shared/page-section-skeleton";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getOrganizationBySlugService } from "@/features/organizations/services";
import { getUserOrgRoleService } from "@/features/memberships/services";
import { canManageSearches } from "@/features/saved-searches/rbac";
import { getSearchLimitsService, listSavedSearchesService } from "@/features/saved-searches/services";
import { SavedSearchList } from "@/features/saved-searches/components/saved-search-list";
import { listLatestRunsService } from "@/features/search-runs/services";

async function SearchesContent({ params }: { params: Promise<{ orgSlug: string }> }) {
    const { orgSlug } = await params;
    const [{ sub: userId }, organization] = await Promise.all([getCurrentUser(), getOrganizationBySlugService(orgSlug)]);

    if (!organization) {
        redirect("/organizations");
    }

    const [role, searches, latestRuns, limits] = await Promise.all([
        getUserOrgRoleService({ userId, orgId: organization.id }),
        listSavedSearchesService(organization.id),
        listLatestRunsService(organization.id),
        getSearchLimitsService(organization.id),
    ]);
    if (!role) {
        redirect("/organizations");
    }

    const canManage = canManageSearches(role);
    const underLimit = limits.maxActiveSearches === null || limits.activeSearches < limits.maxActiveSearches;
    const newSearchHref = `/organizations/${orgSlug}/searches/new`;

    return (
        <div className="max-w-4xl space-y-4">
            {limits.hasActivePlan ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">
                        {limits.maxActiveSearches === null
                            ? `${limits.activeSearches} búsquedas activas`
                            : `${limits.activeSearches} de ${limits.maxActiveSearches} búsquedas activas en su plan`}
                    </p>
                    {canManage && searches.length > 0 ? (
                        underLimit ? (
                            <Button asChild>
                                <Link href={newSearchHref}>Nueva búsqueda</Link>
                            </Button>
                        ) : (
                            <p className="text-sm text-muted-foreground">Pause una búsqueda para crear otra.</p>
                        )
                    ) : null}
                </div>
            ) : (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    La organización no tiene un plan activo: puede consultar sus búsquedas, pero no crearlas ni ejecutarlas.
                </p>
            )}

            {searches.length > 0 ? (
                <SavedSearchList orgSlug={orgSlug} searches={searches} latestRuns={latestRuns} canRun={limits.hasActivePlan} />
            ) : (
                <Empty className="border">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <Search />
                        </EmptyMedia>
                        <EmptyTitle>Todavía no hay búsquedas</EmptyTitle>
                        <EmptyDescription>
                            Una búsqueda revisa los procesos abiertos de HonduCompras con lo que vende su empresa y le avisa de los que le
                            interesan.
                        </EmptyDescription>
                    </EmptyHeader>
                    {canManage && limits.hasActivePlan ? (
                        <EmptyContent>
                            <Button asChild>
                                <Link href={newSearchHref}>Crear la primera búsqueda</Link>
                            </Button>
                        </EmptyContent>
                    ) : null}
                </Empty>
            )}
        </div>
    );
}

export default function SearchesPage({ params }: { params: Promise<{ orgSlug: string }> }) {
    return (
        <div className="flex flex-1 flex-col gap-6 p-4 px-4 lg:p-6 lg:px-8">
            <PageHeader icon={Search} title="Búsquedas" description="Lo que su organización busca en HonduCompras y cuándo lo revisa." />
            <Suspense fallback={<PageSectionSkeleton cards={1} />}>
                <SearchesContent params={params} />
            </Suspense>
        </div>
    );
}
