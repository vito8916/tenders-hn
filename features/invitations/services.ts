import 'server-only';
import { getUserOrgRole } from "@/features/memberships/repository";
import { getOrganizationById } from "@/features/organizations/repository";
import { getProfileById } from "@/features/profiles/repository";
import { canInviteMembers, canManageMembers } from "@/features/organizations/rbac";
import { logAppEventService } from "@/features/events/services";
import { APP_EVENTS } from "@/features/events/schemas";
import { sendEmail } from "@/lib/email/resend";
import OrganizationInvitationEmail from "@/emails/organization-invitation";
import {
    listPendingInvitations,
    listMyPendingInvitations,
    getInvitationById,
    getInvitationByToken,
    createInvitations,
    deleteInvitation,
    acceptInvitation,
} from "./repository";
import type {
    Invitation,
    InvitationPreview,
    AcceptInvitationResult,
    InviteItem,
    PendingInvitation,
    MyPendingInvitation,
} from "./schemas";

function buildAcceptUrl(token: string): string {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
    return `${baseUrl.replace(/\/$/, "")}/invitations/${token}`;
}

async function sendInvitationEmail(params: {
    invitation: Invitation;
    orgName: string;
    inviterName: string | null;
}): Promise<void> {
    await sendEmail({
        to: params.invitation.email,
        subject: `Join ${params.orgName}`,
        react: OrganizationInvitationEmail({
            orgName: params.orgName,
            inviterName: params.inviterName,
            role: params.invitation.role,
            acceptUrl: buildAcceptUrl(params.invitation.token),
            expiresAt: params.invitation.expiresAt,
        }),
    });
}

function toPendingInvitation(invitation: Invitation): PendingInvitation {
    const { token: _token, ...pending } = invitation;
    return pending;
}

/**
 * Service layer for inviting members to an organization
 * Creates invitation rows, then sends one email per invitation.
 * Email failures do not roll back the invitations: the rows exist and
 * can be resent from the members page, so failures are just reported.
 *
 * @returns Created invitations plus the emails that could not be sent
 * @throws Error if the user lacks permission or the inserts fail
 */
export async function inviteMembersService(params: {
    orgId: string;
    userId: string;
    invites: InviteItem[];
}): Promise<{ invitations: PendingInvitation[]; failedEmails: string[] }> {
    const { orgId, userId, invites } = params;

    // 1. RBAC: only owner/admin can invite
    const role = await getUserOrgRole({ userId, orgId });
    if (!role) {
        throw new Error("User is not a member of this organization");
    }
    if (!canInviteMembers(role)) {
        throw new Error(`Insufficient permissions: ${role} cannot invite members`);
    }

    // 2. Resolve org and inviter for the email content
    const [organization, inviterProfile] = await Promise.all([
        getOrganizationById({ orgId }),
        getProfileById({ userId }),
    ]);

    if (!organization) {
        throw new Error("Organization not found");
    }

    // 3. Create invitation rows
    const invitations = await createInvitations({ orgId, invites });

    // 4. Send emails (best effort, per recipient)
    const results = await Promise.allSettled(
        invitations.map((invitation) =>
            sendInvitationEmail({
                invitation,
                orgName: organization.name,
                inviterName: inviterProfile?.fullName ?? null,
            })
        )
    );

    const failedEmails = invitations
        .filter((_, index) => results[index].status === "rejected")
        .map((invitation) => invitation.email);

    results.forEach((result) => {
        if (result.status === "rejected") {
            console.error("Failed to send invitation email:", result.reason);
        }
    });

    // 5. Audit log
    await logAppEventService({
        eventName: APP_EVENTS.INVITATION_SENT,
        orgId,
        metadata: {
            count: invitations.length,
            emails: invitations.map((invitation) => invitation.email),
        },
    });

    return {
        invitations: invitations.map(toPendingInvitation),
        failedEmails,
    };
}

