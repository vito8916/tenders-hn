import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SettingsSection, SettingsSectionBody } from "@/components/settings/settings-section";
import { RefreshWhileActive } from "@/components/shared/refresh-while-active";
import { SettingsFormSkeleton } from "@/components/shared/settings-form-skeleton";
import { CurrentPlan } from "@/features/billing/components/current-plan";
import { PlanOptions } from "@/features/billing/components/plan-options";
import { UsageSummary } from "@/features/billing/components/usage-summary";
import { canManageBilling } from "@/features/billing/rbac";
import { isLiveSubscription } from "@/features/billing/schemas";
import { getBillingPageService } from "@/features/billing/services";
import { getUserOrgRoleService } from "@/features/memberships/services";
import { getOrganizationBySlugService } from "@/features/organizations/services";
import { SettingsTemplatePage } from "@/features/settings/components/settings-template-shell";
import { getCurrentUser } from "@/lib/auth/get-current-user";

type BillingSearchParams = Promise<{ activando?: string; cambio?: string }>;

async function BillingContent({ params, searchParams }: { params: Promise<{ orgSlug: string }>; searchParams: BillingSearchParams }) {
	const [{ orgSlug }, { activando, cambio }] = await Promise.all([params, searchParams]);
	const [{ sub: userId }, organization] = await Promise.all([getCurrentUser(), getOrganizationBySlugService(orgSlug)]);

	if (!organization) {
		redirect("/organizations");
	}

	const [role, { subscription, usage, plans }] = await Promise.all([
		getUserOrgRoleService({ userId, orgId: organization.id }),
		getBillingPageService(organization.id),
	]);
	if (!role) {
		redirect("/organizations");
	}

	const canManage = canManageBilling(role);
	const hasLiveSubscription = isLiveSubscription(subscription);
	// After checkout or a plan change, Paddle's webhook updates the plan within seconds.
	const waitingForPaddle =
		(activando !== undefined && !hasLiveSubscription) || (cambio !== undefined && subscription?.paddlePriceId !== cambio);

	return (
		<SettingsTemplatePage title="Facturación" description="El plan de la organización, su uso y los pagos.">
			<SettingsSection
				title="Plan actual"
				description={canManage ? undefined : "Solo el propietario de la organización puede cambiar el plan o los pagos."}
			>
				<SettingsSectionBody className="space-y-3">
					{waitingForPaddle ? (
						<p className="text-sm text-muted-foreground">
							Actualizando su plan… La página se actualiza sola en unos segundos.
							<RefreshWhileActive />
						</p>
					) : null}
					<CurrentPlan orgId={organization.id} subscription={subscription} canManage={canManage} />
				</SettingsSectionBody>
			</SettingsSection>

			<SettingsSection
				title="Planes"
				description="Precios mensuales en dólares, con impuestos incluidos. Si tiene un código de piloto, ingréselo al pagar."
			>
				<SettingsSectionBody>
					<PlanOptions
						orgId={organization.id}
						orgSlug={orgSlug}
						plans={plans}
						currentPriceId={subscription?.paddlePriceId ?? null}
						hasLiveSubscription={hasLiveSubscription}
						canManage={canManage}
					/>
				</SettingsSectionBody>
			</SettingsSection>

			<SettingsSection title="Uso" description="Lo que usa la organización frente a los límites de su plan.">
				<SettingsSectionBody className="py-0">
					<UsageSummary usage={usage} />
				</SettingsSectionBody>
			</SettingsSection>
		</SettingsTemplatePage>
	);
}

export default function BillingSettingsPage({
	params,
	searchParams,
}: {
	params: Promise<{ orgSlug: string }>;
	searchParams: BillingSearchParams;
}) {
	return (
		<Suspense fallback={<SettingsFormSkeleton sections={3} />}>
			<BillingContent params={params} searchParams={searchParams} />
		</Suspense>
	);
}
