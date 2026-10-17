import { Suspense } from "react";
import { List } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsSection, SettingsSectionBody } from "@/components/settings/settings-section";
import { SettingsFormSkeleton } from "@/components/shared/settings-form-skeleton";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getOrganizationBySlugService } from "@/features/organizations/services";
import { getUserOrgRoleService } from "@/features/memberships/services";
import { getCompanyProfileService } from "@/features/company-profile/services";
import { canManageSearches } from "@/features/saved-searches/rbac";
import { getSavedSearchService, getSearchLimitsService, listFilterOptionsService } from "@/features/saved-searches/services";
import { SavedSearchForm } from "@/features/saved-searches/components/saved-search-form";
import { SearchStateActions } from "@/features/saved-searches/components/search-state-actions";

async function EditSearchContent({ params }: { params: Promise<{ orgSlug: string; listId: string }> }) {
    const { orgSlug, listId: searchId } = await params;
    const [{ sub: userId }, organization] = await Promise.all([getCurrentUser(), getOrganizationBySlugService(orgSlug)]);

    if (!organization) {
        redirect("/organizations");
    }

    const [role, search, limits, filterOptions, profile] = await Promise.all([
        getUserOrgRoleService({ userId, orgId: organization.id }),
        getSavedSearchService({ orgId: organization.id, searchId }),
        getSearchLimitsService(organization.id),
        listFilterOptionsService(),
        getCompanyProfileService(organization.id),
    ]);
    // Recomendadas follows the company profile, edited in Configuración › Perfil de la empresa.
    if (!role || !canManageSearches(role) || !search || search.isDefault) {
        notFound();
    }

    return (
        <div className="space-y-6">
            {limits.hasActivePlan ? (
                <SavedSearchForm
                    orgId={organization.id}
                    orgSlug={orgSlug}
                    search={search}
                    filterOptions={filterOptions}
                    hasProfile={profile !== null}
                />
            ) : (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    La organización no tiene un plan activo: no se pueden modificar las listas.
                </p>
            )}
            <SettingsSection
                variant="danger"
                title="Pausar o eliminar"
                description="Una lista pausada no se actualiza ni cuenta en el límite de su plan, y conserva su historial."
            >
                <SettingsSectionBody>
                    <SearchStateActions
                        orgId={organization.id}
                        orgSlug={orgSlug}
                        searchId={search.id}
                        searchName={search.name}
                        isActive={search.isActive}
                    />
                </SettingsSectionBody>
            </SettingsSection>
        </div>
    );
}

export const metadata = { title: "Editar lista" };

export default function EditSearchPage({ params }: { params: Promise<{ orgSlug: string; listId: string }> }) {
    return (
        <div className="flex flex-1 flex-col gap-6 p-4 px-4 lg:p-6 lg:px-8">
            <PageHeader icon={List} title="Editar lista" description="Los cambios se aplican en la próxima actualización." />
            <div className="max-w-3xl">
                <Suspense fallback={<SettingsFormSkeleton sections={3} />}>
                    <EditSearchContent params={params} />
                </Suspense>
            </div>
        </div>
    );
}
