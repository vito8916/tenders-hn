"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import type { InviteItem } from "@/features/invitations/schemas";
import {
    createOrganizationInputSchema,
} from "@/features/organizations/schemas";
import {
    createOrganizationWithInvitesService,
} from "@/features/organizations/services";
import {
    updateProfileService,
    markOnboardingCompleteService,
} from "@/features/profiles/services";
import { updateProfileInputSchema } from "@/features/profiles/schemas";
import { uploadProfilePicture } from "@/features/profiles/repository";

const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png"];

async function validateAndProcessImageFile(
    file: File | null,
    fieldName: string
): Promise<{ buffer: Buffer; fileName: string; contentType: string } | null> {
    if (!file || file.size === 0) return null;

    if (file.size > IMAGE_MAX_BYTES) {
        throw new Error(`${fieldName} must be 2 MB or smaller.`);
    }
    if (!IMAGE_TYPES.includes(file.type)) {
        throw new Error(`${fieldName} must be PNG or JPEG.`);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const extension = file.name.split(".").pop() || "png";
    const fileName = `${fieldName.toLowerCase().replace(/\s+/g, "-")}.${extension}`;

    return {
        buffer,
        fileName,
        contentType: file.type || "image/png",
    };
}

/**
 * Server action to complete the onboarding flow.
 * Updates profile, creates organization with invites, marks onboarding complete.
 */
export async function completeOnboardingAction(formData: FormData): Promise<{
    success: boolean;
    redirectUrl?: string;
    error?: string;
}> {
    try {
        const { sub: userId } = await getCurrentUser();

        const fullName = formData.get("fullName") ? String(formData.get("fullName")) : "";
        const phone = formData.get("phone") ? String(formData.get("phone")) : "";
        const orgName = formData.get("orgName") ? String(formData.get("orgName")) : "";
        const orgSlug = formData.get("orgSlug") ? String(formData.get("orgSlug")) : "";
        const invitesJson = formData.get("invites") ? String(formData.get("invites")) : "[]";
        const avatarFile = formData.get("avatarFile") as File | null;
        const orgLogoFile = formData.get("orgLogoFile") as File | null;

        let invites: InviteItem[] = [];
        try {
            const parsedInvites = JSON.parse(invitesJson);
            invites = parsedInvites.filter((inv: InviteItem) => inv.email && inv.email.trim() !== "");
        } catch {
            return { success: false, error: "Invalid invites format" };
        }

        const profileInput = updateProfileInputSchema.safeParse({
            fullName: fullName.trim(),
            phone: phone.trim() || undefined,
        });

        if (!profileInput.success) {
            return { success: false, error: profileInput.error.message };
        }

        const orgInput = createOrganizationInputSchema.safeParse({
            name: orgName.trim(),
            slug: orgSlug.trim(),
            ownerId: userId,
            orgLogoUrl: null,
        });

        if (!orgInput.success) {
            return { success: false, error: orgInput.error.message };
        }

        const avatarFileData = await validateAndProcessImageFile(avatarFile, "avatar");
        let avatarPath: string | undefined;
        if (avatarFileData) {
            avatarPath = await uploadProfilePicture({
                userId,
                file: avatarFileData.buffer,
                fileName: avatarFileData.fileName,
                contentType: avatarFileData.contentType,
            });
        }

        await updateProfileService({
            userId,
            input: {
                ...profileInput.data,
                ...(avatarPath && { avatarUrl: avatarPath }),
            },
        });

        const logoFileData = await validateAndProcessImageFile(orgLogoFile, "logo");

        const organization = await createOrganizationWithInvitesService({
            organizationInput: orgInput.data,
            logoFile: logoFileData ? logoFileData : undefined,
            invites,
        });

        await markOnboardingCompleteService({ userId });

        redirect(`/organizations/${organization.slug}`);
    } catch (error) {
        if (error && typeof error === "object" && "digest" in error) {
            throw error;
        }
        console.error("Onboarding completion error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to complete onboarding",
        };
    }
}

/**
 * Server action to complete onboarding for invited users.
 * Updates the profile and marks onboarding complete without creating an
 * organization (the user joined one via invitation, or will browse theirs).
 */
export async function completeOnboardingWithoutOrgAction(formData: FormData): Promise<{
    success: boolean;
    error?: string;
}> {
    let redirectUrl = "/organizations";

    try {
        const { sub: userId } = await getCurrentUser();

        const fullName = formData.get("fullName") ? String(formData.get("fullName")) : "";
        const phone = formData.get("phone") ? String(formData.get("phone")) : "";
        const avatarFile = formData.get("avatarFile") as File | null;
        const joinedOrgSlug = formData.get("joinedOrgSlug") ? String(formData.get("joinedOrgSlug")) : "";

        const profileInput = updateProfileInputSchema.safeParse({
            fullName: fullName.trim(),
            phone: phone.trim() || undefined,
        });

        if (!profileInput.success) {
            return { success: false, error: profileInput.error.message };
        }

        const avatarFileData = await validateAndProcessImageFile(avatarFile, "avatar");
        let avatarPath: string | undefined;
        if (avatarFileData) {
            avatarPath = await uploadProfilePicture({
                userId,
                file: avatarFileData.buffer,
                fileName: avatarFileData.fileName,
                contentType: avatarFileData.contentType,
            });
        }

        await updateProfileService({
            userId,
            input: {
                ...profileInput.data,
                ...(avatarPath && { avatarUrl: avatarPath }),
            },
        });

        await markOnboardingCompleteService({ userId });

        if (joinedOrgSlug) {
            redirectUrl = `/organizations/${joinedOrgSlug}`;
        }
    } catch (error) {
        if (error && typeof error === "object" && "digest" in error) {
            throw error;
        }
        console.error("Onboarding completion error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to complete onboarding",
        };
    }

    redirect(redirectUrl);
}
