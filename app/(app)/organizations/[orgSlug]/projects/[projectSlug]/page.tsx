import Link from "next/link";
import { Suspense, use } from "react";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { CalendarClock, FolderKanban, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ProjectDetailsSkeleton } from "@/features/projects/components/project-details-skeleton";
import { EditProjectDialog } from "@/features/projects/components/edit-project-dialog";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { Project } from "@/features/projects/schemas";
import { getOrganizationBySlugService } from "@/features/organizations/services";
import { getProjectBySlugAndOrgService } from "@/features/projects/services";
import { getUserOrgRoleService, listOrgMembersService } from "@/features/memberships/services";
import { getProfileService } from "@/features/profiles/services";
import { canUpdateProjectAsOwnerOrPrivileged } from "@/features/projects/rbac";
import { listProjectMembersService } from "@/features/project-members/services";
import { canManageProjectMembers } from "@/features/project-members/rbac";
import { ProjectTeamCard } from "@/features/project-members/components/project-team-card";
import type { OrgMember } from "@/features/memberships/schemas";
import type { ProjectMemberWithProfile } from "@/features/project-members/schemas";
import { cn } from "@/lib/utils";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

const statusStyles: Record<Project["status"], string> = {
    active: "bg-green-500/10 text-green-500 hover:bg-green-500/20",
    inactive: "bg-gray-500/10 text-gray-500 hover:bg-gray-500/20",
    completed: "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20",
    canceled: "bg-red-500/10 text-red-500 hover:bg-red-500/20",
    archived: "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20",
};

const visibilityStyles: Record<Project["visibility"], string> = {
    private: "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20",
    public: "bg-purple-500/10 text-purple-500 hover:bg-purple-500/20",
};

interface ProjectDetailsPageProps {
    params: Promise<{ orgSlug: string; projectSlug: string }>;
}

function ProjectHeader({
    project,
    orgSlug,
    canEdit,
}: {
    project: Project;
    orgSlug: string;
    canEdit: boolean;
}) {
    return (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg border bg-background">
                    <FolderKanban className="size-5" />
                </div>
                <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-2xl font-semibold">{project.name}</h1>
                        <Badge variant="outline" className={cn(statusStyles[project.status], "capitalize")}>
                            {project.status}
                        </Badge>
                        <Badge variant="outline" className={cn(visibilityStyles[project.visibility], "capitalize")}>
                            {project.visibility}
                        </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        /organizations/{orgSlug}/projects/{project.slug}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                {canEdit ? <EditProjectDialog project={project} orgSlug={orgSlug} /> : null}
                <Button variant="outline" asChild>
                    <Link href={`/organizations/${orgSlug}/projects`}>Back to projects</Link>
                </Button>
            </div>
        </div>
    );
}

