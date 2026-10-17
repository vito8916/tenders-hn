import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SettingsSection, SettingsSectionBody } from "@/components/settings/settings-section";
import { SettingsFormSkeleton } from "@/components/shared/settings-form-skeleton";
import { ReportScheduleForm } from "@/features/reports/components/report-schedule-form";
import { getReportSettingsService } from "@/features/reports/services";
import { SettingsTemplatePage } from "@/features/settings/components/settings-template-shell";
import { canUpdateOrganization } from "@/features/organizations/rbac";
import { getOrganizationBySlugService } from "@/features/organizations/services";
import { getUserOrgRoleService } from "@/features/memberships/services";
import { getCurrentUser } from "@/lib/auth/get-current-user";

const dateTime = new Intl.DateTimeFormat("es-HN", {
	weekday: "long",
	day: "numeric",
	month: "long",
	hour: "numeric",
	minute: "2-digit",
	timeZone: "America/Tegucigalpa",
});

async function ReportsSettingsContent({ params }: { params: Promise<{ orgSlug: string }> }) {
	const { orgSlug } = await params;
	const [{ sub: userId }, organization] = await Promise.all([getCurrentUser(), getOrganizationBySlugService(orgSlug)]);

	if (!organization) {
		redirect("/organizations");
	}

	const [role, settings] = await Promise.all([
		getUserOrgRoleService({ userId, orgId: organization.id }),
		getReportSettingsService(organization.id),
	]);
	if (!role) {
		redirect("/organizations");
	}

	const canEdit = canUpdateOrganization(role);
	const { schedule, hasActivePlan, maxDailyReports, planName } = settings;

	return (
		<SettingsTemplatePage
			title="Reportes"
			description="En cada reporte, «Recomendadas» y sus listas activas se actualizan con los datos más recientes de HonduCompras y se envía un correo con un Excel."
		>
			{hasActivePlan && schedule ? (
				<>
					<SettingsSection
						title="Horarios de los reportes"
						description={
							canEdit
								? `Su plan ${planName} permite ${maxDailyReports} reportes al día.`
								: `Su plan ${planName} permite ${maxDailyReports} reportes al día. Solo los propietarios y administradores pueden cambiarlos.`
						}
					>
						<ReportScheduleForm
							orgId={organization.id}
							orgSlug={orgSlug}
							schedule={schedule}
							maxDailyReports={maxDailyReports}
							canEdit={canEdit}
						/>
					</SettingsSection>
					{schedule.nextReportAt ? (
						<SettingsSection title="Próximo reporte">
							<SettingsSectionBody>
								<p className="text-sm first-letter:uppercase">{dateTime.format(new Date(schedule.nextReportAt))}</p>
							</SettingsSectionBody>
						</SettingsSection>
					) : null}
				</>
			) : (
				<SettingsSection title="Horarios de los reportes">
					<SettingsSectionBody>
						<p className="text-sm text-muted-foreground">
							Los reportes requieren un plan activo.{" "}
							<Link href={`/organizations/${orgSlug}/settings/billing`} className="text-primary hover:underline">
								Elegir un plan
							</Link>
						</p>
					</SettingsSectionBody>
				</SettingsSection>
			)}
		</SettingsTemplatePage>
	);
}

export const metadata = { title: "Reportes" };

export default function ReportsSettingsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
	return (
		<Suspense fallback={<SettingsFormSkeleton sections={2} />}>
			<ReportsSettingsContent params={params} />
		</Suspense>
	);
}
