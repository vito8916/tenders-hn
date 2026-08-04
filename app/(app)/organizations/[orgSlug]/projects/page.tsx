import { Suspense } from "react";
import { ChartBar } from "lucide-react";
import { ProjectsContent } from "@/features/projects/components/projects-content";
import { getOrganizationBySlugService } from "@/features/organizations/services";
import { listProjectsWithFavoritesByOrgService } from "@/features/projects/services";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { redirect } from "next/navigation";
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
        <>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg border bg-background">
                        <ChartBar className="size-5" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-semibold">Projects</h1>
                        <p className="text-sm text-muted-foreground">
                            Manage your organization&apos;s projects.
                        </p>
                    </div>
                </div>
                <ProjectSheet orgId={organization.id} orgSlug={orgSlug} />
            </div>

            <ProjectsContent projects={projects} orgId={organization.id} orgSlug={orgSlug} />
        </>
    );
}

export default function ProjectsPage({
    params,
}: {
    params: Promise<{ orgSlug: string }>;
}) {
    return (
        <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6 px-4 lg:px-8">
            <Suspense fallback={<ProjectsListSkeleton showHeader />}>
                <ProjectsList params={params} />
            </Suspense>
        </div>
    );
}
