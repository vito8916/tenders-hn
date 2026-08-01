"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { assignProjectMemberInputSchema, unassignProjectMemberInputSchema } from "./schemas";
import { assignMemberToProjectService, unassignMemberFromProjectService } from "./services";

/**
 * Server Action for assigning an org member to a project
 */
export async function assignProjectMemberAction(input: {
    orgId: string;
    orgSlug: string;
    projectId: string;
    projectSlug: string;
    targetUserId: string;
}): Promise<{ success: boolean; error?: string }> {
    try {
        const { sub: userId } = await getCurrentUser();

        const parsed = assignProjectMemberInputSchema.safeParse(input);
        if (!parsed.success) {
            return { success: false, error: "Invalid input" };
        }

        await assignMemberToProjectService({
            orgId: parsed.data.orgId,
            projectId: parsed.data.projectId,
            actorUserId: userId,
            targetUserId: parsed.data.targetUserId,
        });

        revalidatePath(`/organizations/${input.orgSlug}/projects/${input.projectSlug}`);

        return { success: true };
    } catch (error) {
        console.error("Error assigning project member:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to assign member",
        };
    }
}

/**
 * Server Action for unassigning a member from a project
 */
export async function unassignProjectMemberAction(input: {
    orgId: string;
    orgSlug: string;
    projectId: string;
    projectSlug: string;
    targetUserId: string;
}): Promise<{ success: boolean; error?: string }> {
    try {
        const { sub: userId } = await getCurrentUser();

        const parsed = unassignProjectMemberInputSchema.safeParse(input);
        if (!parsed.success) {
            return { success: false, error: "Invalid input" };
        }

        await unassignMemberFromProjectService({
            orgId: parsed.data.orgId,
            projectId: parsed.data.projectId,
            actorUserId: userId,
            targetUserId: parsed.data.targetUserId,
        });

        revalidatePath(`/organizations/${input.orgSlug}/projects/${input.projectSlug}`);

        return { success: true };
    } catch (error) {
        console.error("Error unassigning project member:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to unassign member",
        };
    }
}
