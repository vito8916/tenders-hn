import 'server-only';
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";
import {
    organizationMembershipSchema,
    orgMemberSchema,
    type OrganizationMembership,
    type OrgMember,
    type OrgRole,
    type AssignableRole,
} from "./schemas";

type MembershipRow = Tables<"organization_members">;

// ========== MAPPERS ==========

/**
 * Maps a database row to an OrganizationMembership entity
 * Converts snake_case to camelCase and validates with Zod
 */
export function mapMembershipRow(row: MembershipRow): OrganizationMembership {
    const mapped = {
        id: row.id,
        orgId: row.org_id,
        userId: row.user_id,
        role: row.role,
        createdAt: row.created_at,
    };

    return organizationMembershipSchema.parse(mapped);
}

// ========== QUERIES ==========

/**
 * Gets a user's role in a specific organization
 * @param params - Object containing userId and orgId
 * @returns The user's role or null if not a member
 * @throws Supabase error if query fails
 */
export async function getUserOrgRole(params: {
    userId: string;
    orgId: string;
}): Promise<OrgRole | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("organization_members")
        .select("role")
        .eq("user_id", params.userId)
        .eq("org_id", params.orgId)
        .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return data.role as OrgRole;
}

/**
 * Gets a membership row by id
 * @throws Supabase error if query fails
 */
export async function getMembershipById(params: {
    membershipId: string;
}): Promise<OrganizationMembership | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("organization_members")
        .select("*")
        .eq("id", params.membershipId)
        .maybeSingle();

    if (error) throw error;
    return data ? mapMembershipRow(data) : null;
}

/**
 * Lists all members of an organization with their profile data
 * organization_members has no FK to profiles, so this merges two queries
 * (RLS: any member of the org can read both since the shared-org policies)
 * @throws Supabase error if a query fails
 */
export async function listOrgMembers(params: { orgId: string }): Promise<OrgMember[]> {
    const supabase = await createClient();

    const { data: memberships, error } = await supabase
        .from("organization_members")
        .select("*")
        .eq("org_id", params.orgId)
        .order("created_at", { ascending: true });

    if (error) throw error;
    if (memberships.length === 0) return [];

    const userIds = memberships.map((row) => row.user_id);

    const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .in("id", userIds);

    if (profilesError) throw profilesError;

    const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));

    return memberships.map((row) => {
        const profile = profilesById.get(row.user_id);
        return orgMemberSchema.parse({
            ...mapMembershipRow(row),
            fullName: profile?.full_name ?? null,
            email: profile?.email ?? null,
            avatarUrl: profile?.avatar_url ?? null,
        });
    });
}

// ========== MUTATIONS ==========

/**
 * Updates a member's role (RLS: only the org owner, never the owner row)
 * @throws Supabase error if update fails or RLS denies access
 */
export async function updateMemberRole(params: {
    membershipId: string;
    role: AssignableRole;
}): Promise<OrganizationMembership> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("organization_members")
        .update({ role: params.role })
        .eq("id", params.membershipId)
        .select("*")
        .single();

    if (error) throw error;
    return mapMembershipRow(data);
}

/**
 * Removes a member from an organization
 * (RLS: self-leave for non-owners, or owner/admin removing non-owners)
 * @throws Supabase error if delete fails or RLS denies access
 */
export async function removeMember(params: { membershipId: string }): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
        .from("organization_members")
        .delete()
        .eq("id", params.membershipId);

    if (error) throw error;
}

/**
 * Counts members of an organization
 * @throws Supabase error if query fails or RLS denies access
 */
export async function countOrgMembers(params: { orgId: string }): Promise<number> {
    const supabase = await createClient();

    const { count, error } = await supabase
        .from("organization_members")
        .select("*", { count: "exact", head: true })
        .eq("org_id", params.orgId);

    if (error) throw error;
    return count ?? 0;
}
