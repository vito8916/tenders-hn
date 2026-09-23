import { z } from "zod";

/**
 * Canonical app event names used for audit logging
 * Add new events here so names stay consistent and greppable
 */
export const APP_EVENTS = {
    ORGANIZATION_CREATED: "organization.created",
    ORGANIZATION_UPDATED: "organization.updated",
    ORGANIZATION_DELETED: "organization.deleted",
    ORGANIZATION_OWNERSHIP_TRANSFERRED: "organization.ownership_transferred",
    INVITATION_SENT: "invitation.sent",
    INVITATION_ACCEPTED: "invitation.accepted",
    INVITATION_REVOKED: "invitation.revoked",
    MEMBER_ROLE_CHANGED: "member.role_changed",
    MEMBER_REMOVED: "member.removed",
    MEMBER_LEFT: "member.left",
    // Logged by database triggers on organization_subscriptions
    SUBSCRIPTION_ACTIVATED: "subscription.activated",
    SUBSCRIPTION_RENEWED: "subscription.renewed",
    SUBSCRIPTION_PLAN_CHANGED: "subscription.plan_changed",
    SUBSCRIPTION_CANCELED: "subscription.canceled",
    SUBSCRIPTION_EXPIRED: "subscription.expired",
} as const;

export type AppEventName = (typeof APP_EVENTS)[keyof typeof APP_EVENTS];

/**
 * Input schema for logging an app event
 */
export const logAppEventInputSchema = z.object({
    eventName: z.string().min(1),
    orgId: z.uuid().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * App event entity as read from the database
 */
export const appEventSchema = z.object({
    id: z.number(),
    eventName: z.string(),
    orgId: z.uuid().nullable(),
    userId: z.uuid().nullable(),
    metadata: z.record(z.string(), z.unknown()).nullable(),
    createdAt: z.coerce.date(),
});

export type LogAppEventInput = z.infer<typeof logAppEventInputSchema>;
export type AppEvent = z.infer<typeof appEventSchema>;

export const AUDIT_LOG_PAGE_SIZE = 20;

export const auditLogQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    event: z.enum(Object.values(APP_EVENTS) as [AppEventName, ...AppEventName[]]).optional(),
});

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
