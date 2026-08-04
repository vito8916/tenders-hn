import 'server-only';
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";
import {
    projectSchema,
    ProjectListItemSchema,
    type Project,
    type ProjectListItem,
    type CreateProjectInput,
    type UpdateProjectInput,
} from "./schemas";

type ProjectRow = Tables<"projects">;

// ========== MAPPERS ==========

/**
 * Maps a database row to a Project entity
 * Converts snake_case to camelCase and validates with Zod
 */
export function mapProjectRow(row: ProjectRow): Project {
    const mapped = {
        id: row.id,
        orgId: row.org_id,
        ownerId: row.owner_id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        status: row.status,
        visibility: row.visibility,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };

    return projectSchema.parse(mapped);
}

/**
 * Maps a lightweight project row to ProjectListItem
 * Used for list views with minimal data
 */
export function mapProjectListItem(row: {
    id: string;
    org_id: string;
    name: string;
    slug: string;
    description: string | null;
    visibility: string;
    status: string;
    created_at: string;
    updated_at: string;
    isFavorite?: boolean;
}): ProjectListItem {
    const mapped = {
        id: row.id,
        orgId: row.org_id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        visibility: row.visibility,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        isFavorite: row.isFavorite,
    };

    return ProjectListItemSchema.parse(mapped);
}

// ========== QUERIES ==========

/**
 * Fetches a single project by ID
 * @param params - Object containing projectId
 * @returns Project entity or null if not found
 * @throws Supabase error if query fails (except PGRST116 - not found)
 */
export async function getProjectById(params: { projectId: string }): Promise<Project | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", params.projectId)
        .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return mapProjectRow(data);
}

/**
 * Fetches a single project by slug within an organization
 * @param params - Object containing orgId and slug
 * @returns Project entity or null if not found
 * @throws Supabase error if query fails
 */
export async function getProjectBySlugAndOrg(params: {
    orgId: string;
    slug: string;
}): Promise<Project | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("org_id", params.orgId)
        .eq("slug", params.slug)
        .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return mapProjectRow(data);
}

/**
 * Lists all projects for a given organization
 * @param params - Object containing orgId
 * @returns Array of project entities ordered by creation date (newest first)
 * @throws Supabase error if query fails or RLS denies access
 */
export async function listProjectsByOrg(params: { orgId: string }): Promise<Project[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("org_id", params.orgId)
        .order("created_at", { ascending: false });

    if (error) throw error;

    return (data ?? []).map(mapProjectRow);
}

/**
 * Lists all projects owned by a specific user
 * @param params - Object containing userId
 * @returns Array of project list items ordered by update date (newest first)
 * @throws Supabase error if query fails or RLS denies access
 */
export async function listProjectsByUser(params: { userId: string }): Promise<ProjectListItem[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("projects")
        .select("id, org_id, name, slug, description, visibility, status, created_at, updated_at")
        .eq("owner_id", params.userId)
        .order("updated_at", { ascending: false });

    if (error) throw error;

    return (data ?? []).map(mapProjectListItem);
}

/**
 * Lists all projects for an organization with favorite status for a user
 * Uses a left join to include favorite information
 *
 * @param params - Object containing orgId and userId
 * @returns Array of project list items with isFavorite flag
 * @throws Supabase error if query fails or RLS denies access
 */
export async function listProjectsWithFavoritesByOrg(params: {
    orgId: string;
    userId: string;
}): Promise<ProjectListItem[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("projects")
        .select(
            `
      id, org_id, name, slug, description, visibility, status, created_at, updated_at,
      project_favorites!left(user_id)
    `
        )
        .eq("org_id", params.orgId)
        .order("updated_at", { ascending: false });

    if (error) throw error;

    return (data ?? []).map((row) => {
        const favorites = Array.isArray(row.project_favorites) ? row.project_favorites : [];
        const isFavorite = favorites.some((favorite) => favorite.user_id === params.userId);

        return mapProjectListItem({
            id: row.id,
            org_id: row.org_id,
            name: row.name,
            slug: row.slug,
            description: row.description,
            visibility: row.visibility,
            status: row.status,
            created_at: row.created_at,
            updated_at: row.updated_at,
            isFavorite,
        });
    });
}

/**
 * Lists favorite projects for a user within a specific organization
 * Joins project_favorites with projects to get only favorited projects
 *
 * @param params - Object containing userId and orgId
 * @returns Array of project list items that are favorited by the user
 * @throws Supabase error if query fails or RLS denies access
 */
