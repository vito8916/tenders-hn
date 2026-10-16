import 'server-only';
import { cache } from "react";
import { getUserOrgRole } from "@/features/memberships/repository";
import { saveCompanyProfileService } from "@/features/company-profile/services";
import { logAppEventService } from "@/features/events/services";
import { APP_EVENTS } from "@/features/events/schemas";
import { uploadOrganizationLogo } from "./repository";
import { getOrganizationLogoUrl } from "@/lib/utils/storage";
import { UserFacingError } from "@/lib/errors";
import {
    createOrganization,
    updateOrganization,
    deleteOrganization,
    getOrganizationBySlug,
    listOrganizationsByUser,
    checkSlugAvailability,
    transferOwnership,
} from "./repository";
import {
    canUpdateOrganization,
    canDeleteOrganization,
    canTransferOwnership,
} from "./rbac";
import type {
    CreateOrganizationInput,
    UpdateOrganizationInput,
    Organization,
    OrganizationListItem,
    CreateOrganizationWithCompanyInput,
} from "./schemas";

/**
 * Service layer for creating a new organization
 * Note: Any authenticated user can create an organization
 * A database trigger automatically creates the owner membership
 *
 * @param input - Validated organization creation input
 * @returns The created organization entity
 * @throws Error if creation fails or slug is already taken
 */
export async function createOrganizationService(input: CreateOrganizationInput): Promise<Organization> {
    // Create the organization via repository
    // Database trigger will automatically create owner membership
    const organization = await createOrganization(input);

    await logAppEventService({
        eventName: APP_EVENTS.ORGANIZATION_CREATED,
        orgId: organization.id,
        metadata: { name: organization.name, slug: organization.slug },
    });

    return organization;
}

/**
 * Service layer for updating an organization
 * Enforces permission checks before updating
 *
 * @param params - Object containing orgId, userId, and update payload
 * @returns The updated organization entity
 * @throws Error if user lacks permission or update fails
 */
export async function updateOrganizationService(params: {
    orgId: string;
    userId: string;
    payload: UpdateOrganizationInput;
    logoFile?: {
        buffer: Buffer;
        fileName: string;
        contentType: string;
    };
}): Promise<Organization> {
    const { orgId, userId, logoFile } = params;
    let payload = params.payload;

    // 1. Get user's role in the organization
    const role = await getUserOrgRole({ userId, orgId });

    if (!role) {
        throw new UserFacingError("Usted no es miembro de esta organización.");
    }

    // 2. Check RBAC permissions
    if (!canUpdateOrganization(role)) {
        throw new UserFacingError("Su rol no le permite editar la organización.");
    }

    // 3. Upload new logo if provided; the storage path (not a signed URL) is persisted
    if (logoFile) {
        const logoPath = await uploadOrganizationLogo({
            orgId,
            file: logoFile.buffer,
            fileName: logoFile.fileName,
            contentType: logoFile.contentType,
        });
        payload = { ...payload, orgLogoUrl: logoPath };
    }

    // 4. Update the organization via repository
    const organization = await updateOrganization(orgId, payload);

    await logAppEventService({
        eventName: APP_EVENTS.ORGANIZATION_UPDATED,
        orgId,
        metadata: { fields: Object.keys(payload) },
    });

    return organization;
}

/**
 * Service layer for deleting an organization
 * Only the owner can delete the organization
 * Cascade deletes will remove all related data
 *
 * @param params - Object containing orgId and userId
 * @throws Error if user lacks permission or delete fails
 */
export async function deleteOrganizationService(params: {
    orgId: string;
    userId: string;
}): Promise<void> {
    const { orgId, userId } = params;

    // 1. Get user's role in the organization
    const role = await getUserOrgRole({ userId, orgId });

    if (!role) {
        throw new UserFacingError("Usted no es miembro de esta organización.");
    }

    // 2. Check RBAC permissions (only owner can delete)
    if (!canDeleteOrganization(role)) {
        throw new UserFacingError("Solo el propietario puede eliminar la organización.");
    }

    // 3. Delete the organization via repository
    await deleteOrganization(orgId);

    // Logged without orgId: the organization row no longer exists
    await logAppEventService({
        eventName: APP_EVENTS.ORGANIZATION_DELETED,
        metadata: { orgId },
    });
}

