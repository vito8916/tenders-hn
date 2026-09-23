"use server";

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { updateNotificationPreferenceInputSchema } from "./schemas";
import {
    markAllNotificationsReadService,
    markNotificationReadService,
    updateNotificationPreferenceService,
} from "./services";

/**
 * Server Action for marking one notification as read
 */
export async function markNotificationReadAction(input: {
    notificationId: string;
}): Promise<{ success: boolean; error?: string }> {
    try {
        const { sub: userId } = await getCurrentUser();

        const parsed = z.object({ notificationId: z.uuid() }).safeParse(input);
        if (!parsed.success) {
            return { success: false, error: "Invalid input" };
        }

        await markNotificationReadService({ userId, notificationId: parsed.data.notificationId });

        return { success: true };
    } catch (error) {
        console.error("Error marking notification as read:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to mark notification as read",
        };
    }
}

/**
 * Server Action for marking all of the user's notifications as read
 */
export async function markAllNotificationsReadAction(): Promise<{ success: boolean; error?: string }> {
    try {
        const { sub: userId } = await getCurrentUser();

        await markAllNotificationsReadService({ userId });

        return { success: true };
    } catch (error) {
        console.error("Error marking all notifications as read:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to mark notifications as read",
        };
    }
}

/**
 * Server Action for saving the user's channel choices for a notification type
 */
export async function updateNotificationPreferenceAction(input: {
    typeId: string;
    inApp: boolean;
    email: boolean;
}): Promise<{ success: boolean; error?: string }> {
    try {
        const { sub: userId } = await getCurrentUser();

        const parsed = updateNotificationPreferenceInputSchema.safeParse(input);
        if (!parsed.success) {
            return { success: false, error: "Invalid input" };
        }

        await updateNotificationPreferenceService({ userId, ...parsed.data });

        return { success: true };
    } catch (error) {
        console.error("Error updating notification preference:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to update notification preference",
        };
    }
}
