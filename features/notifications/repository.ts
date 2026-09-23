import 'server-only';
import { createClient } from "@/lib/supabase/server";
import {
    mapNotificationRow,
    notificationPreferenceSchema,
    type Notification,
    type NotificationPreference,
    type UpdateNotificationPreferenceInput,
} from "./schemas";

// ========== QUERIES ==========

/**
 * Lists the user's most recent notifications across all organizations
 * (RLS: users only read their own notifications)
 * @throws Supabase error if query fails
 */
export async function listNotifications(params: {
    userId: string;
    limit: number;
}): Promise<Notification[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", params.userId)
        .order("created_at", { ascending: false })
        .limit(params.limit);

    if (error) throw error;

    return data.map(mapNotificationRow);
}

/**
 * Counts the user's unread notifications
 * @throws Supabase error if query fails
 */
export async function countUnreadNotifications(params: { userId: string }): Promise<number> {
    const supabase = await createClient();

    const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", params.userId)
        .is("read_at", null);

    if (error) throw error;

    return count ?? 0;
}

/**
 * Lists every notification type with the user's effective channel choices.
 * The embedded preferences only contain the user's own row (RLS), so a type
 * without one falls back to its defaults.
 * @throws Supabase error if query fails
 */
export async function listNotificationPreferences(params: {
    userId: string;
}): Promise<NotificationPreference[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("notification_types")
        .select("id, label, description, category, default_in_app, default_email, notification_preferences(in_app, email)")
        .eq("notification_preferences.user_id", params.userId)
        .order("category")
        .order("label");

    if (error) throw error;

    return data.map((type) => {
        const saved = type.notification_preferences[0];
        return notificationPreferenceSchema.parse({
            typeId: type.id,
            label: type.label,
            description: type.description,
            category: type.category,
            inApp: saved?.in_app ?? type.default_in_app,
            email: saved?.email ?? type.default_email,
        });
    });
}

// ========== MUTATIONS ==========

/**
 * Marks unread notifications as read: the given ones, or all when ids is omitted
 * @throws Supabase error if update fails
 */
export async function markNotificationsRead(params: {
    userId: string;
    ids?: string[];
}): Promise<void> {
    const supabase = await createClient();

    let query = supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", params.userId)
        .is("read_at", null);

    if (params.ids) {
        query = query.in("id", params.ids);
    }

    const { error } = await query;

    if (error) throw error;
}

/**
 * Saves the user's channel choices for one notification type
 * @throws Supabase error if upsert fails
 */
export async function upsertNotificationPreference(params: {
    userId: string;
} & UpdateNotificationPreferenceInput): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase.from("notification_preferences").upsert({
        user_id: params.userId,
        type_id: params.typeId,
        in_app: params.inApp,
        email: params.email,
        updated_at: new Date().toISOString(),
    });

    if (error) throw error;
}
