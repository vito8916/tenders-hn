import type { OrgRole } from "@/features/memberships/schemas";

/** Questions spend the organization's credits, so viewers read but do not ask (as reserve_ai_credits). */
export function canChat(role: OrgRole): boolean {
    return role !== "viewer";
}
