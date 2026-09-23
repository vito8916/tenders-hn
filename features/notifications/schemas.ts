import { z } from "zod";
import type { Tables } from "@/types/database.types";

/**
 * In-app notification as shown in the header bell
 */
export const notificationSchema = z.object({
    id: z.uuid(),
    orgId: z.uuid().nullable(),
    typeId: z.string(),
    title: z.string(),
    body: z.string().nullable(),
    actionUrl: z.string().nullable(),
    readAt: z.coerce.date().nullable(),
    createdAt: z.coerce.date(),
});

export type Notification = z.infer<typeof notificationSchema>;

/**
 * Maps a notifications row (from a query or a Realtime payload) to the entity
 */
export function mapNotificationRow(row: Tables<"notifications">): Notification {
    return notificationSchema.parse({
        id: row.id,
        orgId: row.org_id,
        typeId: row.type_id,
        title: row.title,
        body: row.body,
        actionUrl: row.action_url,
        readAt: row.read_at,
        createdAt: row.created_at,
    });
}

export const NotificationCategorySchema = z.enum(["organization", "billing"]);

/**
 * A notification type with the user's effective channel choices
 * (their saved preference, or the type's defaults)
 */
export const notificationPreferenceSchema = z.object({
    typeId: z.string(),
    label: z.string(),
    description: z.string(),
    category: NotificationCategorySchema,
    inApp: z.boolean(),
    email: z.boolean(),
});

export type NotificationPreference = z.infer<typeof notificationPreferenceSchema>;

export const updateNotificationPreferenceInputSchema = z.object({
    typeId: z.string().min(1),
    inApp: z.boolean(),
    email: z.boolean(),
});

export type UpdateNotificationPreferenceInput = z.infer<typeof updateNotificationPreferenceInputSchema>;
