import { Suspense } from "react";
import { ChartBar } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { OrgName } from "@/components/shared/org-name";
import { PageSectionSkeleton } from "@/components/shared/page-section-skeleton";
import { OverviewCards } from "@/features/organizations/components/overview-cards";
import { RecentActivity } from "@/features/events/components/recent-activity";
import { ProjectSheet } from "@/features/projects/components/project-sheet";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import {
	getOrganizationBySlugService,
	getOrganizationOverviewService,
} from "@/features/organizations/services";
import { getUserOrgRoleService } from "@/features/memberships/services";
import { canViewSettings } from "@/features/organizations/rbac";
import { listRecentEventsService } from "@/features/events/services";
import { redirect } from "next/navigation";

async function DashboardContent({
	params,
}: {
	params: Promise<{ orgSlug: string }>;
}) {
	const { orgSlug } = await params;
	const [{ sub: userId }, organization] = await Promise.all([
		getCurrentUser(),
		getOrganizationBySlugService(orgSlug),
	]);

	if (!organization) {
		redirect("/organizations");
	}

	const role = await getUserOrgRoleService({ userId, orgId: organization.id });
	if (!role) {
		redirect("/organizations");
	}

	const isAdmin = canViewSettings(role);
	const [{ projectsCount, membersCount, pendingInvitationsCount }, recentEvents] =
		await Promise.all([
			getOrganizationOverviewService({ orgId: organization.id, userId }),
			isAdmin
				? listRecentEventsService({ orgId: organization.id, userId, limit: 10 })
				: Promise.resolve(null),
		]);

	return (
		<>
			<OverviewCards
				orgSlug={orgSlug}
				projectsCount={projectsCount}
				membersCount={membersCount}
				pendingInvitationsCount={pendingInvitationsCount}
			/>
			{recentEvents ? <RecentActivity events={recentEvents} /> : null}
		</>
	);
}

export default function HomePage({
	params,
}: {
	params: Promise<{ orgSlug: string }>;
}) {
	return (
		<div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
			<PageHeader
				icon={ChartBar}
				title="Dashboard"
				description={
					<>
						Overview of <OrgName />.
					</>
				}
				action={<ProjectSheet />}
			/>
			<Suspense fallback={<PageSectionSkeleton cards={3} />}>
				<DashboardContent params={params} />
			</Suspense>
		</div>
	);
}
