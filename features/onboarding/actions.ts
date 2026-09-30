"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createInvitationsInputSchema, type InviteItem } from "@/features/invitations/schemas";
import { inviteMembersService } from "@/features/invitations/services";
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
import { companyProfileInputSchema } from "@/features/company-profile/schemas";
import { saveCompanyProfileService } from "@/features/company-profile/services";
import { uploadProfilePicture } from "@/features/profiles/repository";
import { databaseErrorCode, userErrorMessage } from "@/lib/errors";

const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png"];

const PROFILE_ERROR_MESSAGE = "Revise su nombre y teléfono.";
const ONBOARDING_ERROR_MESSAGE = "No se pudo completar la configuración inicial. Intente de nuevo.";

/**
 * Returns a Spanish error when an uploaded image is too large or not PNG/JPEG.
 * Checked before any write so a bad file never leaves a half-created organization.
 */
function imageFileError(file: File | null, label: string): string | null {
    if (!file || file.size === 0) return null;
    if (file.size > IMAGE_MAX_BYTES) return `${label} debe pesar 2 MB o menos.`;
    if (!IMAGE_TYPES.includes(file.type)) return `${label} debe ser PNG o JPEG.`;
    return null;
}

async function processImageFile(
    file: File | null,
    fieldName: string
): Promise<{ buffer: Buffer; fileName: string; contentType: string } | null> {
    if (!file || file.size === 0) return null;

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
 * Server action for the plan step: updates the profile, creates the organization,
 * saves the company profile, and marks onboarding complete, so Paddle's checkout
 * can carry the organization's id. Invitations wait for the plan (they need one),
 * in finishOnboardingAction.
 */
export async function createOnboardingOrganizationAction(formData: FormData): Promise<
    | { success: true; orgId: string; orgSlug: string }
    | {
          success: false;
          error: string;
          // Another organization took the slug after the organization step checked it.
          slugTaken?: boolean;
      }
> {
    try {
        const { sub: userId } = await getCurrentUser();

        const fullName = formData.get("fullName") ? String(formData.get("fullName")) : "";
        const phone = formData.get("phone") ? String(formData.get("phone")) : "";
        const orgName = formData.get("orgName") ? String(formData.get("orgName")) : "";
        const orgSlug = formData.get("orgSlug") ? String(formData.get("orgSlug")) : "";
        const companyProfileJson = formData.get("companyProfile") ? String(formData.get("companyProfile")) : "{}";
        const avatarFile = formData.get("avatarFile") as File | null;
        const orgLogoFile = formData.get("orgLogoFile") as File | null;

        const profileInput = updateProfileInputSchema.safeParse({
            fullName: fullName.trim(),
            phone: phone.trim() || undefined,
        });

        if (!profileInput.success) {
            return { success: false, error: PROFILE_ERROR_MESSAGE };
        }

        const orgInput = createOrganizationInputSchema.safeParse({
            name: orgName.trim(),
            slug: orgSlug.trim(),
            ownerId: userId,
            orgLogoUrl: null,
        });

        if (!orgInput.success) {
            return {
                success: false,
                error: "Revise el nombre y el identificador en la URL de la organización.",
            };
        }

        let companyProfileData: unknown;
        try {
            companyProfileData = JSON.parse(companyProfileJson);
        } catch {
            return { success: false, error: "El perfil de la empresa no tiene un formato válido." };
        }
        const companyProfileInput = companyProfileInputSchema.safeParse(companyProfileData);
        if (!companyProfileInput.success) {
            return {
                success: false,
                error: companyProfileInput.error.issues[0]?.message ?? "Revise el perfil de la empresa.",
            };
        }

        const imageError =
            imageFileError(avatarFile, "La foto de perfil") ??
            imageFileError(orgLogoFile, "El logo de la organización");
        if (imageError) {
            return { success: false, error: imageError };
        }

        const avatarFileData = await processImageFile(avatarFile, "avatar");
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

        const logoFileData = await processImageFile(orgLogoFile, "logo");

        const organization = await createOrganizationWithInvitesService({
            organizationInput: orgInput.data,
            logoFile: logoFileData ? logoFileData : undefined,
            invites: [],
        });

        await saveCompanyProfileService({ orgId: organization.id, input: companyProfileInput.data });

        await markOnboardingCompleteService({ userId });

        return { success: true, orgId: organization.id, orgSlug: organization.slug };
    } catch (error) {
        console.error("Onboarding completion error:", error);
        return {
            success: false,
            error: userErrorMessage(error, ONBOARDING_ERROR_MESSAGE),
            slugTaken: databaseErrorCode(error) === "organizations_slug_key",
        };
    }
}

/**
 * Server action for the last step: sends the invitations, now that the plan is
 * active, and opens the organization.
 */
export async function finishOnboardingAction(input: { orgId: string; orgSlug: string; invites: InviteItem[] }): Promise<{
    success: false;
    error: string;
}> {
    try {
        const { sub: userId } = await getCurrentUser();

        if (input.invites.length > 0) {
            const parsed = createInvitationsInputSchema.safeParse({ orgId: input.orgId, invites: input.invites });
            if (!parsed.success) {
                return { success: false, error: parsed.error.issues[0]?.message ?? "Revise las invitaciones." };
            }
            await inviteMembersService({ orgId: parsed.data.orgId, userId, invites: parsed.data.invites });
        }
    } catch (error) {
        console.error("Onboarding invitations error:", error);
        return { success: false, error: userErrorMessage(error, "No se pudieron enviar las invitaciones. Intente de nuevo.") };
    }

    redirect(`/organizations/${encodeURIComponent(input.orgSlug)}`);
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
            return { success: false, error: PROFILE_ERROR_MESSAGE };
        }

        const imageError = imageFileError(avatarFile, "La foto de perfil");
        if (imageError) {
            return { success: false, error: imageError };
        }

        const avatarFileData = await processImageFile(avatarFile, "avatar");
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
            error: userErrorMessage(error, ONBOARDING_ERROR_MESSAGE),
        };
    }

    redirect(redirectUrl);
}
