"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import {
    createProjectFormSchema,
    createProjectInputSchema,
    ProjectStatusSchema,
    ProjectVisibilitySchema,
} from "./schemas";
import {
    createProjectService,
    bulkDeleteProjectsService,
    updateProjectService,
} from "./services";

const bulkDeleteProjectsInputSchema = z.object({
    projectIds: z.array(z.string().uuid()).min(1, "At least one project ID is required"),
    orgSlug: z.string().min(1, "Organization slug is required"),
});

/**
 * Server Action for creating a new project
 * Entry point from UI components
 *
 * @param data - Project data from client
 * @param orgId - Organization ID
 * @param orgSlug - Organization slug from route params
 * @throws Redirects on success, throws error on failure
 */
export async function createProjectAction(data: z.infer<typeof createProjectFormSchema>, orgId: string, orgSlug: string) {
    // 1. Resolve authenticated user
    const { sub: userId } = await getCurrentUser();
    const slug = data.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    // 2. Parse and validate input using Zod
    const input = createProjectInputSchema.parse({
        ...data,
        orgId: orgId,
        ownerId: userId,
        slug,
    });
    // 3. Call service layer (handles RBAC and repository)
    await createProjectService(input);

    revalidatePath(`/organizations/${orgSlug}/projects`);
}

/**
 * Server Action for bulk deleting projects
 * Entry point from UI components
 *
 * @param projectIds - Array of project IDs to delete
 * @param orgSlug - Organization slug from route params
 * @returns Result object with ok status and optional error
 */
export async function bulkDeleteProjectsAction(
    projectIds: string[],
    orgSlug: string
): Promise<{ ok: boolean; error?: unknown }> {
    try {
        // 1. Resolve authenticated user
        const { sub: userId } = await getCurrentUser();

        // 2. Parse and validate input using Zod
        const input = bulkDeleteProjectsInputSchema.parse({
            projectIds,
            orgSlug,
        });

        // 3. Call service layer (handles RBAC and repository)
        await bulkDeleteProjectsService({
            userId,
            orgSlug: input.orgSlug,
            projectIds: input.projectIds,
        });

        // 4. Revalidate the projects page
        revalidatePath(`/organizations/${orgSlug}/projects`);

        return { ok: true };
    } catch (error) {
        return { ok: false, error };
    }
}

const updateProjectActionSchema = z.object({
    projectId: z.uuid(),
    orgSlug: z.string().min(1),
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(2000),
    status: ProjectStatusSchema,
    visibility: ProjectVisibilitySchema,
});

/**
 * Server Action for updating a project
 * Returns the (possibly new) slug so the client can navigate if it changed
 */
export async function updateProjectAction(input: {
    projectId: string;
    orgSlug: string;
    name: string;
    description: string;
    status: string;
    visibility: string;
}): Promise<{ success: boolean; slug?: string; error?: string }> {
    try {
        const { sub: userId } = await getCurrentUser();

        const parsed = updateProjectActionSchema.safeParse(input);
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
        }

        const slug = parsed.data.name
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "");

        const project = await updateProjectService({
            userId,
            projectId: parsed.data.projectId,
            payload: {
                name: parsed.data.name,
                slug,
                description: parsed.data.description,
                status: parsed.data.status,
                visibility: parsed.data.visibility,
            },
        });

        revalidatePath(`/organizations/${parsed.data.orgSlug}/projects`);
        revalidatePath(`/organizations/${parsed.data.orgSlug}/projects/${project.slug}`);

        return { success: true, slug: project.slug ?? undefined };
    } catch (error) {
        console.error("Error updating project:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to update project",
        };
    }
}
