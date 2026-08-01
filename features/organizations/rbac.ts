import { OrgRole } from "@/features/memberships/schemas";

/**
 * RBAC rules for organization operations
 * Pure functions - no database access, no side effects
 * Rules match RLS policies in the database
 */

/**
 * Check if user can read organization details
 * All organization members can read
 */
export function canReadOrganization(_role: OrgRole): boolean {
    return true; // All members can read
}

/**
 * Check if user can create organizations
 * Any authenticated user can create a new organization
 * Note: This is checked at the app level, not org level
 */
export function canCreateOrganization(): boolean {
    return true; // Any authenticated user can create an org
}

/**
 * Check if user can update organization details
 * Only owners and admins can update
 */
export function canUpdateOrganization(role: OrgRole): boolean {
    return role === "owner" || role === "admin";
}

/**
 * Check if user can delete organization
 * Only the owner can delete the organization
 */
export function canDeleteOrganization(role: OrgRole): boolean {
    return role === "owner";
}

/**
 * Check if user can manage organization members
 * Owners and admins can manage members
 */
export function canManageMembers(role: OrgRole): boolean {
    return role === "owner" || role === "admin";
}

/**
 * Check if user can invite members to organization
 * Owners and admins can invite
 */
export function canInviteMembers(role: OrgRole): boolean {
    return role === "owner" || role === "admin";
}

/**
 * Check if user can remove members from organization
 * Owners and admins can remove members
 */
export function canRemoveMembers(role: OrgRole): boolean {
    return role === "owner" || role === "admin";
}

/**
 * Check if user can change member roles
 * Only owners can change roles
 */
export function canChangeMemberRole(role: OrgRole): boolean {
    return role === "owner";
}

/**
 * Check if user can transfer ownership
 * Only the current owner can transfer ownership
 */
export function canTransferOwnership(role: OrgRole): boolean {
    return role === "owner";
}

/**
 * Check if user can view organization settings
 * Owners and admins can view settings
 */
export function canViewSettings(role: OrgRole): boolean {
    return role === "owner" || role === "admin";
}

/**
 * Check if user can leave the organization
 * All members can leave except the owner
 * Owner must transfer ownership or delete org first
 */
export function canLeaveOrganization(role: OrgRole): boolean {
    return role !== "owner";
}
