import type { OrgRole } from "@/features/memberships/schemas";

/**
 * Owners and admins create, edit, pause, and delete searches (spec §4);
 * any member runs them. Matches the saved_searches RLS policies.
 */
export function canManageSearches(role: OrgRole): boolean {
    return role === "owner" || role === "admin";
}
