import { OrgRole } from "@/features/memberships/schemas";

/**
 * RBAC rules for project operations
 * Pure functions - no database access, no side effects
 * Rules match RLS policies in the database
 */

/**
 * Check if user can read projects
 * All organization members can read projects
 */
export function canReadProject(_role: OrgRole): boolean {
    return true; // All org members can read
}

/**
 * Check if user can create projects
 * Owners, admins, and members can create projects
 */
export function canCreateProject(role: OrgRole): boolean {
    return role === "owner" || role === "admin" || role === "member";
}

/**
 * Check if user can update projects
 * Owners, admins, and members can update projects
 */
export function canUpdateProject(role: OrgRole): boolean {
    return role === "owner" || role === "admin" || role === "member";
}

/**
 * Check if user can delete projects
 * Only owners and admins can delete projects
 */
export function canDeleteProject(role: OrgRole): boolean {
    return role === "owner" || role === "admin";
}

/**
 * Fine-grained update permission
 * Considers role, project ownership, and project assignment
 * Owners/admins can update any project; members can update projects they
 * created or are assigned to; viewers can never update
 */
export function canUpdateProjectAsOwnerOrPrivileged(args: {
    role: OrgRole;
    isProjectOwner: boolean;
    isAssigned: boolean;
}): boolean {
    const { role, isProjectOwner, isAssigned } = args;
    if (role === "owner" || role === "admin") return true;
    return role === "member" && (isProjectOwner || isAssigned);
}
