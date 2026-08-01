"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import type { InviteItem } from "@/features/invitations/schemas";
import {
    createOrganizationInputSchema,
    updateOrganizationInputSchema,
} from "./schemas";
import {
    createOrganizationService,
    updateOrganizationService,
    deleteOrganizationService,
    checkSlugAvailabilityService,
    createOrganizationWithInvitesService,
    transferOwnershipService,
} from "./services";

/**
 * Server Action for creating a new organization
 * Entry point from UI components
 *
 * @param formData - Form data from client
 * @throws Redirects on success, throws error on failure
 */
export async function createOrganizationAction(formData: FormData) {
    // 1. Resolve authenticated user
    const { sub: userId } = await getCurrentUser();

    // 2. Parse and validate input using Zod
    const parsed = createOrganizationInputSchema.safeParse({
        name: formData.get("name") ? String(formData.get("name")) : "",
        slug: formData.get("slug") ? String(formData.get("slug")) : "",
        ownerId: userId,
        orgLogoUrl: formData.get("orgLogoUrl") ? String(formData.get("orgLogoUrl")) : null,
    });

    if (!parsed.success) {
        throw new Error(parsed.error.message);
    }

    // 3. Call service layer
    const organization = await createOrganizationService(parsed.data);

    // 4. Redirect to new organization
    redirect(`/organizations/${organization.slug}`);
}

/**
 * Server Action for updating an organization
 * Entry point from UI components
 *
 * @param formData - Form data with name, slug, and optional orgLogoFile
 * @param orgId - Organization ID from route or context
 * @returns Result with the (possibly new) slug for client-side navigation
 */
export async function updateOrganizationAction(
    formData: FormData,
    orgId: string
): Promise<{ success: boolean; slug?: string; error?: string }> {
    try {
        // 1. Resolve authenticated user
        const { sub: userId } = await getCurrentUser();

        // 2. Parse and validate input using Zod
        const parsed = updateOrganizationInputSchema.safeParse({
            name: formData.get("name") ? String(formData.get("name")) : undefined,
            slug: formData.get("slug") ? String(formData.get("slug")) : undefined,
        });

        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
        }

        // 3. Process logo file if provided
        const ORG_LOGO_MAX_BYTES = 2 * 1024 * 1024; // 2MB
        const orgLogoFile = formData.get("orgLogoFile") as File | null;

        let logoFileData: { buffer: Buffer; fileName: string; contentType: string } | undefined;

        if (orgLogoFile && orgLogoFile.size > 0) {
            if (orgLogoFile.size > ORG_LOGO_MAX_BYTES) {
                return { success: false, error: "Organization logo must be 2 MB or smaller." };
            }
            const arrayBuffer = await orgLogoFile.arrayBuffer();
            const extension = orgLogoFile.name.split('.').pop() || 'png';
            logoFileData = {
                buffer: Buffer.from(arrayBuffer),
                fileName: `logo.${extension}`,
                contentType: orgLogoFile.type || 'image/png',
            };
        }

        // 4. Call service layer (handles RBAC and repository)
        const organization = await updateOrganizationService({
            orgId,
            userId,
            payload: parsed.data,
            logoFile: logoFileData,
        });

        // 5. Revalidate relevant paths
        revalidatePath(`/organizations/${organization.slug}`);
        revalidatePath("/organizations");

        return { success: true, slug: organization.slug };
    } catch (error) {
        console.error("Error updating organization:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to update organization",
        };
    }
}

/**
 * Server Action for deleting an organization
 * Entry point from UI components
 * Only the owner can delete the organization
 *
 * @param orgId - Organization ID to delete
 * @throws Redirects on success, throws error on failure
 */
export async function deleteOrganizationAction(orgId: string) {
    // 1. Resolve authenticated user
    const { sub: userId } = await getCurrentUser();

    // 2. Call service layer (handles RBAC and repository)
    await deleteOrganizationService({ orgId, userId });

    // 3. Redirect to organizations list
    redirect("/organizations");
}

const checkSlugAvailabilitySchema = z.object({
    slug: z.string().min(1, "Slug is required"),
});

/**
 * Server Action for checking organization slug availability
 * Entry point from UI components
 *
 * @param slug - The slug to check
 * @returns Object with isAvailable boolean
 * @throws Error on failure
 */
export async function checkSlugAvailabilityAction(slug: string): Promise<{ isAvailable: boolean }> {
    // Validate input
    const parsed = checkSlugAvailabilitySchema.safeParse({ slug });

    if (!parsed.success) {
        throw new Error(parsed.error.message);
    }

    // Call service layer
    return await checkSlugAvailabilityService(parsed.data.slug);
}

