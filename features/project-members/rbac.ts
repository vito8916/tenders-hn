import { OrgRole } from "@/features/memberships/schemas";

/**
 * RBAC rules for project membership operations
 * Pure functions - no database access, no side effects
 * Rules match RLS policies in the database
 */

/**
 * Check if user can assign/unassign members to/from a project
 * Only owners and admins can manage project membership
 */
export function canManageProjectMembers(role: OrgRole): boolean {
    return role === "owner" || role === "admin";
}
