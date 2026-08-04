import { Suspense } from "react";
import { redirect } from "next/navigation";

import { SettingsFormSkeleton } from "@/components/shared/settings-form-skeleton";
import { AuditLogList } from "@/features/events/components/audit-log-list";
import { listAuditLogService } from "@/features/events/services";
import { getOrganizationBySlugService } from "@/features/organizations/services";
import { canViewSettings } from "@/features/organizations/rbac";
import { getUserOrgRoleService } from "@/features/memberships/services";
import { SettingsTemplatePage } from "@/features/settings/components/settings-template-shell";
import { getCurrentUser } from "@/lib/auth/get-current-user";

async function AuditLogSettingsContent({
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

	if (!canViewSettings(role)) {
		redirect(`/organizations/${orgSlug}/settings/account`);
	}

	const events = await listAuditLogService({
		orgId: organization.id,
		userId,
		limit: 50,
	});

	return (
		<SettingsTemplatePage
			title="Audit log"
			description="Track changes and activity across your organization."
		>
			<AuditLogList events={events} />
		</SettingsTemplatePage>
	);
}

export default function AuditLogSettingsPage({
	params,
}: {
	params: Promise<{ orgSlug: string }>;
}) {
	return (
		<Suspense fallback={<SettingsFormSkeleton sections={1} />}>
			<AuditLogSettingsContent params={params} />
		</Suspense>
	);
}
