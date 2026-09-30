import { Suspense } from "react";
import { redirect } from "next/navigation";

import {
	SettingsSection,
	SettingsSectionBody,
} from "@/components/settings/settings-section";
import { SettingsFormSkeleton } from "@/components/shared/settings-form-skeleton";
import { OrganizationSettingsForm } from "@/features/organizations/components/organization-settings-form";
import { OrganizationDangerZone } from "@/features/organizations/components/organization-danger-zone";
import { SettingsTemplatePage } from "@/features/settings/components/settings-template-shell";
import { canUpdateOrganization } from "@/features/organizations/rbac";
import { getOrganizationBySlugService } from "@/features/organizations/services";
import { getUserOrgRoleService } from "@/features/memberships/services";
import { getCurrentUser } from "@/lib/auth/get-current-user";

async function OrganizationSettingsContent({
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

	return (
		<SettingsTemplatePage
			title="General"
			description="Datos de la organización, logo y acciones irreversibles."
		>
			<SettingsSection
				title="General"
				description={
					canUpdateOrganization(role)
						? "Actualice el nombre, el identificador en la URL y el logo de su organización."
						: "Datos de la organización. Solo los propietarios y administradores pueden editarlos."
				}
			>
				<SettingsSectionBody className="py-0">
					{canUpdateOrganization(role) ? (
						<OrganizationSettingsForm organization={organization} />
					) : (
						<dl className="divide-y divide-border/60">
							<div className="flex items-center justify-between py-4 first:pt-0">
								<dt className="text-sm text-muted-foreground">Nombre</dt>
								<dd className="text-sm font-medium">{organization.name}</dd>
							</div>
							<div className="flex items-center justify-between py-4">
								<dt className="text-sm text-muted-foreground">Identificador en la URL</dt>
								<dd className="font-mono text-sm">{organization.slug}</dd>
							</div>
						</dl>
					)}
				</SettingsSectionBody>
			</SettingsSection>

			<OrganizationDangerZone
				orgId={organization.id}
				orgName={organization.name}
				isOwner={role === "owner"}
			/>
		</SettingsTemplatePage>
	);
}

export default function OrganizationSettingsPage({
	params,
}: {
	params: Promise<{ orgSlug: string }>;
}) {
	return (
		<Suspense fallback={<SettingsFormSkeleton sections={2} />}>
			<OrganizationSettingsContent params={params} />
		</Suspense>
	);
}
