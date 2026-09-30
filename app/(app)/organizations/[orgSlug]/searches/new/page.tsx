import { Suspense } from "react";
import { Search } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsFormSkeleton } from "@/components/shared/settings-form-skeleton";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getOrganizationBySlugService } from "@/features/organizations/services";
import { getUserOrgRoleService } from "@/features/memberships/services";
import { getCompanyProfileService } from "@/features/company-profile/services";
import { canManageSearches } from "@/features/saved-searches/rbac";
import { getSearchLimitsService, listFilterOptionsService } from "@/features/saved-searches/services";
import { SavedSearchForm } from "@/features/saved-searches/components/saved-search-form";

async function NewSearchContent({ params }: { params: Promise<{ orgSlug: string }> }) {
    const { orgSlug } = await params;
    const [{ sub: userId }, organization] = await Promise.all([getCurrentUser(), getOrganizationBySlugService(orgSlug)]);

    if (!organization) {
        redirect("/organizations");
    }

    const [role, limits, filterOptions, profile] = await Promise.all([
        getUserOrgRoleService({ userId, orgId: organization.id }),
        getSearchLimitsService(organization.id),
        listFilterOptionsService(),
        getCompanyProfileService(organization.id),
    ]);
    if (!role || !canManageSearches(role)) {
        notFound();
    }
    if (!limits.hasActivePlan) {
        redirect(`/organizations/${orgSlug}/searches`);
    }

    return (
        <SavedSearchForm
            orgId={organization.id}
            orgSlug={orgSlug}
            search={null}
            filterOptions={filterOptions}
            allowedSchedules={limits.allowedSchedules}
            hasProfile={profile !== null}
        />
    );
}

export default function NewSearchPage({ params }: { params: Promise<{ orgSlug: string }> }) {
    return (
        <div className="flex flex-1 flex-col gap-6 p-4 px-4 lg:p-6 lg:px-8">
            <PageHeader icon={Search} title="Nueva búsqueda" description="Defina qué busca, en qué procesos y cada cuánto." />
            <div className="max-w-3xl">
                <Suspense fallback={<SettingsFormSkeleton sections={3} />}>
                    <NewSearchContent params={params} />
                </Suspense>
            </div>
        </div>
    );
}
