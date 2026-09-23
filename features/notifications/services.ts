import 'server-only';
import {
    countUnreadNotifications,
    listNotificationPreferences,
    listNotifications,
    markNotificationsRead,
    upsertNotificationPreference,
} from "./repository";
import type {
    Notification,
    NotificationPreference,
    UpdateNotificationPreferenceInput,
} from "./schemas";

const HEADER_NOTIFICATIONS_LIMIT = 20;

/**
 * Service layer for the header bell: latest notifications plus the unread total
 * (which can exceed the number of notifications returned)
 */
export async function getHeaderNotificationsService(params: {
    userId: string;
}): Promise<{ notifications: Notification[]; unreadCount: number }> {
    const [notifications, unreadCount] = await Promise.all([
        listNotifications({ userId: params.userId, limit: HEADER_NOTIFICATIONS_LIMIT }),
        countUnreadNotifications({ userId: params.userId }),
    ]);

    return { notifications, unreadCount };
}

export async function markNotificationReadService(params: {
    userId: string;
    notificationId: string;
}): Promise<void> {
    await markNotificationsRead({ userId: params.userId, ids: [params.notificationId] });
}

export async function markAllNotificationsReadService(params: { userId: string }): Promise<void> {
    await markNotificationsRead({ userId: params.userId });
}

export async function listNotificationPreferencesService(params: {
    userId: string;
}): Promise<NotificationPreference[]> {
    return listNotificationPreferences(params);
}

export async function updateNotificationPreferenceService(params: {
    userId: string;
} & UpdateNotificationPreferenceInput): Promise<void> {
    await upsertNotificationPreference(params);
}
