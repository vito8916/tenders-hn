import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getOrganizationBySlugService } from "@/features/organizations/services";
import { getUserOrgRoleService } from "@/features/memberships/services";
import { canInviteMembers } from "@/features/organizations/rbac";
import { getSeatsUsedService } from "@/features/billing/services";
import { InviteTeamBanner } from "@/features/invitations/components/invite-team-banner";
import { canManageSearches } from "@/features/saved-searches/rbac";
import { canDecideOpportunity } from "@/features/opportunities/rbac";
import { getSearchLimitsService } from "@/features/saved-searches/services";
import { homeViewPath, type HomeView } from "../opportunities";
import { withParams, type SearchParamsRecord } from "../results";
import { isRunActive } from "../schemas";
import { getHomeService, homeViewRows } from "../services";
import { OpportunitiesPane } from "./opportunities-pane";
import { OpportunitiesSheet } from "./opportunities-sheet";
import { OpportunitiesWorkspace } from "./opportunities-workspace";

function OpportunitiesSkeleton({ withPane }: { withPane: boolean }) {
	return (
		<div className="flex flex-1">
			{withPane ? (
				<div className="hidden w-64 shrink-0 space-y-2 border-r p-4 lg:block">
					<Skeleton className="h-8 w-full" />
					<Skeleton className="h-12 w-full" />
					<Skeleton className="h-12 w-full" />
				</div>
			) : null}
			<div className="flex-1 space-y-4 p-4 lg:p-6">
				<Skeleton className="h-9 w-64" />
				<Skeleton className="h-16 w-full max-w-3xl" />
				<Skeleton className="h-64 w-full max-w-3xl" />
			</div>
		</div>
	);
}

type ViewKind = HomeView["kind"];
type ViewParams = Promise<{ orgSlug: string; listId?: string; runId?: string }>;

function viewOf(kind: ViewKind, { listId, runId }: { listId?: string; runId?: string }): HomeView {
	if (kind === "lista") return { kind, searchId: listId ?? "" };
	if (kind === "update") return { kind, runId: runId ?? "" };
	return { kind };
}

async function OpportunitiesContent({ kind, params, searchParams }: { kind: ViewKind; params: ViewParams; searchParams: Promise<SearchParamsRecord> }) {
	const [{ orgSlug, ...ids }, query] = await Promise.all([params, searchParams]);

	const [{ sub: userId }, organization] = await Promise.all([getCurrentUser(), getOrganizationBySlugService(orgSlug)]);
	if (!organization) {
		redirect("/organizations");
	}

	const [role, limits, home, seatsUsed] = await Promise.all([
		getUserOrgRoleService({ userId, orgId: organization.id }),
		getSearchLimitsService(organization.id),
		getHomeService({ orgId: organization.id, view: viewOf(kind, ids) }),
		getSeatsUsedService(organization.id),
	]);
	if (!role) {
		redirect("/organizations");
	}
	if (!home) {
		notFound();
	}
	// The default search's list is Recomendadas, which has its own page.
	if (kind === "lista" && home.view.kind === "recomendadas") {
		const kept = withParams(query, {});
		redirect(`${homeViewPath(orgSlug, home.view)}${kept === "?" ? "" : kept}`);
	}

	const { view, items, defaultItem, viewItem, opportunities, snapshot } = home;
	const canManage = canManageSearches(role);
	const underLimit = limits.maxActiveSearches === null || limits.activeSearches < limits.maxActiveSearches;
	// A single seat means no other member and no pending invitation.
	const showInviteBanner = canInviteMembers(role) && seatsUsed === 1;
	const rows = homeViewRows(home);
	const aggregate = view.kind === "todas" || view.kind === "descartadas";
	const updatedAt = aggregate
		? (items
				.filter((item) => item.search.isActive)
				.map((item) => item.latestFinished?.completedAt ?? null)
				.filter((date) => date !== null)
				.sort()
				.at(-1) ?? null)
		: (viewItem?.latestFinished?.completedAt ?? null);
	const firstRun =
		defaultItem && !defaultItem.latestFinished && defaultItem.latestRun && isRunActive(defaultItem.latestRun.status) ? defaultItem.latestRun : null;

	// An update is a record of the history, not a live view: it opens without the opportunities pane.
	if (view.kind === "update") {
		return (
			<div className="flex w-full flex-1 flex-col gap-4 p-4 px-4 lg:p-6 lg:px-8">
				<Button variant="ghost" size="sm" asChild className="-ml-2 self-start">
					<Link href={`/organizations/${orgSlug}/updates`}>
						<ChevronLeft />
						Historial
					</Link>
				</Button>
				<OpportunitiesWorkspace
					orgId={organization.id}
					orgSlug={orgSlug}
					view={view}
					viewSearch={viewItem}
					rows={rows}
					detailPool={rows}
					snapshotRun={snapshot?.run ?? null}
					updatedAt={updatedAt}
					firstRun={firstRun}
					params={query}
					latestIngestionAt={home.latestIngestionAt}
					canManage={canManage}
					canDecide={canDecideOpportunity(role)}
					hasActivePlan={limits.hasActivePlan}
				/>
			</div>
		);
	}

	const current = view.kind === "lista" ? view.searchId : view.kind;

	const pane = (
		<OpportunitiesPane
			orgSlug={orgSlug}
			current={current}
			counts={{ recomendadas: opportunities.recomendadas.length, todas: opportunities.todas.length }}
			lists={items
				.filter((item) => !item.search.isDefault)
				.map(({ search, latestFinished }) => ({
					id: search.id,
					name: search.name,
					isActive: search.isActive,
					newMatches: latestFinished?.newMatchesCount ?? 0,
				}))}
			canCreate={canManage && limits.hasActivePlan && underLimit}
		/>
	);

	return (
		<div className="flex flex-1">
			<aside className="hidden w-64 shrink-0 border-r lg:block">
				<div className="sticky top-0 max-h-svh overflow-y-auto">{pane}</div>
			</aside>
			<div className="min-w-0 flex-1 space-y-4 p-4 lg:p-6">
				<div className="lg:hidden">
					<OpportunitiesSheet>{pane}</OpportunitiesSheet>
				</div>
				{showInviteBanner ? <InviteTeamBanner orgId={organization.id} orgSlug={orgSlug} /> : null}
				<OpportunitiesWorkspace
					orgId={organization.id}
					orgSlug={orgSlug}
					view={view}
					viewSearch={viewItem}
					rows={rows}
					detailPool={[...rows, ...opportunities.todas, ...opportunities.descartadas]}
					snapshotRun={snapshot?.run ?? null}
					updatedAt={updatedAt}
					firstRun={firstRun}
					params={query}
					latestIngestionAt={home.latestIngestionAt}
					canManage={canManage}
					canDecide={canDecideOpportunity(role)}
					hasActivePlan={limits.hasActivePlan}
				/>
			</div>
		</div>
	);
}


/**
 * An opportunities page (plan D7, spec 0.4 §12.1): the views and lists on the left, the view's opportunities on
 * the right. The Home (Recomendadas), Todas, Descartadas, each list, and each update render it with their view.
 */
export function OpportunitiesPage({ kind, params, searchParams }: { kind: ViewKind; params: ViewParams; searchParams: Promise<SearchParamsRecord> }) {
	return (
		<Suspense fallback={<OpportunitiesSkeleton withPane={kind !== "update"} />}>
			<OpportunitiesContent kind={kind} params={params} searchParams={searchParams} />
		</Suspense>
	);
}
