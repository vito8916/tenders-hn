import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getOrganizationBySlugService } from "@/features/organizations/services";
import { getUserOrgRoleService } from "@/features/memberships/services";
import { canManageSearches } from "@/features/saved-searches/rbac";
import { getSearchLimitsService } from "@/features/saved-searches/services";
import { getHomeService } from "@/features/search-runs/services";
import { SearchesPane } from "@/features/search-runs/components/searches-pane";
import { SearchesSheet } from "@/features/search-runs/components/searches-sheet";
import { SearchWorkspace } from "@/features/search-runs/components/search-workspace";
import type { SearchParamsRecord } from "@/features/search-runs/results";

// busqueda and ejecucion select the search and run; the rest is the results table's view (features/search-runs/results.ts).
type HomeSearchParams = Promise<SearchParamsRecord>;

function NoSearches({ newSearchHref }: { newSearchHref: string | null }) {
	return (
		<Empty className="border">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<Search />
				</EmptyMedia>
				<EmptyTitle>Todavía no hay búsquedas</EmptyTitle>
				<EmptyDescription>
					Una búsqueda revisa los procesos abiertos de HonduCompras con lo que vende su empresa y le muestra los que le
					interesan.
				</EmptyDescription>
			</EmptyHeader>
			{newSearchHref ? (
				<EmptyContent>
					<Button asChild>
						<Link href={newSearchHref}>Crear la primera búsqueda</Link>
					</Button>
				</EmptyContent>
			) : null}
		</Empty>
	);
}

async function HomeContent({
	params,
	searchParams,
}: {
	params: Promise<{ orgSlug: string }>;
	searchParams: HomeSearchParams;
}) {
	const [{ orgSlug }, query] = await Promise.all([params, searchParams]);
	const busqueda = typeof query.busqueda === "string" ? query.busqueda : undefined;
	const ejecucion = typeof query.ejecucion === "string" ? query.ejecucion : undefined;
	const [{ sub: userId }, organization] = await Promise.all([getCurrentUser(), getOrganizationBySlugService(orgSlug)]);

	if (!organization) {
		redirect("/organizations");
	}

	const [role, limits, home] = await Promise.all([
		getUserOrgRoleService({ userId, orgId: organization.id }),
		getSearchLimitsService(organization.id),
		getHomeService({ orgId: organization.id, searchId: busqueda ?? null, runId: ejecucion ?? null }),
	]);
	if (!role) {
		redirect("/organizations");
	}

	const canManage = canManageSearches(role);
	const underLimit = limits.maxActiveSearches === null || limits.activeSearches < limits.maxActiveSearches;
	const canCreate = canManage && limits.hasActivePlan && underLimit;
	const { selected } = home;

	const pane = (
		<SearchesPane
			orgSlug={orgSlug}
			items={home.items}
			selectedSearchId={selected?.search.id ?? null}
			recentRuns={selected?.recentRuns ?? []}
			shownRunId={selected?.shownRun?.id ?? null}
			canCreate={canCreate}
		/>
	);

	return (
		<div className="flex flex-1">
			<aside className="hidden w-72 shrink-0 border-r lg:block">
				<div className="sticky top-0 max-h-svh overflow-y-auto">{pane}</div>
			</aside>
			<div className="min-w-0 flex-1 space-y-4 p-4 lg:p-6">
				<div className="lg:hidden">
					<SearchesSheet>{pane}</SearchesSheet>
				</div>
				{!limits.hasActivePlan ? (
					<p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
						La organización no tiene un plan activo: puede consultar sus búsquedas y resultados, pero no crear ni ejecutar búsquedas.{" "}
						<Link href={`/organizations/${orgSlug}/settings/billing`} className="text-primary hover:underline">
							Ver planes
						</Link>
					</p>
				) : null}
				{selected ? (
					<SearchWorkspace
						orgSlug={orgSlug}
						search={selected.search}
						latestRun={selected.latestRun}
						shownRun={selected.shownRun}
						latestFinished={selected.latestFinished}
						matches={selected.matches}
						params={query}
						latestIngestionAt={home.latestIngestionAt}
						canManage={canManage}
						hasActivePlan={limits.hasActivePlan}
					/>
				) : (
					<NoSearches newSearchHref={canCreate ? `/organizations/${orgSlug}/searches/new` : null} />
				)}
			</div>
		</div>
	);
}

function HomeSkeleton() {
	return (
		<div className="flex flex-1">
			<div className="hidden w-72 shrink-0 space-y-2 border-r p-4 lg:block">
				<Skeleton className="h-8 w-full" />
				<Skeleton className="h-12 w-full" />
				<Skeleton className="h-12 w-full" />
			</div>
			<div className="flex-1 space-y-4 p-4 lg:p-6">
				<Skeleton className="h-9 w-64" />
				<Skeleton className="h-16 w-full max-w-3xl" />
				<Skeleton className="h-64 w-full max-w-3xl" />
			</div>
		</div>
	);
}

/** The Home (spec §12.1): saved searches on the left, the selected search and run on the right. */
export default function HomePage({
	params,
	searchParams,
}: {
	params: Promise<{ orgSlug: string }>;
	searchParams: HomeSearchParams;
}) {
	return (
		<Suspense fallback={<HomeSkeleton />}>
			<HomeContent params={params} searchParams={searchParams} />
		</Suspense>
	);
}
