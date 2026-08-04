import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getOrganizationBySlugService } from "@/features/organizations/services";
import { getUserOrgRoleService } from "@/features/memberships/services";
import { canUpdateOrganization } from "@/features/organizations/rbac";
import { OrganizationSettingsForm } from "@/features/organizations/components/organization-settings-form";
import { OrganizationDangerZone } from "@/features/organizations/components/organization-danger-zone";
import { PageSectionSkeleton } from "@/components/shared/page-section-skeleton";

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
        <>
            <section className="space-y-4">
                <div>
                    <h2 className="text-lg font-medium">Organization</h2>
                    <p className="text-sm text-muted-foreground">
                        {canUpdateOrganization(role)
                            ? "Update your organization's name, slug, and logo."
                            : "Organization details. Only owners and admins can edit them."}
                    </p>
                </div>
                {canUpdateOrganization(role) ? (
                    <OrganizationSettingsForm organization={organization} />
                ) : (
                    <dl className="space-y-2 text-sm">
                        <div className="flex gap-2">
                            <dt className="w-16 text-muted-foreground">Name</dt>
                            <dd>{organization.name}</dd>
                        </div>
                        <div className="flex gap-2">
                            <dt className="w-16 text-muted-foreground">Slug</dt>
                            <dd>{organization.slug}</dd>
                        </div>
                    </dl>
                )}
            </section>

            <Separator />

            <OrganizationDangerZone
                orgId={organization.id}
                orgName={organization.name}
                isOwner={role === "owner"}
            />
        </>
    );
}

export default function OrganizationSettingsPage({
    params,
}: {
    params: Promise<{ orgSlug: string }>;
}) {
    return (
        <Suspense fallback={<PageSectionSkeleton cards={2} />}>
            <OrganizationSettingsContent params={params} />
        </Suspense>
    );
}
