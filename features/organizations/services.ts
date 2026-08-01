import 'server-only';
import { cache } from "react";
import { getUserOrgRole, countOrgMembers } from "@/features/memberships/repository";
import { countProjectsByOrg } from "@/features/projects/repository";
import { countPendingInvitations } from "@/features/invitations/repository";
import { inviteMembersService } from "@/features/invitations/services";
import { logAppEventService } from "@/features/events/services";
import { APP_EVENTS } from "@/features/events/schemas";
import { uploadOrganizationLogo } from "./repository";
import { getOrganizationLogoUrl } from "@/lib/utils/storage";
import type { InviteItem } from "@/features/invitations/schemas";
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
    canViewSettings,
    canTransferOwnership,
} from "./rbac";
import type {
    CreateOrganizationInput,
    UpdateOrganizationInput,
    Organization,
    OrganizationListItem,
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
        throw new Error("User is not a member of this organization");
    }

    // 2. Check RBAC permissions
    if (!canUpdateOrganization(role)) {
        throw new Error(`Insufficient permissions: ${role} cannot update organization`);
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
        throw new Error("User is not a member of this organization");
    }

    // 2. Check RBAC permissions (only owner can delete)
    if (!canDeleteOrganization(role)) {
        throw new Error(`Insufficient permissions: only owner can delete organization`);
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

/**
 * Service layer for checking organization slug availability
 *
 * @param slug - The slug to check
 * @returns Object with isAvailable boolean
 * @throws Error if query fails
 */
export async function checkSlugAvailabilityService(
    slug: string
): Promise<{ isAvailable: boolean }> {
    return checkSlugAvailability(slug);
}

/**
 * Service layer for creating an organization with invitations
 * Orchestrates: org creation -> logo upload (if provided) -> org update -> invitation creation
 *
 * @param params - Object containing organization data, optional logo file, and invitations
 * @returns The created organization entity
 * @throws Error if any step fails
 */
export async function createOrganizationWithInvitesService(params: {
    organizationInput: CreateOrganizationInput;
    logoFile?: {
        buffer: Buffer;
        fileName: string;
        contentType: string;
    };
    invites: InviteItem[];
}): Promise<Organization> {
    // Step 1: Create organization (without logo initially)
    const orgInputWithoutLogo: CreateOrganizationInput = {
        ...params.organizationInput,
        orgLogoUrl: null,
    };
    let organization = await createOrganizationService(orgInputWithoutLogo);

    try {
        // Step 2: Upload logo if provided and update organization
        // The storage path is persisted; signed URLs are generated on read
        if (params.logoFile) {
            const logoPath = await uploadOrganizationLogo({
                orgId: organization.id,
                file: params.logoFile.buffer,
                fileName: params.logoFile.fileName,
                contentType: params.logoFile.contentType,
            });

            organization = await updateOrganization(organization.id, {
                orgLogoUrl: logoPath,
            });
        }

        // Step 3: Create invitations and send emails if any
        if (params.invites.length > 0) {
            await inviteMembersService({
                orgId: organization.id,
                userId: params.organizationInput.ownerId,
                invites: params.invites,
            });
        }

        return organization;
    } catch (error) {
        // If logo upload or invitation creation fails, the org is already created
        // This is acceptable - the org exists, just without logo/invitations
        // In a production system, you might want to rollback the org creation
        // For now, we'll let it succeed and log the error
        console.error("Error uploading logo or creating invitations:", error);
        throw error;
    }
}

/**
 * Service layer for the organization dashboard overview
 * Pending invitations are only counted for owner/admin (matching RLS)
 *
 * @throws Error if the user is not a member of the organization
 */
export async function getOrganizationOverviewService(params: {
    orgId: string;
    userId: string;
}): Promise<{
    projectsCount: number;
    membersCount: number;
    pendingInvitationsCount: number | null;
}> {
    const { orgId, userId } = params;

    const role = await getUserOrgRole({ userId, orgId });
    if (!role) {
        throw new Error("User is not a member of this organization");
    }

    const [projectsCount, membersCount, pendingInvitationsCount] = await Promise.all([
        countProjectsByOrg({ orgId }),
        countOrgMembers({ orgId }),
        canViewSettings(role) ? countPendingInvitations({ orgId }) : Promise.resolve(null),
    ]);

    return { projectsCount, membersCount, pendingInvitationsCount };
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
        throw new Error("Insufficient permissions: only the owner can transfer ownership");
    }

    await transferOwnership({ orgId, newOwnerUserId });

    await logAppEventService({
        eventName: APP_EVENTS.ORGANIZATION_OWNERSHIP_TRANSFERRED,
        orgId,
        metadata: { newOwnerUserId },
    });
}
