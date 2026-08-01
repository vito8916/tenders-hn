import { z } from "zod";

/**
 * Invitation role schema for organization invitations
 * Matches the roles available in organization_members
 */
export const InviteRoleSchema = z.enum(["member", "admin", "viewer"]);

/**
 * Schema for a single invitation item (email + role)
 */
export const inviteItemSchema = z.object({
    email: z.string().email("Enter a valid email address"),
    role: InviteRoleSchema,
});

/**
 * Input schema for creating multiple invitations
 * Used in Server Actions and Services
 */
export const createInvitationsInputSchema = z.object({
    orgId: z.uuid(),
    invites: z
        .array(inviteItemSchema)
        .min(1, "At least one invitation is required")
        .max(10, "Maximum 10 invitations allowed"),
});

/**
 * Full invitation entity as stored in the database
 */
export const invitationSchema = z.object({
    id: z.uuid(),
    orgId: z.uuid(),
    email: z.string().email(),
    role: InviteRoleSchema,
    token: z.string(),
    expiresAt: z.coerce.date(),
    acceptedAt: z.coerce.date().nullable(),
    createdAt: z.coerce.date(),
});

/**
 * Invitation as listed on the members page (no token exposed to the UI)
 */
export const pendingInvitationSchema = invitationSchema.omit({ token: true });

/**
 * Invitation preview returned by the get_invitation_by_token RPC
 * Shown on the accept-invitation page
 */
export const invitationPreviewSchema = z.object({
    id: z.uuid(),
    orgId: z.uuid(),
    orgName: z.string(),
    orgSlug: z.string(),
    email: z.string().email(),
    role: InviteRoleSchema,
    expiresAt: z.coerce.date(),
    acceptedAt: z.coerce.date().nullable(),
    createdAt: z.coerce.date(),
});

/**
 * Result of the accept_invitation RPC
 */
export const acceptInvitationResultSchema = z.object({
    orgId: z.uuid(),
    orgSlug: z.string(),
    orgName: z.string(),
});

/**
 * Pending invitation addressed to the current user, returned by the
 * list_my_pending_invitations RPC (includes the token so the user can accept)
 */
export const myPendingInvitationSchema = z.object({
    id: z.uuid(),
    orgId: z.uuid(),
    orgName: z.string(),
    orgSlug: z.string(),
    email: z.string().email(),
    role: InviteRoleSchema,
    token: z.string(),
    expiresAt: z.coerce.date(),
    createdAt: z.coerce.date(),
});

// Exported types inferred from schemas
export type InviteRole = z.infer<typeof InviteRoleSchema>;
export type InviteItem = z.infer<typeof inviteItemSchema>;
export type CreateInvitationsInput = z.infer<typeof createInvitationsInputSchema>;
export type Invitation = z.infer<typeof invitationSchema>;
export type PendingInvitation = z.infer<typeof pendingInvitationSchema>;
export type InvitationPreview = z.infer<typeof invitationPreviewSchema>;
export type AcceptInvitationResult = z.infer<typeof acceptInvitationResultSchema>;
export type MyPendingInvitation = z.infer<typeof myPendingInvitationSchema>;