export async function listFavoriteProjectsByUser(params: {
    userId: string;
    orgId: string;
}): Promise<ProjectListItem[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("project_favorites")
        .select(
            `
            project_id,
            projects!inner(
                id, org_id, name, slug, description, visibility, status, created_at, updated_at
            )
        `
        )
        .eq("user_id", params.userId)
        .eq("org_id", params.orgId)
        .order("created_at", { ascending: false })
        .returns<{
            project_id: string;
            projects: {
                id: string;
                org_id: string;
                name: string;
                slug: string;
                description: string | null;
                visibility: string;
                status: string;
                created_at: string;
                updated_at: string;
            };
        }[]>();

    if (error) throw error;

    return (data ?? []).map((row) => {
        const project = row.projects;
        return mapProjectListItem({
            id: project.id,
            org_id: project.org_id,
            name: project.name,
            slug: project.slug,
            description: project.description,
            visibility: project.visibility,
            status: project.status,
            created_at: project.created_at,
            updated_at: project.updated_at,
            isFavorite: true,
        });
    });
}

// ========== MUTATIONS ==========

/**
 * Creates a new project in the database
 * @param input - Validated project creation input
 * @returns The created project entity
 * @throws Supabase error if insert fails or RLS denies access
 */
export async function createProject(input: CreateProjectInput): Promise<Project> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("projects")
        .insert({
            org_id: input.orgId,
            owner_id: input.ownerId,
            name: input.name,
            slug: input.slug,
            description: input.description,
            visibility: input.visibility ?? "private",
            status: input.status ?? "active",
        })
        .select("*")
        .single();

    if (error) throw error;
    return mapProjectRow(data);
}

/**
 * Updates an existing project in the database
 * @param projectId - UUID of the project to update
 * @param payload - Partial project data to update
 * @returns The updated project entity
 * @throws Supabase error if update fails or RLS denies access
 */
export async function updateProject(projectId: string, payload: UpdateProjectInput): Promise<Project> {
    const supabase = await createClient();

    // Build patch object with only provided fields
    const patch: Record<string, unknown> = {};
    if (payload.name !== undefined) patch.name = payload.name;
    if (payload.slug !== undefined) patch.slug = payload.slug;
    if (payload.description !== undefined) patch.description = payload.description;
    if (payload.visibility !== undefined) patch.visibility = payload.visibility;
    if (payload.status !== undefined) patch.status = payload.status;

    const { data, error } = await supabase
        .from("projects")
        .update(patch)
        .eq("id", projectId)
        .select("*")
        .single();

    if (error) throw error;
    return mapProjectRow(data);
}

/**
 * Deletes a project from the database
 * @param projectId - UUID of the project to delete
 * @throws Supabase error if delete fails or RLS denies access
 */
export async function deleteProject(projectId: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", projectId);

    if (error) throw error;
}

/**
 * Deletes multiple projects from the database
 * @param projectIds - Array of UUIDs of projects to delete
 * @throws Supabase error if delete fails or RLS denies access
 */
export async function bulkDeleteProjects(projectIds: string[]): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
        .from("projects")
        .delete()
        .in("id", projectIds);

    if (error) throw error;
}

/**
 * Counts projects in an organization
 * @throws Supabase error if query fails or RLS denies access
 */
export async function countProjectsByOrg(params: { orgId: string }): Promise<number> {
    const supabase = await createClient();

    const { count, error } = await supabase
        .from("projects")
        .select("*", { count: "exact", head: true })
        .eq("org_id", params.orgId);

    if (error) throw error;
    return count ?? 0;
}

/**
 * Returns whether a project is favorited by a user
 */
export async function isProjectFavorited(params: {
    projectId: string;
    userId: string;
}): Promise<boolean> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("project_favorites")
        .select("id")
        .eq("project_id", params.projectId)
        .eq("user_id", params.userId)
        .maybeSingle();

    if (error) throw error;
    return data !== null;
}

/**
 * Adds a project to a user's favorites
 */
export async function addProjectFavorite(params: {
    projectId: string;
    orgId: string;
    userId: string;
}): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase.from("project_favorites").insert({
        project_id: params.projectId,
        org_id: params.orgId,
        user_id: params.userId,
    });

    if (error) {
        // Unique violation — already favorited
        if (error.code === "23505") return;
        throw error;
    }
}

/**
 * Removes a project from a user's favorites
 */
export async function removeProjectFavorite(params: {
    projectId: string;
    userId: string;
}): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
        .from("project_favorites")
        .delete()
        .eq("project_id", params.projectId)
        .eq("user_id", params.userId);

    if (error) throw error;
}
