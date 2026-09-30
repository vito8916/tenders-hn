"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { userErrorMessage } from "@/lib/errors";
import { AssignableRoleSchema } from "./schemas";
import {
    changeMemberRoleService,
    removeMemberService,
    leaveOrganizationService,
} from "./services";

const changeMemberRoleActionSchema = z.object({
    orgId: z.uuid(),
    orgSlug: z.string().min(1),
    membershipId: z.uuid(),
    newRole: AssignableRoleSchema,
});

const memberTargetSchema = z.object({
    orgId: z.uuid(),
    orgSlug: z.string().min(1),
    membershipId: z.uuid(),
});

/**
 * Server Action for changing a member's role
 */
export async function changeMemberRoleAction(input: {
    orgId: string;
    orgSlug: string;
    membershipId: string;
    newRole: string;
}): Promise<{ success: boolean; error?: string }> {
    try {
        const { sub: userId } = await getCurrentUser();

        const parsed = changeMemberRoleActionSchema.safeParse(input);
        if (!parsed.success) {
            return { success: false, error: "Los datos ingresados no son válidos." };
        }

        await changeMemberRoleService({
            orgId: parsed.data.orgId,
            userId,
            membershipId: parsed.data.membershipId,
            newRole: parsed.data.newRole,
        });

        revalidatePath(`/organizations/${parsed.data.orgSlug}/members`);

        return { success: true };
    } catch (error) {
        console.error("Error changing member role:", error);
        return {
            success: false,
            error: userErrorMessage(error, "No se pudo cambiar el rol. Intente de nuevo."),
        };
    }
}

/**
 * Server Action for removing a member from an organization
 */
export async function removeMemberAction(input: {
    orgId: string;
    orgSlug: string;
    membershipId: string;
}): Promise<{ success: boolean; error?: string }> {
    try {
        const { sub: userId } = await getCurrentUser();

        const parsed = memberTargetSchema.safeParse(input);
        if (!parsed.success) {
            return { success: false, error: "Los datos ingresados no son válidos." };
        }

        await removeMemberService({
            orgId: parsed.data.orgId,
            userId,
            membershipId: parsed.data.membershipId,
        });

        revalidatePath(`/organizations/${parsed.data.orgSlug}/members`);

        return { success: true };
    } catch (error) {
        console.error("Error removing member:", error);
        return {
            success: false,
            error: userErrorMessage(error, "No se pudo quitar al miembro. Intente de nuevo."),
        };
    }
}

const leaveOrganizationActionSchema = z.object({
    orgId: z.uuid(),
});

/**
 * Server Action for leaving an organization
 * Redirects to the organizations list on success
 */
export async function leaveOrganizationAction(input: {
    orgId: string;
}): Promise<{ success: false; error: string }> {
    const { sub: userId } = await getCurrentUser();

    const parsed = leaveOrganizationActionSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, error: "Los datos ingresados no son válidos." };
    }

    try {
        await leaveOrganizationService({ orgId: parsed.data.orgId, userId });
    } catch (error) {
        console.error("Error leaving organization:", error);
        return {
            success: false,
            error: userErrorMessage(error, "No se pudo salir de la organización. Intente de nuevo."),
        };
    }

    redirect("/organizations");
}
