import 'server-only';
import { getUserOrgRole } from "@/features/memberships/repository";
import { getProfileSummariesByIds } from "@/features/profiles/repository";
import { canViewSettings } from "@/features/organizations/rbac";
import { formatActorName } from "./utils";
import { countOrgEvents, logAppEvent, listRecentEvents } from "./repository";
import {
    AUDIT_LOG_PAGE_SIZE,
    type AppEvent,
    type AppEventName,
    type AuditLogQuery,
} from "./schemas";

export type AuditLogEntry = AppEvent & {
    actorName: string;
};

export type AuditLogPage = {
    entries: AuditLogEntry[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    eventName: AppEventName | null;
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

async function enrichEventsWithActors(events: AppEvent[]): Promise<AuditLogEntry[]> {
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

/**
 * Lists a paginated audit log with optional event-type filter.
 * Restricted to owner/admin, matching the app_events RLS policy.
 */
export async function listAuditLogPageService(params: {
    orgId: string;
    userId: string;
    query: AuditLogQuery;
}): Promise<AuditLogPage> {
    const role = await getUserOrgRole({ userId: params.userId, orgId: params.orgId });
    if (!role || !canViewSettings(role)) {
        throw new Error("Insufficient permissions to view organization activity");
    }

    const pageSize = AUDIT_LOG_PAGE_SIZE;
    const eventName = params.query.event ?? null;

    const total = await countOrgEvents({
        orgId: params.orgId,
        eventName: eventName ?? undefined,
    });

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(params.query.page, totalPages);
    const offset = (page - 1) * pageSize;

    const events = await listRecentEvents({
        orgId: params.orgId,
        limit: pageSize,
        offset,
        eventName: eventName ?? undefined,
    });

    const entries = await enrichEventsWithActors(events);

    return {
        entries,
        total,
        page,
        pageSize,
        totalPages,
        eventName,
    };
}

/** @deprecated Use listAuditLogPageService */
export async function listAuditLogService(params: {
    orgId: string;
    userId: string;
    limit?: number;
    offset?: number;
}): Promise<AuditLogEntry[]> {
    const result = await listAuditLogPageService({
        orgId: params.orgId,
        userId: params.userId,
        query: {
            page: Math.floor((params.offset ?? 0) / (params.limit ?? AUDIT_LOG_PAGE_SIZE)) + 1,
        },
    });

    return result.entries;
}
