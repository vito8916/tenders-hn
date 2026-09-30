import type { OrgRole } from "@/features/memberships/schemas";

/** Only the owner subscribes, changes plan, and opens the customer portal (plan O12); admins see billing read-only. */
export function canManageBilling(role: OrgRole): boolean {
    return role === "owner";
}