/**
 * Service layer for listing pending invitations of an organization
 * Restricted to owner/admin because it exposes invitee emails
 *
 * @throws Error if the user lacks permission
 */
export async function listPendingInvitationsService(params: {
    orgId: string;
    userId: string;
}): Promise<PendingInvitation[]> {
    const { orgId, userId } = params;

    const role = await getUserOrgRole({ userId, orgId });
    if (!role || !canManageMembers(role)) {
        throw new Error("Insufficient permissions to view invitations");
    }

    const invitations = await listPendingInvitations({ orgId });
    return invitations.map(toPendingInvitation);
}

/**
 * Service layer for revoking (deleting) a pending invitation
 *
 * @throws Error if the user lacks permission or the invitation does not exist
 */
export async function revokeInvitationService(params: {
    orgId: string;
    userId: string;
    invitationId: string;
}): Promise<void> {
    const { orgId, userId, invitationId } = params;

    const role = await getUserOrgRole({ userId, orgId });
    if (!role || !canInviteMembers(role)) {
        throw new Error("Insufficient permissions to revoke invitations");
    }

    const invitation = await getInvitationById({ invitationId });
    if (!invitation || invitation.orgId !== orgId) {
        throw new Error("Invitation not found in this organization");
    }
    if (invitation.acceptedAt) {
        throw new Error("Invitation was already accepted");
    }

    await deleteInvitation({ invitationId });

    await logAppEventService({
        eventName: APP_EVENTS.INVITATION_REVOKED,
        orgId,
        metadata: { email: invitation.email },
    });
}

/**
 * Service layer for resending a pending invitation email
 * Reuses the existing token; expired invitations must be revoked and recreated
 *
 * @throws Error if the user lacks permission or the invitation is not resendable
 */
export async function resendInvitationService(params: {
    orgId: string;
    userId: string;
    invitationId: string;
}): Promise<void> {
    const { orgId, userId, invitationId } = params;

    const role = await getUserOrgRole({ userId, orgId });
    if (!role || !canInviteMembers(role)) {
        throw new Error("Insufficient permissions to resend invitations");
    }

    const invitation = await getInvitationById({ invitationId });
    if (!invitation || invitation.orgId !== orgId) {
        throw new Error("Invitation not found in this organization");
    }
    if (invitation.acceptedAt) {
        throw new Error("Invitation was already accepted");
    }
    if (invitation.expiresAt < new Date()) {
        throw new Error("Invitation has expired: revoke it and send a new one");
    }

    const [organization, inviterProfile] = await Promise.all([
        getOrganizationById({ orgId }),
        getProfileById({ userId }),
    ]);

    if (!organization) {
        throw new Error("Organization not found");
    }

    await sendInvitationEmail({
        invitation,
        orgName: organization.name,
        inviterName: inviterProfile?.fullName ?? null,
    });
}

/**
 * Service layer for previewing an invitation on the accept page
 * The token itself is the capability: any authenticated user holding it
 * can see the org name, role, and invited email
 */
export async function getInvitationPreviewService(params: {
    token: string;
}): Promise<InvitationPreview | null> {
    return getInvitationByToken(params);
}

/**
 * Service layer for accepting an invitation
 * All validation (expiry, email match, membership insert) happens in the
 * accept_invitation SECURITY DEFINER function
 *
 * @throws Error with a database reason such as invitation_expired
 */
export async function acceptInvitationService(params: {
    token: string;
}): Promise<AcceptInvitationResult> {
    const result = await acceptInvitation(params);

    await logAppEventService({
        eventName: APP_EVENTS.INVITATION_ACCEPTED,
        orgId: result.orgId,
    });

    return result;
}

/**
 * Service layer for listing the current user's pending invitations
 * Self-scoped by the RPC (matches the caller's verified email), so no RBAC
 */
export async function listMyPendingInvitationsService(): Promise<MyPendingInvitation[]> {
    return listMyPendingInvitations();
}
