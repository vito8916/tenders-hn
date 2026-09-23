import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getHeaderNotificationsService } from "../services";
import { NotificationsBell } from "./notifications-bell";

export async function HeaderNotifications({ userId }: { userId: string }) {
    const { notifications, unreadCount } = await getHeaderNotificationsService({ userId });

    return (
        <NotificationsBell
            userId={userId}
            initialNotifications={notifications}
            initialUnreadCount={unreadCount}
        />
    );
}

export function HeaderNotificationsFallback() {
    return (
        <Button variant="outline" size="icon" className="size-9" disabled aria-label="Notifications">
            <Bell className="size-4" aria-hidden="true" />
        </Button>
    );
}
