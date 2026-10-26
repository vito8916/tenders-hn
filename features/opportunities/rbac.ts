import type { OrgRole } from "@/features/memberships/schemas";

/** Owners, admins, and members track opportunities (status, assignee, notes); viewers only read. */
export function canTrackOpportunity(role: OrgRole): boolean {
    return role !== "viewer";
}
