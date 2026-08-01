import 'server-only';
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";
import {
    projectMemberSchema,
    projectMemberWithProfileSchema,
    type ProjectMember,
    type ProjectMemberWithProfile,
} from "./schemas";

type ProjectMemberRow = Tables<"project_members">;

// ========== MAPPERS ==========

/**
 * Maps a database row to a ProjectMember entity
 * Converts snake_case to camelCase and validates with Zod
 */
export function mapProjectMemberRow(row: ProjectMemberRow): ProjectMember {
    const mapped = {
        id: row.id,
        orgId: row.org_id,
        projectId: row.project_id,
        userId: row.user_id,
        createdAt: row.created_at,
    };

    return projectMemberSchema.parse(mapped);
}

// ========== QUERIES ==========

/**
 * Lists all members assigned to a project, enriched with profile and org role
 * project_members has no FK to profiles/organization_members, so this merges
 * three queries (RLS: any org owner/admin/teammate can read)
 * @throws Supabase error if a query fails
 */
export async function listProjectMembers(params: {
    projectId: string;
}): Promise<ProjectMemberWithProfile[]> {
    const supabase = await createClient();

    const { data: rows, error } = await supabase
        .from("project_members")
        .select("*")
        .eq("project_id", params.projectId)
        .order("created_at", { ascending: true });

    if (error) throw error;
    if (rows.length === 0) return [];

    const userIds = rows.map((row) => row.user_id);

    const [{ data: profiles, error: profilesError }, { data: memberships, error: membershipsError }] =
        await Promise.all([
            supabase.from("profiles").select("id, full_name, email, avatar_url").in("id", userIds),
            supabase
                .from("organization_members")
                .select("user_id, role")
                .eq("org_id", rows[0].org_id)
                .in("user_id", userIds),
        ]);

    if (profilesError) throw profilesError;
    if (membershipsError) throw membershipsError;

    const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
    const rolesByUserId = new Map(memberships.map((membership) => [membership.user_id, membership.role]));

    return rows.map((row) => {
        const profile = profilesById.get(row.user_id);
        return projectMemberWithProfileSchema.parse({
            ...mapProjectMemberRow(row),
            fullName: profile?.full_name ?? null,
            email: profile?.email ?? null,
            avatarUrl: profile?.avatar_url ?? null,
            orgRole: rolesByUserId.get(row.user_id) ?? "member",
        });
    });
}

/**
 * Checks whether a user is assigned to a project
 * @throws Supabase error if query fails
 */
export async function isProjectMember(params: {
    projectId: string;
    userId: string;
}): Promise<boolean> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("project_members")
        .select("id")
        .eq("project_id", params.projectId)
        .eq("user_id", params.userId)
        .maybeSingle();

    if (error) throw error;
    return data !== null;
}

// ========== MUTATIONS ==========

/**
 * Assigns an org member to a project
 * @throws Supabase error if insert fails or RLS denies access
 */
export async function assignProjectMember(params: {
    orgId: string;
    projectId: string;
    userId: string;
}): Promise<ProjectMember> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("project_members")
        .insert({ org_id: params.orgId, project_id: params.projectId, user_id: params.userId })
        .select("*")
        .single();

    if (error) throw error;
    return mapProjectMemberRow(data);
}

/**
 * Removes an org member's assignment from a project
 * @throws Supabase error if delete fails or RLS denies access
 */
export async function removeProjectMember(params: {
    projectId: string;
    userId: string;
}): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
        .from("project_members")
        .delete()
        .eq("project_id", params.projectId)
        .eq("user_id", params.userId);

    if (error) throw error;
}
