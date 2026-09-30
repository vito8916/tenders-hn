import 'server-only';
import {
    canManageMembers,
    canChangeMemberRole,
    canRemoveMembers,
    canLeaveOrganization,
} from "@/features/organizations/rbac";
import { logAppEventService } from "@/features/events/services";
import { APP_EVENTS } from "@/features/events/schemas";
import { UserFacingError } from "@/lib/errors";
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
        throw new UserFacingError("Usted no es miembro de esta organización.");
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
        throw new UserFacingError("No encontramos a este miembro en la organización.");
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
        throw new UserFacingError("Solo el propietario puede cambiar los roles.");
    }

    const target = await getTargetMembership({ orgId, membershipId });
    if (target.role === "owner") {
        throw new UserFacingError("No se puede cambiar el rol del propietario.");
    }
    if (target.userId === userId) {
        throw new UserFacingError("No puede cambiar su propio rol.");
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
        throw new UserFacingError("Su rol no le permite quitar miembros.");
    }

    const target = await getTargetMembership({ orgId, membershipId });
    if (target.role === "owner") {
        throw new UserFacingError("No se puede quitar al propietario de la organización.");
    }
    if (target.userId === userId) {
        throw new UserFacingError("Para quitarse de la organización, use «Salir de la organización».");
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
        throw new UserFacingError("Usted no es miembro de esta organización.");
    }
    if (!canLeaveOrganization(own.role)) {
        throw new UserFacingError("El propietario no puede salir de la organización. Transfiera la propiedad primero.");
    }

    await removeMember({ membershipId: own.id });

    await logAppEventService({
        eventName: APP_EVENTS.MEMBER_LEFT,
        orgId,
        metadata: { role: own.role },
    });
}
