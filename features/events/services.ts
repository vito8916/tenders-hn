import 'server-only';
import { getUserOrgRole } from "@/features/memberships/repository";
import { getProfileSummariesByIds } from "@/features/profiles/repository";
import { canViewSettings } from "@/features/organizations/rbac";
import { formatActorName } from "./utils";
import { logAppEvent, listRecentEvents } from "./repository";
import type { AppEvent, AppEventName } from "./schemas";

export type AuditLogEntry = AppEvent & {
    actorName: string;
};

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

/**
 * Lists organization audit log entries with actor names resolved from profiles.
 * Restricted to owner/admin, matching the app_events RLS policy.
 */
export async function listAuditLogService(params: {
    orgId: string;
    userId: string;
    limit?: number;
    offset?: number;
}): Promise<AuditLogEntry[]> {
    const role = await getUserOrgRole({ userId: params.userId, orgId: params.orgId });
    if (!role || !canViewSettings(role)) {
        throw new Error("Insufficient permissions to view organization activity");
    }

    const events = await listRecentEvents({
        orgId: params.orgId,
        limit: params.limit ?? 50,
        offset: params.offset ?? 0,
    });

    const userIds = [
        ...new Set(events.map((event) => event.userId).filter((id): id is string => !!id)),
    ];

    const profiles = userIds.length
        ? await getProfileSummariesByIds({ userIds })
        : [];

    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

    return events.map((event) => {
        const profile = event.userId ? profileById.get(event.userId) : undefined;

        return {
            ...event,
            actorName: profile
                ? formatActorName({
                      fullName: profile.fullName,
                      email: profile.email,
                  })
                : "System",
        };
    });
}
