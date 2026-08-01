import 'server-only';
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";
import {
    organizationSchema,
    organizationListItemSchema,
    type Organization,
    type OrganizationListItem,
    type CreateOrganizationInput,
    type UpdateOrganizationInput,
} from "./schemas";

type OrganizationRow = Tables<"organizations">;

// ========== MAPPERS ==========

/**
 * Maps a database row to an Organization entity
 * Converts snake_case to camelCase and validates with Zod
 */
export function mapOrganizationRow(row: OrganizationRow): Organization {
    const mapped = {
        id: row.id,
        name: row.name,
        slug: row.slug,
        ownerId: row.owner_id,
        orgLogoUrl: row.org_logo_url,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };

    return organizationSchema.parse(mapped);
}

/**
 * Maps a lightweight organization row to OrganizationListItem
 * Used for list views with minimal data
 */
export function mapOrganizationListItem(row: {
    id: string;
    name: string;
    slug: string;
    org_logo_url: string | null;
    member_count?: number;
}): OrganizationListItem {
    const mapped = {
        id: row.id,
        name: row.name,
        slug: row.slug,
        orgLogoUrl: row.org_logo_url,
        memberCount: row.member_count,
    };

    return organizationListItemSchema.parse(mapped);
}

// ========== QUERIES ==========

/**
 * Fetches a single organization by ID
 * @param params - Object containing orgId
 * @returns Organization entity or null if not found
 * @throws Supabase error if query fails
 */
export async function getOrganizationById(params: { orgId: string }): Promise<Organization | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", params.orgId)
        .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return mapOrganizationRow(data);
}

/**
 * Fetches a single organization by slug
 * @param params - Object containing slug
 * @returns Organization entity or null if not found
 * @throws Supabase error if query fails
 */
export async function getOrganizationBySlug(params: { slug: string }): Promise<Organization | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("slug", params.slug)
        .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return mapOrganizationRow(data);
}

/**
 * Lists all organizations a user belongs to
 * Joins with organization_members to get user's organizations
 * Includes member count for each organization
 * Note: Logo URL conversion to signed URLs is handled in the service layer
 *
 * @param params - Object containing userId
 * @returns Array of organization list items with member counts
 * @throws Supabase error if query fails or RLS denies access
 */
export async function listOrganizationsByUser(params: { userId: string }): Promise<OrganizationListItem[]> {
    const supabase = await createClient();

    // First get the user's organizations
    // .returns<> pins the embed type: the org_id FK makes this a to-one join
    const { data: membershipData, error: membershipError } = await supabase
        .from("organization_members")
        .select(
            `
            organizations (
                id,
                name,
                slug,
                org_logo_url
            )
        `
        )
        .eq("user_id", params.userId)
        .order("created_at", { ascending: false })
        .returns<{
            organizations: {
                id: string;
                name: string;
                slug: string;
                org_logo_url: string | null;
            } | null;
        }[]>();

    if (membershipError) throw membershipError;

    // Extract organizations from the join result
    const organizations = (membershipData ?? [])
        .map((item) => item.organizations)
        .filter((org) => org !== null);

    if (organizations.length === 0) return [];

    // Get member counts for all organizations in one query
    const orgIds = organizations.map((org) => org.id);
    const { data: countData, error: countError } = await supabase
        .from("organization_members")
        .select("org_id")
        .in("org_id", orgIds);

    if (countError) throw countError;

    // Count members per organization
    const memberCounts = (countData ?? []).reduce<Record<string, number>>((acc, row) => {
        acc[row.org_id] = (acc[row.org_id] || 0) + 1;
        return acc;
    }, {});

    // Map organizations with member counts (logo URL conversion happens in service layer)
    const orgsWithCounts = organizations.map((org) => ({
        ...org,
        member_count: memberCounts[org.id] || 0,
    }));

    return orgsWithCounts.map(mapOrganizationListItem);
}

/**
 * Checks if an organization slug is available
 * @param slug - The slug to check
 * @returns Object with isAvailable boolean
 * @throws Supabase error if query fails
 */
export async function checkSlugAvailability(slug: string): Promise<{ isAvailable: boolean }> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("organizations")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

    if (error) throw error;

    return {
        isAvailable: data === null,
    };
}

// ========== MUTATIONS ==========

/**
 * Creates a new organization in the database
 * Note: A database trigger automatically creates the owner membership
 *
 * @param input - Validated organization creation input
 * @returns The created organization entity
 * @throws Supabase error if insert fails or RLS denies access
 */
export async function createOrganization(input: CreateOrganizationInput): Promise<Organization> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("organizations")
        .insert({
            name: input.name,
            slug: input.slug,
            owner_id: input.ownerId,
            org_logo_url: input.orgLogoUrl ?? null,
        })
        .select("*")
        .single();

    if (error) throw error;
    return mapOrganizationRow(data);
}

/**
 * Updates an existing organization in the database
 * @param orgId - UUID of the organization to update
 * @param payload - Partial organization data to update
 * @returns The updated organization entity
 * @throws Supabase error if update fails or RLS denies access
 */
export async function updateOrganization(orgId: string, payload: UpdateOrganizationInput): Promise<Organization> {
    const supabase = await createClient();

    // Build patch object with only provided fields
    const patch: Record<string, unknown> = {};
    if (payload.name !== undefined) patch.name = payload.name;
    if (payload.slug !== undefined) patch.slug = payload.slug;
    if (payload.orgLogoUrl !== undefined) patch.org_logo_url = payload.orgLogoUrl;

    const { data, error } = await supabase
        .from("organizations")
        .update(patch)
        .eq("id", orgId)
        .select("*")
        .single();

    if (error) throw error;
    return mapOrganizationRow(data);
}

/**
 * Deletes an organization from the database
 * Note: Cascade deletes will remove related members, projects, etc.
 *
 * @param orgId - UUID of the organization to delete
 * @throws Supabase error if delete fails or RLS denies access
 */
export async function deleteOrganization(orgId: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
        .from("organizations")
        .delete()
        .eq("id", orgId);

    if (error) throw error;
}

/**
 * Transfers organization ownership via SECURITY DEFINER RPC
 * The database validates the caller is the owner and the target is a member,
 * then swaps roles and updates organizations.owner_id atomically
 * @throws Supabase error with the validation reason (e.g. not_owner)
 */
export async function transferOwnership(params: {
    orgId: string;
    newOwnerUserId: string;
}): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase.rpc("transfer_organization_ownership", {
        target_org: params.orgId,
        new_owner_user_id: params.newOwnerUserId,
    });

    if (error) throw error;
}

// ========== STORAGE ==========

/**
 * Uploads an organization logo to Supabase Storage
 * @param params - Object containing orgId, file buffer, and file name
 * @returns The storage path (e.g., "org-id/filename.jpg")
 * @throws Error if upload fails
 */
export async function uploadOrganizationLogo(params: {
    orgId: string;
    file: Buffer;
    fileName: string;
    contentType: string;
}): Promise<string> {
    const supabase = await createClient();

    // Create path: org-id/filename.ext
    const filePath = `${params.orgId}/${params.fileName}`;

    const { error } = await supabase.storage
        .from("organization-logos")
        .upload(filePath, params.file, {
            contentType: params.contentType,
            upsert: true, // Replace if exists
        });

    if (error) throw error;

    return filePath;
}

