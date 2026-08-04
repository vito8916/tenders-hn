import { Suspense } from "react";
import { ChartBar } from "lucide-react";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { ProjectsContent } from "@/features/projects/components/projects-content";
import { getOrganizationBySlugService } from "@/features/organizations/services";
import { listProjectsWithFavoritesByOrgService } from "@/features/projects/services";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { ProjectSheet } from "@/features/projects/components/project-sheet";
import { ProjectsListSkeleton } from "@/features/projects/components/projects-list-skeleton";

async function ProjectsList({
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

    const projects = await listProjectsWithFavoritesByOrgService({
        orgId: organization.id,
        userId,
    });

    return (
        <ProjectsContent projects={projects} orgId={organization.id} orgSlug={orgSlug} />
    );
}

export default function ProjectsPage({
    params,
}: {
    params: Promise<{ orgSlug: string }>;
}) {
    return (
        <div className="flex flex-1 flex-col gap-6 p-4 px-4 lg:p-6 lg:px-8">
            <PageHeader
                icon={ChartBar}
                title="Projects"
                description="Manage your organization's projects."
                action={<ProjectSheet />}
            />
            <Suspense fallback={<ProjectsListSkeleton />}>
                <ProjectsList params={params} />
            </Suspense>
        </div>
    );
}
