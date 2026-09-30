import { Suspense } from "react";
import { redirect } from "next/navigation";

import { SettingsSection, SettingsSectionBody } from "@/components/settings/settings-section";
import { SettingsFormSkeleton } from "@/components/shared/settings-form-skeleton";
import { CompanyProfileForm } from "@/features/company-profile/components/company-profile-form";
import { CompanyProfileSummary } from "@/features/company-profile/components/company-profile-summary";
import { getCompanyProfileService, getImprovementsRemainingService } from "@/features/company-profile/services";
import { SettingsTemplatePage } from "@/features/settings/components/settings-template-shell";
import { canUpdateOrganization } from "@/features/organizations/rbac";
import { getOrganizationBySlugService } from "@/features/organizations/services";
import { getUserOrgRoleService } from "@/features/memberships/services";
import { getCurrentUser } from "@/lib/auth/get-current-user";

async function CompanyProfileSettingsContent({ params }: { params: Promise<{ orgSlug: string }> }) {
	const { orgSlug } = await params;
	const [{ sub: userId }, organization] = await Promise.all([getCurrentUser(), getOrganizationBySlugService(orgSlug)]);

	if (!organization) {
		redirect("/organizations");
	}

	const [role, profile, improvementsRemaining] = await Promise.all([
		getUserOrgRoleService({ userId, orgId: organization.id }),
		getCompanyProfileService(organization.id),
		getImprovementsRemainingService(),
	]);
	if (!role) {
		redirect("/organizations");
	}

	const canEdit = canUpdateOrganization(role);

	return (
		<SettingsTemplatePage
			title="Perfil de la empresa"
			description="Lo que vende la empresa. Con este perfil se buscan y se ordenan las oportunidades."
		>
			<SettingsSection
				title="Perfil de la empresa"
				description={
					canEdit
						? "Cuanto más concreto, mejores resultados. Los cambios se aplican en la próxima búsqueda."
						: "Solo los propietarios y administradores pueden editarlo."
				}
			>
				{canEdit ? (
					<CompanyProfileForm
						orgId={organization.id}
						orgSlug={orgSlug}
						profile={profile}
						improvementsRemaining={improvementsRemaining}
					/>
				) : (
					<SettingsSectionBody>
						{profile ? (
							<CompanyProfileSummary profile={profile} />
						) : (
							<p className="text-sm text-muted-foreground">La organización todavía no tiene un perfil.</p>
						)}
					</SettingsSectionBody>
				)}
			</SettingsSection>
		</SettingsTemplatePage>
	);
}

export default function CompanyProfileSettingsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
	return (
		<Suspense fallback={<SettingsFormSkeleton sections={1} />}>
			<CompanyProfileSettingsContent params={params} />
		</Suspense>
	);
}
