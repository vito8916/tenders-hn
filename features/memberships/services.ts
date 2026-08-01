import 'server-only';
import {
    canManageMembers,
    canChangeMemberRole,
    canRemoveMembers,
    canLeaveOrganization,
} from "@/features/organizations/rbac";
import { logAppEventService } from "@/features/events/services";
import { APP_EVENTS } from "@/features/events/schemas";
import { getProfilePictureUrl } from "@/lib/utils/storage";
import {
    getUserOrgRole,
    getMembershipById,
    listOrgMembers,
    updateMemberRole,
    removeMember,
} from "./repository";
import type { OrgRole, OrgMember, AssignableRole, OrganizationMembership } from "./schemas";

export async function getUserOrgRoleService(params: {
    userId: string;
    orgId: string;
}): Promise<OrgRole | null> {
    return getUserOrgRole(params);
}

async function withSignedAvatarUrl(member: OrgMember): Promise<OrgMember> {
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
 * Service layer for listing the members of an organization
 * Any member of the org can see the member list
 *
 * @throws Error if the requesting user is not a member
 */
export async function listOrgMembersService(params: {
    orgId: string;
    userId: string;
}): Promise<OrgMember[]> {
    const role = await getUserOrgRole(params);
    if (!role) {
        throw new Error("User is not a member of this organization");
    }

    const members = await listOrgMembers({ orgId: params.orgId });
    return Promise.all(members.map(withSignedAvatarUrl));
}

/**
 * Resolves and validates a target membership within an org
 */
async function getTargetMembership(params: {
    orgId: string;
    membershipId: string;
}): Promise<OrganizationMembership> {
    const membership = await getMembershipById({ membershipId: params.membershipId });
    if (!membership || membership.orgId !== params.orgId) {
        throw new Error("Member not found in this organization");
    }
    return membership;
}

/**
 * Service layer for changing a member's role
 * Only the owner can change roles; the owner's own role is immutable
 * (ownership transfer is intentionally not supported)
 *
 * @throws Error if the user lacks permission or the target is invalid
 */
export async function changeMemberRoleService(params: {
    orgId: string;
    userId: string;
    membershipId: string;
    newRole: AssignableRole;
}): Promise<OrganizationMembership> {
    const { orgId, userId, membershipId, newRole } = params;

    const actorRole = await getUserOrgRole({ userId, orgId });
    if (!actorRole || !canChangeMemberRole(actorRole)) {
        throw new Error("Insufficient permissions: only the owner can change roles");
    }

    const target = await getTargetMembership({ orgId, membershipId });
    if (target.role === "owner") {
        throw new Error("The owner's role cannot be changed");
    }
    if (target.userId === userId) {
        throw new Error("You cannot change your own role");
    }

    const updated = await updateMemberRole({ membershipId, role: newRole });

    await logAppEventService({
        eventName: APP_EVENTS.MEMBER_ROLE_CHANGED,
        orgId,
        metadata: { memberUserId: target.userId, from: target.role, to: newRole },
    });

    return updated;
}

/**
 * Service layer for removing a member from an organization
 * Owner/admin can remove other members; the owner can never be removed
 *
 * @throws Error if the user lacks permission or the target is invalid
 */
export async function removeMemberService(params: {
    orgId: string;
    userId: string;
    membershipId: string;
}): Promise<void> {
    const { orgId, userId, membershipId } = params;

    const actorRole = await getUserOrgRole({ userId, orgId });
    if (!actorRole || !canManageMembers(actorRole) || !canRemoveMembers(actorRole)) {
        throw new Error("Insufficient permissions to remove members");
    }

    const target = await getTargetMembership({ orgId, membershipId });
    if (target.role === "owner") {
        throw new Error("The organization owner cannot be removed");
    }
    if (target.userId === userId) {
        throw new Error("Use leave organization to remove yourself");
    }

    await removeMember({ membershipId });

    await logAppEventService({
        eventName: APP_EVENTS.MEMBER_REMOVED,
        orgId,
        metadata: { memberUserId: target.userId, role: target.role },
    });
}

/**
 * Service layer for leaving an organization
 * The owner cannot leave: they must delete the org (or a future ownership
 * transfer flow would go here)
 *
 * @throws Error if the user is not a member or is the owner
 */
export async function leaveOrganizationService(params: {
    orgId: string;
    userId: string;
}): Promise<void> {
    const { orgId, userId } = params;

    const members = await listOrgMembers({ orgId });
    const own = members.find((member) => member.userId === userId);
    if (!own) {
        throw new Error("User is not a member of this organization");
    }
    if (!canLeaveOrganization(own.role)) {
        throw new Error("The owner cannot leave the organization");
    }

    await removeMember({ membershipId: own.id });

    await logAppEventService({
        eventName: APP_EVENTS.MEMBER_LEFT,
        orgId,
        metadata: { role: own.role },
    });
}
