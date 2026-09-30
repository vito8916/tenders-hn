"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { userErrorMessage } from "@/lib/errors";
import { inviteItemSchema } from "./schemas";
import {
    inviteMembersService,
    revokeInvitationService,
    resendInvitationService,
    acceptInvitationService,
} from "./services";

const INVALID_REQUEST_MESSAGE = "Solicitud no válida.";

const inviteMembersActionSchema = z.object({
    orgId: z.uuid(INVALID_REQUEST_MESSAGE),
    orgSlug: z.string().min(1, INVALID_REQUEST_MESSAGE),
    invites: z
        .array(inviteItemSchema)
        .min(1, "Agregue al menos una invitación.")
        .max(10, "Puede enviar hasta 10 invitaciones a la vez."),
});

const invitationTargetSchema = z.object({
    orgId: z.uuid(INVALID_REQUEST_MESSAGE),
    orgSlug: z.string().min(1, INVALID_REQUEST_MESSAGE),
    invitationId: z.uuid(INVALID_REQUEST_MESSAGE),
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
            return { success: false, error: parsed.error.issues[0]?.message ?? "Revise los datos ingresados." };
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
            error: userErrorMessage(error, "No se pudieron enviar las invitaciones. Intente de nuevo."),
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
            return { success: false, error: "Revise los datos ingresados." };
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
            error: userErrorMessage(error, "No se pudo revocar la invitación. Intente de nuevo."),
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
            return { success: false, error: "Revise los datos ingresados." };
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
            error: userErrorMessage(error, "No se pudo reenviar la invitación. Intente de nuevo."),
        };
    }
}

const ACCEPT_ERROR_MESSAGES: Record<string, string> = {
    invitation_not_found: "Esta invitación no existe.",
    invitation_already_accepted: "Esta invitación ya fue aceptada.",
    invitation_expired: "Esta invitación está vencida. Solicite una nueva.",
    invitation_email_mismatch:
        "Esta invitación se envió a otro correo electrónico. Inicie sesión con el correo invitado.",
};

function toAcceptErrorMessage(error: unknown): string {
    const raw = error instanceof Error ? error.message : String(error);
    const known = Object.keys(ACCEPT_ERROR_MESSAGES).find((key) => raw.includes(key));
    return known
        ? ACCEPT_ERROR_MESSAGES[known]
        : userErrorMessage(error, "No se pudo aceptar la invitación. Intente de nuevo.");
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