/**
 * Service layer for fetching organization by slug with signed logo URL
 *
 * @param slug - Organization slug
 * @returns Organization entity with signed logo URL or null if not found
 * @throws Error if query fails
 */
export const getOrganizationBySlugService = cache(async (
    slug: string
): Promise<Organization | null> => {
    const organization = await getOrganizationBySlug({ slug });

    if (!organization) return null;

    // Generate signed URL for organization logo if it exists
    if (organization.orgLogoUrl) {
        const signedUrl = await getOrganizationLogoUrl(organization.orgLogoUrl);
        if (signedUrl) {
            organization.orgLogoUrl = signedUrl;
        } else {
            // Logo path exists in DB but file doesn't exist in storage - clear it
            organization.orgLogoUrl = null;
        }
    }

    return organization;
});

/**
 * Service layer for fetching user's organizations with signed logo URLs
 *
 * @param params - Object containing userId
 * @returns Array of organization list items with signed logo URLs
 * @throws Error if query fails
 */
export async function listOrganizationsByUserService(params: { userId: string }): Promise<OrganizationListItem[]> {
    const organizations = await listOrganizationsByUser({ userId: params.userId });

    // Generate signed URLs for organization logos
    const organizationsWithSignedUrls = await Promise.all(
        organizations.map(async (org) => {
            if (org.orgLogoUrl) {
                const signedUrl = await getOrganizationLogoUrl(org.orgLogoUrl);
                if (signedUrl) {
                    return { ...org, orgLogoUrl: signedUrl };
                } else {
                    // Logo path exists in DB but file doesn't exist in storage - clear it
                    return { ...org, orgLogoUrl: null };
                }
            }
            return org;
        })
    );

    return organizationsWithSignedUrls;
}

const MAX_SLUG_ATTEMPTS = 50;

/** A URL identifier from the organization's name; a numeric suffix keeps it unique when another organization has it. */
async function generateOrganizationSlug(name: string): Promise<string> {
    const readable = name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40)
        .replace(/-$/, "");
    const base = readable.length >= 2 ? readable : "organizacion";

    for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
        const candidate = attempt === 1 ? base : `${base}-${attempt}`;
        if ((await checkSlugAvailability(candidate)).isAvailable) return candidate;
    }
    throw new UserFacingError("No se pudo generar la dirección de la organización. Pruebe con otro nombre.");
}

/**
 * Service layer for creating an organization from its name and what the company sells,
 * which is what «Recomendadas» needs to run once the plan is active
 *
 * @throws Error if any step fails
 */
export async function createOrganizationWithCompanyProfileService(params: {
    ownerId: string;
    input: CreateOrganizationWithCompanyInput;
}): Promise<Organization> {
    const organization = await createOrganizationService({
        name: params.input.name,
        slug: await generateOrganizationSlug(params.input.name),
        ownerId: params.ownerId,
        orgLogoUrl: null,
    });
    await saveCompanyProfileService({ orgId: organization.id, input: params.input.companyProfile });

    return organization;
}

/**
 * Service layer for transferring organization ownership
 * The RPC enforces owner-only and member-target atomically; the app-level
 * check here just produces a clearer error before hitting the database
 *
 * @throws Error if the user is not the owner or the transfer fails
 */
export async function transferOwnershipService(params: {
    orgId: string;
    userId: string;
    newOwnerUserId: string;
}): Promise<void> {
    const { orgId, userId, newOwnerUserId } = params;

    const role = await getUserOrgRole({ userId, orgId });
    if (!role || !canTransferOwnership(role)) {
        throw new UserFacingError("Solo el propietario puede transferir la propiedad.");
    }

    await transferOwnership({ orgId, newOwnerUserId });

    await logAppEventService({
        eventName: APP_EVENTS.ORGANIZATION_OWNERSHIP_TRANSFERRED,
        orgId,
        metadata: { newOwnerUserId },
    });
}