/**
 * Server Action for creating an organization with invitations
 * Entry point from UI components
 *
 * @param formData - Form data from client containing name, slug, invites (JSON), and optional orgLogoFile
 * @returns Object with success status, redirectUrl, and optional error message
 */
export async function createOrganizationWithInvitesAction(formData: FormData): Promise<{
    success: boolean;
    redirectUrl?: string;
    error?: string;
}> {
    try {
        // 1. Resolve authenticated user
        const { sub: userId } = await getCurrentUser();

        // 2. Parse form data
        const name = formData.get("name") ? String(formData.get("name")) : "";
        const slug = formData.get("slug") ? String(formData.get("slug")) : "";
        const invitesJson = formData.get("invites") ? String(formData.get("invites")) : "[]";
        const orgLogoFile = formData.get("orgLogoFile") as File | null;

        // 3. Parse and validate invites
        let invites: InviteItem[] = [];
        try {
            const parsedInvites = JSON.parse(invitesJson);
            invites = parsedInvites.filter((inv: InviteItem) => inv.email && inv.email.trim() !== "");
        } catch {
            return {
                success: false,
                error: "Invalid invites format",
            };
        }

        // 4. Validate organization input
        const parsed = createOrganizationInputSchema.safeParse({
            name: name.trim(),
            slug: slug.trim(),
            ownerId: userId,
            orgLogoUrl: null, // Will be set after upload if file provided
        });

        if (!parsed.success) {
            return {
                success: false,
                error: parsed.error.message,
            };
        }

        // 5. Process logo file if provided
        const ORG_LOGO_MAX_BYTES = 2 * 1024 * 1024; // 2MB

        let logoFileData: {
            buffer: Buffer;
            fileName: string;
            contentType: string;
        } | undefined;

        if (orgLogoFile && orgLogoFile.size > 0) {
            if (orgLogoFile.size > ORG_LOGO_MAX_BYTES) {
                return {
                    success: false,
                    error: "Organization logo must be 2 MB or smaller.",
                };
            }
            const arrayBuffer = await orgLogoFile.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Generate a safe filename
            const originalName = orgLogoFile.name;
            const extension = originalName.split('.').pop() || 'png';
            const fileName = `logo.${extension}`;

            logoFileData = {
                buffer,
                fileName,
                contentType: orgLogoFile.type || 'image/png',
            };
        }

        // 6. Call service layer
        const organization = await createOrganizationWithInvitesService({
            organizationInput: parsed.data,
            logoFile: logoFileData,
            invites,
        });

        // 7. Return success with redirect URL
        return {
            success: true,
            redirectUrl: `/organizations/${organization.slug}`,
        };
    } catch (error) {
        console.error("Error creating organization with invites:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to create organization",
        };
    }
}

const transferOwnershipActionSchema = z.object({
    orgId: z.uuid(),
    orgSlug: z.string().min(1),
    newOwnerUserId: z.uuid(),
});

const TRANSFER_ERROR_MESSAGES: Record<string, string> = {
    not_owner: "Only the owner can transfer ownership.",
    target_not_member: "The new owner must be a member of the organization.",
    transfer_to_self: "You already own this organization.",
};

/**
 * Server Action for transferring organization ownership
 * The caller becomes an admin; the target member becomes the owner
 */
export async function transferOwnershipAction(input: {
    orgId: string;
    orgSlug: string;
    newOwnerUserId: string;
}): Promise<{ success: boolean; error?: string }> {
    try {
        const { sub: userId } = await getCurrentUser();

        const parsed = transferOwnershipActionSchema.safeParse(input);
        if (!parsed.success) {
            return { success: false, error: "Invalid input" };
        }

        await transferOwnershipService({
            orgId: parsed.data.orgId,
            userId,
            newOwnerUserId: parsed.data.newOwnerUserId,
        });

        revalidatePath(`/organizations/${parsed.data.orgSlug}/members`);
        revalidatePath(`/organizations/${parsed.data.orgSlug}`);

        return { success: true };
    } catch (error) {
        console.error("Error transferring ownership:", error);
        const raw = error instanceof Error ? error.message : "";
        const known = Object.keys(TRANSFER_ERROR_MESSAGES).find((key) => raw.includes(key));
        return {
            success: false,
            error: known ? TRANSFER_ERROR_MESSAGES[known] : "Failed to transfer ownership",
        };
    }
}
