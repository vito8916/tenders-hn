import { Suspense } from "react";
import { redirect } from "next/navigation";

import { SettingsFormSkeleton } from "@/components/shared/settings-form-skeleton";
import { AuditLogList } from "@/features/events/components/audit-log-list";
import { listAuditLogPageService } from "@/features/events/services";
import { auditLogQuerySchema } from "@/features/events/schemas";
import { getOrganizationBySlugService } from "@/features/organizations/services";
import { canViewSettings } from "@/features/organizations/rbac";
import { getUserOrgRoleService } from "@/features/memberships/services";
import { SettingsTemplatePage } from "@/features/settings/components/settings-template-shell";
import { getCurrentUser } from "@/lib/auth/get-current-user";

async function AuditLogSettingsContent({
	params,
	searchParams,
}: {
	params: Promise<{ orgSlug: string }>;
	searchParams: Promise<{ page?: string; event?: string }>;
}) {
	const { orgSlug } = await params;
	const rawSearchParams = await searchParams;

	const parsedQuery = auditLogQuerySchema.safeParse({
		page: rawSearchParams.page ?? "1",
		event: rawSearchParams.event,
	});
	const query = parsedQuery.success
		? parsedQuery.data
		: auditLogQuerySchema.parse({ page: rawSearchParams.page ?? "1" });

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

	const data = await listAuditLogPageService({
		orgId: organization.id,
		userId,
		query,
	});

	return (
		<SettingsTemplatePage
			title="Audit log"
			description="Track changes and activity across your organization."
		>
			<AuditLogList orgSlug={orgSlug} data={data} />
		</SettingsTemplatePage>
	);
}

export default function AuditLogSettingsPage({
	params,
	searchParams,
}: {
	params: Promise<{ orgSlug: string }>;
	searchParams: Promise<{ page?: string; event?: string }>;
}) {
	return (
		<Suspense fallback={<SettingsFormSkeleton sections={1} />}>
			<AuditLogSettingsContent params={params} searchParams={searchParams} />
		</Suspense>
	);
}
