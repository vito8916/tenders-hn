import 'server-only';
import { getUserOrgRole } from "@/features/memberships/repository";
import { getOrganizationBySlug } from "@/features/organizations/repository";
import { isProjectMember } from "@/features/project-members/repository";
import { logAppEventService } from "@/features/events/services";
import { APP_EVENTS } from "@/features/events/schemas";
import {
    createProject,
    updateProject,
    getProjectById,
    listProjectsWithFavoritesByOrg,
    listFavoriteProjectsByUser,
    bulkDeleteProjects,
    getProjectBySlugAndOrg,
} from "./repository";
import {
    canCreateProject,
    canDeleteProject,
    canUpdateProjectAsOwnerOrPrivileged,
} from "./rbac";
import type {
    Project,
    ProjectListItem,
    CreateProjectInput,
    UpdateProjectInput,
} from "./schemas";

/**
 * Service layer for creating a new project
 * Orchestrates permission checks and repository calls
 *
 * @param input - Validated project creation input
 * @returns The created project entity
 * @throws Error if user lacks permission or if creation fails
 */
export async function createProjectService(input: CreateProjectInput): Promise<Project> {
    // 1. Get user's role in the organization
    const role = await getUserOrgRole({
        userId: input.ownerId,
        orgId: input.orgId,
    });

    if (!role) {
        throw new Error("User is not a member of this organization");
    }

    // 2. Check RBAC permissions
    if (!canCreateProject(role)) {
        throw new Error(`Insufficient permissions: ${role} cannot create projects`);
    }

    // 3. Create the project via repository
    const project = await createProject(input);

    await logAppEventService({
        eventName: APP_EVENTS.PROJECT_CREATED,
        orgId: input.orgId,
        metadata: { name: project.name, slug: project.slug },
    });

    return project;
}

/**
 * Service layer for fetching projects with favorite status for a user
 *
 * @param params - Object containing orgId and userId
 * @returns Array of project list items with isFavorite flag
 * @throws Error if query fails
 */
export async function listProjectsWithFavoritesByOrgService(params: {
    orgId: string;
    userId: string;
}): Promise<ProjectListItem[]> {
    return listProjectsWithFavoritesByOrg(params);
}

/**
 * Service layer for fetching user's favorite projects within an organization
 *
 * @param params - Object containing userId and orgId
 * @returns Array of favorite project list items
 * @throws Error if query fails
 */
export async function listFavoriteProjectsService(params: {
    userId: string;
    orgId: string;
}): Promise<ProjectListItem[]> {
    return await listFavoriteProjectsByUser({
        userId: params.userId,
        orgId: params.orgId,
    });
}

/**
 * Service layer for bulk deleting projects
 * Enforces org membership and delete permissions
 *
 * @param params - Object containing userId, orgSlug, and projectIds
 * @throws Error if org not found, user lacks permission, or delete fails
 */
export async function bulkDeleteProjectsService(params: {
    userId: string;
    orgSlug: string;
    projectIds: string[];
}): Promise<void> {
    const organization = await getOrganizationBySlug({ slug: params.orgSlug });

    if (!organization) {
        throw new Error("Organization not found");
    }

    const role = await getUserOrgRole({
        userId: params.userId,
        orgId: organization.id,
    });

    if (!role) {
        throw new Error("User is not a member of this organization");
    }

    if (!canDeleteProject(role)) {
        throw new Error("Insufficient permissions to delete projects");
    }

    await bulkDeleteProjects(params.projectIds);

    await logAppEventService({
        eventName: APP_EVENTS.PROJECT_DELETED,
        orgId: organization.id,
        metadata: { count: params.projectIds.length },
    });
}

/**
 * Service layer for fetching a project by slug within an organization
 *
 * @param params - Object containing orgId and slug
 * @returns Project entity or null if not found
 * @throws Error if query fails
 */
export async function getProjectBySlugAndOrgService(params: {
    orgId: string;
    slug: string;
}): Promise<Project | null> {
    return getProjectBySlugAndOrg(params);
}

/**
 * Service layer for updating a project
 * Owner/admin can update any project; members only their own; viewers none
 *
 * @throws Error if project not found, user lacks permission, or update fails
 */
export async function updateProjectService(params: {
    userId: string;
    projectId: string;
    payload: UpdateProjectInput;
}): Promise<Project> {
    const { userId, projectId, payload } = params;

    const project = await getProjectById({ projectId });
    if (!project) {
        throw new Error("Project not found");
    }

    const role = await getUserOrgRole({ userId, orgId: project.orgId });
    if (!role) {
        throw new Error("User is not a member of this organization");
    }

    const isProjectOwner = project.ownerId === userId;
    const isAssigned = isProjectOwner ? true : await isProjectMember({ projectId, userId });
    if (!canUpdateProjectAsOwnerOrPrivileged({ role, isProjectOwner, isAssigned })) {
        throw new Error("Insufficient permissions to update this project");
    }

    return updateProject(projectId, payload);
}
