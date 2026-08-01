import 'server-only';
import { getUserOrgRole } from "@/features/memberships/repository";
import { canViewSettings } from "@/features/organizations/rbac";
import { logAppEvent, listRecentEvents } from "./repository";
import type { AppEvent, AppEventName } from "./schemas";

/**
 * Best-effort audit logging: a logging failure must never break the
 * business flow that triggered it, so errors are reported and swallowed.
 */
export async function logAppEventService(params: {
    eventName: AppEventName;
    orgId?: string | null;
    metadata?: Record<string, unknown>;
}): Promise<void> {
    try {
        await logAppEvent(params);
    } catch (error) {
        console.error(`Failed to log app event "${params.eventName}":`, error);
    }
}

/**
 * Service layer for listing an organization's recent activity
 * Restricted to owner/admin, matching the app_events RLS policy
 *
 * @throws Error if the user lacks permission
 */
export async function listRecentEventsService(params: {
    orgId: string;
    userId: string;
    limit?: number;
}): Promise<AppEvent[]> {
    const role = await getUserOrgRole({ userId: params.userId, orgId: params.orgId });
    if (!role || !canViewSettings(role)) {
        throw new Error("Insufficient permissions to view organization activity");
    }

    return listRecentEvents({ orgId: params.orgId, limit: params.limit });
}
