"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { inviteItemSchema } from "./schemas";
import {
    inviteMembersService,
    revokeInvitationService,
    resendInvitationService,
    acceptInvitationService,
} from "./services";

const inviteMembersActionSchema = z.object({
    orgId: z.uuid(),
    orgSlug: z.string().min(1),
    invites: z
        .array(inviteItemSchema)
        .min(1, "At least one invitation is required")
        .max(10, "Maximum 10 invitations allowed"),
});

const invitationTargetSchema = z.object({
    orgId: z.uuid(),
    orgSlug: z.string().min(1),
    invitationId: z.uuid(),
});

/**
 * Server Action for inviting members to an organization
 * Creates invitations and sends one email per invitee
 */
export async function inviteMembersAction(input: {
    orgId: string;
    orgSlug: string;
    invites: { email: string; role: string }[];
}): Promise<{ success: boolean; failedEmails?: string[]; error?: string }> {
    try {
        const { sub: userId } = await getCurrentUser();

        const parsed = inviteMembersActionSchema.safeParse(input);
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
        }

        const { failedEmails } = await inviteMembersService({
            orgId: parsed.data.orgId,
            userId,
            invites: parsed.data.invites,
        });

        revalidatePath(`/organizations/${parsed.data.orgSlug}/members`);

        return { success: true, failedEmails };
    } catch (error) {
        console.error("Error inviting members:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to send invitations",
        };
    }
}

/**
 * Server Action for revoking a pending invitation
 */
export async function revokeInvitationAction(input: {
    orgId: string;
    orgSlug: string;
    invitationId: string;
}): Promise<{ success: boolean; error?: string }> {
    try {
        const { sub: userId } = await getCurrentUser();

        const parsed = invitationTargetSchema.safeParse(input);
        if (!parsed.success) {
            return { success: false, error: "Invalid input" };
        }

        await revokeInvitationService({
            orgId: parsed.data.orgId,
            userId,
            invitationId: parsed.data.invitationId,
        });

        revalidatePath(`/organizations/${parsed.data.orgSlug}/members`);

        return { success: true };
    } catch (error) {
        console.error("Error revoking invitation:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to revoke invitation",
        };
    }
}

/**
 * Server Action for resending a pending invitation email
 */
export async function resendInvitationAction(input: {
    orgId: string;
    orgSlug: string;
    invitationId: string;
}): Promise<{ success: boolean; error?: string }> {
    try {
        const { sub: userId } = await getCurrentUser();

        const parsed = invitationTargetSchema.safeParse(input);
        if (!parsed.success) {
            return { success: false, error: "Invalid input" };
        }

        await resendInvitationService({
            orgId: parsed.data.orgId,
            userId,
            invitationId: parsed.data.invitationId,
        });

        return { success: true };
    } catch (error) {
        console.error("Error resending invitation:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to resend invitation",
        };
    }
}

const ACCEPT_ERROR_MESSAGES: Record<string, string> = {
    invitation_not_found: "This invitation does not exist.",
    invitation_already_accepted: "This invitation has already been accepted.",
    invitation_expired: "This invitation has expired. Ask for a new one.",
    invitation_email_mismatch:
        "This invitation was sent to a different email address. Sign in with the invited email.",
};

function toAcceptErrorMessage(error: unknown): string {
    const raw = error instanceof Error ? error.message : String(error);
    const known = Object.keys(ACCEPT_ERROR_MESSAGES).find((key) => raw.includes(key));
    return known ? ACCEPT_ERROR_MESSAGES[known] : "Failed to accept the invitation.";
}

/**
 * Server Action for accepting an invitation
 * Redirects to the organization on success
 */
export async function acceptInvitationAction(token: string): Promise<{ success: false; error: string }> {
    // Ensure the user is authenticated before hitting the RPC
    await getCurrentUser();

    let orgSlug: string;
    try {
        const result = await acceptInvitationService({ token });
        orgSlug = result.orgSlug;
    } catch (error) {
        console.error("Error accepting invitation:", error);
        return { success: false, error: toAcceptErrorMessage(error) };
    }

    redirect(`/organizations/${orgSlug}`);
}

/**
 * Server Action for accepting an invitation without redirecting
 * Used inside the onboarding flow, which controls navigation itself
 */
export async function acceptInvitationDuringOnboardingAction(
    token: string
): Promise<{ success: boolean; orgSlug?: string; orgName?: string; error?: string }> {
    try {
        await getCurrentUser();
        const result = await acceptInvitationService({ token });
        return { success: true, orgSlug: result.orgSlug, orgName: result.orgName };
    } catch (error) {
        console.error("Error accepting invitation during onboarding:", error);
        return { success: false, error: toAcceptErrorMessage(error) };
    }
}