function ProjectOverviewCard({ project }: { project: Project }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p className="text-sm text-foreground">
                        {project.description || "No description provided for this project."}
                    </p>
                </div>
                <Separator />
                <div className="grid gap-3 text-sm">
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Project slug</span>
                        <span className="font-medium">{project.slug}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Project ID</span>
                        <span className="font-mono text-xs text-foreground">{project.id}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function ProjectMetaCard({ project, ownerName }: { project: Project; ownerName: string | null }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                    <CalendarClock className="mt-0.5 size-4 text-muted-foreground" />
                    <div>
                        <p className="text-sm text-muted-foreground">Created</p>
                        <p className="text-sm font-medium">{format(project.createdAt, "PPp")}</p>
                    </div>
                </div>
                <div className="flex items-start gap-3">
                    <CalendarClock className="mt-0.5 size-4 text-muted-foreground" />
                    <div>
                        <p className="text-sm text-muted-foreground">Last updated</p>
                        <p className="text-sm font-medium">{format(project.updatedAt, "PPp")}</p>
                    </div>
                </div>
                <Separator />
                <div className="flex items-start gap-3">
                    <UserRound className="mt-0.5 size-4 text-muted-foreground" />
                    <div>
                        <p className="text-sm text-muted-foreground">Owner</p>
                        {ownerName ? (
                            <p className="text-sm font-medium">{ownerName}</p>
                        ) : (
                            <p className="font-mono text-xs text-foreground">{project.ownerId}</p>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function ProjectDetailsView({
    orgSlug,
    project,
    ownerName,
    canEdit,
    canManageTeam,
    orgId,
    teamMembers,
    assignableMembers,
}: {
    orgSlug: string;
    project: Project;
    ownerName: string | null;
    canEdit: boolean;
    canManageTeam: boolean;
    orgId: string;
    teamMembers: ProjectMemberWithProfile[];
    assignableMembers: OrgMember[];
}) {
    return (
        <>
            <ProjectHeader project={project} orgSlug={orgSlug} canEdit={canEdit} />
            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
                <ProjectOverviewCard project={project} />
                <div className="space-y-6">
                    <ProjectMetaCard project={project} ownerName={ownerName} />
                    <ProjectTeamCard
                        members={teamMembers}
                        assignableMembers={assignableMembers}
                        canManage={canManageTeam}
                        projectOwnerId={project.ownerId}
                        orgId={orgId}
                        orgSlug={orgSlug}
                        projectId={project.id}
                        projectSlug={project.slug ?? ""}
                    />
                </div>
            </div>
        </>
    );
}

async function getProjectDetails(params: { orgSlug: string; projectSlug: string }) {
    const [{ sub: userId }, organization] = await Promise.all([
        getCurrentUser(),
        getOrganizationBySlugService(params.orgSlug),
    ]);
    if (!organization) {
        redirect("/organizations");
    }

    const project = await getProjectBySlugAndOrgService({
        orgId: organization.id,
        slug: params.projectSlug,
    });

    if (!project) {
        return {
            orgSlug: params.orgSlug,
            orgId: organization.id,
            project: null,
            ownerName: null,
            canEdit: false,
            canManageTeam: false,
            teamMembers: [],
            assignableMembers: [],
        };
    }

    const [role, ownerProfile, teamMembers] = await Promise.all([
        getUserOrgRoleService({ userId, orgId: organization.id }),
        getProfileService({ userId: project.ownerId }),
        listProjectMembersService({ projectId: project.id }),
    ]);

    const isProjectOwner = project.ownerId === userId;
    const isAssigned = isProjectOwner || teamMembers.some((member) => member.userId === userId);
    const canEdit = role
        ? canUpdateProjectAsOwnerOrPrivileged({ role, isProjectOwner, isAssigned })
        : false;
    const canManageTeam = role ? canManageProjectMembers(role) : false;

    const orgMembers = canManageTeam ? await listOrgMembersService({ orgId: organization.id, userId }) : [];
    const assignedUserIds = new Set(teamMembers.map((member) => member.userId));
    const assignableMembers = orgMembers.filter((member) => !assignedUserIds.has(member.userId));

    return {
        orgSlug: params.orgSlug,
        orgId: organization.id,
        project,
        ownerName: ownerProfile?.fullName ?? null,
        canEdit,
        canManageTeam,
        teamMembers,
        assignableMembers,
    };
}

function ProjectContent({
    dataPromise,
}: {
    dataPromise: Promise<{
        orgSlug: string;
        orgId: string;
        project: Project | null;
        ownerName: string | null;
        canEdit: boolean;
        canManageTeam: boolean;
        teamMembers: ProjectMemberWithProfile[];
        assignableMembers: OrgMember[];
    }>;
}) {
    const data = use(dataPromise);

    if (!data.project) {
        notFound();
    }

    return (
        <ProjectDetailsView
            orgSlug={data.orgSlug}
            orgId={data.orgId}
            project={data.project}
            ownerName={data.ownerName}
            canEdit={data.canEdit}
            canManageTeam={data.canManageTeam}
            teamMembers={data.teamMembers}
            assignableMembers={data.assignableMembers}
        />
    );
}

export default async function ProjectDetailsPage({ params }: ProjectDetailsPageProps) {
    const { orgSlug, projectSlug } = await params;
    const dataPromise = getProjectDetails({ orgSlug, projectSlug });

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6 px-4 lg:px-8">
            <Suspense fallback={<ProjectDetailsSkeleton />}>
                <ProjectContent dataPromise={dataPromise} />
            </Suspense>
        </div>
    );
}
