import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChartBar, Plus } from "lucide-react";
import { OverviewCards } from "@/features/organizations/components/overview-cards";
import { RecentActivity } from "@/features/events/components/recent-activity";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import {
	getOrganizationBySlugService,
	getOrganizationOverviewService,
} from "@/features/organizations/services";
import { getUserOrgRoleService } from "@/features/memberships/services";
import { canViewSettings } from "@/features/organizations/rbac";
import { listRecentEventsService } from "@/features/events/services";

export default async function HomePage({ params }: { params: Promise<{ orgSlug: string }> }) {
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
	const [{ projectsCount, membersCount, pendingInvitationsCount }, recentEvents] = await Promise.all([
		getOrganizationOverviewService({ orgId: organization.id, userId }),
		isAdmin
			? listRecentEventsService({ orgId: organization.id, userId, limit: 10 })
			: Promise.resolve(null),
	]);

	return (
		<div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<div className="flex size-10 items-center justify-center rounded-lg border bg-background">
						<ChartBar className="size-5" />
					</div>
					<div>
						<h1 className="text-2xl font-semibold">Dashboard</h1>
						<p className="text-sm text-muted-foreground">Overview of {organization.name}.</p>
					</div>
				</div>
				<Button asChild className="font-bold">
					<Link href={`/organizations/${orgSlug}/projects`}>
						<Plus className="size-5" />
						Add Project
					</Link>
				</Button>
			</div>

			<OverviewCards
				orgSlug={orgSlug}
				projectsCount={projectsCount}
				membersCount={membersCount}
				pendingInvitationsCount={pendingInvitationsCount}
			/>

			{recentEvents ? <RecentActivity events={recentEvents} /> : null}
		</div>
	);
}
