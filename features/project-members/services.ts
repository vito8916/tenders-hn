import 'server-only';
import { getUserOrgRole } from "@/features/memberships/repository";
import { getProjectById } from "@/features/projects/repository";
import { logAppEventService } from "@/features/events/services";
import { APP_EVENTS } from "@/features/events/schemas";
import { getProfilePictureUrl } from "@/lib/utils/storage";
import { listProjectMembers, assignProjectMember, removeProjectMember } from "./repository";
import { canManageProjectMembers } from "./rbac";
import type { ProjectMember, ProjectMemberWithProfile } from "./schemas";

async function withSignedAvatarUrl(member: ProjectMemberWithProfile): Promise<ProjectMemberWithProfile> {
    if (!member.avatarUrl) return member;

    try {
        const signedUrl = await getProfilePictureUrl(member.avatarUrl);
        return { ...member, avatarUrl: signedUrl };
    } catch {
        // Avatar not accessible (e.g. storage policy not applied yet): fall back to initials
        return { ...member, avatarUrl: null };
    }
}

/**
 * Service layer for listing the members assigned to a project
 * Relies on RLS: only users who can already see the project get results
 */
export async function listProjectMembersService(params: {
    projectId: string;
}): Promise<ProjectMemberWithProfile[]> {
    const members = await listProjectMembers(params);
    return Promise.all(members.map(withSignedAvatarUrl));
}

/**
 * Service layer for assigning an org member to a project
 * Only the org owner/admin can assign, and only existing org members
 *
 * @throws Error if the actor lacks permission or the target is not an org member
 */
export async function assignMemberToProjectService(params: {
    orgId: string;
    projectId: string;
    actorUserId: string;
    targetUserId: string;
}): Promise<ProjectMember> {
    const { orgId, projectId, actorUserId, targetUserId } = params;

    const actorRole = await getUserOrgRole({ userId: actorUserId, orgId });
    if (!actorRole || !canManageProjectMembers(actorRole)) {
        throw new Error("Insufficient permissions to assign project members");
    }

    const targetRole = await getUserOrgRole({ userId: targetUserId, orgId });
    if (!targetRole) {
        throw new Error("Target user is not a member of this organization");
    }

    const member = await assignProjectMember({ orgId, projectId, userId: targetUserId });

    await logAppEventService({
        eventName: APP_EVENTS.PROJECT_MEMBER_ASSIGNED,
        orgId,
        metadata: { projectId, memberUserId: targetUserId },
    });

    return member;
}

/**
 * Service layer for unassigning a member from a project
 * Only the org owner/admin can unassign; the project's creator is protected
 *
 * @throws Error if the actor lacks permission or the target is the project owner
 */
export async function unassignMemberFromProjectService(params: {
    orgId: string;
    projectId: string;
    actorUserId: string;
    targetUserId: string;
}): Promise<void> {
    const { orgId, projectId, actorUserId, targetUserId } = params;

    const actorRole = await getUserOrgRole({ userId: actorUserId, orgId });
    if (!actorRole || !canManageProjectMembers(actorRole)) {
        throw new Error("Insufficient permissions to unassign project members");
    }

    const project = await getProjectById({ projectId });
    if (!project || project.orgId !== orgId) {
        throw new Error("Project not found in this organization");
    }
    if (project.ownerId === targetUserId) {
        throw new Error("The project creator cannot be unassigned");
    }

    await removeProjectMember({ projectId, userId: targetUserId });

    await logAppEventService({
        eventName: APP_EVENTS.PROJECT_MEMBER_UNASSIGNED,
        orgId,
        metadata: { projectId, memberUserId: targetUserId },
    });
}
