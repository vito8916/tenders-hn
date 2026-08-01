import { Suspense } from "react";
import { ChartBar } from "lucide-react";
import { ProjectsContent } from "@/features/projects/components/projects-content";
import { getOrganizationBySlugService } from "@/features/organizations/services";
import { listProjectsWithFavoritesByOrgService } from "@/features/projects/services";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { redirect } from "next/navigation";
import { ProjectSheet } from "@/features/projects/components/project-sheet";
import ProjectsTableSkeleton from "@/features/projects/components/projects-table-skeleton";

interface ProjectsPageProps {
    params: Promise<{ orgSlug: string }>;
}

// Async component that fetches and renders projects
async function ProjectsList({ orgId, userId, orgSlug }: { orgId: string; userId: string; orgSlug: string }) {
    const projects = await listProjectsWithFavoritesByOrgService({ orgId, userId });
    return <ProjectsContent projects={projects} orgId={orgId} orgSlug={orgSlug} />;
}

async function ProjectsPage({ params }: ProjectsPageProps) {
    const { orgSlug } = await params;
    const [{ sub: userId }, organization] = await Promise.all([
        getCurrentUser(),
        getOrganizationBySlugService(orgSlug),
    ]);

    if (!organization) {
        redirect("/organizations");
    }

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6 px-4 lg:px-8">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg border bg-background">
                        <ChartBar className="size-5" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-semibold">Projects</h1>
                        <p className="text-sm text-muted-foreground">Manage your organization&apos;s projects.</p>
                    </div>
                </div>
                <ProjectSheet orgId={organization.id} orgSlug={orgSlug} />
            </div>

            <Suspense fallback={<ProjectsTableSkeleton />}>
                <ProjectsList orgId={organization.id} userId={userId} orgSlug={orgSlug} />
            </Suspense>
        </div>
    );
}

export default ProjectsPage;
