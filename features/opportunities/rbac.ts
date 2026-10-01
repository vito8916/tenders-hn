import type { OrgRole } from "@/features/memberships/schemas";

/** Owners, admins, and members say whether an opportunity interests them; viewers only read. */
export function canDecideOpportunity(role: OrgRole): boolean {
    return role !== "viewer";
}
